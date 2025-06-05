'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { User } from '@supabase/supabase-js'
import { Tables } from '@/database.types'

type Profile = Tables<'profiles'>
type Reserve = Tables<'reserves'> & {
  members?: Tables<'profiles'>[]
}

// スタイルの追加
const fadeInOut = {
  animation: 'fadeInOut 2s ease-in-out',
}

// グローバルスタイルの追加
const globalStyles = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
`

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reserves, setReserves] = useState<Reserve[]>([])
  const [participatingReserves, setParticipatingReserves] = useState<Reserve[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    organization: ''
  })
  const [updateMessage, setUpdateMessage] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [reserveToDelete, setReserveToDelete] = useState<Reserve | null>(null)
  const supabase = createClient()

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
          setProfile(profile as Profile)
          if (profile) {
            setFormData({
              name: profile.name ?? '',
              organization: profile.organization ?? ''
            })
          }

          // 作成した予約一覧を取得
          const { data: reserves, error } = await supabase
            .from('reserves')
            .select(`
              *,
              reserve_member_relations (
                member:profiles (
                  id,
                  name,
                  organization,
                  user_id
                )
              )
            `)
            .eq('user_id', user.id)
            .order('start_time', { ascending: true })

          if (error) {
            console.error('Error fetching reserves:', error)
            return
          }

          // 作成した予約データを整形
          const formattedReserves = (reserves || []).map(reserve => ({
            ...reserve,
            members: reserve.reserve_member_relations?.map(relation => relation.member) || []
          }))

          setReserves(formattedReserves as Reserve[])

          // 参加予定の予約一覧を取得
          const { data: participatingReserves, error: participatingError } = await supabase
            .from('reserve_member_relations')
            .select(`
              reserve:reserves (
                *,
                reserve_member_relations (
                  member:profiles (
                    id,
                    name,
                    organization,
                    user_id
                  )
                )
              )
            `)
            .eq('member_id', profile?.id)
            .order('reserve(start_time)', { ascending: true })

          if (participatingError) {
            console.error('Error fetching participating reserves:', participatingError)
            return
          }

          // 参加予定の予約データを整形
          const formattedParticipatingReserves = (participatingReserves || [])
            .map(relation => ({
              ...relation.reserve,
              members: relation.reserve.reserve_member_relations?.map(r => r.member) || []
            }))
            .filter(reserve => reserve !== null)

          setParticipatingReserves(formattedParticipatingReserves as Reserve[])
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }
    getUser()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      // 既存のプロフィールを検索
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single()

      let profileId: string

      if (fetchError) {
        // プロフィールが存在しない場合は新規作成
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            name: formData.name,
            organization: formData.organization
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        profileId = (newProfile as { id: string }).id
      } else {
        profileId = (existingProfile as { id: string }).id
      }

      // 既存レコードを更新
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          organization: formData.organization
        })
        .eq('id', profileId)

      if (updateError) throw updateError

      // 更新後のデータを取得
      const { data: updatedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      setProfile(updatedProfile as Profile)
      setIsEditing(false)
      setUpdateMessage('プロフィールを更新しました')
      setTimeout(() => setUpdateMessage(''), 3000)
    } catch (error) {
      console.error('Error updating profile:', error)
      setUpdateMessage(error instanceof Error ? error.message : '更新に失敗しました')
    }
  }

  // 日時フォーマット関数
  const formatDisplayDate = (dateTimeString: string | null) => {
    if (!dateTimeString) return ''
    return new Date(dateTimeString).toLocaleDateString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    })
  }

  const formatTimeRange = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return ''
    const start = new Date(startTime).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    const end = new Date(endTime).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    return `${start} - ${end}`
  }

  const handleDelete = async (reserve: Reserve) => {
    try {
      const { error } = await supabase
        .from('reserves')
        .delete()
        .eq('id', reserve.id)

      if (error) throw error

      // 予約一覧を更新
      setReserves(prev => prev.filter(r => r.id !== reserve.id))
      setReserveToDelete(null)
      setIsConfirming(false)
      setUpdateMessage('予約を削除しました')
      setTimeout(() => setUpdateMessage(''), 3000)
    } catch (error) {
      console.error('Error deleting reserve:', error)
      setUpdateMessage('予約の削除に失敗しました')
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>
  }

  if (!user) {
    return <div className="flex justify-center items-center min-h-screen">ログインしてください</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <style>{globalStyles}</style>
      <h1 className="text-2xl font-bold mb-6">プロフィール</h1>
      {updateMessage && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg" style={fadeInOut}>
          {updateMessage}
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">メールアドレス</label>
            <p className="mt-1 text-lg">{user.email}</p>
          </div>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">名前</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">組織</label>
                <input
                  type="text"
                  name="organization"
                  value={formData.organization}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  キャンセル
                </button>
              </div>
            </form>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">名前</label>
                <p className="mt-1 text-lg">{profile?.name || '未設定'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">組織</label>
                <p className="mt-1 text-lg">{profile?.organization || '未設定'}</p>
              </div>
              {profile?.admin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">権限</label>
                  <p className="mt-1 text-lg">管理者</p>
                </div>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                編集
              </button>
            </>
          )}
        </div>
      </div>

      {/* 作成した予約一覧セクション */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">作成した予約一覧</h2>
        {reserves.length === 0 ? (
          <p className="text-gray-500">予約はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative">
              <div className="grid grid-cols-[30%_30%_40%] min-w-full bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">日時</div>
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">タイトル</div>
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">参加メンバー</div>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reserves.map((reserve) => (
                    <li key={reserve.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="grid grid-cols-[30%_30%_40%] min-w-full bg-white dark:bg-gray-800">
                        <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDisplayDate(reserve.start_time)} {formatTimeRange(reserve.start_time, reserve.end_time)}
                        </div>
                        <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {reserve.title || '無題'}
                        </div>
                        <div className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {reserve.members && reserve.members.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {reserve.members.map((member) => (
                                <span
                                  key={member.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                                >
                                  {member.name} {member.organization ? `(${member.organization})` : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '未設定'
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 参加予定の予約一覧セクション */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">参加予定の予約一覧</h2>
        {participatingReserves.length === 0 ? (
          <p className="text-gray-500">参加予定の予約はありません</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative">
              <div className="grid grid-cols-[30%_30%_40%] min-w-full bg-gray-50 dark:bg-gray-700 rounded-t-lg">
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">日時</div>
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">タイトル</div>
                <div className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">参加メンバー</div>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {participatingReserves.map((reserve) => (
                    <li key={reserve.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="grid grid-cols-[30%_30%_40%] min-w-full bg-white dark:bg-gray-800">
                        <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {formatDisplayDate(reserve.start_time)} {formatTimeRange(reserve.start_time, reserve.end_time)}
                        </div>
                        <div className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                          {reserve.title || '無題'}
                        </div>
                        <div className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {reserve.members && reserve.members.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {reserve.members.map((member) => (
                                <span
                                  key={member.id}
                                  className="inline-flex items-center px-2 py-0.5 rounded text-xs"
                                >
                                  {member.name} {member.organization ? `(${member.organization})` : ''}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '未設定'
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 