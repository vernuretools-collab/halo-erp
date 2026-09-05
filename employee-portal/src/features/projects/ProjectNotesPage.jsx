import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Check, Loader2, Minus, MoreHorizontal, Plus, StickyNote, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useProjectNotesStore } from './stores/projectNotesStore'
import { useUserStore } from '../../stores/userStore'

const PRIORITY_STYLES = {
  low: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40',
  medium: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
  high: 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-500/40',
}

const PRIORITY_OPTION_STYLE = { backgroundColor: '#ffffff', color: '#0f172a' }

const cellInput =
  'w-full bg-transparent border-0 text-xs text-fg placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0 py-1'

const STATUS_META = {
  green: {
    label: 'Done',
    className: 'bg-emerald-500 text-white',
    Icon: Check,
  },
  yellow: {
    label: 'In progress',
    className: 'bg-amber-400 text-white',
    Icon: MoreHorizontal,
  },
  red: {
    label: 'Not started',
    className: 'bg-rose-500 text-white',
    Icon: Minus,
  },
}

const StatusButton = ({ status, onClick }) => {
  const meta = STATUS_META[status] || STATUS_META.red
  const Icon = meta.Icon
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${meta.label} — click to change`}
      className={`mx-auto w-7 h-7 rounded-full flex items-center justify-center cursor-pointer shadow-sm ${meta.className}`}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={3} />
    </button>
  )
}

const ROW_TINT = {
  green: 'bg-emerald-50/80 dark:bg-emerald-500/10',
  yellow: 'bg-amber-50/70 dark:bg-amber-500/5',
  red: 'bg-surface',
}

export const ProjectNotesPage = ({
  projectId: projectIdProp,
  project: projectProp,
  hideTitle = false,
} = {}) => {
  const { projectId: routeProjectId } = useParams()
  const outlet = useOutletContext() || {}
  const project = projectProp || outlet.project
  const projectId = projectIdProp || outlet.projectId || routeProjectId

  const { user, userDoc } = useUserStore()
  const { notes, loading, fetchNotes, addNote, updateNote, removeNote, cycleStatus } =
    useProjectNotesStore()

  const [savingId, setSavingId] = useState(null)

  useEffect(() => {
    fetchNotes(projectId, project?.name || '')
  }, [projectId, project?.name, fetchNotes])

  const progress = useMemo(() => {
    const total = notes.length
    const done = notes.filter((n) => n.status === 'green').length
    return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
  }, [notes])

  const handleAddRow = async () => {
    if (!projectId) return
    setSavingId('new')
    try {
      await addNote({
        projectId,
        projectName: project?.name || '',
        title: '',
        description: '',
        status: 'red',
        priority: 'medium',
        createdBy: userDoc?.uid || user?.uid || null,
        createdByName: userDoc?.displayName || user?.displayName || '',
        createdByEmail: userDoc?.email || user?.email || '',
      })
    } finally {
      setSavingId(null)
    }
  }

  const handleField = async (noteId, field, value) => {
    await updateNote(noteId, { [field]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideTitle ? (
          <div>
            <h2 className="text-base font-bold text-fg">Employee Task List</h2>
            <p className="text-xs text-muted mt-0.5">
              Click status: red, yellow, or green
            </p>
          </div>
        ) : (
          <div className="text-xs font-semibold text-muted">
            {progress.done}/{progress.total} complete · {progress.percent}%
          </div>
        )}
        <Button icon={Plus} variant="primary" onClick={handleAddRow} disabled={savingId === 'new'}>
          New Note
        </Button>
      </div>

      {!hideTitle && notes.length > 0 && (
        <div>
          <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
            <span className="text-muted">Done (green)</span>
            <span className="text-slate-700 dark:text-slate-200">
              {progress.done}/{progress.total} · {progress.percent}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progress.percent === 100 ? 'bg-emerald-500' : 'bg-accent'
              }`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
          <span className="text-xs">Loading notes...</span>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-accent-soft">
                  {['Task', 'Status', 'Priority', 'Notes', ''].map((label) => (
                    <th
                      key={label || 'actions'}
                      className="text-left text-[11px] font-bold uppercase tracking-wide text-muted px-3 py-2.5 border-b border-border/80 whitespace-nowrap"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <StickyNote className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-semibold text-fg">
                        No tasks yet
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Add a row, then click status to set red, yellow, or green.
                      </p>
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => {
                    const status = STATUS_META[note.status] ? note.status : 'red'
                    return (
                      <tr
                        key={note.noteId}
                        className={`border-b border-border ${ROW_TINT[status]}`}
                      >
                        <td className="px-3 py-2 min-w-[180px] border-r border-slate-100 dark:border-slate-800/80">
                          <input
                            className={cellInput}
                            value={note.title}
                            placeholder="Enter task name"
                            onChange={(e) =>
                              useProjectNotesStore.setState((state) => ({
                                notes: state.notes.map((n) =>
                                  n.noteId === note.noteId ? { ...n, title: e.target.value } : n
                                ),
                              }))
                            }
                            onBlur={(e) => handleField(note.noteId, 'title', e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2 w-24 text-center border-r border-slate-100 dark:border-slate-800/80">
                          <StatusButton status={status} onClick={() => cycleStatus(note.noteId)} />
                        </td>
                        <td className="px-3 py-2 w-[130px] border-r border-slate-100 dark:border-slate-800/80">
                          <select
                            value={note.priority || 'medium'}
                            onChange={(e) => handleField(note.noteId, 'priority', e.target.value)}
                            className={`w-full text-[11px] font-bold rounded-md px-2 py-1 border cursor-pointer focus:outline-none ${
                              PRIORITY_STYLES[note.priority] || PRIORITY_STYLES.medium
                            }`}
                          >
                            <option value="low" style={PRIORITY_OPTION_STYLE}>Low</option>
                            <option value="medium" style={PRIORITY_OPTION_STYLE}>Medium</option>
                            <option value="high" style={PRIORITY_OPTION_STYLE}>High</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 min-w-[180px] border-r border-slate-100 dark:border-slate-800/80">
                          <input
                            className={cellInput}
                            value={note.description}
                            placeholder="Add notes"
                            onChange={(e) =>
                              useProjectNotesStore.setState((state) => ({
                                notes: state.notes.map((n) =>
                                  n.noteId === note.noteId
                                    ? { ...n, description: e.target.value }
                                    : n
                                ),
                              }))
                            }
                            onBlur={(e) => handleField(note.noteId, 'description', e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-2 w-12 text-center">
                          <button
                            type="button"
                            onClick={() => removeNote(note.noteId)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                            title="Delete row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
