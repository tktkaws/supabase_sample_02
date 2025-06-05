'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { Database } from '../../database.types'
import { User } from '@supabase/supabase-js'

type Profile = Database['public']['Tables']['profiles']['Row']
type SortField = 'organization' | 'name' | 'admin'
type SortOrder = 'asc' | 'desc'

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrganization, setEditOrganization] = useState('')
  const [editAdmin, setEditAdmin] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    organization: '',
    admin: false
  })
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const supabase = createClient()

  // ソート関数
  const sortProfiles = (profiles: Profile[], field: SortField, order: SortOrder) => {
    return [...profiles].sort((a, b) => {
      let aValue = a[field]
      let bValue = b[field]

      // null値の処理
      if (aValue === null) aValue = ''
      if (bValue === null) bValue = ''

      // 文字列比較
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return order === 'asc' 
          ? aValue.localeCompare(bValue, 'ja')
          : bValue.localeCompare(aValue, 'ja')
      }

      // 真偽値比較（管理者権限）
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return order === 'asc'
          ? (aValue === bValue ? 0 : aValue ? 1 : -1)
          : (aValue === bValue ? 0 : aValue ? -1 : 1)
      }

      return 0
    })
  }

  // ソートハンドラー
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // ソートアイコンの表示
  const getSortIcon = (field: SortField) => {
    if (field !== sortField) return '↕'
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()
          setCurrentUserProfile(profile as Profile)
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      }
    }

    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        setProfiles(data as Profile[] || [])
      } catch (error) {
        console.error('Error fetching profiles:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
    fetchProfiles()

    // 認証状態の変更を監視
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  // ソートされたプロフィールリスト
  const sortedProfiles = sortProfiles(profiles, sortField, sortOrder)

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setEditName(profile.name || '')
    setEditOrganization(profile.organization || '')
    setEditAdmin(profile.admin)
  }

  const handleSave = async () => {
    if (!editingProfile) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName,
          organization: editOrganization,
          admin: currentUserProfile?.admin ? editAdmin : editingProfile.admin
        })
        .eq('id', editingProfile.id)

      if (error) throw error

      // 更新後のプロフィール一覧を再取得
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setProfiles(data as Profile[] || [])
      setEditingProfile(null)
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const handleCancel = () => {
    setEditingProfile(null)
  }

  const handleCreateUser = async () => {
    try {
      setError(null)
      
      // 1. 認証ユーザーを作成
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('ユーザー作成に失敗しました')

      // 2. プロフィールを作成
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          name: newUser.name,
          organization: newUser.organization,
          admin: newUser.admin
        })

      if (profileError) throw profileError

      // 3. プロフィール一覧を更新
      const { data: updatedProfiles, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setProfiles(updatedProfiles as Profile[] || [])
      setIsCreating(false)
      setNewUser({
        email: '',
        password: '',
        name: '',
        organization: '',
        admin: false
      })
    } catch (error) {
      console.error('Error creating user:', error)
      setError(error instanceof Error ? error.message : 'ユーザー作成に失敗しました')
    }
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">ユーザー一覧</h1>
        {currentUserProfile?.admin && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            新規ユーザー作成
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">新規ユーザー作成</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                メールアドレス
              </label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                パスワード
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                名前
              </label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                組織
              </label>
              <input
                type="text"
                value={newUser.organization}
                onChange={(e) => setNewUser({ ...newUser, organization: e.target.value })}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newUser.admin}
                  onChange={(e) => setNewUser({ ...newUser, admin: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  管理者権限を付与
                </span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end space-x-2">
            <button
              onClick={() => {
                setIsCreating(false)
                setError(null)
                setNewUser({
                  email: '',
                  password: '',
                  name: '',
                  organization: '',
                  admin: false
                })
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleCreateUser}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              作成
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => handleSort('organization')}
              >
                組織 {getSortIcon('organization')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => handleSort('name')}
              >
                名前 {getSortIcon('name')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={() => handleSort('admin')}
              >
                管理者 {getSortIcon('admin')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedProfiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {editingProfile?.id === profile.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editOrganization}
                        onChange={(e) => setEditOrganization(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4">
                      {currentUserProfile?.admin ? (
                        <select
                          value={editAdmin ? 'admin' : 'user'}
                          onChange={(e) => setEditAdmin(e.target.value === 'admin')}
                          className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                        >
                          <option value="user">一般</option>
                          <option value="admin">管理者</option>
                        </select>
                      ) : (
                        profile.admin ? '管理者' : '一般'
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={handleSave}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                        >
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.organization || '未設定'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {profile.name || '名前なし'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.admin ? '管理者' : '一般'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user && (profile.user_id === user.id || currentUserProfile?.admin) && (
                        <button
                          onClick={() => handleEdit(profile)}
                          className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          編集
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {profiles.length === 0 && (
          <p className="text-gray-500 text-center py-4">ユーザーがありません。</p>
        )}
      </div>
    </div>
  )
} 