'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/utils/supabase/client'
import { Tables } from '@/database.types'

type Reserve = Tables<'reserves'>
type Profile = Tables<'profiles'>
type Group = Tables<'groups'>

type ReserveWithProfile = Reserve & {
  profile: Profile | null
  groups?: Group[]
  reserve_group?: {
    id: number
  } | null
  relatedReserves?: ReserveWithProfile[]
}

// スタイルの追加（ファイルの先頭付近に追加）
const fadeInOut = {
  animation: 'fadeInOut 2s ease-in-out',
}

// グローバルスタイルの追加（ファイルの先頭付近に追加）
const globalStyles = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(10px); }
    10% { opacity: 1; transform: translateY(0); }
    90% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
  }
`

// 編集モードの型定義
type EditMode = 'select' | 'single' | 'all' | false
type DeleteMode = 'select' | 'single' | 'all' | false
type ConfirmMode = 'delete' | false

export default function ReservePage() {
  const [reserves, setReserves] = useState<ReserveWithProfile[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState<EditMode>(false)
  const [editingReserveId, setEditingReserveId] = useState<number | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'timetable' | 'monthly'>('timetable')
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff))
  })
  const [currentMonthStart, setCurrentMonthStart] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [formData, setFormData] = useState({
    title: '',
    start_time: '',
    end_time: '',
    description: '',
    selectedGroups: [] as number[],
    isRecurring: false,
    recurringWeeks: 1
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selectedReserve, setSelectedReserve] = useState<ReserveWithProfile | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<DeleteMode>(false)
  const [deletingReserveId, setDeletingReserveId] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState<ConfirmMode>(false)
  const [deleteMode, setDeleteMode] = useState<'single' | 'all' | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchReserves()
    fetchGroups()
    // 現在のユーザーIDを取得
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)
    }
    getCurrentUser()
  }, [])

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setGroups((data || []) as Group[])
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  const fetchReserves = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 予約データを取得（全ての予約）
      const { data: reservesData, error: reservesError } = await supabase
        .from('reserves')
        .select(`
          *,
          reserve_group_relations (
            groups (
              id,
              name,
              description
            )
          ),
          reserve_relations (
            reserve_groups (
              id
            )
          )
        `)
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
      const reservesWithProfile = (reservesData as any[]).map(reserve => ({
        ...reserve,
        profile: reserve.user_id ? profilesData.find(profile => profile.user_id === reserve.user_id) || null : null,
        groups: reserve.reserve_group_relations?.map((relation: any) => relation.groups) || [],
        reserve_group: reserve.reserve_relations?.[0]?.reserve_groups || null
      }))

      setReserves(reservesWithProfile)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

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
  const handleOpenForm = (selectedDate?: Date) => {
    const now = new Date()
    const hours = now.getHours()
    const minutes = Math.ceil(now.getMinutes() / 15) * 15
    
    let formattedDate: string
    if (selectedDate) {
      formattedDate = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
    } else {
      formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    }
    
    const startTime = `${formattedDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    const endTime = getOneHourLater(startTime)
    
    setFormData({
      title: '',
      start_time: startTime,
      end_time: endTime,
      description: '',
      selectedGroups: [],
      isRecurring: false,
      recurringWeeks: 1
    })
    
    setIsEditing(false)
    setEditingReserveId(null)
    setIsFormOpen(true)
  }

  // 日付セルをクリックした時の処理
  const handleDateCellClick = (date: Date) => {
    handleOpenForm(date)
  }

  // 編集モードでフォームを開く
  const handleEdit = (reserve: ReserveWithProfile) => {
    setEditingReserveId(reserve.id)
    const startTime = reserve.start_time ? new Date(reserve.start_time) : new Date()
    const endTime = reserve.end_time ? new Date(reserve.end_time) : new Date()
    
    // 時間を15分単位に丸める
    const roundToNearest15 = (date: Date) => {
      const minutes = date.getMinutes()
      const roundedMinutes = Math.round(minutes / 15) * 15
      date.setMinutes(roundedMinutes)
      return date
    }

    const roundedStartTime = roundToNearest15(startTime)
    const roundedEndTime = roundToNearest15(endTime)
    
    // 時間をHH:mm形式に変換
    const formatTimeToHHmm = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    const startTimeStr = formatTimeToHHmm(roundedStartTime)
    const endTimeStr = formatTimeToHHmm(roundedEndTime)
    
    setFormData({
      title: reserve.title || '',
      start_time: `${roundedStartTime.toISOString().split('T')[0]}T${startTimeStr}`,
      end_time: `${roundedEndTime.toISOString().split('T')[0]}T${endTimeStr}`,
      description: reserve.description || '',
      selectedGroups: reserve.groups?.map(group => group.id) || [],
      isRecurring: false,
      recurringWeeks: 1
    })

    // 関連する予約がある場合は編集モードを選択
    if (reserve.reserve_group) {
      const relatedReserves = reserves.filter(r => r.reserve_group?.id === reserve.reserve_group?.id)
      if (relatedReserves.length > 1) {
        setIsEditing('select') // 編集モード選択状態
        return
      }
    }

    setIsEditing('single') // 単一予約編集モード
    setIsFormOpen(true)
  }

  // 編集モードを選択
  const handleEditModeSelect = (mode: 'single' | 'all') => {
    setIsEditing(mode)
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
      description: '',
      selectedGroups: [],
      isRecurring: false,
      recurringWeeks: 1
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
        // 編集対象の予約を取得
        const editingReserve = reserves.find(r => r.id === editingReserveId)
        if (!editingReserve) return

        if (isEditing === 'single') {
          // 単一予約の編集
          const { error } = await supabase
            .from('reserves')
            .update({
              title: formData.title,
              start_time: formatDateTime(formData.start_time),
              end_time: formatDateTime(formData.end_time),
              description: formData.description
            })
            .eq('id', editingReserveId)
            .eq('user_id', user.id)

          if (error) throw error

          // 予約グループから削除
          if (editingReserve.reserve_group) {
            await supabase
              .from('reserve_relations')
              .delete()
              .eq('reserve_id', editingReserveId)
          }

          // グループ関係を更新
          await supabase
            .from('reserve_group_relations')
            .delete()
            .eq('reserve_id', editingReserveId)

          if (formData.selectedGroups.length > 0) {
            const groupRelations = formData.selectedGroups.map(groupId => ({
              reserve_id: editingReserveId,
              group_id: groupId
            }))

            const { error: relationError } = await supabase
              .from('reserve_group_relations')
              .insert(groupRelations)

            if (relationError) throw relationError
          }

          setMessage('予約を更新しました')
        } else {
          // 全ての関連予約を更新
          const relatedReserves = editingReserve.reserve_group
            ? reserves.filter(r => r.reserve_group?.id === editingReserve.reserve_group?.id)
            : [editingReserve]

          // 編集対象の予約の時間変更量を計算
          const editingReserveStart = new Date(editingReserve.start_time!)
          const editingReserveEnd = new Date(editingReserve.end_time!)
          const newStart = new Date(formData.start_time)
          const newEnd = new Date(formData.end_time)
          
          const timeDiff = {
            hours: newStart.getHours() - editingReserveStart.getHours(),
            minutes: newStart.getMinutes() - editingReserveStart.getMinutes()
          }

          for (const reserve of relatedReserves) {
            if (!reserve.start_time || !reserve.end_time) continue

            // 元の予約の時間を取得
            const originalStart = new Date(reserve.start_time)
            const originalEnd = new Date(reserve.end_time)

            // 新しい時間を計算
            const newReserveStart = new Date(originalStart)
            newReserveStart.setHours(originalStart.getHours() + timeDiff.hours)
            newReserveStart.setMinutes(originalStart.getMinutes() + timeDiff.minutes)

            const newReserveEnd = new Date(originalEnd)
            newReserveEnd.setHours(originalEnd.getHours() + timeDiff.hours)
            newReserveEnd.setMinutes(originalEnd.getMinutes() + timeDiff.minutes)

            const { error } = await supabase
              .from('reserves')
              .update({
                title: formData.title,
                description: formData.description,
                start_time: formatDateTime(newReserveStart.toISOString()),
                end_time: formatDateTime(newReserveEnd.toISOString())
              })
              .eq('id', reserve.id)
              .eq('user_id', user.id)

            if (error) throw error

            // グループ関係を更新
            await supabase
              .from('reserve_group_relations')
              .delete()
              .eq('reserve_id', reserve.id)

            if (formData.selectedGroups.length > 0) {
              const groupRelations = formData.selectedGroups.map(groupId => ({
                reserve_id: reserve.id,
                group_id: groupId
              }))

              const { error: relationError } = await supabase
                .from('reserve_group_relations')
                .insert(groupRelations)

              if (relationError) throw relationError
            }
          }

          setMessage('全ての予約を更新しました')
        }
      } else {
        // 新規予約を作成
        const createReserve = async (startTime: string, endTime: string) => {
          const { data: newReserve, error } = await supabase
            .from('reserves')
            .insert({
              user_id: user.id,
              title: formData.title,
              start_time: formatDateTime(startTime),
              end_time: formatDateTime(endTime),
              description: formData.description
            })
            .select()
            .single()

          if (error) throw error

          // グループ関係を追加
          if (formData.selectedGroups.length > 0) {
            const groupRelations = formData.selectedGroups.map(groupId => ({
              reserve_id: newReserve.id,
              group_id: groupId
            }))

            const { error: relationError } = await supabase
              .from('reserve_group_relations')
              .insert(groupRelations)

            if (relationError) throw relationError
          }

          return newReserve
        }

        if (formData.isRecurring) {
          // 繰り返し予約を作成
          const startDate = new Date(formData.start_time)
          const endDate = new Date(formData.end_time)
          const duration = endDate.getTime() - startDate.getTime()

          // 予約グループを作成
          const { data: reserveGroup, error: reserveGroupError } = await supabase
            .from('reserve_groups')
            .insert({})
            .select()
            .single()

          if (reserveGroupError) throw reserveGroupError

          for (let i = 0; i < formData.recurringWeeks; i++) {
            const weekStartDate = new Date(startDate)
            weekStartDate.setDate(startDate.getDate() + (i * 7))
            const weekEndDate = new Date(weekStartDate.getTime() + duration)

            // 日本時間で時間を設定
            const formatToJST = (date: Date) => {
              const year = date.getFullYear()
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const day = String(date.getDate()).padStart(2, '0')
              const hours = String(date.getHours()).padStart(2, '0')
              const minutes = String(date.getMinutes()).padStart(2, '0')
              return `${year}-${month}-${day}T${hours}:${minutes}`
            }

            const weekStartTime = formatToJST(weekStartDate)
            const weekEndTime = formatToJST(weekEndDate)

            const newReserve = await createReserve(weekStartTime, weekEndTime)

            // 予約と予約グループの関連付けを作成
            const { error: relationError } = await supabase
              .from('reserve_relations')
              .insert({
                reserve_id: newReserve.id,
                reserve_group_id: reserveGroup.id
              })

            if (relationError) throw relationError
          }

          setMessage(`${formData.recurringWeeks}週間分の予約を作成しました`)
        } else {
          // 通常の予約を作成
          await createReserve(formData.start_time, formData.end_time)
          setMessage('予約を作成しました')
        }
      }

      fetchReserves()
      handleCloseForm()
    } catch (error) {
      console.error('Error saving reserve:', error)
      setError('予約の保存に失敗しました')
    }
    setTimeout(() => setMessage(''), 2000)
  }

  const toggleGroup = (groupId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedGroups: prev.selectedGroups.includes(groupId)
        ? prev.selectedGroups.filter(id => id !== groupId)
        : [...prev.selectedGroups, groupId]
    }))
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

  // 15分刻みの時間オプションを生成する関数（9:00〜18:00）
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 9; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        // 18:00以降は除外
        if (hour === 18 && minute > 0) continue;
        const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        options.push(timeString);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  // 週の日付を生成する関数（月曜から金曜まで）
  const generateWeekDates = () => {
    const dates = []
    const startDate = new Date(currentWeekStart)
    // 月曜日から金曜日まで（5日分）
    for (let i = 0; i < 5; i++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  // 時間帯を生成する関数（表示用）
  const generateDisplayTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
    }
    return slots
  }

  // 時間帯を生成する関数（内部管理用）
  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 9; hour <= 18; hour++) {
      slots.push(`${String(hour).padStart(2, '0')}:00`)
      slots.push(`${String(hour).padStart(2, '0')}:15`)
      slots.push(`${String(hour).padStart(2, '0')}:30`)
      slots.push(`${String(hour).padStart(2, '0')}:45`)
    }
    return slots
  }

  // 予約を時間帯ごとに整理する関数
  const organizeReservesByTimeSlot = (date: Date) => {
    const timeSlots = generateTimeSlots()
    const organizedReserves: { [key: string]: ReserveWithProfile[] } = {}
    
    timeSlots.forEach(slot => {
      organizedReserves[slot] = reserves.filter(reserve => {
        if (!reserve.start_time) return false
        const reserveDate = new Date(reserve.start_time)
        const reserveTime = reserveDate.toTimeString().slice(0, 5)
        return reserveDate.toDateString() === date.toDateString() && reserveTime === slot
      })
    })
    
    return organizedReserves
  }

  // 予約の表示位置を計算する関数
  const calculateReservePosition = (startTime: string | null) => {
    if (!startTime) return '0'
    const minutes = new Date(startTime).getMinutes()
    return minutes === 0 ? '0' : '1em'
  }

  // 予約の高さを計算する関数
  const calculateReserveHeight = (startTime: string | null, endTime: string | null) => {
    if (!startTime || !endTime) return 'auto'
    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMinutes = (end.getTime() - start.getTime()) / (1000 * 60)
    return `${Math.max(1, Math.ceil(diffMinutes / 15))}em`
  }

  // 週を移動する関数
  const moveWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeekStart)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeekStart(newDate)
  }

  // 今日の週の月曜日を取得する関数
  const getCurrentWeekMonday = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(now.setDate(diff))
  }

  // 今日の週に移動する関数
  const moveToCurrentWeek = () => {
    setCurrentWeekStart(getCurrentWeekMonday())
  }

  // 今日の日付かどうかを判定する関数
  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  }

  // 月の日付を生成する関数
  const generateMonthDates = () => {
    const dates = []
    const year = currentMonthStart.getFullYear()
    const month = currentMonthStart.getMonth()
    
    // 月の最初の日を取得
    const firstDay = new Date(year, month, 1)
    // 月の最後の日を取得
    const lastDay = new Date(year, month + 1, 0)
    
    // 月の最初の日の曜日を取得（0: 日曜日, 1: 月曜日, ...）
    const firstDayOfWeek = firstDay.getDay()
    
    // 前月の日付を追加（月曜日まで）
    const daysToAdd = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1
    for (let i = daysToAdd; i > 0; i--) {
      const date = new Date(year, month, 1 - i)
      dates.push(date)
    }
    
    // 当月の日付を追加
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const date = new Date(year, month, i)
      dates.push(date)
    }
    
    // 次月の日付を追加（日曜日まで）
    const lastDayOfWeek = lastDay.getDay()
    const daysToAddNext = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek
    for (let i = 1; i <= daysToAddNext; i++) {
      const date = new Date(year, month + 1, i)
      dates.push(date)
    }
    
    return dates
  }

  // 月を移動する関数
  const moveMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentMonthStart)
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    setCurrentMonthStart(newDate)
  }

  // 今日の月の1日を取得する関数
  const getCurrentMonthFirstDay = () => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // 今日の月に移動する関数
  const moveToCurrentMonth = () => {
    setCurrentMonthStart(getCurrentMonthFirstDay())
  }

  // 予約を日付ごとに整理する関数
  const organizeReservesByDate = (date: Date) => {
    return reserves.filter(reserve => {
      if (!reserve.start_time) return false
      const reserveDate = new Date(reserve.start_time)
      return reserveDate.toDateString() === date.toDateString()
    })
  }

  // 予約詳細を表示する関数
  const handleShowDetail = (reserve: ReserveWithProfile) => {
    // 同じグループに属する予約を取得
    const relatedReserves = reserve.reserve_group
      ? reserves.filter(r => r.reserve_group?.id === reserve.reserve_group?.id)
      : [reserve]

    setSelectedReserve({
      ...reserve,
      relatedReserves
    })
    setIsDetailOpen(true)
  }

  // 予約詳細を閉じる関数
  const handleCloseDetail = () => {
    setSelectedReserve(null)
    setIsDetailOpen(false)
  }

  // 削除モードを選択
  const handleDeleteModeSelect = (mode: 'single' | 'all') => {
    setIsDeleting(false)
    setDeleteMode(mode)
    setIsConfirming('delete')
  }

  // 予約を削除
  const handleDelete = async (reserveId: number, mode: 'single' | 'all' = 'single') => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const reserve = reserves.find(r => r.id === reserveId)
      if (!reserve) return

      if (mode === 'single') {
        // 単一予約の削除
        // まず予約グループとの関連を削除
        if (reserve.reserve_group) {
          await supabase
            .from('reserve_relations')
            .delete()
            .eq('reserve_id', reserveId)
        }

        // グループとの関連を削除
        await supabase
          .from('reserve_group_relations')
          .delete()
          .eq('reserve_id', reserveId)

        // 予約を削除
        const { error } = await supabase
          .from('reserves')
          .delete()
          .eq('id', reserveId)
          .eq('user_id', user.id)

        if (error) throw error

        setMessage('予約を削除しました')
      } else {
        // 全ての関連予約を削除
        const relatedReserves = reserve.reserve_group
          ? reserves.filter(r => r.reserve_group?.id === reserve.reserve_group?.id)
          : [reserve]

        // まず全ての予約のグループとの関連を削除
        for (const relatedReserve of relatedReserves) {
          await supabase
            .from('reserve_group_relations')
            .delete()
            .eq('reserve_id', relatedReserve.id)
        }

        // 予約グループとの関連を削除
        if (reserve.reserve_group) {
          await supabase
            .from('reserve_relations')
            .delete()
            .eq('reserve_group_id', reserve.reserve_group.id)
        }

        // 全ての予約を削除
        for (const relatedReserve of relatedReserves) {
          const { error } = await supabase
            .from('reserves')
            .delete()
            .eq('id', relatedReserve.id)
            .eq('user_id', user.id)

          if (error) throw error
        }

        // 最後に予約グループを削除
        if (reserve.reserve_group) {
          await supabase
            .from('reserve_groups')
            .delete()
            .eq('id', reserve.reserve_group.id)
        }

        setMessage('全ての予約を削除しました')
      }

      fetchReserves()
      setIsDeleting(false)
      setDeletingReserveId(null)
    } catch (error) {
      console.error('Error deleting reserve:', error)
      setError('予約の削除に失敗しました')
    }
    setTimeout(() => setMessage(''), 2000)
  }

  // 削除確認ダイアログを表示
  const showDeleteConfirm = (reserve: ReserveWithProfile) => {
    setDeletingReserveId(reserve.id)
    if (reserve.reserve_group) {
      const relatedReserves = reserves.filter(r => r.reserve_group?.id === reserve.reserve_group?.id)
      if (relatedReserves.length > 1) {
        setIsDeleting('select')
        return
      }
    }
    setDeleteMode('single')
    setIsConfirming('delete')
  }

  // 削除を実行
  const executeDelete = async () => {
    if (!deletingReserveId) return
    await handleDelete(deletingReserveId, deleteMode || 'single')
    setIsConfirming(false)
    setDeleteMode(null)
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">読み込み中...</div>
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">予約一覧</h1>
        <div className="flex items-center space-x-4">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('timetable')}
              className={`px-4 py-2 rounded-md ${
                viewMode === 'timetable'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              週
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-4 py-2 rounded-md ${
                viewMode === 'monthly'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              月
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              リスト
            </button>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            予約を作成
          </button>
        </div>
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-indigo-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-out z-50">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {viewMode === 'monthly' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex justify-between items-center p-2 border-b">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => moveMonth('prev')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                ← 前月
              </button>
              <button
                onClick={moveToCurrentMonth}
                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800"
              >
                今日
              </button>
            </div>
            <h2 className="text-lg font-semibold">
              {currentMonthStart.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' })}
            </h2>
            <button
              onClick={() => moveMonth('next')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              次月 →
            </button>
          </div>
          <div className="grid grid-cols-[repeat(5,1fr)_0.5fr_0.5fr] gap-px bg-gray-200 dark:bg-gray-700">
            {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
              <div 
                key={day} 
                className={`bg-gray-50 dark:bg-gray-800 p-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300 ${
                  index >= 5 ? 'text-xs' : ''
                }`}
              >
                {day}
              </div>
            ))}
            {generateMonthDates().map((date) => {
              const dayReserves = organizeReservesByDate(date)
              const isCurrentMonth = date.getMonth() === currentMonthStart.getMonth()
              const dayOfWeek = date.getDay()
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              return isWeekend ? (
                <div
                  key={date.toISOString()}
                  className={`block min-h-[100px] p-2 ${
                    isCurrentMonth
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : 'bg-gray-50/50 dark:bg-gray-900'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    isToday(date)
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isCurrentMonth
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayReserves.map((reserve) => (
                      <div
                        key={reserve.id}
                        className={`p-1 text-xs bg-indigo-100 dark:bg-indigo-900 rounded truncate cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800${reserve.reserve_group ? ' border-l-4 border-blue-700 dark:border-blue-400' : ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleShowDetail(reserve)
                        }}
                        style={{ position: 'relative' }}
                      >
                        {reserve.user_id === currentUserId && (
                          <span style={{ position: 'absolute', top: 2, right: 2 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-gray-500">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                          </span>
                        )}
                        {formatTime(reserve.start_time)} - {formatTime(reserve.end_time)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <a
                  href="#"
                  key={date.toISOString()}
                  className={`block min-h-[100px] p-2 ${
                    isCurrentMonth
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-gray-50 dark:bg-gray-900'
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    handleDateCellClick(date)
                  }}
                >
                  <div className={`text-sm font-medium ${
                    isToday(date)
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isCurrentMonth
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayReserves.map((reserve) => (
                      <div
                        key={reserve.id}
                        className={`p-1 text-xs bg-indigo-100 dark:bg-indigo-900 rounded truncate cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800${reserve.reserve_group ? ' border-l-4 border-blue-700 dark:border-blue-400' : ''}`}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleShowDetail(reserve)
                        }}
                        style={{ position: 'relative' }}
                      >
                        {reserve.user_id === currentUserId && (
                          <span style={{ position: 'absolute', top: 2, right: 2 }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-gray-400 dark:text-gray-500">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                          </span>
                        )}
                        {formatTime(reserve.start_time)} - {formatTime(reserve.end_time)}
                      </div>
                    ))}
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      ) : viewMode === 'timetable' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="flex justify-between items-center p-2 border-b">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => moveWeek('prev')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                ← 前週
              </button>
              <button
                onClick={moveToCurrentWeek}
                className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800"
              >
                今日
              </button>
            </div>
            <h2 className="text-lg font-semibold">
              {currentWeekStart.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} 〜
              {new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
            <button
              onClick={() => moveWeek('next')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              次週 →
            </button>
          </div>
          <div className="grid grid-cols-[0.5fr_repeat(5,1fr)] gap-px bg-gray-200 dark:bg-gray-700">
            <div className="flex flex-col">
              <div className="h-12 grid items-center text-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                <div className="text-sm font-medium">時間</div>
              </div>
              <div className="h-[800px] bg-white dark:bg-gray-800">
                <div className="h-full grid grid-rows-[repeat(36,1fr)] border border-gray-200 dark:border-gray-700">
                  {Array.from({ length: 36 }, (_, i) => {
                    const hour = Math.floor(i / 4) + 9;
                    const minute = (i % 4) * 15;
                    const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                    return (
                      <div
                        key={timeString}
                        data-time={timeString}
                        className={`text-xs text-right font-bold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 ${
                          i % 4 === 0 ? 'border-t-2' : ''
                        }`}
                      >
                        {minute === 0 ? `${hour}:00` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {generateWeekDates().map((date) => (
              <div key={date.toISOString()} className="flex flex-col">
                <div className={`text-center h-12 grid items-center ${
                  isToday(date)
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  <div className="text-sm font-medium">
                    {['月', '火', '水', '木', '金'][date.getDay() - 1]}
                  </div>
                  <div className={`text-base font-semibold ${
                    isToday(date)
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                  </div>
                </div>
                <div className="h-[800px] bg-white dark:bg-gray-800">
                  <div className="h-full grid grid-rows-[repeat(36,1fr)] border border-gray-200 dark:border-gray-700 relative">
                    {Array.from({ length: 36 }, (_, i) => {
                      const hour = Math.floor(i / 4) + 9;
                      const minute = (i % 4) * 15;
                      const timeString = `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                      return (
                        <a
                          key={timeString}
                          href="#"
                          data-time={timeString}
                          className={`text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 ${
                            i % 4 === 0 ? 'border-t-2' : ''
                          } hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer`}
                          onClick={(e) => {
                            e.preventDefault();
                            const [datePart] = date.toISOString().split('T');
                            const hour = Math.floor(i / 4) + 9;
                            const minute = (i % 4) * 15;
                            const startTime = `${datePart}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                            const endTime = getOneHourLater(startTime);
                            setFormData(prev => ({
                              ...prev,
                              start_time: startTime,
                              end_time: endTime
                            }));
                            setIsFormOpen(true);
                          }}
                        />
                      );
                    })}
                    {reserves
                      .filter(reserve => {
                        if (!reserve.start_time) return false;
                        const reserveDate = new Date(reserve.start_time);
                        return (
                          reserveDate.getFullYear() === date.getFullYear() &&
                          reserveDate.getMonth() === date.getMonth() &&
                          reserveDate.getDate() === date.getDate()
                        );
                      })
                      .map(reserve => {
                        if (!reserve.start_time || !reserve.end_time) return null;
                        const startDate = new Date(reserve.start_time);
                        const endDate = new Date(reserve.end_time);
                        const startHour = startDate.getHours();
                        const startMinute = startDate.getMinutes();
                        const endHour = endDate.getHours();
                        const endMinute = endDate.getMinutes();
                        
                        const startTimeString = `${String(startHour).padStart(2, '0')}${String(startMinute).padStart(2, '0')}`;
                        const endTimeString = `${String(endHour).padStart(2, '0')}${String(endMinute).padStart(2, '0')}`;
                        
                        const startIndex = Array.from({ length: 36 }, (_, i) => {
                          const hour = Math.floor(i / 4) + 9;
                          const minute = (i % 4) * 15;
                          return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                        }).indexOf(startTimeString);
                        
                        const endIndex = Array.from({ length: 36 }, (_, i) => {
                          const hour = Math.floor(i / 4) + 9;
                          const minute = (i % 4) * 15;
                          return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
                        }).indexOf(endTimeString);
                        
                        if (startIndex === -1 || endIndex === -1) return null;
                        
                        const gridSpan = endIndex - startIndex;
                        const isShortReserve = gridSpan === 1;
                        
                        return (
                          <div
                            key={reserve.id}
                            className={`absolute left-0 right-0 p-1 mx-1 text-xs bg-indigo-100 dark:bg-indigo-900 rounded cursor-pointer hover:bg-indigo-200 dark:hover:bg-indigo-800${reserve.reserve_group ? ' border-l-4 border-blue-700 dark:border-blue-400' : ''}`}
                            style={{
                              top: `calc(${(startIndex / 36) * 100}% + 2px)`,
                              height: `calc(${(gridSpan / 36) * 100}% - 4px)`,
                            }}
                            onClick={() => handleShowDetail(reserve)}
                          >
                            {reserve.user_id === currentUserId && (
                              <div className="absolute top-1 right-1 w-3 h-3 text-gray-500 dark:text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                                </svg>
                              </div>
                            )}
                            <div className={`font-medium truncate ${isShortReserve ? '' : 'mb-1'}`}>
                              {reserve.title}
                            </div>
                            {!isShortReserve && (
                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                {formatTime(reserve.start_time)} - {formatTime(reserve.end_time)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">グループ</th>
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
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {reserve.groups && reserve.groups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {reserve.groups.map((group) => (
                          <span
                            key={group.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                          >
                            {group.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      '未設定'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {reserve.user_id === currentUserId && (
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            showDeleteConfirm(reserve);
                          }}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          削除
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleEdit(reserve);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          編集
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFormOpen && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseForm()
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">{isEditing === 'select' ? '編集モードを選択' : isEditing === 'single' ? '予約を編集' : '予約を作成'}</h2>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">日付</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.start_time.split('T')[0]}
                    onChange={(e) => {
                      const date = e.target.value;
                      const [_, time] = formData.start_time.split('T');
                      setFormData(prev => ({
                        ...prev,
                        start_time: `${date}T${time}`,
                        end_time: `${date}T${formData.end_time.split('T')[1]}`
                      }));
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">開始時間</label>
                  <select
                    name="start_time"
                    value={formData.start_time.split('T')[1]}
                    onChange={(e) => {
                      const time = e.target.value;
                      const [date] = formData.start_time.split('T');
                      setFormData(prev => ({
                        ...prev,
                        start_time: `${date}T${time}`
                      }));
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    required
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time} selected={time === formData.start_time.split('T')[1]}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">終了時間</label>
                  <select
                    name="end_time"
                    value={formData.end_time.split('T')[1]}
                    onChange={(e) => {
                      const time = e.target.value;
                      const [date] = formData.end_time.split('T');
                      setFormData(prev => ({
                        ...prev,
                        end_time: `${date}T${time}`
                      }));
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    required
                  >
                    {timeOptions.map((time) => (
                      <option key={time} value={time} selected={time === formData.end_time.split('T')[1]}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
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

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      isRecurring: e.target.checked
                    }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    毎週同じ時間に予約を繰り返す
                  </label>
                </div>

                {formData.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      何週間分作成するか
                    </label>
                    <select
                      value={formData.recurringWeeks}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        recurringWeeks: parseInt(e.target.value)
                      }))}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    >
                      {[1, 2, 3, 4, 8, 12].map((weeks) => (
                        <option key={weeks} value={weeks}>
                          {weeks}週間
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  関連グループ
                </label>
                <div className="border rounded-lg p-4 max-h-40 overflow-y-auto bg-white dark:bg-gray-700">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2 mb-2 last:mb-0">
                      <input
                        type="checkbox"
                        id={`group-${group.id}`}
                        checked={formData.selectedGroups.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`group-${group.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                        {group.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4">
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
                  {isEditing === 'select' ? '選択' : isEditing === 'single' ? '更新' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditing === 'select' && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsEditing(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">編集モードを選択</h2>
            <div className="space-y-4">
              <button
                onClick={() => handleEditModeSelect('single')}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                1件のみ編集
              </button>
              <button
                onClick={() => handleEditModeSelect('all')}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                全ての予約を編集
              </button>
            </div>
          </div>
        </div>
      )}

      {isDetailOpen && selectedReserve && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseDetail()
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">{selectedReserve.title || '無題'}</h2>
              <button
                onClick={handleCloseDetail}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">予約者</h3>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedReserve.profile?.name || '未設定'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">所属</h3>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedReserve.profile?.organization || '未設定'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">日時</h3>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {formatDisplayDate(selectedReserve.start_time)} {formatTimeRange(selectedReserve.start_time, selectedReserve.end_time)}
                </p>
              </div>
              {selectedReserve.relatedReserves && selectedReserve.relatedReserves.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">関連する予約</h3>
                  <div className="mt-1 space-y-2">
                    {selectedReserve.relatedReserves.map((relatedReserve) => (
                      <div key={relatedReserve.id} className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDisplayDate(relatedReserve.start_time)} {formatTimeRange(relatedReserve.start_time, relatedReserve.end_time)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">説明</h3>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {selectedReserve.description || '未設定'}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">グループ</h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedReserve.groups && selectedReserve.groups.length > 0 ? (
                    selectedReserve.groups.map((group) => (
                      <span
                        key={group.id}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
                      >
                        {group.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">未設定</span>
                  )}
                </div>
              </div>
            </div>
            {selectedReserve.user_id === currentUserId && (
              <div className="mt-6 flex justify-end space-x-4">
                <button
                  onClick={() => {
                    handleCloseDetail()
                    showDeleteConfirm(selectedReserve)
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  削除
                </button>
                <button
                  onClick={() => {
                    handleCloseDetail()
                    handleEdit(selectedReserve)
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  編集
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isConfirming === 'delete' && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsConfirming(false)
              setDeleteMode(null)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">予約を削除しますか？</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {deleteMode === 'all' 
                ? '関連する全ての予約が削除されます。この操作は取り消せません。'
                : 'この操作は取り消せません。本当に削除してもよろしいですか？'}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setIsConfirming(false)
                  setDeleteMode(null)
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                キャンセル
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleting === 'select' && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsDeleting(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">削除モードを選択</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              この予約は他の予約と関連付けられています。どのように削除しますか？
            </p>
            <div className="space-y-4">
              <button
                onClick={() => handleDeleteModeSelect('single')}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                1件のみ削除
              </button>
              <button
                onClick={() => handleDeleteModeSelect('all')}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                全ての予約を削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
