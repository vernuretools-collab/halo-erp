import { mergeShiftLogs, pairedShiftLogs } from './shiftLogs.js'

export const ATTENDANCE_OUTBOX_KEY = 'crm_attendance_outbox'
export const TIMELINE_OUTBOX_KEY = 'crm_timeline_outbox'

export function emptyTimelineOutbox() {
  return { creates: [], updates: [], deletes: [] }
}

export function attendanceOutboxId(uid, date) {
  return `${date}_${uid}`
}

function logsOf(payload) {
  if (!payload) return null
  if (Array.isArray(payload.shiftLogs) || Array.isArray(payload.todayShiftLogs)) {
    return payload.shiftLogs || payload.todayShiftLogs || []
  }
  return null
}

/** Latest flags win. Shift events from both saves are kept unless a save replaces the log. */
export function mergeAttendancePayload(prev, next) {
  if (!prev) return { ...(next || {}) }
  if (!next) return { ...prev }
  const prevLogs = logsOf(prev)
  const nextLogs = logsOf(next)
  const merged = { ...prev, ...next }
  if (next.replaceShiftLogs) {
    const logs = pairedShiftLogs(nextLogs || [])
    return { ...merged, shiftLogs: logs, todayShiftLogs: logs, replaceShiftLogs: true }
  }
  if (prev.replaceShiftLogs && nextLogs) {
    const logs = pairedShiftLogs(nextLogs)
    return { ...merged, shiftLogs: logs, todayShiftLogs: logs, replaceShiftLogs: true }
  }
  if (prevLogs || nextLogs) {
    const logs = mergeShiftLogs(prevLogs || [], nextLogs || [])
    return {
      ...merged,
      shiftLogs: logs,
      todayShiftLogs: logs,
      replaceShiftLogs: Boolean(prev.replaceShiftLogs && !nextLogs),
    }
  }
  return merged
}

export function rememberAttendanceSave(queue = {}, uid, date, payload) {
  const id = attendanceOutboxId(uid, date)
  const prev = queue[id]?.payload
  return {
    ...queue,
    [id]: {
      uid: String(uid),
      date: String(date),
      payload: mergeAttendancePayload(prev, payload),
    },
  }
}

export function dropAttendanceSave(queue = {}, uid, date) {
  const next = { ...queue }
  delete next[attendanceOutboxId(uid, date)]
  return next
}

/**
 * Same-day local and server shift events stay together.
 * An admin edit with a log replaces the local log.
 */
export function mergeLoadedShiftLogs(localLogs, serverLogs, source) {
  const server = Array.isArray(serverLogs) ? serverLogs : []
  const local = Array.isArray(localLogs) ? localLogs : []
  if (source === 'admin_edit' && server.length) return server
  return mergeShiftLogs(local, server)
}

export function createLocalTimelineEntry(payload, now = Date.now()) {
  return {
    entryId: `local_${now}`,
    uid: payload.uid,
    employeeName: payload.employeeName || '',
    date: payload.date,
    description: payload.description || '',
    hours: Number(payload.hours) || 0,
    entryType: payload.entryType === 'upskilling' ? 'upskilling' : 'work',
    pendingSync: true,
    createdAt: new Date(now).toISOString(),
  }
}

function normalizeOutbox(queue) {
  return {
    creates: Array.isArray(queue?.creates) ? queue.creates : [],
    updates: Array.isArray(queue?.updates) ? queue.updates : [],
    deletes: Array.isArray(queue?.deletes) ? queue.deletes : [],
  }
}

export function rememberTimelineCreate(queue, entry) {
  const box = normalizeOutbox(queue)
  return {
    ...box,
    creates: [
      ...box.creates.filter((row) => row.entryId !== entry.entryId),
      { ...entry, pendingSync: true },
    ],
  }
}

export function rememberTimelineUpdate(queue, entryId, updates, entry) {
  const box = normalizeOutbox(queue)
  if (box.creates.some((row) => row.entryId === entryId)) {
    return {
      ...box,
      creates: box.creates.map((row) =>
        row.entryId === entryId ? { ...row, ...updates, pendingSync: true } : row
      ),
    }
  }
  const previous = box.updates.find((row) => row.entryId === entryId)
  const snapshot = entry || previous?.entry
  return {
    ...box,
    updates: [
      ...box.updates.filter((row) => row.entryId !== entryId),
      {
        entryId,
        updates: { ...(previous?.updates || {}), ...updates },
        ...(snapshot ? { entry: { ...snapshot, ...updates, pendingSync: true } } : {}),
      },
    ],
  }
}

export function rememberTimelineDelete(queue, entryId) {
  const box = normalizeOutbox(queue)
  const wasLocal = box.creates.some((row) => row.entryId === entryId)
  return {
    creates: box.creates.filter((row) => row.entryId !== entryId),
    updates: box.updates.filter((row) => row.entryId !== entryId),
    deletes: wasLocal
      ? box.deletes.filter((id) => id !== entryId)
      : [...new Set([...box.deletes, entryId])],
  }
}

export function completeTimelineCreate(queue, entryId) {
  const box = normalizeOutbox(queue)
  return { ...box, creates: box.creates.filter((row) => row.entryId !== entryId) }
}

export function completeTimelineUpdate(queue, entryId) {
  const box = normalizeOutbox(queue)
  return { ...box, updates: box.updates.filter((row) => row.entryId !== entryId) }
}

export function completeTimelineDelete(queue, entryId) {
  const box = normalizeOutbox(queue)
  return { ...box, deletes: box.deletes.filter((id) => id !== entryId) }
}

export function mergeTimelineView(serverEntries = [], queue) {
  const box = normalizeOutbox(queue)
  const deleted = new Set(box.deletes)
  const updates = new Map(box.updates.map((row) => [row.entryId, row.updates]))
  const visible = (serverEntries || [])
    .filter((entry) => entry && !deleted.has(entry.entryId))
    .map((entry) => {
      const patch = updates.get(entry.entryId)
      if (!patch) return entry
      return { ...entry, ...patch, pendingSync: true }
    })
  const serverIds = new Set(visible.map((entry) => entry.entryId))
  const pending = box.creates
    .filter((entry) => entry && !serverIds.has(entry.entryId) && !deleted.has(entry.entryId))
    .map((entry) => ({ ...entry, pendingSync: true }))
  const heldEdits = box.updates
    .filter((row) => row.entry && !serverIds.has(row.entryId) && !deleted.has(row.entryId))
    .map((row) => ({ ...row.entry, ...row.updates, pendingSync: true }))
  return [...visible, ...pending, ...heldEdits]
}
