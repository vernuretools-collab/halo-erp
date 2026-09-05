/** Slim month attendance summary aligned with admin monthly reports (Mon–Sat, holidays, WFH as present). */

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function normalizeMonth(month) {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month
  return currentMonthStr()
}

function getMonthDateBounds(month) {
  const m = normalizeMonth(month)
  const [y, mo] = m.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  return {
    month: m,
    start: `${m}-01`,
    end: `${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

function listDatesInMonth(month) {
  const { start, end } = getMonthDateBounds(month)
  const dates = []
  const cursor = new Date(`${start}T00:00:00`)
  const last = new Date(`${end}T00:00:00`)
  while (cursor <= last) {
    const y = cursor.getFullYear()
    const mo = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${mo}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function expandDateRange(startDate, endDate) {
  const dates = []
  if (!startDate) return dates
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${(endDate || startDate)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return dates
  const cursor = new Date(start)
  while (cursor <= end) {
    const y = cursor.getFullYear()
    const mo = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${mo}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function getWorkingDaysInMonth(month, holidays = []) {
  const holidaySet = new Set(
    (holidays || []).map((h) => h.date).filter((d) => d && d.startsWith(month))
  )
  return listDatesInMonth(month).filter((dateStr) => {
    if (holidaySet.has(dateStr)) return false
    return new Date(`${dateStr}T00:00:00`).getDay() !== 0
  })
}

function toAccountStartDateStr(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
  }
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`
  }
  if (typeof raw === 'object') {
    if (typeof raw.toDate === 'function') {
      try {
        return toAccountStartDateStr(raw.toDate())
      } catch {
        return null
      }
    }
    if (typeof raw.seconds === 'number') {
      return toAccountStartDateStr(new Date(raw.seconds * 1000))
    }
  }
  return null
}

function isAttendancePresent(log) {
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

function leaveTypeLabel(leave) {
  return String(leave?.leaveType || leave?.requestedLeaveType || '').trim()
}

function isPermissionLeave(leave) {
  return /permission/i.test(leaveTypeLabel(leave))
}

function isWfhLeave(leave) {
  return /work\s*from\s*home|^wfh$/i.test(leaveTypeLabel(leave))
}

function isOnDutyLeave(leave) {
  return /on\s*duty/i.test(leaveTypeLabel(leave))
}

function leaveMatchesEmployee(leave, employee) {
  if (!leave || !employee) return false
  const uid = employee.uid || employee.employeeId || employee.id
  if (leave.employeeId && uid && String(leave.employeeId) === String(uid)) return true
  if (leave.uid && uid && String(leave.uid) === String(uid)) return true
  if (leave.employeeEmail && employee.email) {
    if (leave.employeeEmail.toLowerCase() === String(employee.email).toLowerCase()) return true
  }
  const name = String(employee.displayName || employee.name || '').toLowerCase()
  if (leave.employeeName && name && leave.employeeName.toLowerCase() === name) return true
  return false
}

function leaveWorkingDates(leave, holidays = []) {
  const holidaySet = new Set((holidays || []).map((h) => h.date).filter(Boolean))
  return expandDateRange(leave.startDate, leave.endDate || leave.startDate).filter((d) => {
    if (holidaySet.has(d)) return false
    return new Date(`${d}T00:00:00`).getDay() !== 0
  })
}

function formatSecondsToHrsMins(totalSec) {
  if (!totalSec || totalSec <= 0) return '0h 0m'
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  return `${hrs}h ${mins}m`
}

/**
 * @returns compact month stats for Gemini (no full daily dump unless needed)
 */
function buildEmployeeMonthSummary({
  employee,
  month: monthInput,
  attendanceLogs = [],
  leaveRequests = [],
  timelineEntries = [],
  holidays = [],
}) {
  const month = normalizeMonth(monthInput)
  const { start, end } = getMonthDateBounds(month)
  const uid = employee?.uid || employee?.employeeId || employee?.id || ''
  const workingDaysList = getWorkingDaysInMonth(month, holidays)
  const logsByDate = {}
  ;(attendanceLogs || []).forEach((log) => {
    if (!log?.date || log.date < start || log.date > end) return
    if (log.uid && uid && String(log.uid) !== String(uid)) return
    logsByDate[log.date] = log
  })

  const empLeaves = (leaveRequests || []).filter((l) => leaveMatchesEmployee(l, employee))
  const approvedByDate = {}
  empLeaves.forEach((leave) => {
    if (String(leave.status || '').toLowerCase() !== 'approved') return
    leaveWorkingDates(leave, holidays).forEach((d) => {
      if (d < start || d > end) return
      if (!approvedByDate[d]) approvedByDate[d] = []
      approvedByDate[d].push(leave)
    })
  })

  let timelineWorkHours = 0
  let timelineUpskillHours = 0
  let timelineEntryCount = 0
  const timelineSamples = []
  ;(timelineEntries || []).forEach((entry) => {
    if (!entry?.date || entry.date < start || entry.date > end) return
    if (entry.uid && uid && String(entry.uid) !== String(uid)) return
    const hrs = Number(entry.hours) || 0
    timelineEntryCount += 1
    if (entry.entryType === 'upskilling') timelineUpskillHours += hrs
    else timelineWorkHours += hrs
    if (timelineSamples.length < 20) {
      timelineSamples.push({
        date: entry.date,
        hours: hrs,
        type: entry.entryType || 'work',
        description: String(entry.description || '').slice(0, 200),
      })
    }
  })

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const accountStart =
    toAccountStartDateStr(employee?.joinedAt) || toAccountStartDateStr(employee?.createdAt)

  let presentDays = 0
  let absentDays = 0
  let onDutyDays = 0
  let wfhDays = 0
  let totalRegularSeconds = 0
  const leaveByType = {}
  const absentDates = []
  const wfhDates = []

  workingDaysList.forEach((date) => {
    const log = logsByDate[date]
    const dayLeaves = approvedByDate[date] || []
    const wfh = dayLeaves.some(isWfhLeave)
    const onDuty = Boolean(log?.onDuty || log?.source === 'on_duty') || dayLeaves.some(isOnDutyLeave)
    const presentFromLog = isAttendancePresent(log)
    const present = presentFromLog || wfh
    const fullDayApprovedLeave = dayLeaves.find(
      (l) => !isPermissionLeave(l) && !isOnDutyLeave(l)
    )
    const isFuture = date > todayStr
    const isBeforeJoin = Boolean(accountStart && date < accountStart)
    const canBeAbsent = !isFuture && !isBeforeJoin && !fullDayApprovedLeave

    if (wfh) {
      wfhDays += 1
      wfhDates.push(date)
    }

    if (present && !isBeforeJoin) {
      presentDays += 1
      if (onDuty) onDutyDays += 1
      if (presentFromLog) {
        totalRegularSeconds += Number(log?.regularSeconds) || Number(log?.accumulatedWorkSeconds) || 0
      }
    } else if (canBeAbsent && !present && !wfh) {
      absentDays += 1
      absentDates.push(date)
    }

    dayLeaves.forEach((leave) => {
      const type = leaveTypeLabel(leave) || 'Leave'
      leaveByType[type] = (leaveByType[type] || 0) + 1
    })
  })

  const eligibleWorkingDays = workingDaysList.filter((date) => {
    if (date > todayStr) return false
    if (accountStart && date < accountStart) return false
    return true
  }).length

  const leaveRequestsSummary = empLeaves
    .filter((leave) => {
      const dates = leaveWorkingDates(leave, holidays).filter((d) => d >= start && d <= end)
      return dates.length > 0
    })
    .map((leave) => ({
      type: leaveTypeLabel(leave),
      status: leave.status || 'pending',
      startDate: leave.startDate || null,
      endDate: leave.endDate || leave.startDate || null,
      days: leaveWorkingDates(leave, holidays).filter((d) => d >= start && d <= end).length,
    }))

  return {
    uid,
    displayName: employee?.displayName || employee?.name || 'Employee',
    email: employee?.email || '',
    departmentName: employee?.departmentName || employee?.department || '',
    roleName: employee?.roleName || employee?.role || '',
    month,
    attendance: {
      workingDays: workingDaysList.length,
      eligibleWorkingDays,
      presentDays,
      absentDays,
      wfhDays,
      onDutyDays,
      attendancePercentage:
        eligibleWorkingDays > 0 ? Math.round((presentDays / eligibleWorkingDays) * 100) : 0,
      totalWorkHoursLabel: formatSecondsToHrsMins(totalRegularSeconds),
      absentDates,
      wfhDates,
    },
    leave: {
      byType: leaveByType,
      requests: leaveRequestsSummary,
    },
    timeline: {
      totalHours: Math.round((timelineWorkHours + timelineUpskillHours) * 100) / 100,
      workHours: Math.round(timelineWorkHours * 100) / 100,
      upskillingHours: Math.round(timelineUpskillHours * 100) / 100,
      entryCount: timelineEntryCount,
      recentEntries: timelineSamples,
    },
  }
}

module.exports = {
  currentMonthStr,
  normalizeMonth,
  getMonthDateBounds,
  buildEmployeeMonthSummary,
  leaveMatchesEmployee,
}
