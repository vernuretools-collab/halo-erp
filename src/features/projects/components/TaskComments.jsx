import { MessageSquare } from 'lucide-react'

const formatCommentTime = (iso) => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const collectTaskComments = (task) => {
  if (!task) return []
  const items = []
  for (const entry of Array.isArray(task.activity) ? task.activity : []) {
    if (entry?.kind === 'comment' && entry.body) {
      items.push({
        id: entry.id,
        body: entry.body,
        actorName: entry.actorName || 'Employee',
        createdAt: entry.createdAt,
        context: 'Task',
      })
    }
  }
  for (const subtask of Array.isArray(task.subtasks) ? task.subtasks : []) {
    for (const entry of Array.isArray(subtask.comments) ? subtask.comments : []) {
      if (!entry?.body) continue
      items.push({
        id: entry.id || `${subtask.id}-${entry.createdAt}`,
        body: entry.body,
        actorName: entry.actorName || 'Employee',
        createdAt: entry.createdAt,
        context: subtask.title || 'Subtask',
      })
    }
  }
  return items.sort(
    (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
  )
}

export const TaskComments = ({ task }) => {
  const comments = collectTaskComments(task)
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <h4 className="flex items-center gap-1.5 text-sm font-bold text-fg">
        <MessageSquare className="w-4 h-4 text-accent" />
        Comments
        <span className="text-xs font-medium text-muted">({comments.length})</span>
      </h4>
      {comments.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No comments yet.</p>
      ) : (
        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {comments.map((entry) => (
            <article key={entry.id} className="space-y-1">
              <p className="text-sm text-fg">
                <span className="font-semibold">{entry.actorName}</span>
                <span className="text-muted"> on {entry.context}</span>
              </p>
              <p className="text-xs text-muted">{formatCommentTime(entry.createdAt)}</p>
              <p className="whitespace-pre-wrap text-sm text-fg">{entry.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
