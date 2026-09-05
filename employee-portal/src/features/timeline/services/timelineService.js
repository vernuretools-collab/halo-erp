import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const IS_MOCK = import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev'

/** In-memory store used when Firebase is mocked */
let mockEntries = []

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
  const day = d.getDay() // 0 Sun … 6 Sat
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
const asIdList = (uidOrIds) =>
  [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]

export const fetchTimelineEntries = async (uidOrIds, startDate, endDate) => {
  const ids = asIdList(uidOrIds)
  if (!ids.length) return []

  if (IS_MOCK) {
    return mockEntries
      .filter((e) => ids.includes(String(e.uid)) && e.date >= startDate && e.date <= endDate)
      .map((e) => ({
        ...e,
        entryType: e.entryType === 'upskilling' ? 'upskilling' : 'work',
      }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      })
  }

  try {
    const q =
      ids.length === 1
        ? query(collection(db, 'workTimelineEntries'), where('uid', '==', ids[0]))
        : query(collection(db, 'workTimelineEntries'), where('uid', 'in', ids))
    const snap = await getDocs(q)
    const entries = snap.docs.map((d) => {
      const data = d.data()
      return {
        entryId: d.id,
        ...data,
        entryType: data.entryType === 'upskilling' ? 'upskilling' : 'work',
      }
    })
    return entries
      .filter((e) => e.date >= startDate && e.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      })
  } catch (err) {
    console.error('[timelineService] fetchTimelineEntries error:', err)
    return []
  }
}

const normalizeEntryType = (entryType) =>
  entryType === 'upskilling' ? 'upskilling' : 'work'

/**
 * Create a new timeline entry.
 *
 * @param {{ uid: string, employeeName?: string, date: string, description: string, hours: number, entryType?: 'work'|'upskilling' }} payload
 * @returns {Promise<object|null>}
 */
export const createTimelineEntry = async (payload) => {
  if (!payload?.uid || !payload?.date) return null

  const entryType = normalizeEntryType(payload.entryType)

  if (IS_MOCK) {
    const created = {
      entryId: `mock_${Date.now()}`,
      uid: payload.uid,
      employeeName: payload.employeeName || '',
      date: payload.date,
      description: payload.description || '',
      hours: Number(payload.hours) || 0,
      entryType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockEntries = [...mockEntries, created]
    return created
  }

  try {
    const docRef = await addDoc(collection(db, 'workTimelineEntries'), {
      uid: payload.uid,
      employeeName: payload.employeeName || '',
      date: payload.date,
      description: payload.description || '',
      hours: Number(payload.hours) || 0,
      entryType,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return {
      entryId: docRef.id,
      uid: payload.uid,
      employeeName: payload.employeeName || '',
      date: payload.date,
      description: payload.description || '',
      hours: Number(payload.hours) || 0,
      entryType,
    }
  } catch (err) {
    console.error('[timelineService] createTimelineEntry error:', err)
    return null
  }
}

/**
 * Update an existing timeline entry.
 *
 * @param {string} entryId
 * @param {{ description?: string, hours?: number, date?: string, entryType?: 'work'|'upskilling' }} updates
 * @returns {Promise<boolean>}
 */
export const updateTimelineEntry = async (entryId, updates) => {
  if (!entryId) return false

  if (IS_MOCK) {
    mockEntries = mockEntries.map((e) =>
      e.entryId === entryId
        ? {
            ...e,
            ...updates,
            hours: updates.hours !== undefined ? Number(updates.hours) || 0 : e.hours,
            entryType:
              updates.entryType !== undefined
                ? normalizeEntryType(updates.entryType)
                : e.entryType || 'work',
            updatedAt: new Date().toISOString(),
          }
        : e
    )
    return true
  }

  try {
    const payload = { updatedAt: serverTimestamp() }
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.hours !== undefined) payload.hours = Number(updates.hours) || 0
    if (updates.date !== undefined) payload.date = updates.date
    if (updates.entryType !== undefined) payload.entryType = normalizeEntryType(updates.entryType)
    await updateDoc(doc(db, 'workTimelineEntries', entryId), payload)
    return true
  } catch (err) {
    console.error('[timelineService] updateTimelineEntry error:', err)
    return false
  }
}

/**
 * Delete a timeline entry.
 *
 * @param {string} entryId
 * @returns {Promise<boolean>}
 */
export const deleteTimelineEntry = async (entryId) => {
  if (!entryId) return false

  if (IS_MOCK) {
    mockEntries = mockEntries.filter((e) => e.entryId !== entryId)
    return true
  }

  try {
    await deleteDoc(doc(db, 'workTimelineEntries', entryId))
    return true
  } catch (err) {
    console.error('[timelineService] deleteTimelineEntry error:', err)
    return false
  }
}
