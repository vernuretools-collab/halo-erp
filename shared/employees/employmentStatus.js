export const EMPLOYMENT_STATUS = {
  ACTIVE: 'active',
  NOTICE_PERIOD: 'notice_period',
  RELIEVED: 'relieved',
  ARCHIVED: 'archived',
}

const BLOCKED = new Set([EMPLOYMENT_STATUS.RELIEVED, EMPLOYMENT_STATUS.ARCHIVED])

export function normalizeEmploymentStatus(value) {
  const status = String(value || 'active').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (status === 'ex_employee' || status === 'exemployee') return EMPLOYMENT_STATUS.RELIEVED
  if (status === 'notice') return EMPLOYMENT_STATUS.NOTICE_PERIOD
  if (
    status === EMPLOYMENT_STATUS.ACTIVE ||
    status === EMPLOYMENT_STATUS.NOTICE_PERIOD ||
    status === EMPLOYMENT_STATUS.RELIEVED ||
    status === EMPLOYMENT_STATUS.ARCHIVED
  ) {
    return status
  }
  return status || EMPLOYMENT_STATUS.ACTIVE
}

export function employmentStatusLabel(value) {
  const status = normalizeEmploymentStatus(value)
  if (status === EMPLOYMENT_STATUS.NOTICE_PERIOD) return 'Notice Period'
  if (status === EMPLOYMENT_STATUS.RELIEVED) return 'Ex-Employee'
  if (status === EMPLOYMENT_STATUS.ARCHIVED) return 'Archived'
  if (status === EMPLOYMENT_STATUS.ACTIVE) return 'Active'
  return status
}

export function isDirectoryVisible(employee) {
  return !BLOCKED.has(normalizeEmploymentStatus(employee?.status))
}

export function isSignInBlocked(employee) {
  const status = normalizeEmploymentStatus(employee?.employmentStatus ?? employee?.status)
  return BLOCKED.has(status)
}

export function isFormerEmployee(employee) {
  return BLOCKED.has(normalizeEmploymentStatus(employee?.status))
}

export function employeeDocId(employee) {
  return String(employee?.employeeDocId || employee?.uid || employee?.employeeId || employee?.id || '')
}

export function employeeDisplayName(employee) {
  return employee?.displayName || employee?.name || employee?.fullName || employee?.email || 'Employee'
}

export function employeeDesignation(employee) {
  return employee?.roleName || employee?.designation || employee?.role || ''
}

export function employeeDepartment(employee) {
  return employee?.departmentName || employee?.department || ''
}

export function employeeJoiningDate(employee) {
  return isoDay(employee?.joiningDate || employee?.dateOfJoining || employee?.joinedAt)
}

export function employeePublicId(employee) {
  return String(employee?.employeeCode || employee?.staffId || employee?.employeeId || employeeDocId(employee) || '')
}

export function isoDay(value) {
  const text = String(value || '').trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

export function todayIso(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inclusive calendar span from joining through the last working day. */
export function formatTenure(start, end) {
  const from = isoDay(start)
  const to = isoDay(end) || todayIso()
  if (!from) return ''
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return ''
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (b.getDate() < a.getDate()) months -= 1
  const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1
  if (months >= 1) {
    const years = Math.floor(months / 12)
    const rem = months % 12
    const parts = []
    if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`)
    if (rem) parts.push(`${rem} month${rem === 1 ? '' : 's'}`)
    return parts.join(', ')
  }
  return `${days} day${days === 1 ? '' : 's'}`
}

export function inTenure(value, start, end) {
  const day = isoDay(value)
  if (!day) return true
  if (start && day < start) return false
  if (end && day > end) return false
  return true
}

function addIdentity(ids, value) {
  if (value == null || value === '' || typeof value === 'object') return
  ids.add(String(value))
}

export function collectEmployeeIdentityIds(employee) {
  const ids = new Set()
  if (!employee) return []
  addIdentity(ids, employeeDocId(employee))
  addIdentity(ids, employee.id)
  addIdentity(ids, employee.uid)
  addIdentity(ids, employee.employeeId)
  addIdentity(ids, employee.employeeDocId)
  addIdentity(ids, employee.authId)
  addIdentity(ids, employee.auth_id)
  addIdentity(ids, employee.user_id)
  if (Array.isArray(employee.identityIds)) employee.identityIds.forEach((id) => addIdentity(ids, id))
  return [...ids]
}

export function recordMatchesEmployee(record, employee) {
  if (!record || !employee) return false
  const ids = new Set(collectEmployeeIdentityIds(employee))
  const email = String(employee.email || '').trim().toLowerCase()
  const values = [
    record.uid,
    record.id,
    record.employeeId,
    record.employeeDocId,
    record.assigneeId,
    record.userId,
    record.user_id,
    record.authId,
    record.auth_id,
    record.createdBy,
    record.createdByUid,
    record.ownerId,
    record.uploadedBy,
  ]
  if (values.some((value) => value != null && value !== '' && ids.has(String(value)))) return true
  const recordEmail = String(record.email || record.employeeEmail || record.assigneeEmail || '').trim().toLowerCase()
  return Boolean(email && recordEmail && email === recordEmail)
}
