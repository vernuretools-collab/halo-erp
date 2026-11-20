const IST_MS = 5.5 * 60 * 60 * 1000

export const REEL_STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'changes_requested',
  'ready_to_schedule',
  'scheduled',
  'published',
]

/** Stages the board can move a reel between. Later stages stay on schedule and publish. */
export const REEL_WORK_STAGES = ['todo', 'in_progress', 'in_review', 'changes_requested']

export const REEL_STATUS_LABEL = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  ready_to_schedule: 'Ready to Schedule',
  scheduled: 'Scheduled',
  published: 'Published',
}

export const RISK_LABEL = {
  on_track: 'On track',
  at_risk: 'At risk',
  late: 'Late',
  missed: 'Missed',
  published: 'Published',
}

export function kolkataParts(value) {
  const shifted = new Date(new Date(value).getTime() + IST_MS)
  return {
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth(),
    d: shifted.getUTCDate(),
    dow: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

function istMidnight(y, m, d) {
  return Date.UTC(y, m, d) - IST_MS
}

export function deadlineAt(golive, daysBefore) {
  const parts = kolkataParts(golive)
  let cursor = istMidnight(parts.y, parts.m, parts.d) - daysBefore * 86400000
  const shifted = new Date(cursor + IST_MS)
  if (shifted.getUTCDay() === 0) cursor -= 86400000
  return new Date(cursor + 20 * 60 * 60 * 1000)
}

export function reelDeadlines(golive) {
  return {
    t7: deadlineAt(golive, 7),
    t5: deadlineAt(golive, 5),
    t4: deadlineAt(golive, 4),
    t3: deadlineAt(golive, 3),
  }
}

export function isRush(golive, now = new Date()) {
  return new Date(golive).getTime() - new Date(now).getTime() < 72 * 60 * 60 * 1000
}

function istDayKey(value) {
  const parts = kolkataParts(value)
  return parts.y * 10000 + (parts.m + 1) * 100 + parts.d
}

/** Go-live before today in India cannot be worked: T-7 through T would already have passed. */
export function isBeforeTodayIst(value, now = new Date()) {
  if (!value) return false
  return istDayKey(value) < istDayKey(now)
}

export function computeRisk(reel, now = new Date()) {
  if (!reel) return 'on_track'
  const at = new Date(now).getTime()
  if (reel.status === 'published') return 'published'
  if (at > new Date(reel.golive_at).getTime() + 60 * 60 * 1000) return 'missed'
  if (reel.status !== 'scheduled' && at > new Date(reel.t3).getTime()) return 'late'
  if (reel.status === 'todo' && at > new Date(reel.t7).getTime()) return 'at_risk'
  if (['todo', 'in_progress'].includes(reel.status) && at > new Date(reel.t5).getTime()) return 'at_risk'
  if (
    ['todo', 'in_progress', 'in_review', 'changes_requested'].includes(reel.status) &&
    at > new Date(reel.t4).getTime()
  ) {
    return 'at_risk'
  }
  return 'on_track'
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDayLabel(value) {
  const parts = kolkataParts(value)
  return `${DAY_NAMES[parts.dow]} ${parts.d} ${MONTH_NAMES[parts.m]}`
}

export function formatClockLabel(value) {
  const parts = kolkataParts(value)
  const hour = parts.hour % 12 || 12
  const minute = String(parts.minute).padStart(2, '0')
  const meridiem = parts.hour >= 12 ? 'PM' : 'AM'
  return `${formatDayLabel(value)}, ${hour}:${minute} ${meridiem}`
}

export function monthName(value = new Date()) {
  return MONTH_NAMES[kolkataParts(value).m]
}

export function weekMonday(value) {
  const parts = kolkataParts(value)
  const offset = parts.dow === 0 ? 6 : parts.dow - 1
  return new Date(Date.UTC(parts.y, parts.m, parts.d) - IST_MS - offset * 86400000)
}

export function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function toIstInput(value) {
  const parts = kolkataParts(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${parts.y}-${pad(parts.m + 1)}-${pad(parts.d)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

export function fromIstInput(value) {
  if (!value) return null
  const date = new Date(`${value}:00+05:30`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function isLeadershipUser(user, userDoc) {
  const role = String(userDoc?.role || user?.role || '').toLowerCase()
  if (['admin', 'owner', 'superadmin'].includes(role)) return true
  const name = `${userDoc?.name || ''} ${userDoc?.displayName || ''} ${user?.displayName || ''}`.toLowerCase()
  return /vivek|swathish|vedhika/.test(name)
}

export function monthKey(value = new Date()) {
  const parts = kolkataParts(value)
  return `${parts.y}-${String(parts.m + 1).padStart(2, '0')}`
}

export function isHttpUrl(value) {
  return /^https?:\/\/\S+$/i.test(String(value || '').trim())
}
