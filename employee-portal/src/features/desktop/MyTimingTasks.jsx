import React, { useEffect, useMemo, useState } from 'react'
import { Filter, Plus, Search, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { useProjectStore } from '../projects/stores/projectStore'
import { buildTaskVisibilityIndex, isTaskVisibleToUser } from '../projects/services/projectService'

const HIDE_KEY = 'crm_my_timing_hide_tasks'

function statusLabel(status) {
  if (!status) return 'To do'
  if (typeof status === 'string') return status.replace(/_/g, ' ')
  return status.name || status.id || 'Task'
}

function isDoneTask(task) {
  const status = task?.status
  const raw = typeof status === 'string' ? status : status?.id || status?.name || ''
  const key = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
  return key === 'done' || key === 'completed'
}

export const MyTimingTasks = ({ fillWindow = false } = {}) => {
  const { user, userDoc, claims } = useUserStore()
  const {
    tasks,
    projects,
    addTask,
    fetchProjectsAndTasks,
  } = useProjectStore()

  const [hideTasks, setHideTasks] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('all')
  const [showFilter, setShowFilter] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [createError, setCreateError] = useState('')

  const currentUserId = userDoc?.uid || user?.uid
  const currentUserEmail = userDoc?.email || user?.email
  const userRole = claims?.role || userDoc?.role || 'employee'

  useEffect(() => {
    fetchProjectsAndTasks()
  }, [fetchProjectsAndTasks])

  useEffect(() => {
    if (!fillWindow) return
    try {
      window.desktop?.setMyTimingSize?.({ expanded: !hideTasks })
    } catch {
      /* ignore */
    }
  }, [fillWindow, hideTasks])

  const visIndex = useMemo(
    () => buildTaskVisibilityIndex(projects, tasks, user, userDoc, claims),
    [projects, tasks, user, userDoc, claims]
  )

  const visibleProjects = useMemo(() => {
    return visIndex.isAdmin
      ? projects
      : projects.filter((p) => visIndex.visibleProjectIds.has(String(p.projectId || p.id || '')))
  }, [visIndex, projects])

  const activeProject = visibleProjects.find(
    (p) => (p.projectId || p.id) === projectFilter
  )

  const filteredTasks = tasks.filter((t) => {
    if (isDoneTask(t)) return false
    if (!isTaskVisibleToUser(t, user, userDoc, claims, projects, tasks, visIndex)) return false
    if (projectFilter && projectFilter !== 'all') {
      const isProjectMatch =
        t.projectId === projectFilter ||
        (activeProject &&
          t.projectName &&
          t.projectName.toLowerCase() === activeProject.name.toLowerCase())
      if (!isProjectMatch) return false
    }
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      t.title?.toLowerCase().includes(q) ||
      t.projectName?.toLowerCase().includes(q)
    )
  })

  const setHidden = (next) => {
    setHideTasks(next)
    if (next) {
      setShowFilter(false)
      setShowAdd(false)
    }
    try {
      sessionStorage.setItem(HIDE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const openAdd = () => {
    const fallbackId = visibleProjects[0]?.projectId || visibleProjects[0]?.id || ''
    setProjectId(projectFilter !== 'all' ? projectFilter : fallbackId)
    setTaskTitle('')
    setPriority('medium')
    setCreateError('')
    setShowAdd(true)
  }

  const handleCreateTask = (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return
    if (!currentUserId) {
      setCreateError('Your account is still loading. Please refresh and try again.')
      return
    }
    const targetProjId = projectId || visibleProjects[0]?.projectId || visibleProjects[0]?.id || ''
    if (!targetProjId) {
      setCreateError('No project available to attach this task.')
      return
    }
    const proj = projects.find((p) => p.projectId === targetProjId || p.id === targetProjId)
    const employeeName = userDoc?.displayName || user?.displayName || currentUserEmail || 'Employee'
    addTask({
      title: taskTitle.trim(),
      description: '',
      projectId: targetProjId,
      projectName: proj?.name || 'Project Work',
      priority,
      assigneeId: currentUserId,
      assigneeEmail: currentUserEmail || null,
      assigneeName: employeeName,
      employeeId: currentUserId,
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      createdBy: currentUserId,
      createdByEmail: currentUserEmail || null,
      createdByName: employeeName,
      createdByRole: userRole || 'employee',
      isEmployeeCreated: true,
    })
    setShowAdd(false)
    setTaskTitle('')
  }

  const openTaskBoard = () => {
    if (typeof window !== 'undefined' && window.desktop?.openEmployeePortal) {
      window.desktop.openEmployeePortal({ path: '/projects/tasks' })
      return
    }
    window.location.assign('/projects/tasks')
  }

  return (
    <div
      className={`flex flex-col ${hideTasks ? 'shrink-0' : 'min-h-0 flex-1'}`}
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <div className={`flex items-center justify-between gap-2 px-3 ${hideTasks ? 'pb-3' : 'pb-2'}`}>
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={hideTasks}
            onClick={() => setHidden(!hideTasks)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              hideTasks ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                hideTasks ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          Hide my tasks list
        </label>
        {!hideTasks ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Add task"
              onClick={openAdd}
              className="w-7 h-7 rounded-lg bg-accent hover:bg-accent-hover text-white flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                title="Filter project"
                onClick={() => setShowFilter((v) => !v)}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center ${
                  projectFilter !== 'all'
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-chrome text-muted hover:text-fg'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
              {showFilter ? (
                <div className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-border bg-surface shadow-lg p-2">
                  <select
                    value={projectFilter}
                    onChange={(e) => {
                      setProjectFilter(e.target.value)
                      setShowFilter(false)
                    }}
                    className="w-full bg-chrome border border-border text-xs text-fg font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent"
                  >
                    <option value="all">All Projects</option>
                    {visibleProjects.map((p) => (
                      <option key={p.projectId || p.id} value={p.projectId || p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {!hideTasks ? (
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-border text-xs text-fg placeholder-muted rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      ) : null}

      {!hideTasks ? (
        <div className="flex-1 min-h-[180px] overflow-y-auto px-3 pb-3 space-y-1.5">
          {filteredTasks.length === 0 ? (
            <p className="text-[11px] text-muted text-center py-6">No tasks to show</p>
          ) : (
            filteredTasks.map((task) => (
              <button
                key={task.taskId || task.id}
                type="button"
                onClick={openTaskBoard}
                className="w-full text-left rounded-xl border border-border bg-chrome/60 hover:border-accent/40 px-2.5 py-2"
              >
                <p className="text-xs font-semibold text-fg truncate">{task.title}</p>
                <p className="text-[10px] text-muted truncate mt-0.5">
                  {task.projectName || 'Project'} · {statusLabel(task.status)}
                </p>
              </button>
            ))
          )}
        </div>
      ) : null}

      {showAdd ? (
        <div className="absolute inset-0 z-30 bg-black/50 flex items-end sm:items-center justify-center p-3">
          <Card className="w-full p-4 space-y-3 bg-surface border-border relative">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-fg">Create Task</h3>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="w-7 h-7 rounded-lg text-muted hover:bg-chrome hover:text-fg flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateTask} className="space-y-3">
              <Input
                label="Task Title"
                placeholder="e.g. Implement Security Rules"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Target Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                >
                  {visibleProjects.map((p) => (
                    <option key={p.projectId || p.id} value={p.projectId || p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              {createError ? <p className="text-[11px] text-danger">{createError}</p> : null}
              <Button type="submit" size="sm" className="w-full font-extrabold">
                Create
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
