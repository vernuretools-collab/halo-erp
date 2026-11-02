function eventMs(value) {
  if (value && typeof value.toMillis === 'function') {
    const n = value.toMillis()
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (value && typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6)
  }
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function orderedLogs(logs) {
  return [...(Array.isArray(logs) ? logs : [])]
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => (eventMs(a.timestamp) || 0) - (eventMs(b.timestamp) || 0))
}

/**
 * Pair tea and lunch start events with the next matching end.
 * An end with no open start is ignored. A start with no end stays open (endMs null).
 * Sessions are oldest first.
 */
export function pauseSessions(logs) {
  const open = { tea: null, lunch: null }
  const sessions = []

  for (const entry of orderedLogs(logs)) {
    const at = eventMs(entry.timestamp)
    if (!at) continue

    if (entry.type === 'break_start') {
      open.tea = at
    } else if (entry.type === 'break_end') {
      if (open.tea == null) continue
      sessions.push({ kind: 'tea', startMs: open.tea, endMs: at })
      open.tea = null
    } else if (entry.type === 'lunch_start') {
      open.lunch = at
    } else if (entry.type === 'lunch_end') {
      if (open.lunch == null) continue
      sessions.push({ kind: 'lunch', startMs: open.lunch, endMs: at })
      open.lunch = null
    }
  }

  if (open.tea != null) sessions.push({ kind: 'tea', startMs: open.tea, endMs: null })
  if (open.lunch != null) sessions.push({ kind: 'lunch', startMs: open.lunch, endMs: null })
  return sessions
}

export function sessionMinutes(session, nowMs = Date.now()) {
  if (!session?.startMs) return 0
  const end = session.endMs == null ? nowMs : session.endMs
  return Math.max(0, Math.round((end - session.startMs) / 60000))
}

export function formatClock(ms) {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  return `${m} min`
}

export function formatSessionRange(session) {
  const start = formatClock(session.startMs)
  const end = session.endMs == null ? 'now' : formatClock(session.endMs)
  return `${start} – ${end}`
}

export function localDateKey(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function logsFromAttendance(record) {
  if (!record) return []
  const logs = record.todayShiftLogs || record.shiftLogs || []
  return Array.isArray(logs) ? logs : []
}

export function kindLabel(kind) {
  return kind === 'lunch' ? 'Lunch' : 'Tea break'
}
