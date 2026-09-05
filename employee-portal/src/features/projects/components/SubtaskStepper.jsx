import React, { useState, useEffect } from 'react'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { useProjectStore } from '../stores/projectStore'
import { useUserStore } from '../../../stores/userStore'
import { getTimerElapsedMs, formatElapsed } from '../services/projectService'
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
} from 'lucide-react'

const SUBTASK_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

const INPUT_CLASS =
  'w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600'

const getPriorityBadgeVariant = (priority) => {
  if (priority === 'high') return 'danger'
  if (priority === 'low') return 'neutral'
  return 'warning'
}

export const SubtaskStepper = ({ taskId, subtasks = [], compact = false }) => {
  const {
    addSubtask,
    updateSubtask,
    toggleSubtask,
    deleteSubtask,
    pauseSubtaskTimer,
    resumeSubtaskTimer,
  } = useProjectStore()
  const { user, userDoc } = useUserStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPriority, setEditPriority] = useState('medium')
  const [nowTick, setNowTick] = useState(Date.now())

  const totalCount = subtasks.length
  const completedCount = subtasks.filter((st) => st.isCompleted).length
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
    const elapsed = formatElapsed(getTimerElapsedMs(st))
    if (st?.timerStatus === 'paused') return `Paused · ${elapsed}`
    return elapsed
  }

  const handleAddSubtaskSubmit = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const creatorName =
      userDoc?.displayName || user?.displayName || userDoc?.email || user?.email || 'Employee'
    const creatorId = userDoc?.uid || user?.uid || null
    const creatorEmail = userDoc?.email || user?.email || null

    if (addSubtask) {
      addSubtask(taskId, {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        priority: newPriority || 'medium',
        createdBy: creatorId,
        createdByEmail: creatorEmail,
        createdByName: creatorName,
      })
    }

    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setShowAddForm(false)
  }

  const handleCancel = () => {
    setNewTitle('')
    setNewDesc('')
    setNewPriority('medium')
    setShowAddForm(false)
  }

  const startEdit = (st) => {
    setShowAddForm(false)
    setEditingId(st.id)
    setEditTitle(st.title || '')
    setEditDesc(st.description || '')
    setEditPriority(st.priority || 'medium')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
    setEditDesc('')
    setEditPriority('medium')
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    if (!editTitle.trim() || !editingId || !updateSubtask) return

    updateSubtask(taskId, editingId, {
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      priority: editPriority || 'medium',
    })
    cancelEdit()
  }

  // Compact View for Kanban Cards
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
      {/* Header & Subtask Progress Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-accent" /> Subtask Checklist
            </h4>
            {totalCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-chrome text-fg font-semibold border border-border">
                {completedCount}/{totalCount} Completed
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-48 bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  isAllCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-accent to-emerald-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-muted">
              {progressPercent}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              cancelEdit()
              setShowAddForm(!showAddForm)
            }}
            icon={Plus}
          >
            Add Subtask
          </Button>
        </div>
      </div>

      {/* Completion Celebration Banner */}
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

      {/* Add Subtask Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubtaskSubmit}
          className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-border space-y-3"
        >
          <div className="text-xs font-bold text-fg flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-accent" /> Create New Subtask
          </div>

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
              <span className="text-slate-400 dark:text-slate-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
            </label>
            <textarea
              placeholder="Add details, context, or acceptance criteria..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
              <Flag className="w-3 h-3" />
              Priority
            </label>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className={`${INPUT_CLASS} cursor-pointer`}
            >
              {SUBTASK_PRIORITIES.map((p) => (
                <option
                  key={p.value}
                  value={p.value}
                  className="bg-surface text-fg"
                >
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-muted flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-accent" />
            Timer starts automatically when the subtask is created.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary">
              Save Subtask
            </Button>
          </div>
        </form>
      )}

      {/* Step-by-Step Vertical List */}
      {totalCount === 0 ? (
        <div className="text-center py-6 border border-dashed border-border rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
          <p className="text-xs text-muted">
            No subtasks added yet. Click &quot;Add Subtask&quot; to create one.
          </p>
        </div>
      ) : (
        <div className="relative pl-7 space-y-4 my-2">
          <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-slate-200 dark:bg-slate-800 pointer-events-none" />

          {subtasks.map((st, index) => {
            const isCompleted = st.isCompleted
            const isLast = index === subtasks.length - 1
            const isEditing = editingId === st.id

            return (
              <div key={st.id} className="relative flex items-start justify-between group py-1">
                {isCompleted && !isLast && (
                  <div className="absolute left-[-15px] top-[14px] w-[2px] h-[calc(100%+16px)] bg-emerald-500 dark:bg-emerald-400 transition-all duration-500 z-0" />
                )}

                <button
                  type="button"
                  onClick={() => !isEditing && toggleSubtask && toggleSubtask(taskId, st.id)}
                  title={isCompleted ? 'Click to mark incomplete' : 'Click to complete subtask'}
                  disabled={isEditing}
                  className={`absolute -left-7 top-0.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isEditing ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105 hover:scale-110'
                      : 'bg-surface border-2 border-border text-slate-400 hover:border-emerald-500 hover:text-emerald-500 hover:scale-110'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 transition-colors group-hover:bg-emerald-500" />
                  )}
                </button>

                {isEditing ? (
                  <form
                    onSubmit={handleEditSubmit}
                    className="flex-1 ml-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-accent/20 dark:border-accent/30 space-y-2.5"
                  >
                    <div className="text-[11px] font-bold text-fg flex items-center gap-1.5">
                      <Pencil className="w-3 h-3 text-accent" /> Edit Subtask
                    </div>
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
                      rows={2}
                      className={`${INPUT_CLASS} resize-none`}
                      placeholder="Description (optional)..."
                    />
                    <select
                      value={editPriority}
                      onChange={(e) => setEditPriority(e.target.value)}
                      className={`${INPUT_CLASS} cursor-pointer`}
                    >
                      {SUBTASK_PRIORITIES.map((p) => (
                        <option
                          key={p.value}
                          value={p.value}
                          className="bg-surface text-fg"
                        >
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-end gap-2 pt-0.5">
                      <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" variant="primary">
                        Save Changes
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className={`flex-1 ml-3 transition-all ${isCompleted ? 'opacity-60' : ''}`}>
                      <h5
                        onClick={() => toggleSubtask && toggleSubtask(taskId, st.id)}
                        className={`text-sm font-semibold transition-colors leading-snug cursor-pointer ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-fg hover:text-accent'
                        }`}
                      >
                        {st.title}
                      </h5>

                      {st.description && (
                        <p
                          className={`text-[11px] mt-0.5 leading-relaxed flex items-start gap-1 ${
                            isCompleted
                              ? 'text-slate-400 dark:text-slate-600'
                              : 'text-muted'
                          }`}
                        >
                          <AlignLeft className="w-3 h-3 mt-0.5 shrink-0 text-slate-400 dark:text-slate-600" />
                          {st.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {st.priority && (
                          <Badge
                            variant={getPriorityBadgeVariant(st.priority)}
                            className="!text-[10px] !px-1.5 !py-0.5 capitalize"
                          >
                            {st.priority}
                          </Badge>
                        )}
                        {st.createdByName && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-chrome text-muted border border-border">
                            <User className="w-2.5 h-2.5" />
                            {st.createdByName}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                            isCompleted || st.timerStatus === 'stopped'
                              ? 'bg-chrome/50 text-slate-400 dark:text-slate-600'
                              : st.timerStatus === 'paused'
                                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                : 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/20'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {formatSubtaskTimer(st)}
                        </span>

                        {!isCompleted && st.timerStatus === 'running' && (
                          <button
                            type="button"
                            onClick={() => pauseSubtaskTimer(taskId, st.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-chrome text-muted hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 transition-colors"
                            title="Pause timer"
                          >
                            <Pause className="w-2.5 h-2.5" /> Pause
                          </button>
                        )}
                        {!isCompleted && st.timerStatus === 'paused' && (
                          <button
                            type="button"
                            onClick={() => resumeSubtaskTimer(taskId, st.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-soft text-accent hover:bg-accent-soft dark:hover:bg-accent-hover/20 transition-colors"
                            title="Resume timer"
                          >
                            <Play className="w-2.5 h-2.5" /> Resume
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-0.5 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      {updateSubtask && (
                        <button
                          type="button"
                          onClick={() => startEdit(st)}
                          title="Edit subtask"
                          className="p-1.5 text-slate-400 hover:text-accent hover:bg-chrome rounded-lg"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {deleteSubtask && (
                        <button
                          type="button"
                          onClick={() => deleteSubtask(taskId, st.id)}
                          title="Delete subtask"
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-chrome rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
