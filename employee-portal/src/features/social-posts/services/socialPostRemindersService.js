import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const parseTimeToMinutes = (time) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export const formatTimeLabel = (time) => {
  const total = parseTimeToMinutes(time)
  if (total == null) return time || '—'
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export const isPostedOn = (reminder, dateKey) => {
  const dates = Array.isArray(reminder?.postedDates) ? reminder.postedDates : []
  return dates.includes(dateKey)
}

export const isScheduledToday = (reminder, date = new Date()) => {
  const days = Array.isArray(reminder?.days) ? reminder.days.map(Number) : []
  return days.includes(date.getDay())
}

const itemsRef = (uid) => collection(db, 'socialPostReminders', uid, 'items')

export const subscribeMySocialPostReminders = (uid, callback, onError) => {
  if (!uid) return () => {}
  const q = query(itemsRef(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })))
    },
    (err) => {
      console.error('Failed to load post reminders', err)
      onError?.(err)
    }
  )
}

export const addSocialPostReminder = async (uid, data) => {
  if (!uid) throw new Error('User ID is required')
  return addDoc(itemsRef(uid), {
    title: String(data.title || '').trim(),
    company: String(data.company || '').trim(),
    days: Array.isArray(data.days) ? data.days.map(Number) : [],
    time: data.time,
    enabled: data.enabled !== false,
    postedDates: [],
    lastEarlyAt: '',
    lastDueAt: '',
    createdAt: serverTimestamp(),
  })
}

export const updateSocialPostReminder = async (uid, reminderId, updates) => {
  if (!uid || !reminderId) throw new Error('User ID and reminder ID are required')
  return updateDoc(doc(db, 'socialPostReminders', uid, 'items', reminderId), updates)
}

export const deleteSocialPostReminder = async (uid, reminderId) => {
  if (!uid || !reminderId) throw new Error('User ID and reminder ID are required')
  return deleteDoc(doc(db, 'socialPostReminders', uid, 'items', reminderId))
}

export const markSocialPostUploaded = async (uid, reminderId, dateKey = localDateKey()) => {
  return updateSocialPostReminder(uid, reminderId, {
    postedDates: arrayUnion(dateKey),
  })
}

export const unmarkSocialPostUploaded = async (uid, reminder, dateKey = localDateKey()) => {
  const dates = (Array.isArray(reminder?.postedDates) ? reminder.postedDates : []).filter((d) => d !== dateKey)
  return updateSocialPostReminder(uid, reminder.id, { postedDates: dates })
}
