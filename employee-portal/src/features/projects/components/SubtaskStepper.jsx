import React, { useMemo, useState, useEffect, useRef } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { NativePickerInput } from '../../../components/ui/Input'
import { useProjectStore } from '../stores/projectStore'
import { useUserStore } from '../../../stores/userStore'
import { useTeamStore } from '../../team/stores/teamStore'
import { getAttendanceGatedElapsedMs, formatElapsed, isEmployeeActivelyWorking, DEFAULT_TASK_STATUSES } from '../services/projectService'
import {
  Plus,
  Trash2,
  Check,
  Award,
  Layers,
  Clock,
  AlignLeft,
  Pause,
  Play,
  User,
  Flag,
  Pencil,
  Calendar,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  CircleDot,
  MessageSquare,
} from 'lucide-react'
import { formatRelativeTime } from '../services/taskActivity'

const SUBTASK_PRIORITIES = [
  { value: 'highest', label: 'Highest', color: '#DE350B' },
  { value: 'high', label: 'High', color: '#FF5630' },
  { value: 'medium', label: 'Medium', color: '#FF8B00' },
  { value: 'low', label: 'Low', color: '#2684FF' },
  { value: 'lowest', label: 'Lowest', color: '#0065FF' },
]

const INPUT_CLASS =
  'w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600'

const priorityMeta = (value) =>
  SUBTASK_PRIORITIES.find((item) => item.value === value) || SUBTASK_PRIORITIES[2]

const PriorityIcon = ({ level, className = 'w-3.5 h-3.5' }) => {
  const { color } = priorityMeta(level)
  if (level === 'medium') {
    return (
      <span className={`inline-flex flex-col justify-center gap-[2px] shrink-0 ${className}`} style={{ color }} aria-hidden>
        <span className="block h-[2px] w-full rounded-full bg-current" />
        <span className="block h-[2px] w-full rounded-full bg-current" />
      </span>
    )
  }
  const Icon =
    level === 'highest' ? ChevronsUp : level === 'high' ? ChevronUp : level === 'lowest' ? ChevronsDown : ChevronDown
  return <Icon className={`${className} shrink-0`} style={{ color }} strokeWidth={2.75} aria-hidden />
}

const PrioritySelect = ({ value, onChange }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const current = priorityMeta(value)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${INPUT_CLASS} flex items-center gap-2 text-left cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <PriorityIcon level={current.value} />
        <span className="flex-1">{current.label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface shadow-lg py-1" role="listbox">
          {SUBTASK_PRIORITIES.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={item.value === current.value}
              onClick={() => {
                onChange(item.value)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-chrome ${
                item.value === current.value ? 'bg-chrome' : ''
              }`}
            >
              <PriorityIcon level={item.value} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const STATUS_DOT_COLORS = {
  todo: 'bg-sky-500',
  blue: 'bg-sky-500',
  in_progress: 'bg-accent',
  indigo: 'bg-accent',
  in_review: 'bg-amber-500',
  amber: 'bg-amber-500',
  done: 'bg-emerald-500',
  emerald: 'bg-emerald-500',
  purple: 'bg-accent',
  rose: 'bg-rose-500',
}

const statusDotClass = (status) =>
  STATUS_DOT_COLORS[status?.id] || STATUS_DOT_COLORS[status?.color] || 'bg-sky-500'

const subtaskIsDone = (st) => Boolean(st?.isCompleted || st?.status === 'done')

const DEFAULT_STATUS_IDS = ['todo', 'in_progress', 'in_review', 'done']

const statusesForEmployee = (allStatuses, person, isAdmin) => {
  const list = allStatuses?.length ? allStatuses : DEFAULT_TASK_STATUSES
  if (isAdmin) return list
  return list.filter((status) => {
    if (DEFAULT_STATUS_IDS.includes(status.id)) return true
    const isAdminCreated =
      status.createdByRole === 'admin' ||
      status.createdByRole === 'owner' ||
      status.createdByRole === 'superadmin' ||
      status.isAdminCreated === true
    if (isAdminCreated) return true
    if (!person) return false
    const byId = status.createdBy && person.id && String(status.createdBy) === String(person.id)
    const byEmail =
      status.createdByEmail &&
      person.email &&
      String(status.createdByEmail).toLowerCase() === String(person.email).toLowerCase()
    return Boolean(byId || byEmail)
  })
}

const StatusSelect = ({ value, onChange, statuses }) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const options = statuses?.length ? statuses : DEFAULT_TASK_STATUSES
  const current = options.find((item) => item.id === value) || options[0]

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${INPUT_CLASS} flex items-center gap-2 text-left cursor-pointer`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(current)}`} />
        <span className="flex-1 truncate">{current?.name || 'To Do'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-border bg-surface shadow-lg py-1" role="listbox">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === current?.id}
              onClick={() => {
                onChange(item.id)
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-chrome ${
                item.id === current?.id ? 'bg-chrome' : ''
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusDotClass(item)}`} />
              {item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const formatSubtaskDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const DetailFields = ({
  priority,
  setPriority,
  assigneeId,
  setAssigneeId,
  startDate,
  setStartDate,
  dueDate,
  setDueDate,
  status,
  setStatus,
  statuses,
  assigneeOptions,
}) => (
  <div className="h-full rounded-xl border border-border bg-surface/40 p-3 space-y-3">
    <div className="text-[11px] font-bold text-fg uppercase tracking-wide">Details</div>
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <CircleDot className="w-3 h-3" />
        Status
      </label>
      <StatusSelect value={status} onChange={setStatus} statuses={statuses} />
    </div>
    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <Flag className="w-3 h-3" />
        Priority
      </label>
      <PrioritySelect value={priority} onChange={setPriority} />
    </div>

    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <User className="w-3 h-3" />
        Assignee
      </label>
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className={`${INPUT_CLASS} cursor-pointer`}
      >
        <option value="" className="bg-surface text-fg">
          Unassigned
        </option>
        {assigneeOptions.map((person) => (
          <option key={person.id} value={person.id} className="bg-surface text-fg">
            {person.name}
          </option>
        ))}
      </select>
    </div>

    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        Start date
      </label>
      <NativePickerInput
        type="date"
        value={startDate}
        max={dueDate || undefined}
        onChange={(e) => setStartDate(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>

    <div className="space-y-1">
      <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        Due date
      </label>
      <NativePickerInput
        type="date"
        value={dueDate}
        min={startDate || undefined}
        onChange={(e) => setDueDate(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  </div>
)

const commentInitial = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase()

const SubtaskComments = ({ taskId, subtaskId, comments = [] }) => {
  const addSubtaskComment = useProjectStore((state) => state.addSubtaskComment)
  const [draft, setDraft] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  const items = [...comments].sort(
    (a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0)
  )

  const submit = (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    addSubtaskComment(taskId, subtaskId, text)
    setDraft('')
  }

  return (
    <section className="space-y-4 border-t border-border pt-5">
      <h4 className="text-sm font-bold text-fg">Activity</h4>
      <div className="inline-flex items-center rounded-xl border border-border bg-surface p-1">
        <span className="rounded-lg border border-sky-500 px-3 py-1 text-sm font-medium text-sky-600">
          Comments
        </span>
      </div>
      <div className="max-h-72 space-y-5 overflow-y-auto pr-1">
        {items.length === 0 && <p className="py-6 text-center text-xs text-muted">No comments yet.</p>}
        {items.map((entry) => (
          <article key={entry.id} className="flex gap-3">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
              {commentInitial(entry.actorName)}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-fg">
                <span className="font-semibold">{entry.actorName || 'Employee'}</span> commented
              </p>
              <p className="text-xs text-muted">{formatRelativeTime(entry.createdAt, nowMs)}</p>
              {entry.body && <p className="whitespace-pre-wrap text-sm text-fg">{entry.body}</p>}
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          placeholder="Write a comment on this subtask..."
          className="min-h-[42px] flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
        >
          Comment
        </button>
      </form>
    </section>
  )
}

export const SubtaskStepper = ({
  taskId,
  subtasks = [],
  compact = false,
  onActiveSubtaskChange,
  onCommentSubtask,
}) => {
  const {
    addSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    pauseSubtaskTimer,
    resumeSubtaskTimer,
    statuses,
  } = useProjectStore()
  const { user, userDoc } = useUserStore()
  const employees = useTeamStore((s) => s.employees)
  const clockedIn = useTeamStore((s) => s.clockedIn)
  const isOnBreak = useTeamStore((s) => s.isOnBreak)
  const isOnLunch = useTeamStore((s) => s.isOnLunch)

  const currentUserId = userDoc?.uid || user?.uid || ''
  const currentUserName =
    userDoc?.displayName || user?.displayName || userDoc?.email || user?.email || 'Employee'
  const currentUserEmail = userDoc?.email || user?.email || ''
  const userRole = userDoc?.role || user?.role || ''
  const isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin'

  const employeeForAssignee = (assigneeId) => {
    const match = assigneeOptions.find((person) => person.id === assigneeId)
    if (match) return match
    if (assigneeId && String(assigneeId) === String(currentUserId)) {
      return { id: currentUserId, email: currentUserEmail }
    }
    return { id: currentUserId, email: currentUserEmail }
  }

  const assigneeOptions = useMemo(() => {
    const list = (employees || [])
      .map((emp) => ({
        id: emp.uid || emp.employeeId || '',
        name: emp.displayName || emp.name || emp.email || 'Employee',
        email: emp.email || '',
      }))
      .filter((person) => person.id)

    if (currentUserId && !list.some((person) => person.id === currentUserId)) {
      list.unshift({ id: currentUserId, name: currentUserName, email: currentUserEmail })
    }
    subtasks.forEach((st) => {
      if (st.assigneeId && !list.some((person) => person.id === st.assigneeId)) {
        list.push({
          id: st.assigneeId,
          name: st.assigneeName || 'Assignee',
          email: st.assigneeEmail || '',
        })
      }
    })
    return list
  }, [employees, subtasks, currentUserId, currentUserName, currentUserEmail])

  const resolveAssignee = (assigneeId) => {
    if (!assigneeId) {
      return { assigneeId: null, assigneeName: null, assigneeEmail: null }
    }
    const person = assigneeOptions.find((option) => option.id === assigneeId)
    return {
      assigneeId,
      assigneeName: person?.name || null,
      assigneeEmail: person?.email || null,
    }
  }

  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssigneeId, setNewAssigneeId] = useState(currentUserId)
  const [newStartDate, setNewStartDate] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newStatus, setNewStatus] = useState('todo')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [editAssigneeId, setEditAssigneeId] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editStatus, setEditStatus] = useState('todo')
  const [nowTick, setNowTick] = useState(Date.now())
  const [pendingDelete, setPendingDelete] = useState(null)

  const totalCount = subtasks.length
  const completedCount = subtasks.filter((st) => subtaskIsDone(st)).length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isAllCompleted = totalCount > 0 && completedCount === totalCount

  useEffect(() => {
    const hasRunning = subtasks.some((st) => st.timerStatus === 'running')
    if (!hasRunning) return undefined
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [subtasks])

  const formatSubtaskTimer = (st) => {
    void nowTick
    const status = st.status || (st.isCompleted ? 'done' : 'todo')
    const attendance = { clockedIn, isOnBreak, isOnLunch }
    if (status === 'todo') {
      return formatElapsed(Number(st.timerAccumulatedMs) || 0)
    }
    const elapsed = formatElapsed(getAttendanceGatedElapsedMs(st, attendance))
    if (status === 'done' || st.isCompleted) return elapsed
    const offDutyRunning =
      st?.timerStatus === 'running' && !isEmployeeActivelyWorking(attendance)
    if (st?.timerStatus === 'paused' || offDutyRunning) return `Paused · ${elapsed}`
    return elapsed
  }

  const resetAddForm = () => {
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setNewAssigneeId(currentUserId)
    setNewStartDate('')
    setNewDueDate('')
    setNewStatus('todo')
    setShowAddForm(false)
  }

  const handleAddSubtaskSubmit = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    if (addSubtask) {
      addSubtask(taskId, {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority || 'medium',
        ...resolveAssignee(newAssigneeId),
        startDate: newStartDate || null,
        dueDate: newDueDate || null,
        status: newStatus || 'todo',
        createdBy: currentUserId || null,
        createdByEmail: currentUserEmail || null,
        createdByName: currentUserName,
      })
    }

    resetAddForm()
  }

  const startEdit = (st) => {
    setShowAddForm(false)
    setEditingId(st.id)
    setEditTitle(st.title || '')
    setEditDesc(st.description || '')
    setEditPriority(st.priority || 'medium')
    setEditAssigneeId(st.assigneeId || '')
    setEditStartDate(st.startDate ? String(st.startDate).slice(0, 10) : '')
    setEditDueDate(st.dueDate ? String(st.dueDate).slice(0, 10) : '')
    setEditStatus(st.status || (st.isCompleted ? 'done' : 'todo'))
    onActiveSubtaskChange?.(st.id)
  }

  const cancelEdit = () => {
    setEditingId(null)
    onActiveSubtaskChange?.(null)
    setEditTitle('')
    setEditDesc('')
    setEditPriority('medium')
    setEditAssigneeId('')
    setEditStartDate('')
    setEditDueDate('')
    setEditStatus('todo')
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    if (!editTitle.trim() || !editingId || !updateSubtask) return

    updateSubtask(taskId, editingId, {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      priority: editPriority || 'medium',
      ...resolveAssignee(editAssigneeId),
      startDate: editStartDate || null,
      dueDate: editDueDate || null,
      status: editStatus || 'todo',
    })
    cancelEdit()
  }

  if (compact) {
    if (totalCount === 0) return null
    return (
      <div className="space-y-1.5 pt-1.5 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1 font-semibold">
            <Layers className="w-3 h-3 text-accent" /> Subtasks
          </span>
          <span className="font-mono">
            {completedCount}/{totalCount} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isAllCompleted ? 'bg-emerald-500' : 'bg-accent'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 pb-3 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent" /> Subtasks
            </h4>
            {totalCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-chrome text-fg font-semibold border border-border">
                {completedCount}/{totalCount} · {progressPercent}%
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              cancelEdit()
              if (showAddForm) resetAddForm()
              else {
                setNewAssigneeId(currentUserId)
                setShowAddForm(true)
              }
            }}
            icon={Plus}
          >
            Add Subtask
          </Button>
        </div>
        <div
          className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label="Subtasks done"
        >
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isAllCompleted ? 'bg-emerald-500' : 'bg-accent'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {isAllCompleted && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">All Subtasks Completed!</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-normal">
                Great job! All subtasks in this task are finished.
              </p>
            </div>
          </div>
          <Badge variant="success">Task Complete</Badge>
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddSubtaskSubmit}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            resetAddForm()
          }}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-border space-y-3 animate-fadeIn"
        >
          <div className="text-xs font-bold text-fg flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-accent" /> Create New Subtask
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-4">
            <div className="space-y-3 min-w-0">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Subtask title (e.g. Code Review, Testing)..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className={INPUT_CLASS}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
                  <AlignLeft className="w-3 h-3" />
                  Description
                  <span className="text-slate-400 dark:text-slate-600 font-normal normal-case tracking-normal ml-1">
                    (optional)
                  </span>
                </label>
                <textarea
                  placeholder="Add details, context, or acceptance criteria..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={6}
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>

              <p className="text-[11px] text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                Time stays off while the status is To Do. It starts on any other status and stops when Done.
              </p>
            </div>

            <DetailFields
              priority={newPriority}
              setPriority={setNewPriority}
              assigneeId={newAssigneeId}
              setAssigneeId={setNewAssigneeId}
              startDate={newStartDate}
              setStartDate={setNewStartDate}
              dueDate={newDueDate}
              setDueDate={setNewDueDate}
              status={newStatus}
              setStatus={setNewStatus}
              statuses={statusesForEmployee(statuses, employeeForAssignee(newAssigneeId), isAdmin)}
              assigneeOptions={assigneeOptions}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={resetAddForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save Subtask
            </Button>
          </div>
        </form>
      )}

      {totalCount === 0 ? (
        !showAddForm && (
          <div className="text-center py-8 border border-dashed border-border rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
            <Layers className="w-5 h-5 mx-auto text-muted" />
            <p className="text-xs text-muted mt-2">No subtasks added yet.</p>
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="mt-3"
              icon={Plus}
              onClick={() => {
                setNewAssigneeId(currentUserId)
                setShowAddForm(true)
              }}
            >
              Add your first subtask
            </Button>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-chrome text-muted border-b border-border">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Work</th>
                <th className="px-5 py-3.5 font-semibold w-36">Priority</th>
                <th className="px-5 py-3.5 font-semibold w-48">Assignee</th>
                <th className="px-5 py-3.5 font-semibold w-40 hidden lg:table-cell">Start date</th>
                <th className="px-5 py-3.5 font-semibold w-40">Due date</th>
                <th className="px-5 py-3.5 font-semibold w-48">Status</th>
                <th className="px-3 py-3.5 w-28"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {subtasks.map((st) => {
                const isCompleted = subtaskIsDone(st)
                const isEditing = editingId === st.id
                const startLabel = formatSubtaskDate(st.startDate)
                const dueLabel = formatSubtaskDate(st.dueDate)

                if (isEditing) {
                  return (
                    <tr key={st.id} className="border-b border-border last:border-b-0">
                      <td colSpan={7} className="p-3">
                        <form onSubmit={handleEditSubmit} className="space-y-2.5">
                          <div className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                            <Pencil className="w-3 h-3 text-accent" /> Edit Subtask
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px] gap-4">
                            <div className="space-y-2.5 min-w-0">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className={INPUT_CLASS}
                                autoFocus
                                required
                                placeholder="Subtask title..."
                              />
                              <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                rows={6}
                                className={`${INPUT_CLASS} resize-none`}
                                placeholder="Description (optional)..."
                              />
                            </div>
                            <DetailFields
                              priority={editPriority}
                              setPriority={setEditPriority}
                              assigneeId={editAssigneeId}
                              setAssigneeId={setEditAssigneeId}
                              startDate={editStartDate}
                              setStartDate={setEditStartDate}
                              dueDate={editDueDate}
                              setDueDate={setEditDueDate}
                              status={editStatus}
                              setStatus={setEditStatus}
                              statuses={statusesForEmployee(statuses, employeeForAssignee(editAssigneeId), isAdmin)}
                              assigneeOptions={assigneeOptions}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-0.5">
                            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                              Cancel
                            </Button>
                            <Button type="submit" size="sm" variant="primary">
                              Save Changes
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )
                }

                const comments = Array.isArray(st.comments) ? st.comments : []

                return (
                  <tr
                    key={st.id}
                    className="border-b border-border last:border-b-0 hover:bg-chrome/40"
                  >
                    <td className="px-5 py-4 align-top">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (toggleSubtask) toggleSubtask(taskId, st.id)
                          }}
                          title={isCompleted ? 'Click to mark incomplete' : 'Click to complete subtask'}
                          className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-border bg-surface text-transparent hover:border-emerald-500'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(st)}
                              title="Open subtask details"
                              className={`text-left font-semibold leading-snug cursor-pointer hover:text-accent ${
                                isCompleted ? 'line-through text-muted' : 'text-fg'
                              }`}
                            >
                              {st.title}
                            </button>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  isCompleted || st.timerStatus === 'stopped'
                                    ? 'bg-chrome text-slate-400'
                                    : st.timerStatus === 'paused'
                                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                      : 'bg-accent-soft text-accent border border-accent/20'
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {formatSubtaskTimer(st)}
                              </span>
                              {!isCompleted && (st.status || 'todo') !== 'todo' && st.timerStatus === 'running' && (
                                <button
                                  type="button"
                                  onClick={() => pauseSubtaskTimer(taskId, st.id)}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-chrome text-muted hover:text-amber-600"
                                  title="Pause timer"
                                >
                                  <Pause className="w-2.5 h-2.5" /> Pause
                                </button>
                              )}
                              {!isCompleted && (st.status || 'todo') !== 'todo' && st.timerStatus === 'paused' && (
                                <button
                                  type="button"
                                  onClick={() => resumeSubtaskTimer(taskId, st.id)}
                                  disabled={!isEmployeeActivelyWorking({ clockedIn, isOnBreak, isOnLunch })}
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-soft text-accent disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={
                                    isEmployeeActivelyWorking({ clockedIn, isOnBreak, isOnLunch })
                                      ? 'Resume timer'
                                      : 'Clock in to resume the timer'
                                  }
                                >
                                  <Play className="w-2.5 h-2.5" /> Resume
                                </button>
                              )}
                            </div>
                          </div>
                          {st.description && (
                            <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{st.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="inline-flex items-center gap-1.5 text-fg">
                        <PriorityIcon level={st.priority || 'medium'} />
                        {priorityMeta(st.priority).label}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top">
                      {st.assigneeName ? (
                        <span className="inline-flex items-center gap-1 text-fg">
                          <User className="w-3 h-3 text-muted shrink-0" />
                          <span className="truncate">{st.assigneeName}</span>
                        </span>
                      ) : (
                        <span className="text-muted">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top whitespace-nowrap hidden lg:table-cell">
                      {startLabel ? (
                        <span className="text-fg">{startLabel}</span>
                      ) : (
                        <span className="text-muted">Add date</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top whitespace-nowrap">
                      {dueLabel ? (
                        <span className="text-fg">{dueLabel}</span>
                      ) : (
                        <span className="text-muted">Add date</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top" onClick={(event) => event.stopPropagation()}>
                      <StatusSelect
                        value={st.status || (st.isCompleted ? 'done' : 'todo')}
                        statuses={statusesForEmployee(statuses, employeeForAssignee(st.assigneeId), isAdmin)}
                        onChange={(next) => updateSubtask && updateSubtask(taskId, st.id, { status: next })}
                      />
                    </td>
                    <td className="px-2 py-2 align-top" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onCommentSubtask?.(st)}
                          title="Subtask comments"
                          className="relative p-1.5 rounded-lg text-slate-400 hover:text-accent hover:bg-chrome cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {comments.length > 0 && (
                            <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full bg-accent px-1 text-[9px] font-bold leading-none text-white">
                              {comments.length}
                            </span>
                          )}
                        </button>
                        {updateSubtask && (
                          <button
                            type="button"
                            onClick={() => startEdit(st)}
                            title="Edit subtask"
                            className="p-1.5 text-slate-400 hover:text-accent hover:bg-chrome rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {deleteSubtask && (
                          <button
                            type="button"
                            onClick={() => setPendingDelete(st)}
                            title="Delete subtask"
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-chrome rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPendingDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-subtask-title"
            className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-subtask-title" className="text-sm font-bold text-fg flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-500" />
              Delete subtask
            </h3>
            <p className="mt-3 text-xs text-muted leading-relaxed">
              Are you sure you want to delete <strong className="text-fg">{pendingDelete.title}</strong>? This action cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteSubtask(taskId, pendingDelete.id)
                  if (editingId === pendingDelete.id) cancelEdit()
                  setPendingDelete(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
