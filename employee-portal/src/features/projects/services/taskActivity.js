import { useUserStore } from '../../../stores/userStore'

const STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export const statusName = (statusId, statuses = []) => {
  if (!statusId) return 'None'
  const match = (statuses || []).find((status) => status.id === statusId)
  if (match?.name) return match.name
  if (STATUS_LABELS[statusId]) return STATUS_LABELS[statusId]
  return String(statusId)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export const formatActivityDate = (value) => {
  if (!value) return 'None'
  const raw = String(value).slice(0, 10)
  const date = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatRelativeTime = (iso, nowMs = Date.now()) => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((nowMs - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return formatActivityDate(iso)
}

const activityActor = () => {
  const { user, userDoc } = useUserStore.getState()
  return {
    actorId: user?.uid || userDoc?.uid || userDoc?.id || null,
    actorName: userDoc?.displayName || user?.displayName || userDoc?.name || 'Employee',
  }
}

export const createActivityEntry = (partial) => ({
  id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  createdAt: new Date().toISOString(),
  kind: 'history',
  ...activityActor(),
  ...partial,
})

export const mergeActivity = (existing, entries) => {
  const list = Array.isArray(existing) ? existing : []
  const incoming = (entries || []).filter(Boolean)
  if (!incoming.length) return list
  const ids = new Set(list.map((item) => item.id))
  const next = [...list]
  for (const entry of incoming) {
    if (!entry?.id || ids.has(entry.id)) continue
    ids.add(entry.id)
    next.push(entry)
  }
  return next.slice(-300)
}

export const taskStatusHistory = (fromStatus, toStatus, statuses) => {
  if (!fromStatus || fromStatus === toStatus) return null
  return createActivityEntry({
    kind: 'history',
    field: 'status',
    action: 'changed the Status',
    fromLabel: statusName(fromStatus, statuses),
    toLabel: statusName(toStatus, statuses),
  })
}

export const subtaskHistoryEntries = (before, after, statuses) => {
  if (!before || !after) return []
  const subtaskId = before.id || after.id || null
  const entries = []
  const beforeAssignee = before.assigneeName || 'Unassigned'
  const afterAssignee = after.assigneeName || 'Unassigned'
  if (beforeAssignee !== afterAssignee) {
    entries.push(
      createActivityEntry({
        kind: 'history',
        field: 'assignee',
        action: 'changed the Assignee',
        subtaskId,
        fromLabel: beforeAssignee,
        toLabel: afterAssignee,
      })
    )
  }

  const beforeDue = before.dueDate ? String(before.dueDate).slice(0, 10) : ''
  const afterDue = after.dueDate ? String(after.dueDate).slice(0, 10) : ''
  if (beforeDue !== afterDue) {
    entries.push(
      createActivityEntry({
        kind: 'history',
        field: 'dueDate',
        action: 'updated the Due date',
        subtaskId,
        fromLabel: beforeDue ? formatActivityDate(beforeDue) : 'None',
        toLabel: afterDue ? formatActivityDate(afterDue) : 'None',
      })
    )
  }

  const beforeStatus = before.status || (before.isCompleted ? 'done' : 'todo')
  const afterStatus = after.status || (after.isCompleted ? 'done' : 'todo')
  if (beforeStatus !== afterStatus) {
    entries.push(
      createActivityEntry({
        kind: 'history',
        field: 'status',
        action: 'changed the Status',
        subtaskId,
        fromLabel: statusName(beforeStatus, statuses),
        toLabel: statusName(afterStatus, statuses),
      })
    )
  }

  return entries
}

export const commentEntry = (body) => {
  const text = String(body || '').trim()
  if (!text) return null
  return createActivityEntry({
    kind: 'comment',
    field: 'comment',
    action: 'commented',
    body: text,
  })
}
