import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useProjectStore } from '../stores/projectStore'
import { formatRelativeTime } from '../services/taskActivity'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'comments', label: 'Comments' },
  { id: 'history', label: 'History' },
]

const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase()

const PersonMark = ({ name }) => (
  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
    {initialOf(name)}
  </span>
)

const ChangeValue = ({ label, withAvatar }) => {
  const showAvatar = withAvatar && label && label !== 'Unassigned' && label !== 'None'
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-fg">
      {showAvatar && <PersonMark name={label} />}
      <span>{label || 'None'}</span>
    </span>
  )
}

export const TaskActivity = ({ taskId, activity = [], subtask = null, focusRequest = 0 }) => {
  const addTaskComment = useProjectStore((state) => state.addTaskComment)
  const addSubtaskComment = useProjectStore((state) => state.addSubtaskComment)
  const sectionRef = useRef(null)
  const inputRef = useRef(null)
  const [tab, setTab] = useState('all')
  const [newestFirst, setNewestFirst] = useState(true)
  const [draft, setDraft] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!focusRequest) return
    setTab('comments')
  }, [focusRequest])

  useEffect(() => {
    if (!focusRequest || tab === 'history') return
    const frame = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      inputRef.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [focusRequest, tab])

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const scoped = useMemo(() => {
    if (subtask?.id) {
      const comments = (Array.isArray(subtask.comments) ? subtask.comments : []).map((entry) => ({
        ...entry,
        kind: 'comment',
        subtaskId: subtask.id,
      }))
      const history = (activity || []).filter(
        (entry) => entry.kind === 'history' && entry.subtaskId === subtask.id
      )
      return [...comments, ...history]
    }
    return (activity || []).filter((entry) => !entry.subtaskId)
  }, [activity, subtask])

  const items = useMemo(() => {
    const filtered = scoped.filter((entry) => {
      if (tab === 'comments') return entry.kind === 'comment'
      if (tab === 'history') return entry.kind === 'history'
      return entry.kind === 'comment' || entry.kind === 'history'
    })
    const sorted = [...filtered].sort((a, b) => {
      const left = new Date(a.createdAt).getTime() || 0
      const right = new Date(b.createdAt).getTime() || 0
      return newestFirst ? right - left : left - right
    })
    return sorted
  }, [scoped, tab, newestFirst])

  const submitComment = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !taskId) return
    if (subtask?.id) addSubtaskComment(taskId, subtask.id, text)
    else addTaskComment(taskId, text)
    setDraft('')
    if (tab === 'history') setTab('comments')
  }

  const emptyCopy =
    tab === 'comments' ? 'No comments yet.' : tab === 'history' ? 'No history yet.' : 'No activity yet.'

  return (
    <section ref={sectionRef} className="space-y-4 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-fg">
          Activity
          {subtask?.title ? <span className="ml-2 text-xs font-medium text-muted">{subtask.title}</span> : null}
        </h4>
      </div>

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
                  selected
                    ? 'bg-accent-soft font-medium text-accent'
                    : 'text-muted hover:text-fg'
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

      <div className="max-h-72 space-y-5 overflow-y-auto pr-1">
        {items.length === 0 && <p className="py-6 text-center text-xs text-muted">{emptyCopy}</p>}
        {items.map((entry) => (
          <article key={entry.id} className="flex gap-3">
            <PersonMark name={entry.actorName} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-sm text-fg">
                  <span className="font-semibold">{entry.actorName || 'Employee'}</span>{' '}
                  {entry.kind === 'comment' ? 'commented' : entry.action}
                </p>
              </div>
              <p className="text-xs text-muted">{formatRelativeTime(entry.createdAt, nowMs)}</p>
              {entry.kind === 'history' && (
                <span className="inline-flex rounded-md border border-border px-2 py-0.5 text-[11px] text-muted">
                  History
                </span>
              )}
              {entry.kind === 'comment' && entry.body && (
                <p className="whitespace-pre-wrap text-sm text-fg">{entry.body}</p>
              )}
              {entry.kind === 'history' && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <ChangeValue label={entry.fromLabel} withAvatar={entry.field === 'assignee'} />
                  <span className="text-muted">→</span>
                  <ChangeValue label={entry.toLabel} withAvatar={entry.field === 'assignee'} />
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {tab !== 'history' && (
        <form onSubmit={submitComment} className="space-y-1.5">
          <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder={subtask?.title ? 'Write a comment on this subtask...' : 'Write a comment on this task...'}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }}
            className="min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Comment
          </button>
          </div>
          <p className="text-[11px] text-muted">Ctrl+Enter to comment</p>
        </form>
      )}
    </section>
  )
}
