import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase()

const formatRelativeTime = (iso, nowMs) => {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const minutes = Math.round((nowMs - then) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const TaskActivity = ({ task, onReply }) => {
  const [tab, setTab] = useState('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const items = useMemo(() => {
    const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
    const subtaskTitle = new Map(subtasks.map((subtask) => [subtask.id, subtask.title || 'Subtask']))
    const rows = []

    for (const entry of Array.isArray(task?.activity) ? task.activity : []) {
      if (entry?.kind !== 'comment' && entry?.kind !== 'history') continue
      rows.push({
        ...entry,
        context: entry.subtaskId ? subtaskTitle.get(entry.subtaskId) || 'Subtask' : 'Task',
      })
    }

    for (const subtask of subtasks) {
      for (const entry of Array.isArray(subtask.comments) ? subtask.comments : []) {
        if (!entry?.body) continue
        rows.push({
          id: entry.id || `${subtask.id}-${entry.createdAt}`,
          kind: 'comment',
          body: entry.body,
          actorName: entry.actorName || 'Employee',
          actorRole: entry.actorRole || null,
          createdAt: entry.createdAt,
          context: subtask.title || 'Subtask',
        })
      }
    }

    const filtered = rows.filter((entry) => {
      if (tab === 'comments') return entry.kind === 'comment'
      if (tab === 'history') return entry.kind === 'history'
      return true
    })

    return filtered.sort((a, b) => {
      const left = new Date(a.createdAt).getTime() || 0
      const right = new Date(b.createdAt).getTime() || 0
      return newestFirst ? right - left : left - right
    })
  }, [task, tab, newestFirst])

  const submitReply = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const saved = await onReply?.(text)
      if (saved) {
        setDraft('')
        if (tab === 'history') setTab('comments')
      }
    } finally {
      setSending(false)
    }
  }

  const emptyCopy =
    tab === 'comments' ? 'No comments yet.' : tab === 'history' ? 'No status history yet.' : 'No activity yet.'

  return (
    <section className="space-y-4 border-t border-border pt-4">
      <h4 className="text-sm font-bold text-fg">Activity</h4>
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1">
          {TABS.map((item) => {
            const selected = tab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-1 text-sm transition-colors ${
                  selected ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:text-fg'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => setNewestFirst((value) => !value)}
          className="rounded-lg p-1.5 text-muted hover:bg-chrome hover:text-fg"
          title={newestFirst ? 'Newest first' : 'Oldest first'}
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
        {items.length === 0 && <p className="py-6 text-center text-xs text-muted">{emptyCopy}</p>}
        {items.map((entry) => (
          <article key={entry.id} className="flex gap-3">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
              {initialOf(entry.actorName)}
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="text-sm text-fg">
                <span className="font-semibold">{entry.actorName || 'Employee'}</span>
                {entry.actorRole === 'admin' ? (
                  <span className="ml-1.5 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                    Admin
                  </span>
                ) : null}{' '}
                {entry.kind === 'comment' ? 'commented' : entry.action || 'updated the task'}
                {entry.context && entry.context !== 'Task' ? (
                  <span className="text-muted"> on {entry.context}</span>
                ) : null}
              </p>
              <p className="text-xs text-muted">{formatRelativeTime(entry.createdAt, nowMs)}</p>
              {entry.kind === 'history' && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-fg">
                  <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-[11px] text-muted">
                    History
                  </span>
                  <span>{entry.fromLabel || 'None'}</span>
                  <span className="text-muted">→</span>
                  <span>{entry.toLabel || 'None'}</span>
                </div>
              )}
              {entry.kind === 'comment' && entry.body && (
                <p className="whitespace-pre-wrap text-sm text-fg">{entry.body}</p>
              )}
            </div>
          </article>
        ))}
      </div>

      {tab !== 'history' && (
        <form onSubmit={submitReply} className="space-y-1.5">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={2}
              placeholder="Reply with the correction for this employee..."
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }}
              className="min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={!draft.trim() || sending}
              className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {sending ? 'Sending' : 'Reply'}
            </button>
          </div>
          <p className="text-[11px] text-muted">The employee sees this reply on the task activity board.</p>
        </form>
      )}
    </section>
  )
}
