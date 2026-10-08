export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'YouTube']
export const CONTENT_TYPES = ['Story', 'Post', 'Reel', 'Carousel', 'Podcast']
export const REPEAT_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'custom', label: 'Custom days' },
]

export const EARLY_MINUTES = 15
export const NOTIFY_BEFORE_OPTIONS = [
  { minutes: 0, label: 'No early reminder' },
  { minutes: 5, label: '5 minutes before' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 15, label: '15 minutes before' },
]

const ALLOWED_NOTIFY_BEFORE = new Set(NOTIFY_BEFORE_OPTIONS.map((option) => option.minutes))

export const notifyBeforeMinutes = (reminder) => {
  const value = Number(reminder?.notifyBeforeMinutes)
  if (ALLOWED_NOTIFY_BEFORE.has(value)) return value
  return EARLY_MINUTES
}

export const notifyBeforeLabel = (reminder) => {
  const minutes = notifyBeforeMinutes(reminder)
  if (!minutes) return 'No early reminder'
  return `Notify ${minutes} min before`
}

export const localDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const dateFromKey = (dateKey) => {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export const parseTimeToMinutes = (time) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export const formatTimeLabel = (time) => {
  const total = parseTimeToMinutes(time)
  if (total == null) return time || '—'
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export const splitTime12 = (time) => {
  const total = parseTimeToMinutes(time)
  if (total == null) return { hour: '12', minute: '00', meridiem: 'AM' }
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return {
    hour: String(hours % 12 || 12),
    minute: String(minutes).padStart(2, '0'),
    meridiem: hours >= 12 ? 'PM' : 'AM',
  }
}

export const joinTime12 = (hour, minute, meridiem) => {
  const h12 = Number(hour)
  const m = Number(minute)
  if (!Number.isInteger(h12) || h12 < 1 || h12 > 12) return null
  if (!Number.isInteger(m) || m < 0 || m > 59) return null
  if (meridiem !== 'AM' && meridiem !== 'PM') return null
  let h24 = h12 % 12
  if (meridiem === 'PM') h24 += 12
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const isPostedOn = (reminder, dateKey) => {
  const dates = Array.isArray(reminder?.postedDates) ? reminder.postedDates : []
  return dates.includes(dateKey)
}

export const occursOn = (reminder, date) => {
  if (!reminder) return false
  const key = date instanceof Date ? localDateKey(date) : String(date || '').slice(0, 10)
  const start = String(reminder.startDate || '').slice(0, 10)
  if (!key || !start || key < start) return false
  const end = String(reminder.endDate || '').slice(0, 10)
  if (end && key > end) return false
  const repeat = reminder.repeat || 'none'
  if (repeat === 'none') return key === start
  if (repeat === 'daily') return true
  const day = dateFromKey(key)
  if (!day) return false
  if (repeat === 'weekly') {
    const startDay = dateFromKey(start)
    return Boolean(startDay) && day.getDay() === startDay.getDay()
  }
  if (repeat === 'custom') {
    const days = Array.isArray(reminder.days) ? reminder.days.map(Number) : []
    return days.includes(day.getDay())
  }
  return false
}

export const repeatSummary = (reminder) => {
  const repeat = reminder?.repeat || 'none'
  if (repeat === 'daily') return 'Daily'
  if (repeat === 'weekly') {
    const start = dateFromKey(reminder?.startDate)
    const label = start ? WEEKDAY_FULL[start.getDay()] : ''
    return label ? `Weekly on ${label}` : 'Weekly'
  }
  if (repeat === 'custom') {
    const days = (Array.isArray(reminder?.days) ? reminder.days : [])
      .map(Number)
      .filter((day) => day >= 0 && day <= 6)
      .sort((a, b) => a - b)
    if (!days.length) return 'Custom days'
    return days.map((day) => WEEKDAY_LABELS[day]).join(', ')
  }
  return 'Once'
}

const dueOnDate = (reminder, dateKey) => {
  const due = parseTimeToMinutes(reminder?.time)
  const day = dateFromKey(dateKey)
  if (due == null || !day) return null
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(due / 60), due % 60, 0, 0)
}

export const occurrenceStatus = (reminder, date, now = new Date()) => {
  const key = date instanceof Date ? localDateKey(date) : String(date || '').slice(0, 10)
  if (isPostedOn(reminder, key)) return 'posted'
  const dueAt = dueOnDate(reminder, key)
  if (dueAt && now.getTime() > dueAt.getTime()) return 'missed'
  return 'pending'
}

export const STATUS_LABEL = {
  posted: 'Posted',
  missed: 'Missed',
  pending: 'Pending',
}

export const isAssignee = (reminder, identityIds) => {
  const assigneeId = String(reminder?.assigneeId || '')
  if (!assigneeId) return false
  return (identityIds || []).map(String).includes(assigneeId)
}

export const contentLabel = (reminder) => {
  const platform = reminder?.platform || 'Post'
  const contentType = reminder?.contentType || ''
  return contentType ? `${platform} ${contentType}` : platform
}

export const trailText = (reminder, status) => {
  const topic = reminder?.topic ? `“${reminder.topic}”` : '“”'
  const parts = [
    reminder?.clientName || 'Client',
    contentLabel(reminder),
    topic,
    formatTimeLabel(reminder?.time),
    `Assigned to ${reminder?.assigneeName || '—'}`,
  ]
  if (status) parts.push(STATUS_LABEL[status] || status)
  return parts.join(' → ')
}

const startOfLocalDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const addDays = (date, days) => {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

const pingForDay = (reminder, day, now, identityIds) => {
  if (reminder?.enabled === false) return null
  if (!isAssignee(reminder, identityIds)) return null
  if (!occursOn(reminder, day)) return null
  const dateKey = localDateKey(day)
  if (isPostedOn(reminder, dateKey)) return null
  const dueAt = dueOnDate(reminder, dateKey)
  if (!dueAt) return null
  const lead = notifyBeforeMinutes(reminder)
  const nowMs = now.getTime()

  if (lead > 0) {
    const earlyAt = new Date(dueAt.getTime() - lead * 60000)
    if (nowMs >= earlyAt.getTime() && nowMs < dueAt.getTime() && reminder.lastEarlyAt !== dateKey) {
      return { kind: 'early', updates: { lastEarlyAt: dateKey } }
    }
  }

  if (nowMs >= dueAt.getTime() && localDateKey(now) === dateKey && reminder.lastDueAt !== dateKey) {
    return { kind: 'due', updates: { lastDueAt: dateKey } }
  }

  return null
}

/**
 * Next ping for this tick, or null.
 * The assignee gets one optional early ping (notifyBeforeMinutes) and one at the scheduled time.
 * A late open later the same day still delivers the at-time ping once.
 */
export const resolveSocialPostPing = (reminder, now, identityIds) => {
  if (!reminder) return null
  return (
    pingForDay(reminder, now, now, identityIds) ||
    pingForDay(reminder, addDays(startOfLocalDay(now), 1), now, identityIds)
  )
}

export const socialPostPingCopy = (reminder, kind) => {
  const trail = trailText(reminder)
  if (kind === 'early') {
    const minutes = notifyBeforeMinutes(reminder)
    const label = minutes === 1 ? '1 minute' : `${minutes} minutes`
    return {
      title: `Post in ${label}`,
      message: `${trail} is due in ${label}.`,
    }
  }
  return {
    title: 'Time to post',
    message: `${trail} is due now.`,
  }
}
