import React, { useState, useEffect } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { SubtaskStepper } from './components/SubtaskStepper'
import { useProjectStore, DEFAULT_TASK_STATUSES } from './stores/projectStore'
import { useUserStore } from '../../shared/stores/userStore'
import { getProjects, getTasks, getTaskStatusesFromDb, createTask, updateTaskStatusInDb, deleteTaskFromDb, isTaskVisibleToUser } from './services/projectService'
import {
  FolderKanban,
  Kanban,
  Clock,
  Plus,
  User,
  X,
  Trash2,
  Filter
} from 'lucide-react'

export const TaskBoard = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = searchParams.get('projectId')

  const { user, userDoc, claims } = useUserStore()
  const currentUserId = userDoc?.uid || user?.uid
  const currentUserEmail = userDoc?.email || user?.email
  const userRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin = userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin' || claims?.role === 'admin' || claims?.role === 'owner' || claims?.role === 'superadmin'

  const {
    tasks,
    projects,
    statuses,
    setTasks,
    setProjects,
    setStatuses,
    addTask,
    updateTaskStatus,
    deleteTask,
    logHoursToTask,
    selectedProjectId,
    setSelectedProjectId
  } = useProjectStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [hoursToLog, setHoursToLog] = useState('')

  // Sync URL search param with selectedProjectId
  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId)
    }
  }, [urlProjectId, setSelectedProjectId])

  // Fetch Firestore data on mount if needed
  useEffect(() => {
    const fetchData = async () => {
      const [tasksData, projectsData, statusesData] = await Promise.all([
        getTasks(),
        getProjects(),
        getTaskStatusesFromDb(),
      ])
      if (tasksData && tasksData.length > 0) setTasks(tasksData)
      if (projectsData && projectsData.length > 0) setProjects(projectsData)
      if (statusesData && statusesData.length > 0) setStatuses(statusesData)
    }
    fetchData()
  }, [setTasks, setProjects, setStatuses])

  // New task form state
  const currentProjId = selectedProjectId && selectedProjectId !== 'all'
    ? selectedProjectId
    : projects[0]?.projectId || projects[0]?.id || ''

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [projectId, setProjectId] = useState(currentProjId)
  const [priority, setPriority] = useState('medium')
  const [assignee, setAssignee] = useState('Sarah Jenkins')
  const [estimatedHours, setEstimatedHours] = useState('10')

  const handleOpenAddModal = () => {
    setProjectId(currentProjId)
    setShowAddModal(true)
  }

  const handleProjectFilterChange = (pId) => {
    if (pId === 'all') {
      setSelectedProjectId(null)
      setSearchParams({})
    } else {
      setSelectedProjectId(pId)
      setSearchParams({ projectId: pId })
    }
  }

  const activeProject = projects.find(
    (p) => p.projectId === selectedProjectId || p.id === selectedProjectId
  )

  const rawFilteredTasks = selectedProjectId && selectedProjectId !== 'all'
    ? tasks.filter(
        (t) =>
          t.projectId === selectedProjectId ||
          (activeProject && t.projectName && t.projectName.toLowerCase() === activeProject.name.toLowerCase())
      )
    : tasks

  const filteredTasks = rawFilteredTasks.filter((t) => isTaskVisibleToUser(t, user, userDoc, claims, projects, tasks))

  const activeStatuses = statuses || DEFAULT_TASK_STATUSES

  const liveSelectedTask = selectedTask ? tasks.find((t) => t.taskId === selectedTask.taskId) || selectedTask : null

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    const proj = projects.find((p) => p.projectId === projectId || p.id === projectId)

    const employeeName = userDoc?.displayName || user?.displayName || currentUserEmail || 'Employee'

    const payload = {
      title: taskTitle,
      description: taskDesc,
      projectId: projectId || 'proj_default',
      projectName: proj?.name || 'Project Work',
      priority,
      assigneeId: currentUserId || null,
      assigneeEmail: currentUserEmail || null,
      assigneeName: isAdmin ? assignee : employeeName,
      estimatedHours: Number(estimatedHours) || 0,
      loggedHours: 0,
      status: 'todo',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      createdBy: currentUserId || null,
      createdByEmail: currentUserEmail || null,
      createdByName: employeeName,
      createdByRole: userRole || 'employee',
      isEmployeeCreated: userRole === 'employee' || !isAdmin,
    }

    const created = await createTask(payload)
    addTask(created)

    setTaskTitle('')
    setTaskDesc('')
    setShowAddModal(false)
  }

  const handleStatusChange = async (taskId, newStatus) => {
    updateTaskStatus(taskId, newStatus)
    await updateTaskStatusInDb(taskId, newStatus)
  }

  const handleDeleteTask = async (taskId) => {
    deleteTask(taskId)
    await deleteTaskFromDb(taskId)
  }

  const handleLogHours = (e) => {
    e.preventDefault()
    if (!selectedTask || !hoursToLog || Number(hoursToLog) <= 0) return

    logHoursToTask(selectedTask.taskId, Number(hoursToLog))
    setHoursToLog('')
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Task Sprint Board"
          description="Track cross-project task assignments, sprint statuses, and subtask execution timelines"
          actions={
            <Button icon={Plus} variant="primary" onClick={handleOpenAddModal}>
              New Task
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/projects/list"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <FolderKanban className="w-3.5 h-3.5" /> All Projects
            </NavLink>
            <NavLink
              to="/projects/tasks"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Kanban className="w-3.5 h-3.5" /> Task Board
            </NavLink>
            <NavLink
              to="/projects/time"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Clock className="w-3.5 h-3.5" /> Time Tracking
            </NavLink>
          </div>

          {/* Project Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-accent" /> Filter Project:
            </span>
            <select
              value={selectedProjectId || 'all'}
              onChange={(e) => handleProjectFilterChange(e.target.value)}
              className="bg-canvas border border-border text-xs text-fg font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer transition-colors"
            >
              <option value="all">All Projects ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.projectId || p.id} value={p.projectId || p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Project Filter Alert Banner */}
      {selectedProjectId && selectedProjectId !== 'all' && (
        <div className="flex items-center justify-between bg-accent-soft border border-accent/30 rounded-xl px-4 py-2.5 text-xs text-accent ">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted">Showing tasks for:</span>
            <span className="bg-accent text-white px-2.5 py-0.5 rounded-lg font-bold">
              {activeProject ? activeProject.name : selectedProjectId}
            </span>
            <span className="text-muted">({filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found)</span>
          </div>
          <button
            onClick={() => handleProjectFilterChange('all')}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <X className="w-3.5 h-3.5" /> Show All Projects
          </button>
        </div>
      )}

      {/* Task Kanban Columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start min-h-[500px]">
        {activeStatuses.map((status) => {
          const colTasks = filteredTasks.filter((t) => t.status === status.id)

          return (
            <div
              key={status.id}
              className="bg-canvas border border-border rounded-2xl p-3 flex flex-col space-y-3 transition-colors"
            >
              <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                <span className="font-bold text-fg text-xs">{status.name}</span>
                <Badge variant="brand">{colTasks.length}</Badge>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                {colTasks.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-xl text-[11px] text-muted bg-white/50 dark:bg-transparent">
                    No tasks in {status.name}
                  </div>
                ) : (
                  colTasks.map((t) => (
                    <Card
                      key={t.taskId}
                      hover
                      className="p-3.5 space-y-2.5 cursor-pointer bg-surface border-border hover:border-accent/40 relative group shadow-sm"
                      onClick={() => setSelectedTask(t)}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-fg group-hover:text-accent dark:group-hover:text-accent transition-colors">
                          {t.title}
                        </span>
                        <Badge
                          variant={
                            t.priority === 'critical' || t.priority === 'high'
                              ? 'danger'
                              : 'info'
                          }
                        >
                          {t.priority}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-accent font-medium truncate">{t.projectName}</p>

                      {/* Subtask Mini Stepper Bar on Kanban Card */}
                      <SubtaskStepper taskId={t.taskId} subtasks={t.subtasks || []} compact={true} />

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                        <span className="flex items-center gap-1 text-[11px] text-muted">
                          <Clock className="w-3 h-3 text-accent" /> {t.loggedHours} / {t.estimatedHours}h
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <User className="w-3 h-3 text-muted" /> {t.assigneeName}
                        </span>
                      </div>

                      <div
                        className="pt-2 flex items-center justify-between text-[10px] text-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Status:</span>
                        <select
                          value={t.status}
                          onChange={(e) => handleStatusChange(t.taskId, e.target.value)}
                          className="bg-canvas border border-border text-[10px] text-slate-800 dark:text-slate-300 rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                        >
                          {activeStatuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Create Task</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
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
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                >
                  {projects.map((p) => (
                    <option key={p.projectId || p.id} value={p.projectId || p.id} className="bg-surface text-fg">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    <option value="low" className="bg-surface text-fg">Low</option>
                    <option value="medium" className="bg-surface text-fg">Medium</option>
                    <option value="high" className="bg-surface text-fg">High</option>
                    <option value="critical" className="bg-surface text-fg">Critical</option>
                  </select>
                </div>

                {isAdmin && (
                  <div className="space-y-1.5 text-left">
                    <label className="block text-xs font-medium text-fg">Assignee</label>
                    <select
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                    >
                      <option value="Sarah Jenkins" className="bg-surface text-fg">Sarah Jenkins</option>
                      <option value="Alex Rivera" className="bg-surface text-fg">Alex Rivera</option>
                      <option value="David Chen" className="bg-surface text-fg">David Chen</option>
                    </select>
                  </div>
                )}
              </div>

              <Input
                label="Estimated Hours"
                type="number"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Save Task
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Task Log Hours & Subtask Timeline Detail Modal */}
      {liveSelectedTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-2xl p-6 space-y-6 border-border shadow-2xl relative bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-fg text-base">{liveSelectedTask.title}</h3>
                <p className="text-xs text-accent font-medium">{liveSelectedTask.projectName}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-canvas/40 p-3 rounded-2xl border border-border">
              <div className="space-y-1">
                <span className="text-muted block">Assignee</span>
                <span className="text-fg font-bold">{liveSelectedTask.assigneeName}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted block">Logged / Target Work</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{liveSelectedTask.loggedHours} / {liveSelectedTask.estimatedHours} hrs</span>
              </div>
            </div>

            {/* Interactive Vertical Subtask Timeline */}
            <SubtaskStepper taskId={liveSelectedTask.taskId} subtasks={liveSelectedTask.subtasks || []} />

            {/* Quick Log Additional Hours */}
            <form onSubmit={handleLogHours} className="space-y-3 pt-3 border-t border-border">
              <Input
                label="Log Additional Hours"
                type="number"
                placeholder="e.g. 4"
                value={hoursToLog}
                onChange={(e) => setHoursToLog(e.target.value)}
              />

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={async () => {
                    const id = liveSelectedTask.taskId
                    setSelectedTask(null)
                    try {
                      await handleDeleteTask(id)
                    } catch (err) {
                      console.error('Error deleting task:', err)
                    }
                  }}
                >
                  Delete Task
                </Button>
                <Button type="submit" variant="primary" size="sm" className="flex-1" icon={Clock}>
                  Log Hours
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
