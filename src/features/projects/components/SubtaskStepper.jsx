import React, { useState } from 'react'
import { Badge } from '../../../shared/components/ui/Badge'
import { Button } from '../../../shared/components/ui/Button'
import { useProjectStore } from '../stores/projectStore'
import {
  Plus,
  Trash2,
  Sparkles,
  Check,
  Award,
  Layers,
  Clock,
  AlignLeft,
} from 'lucide-react'

export const SubtaskStepper = ({ taskId, subtasks = [], compact = false }) => {
  const { addSubtask, toggleSubtask, deleteSubtask, autoDecomposeTask } = useProjectStore()

  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newTime, setNewTime] = useState('')

  const totalCount = subtasks.length
  const completedCount = subtasks.filter((st) => st.isCompleted).length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const isAllCompleted = totalCount > 0 && completedCount === totalCount

  const handleAddSubtaskSubmit = (e) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    if (addSubtask) {
      addSubtask(taskId, {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        estimatedTime: newTime ? Number(newTime) : null,
      })
    }

    setNewTitle('')
    setNewDesc('')
    setNewTime('')
    setShowAddForm(false)
  }

  const handleCancel = () => {
    setNewTitle('')
    setNewDesc('')
    setNewTime('')
    setShowAddForm(false)
  }

  // Compact View for Kanban Cards
  if (compact) {
    if (totalCount === 0) return null
    return (
      <div className="space-y-1.5 pt-1.5 border-t border-border/60">
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
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-canvas text-fg font-semibold border border-slate-200 dark:border-slate-700">
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
          {totalCount === 0 && autoDecomposeTask && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => autoDecomposeTask(taskId)}
              className="text-xs text-accent bg-accent-soft hover:bg-accent-soft border-accent/30 "
              icon={Sparkles}
            >
              AI Auto-Breakdown
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowAddForm(!showAddForm)}
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
          className="p-4 rounded-2xl bg-canvas/60 border border-border space-y-3"
        >
          <div className="text-xs font-bold text-fg flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-accent" /> Create New Subtask
          </div>

          {/* Title — required */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Subtask title (e.g. Code Review, Testing)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted"
              autoFocus
              required
            />
          </div>

          {/* Description — optional */}
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
              className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted resize-none"
            />
          </div>

          {/* Estimated Time — optional */}
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Estimated Time
              <span className="text-slate-400 dark:text-slate-600 font-normal normal-case tracking-normal ml-1">(optional)</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                min="0.25"
                max="99"
                step="0.25"
                placeholder="0"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl pl-3 pr-14 py-2 text-xs text-fg focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all placeholder:text-muted"
              />
              <span className="absolute right-3 text-[10px] font-semibold text-slate-400 dark:text-slate-600 pointer-events-none">
                hrs
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleCancel}
            >
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
            No subtasks added yet. Click "Add Subtask" or use AI Auto-Breakdown.
          </p>
        </div>
      ) : (
        <div className="relative pl-7 space-y-4 my-2">
          {/* Continuous Vertical Connecting Line */}
          <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-slate-200 dark:bg-slate-800 pointer-events-none" />

          {subtasks.map((st, index) => {
            const isCompleted = st.isCompleted
            const isLast = index === subtasks.length - 1

            return (
              <div key={st.id} className="relative flex items-start justify-between group py-1">
                {/* Active Connected Progress Line Segment */}
                {isCompleted && !isLast && (
                  <div
                    className="absolute left-[-15px] top-[14px] w-[2px] h-[calc(100%+16px)] bg-emerald-500 dark:bg-emerald-400 transition-all duration-500 z-0"
                  />
                )}

                {/* Clickable Circle Icon Node */}
                <button
                  type="button"
                  onClick={() => toggleSubtask && toggleSubtask(taskId, st.id)}
                  title={isCompleted ? 'Click to mark incomplete' : 'Click to complete subtask'}
                  className={`absolute -left-7 top-0.5 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
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

                {/* Subtask Content */}
                <div
                  onClick={() => toggleSubtask && toggleSubtask(taskId, st.id)}
                  className={`flex-1 ml-3 cursor-pointer transition-all ${
                    isCompleted ? 'opacity-60' : ''
                  }`}
                >
                  <h5
                    className={`text-sm font-semibold transition-colors leading-snug ${
                      isCompleted
                        ? 'line-through text-muted'
                        : 'text-fg hover:text-accent dark:hover:text-accent'
                    }`}
                  >
                    {st.title}
                  </h5>

                  {/* Optional Description */}
                  {st.description && (
                    <p className={`text-[11px] mt-0.5 leading-relaxed flex items-start gap-1 ${
                      isCompleted ? 'text-slate-400 dark:text-slate-600' : 'text-muted'
                    }`}>
                      <AlignLeft className="w-3 h-3 mt-0.5 shrink-0 text-slate-400 dark:text-slate-600" />
                      {st.description}
                    </p>
                  )}

                  {/* Optional Estimated Time */}
                  {st.estimatedTime && (
                    <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isCompleted
                        ? 'bg-canvas/50 text-slate-400 dark:text-slate-600'
                        : 'bg-info-soft text-info border border-blue-200 dark:border-blue-500/20'
                    }`}>
                      <Clock className="w-2.5 h-2.5" />
                      {st.estimatedTime}h
                    </span>
                  )}
                </div>

                {/* Delete Action Button */}
                {deleteSubtask && (
                  <button
                    type="button"
                    onClick={() => deleteSubtask(taskId, st.id)}
                    title="Delete subtask"
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all rounded-lg mt-0.5 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
