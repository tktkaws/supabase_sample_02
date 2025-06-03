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
      <div className="grid gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            {editingProfile?.id === profile.id ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    名前
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    組織
                  </label>
                  <input
                    type="text"
                    value={editOrganization}
                    onChange={(e) => setEditOrganization(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold">{profile.name || '名前なし'}</h2>
                <p className="text-gray-600">組織: {profile.organization || '未設定'}</p>
                <p className="text-sm text-gray-500">
                  作成日時: {new Date(profile.created_at).toLocaleString('ja-JP')}
                </p>
                {user && profile.user_id === user.id && (
                  <button
                    onClick={() => handleEdit(profile)}
                    className="mt-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    編集
                  </button>
                )}
              </>
            )}
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="text-gray-500">ユーザーがありません。</p>
        )}
      </div>
    </div>
  )
} 