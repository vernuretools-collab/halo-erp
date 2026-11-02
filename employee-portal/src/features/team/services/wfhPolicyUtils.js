/**
 * Per-employee WFH policy helpers (off | full | weekly | monthly).
 */

const toDateKey = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Monday–Sunday week containing the given YYYY-MM-DD date */
export const getWeekRangeForDate = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) {
    const today = toDateKey(new Date())
    return { start: today, end: today }
  }
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  return { start: toDateKey(mon), end: toDateKey(sun) }
}

const matchesEmployee = (leave, filter = {}) => {
  const { employeeId, employeeEmail, employeeName, uid } = filter
  if (employeeId && (leave.employeeId === employeeId || leave.employeeId === uid)) return true
  if (uid && leave.employeeId === uid) return true
  if (employeeEmail && leave.employeeEmail?.toLowerCase() === employeeEmail.toLowerCase()) return true
  if (
    employeeName &&
    employeeName !== 'Team Staff' &&
    leave.employeeName?.toLowerCase() === employeeName.toLowerCase()
  ) {
    return true
  }
  return false
}

/**
 * Resolve WFH policy from an employee Firestore document.
 * @returns {{
 *   mode: 'off'|'full'|'weekly'|'monthly',
 *   limit: number,
 *   enabled: boolean,
 *   canRequest: boolean,
 *   leaveFormEnabled: boolean,
 *   clockInChoice: boolean,
 * }}
 */
export const resolveEmployeeWfhPolicy = (emp) => {
  let mode = emp?.wfhMode
  if (!mode && emp?.wfhEnabled === false) mode = 'off'
  if (!mode && emp?.wfhDaysPerMonth != null) mode = 'monthly'

  if (!['off', 'full', 'weekly', 'monthly'].includes(mode)) {
    mode = 'off'
  }

  const limit = Math.max(1, Number(emp?.wfhLimit ?? emp?.wfhDaysPerMonth) || 1)
  const enabled = mode !== 'off'
  // Weekly: office clock-in does not use a day; away from the office uses one flexible day.
  // Monthly: leave request + admin approval.
  const leaveFormEnabled = mode === 'monthly'
  const clockInChoice = mode === 'weekly'
  const canRequest = leaveFormEnabled || clockInChoice

  return { mode, limit, enabled, canRequest, leaveFormEnabled, clockInChoice }
}

const addCalendarDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** True when this attendance row was a work-from-home clock-in. */
export const attendanceRecordIsWfh = (record) => {
  if (!record || typeof record !== 'object') return false
  if (record.wfhExempt === true) return true
  const logs = []
  if (Array.isArray(record.shiftLogs)) logs.push(...record.shiftLogs)
  if (Array.isArray(record.todayShiftLogs)) logs.push(...record.todayShiftLogs)
  return logs.some((entry) => entry?.type === 'clock_in' && /wfh/i.test(String(entry.label || '')))
}

const attendanceEntries = (attendanceByDate) => {
  if (!attendanceByDate) return []
  if (Array.isArray(attendanceByDate)) return attendanceByDate
  if (typeof attendanceByDate !== 'object') return []
  return Object.entries(attendanceByDate).map(([date, record]) => ({
    ...(record || {}),
    date: record?.date || date,
  }))
}

const leaveSpanEnd = (leave, start) => {
  const end = String(leave.endDate || '').slice(0, 10)
  const byDays = addCalendarDays(start, Math.max(1, Number(leave.days) || 1) - 1)
  if (end && end > byDays) return end
  return byDays
}

const isWfhLeave = (leave) => {
  const requested = leave?.requestedLeaveType || leave?.leaveType
  if (requested !== 'Work From Home' && leave?.leaveType !== 'Work From Home') return false
  const status = String(leave?.status || '').toLowerCase()
  return status !== 'rejected' && status !== 'cancelled'
}

/**
 * Distinct WFH dates in the Monday–Sunday week of referenceDate.
 * A date counts once, whether it came from a leave request or a WFH clock-in.
 */
export const collectUsedWfhDates = (leaveRequests, employeeFilter, policy, referenceDateStr, attendanceByDate) => {
  const dates = new Set()
  if (!policy || policy.mode !== 'weekly') return dates

  const ref = referenceDateStr || toDateKey(new Date())
  const { start, end } = getWeekRangeForDate(ref)
  const list = Array.isArray(leaveRequests) ? leaveRequests : []

  list.forEach((leave) => {
    const day = String(leave?.startDate || '').slice(0, 10)
    if (!day || !isWfhLeave(leave) || !matchesEmployee(leave, employeeFilter)) return
    let cursor = day < start ? start : day
    const last = leaveSpanEnd(leave, day)
    const clip = last > end ? end : last
    for (let i = 0; i < 40 && cursor <= clip; i += 1) {
      dates.add(cursor)
      cursor = addCalendarDays(cursor, 1)
    }
  })

  attendanceEntries(attendanceByDate).forEach((record) => {
    const date = String(record?.date || '').slice(0, 10)
    if (!date || date < start || date > end) return
    if (!attendanceRecordIsWfh(record)) return
    dates.add(date)
  })

  return dates
}

/**
 * Sum non-rejected WFH days for an employee in the policy period of referenceDate.
 * Weekly mode counts unique dates from leave requests and WFH clock-ins.
 * @param {object|object[]|null} [attendanceByDate] date → attendance row, or a list of rows
 */
export const countUsedWfhDays = (leaveRequests, employeeFilter, policy, referenceDateStr, attendanceByDate) => {
  if (!policy || policy.mode === 'off' || policy.mode === 'full') return 0

  const ref = referenceDateStr || toDateKey(new Date())
  const list = Array.isArray(leaveRequests) ? leaveRequests : []

  if (policy.mode === 'monthly') {
    return list
      .filter((l) => {
        if (!isWfhLeave(l) || !l.startDate) return false
        if (!matchesEmployee(l, employeeFilter)) return false
        return String(l.startDate).startsWith(ref.slice(0, 7))
      })
      .reduce((sum, l) => sum + (Number(l.days) || 1), 0)
  }

  return collectUsedWfhDates(leaveRequests, employeeFilter, policy, ref, attendanceByDate).size
}

/**
 * @returns {string|null} error message or null if allowed
 */
export const validateWfhRequest = (policy, usedDays, requestedDays) => {
  if (!policy || policy.mode === 'off' || policy.enabled === false) {
    return 'Work From Home is not enabled for your account. Contact your administrator.'
  }
  if (policy.mode === 'full') {
    return 'You are on Full WFH and do not need to submit Work From Home leave requests.'
  }
  if (policy.mode !== 'weekly' && policy.mode !== 'monthly') {
    return 'Work From Home is not available for your account.'
  }

  const limit = Math.max(1, Number(policy.limit) || 1)
  const used = Number(usedDays) || 0
  const requested = Number(requestedDays) || 1

  if (used + requested > limit) {
    const period = policy.mode === 'weekly' ? 'week' : 'month'
    return `WFH limit exceeded. You can take only ${limit} WFH day(s) per ${period} (${used}/${limit} used).`
  }
  return null
}

/** Initial leave status for a WFH request based on mode */
export const getWfhLeaveStatus = (policy, { createdByAdmin = false } = {}) => {
  if (policy?.mode === 'weekly') return 'approved'
  if (policy?.mode === 'monthly') return createdByAdmin ? 'approved' : 'pending'
  return 'pending'
}

export const getWfhAllowanceLabel = (policyOrEmp) => {
  const policy =
    policyOrEmp?.mode != null && (policyOrEmp.canRequest != null || policyOrEmp.limit != null)
      ? policyOrEmp
      : resolveEmployeeWfhPolicy(policyOrEmp)

  if (!policy || policy.mode === 'off') return 'Off'
  if (policy.mode === 'full') return 'Full WFH'
  if (policy.mode === 'weekly') return `${policy.limit}/week`
  if (policy.mode === 'monthly') return `${policy.limit}/month`
  return 'Off'
}
