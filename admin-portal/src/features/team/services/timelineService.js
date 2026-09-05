import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const IS_MOCK = import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev'

/**
 * Format a Date as YYYY-MM-DD (local).
 */
export function toDateStr(date) {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Return Mon–Sat Date objects for the week containing `anchorDate`.
 */
export function getWeekDates(anchorDate = new Date()) {
  const d = new Date(anchorDate)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)

  const days = []
  for (let i = 0; i < 6; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    days.push(date)
  }
  return days
}

/**
 * Fetch work timeline entries for a user within an inclusive date range.
 *
 * @param {string} uid
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 * @returns {Promise<object[]>}
 */
export const fetchEmployeeTimelineEntries = async (uid, startDate, endDate) => {
  if (!uid) return []

  if (IS_MOCK) return []

  try {
    const q = query(collection(db, 'workTimelineEntries'), where('uid', '==', uid))
    const snap = await getDocs(q)
    const entries = snap.docs.map((d) => ({ entryId: d.id, ...d.data() }))
    return entries
      .filter((e) => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      })
  } catch (err) {
    console.error('[timelineService] fetchEmployeeTimelineEntries error:', err)
    return []
  }
}
