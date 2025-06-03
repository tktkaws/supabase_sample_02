'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '../../database.types'
import { User } from '@supabase/supabase-js'

type Profile = Database['public']['Tables']['profiles']['Row']

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editOrganization, setEditOrganization] = useState('')
  const supabase = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        console.log('session', session)
        if (session?.user) {
          setUser(session.user)
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

        setProfiles(data || [])
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
      console.log('auth state changed', session)
      setUser(session?.user ?? null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile)
    setEditName(profile.name || '')
    setEditOrganization(profile.organization || '')
  }

  const handleSave = async () => {
    if (!editingProfile) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editName,
          organization: editOrganization,
        })
        .eq('id', editingProfile.id)

      if (error) throw error

      // 更新後のプロフィール一覧を再取得
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setProfiles(data || [])
      setEditingProfile(null)
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const handleCancel = () => {
    setEditingProfile(null)
  }

  if (loading) {
    return <div className="p-4">読み込み中...</div>
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">ユーザー一覧</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                名前
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                組織
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                作成日時
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {editingProfile?.id === profile.id ? (
                  <>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        value={editOrganization}
                        onChange={(e) => setEditOrganization(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                      />
                    </td>
                    <td className="px-6 py-4">
                      {new Date(profile.created_at).toLocaleString('ja-JP')}
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
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {profile.name || '名前なし'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.organization || '未設定'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(profile.created_at).toLocaleString('ja-JP')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user && profile.user_id === user.id && (
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