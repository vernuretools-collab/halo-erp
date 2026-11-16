import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db, supabase } from '../../../shared/services/firebaseService'
import { mergeShiftLogs, pairedShiftLogs } from '../../../../../shared/shiftLogs.js'
import { preferAttendanceLog } from '../../../../../shared/employees/employmentStatus.js'
import {
  ATTENDANCE_OUTBOX_KEY,
  dropAttendanceSave,
  mergeAttendancePayload,
  rememberAttendanceSave,
} from '../../../../../shared/offlineQueue.js'

const IS_MOCK = import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev'

function asIdList(uidOrIds) {
  return [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]
}

function localDateKey(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateOnlyString(value) {
  if (!value) return ''
  if (typeof value === 'string') {
    const day = value.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && value.length === 10) return day
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return localDateKey(parsed)
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : ''
  }
  if (typeof value?.toDate === 'function') {
    try {
      return localDateKey(value.toDate())
    } catch {
      return ''
    }
  }
  if (typeof value?.seconds === 'number') return localDateKey(new Date(value.seconds * 1000))
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDateKey(value)
  return ''
}

function dateFromAttendanceRow(id, data = {}) {
  const fromId = String(id || '').split('_')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromId)) return fromId
  const stored = dateOnlyString(data.date) || dateOnlyString(data.dateKey)
  if (stored) return stored
  const ts = data.timestamp || data.clockInTime || data.createdAt
  return dateOnlyString(ts)
}

function rowUid(id, data = {}) {
  if (data.uid) return String(data.uid)
  if (data.employeeId) return String(data.employeeId)
  const parts = String(id || '').split('_')
  if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) return parts.slice(1).join('_')
  return ''
}

export const attendanceRecordLooksPresent = (record) => {
  if (!record) return false
  if (record.clockedIn || record.onDuty === true || record.present === true || record.source === 'on_duty') {
    return true
  }
  if (Number(record.regularSeconds) > 0) return true
  if (record.clockInTime || record.clockInTimestamp || record.clockIn || record.checkIn) return true
  if (Array.isArray(record.shiftLogs) && record.shiftLogs.length > 0) return true
  if (Array.isArray(record.todayShiftLogs) && record.todayShiftLogs.length > 0) return true
  const status = String(record.status || '').toLowerCase()
  return status === 'present' || status === 'wfh' || status === 'on duty' || status === 'on_duty'
}

function readAttendanceOutbox() {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(ATTENDANCE_OUTBOX_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAttendanceOutbox(queue) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(ATTENDANCE_OUTBOX_KEY, JSON.stringify(queue))
  } catch {
    /* private mode */
  }
}

const attendanceWriteChains = new Map()

function chainAttendanceWrite(key, task) {
  const prev = attendanceWriteChains.get(key) || Promise.resolve()
  const next = prev.then(task, task)
  attendanceWriteChains.set(key, next)
  return next
}

async function writeAttendanceLog(uid, date, payload) {
  const docId = `${date}_${uid}`
  const ref = doc(db, 'attendanceLogs', docId)
  const { replaceShiftLogs, ...fields } = payload || {}

  // Website and Electron both write this row. Union the events so one
  // window's stale list cannot erase the other's break or lunch.
  let shiftLogs = null
  if (fields.shiftLogs || fields.todayShiftLogs) {
    const incoming = fields.shiftLogs || fields.todayShiftLogs || []
    if (replaceShiftLogs) {
      shiftLogs = pairedShiftLogs(incoming)
    } else {
      const existingSnap = await getDoc(ref)
      const existing = existingSnap.exists() ? existingSnap.data() : {}
      shiftLogs = mergeShiftLogs(existing.shiftLogs || existing.todayShiftLogs, incoming)
    }
  }

  await setDoc(
    ref,
    {
      uid,
      date,
      docId,
      updatedAt: serverTimestamp(),
      ...fields,
      ...(Array.isArray(shiftLogs) ? { shiftLogs, todayShiftLogs: shiftLogs } : {}),
    },
    { merge: true }
  )
}

/**
 * Upserts today's attendance log for the given employee into Firestore.
 *
 * Uses a FLAT collection (no subcollections) to avoid collectionGroup index issues.
 * Path: attendanceLogs/{YYYY-MM-DD}_{uid}
 *
 * A failed save stays in this browser and is sent again by flushAttendanceQueue.
 *
 * @param {string} uid     - Firebase user uid
 * @param {object} payload - Fields to merge into the document
 */
export const upsertAttendanceLog = (uid, payload) => {
  if (IS_MOCK || !uid) return Promise.resolve()

  const date = payload?.date || localDateKey()
  const key = `${date}_${uid}`
  return chainAttendanceWrite(key, async () => {
    const queued = readAttendanceOutbox()[key]?.payload
    const toWrite = queued ? mergeAttendancePayload(queued, payload) : payload
    try {
      await writeAttendanceLog(uid, date, toWrite)
      writeAttendanceOutbox(dropAttendanceSave(readAttendanceOutbox(), uid, date))
    } catch (err) {
      writeAttendanceOutbox(rememberAttendanceSave(readAttendanceOutbox(), uid, date, toWrite))
      console.error('[attendanceService] upsertAttendanceLog error:', err)
    }
  })
}

/** Send attendance saves that failed while this browser was offline. */
export async function flushAttendanceQueue() {
  const items = Object.values(readAttendanceOutbox())
  for (const item of items) {
    if (!item?.uid) continue
    await upsertAttendanceLog(item.uid, { ...(item.payload || {}), date: item.date })
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushAttendanceQueue()
  })
}

/**
 * Fetches today's attendance log for the given employee from Firestore.
 *
 * @param {string} uid - Firebase user uid
 * @returns {Promise<object|null>} Attendance log data or null
 */
export const getTodayAttendanceLog = async (uidOrIds, options = {}) => {
  const ids = asIdList(uidOrIds)
  if (IS_MOCK || !ids.length) return null
  const docOnly = options?.docOnly === true

  try {
    const date = localDateKey()
    for (const uid of ids) {
      const snap = await getDoc(doc(db, 'attendanceLogs', `${date}_${uid}`))
      if (snap.exists()) return snap.data()
    }
    if (docOnly) return null
    const monthly = await getUserMonthlyAttendance(ids)
    return monthly[date] || null
  } catch (err) {
    console.error('[attendanceService] getTodayAttendanceLog error:', err)
    if (docOnly) throw err
    return null
  }
}

/**
 * Fetches all attendance logs for the given employee from Firestore.
 * Returns an object mapping date ("YYYY-MM-DD") -> record object.
 *
 * @param {string|string[]} uidOrIds
 * @returns {Promise<Record<string, object>>}
 */
export const getUserMonthlyAttendance = async (uidOrIds) => {
  const ids = asIdList(uidOrIds)
  if (IS_MOCK || !ids.length) return {}

  try {
    const recordMap = {}
    const absorb = (docSnap) => {
      const data = docSnap.data() || {}
      const date = dateFromAttendanceRow(docSnap.id, data)
      const uid = rowUid(docSnap.id, data)
      const suffix = /^\d{4}-\d{2}-\d{2}_/.test(String(docSnap.id || '')) ? String(docSnap.id).slice(11) : ''
      const belongs =
        (uid && ids.includes(uid)) ||
        (suffix && ids.includes(suffix)) ||
        ids.includes(String(data.employeeId || '')) ||
        ids.includes(String(data.userId || ''))
      if (!date || !belongs) return
      const row = { ...data, id: docSnap.id, date, uid: uid || suffix || data.uid }
      recordMap[date] = preferAttendanceLog(recordMap[date], row)
    }

    // user_id is indexed and set from data.uid || data.employeeId on write.
    // Filtering data->>uid scans every attendance row through RLS and hits
    // the 8s statement timeout.
    if (!supabase) return {}
    const pageSize = 1000
    const rows = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('attendance_logs')
        .select('id, user_id, data')
        .in('user_id', ids)
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
    rows.forEach((row) => {
      absorb({
        id: row.id,
        data: () => ({ ...(row.data || {}), uid: row.data?.uid || row.user_id || '' }),
      })
    })

    return recordMap
  } catch (err) {
    console.error('[attendanceService] getUserMonthlyAttendance error:', err)
    return {}
  }
}

/**
 * Reads attendanceLogs/{YYYY-MM-DD}_{uid} for each day of one month.
 * The calendar day is the document id, not a timestamp stored on the row.
 * A failed read is listed in failedDates so the UI does not paint that day absent.
 *
 * @returns {Promise<{ records: Record<string, object>, failedDates: string[] }>}
 */
export const getMonthAttendanceDocs = async (uidOrIds, year, monthIndex) => {
  const ids = asIdList(uidOrIds)
  if (IS_MOCK || !ids.length) return { records: {}, failedDates: [] }

  const records = {}
  const failedDates = []
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`

  if (!supabase) return { records, failedDates }
  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('id, user_id, data')
      .in('user_id', ids)
      .like('id', `${monthPrefix}%`)
    if (error) throw error
    ;(data || []).forEach((row) => {
      const data = row.data || {}
      const date = dateFromAttendanceRow(row.id, data)
      if (!date || !date.startsWith(monthPrefix)) return
      const uid = row.user_id || data.uid || ''
      records[date] = preferAttendanceLog(records[date], { ...data, id: row.id, date, uid })
    })
  } catch (err) {
    console.error('[attendanceService] month attendance doc error:', err)
    failedDates.push('*')
  }

  return { records, failedDates }
}


