/** Local calendar day for scrum. A new day begins at 12:00 AM. */
export const SCRUM_START_MINUTES = 10 * 60 + 30

const INACTIVE_STATUSES = new Set([
  'inactive',
  'terminated',
  'archived',
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

/** True when the signed-in person is the single employee admin chose to conduct scrum. */
export function isCurrentConductor(conductor, session) {
  if (!conductor?.employeeId && !String(conductor?.employeeEmail || conductor?.email || '').trim()) return false
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
