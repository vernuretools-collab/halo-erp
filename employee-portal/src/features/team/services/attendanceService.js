import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

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

function dateFromAttendanceRow(id, data = {}) {
  if (data.date) return String(data.date).slice(0, 10)
  if (data.dateKey) return String(data.dateKey).slice(0, 10)
  const fromId = String(id || '').split('_')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromId)) return fromId
  const ts = data.timestamp || data.clockInTime || data.createdAt
  if (ts?.toDate) {
    try {
      return localDateKey(ts.toDate())
    } catch {
      return ''
    }
  }
  if (typeof ts === 'string' && ts.length >= 10) return ts.slice(0, 10)
  return ''
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

/**
 * Upserts today's attendance log for the given employee into Firestore.
 *
 * Uses a FLAT collection (no subcollections) to avoid collectionGroup index issues.
 * Path: attendanceLogs/{YYYY-MM-DD}_{uid}
 *
 * @param {string} uid     - Firebase user uid
 * @param {object} payload - Fields to merge into the document
 */
export const upsertAttendanceLog = async (uid, payload) => {
  if (IS_MOCK || !uid) return

  try {
    const date = payload?.date || localDateKey()
    // Flat doc ID: "2026-07-29_abc123uid"
    const docId = `${date}_${uid}`
    const ref = doc(db, 'attendanceLogs', docId)

    await setDoc(
      ref,
      {
        uid,
        date,
        docId,
        updatedAt: serverTimestamp(),
        ...payload,
      },
      { merge: true }
    )
  } catch (err) {
    console.error('[attendanceService] upsertAttendanceLog error:', err)
  }
}

/**
 * Fetches today's attendance log for the given employee from Firestore.
 *
 * @param {string} uid - Firebase user uid
 * @returns {Promise<object|null>} Attendance log data or null
 */
export const getTodayAttendanceLog = async (uidOrIds) => {
  const ids = asIdList(uidOrIds)
  if (IS_MOCK || !ids.length) return null

  try {
    const date = localDateKey()
    for (const uid of ids) {
      const snap = await getDoc(doc(db, 'attendanceLogs', `${date}_${uid}`))
      if (snap.exists()) return snap.data()
    }
    const monthly = await getUserMonthlyAttendance(ids)
    return monthly[date] || null
  } catch (err) {
    console.error('[attendanceService] getTodayAttendanceLog error:', err)
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
      if (!date) return
      if (uid && !ids.includes(uid)) return
      recordMap[date] = { ...data, date, uid: uid || data.uid }
    }

    const logsRef = collection(db, 'attendanceLogs')
    const logQuery =
      ids.length === 1
        ? query(logsRef, where('uid', '==', ids[0]))
        : query(logsRef, where('uid', 'in', ids))
    const logSnap = await getDocs(logQuery)
    logSnap.docs.forEach(absorb)

    if (Object.keys(recordMap).length === 0) {
      const allLogs = await getDocs(logsRef)
      allLogs.docs.forEach((docSnap) => {
        const data = docSnap.data() || {}
        const date = dateFromAttendanceRow(docSnap.id, data)
        const uid = rowUid(docSnap.id, data)
        if (!date) return
        if (uid && ids.includes(uid)) {
          recordMap[date] = { ...data, date, uid }
          return
        }
        if (!uid && /^\d{4}-\d{2}-\d{2}_/.test(docSnap.id)) {
          const suffix = docSnap.id.slice(11)
          if (ids.includes(suffix)) recordMap[date] = { ...data, date, uid: suffix }
        }
      })
    }

    const attendanceSnap = await getDocs(collection(db, 'attendance'))
    attendanceSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const uid = String(data.uid || data.employeeId || data.userId || '')
      if (uid && !ids.includes(uid)) return
      if (!uid) return
      const date = dateFromAttendanceRow(docSnap.id, data)
      if (!date || recordMap[date]) return
      recordMap[date] = { ...data, date, uid }
    })

    return recordMap
  } catch (err) {
    console.error('[attendanceService] getUserMonthlyAttendance error:', err)
    return {}
  }
}


