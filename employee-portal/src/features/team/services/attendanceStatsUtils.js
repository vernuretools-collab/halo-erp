/**
 * Utility functions to compute real dynamic attendance averages and metrics
 * for individual employees and team-wide.
 */

export function timeStrToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null
  // Windows / locale strings can look like "10 :33 AM" or "10.33 AM"
  const normalized = timeStr.replace(/\u202f|\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  const match = normalized.match(/(\d{1,2})\s*[:.]\s*(\d{1,2})(?:\s*[:.]\s*\d{1,2})?\s*(AM|PM)?/i)
  if (!match) return null
  let hrs = parseInt(match[1], 10)
  const mins = parseInt(match[2], 10)
  const ampm = match[3] ? match[3].toUpperCase() : null

  if (ampm === 'PM' && hrs < 12) hrs += 12
  if (ampm === 'AM' && hrs === 12) hrs = 0
  return hrs * 60 + mins
}

export function minutesToTimeStr(totalMinutes) {
  if (totalMinutes === null || totalMinutes === undefined || isNaN(totalMinutes)) return null
  let hrs = Math.floor(totalMinutes / 60) % 24
  const mins = Math.round(totalMinutes % 60)
  const ampm = hrs >= 12 ? 'PM' : 'AM'
  hrs = hrs % 12
  if (hrs === 0) hrs = 12
  const hrsStr = hrs.toString().padStart(2, '0')
  const minsStr = mins.toString().padStart(2, '0')
  return `${hrsStr}:${minsStr} ${ampm}`
}

/** Normalize stored clock strings (12h or 24h) to "hh:mm AM/PM". */
export function formatTo12HourTime(timeStr) {
  if (!timeStr || timeStr === '—' || timeStr === 'In office') return timeStr
  const mins = timeStrToMinutes(timeStr)
  if (mins === null) return timeStr
  return minutesToTimeStr(mins)
}

export function formatSecondsToHrsMins(totalSec) {
  if (!totalSec || totalSec <= 0) return '0h 0m'
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  return `${hrs}h ${mins}m`
}

/** Canonical "hh:mm AM/PM" from a Date — avoids locale strings like "10 :33 AM". */
export function canonicalTimeFromDate(date = new Date()) {
  return minutesToTimeStr(date.getHours() * 60 + date.getMinutes())
}

export function toEpochMs(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  const n = new Date(value).getTime()
  return Number.isNaN(n) ? null : n
}

export function timestampFromClockInTime(clockInTime, date = new Date()) {
  const mins = timeStrToMinutes(clockInTime)
  if (mins === null) return null
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
  return d.getTime() + mins * 60 * 1000
}

/**
 * Live worked seconds from the displayed clock-in time (same source as admin),
 * not leftover stored totals + current session.
 */
export function computeLiveWorkedSeconds({
  clockInTime,
  clockOutTime,
  clockedIn,
  clockInTimestamp,
  accumulatedBreakSeconds = 0,
  accumulatedWorkSeconds = 0,
  isOnBreak = false,
  breakStartTime = null,
} = {}) {
  const now = Date.now()
  let breakSec = Number(accumulatedBreakSeconds) || 0
  const breakStartMs = toEpochMs(breakStartTime)
  if (isOnBreak && breakStartMs) {
    breakSec += Math.max(0, Math.floor((now - breakStartMs) / 1000))
  }

  const stillIn = Boolean(clockedIn) || !clockOutTime || clockOutTime === 'In office'
  const inMins = timeStrToMinutes(clockInTime)
  const startMs =
    inMins !== null ? timestampFromClockInTime(clockInTime) : toEpochMs(clockInTimestamp)

  if (startMs != null) {
    let endMs = now
    if (!stillIn) {
      const outMins = timeStrToMinutes(clockOutTime)
      endMs = outMins !== null ? timestampFromClockInTime(clockOutTime) : now
    }
    return Math.max(0, Math.floor((endMs - startMs) / 1000) - breakSec)
  }

  return Math.max(0, Number(accumulatedWorkSeconds) || 0)
}

/**
 * Computes REAL attendance averages for an employee based on their attendance log records.
 *
 * @param {Array<object>} logs - List of attendance logs from Firestore/store
 * @param {object} [currentLiveState] - Current today live session
 * @returns {object} { avgHours, avgCheckIn, avgArrival, avgCheckOut, totalDays, presentDays }
 */
export function computeRealAttendanceStats(logs = [], currentLiveState = null) {
  const dateMap = {}

  if (Array.isArray(logs)) {
    logs.forEach((log) => {
      if (log && log.date) {
        dateMap[log.date] = log
      }
    })
  } else if (logs && typeof logs === 'object') {
    Object.values(logs).forEach((log) => {
      if (log && log.date) {
        dateMap[log.date] = log
      }
    })
  }

  // Include current live state if available
  if (currentLiveState && currentLiveState.date) {
    const d = currentLiveState.date
    dateMap[d] = {
      ...(dateMap[d] || {}),
      ...currentLiveState,
    }
  }

  const records = Object.values(dateMap)

  if (records.length === 0) {
    const liveClockIn = currentLiveState?.clockInTime || null
    const liveClockOut = currentLiveState?.clockOutTime || null
    const liveWorkedSec = currentLiveState?.accumulatedWorkSeconds || 0

    return {
      totalDays: liveWorkedSec > 0 || liveClockIn ? 1 : 0,
      presentDays: liveWorkedSec > 0 || liveClockIn ? 1 : 0,
      absentDays: 0,
      attendancePercentage: 100,
      avgHours: formatSecondsToHrsMins(liveWorkedSec),
      avgCheckIn: liveClockIn || '—',
      avgArrival: liveClockIn || '—',
      avgCheckOut: liveClockOut || '—',
    }
  }

  // 1. Avg Hours / Day
  let totalWorkedSeconds = 0
  let workedDaysCount = 0
  records.forEach((r) => {
    const sec = Number(r.regularSeconds) || Number(r.accumulatedWorkSeconds) || 0
    if (sec > 0) {
      totalWorkedSeconds += sec
      workedDaysCount++
    }
  })

  const avgWorkedSec = workedDaysCount > 0 ? Math.round(totalWorkedSeconds / workedDaysCount) : 0
  const avgHours = formatSecondsToHrsMins(avgWorkedSec)

  // 2. Avg Check-In & Arrival
  const checkInMinsList = []
  records.forEach((r) => {
    const mins = timeStrToMinutes(r.clockInTime)
    if (mins !== null) checkInMinsList.push(mins)
  })

  const avgCheckInMins = checkInMinsList.length > 0
    ? checkInMinsList.reduce((a, b) => a + b, 0) / checkInMinsList.length
    : null
  const avgCheckIn = minutesToTimeStr(avgCheckInMins) || currentLiveState?.clockInTime || '—'

  // Earliest or average arrival time
  const minCheckInMins = checkInMinsList.length > 0 ? Math.min(...checkInMinsList) : null
  const avgArrival = minutesToTimeStr(minCheckInMins) || avgCheckIn

  // 3. Avg Check-Out
  const checkOutMinsList = []
  records.forEach((r) => {
    const mins = timeStrToMinutes(r.clockOutTime)
    if (mins !== null) checkOutMinsList.push(mins)
  })

  const avgCheckOutMins = checkOutMinsList.length > 0
    ? checkOutMinsList.reduce((a, b) => a + b, 0) / checkOutMinsList.length
    : null
  const avgCheckOut = minutesToTimeStr(avgCheckOutMins) || currentLiveState?.clockOutTime || '—'

  const presentDays = records.filter(
    (r) =>
      r.clockInTime ||
      (r.regularSeconds && r.regularSeconds > 0) ||
      r.onDuty === true ||
      r.present === true ||
      r.source === 'on_duty'
  ).length

  return {
    totalDays: records.length,
    presentDays,
    absentDays: 0,
    attendancePercentage: 100,
    avgHours,
    avgCheckIn,
    avgArrival,
    avgCheckOut,
  }
}

const NAME_PLACEHOLDERS = new Set(['employee', 'employee staff', 'team staff', 'unknown', 'user'])

export function isPlaceholderDisplayName(value) {
  if (typeof value !== 'string') return true
  const trimmed = value.trim()
  if (!trimmed || trimmed === '—' || trimmed === '-') return true
  return NAME_PLACEHOLDERS.has(trimmed.toLowerCase())
}

export function resolveEmployeeDisplayName(emp = {}, log = {}, fallback = '—') {
  const employee = emp && typeof emp === 'object' ? emp : {}
  const attendanceLog = log && typeof log === 'object' ? log : {}
  const emailLocal = String(employee.email || attendanceLog.email || '').split('@')[0]
  const candidates = [
    employee.displayName,
    employee.name,
    employee.fullName,
    attendanceLog.displayName,
    attendanceLog.name,
    emailLocal,
  ]
  for (const candidate of candidates) {
    if (!isPlaceholderDisplayName(candidate)) return String(candidate).trim()
  }
  return fallback
}

export function getNameInitial(name, fallback = 'U') {
  const match = String(name || '').match(/[\p{L}\p{N}]/u)
  return match ? match[0].toUpperCase() : fallback
}
