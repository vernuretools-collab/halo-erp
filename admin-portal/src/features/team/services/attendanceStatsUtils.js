/**
 * Utility functions to compute real dynamic attendance averages and metrics
 * for individual employees and team-wide.
 */

/** Office start used for late detection (matches employee portal). */
export const OFFICE_START_HOUR = 10
export const OFFICE_START_MINUTE = 30
export const OFFICE_START_MINUTES = OFFICE_START_HOUR * 60 + OFFICE_START_MINUTE
export const LATE_GRACE_MINUTES = 10
export const LATE_CUTOFF_MINUTES = OFFICE_START_MINUTES + LATE_GRACE_MINUTES

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

/**
 * Late minutes past expected start (default 10:30 AM). Returns 0 if on time (grace cutoff) or missing clock-in.
 * @param {string|null} clockInTime
 * @param {number} [expectedStartMinutes]
 * @returns {number}
 */
export function getLateMinutes(clockInTime, expectedStartMinutes = OFFICE_START_MINUTES) {
  const mins = timeStrToMinutes(clockInTime)
  if (mins === null) return 0
  const start = Number.isFinite(Number(expectedStartMinutes))
    ? Number(expectedStartMinutes)
    : OFFICE_START_MINUTES
  const graceCutoff = start + LATE_GRACE_MINUTES
  if (mins < graceCutoff) return 0
  return mins - start
}

/**
 * @param {string|null} clockInTime
 * @param {number} [expectedStartMinutes]
 * @returns {{ isLate: boolean, lateMinutes: number }}
 */
export function getLateInfo(clockInTime, expectedStartMinutes = OFFICE_START_MINUTES) {
  const lateMinutes = getLateMinutes(clockInTime, expectedStartMinutes)
  return { isLate: lateMinutes > 0, lateMinutes }
}

/**
 * Whether an attendance log counts as present.
 * @param {object} log
 * @returns {boolean}
 */
export function isAttendancePresent(log) {
  if (!log) return false
  if (log.present === false) return false
  return (
    log.present === true ||
    log.onDuty === true ||
    log.source === 'on_duty' ||
    Boolean(log.clockedIn) ||
    (Boolean(log.clockInTime) && log.clockInTime !== '—') ||
    (Number(log.regularSeconds) || Number(log.accumulatedWorkSeconds) || 0) > 0
  )
}

/**
 * Logged-in seconds for a day (no 8h cap).
 * @param {object} log
 * @returns {number}
 */
export function getCappedRegularSeconds(log) {
  if (!log) return 0
  const sec = Number(log.regularSeconds) || Number(log.accumulatedWorkSeconds) || 0
  return Math.max(0, sec)
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

/** Prefer directory name over a stale attendance-log placeholder like "Employee". */
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
