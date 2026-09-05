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
  // Back-compat: older company-wide style fields if present on emp
  if (!mode && emp?.wfhEnabled === false) mode = 'off'
  if (!mode && emp?.wfhDaysPerMonth != null) mode = 'monthly'

  if (!['off', 'full', 'weekly', 'monthly'].includes(mode)) {
    mode = 'off'
  }

  const limit = Math.max(1, Number(emp?.wfhLimit ?? emp?.wfhDaysPerMonth) || 1)
  const enabled = mode !== 'off'
  // Weekly: employee chooses at clock-in. Monthly: leave form + admin approval.
  // Admin leave form can still create WFH for either mode (canRequest).
  const leaveFormEnabled = mode === 'monthly'
  const clockInChoice = mode === 'weekly'
  const canRequest = leaveFormEnabled || clockInChoice

  return { mode, limit, enabled, canRequest, leaveFormEnabled, clockInChoice }
}

/**
 * Sum non-rejected WFH days for an employee in the policy period of referenceDate.
 */
export const countUsedWfhDays = (leaveRequests, employeeFilter, policy, referenceDateStr) => {
  if (!policy || policy.mode === 'off' || policy.mode === 'full') return 0

  const ref = referenceDateStr || toDateKey(new Date())
  const list = Array.isArray(leaveRequests) ? leaveRequests : []

  return list
    .filter((l) => {
      const requested = l.requestedLeaveType || l.leaveType
      if (requested !== 'Work From Home' && l.leaveType !== 'Work From Home') return false
      if (l.status === 'rejected' || l.status === 'cancelled') return false
      if (!l.startDate) return false
      if (!matchesEmployee(l, employeeFilter)) return false

      if (policy.mode === 'monthly') {
        return l.startDate.startsWith(ref.slice(0, 7))
      }

      // weekly
      const { start, end } = getWeekRangeForDate(ref)
      return l.startDate >= start && l.startDate <= end
    })
    .reduce((sum, l) => sum + (Number(l.days) || 1), 0)
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
    policyOrEmp?.mode != null && policyOrEmp?.canRequest != null
      ? policyOrEmp
      : resolveEmployeeWfhPolicy(policyOrEmp)

  if (!policy || policy.mode === 'off') return 'Off'
  if (policy.mode === 'full') return 'Full WFH'
  if (policy.mode === 'weekly') return `${policy.limit}/week`
  if (policy.mode === 'monthly') return `${policy.limit}/month`
  return 'Off'
}

export const getWfhBadgeVariant = (policyOrEmp) => {
  const policy =
    policyOrEmp?.mode != null
      ? policyOrEmp
      : resolveEmployeeWfhPolicy(policyOrEmp)
  if (policy.mode === 'full') return 'success'
  if (policy.mode === 'weekly') return 'brand'
  if (policy.mode === 'monthly') return 'warning'
  return 'default'
}
