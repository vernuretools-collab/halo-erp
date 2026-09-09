import React, { useState, useEffect, useMemo } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useProjectStore } from './stores/projectStore'
import { createTask, updateTaskStatusInDb, deleteTaskFromDb } from './services/projectService'
import { getEmployees } from '../team/services/teamService'
import { TaskListView } from './components/TaskListView'
import { TaskCalendarView } from './components/TaskCalendarView'
import {
  FolderKanban,
  Kanban,
  Clock,
  Plus,
  User,
  X,
  Trash2,
  Calendar,
  Filter,
  List,
} from 'lucide-react'

const getEmployeeLabel = (emp) =>
  emp?.displayName || emp?.name || emp?.email || 'Employee'

const looksLikeEmail = (value) =>
  typeof value === 'string' && value.includes('@')

/** Prefer a real employee display name over a stored email fallback. */
const resolveTaskLeadName = (task, employees = []) => {
  if (!task) return 'Employee'

  const byId = (id) =>
    id
      ? employees.find(
          (emp) => String(emp.uid || emp.employeeId || emp.id) === String(id)
        )
      : null

  const byEmail = (email) => {
    if (!email) return null
    const needle = String(email).toLowerCase()
    return employees.find((emp) => (emp.email || '').toLowerCase() === needle)
  }

  const matched =
    byId(task.createdBy) ||
    byId(task.assigneeId) ||
    byId(task.employeeId) ||
    byEmail(task.createdByEmail) ||
    byEmail(task.assigneeEmail) ||
    (looksLikeEmail(task.createdByName) ? byEmail(task.createdByName) : null) ||
    (looksLikeEmail(task.assigneeName) ? byEmail(task.assigneeName) : null)

  if (matched) {
    const name = matched.displayName || matched.name
    if (name) return name
  }

  const stored = task.createdByName || task.assigneeName
  if (stored && !looksLikeEmail(stored)) return stored

  if (stored && looksLikeEmail(stored)) {
    const local = String(stored).split('@')[0]
    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  }

  return stored || 'Employee'
}

const taskMatchesEmployee = (task, employee) => {
  if (!task || !employee) return false
  const empId = String(employee.uid || employee.employeeId || employee.id || '')
  const empEmail = (employee.email || '').toLowerCase()
  const empName = getEmployeeLabel(employee).toLowerCase()

  if (empId) {
    if (task.createdBy && String(task.createdBy) === empId) return true
    if (task.assigneeId && String(task.assigneeId) === empId) return true
    if (task.employeeId && String(task.employeeId) === empId) return true
  }
  if (empEmail) {
    if (task.createdByEmail && String(task.createdByEmail).toLowerCase() === empEmail) return true
    if (task.assigneeEmail && String(task.assigneeEmail).toLowerCase() === empEmail) return true
  }
  if (empName && empName !== 'employee') {
    if (task.createdByName && String(task.createdByName).toLowerCase() === empName) return true
    if (task.assigneeName && String(task.assigneeName).toLowerCase() === empName) return true
  }
  return false
}

const STATUS_DOT_COLORS = {
  todo: 'bg-sky-500 dark:bg-sky-400',
  blue: 'bg-sky-500 dark:bg-sky-400',
  sky: 'bg-sky-500 dark:bg-sky-400',
  in_progress: 'bg-accent',
  indigo: 'bg-accent',
  in_review: 'bg-amber-500 dark:bg-amber-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  done: 'bg-emerald-500 dark:bg-emerald-400',
  emerald: 'bg-emerald-500 dark:bg-emerald-400',
  purple: 'bg-purple-500 dark:bg-purple-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
}

const getStatusDotBg = (status) => {
  if (!status) return 'bg-sky-500 dark:bg-sky-400'
  if (typeof status === 'string') return STATUS_DOT_COLORS[status] || 'bg-sky-500 dark:bg-sky-400'
  return (
    STATUS_DOT_COLORS[status.id] ||
    STATUS_DOT_COLORS[status.color] ||
    'bg-sky-500 dark:bg-sky-400'
  )
}

export const TaskBoard = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = searchParams.get('projectId')

  const {
    tasks,
    projects,
    statuses,
    addTask,
    updateTaskStatus,
    deleteTask,
    selectedProjectId,
    setSelectedProjectId,
    fetchProjectsAndTasks,
  } = useProjectStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null)
  const [employees, setEmployees] = useState([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all')
  const [viewMode, setViewMode] = useState('board') // board | list | calendar

  // Drag & Drop State
  const [draggedOverCol, setDraggedOverCol] = useState(null)
  const [draggingTaskId, setDraggingTaskId] = useState(null)

  // Drag & Drop Handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingTaskId(taskId)
  }

  const handleDragEnd = () => {
    setDraggingTaskId(null)
    setDraggedOverCol(null)
  }

  const handleDragOver = (e, statusId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedOverCol !== statusId) {
      setDraggedOverCol(statusId)
    }
  }

  const handleDragLeave = (e, statusId) => {
    if (draggedOverCol === statusId) {
      setDraggedOverCol(null)
    }
  }

  const handleDrop = async (e, targetStatusId) => {
    e.preventDefault()
    setDraggedOverCol(null)
    setDraggingTaskId(null)
    const taskId = e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const task = tasks.find((t) => t.taskId === taskId)
    if (task && task.status !== targetStatusId) {
      updateTaskStatus(taskId, targetStatusId)
      await updateTaskStatusInDb(taskId, targetStatusId)
    }
  }

  // Sync URL search param with selectedProjectId
  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId)
    }
  }, [urlProjectId, setSelectedProjectId])

  // Fetch Firestore data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [, employeesData] = await Promise.all([
          fetchProjectsAndTasks(),
          getEmployees(),
        ])
        if (employeesData) setEmployees(employeesData)
      } catch (err) {
        console.error('Error loading task board data:', err)
      }
    }
    fetchData()
  }, [fetchProjectsAndTasks])

  // New task form state
  const currentProjId = selectedProjectId && selectedProjectId !== 'all'
    ? selectedProjectId
    : projects[0]?.projectId || projects[0]?.id || ''

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [projectId, setProjectId] = useState(currentProjId)
  const [priority, setPriority] = useState('medium')
  const [assigneeId, setAssigneeId] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('10')

  const handleOpenAddModal = () => {
    setProjectId(currentProjId)
    if (!assigneeId && employees.length > 0) {
      setAssigneeId(String(employees[0].uid || employees[0].employeeId || employees[0].id || ''))
    }
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

  const activeEmployee = useMemo(
    () =>
      employees.find(
        (emp) => String(emp.uid || emp.employeeId || emp.id) === String(selectedEmployeeId)
      ),
    [employees, selectedEmployeeId]
  )

  const filteredTasks = useMemo(() => {
    let next = tasks

    if (selectedProjectId && selectedProjectId !== 'all') {
      next = next.filter(
        (t) =>
          t.projectId === selectedProjectId ||
          (activeProject &&
            t.projectName &&
            t.projectName.toLowerCase() === activeProject.name.toLowerCase())
      )
    }

    if (selectedEmployeeId && selectedEmployeeId !== 'all' && activeEmployee) {
      next = next.filter((t) => taskMatchesEmployee(t, activeEmployee))
    }

    return next
  }, [tasks, selectedProjectId, activeProject, selectedEmployeeId, activeEmployee])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    const proj = projects.find((p) => p.projectId === projectId || p.id === projectId)
    const selectedAssignee = employees.find(
      (emp) => String(emp.uid || emp.employeeId || emp.id) === String(assigneeId)
    )
    const assigneeName = selectedAssignee ? getEmployeeLabel(selectedAssignee) : 'Unassigned'

    const payload = {
      title: taskTitle,
      description: taskDesc,
      projectId: projectId || 'proj_default',
      projectName: proj?.name || 'Project Work',
      priority,
      assigneeId: selectedAssignee
        ? String(selectedAssignee.uid || selectedAssignee.employeeId || selectedAssignee.id)
        : '',
      assigneeName,
      assigneeEmail: selectedAssignee?.email || '',
      estimatedHours: Number(estimatedHours) || 0,
      loggedHours: 0,
      status: 'todo',
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
      createdByRole: 'admin',
      isEmployeeCreated: false,
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

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Task Sprint Board"
          description="Track cross-project task assignments, sprint statuses, and logged work hours"
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

          {/* Project & Employee Filters */}
          <div className="flex flex-wrap items-center gap-3">
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

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-accent" /> Filter Employee:
              </span>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="bg-canvas border border-border text-xs text-fg font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer transition-colors max-w-[200px]"
              >
                <option value="all">All Employees ({employees.length})</option>
                {employees.map((emp) => {
                  const id = String(emp.uid || emp.employeeId || emp.id)
                  return (
                    <option key={id} value={id}>
                      {getEmployeeLabel(emp)}
                    </option>
                  )
                })}
              </select>
            </div>

            <div className="flex items-center gap-1 bg-canvas border border-border rounded-xl p-0.5">
              {[
                { id: 'board', label: 'Board', icon: Kanban },
                { id: 'list', label: 'List', icon: List },
                { id: 'calendar', label: 'Calendar', icon: Calendar },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    viewMode === id
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-muted hover:text-fg'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Active Filter Alert Banner */}
      {((selectedProjectId && selectedProjectId !== 'all') ||
        (selectedEmployeeId && selectedEmployeeId !== 'all')) && (
        <div className="flex items-center justify-between bg-accent-soft border border-accent/30 rounded-xl px-4 py-2.5 text-xs text-accent ">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-muted">Showing tasks for:</span>
            {selectedProjectId && selectedProjectId !== 'all' && (
              <span className="bg-accent text-white px-2.5 py-0.5 rounded-lg font-bold">
                {activeProject ? activeProject.name : selectedProjectId}
              </span>
            )}
            {selectedEmployeeId && selectedEmployeeId !== 'all' && activeEmployee && (
              <span className="bg-slate-700 dark:bg-slate-600 text-white px-2.5 py-0.5 rounded-lg font-bold">
                {getEmployeeLabel(activeEmployee)}
              </span>
            )}
            <span className="text-muted">
              ({filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found)
            </span>
          </div>
          <button
            onClick={() => {
              handleProjectFilterChange('all')
              setSelectedEmployeeId('all')
            }}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <X className="w-3.5 h-3.5" /> Clear Filters
          </button>
        </div>
      )}

      {/* Task Views: Board / List / Calendar */}
      {viewMode === 'list' && (
        <TaskListView
          tasks={filteredTasks}
          statuses={statuses}
          onTaskClick={setSelectedTask}
          onStatusChange={handleStatusChange}
          metaLabel="Hours"
          getLeadName={(task) => resolveTaskLeadName(task, employees)}
        />
      )}

      {viewMode === 'calendar' && (
        <TaskCalendarView
          tasks={filteredTasks}
          statuses={statuses}
          onTaskClick={setSelectedTask}
          getLeadName={(task) => resolveTaskLeadName(task, employees)}
        />
      )}

      {viewMode === 'board' && (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
          {statuses.map((status) => {
            const colTasks = filteredTasks.filter((t) => t.status === status.id)

            return (
              <div
                key={status.id}
                onDragOver={(e) => handleDragOver(e, status.id)}
                onDragLeave={(e) => handleDragLeave(e, status.id)}
                onDrop={(e) => handleDrop(e, status.id)}
                className={`w-72 shrink-0 border rounded-2xl p-3 flex flex-col space-y-3 transition-all ${
                  draggedOverCol === status.id
                    ? 'bg-accent-soft border-accent/30 ring-2 ring-accent/40 shadow-lg'
                    : 'bg-canvas border-border'
                }`}
              >
                <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                  <span className="font-semibold text-fg text-xs flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${getStatusDotBg(status)}`} />
                    {status.name}
                  </span>
                  <Badge variant="brand">{colTasks.length}</Badge>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {colTasks.length === 0 ? (
                    <div className="p-4 text-center border border-dashed border-border rounded-xl text-[11px] text-slate-400 dark:text-slate-600">
                      No tasks in {status.name}
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.taskId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, t.taskId)}
                        onDragEnd={handleDragEnd}
                        className={`transition-opacity cursor-grab active:cursor-grabbing ${
                          draggingTaskId === t.taskId ? 'opacity-40 scale-95' : 'opacity-100'
                        }`}
                      >
                        <Card
                          hover
                          className="p-3.5 space-y-2.5 bg-surface border-border hover:border-accent/40 relative group shadow-sm"
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

                          <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Clock className="w-3 h-3 text-accent" /> {t.loggedHours} / {t.estimatedHours}h
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted">
                              <User className="w-3 h-3 text-muted" /> {resolveTaskLeadName(t, employees)}
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
                              {statuses.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </Card>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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

                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg">Assignee</label>
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    {employees.length === 0 ? (
                      <option value="" className="bg-surface text-fg">
                        No employees found
                      </option>
                    ) : (
                      employees.map((emp) => {
                        const id = String(emp.uid || emp.employeeId || emp.id)
                        return (
                          <option
                            key={id}
                            value={id}
                            className="bg-surface text-fg"
                          >
                            {getEmployeeLabel(emp)}
                          </option>
                        )
                      })
                    )}
                  </select>
                </div>
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-fg text-sm">{selectedTask.title}</h3>
                <p className="text-xs text-accent">{selectedTask.projectName}</p>
              </div>
              <button
                onClick={() => setSelectedTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-muted">
              <div className="flex justify-between py-1 border-b border-border">
                <span>Creator / Assignee:</span>
                <span className="text-slate-900 dark:text-slate-200 font-medium">{resolveTaskLeadName(selectedTask, employees)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span>Logged Work:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{selectedTask.loggedHours} / {selectedTask.estimatedHours} hrs</span>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setDeleteConfirmTask(selectedTask)
                  setSelectedTask(null)
                }}
              >
                Delete Task
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Delete Task Modal */}
      {deleteConfirmTask && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Task
              </h3>
              <button
                onClick={() => setDeleteConfirmTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete task <strong className="text-slate-900 dark:text-white">{deleteConfirmTask.title}</strong>? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmTask(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const id = deleteConfirmTask?.taskId || deleteConfirmTask?.id
                  setDeleteConfirmTask(null)
                  setSelectedTask(null)
                  if (id) {
                    try {
                      await handleDeleteTask(id)
                    } catch (err) {
                      console.error('Error deleting task:', err)
                    }
                  }
                }}
              >
                Yes, Delete Task
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

