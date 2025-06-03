'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [])

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">ログインしてください</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">プロフィール</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">メールアドレス</label>
            <p className="mt-1 text-lg">{user.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ユーザーID</label>
            <p className="mt-1 text-lg">{user.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">最終ログイン</label>
            <p className="mt-1 text-lg">{new Date(user.last_sign_in_at || '').toLocaleString('ja-JP')}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 