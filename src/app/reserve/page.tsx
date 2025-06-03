'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { Tables } from '@/database.types'

type Reserve = Tables<'reserves'>
type Profile = Tables<'profiles'>

type ReserveWithProfile = Reserve & {
  profile: Profile | null
}

export default function ReservePage() {
  const [reserves, setReserves] = useState<ReserveWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingReserveId, setEditingReserveId] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: ''
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchReserves()
    // 現在のユーザーIDを取得
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  // 15分単位の時間を取得する関数
  const getRoundedTime = () => {
    const now = new Date()
    const minutes = now.getMinutes()
    const roundedMinutes = Math.ceil(minutes / 15) * 15
    now.setMinutes(roundedMinutes)
    now.setSeconds(0)
    now.setMilliseconds(0)
    
    // 日本時間に変換
    const jstOffset = 9 * 60 // 日本時間のオフセット（分）
    const utcMinutes = now.getUTCMinutes()
    const utcHours = now.getUTCHours()
    const totalMinutes = utcHours * 60 + utcMinutes + jstOffset
    
    const jstHours = Math.floor(totalMinutes / 60) % 24
    const jstMinutes = totalMinutes % 60
    
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`
  }

  // 1時間後の時間を取得する関数
  const getOneHourLater = (timeString: string) => {
    // 入力された時間文字列を解析
    const [datePart, timePart] = timeString.split('T')
    const [year, month, day] = datePart.split('-').map(Number)
    const [hours, minutes] = timePart.split(':').map(Number)
    
    // 日本時間で1時間後を計算
    const totalMinutes = hours * 60 + minutes + 60 // 1時間（60分）を加算
    const newHours = Math.floor(totalMinutes / 60) % 24
    const newMinutes = totalMinutes % 60
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
  }

  // フォームを開く時に初期時間を設定
  const handleOpenForm = () => {
    const roundedTime = getRoundedTime()
    const endTime = getOneHourLater(roundedTime)
    console.log('Start time:', roundedTime)
    console.log('End time:', endTime)
    setFormData(prev => ({
      ...prev,
      start_time: roundedTime,
      end_time: endTime
    }))
    setIsFormOpen(true)
  }

  const fetchReserves = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 予約データを取得（全ての予約）
      const { data: reservesData, error: reservesError } = await supabase
        .from('reserves')
        .select('*')
        .order('start_time', { ascending: true })

      if (reservesError) throw reservesError

      // 予約者のプロフィール情報を取得（user_idが存在する場合のみ）
      const validUserIds = reservesData
        ?.filter(reserve => reserve.user_id !== null)
        .map(reserve => reserve.user_id) || []

      let profilesData: Profile[] = []
      if (validUserIds.length > 0) {
        const { data, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', validUserIds)

        if (profilesError) throw profilesError
        profilesData = (data || []) as Profile[]
      }

      // 予約データとプロフィール情報を結合
      const reservesWithProfile = (reservesData as Reserve[]).map(reserve => ({
        ...reserve,
        profile: reserve.user_id ? profilesData.find(profile => profile.user_id === reserve.user_id) || null : null
      }))

      setReserves(reservesWithProfile)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 編集モードでフォームを開く
  const handleEdit = (reserve: ReserveWithProfile) => {
    setEditingReserveId(reserve.id)
    setFormData({
      title: reserve.title || '',
      start_time: reserve.start_time || '',
      end_time: reserve.end_time || '',
      description: reserve.description || ''
    })
    setIsEditing(true)
    setIsFormOpen(true)
  }

  // フォームを閉じる
  const handleCloseForm = () => {
    setIsFormOpen(false)
    setIsEditing(false)
    setEditingReserveId(null)
    setFormData({
      title: '',
      start_time: '',
      end_time: '',
      description: ''
    })
    setError('')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name === 'start_time' || name === 'end_time') {
      // 日時文字列を解析
      const [datePart, timePart] = value.split('T')
      const [hours, minutes] = timePart.split(':').map(Number)
      
      // 15分単位に丸める
      const roundedMinutes = Math.round(minutes / 15) * 15
      const totalMinutes = hours * 60 + roundedMinutes
      const newHours = Math.floor(totalMinutes / 60) % 24
      const newMinutes = totalMinutes % 60
      
      const roundedTime = `${datePart}T${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
      
      setFormData(prev => {
        const newData = {
          ...prev,
          [name]: roundedTime
        }
        
        // 開始時間と終了時間の両方が設定されている場合、重複チェック
        if (newData.start_time && newData.end_time) {
          if (checkTimeOverlap(newData.start_time, newData.end_time, editingReserveId)) {
            setError('選択された時間は既存の予約と重複しています')
          } else {
            setError('')
          }
        }
        
        return newData
      })
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 重複チェック（編集時は自分の予約との重複を無視）
    if (checkTimeOverlap(formData.start_time, formData.end_time, editingReserveId)) {
      setError('選択された時間は既存の予約と重複しています')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (isEditing && editingReserveId) {
        // 予約を更新
        const { error } = await supabase
          .from('reserves')
          .update({
            title: formData.title,
            start_time: formatDateTime(formData.start_time),
            end_time: formatDateTime(formData.end_time),
            description: formData.description
          })
          .eq('id', editingReserveId)
          .eq('user_id', user.id) // 自分の予約のみ更新可能

        if (error) throw error
        setMessage('予約を更新しました')
      } else {
        // 新規予約を作成
        const { error } = await supabase
          .from('reserves')
          .insert({
            user_id: user.id,
            title: formData.title,
            start_time: formatDateTime(formData.start_time),
            end_time: formatDateTime(formData.end_time),
            description: formData.description
          })

        if (error) throw error
        setMessage('予約を作成しました')
      }

      setError('')
      handleCloseForm()
      fetchReserves()
    } catch (error) {
      console.error('Error saving reserve:', error)
      setMessage('予約の保存に失敗しました')
    }
    setTimeout(() => setMessage(''), 3000)
  }

  // 重複チェック関数を修正（編集時は自分の予約との重複を無視）
  const checkTimeOverlap = (startTime: string, endTime: string, excludeReserveId: number | null = null) => {
    if (!startTime || !endTime) return false

    const newStart = new Date(startTime)
    const newEnd = new Date(endTime)

    if (newStart >= newEnd) {
      return true
    }

    return reserves.some(reserve => {
      // 編集時は自分の予約との重複を無視
      if (excludeReserveId && reserve.id === excludeReserveId) return false
      if (!reserve.start_time || !reserve.end_time) return false

      const existingStart = new Date(reserve.start_time)
      const existingEnd = new Date(reserve.end_time)

      return (
        (newStart >= existingStart && newStart < existingEnd) ||
        (newEnd > existingStart && newEnd <= existingEnd) ||
        (newStart <= existingStart && newEnd >= existingEnd)
      )
    })
  }

  // 日付表示用のフォーマット関数
  const formatDisplayDate = (dateTimeString: string | null) => {
    if (!dateTimeString) return '未設定'
    try {
      const date = new Date(dateTimeString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}年${month}月${day}日`
    } catch (error) {
      console.error('Error formatting date:', error)
      return '未設定'
    }
  }

  // 時間表示用のフォーマット関数
  const formatTime = (dateTimeString: string | null) => {
    if (!dateTimeString) return '未設定'
    try {
      const date = new Date(dateTimeString)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    } catch (error) {
      console.error('Error formatting time:', error)
      return '未設定'
    }
  }

  // 時間範囲の表示用フォーマット関数
  const formatTimeRange = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return '未設定'
    return `${formatTime(startTime)} - ${formatTime(endTime)}`
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <button
          onClick={handleOpenForm}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          予約を作成
        </button>
      </div>

      {message && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-lg">
          {message}
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{isEditing ? '予約を編集' : '予約を作成'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">タイトル</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">開始時間</label>
                <input
                  type="datetime-local"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  step="900"
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 ${
                    error ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">15分単位で選択してください</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">終了時間</label>
                <input
                  type="datetime-local"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleInputChange}
                  step="900"
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 ${
                    error ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                <p className="mt-1 text-sm text-gray-500">15分単位で選択してください</p>
                {error && (
                  <p className="mt-1 text-sm text-red-600">{error}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">説明</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  {isEditing ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reserves.length === 0 ? (
        <div className="text-center text-gray-500">予約がありません</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg shadow">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">予約者</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">所属</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">日付</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">時間</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">タイトル</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">説明</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {reserves.map((reserve) => (
                <tr key={reserve.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {reserve.profile?.name || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {reserve.profile?.organization || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDisplayDate(reserve.start_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatTimeRange(reserve.start_time, reserve.end_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {reserve.title || '無題'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {reserve.description || '未設定'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {reserve.user_id === currentUserId && (
                      <button
                        onClick={() => handleEdit(reserve)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                      >
                        編集
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
