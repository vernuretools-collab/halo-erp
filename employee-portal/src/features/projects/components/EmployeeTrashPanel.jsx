import React, { useCallback, useEffect, useState } from 'react'
import { Trash2, RotateCcw, X, Loader2 } from 'lucide-react'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import { useProjectStore } from '../stores/projectStore'
import { getTrashedProjectsFromDb, getTrashedTasksFromDb } from '../services/projectService'

const formatWhen = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

export const EmployeeTrashPanel = ({ open, kind, onClose }) => {
  const { restoreProject, restoreTask, permanentlyDeleteProject, permanentlyDeleteTask } =
    useProjectStore()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [purgeTarget, setPurgeTarget] = useState(null)

  const loadTrash = useCallback(async () => {
    setLoading(true)
    try {
      if (kind === 'projects') {
        setItems(await getTrashedProjectsFromDb())
      } else {
        setItems(await getTrashedTasksFromDb())
      }
    } finally {
      setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    if (!open) return
    loadTrash()
  }, [open, loadTrash])

  if (!open) return null

  const itemId = (item) =>
    kind === 'projects' ? item.projectId || item.id : item.taskId || item.id

  const run = async (id, action) => {
    setItems((prev) => prev.filter((item) => itemId(item) !== id))
    setBusyId(id)
    try {
      await action()
    } catch (err) {
      console.error('Trash action failed:', err)
      await loadTrash()
    } finally {
      setBusyId('')
    }
  }

  const confirmPurge = async () => {
    if (!purgeTarget) return
    const id = purgeTarget.id
    setPurgeTarget(null)
    if (kind === 'projects') {
      await run(id, () => permanentlyDeleteProject(id))
    } else {
      await run(id, () => permanentlyDeleteTask(id))
    }
  }

  const title = kind === 'projects' ? 'Project trash' : 'Task trash'

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0 border-border shadow-2xl bg-surface">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-fg text-sm flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-500" /> {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted py-6">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading trash...
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted py-6">
              {kind === 'projects'
                ? 'No projects in trash.'
                : 'No tasks in trash. Tasks removed with a project come back when that project is restored.'}
            </p>
          ) : (
            items.map((item) => {
              const id = kind === 'projects' ? item.projectId || item.id : item.taskId || item.id
              const name = kind === 'projects' ? item.name : item.title
              return (
                <div key={id} className="border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-fg">{name || 'Untitled'}</p>
                    <p className="text-xs text-muted mt-1">
                      {kind === 'tasks' && item.projectName ? `${item.projectName} · ` : ''}
                      {kind === 'projects' && item.clientName ? `${item.clientName} · ` : ''}
                      {item.deletedByName ? `Deleted by ${item.deletedByName}` : 'Deleted'}
                      {formatWhen(item.deletedAt) ? ` · ${formatWhen(item.deletedAt)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={RotateCcw}
                      disabled={busyId === id}
                      onClick={() =>
                        run(id, () => (kind === 'projects' ? restoreProject(id) : restoreTask(id)))
                      }
                    >
                      Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      disabled={busyId === id}
                      onClick={() => setPurgeTarget({ id, name })}
                    >
                      Delete permanently
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {purgeTarget && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl bg-surface">
            <h3 className="font-bold text-fg text-sm">Delete permanently</h3>
            <p className="text-xs text-muted leading-relaxed">
              Permanently delete <strong className="text-fg">{purgeTarget.name || 'this item'}</strong>? This cannot be undone.
              {kind === 'projects' ? ' Its tasks will be deleted too.' : ''}
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="secondary" onClick={() => setPurgeTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmPurge}>
                Delete permanently
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
