import React, { useCallback, useEffect, useState } from 'react'
import { Trash2, RotateCcw, X, Loader2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useProjectStore } from './stores/projectStore'
import { getTrashedProjectsFromDb, getTrashedTasksFromDb } from './services/projectService'

const formatWhen = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString()
}

export const ProjectTrashPage = () => {
  const { restoreProject, restoreTask, permanentlyDeleteProject, permanentlyDeleteTask } =
    useProjectStore()
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [purgeTarget, setPurgeTarget] = useState(null)

  const loadTrash = useCallback(async () => {
    setLoading(true)
    try {
      const [trashedProjects, trashedTasks] = await Promise.all([
        getTrashedProjectsFromDb(),
        getTrashedTasksFromDb(),
      ])
      setProjects(trashedProjects)
      setTasks(trashedTasks)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTrash()
  }, [loadTrash])

  const run = async (id, action) => {
    setBusyId(id)
    try {
      await action()
      await loadTrash()
    } catch (err) {
      console.error('Trash action failed:', err)
    } finally {
      setBusyId('')
    }
  }

  const confirmPurge = async () => {
    if (!purgeTarget) return
    const { kind, id } = purgeTarget
    setPurgeTarget(null)
    if (kind === 'project') {
      await run(id, () => permanentlyDeleteProject(id))
    } else {
      await run(id, () => permanentlyDeleteTask(id))
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trash"
        description="Restore projects and tasks, or delete them permanently."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading trash...
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Projects</h2>
            {projects.length === 0 ? (
              <p className="text-xs text-muted">No projects in trash.</p>
            ) : (
              projects.map((project) => {
                const id = project.projectId || project.id
                return (
                  <Card key={id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-fg">{project.name || 'Untitled project'}</p>
                      <p className="text-xs text-muted mt-1">
                        {project.clientName ? `${project.clientName} · ` : ''}
                        {project.deletedByName ? `Deleted by ${project.deletedByName}` : 'Deleted'}
                        {formatWhen(project.deletedAt) ? ` · ${formatWhen(project.deletedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={RotateCcw}
                        disabled={busyId === id}
                        onClick={() => run(id, () => restoreProject(id))}
                      >
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        disabled={busyId === id}
                        onClick={() => setPurgeTarget({ kind: 'project', id, name: project.name })}
                      >
                        Delete permanently
                      </Button>
                    </div>
                  </Card>
                )
              })
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-fg">Tasks</h2>
            {tasks.length === 0 ? (
              <p className="text-xs text-muted">No tasks in trash. Tasks removed with a project come back when that project is restored.</p>
            ) : (
              tasks.map((task) => {
                const id = task.taskId || task.id
                return (
                  <Card key={id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-fg">{task.title || 'Untitled task'}</p>
                      <p className="text-xs text-muted mt-1">
                        {task.projectName ? `${task.projectName} · ` : ''}
                        {task.deletedByName ? `Deleted by ${task.deletedByName}` : 'Deleted'}
                        {formatWhen(task.deletedAt) ? ` · ${formatWhen(task.deletedAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={RotateCcw}
                        disabled={busyId === id}
                        onClick={() => run(id, () => restoreTask(id))}
                      >
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={Trash2}
                        disabled={busyId === id}
                        onClick={() => setPurgeTarget({ kind: 'task', id, name: task.title })}
                      >
                        Delete permanently
                      </Button>
                    </div>
                  </Card>
                )
              })
            )}
          </section>
        </>
      )}

      {purgeTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Delete permanently
              </h3>
              <button
                onClick={() => setPurgeTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Permanently delete <strong className="text-fg">{purgeTarget.name || 'this item'}</strong>? This cannot be undone.
              {purgeTarget.kind === 'project' ? ' Its tasks will be deleted too.' : ''}
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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
