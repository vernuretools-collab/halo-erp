function eventMs(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function orderedLogs(logs) {
  return [...(Array.isArray(logs) ? logs : [])]
    .filter((entry) => entry && typeof entry === 'object')
    .sort((a, b) => (eventMs(a.timestamp) || 0) - (eventMs(b.timestamp) || 0))
}

/** Newest-first union. Later copies of the same id do not replace the first one. */
export function mergeShiftLogs(existing, incoming) {
  const map = new Map()
  for (const entry of [...orderedLogs(existing), ...orderedLogs(incoming)]) {
    const key = entry.id || `${entry.type || 'event'}_${entry.timestamp || ''}_${entry.label || ''}`
    if (!map.has(key)) map.set(key, entry)
  }
  return pairedShiftLogs([...map.values()])
}

/**
 * Drop "Ended Break" / "Ended Lunch" rows that have no matching start.
 * A pause cannot end before it starts.
 */
export function pairedShiftLogs(logs) {
  let breakOpen = false
  let lunchOpen = false
  const kept = []
  for (const entry of orderedLogs(logs)) {
    if (entry.type === 'break_end' && !breakOpen) continue
    if (entry.type === 'lunch_end' && !lunchOpen) continue
    if (entry.type === 'break_start') breakOpen = true
    if (entry.type === 'break_end') breakOpen = false
    if (entry.type === 'lunch_start') lunchOpen = true
    if (entry.type === 'lunch_end') lunchOpen = false
    kept.push(entry)
  }
  return kept.sort((a, b) => (eventMs(b.timestamp) || 0) - (eventMs(a.timestamp) || 0))
}

/** The start event that is still open, or null. */
export function openPause(logs, startType, endType) {
  let open = null
  for (const entry of orderedLogs(logs)) {
    if (entry.type === startType) open = entry
    else if (entry.type === endType) open = null
  }
  return open
}

/**
 * Website and Electron share one shift log. Keep both sides' break and lunch
 * events, and drive the pause flags from those events so a stale window cannot
 * record an end without a start.
 */
export function mergeAttendanceSnapshot(current = {}, remote = {}) {
  if (!remote || typeof remote !== 'object') return remote
  const sameDay = current.lastWorkDate && current.lastWorkDate === remote.lastWorkDate
  if (!sameDay) return { ...remote }

  const logs = mergeShiftLogs(current.todayShiftLogs, remote.todayShiftLogs)
  const lunch = openPause(logs, 'lunch_start', 'lunch_end')
  const brk = openPause(logs, 'break_start', 'break_end')
  return {
    ...remote,
    todayShiftLogs: logs,
    isOnLunch: Boolean(lunch),
    lunchStartTime: lunch
      ? eventMs(remote.lunchStartTime) || eventMs(current.lunchStartTime) || eventMs(lunch.timestamp)
      : null,
    lunchEndsAt: lunch ? remote.lunchEndsAt || current.lunchEndsAt || null : null,
    isOnBreak: Boolean(brk),
    breakStartTime: brk
      ? eventMs(remote.breakStartTime) || eventMs(current.breakStartTime) || eventMs(brk.timestamp)
      : null,
  }
}
