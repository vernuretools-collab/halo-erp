/** Local calendar day for scrum. A new day begins at 12:00 AM. */
export const SCRUM_START_MINUTES = 10 * 60 + 30

const INACTIVE_STATUSES = new Set([
  'inactive',
  'terminated',
  'archived',
  'relieved',
  'ex-employee',
  'ex_employee',
  'disabled',
  'deleted',
  'left',
  'resigned',
  'offboarded',
])

export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(now = new Date()) {
  return toISODate(now)
}

export function parseISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function shiftISODate(iso, days) {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function yesterdayISO(now = new Date()) {
  return shiftISODate(todayISO(now), -1)
}

/** Future calendar days stay closed. Today and earlier days can be opened. */
export function isFutureDay(dateISO, now = new Date()) {
  return String(dateISO) > todayISO(now)
}

/** Morning scrum begins at 10:30 AM local time. */
export function scrumHasStarted(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes() >= SCRUM_START_MINUTES
}

export function monthBounds(year, monthIndex) {
  return {
    start: toISODate(new Date(year, monthIndex, 1)),
    end: toISODate(new Date(year, monthIndex + 1, 0)),
  }
}

export function calendarCells(year, monthIndex) {
  const count = new Date(year, monthIndex + 1, 0).getDate()
  const lead = new Date(year, monthIndex, 1).getDay()
  const cells = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= count; day += 1) {
    const date = new Date(year, monthIndex, day)
    cells.push({ day, iso: toISODate(date) })
  }
  return cells
}

export function formatLongDate(iso) {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthLabel(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

/** One stable id per employee per calendar day. Other days use other ids. */
export function scrumDocId(employeeId, dateISO) {
  const safe = String(employeeId || '').replace(/\//g, '_')
  return `scrum_${safe}_${dateISO}`
}

export function isActiveEmployee(employee) {
  const status = String(employee?.status || 'active').trim().toLowerCase()
  return !INACTIVE_STATUSES.has(status)
}

export function hasScrumNotes(record) {
  const morning = String(record?.morningScrum || '').trim()
  const eod = String(record?.eodUpdate || '').trim()
  return Boolean(morning || eod)
}

/** One spreadsheet row per employee for the day open on the board. */
export function scrumExportRows(employees, drafts, dateISO) {
  return (employees || []).map((employee) => {
    const draft = drafts?.[employee?.id] || {}
    return {
      employee: employee?.name || '',
      email: employee?.email || '',
      date: dateISO || '',
      morningScrum: draft.morningScrum || '',
      eodUpdate: draft.eodUpdate || '',
    }
  })
}

/** Same present check the attendance screens use. */
export function attendanceLogIsPresent(log) {
  if (!log) return false
  if (log.present === false) return false
  const worked = Number(log.regularSeconds) || Number(log.accumulatedWorkSeconds) || 0
  return (
    log.present === true ||
    log.onDuty === true ||
    log.source === 'on_duty' ||
    Boolean(log.clockedIn) ||
    (Boolean(log.clockInTime) && log.clockInTime !== '—') ||
    worked > 0
  )
}

function logMatchesEmployee(log, employee) {
  const employeeIds = new Set(collectIdentityIds(employee))
  if (!employeeIds.size) return false
  return collectIdentityIds(log).some((id) => employeeIds.has(id))
}

/**
 * Fill empty scrum rows with "absent" for a past day when that employee has no present log.
 * Today and a missing attendance read are left unchanged. Existing notes stay as saved.
 */
export function applyAbsentScrum(employees, drafts, { dateISO, today, logs } = {}) {
  if (!drafts) return drafts
  if (!dateISO || !today || String(dateISO) >= String(today)) return drafts
  if (!Array.isArray(logs)) return drafts
  const next = { ...drafts }
  for (const employee of employees || []) {
    if (!employee?.id) continue
    const current = next[employee.id]
    if (!current || hasScrumNotes(current)) continue
    const present = logs.some((log) => logMatchesEmployee(log, employee) && attendanceLogIsPresent(log))
    if (present) continue
    next[employee.id] = {
      ...current,
      morningScrum: 'absent',
      eodUpdate: 'absent',
      dirty: true,
      error: '',
    }
  }
  return next
}

export function matchesEmployeeSearch(employee, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return true
  const name = String(employee?.name || '').toLowerCase()
  const email = String(employee?.email || '').toLowerCase()
  return name.includes(q) || email.includes(q)
}

function addIdentity(ids, value) {
  if (value == null || value === '' || typeof value === 'object') return
  ids.add(String(value))
}

export function collectIdentityIds(record) {
  const ids = new Set()
  if (!record) return []
  addIdentity(ids, record.id)
  addIdentity(ids, record.employeeId)
  addIdentity(ids, record.uid)
  addIdentity(ids, record.authId)
  addIdentity(ids, record.auth_id)
  addIdentity(ids, record.employeeDocId)
  if (Array.isArray(record.identityIds)) record.identityIds.forEach((id) => addIdentity(ids, id))
  return [...ids]
}

export function sessionIdentityIds(session) {
  const user = session?.user || null
  const userDoc = session?.userDoc || null
  return collectIdentityIds({
    ...(userDoc || {}),
    id: userDoc?.id || user?.uid || user?.id,
    uid: user?.uid || userDoc?.uid,
    email: user?.email || userDoc?.email,
    identityIds: [...(userDoc?.identityIds || []), user?.uid, user?.id].filter(Boolean),
  })
}

function hasConductorIdentity(conductor) {
  return Boolean(conductor?.employeeId || String(conductor?.employeeEmail || conductor?.email || '').trim())
}

/** Selected scrum users. An `employees` array wins, including when it is empty. */
export function conductorList(record) {
  if (!record) return []
  if (Array.isArray(record.employees)) return record.employees.filter(hasConductorIdentity)
  return hasConductorIdentity(record) ? [record] : []
}

function matchesConductor(conductor, session) {
  if (!hasConductorIdentity(conductor)) return false
  const conductorIds = new Set(collectIdentityIds({
    ...conductor,
    id: conductor.employeeId || conductor.id,
    email: conductor.employeeEmail || conductor.email,
  }))
  const sessionIds = sessionIdentityIds(session)
  if (sessionIds.some((id) => conductorIds.has(id))) return true
  const conductorEmail = String(conductor.employeeEmail || conductor.email || '').trim().toLowerCase()
  if (!conductorEmail) return false
  const emails = [session?.user?.email, session?.userDoc?.email]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean)
  return emails.includes(conductorEmail)
}

/** True when the signed-in person is one of the employees admin chose for scrum. */
export function isCurrentConductor(conductor, session) {
  return conductorList(conductor).some((person) => matchesConductor(person, session))
}
