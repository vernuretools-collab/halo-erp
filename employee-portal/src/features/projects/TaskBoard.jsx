import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { SubtaskStepper } from './components/SubtaskStepper'
import { TaskActivity } from './components/TaskActivity'
import { useProjectStore } from './stores/projectStore'
import { useTeamStore } from '../team/stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { getEmployees } from '../team/services/teamService'
import { isTaskVisibleToUser, getAttendanceGatedElapsedMs, formatElapsed, buildTaskVisibilityIndex, isEmployeeActivelyWorking } from './services/projectService'
import { TaskListView } from './components/TaskListView'
import { TaskCalendarView } from './components/TaskCalendarView'
import { EmployeeTrashPanel } from './components/EmployeeTrashPanel'
import {
  FolderKanban,
  Kanban,
  Clock,
  Plus,
  User,
  X,
  Trash2,
  Search,
  Filter,
  Pause,
  Play,
  List,
  Calendar,
} from 'lucide-react'

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
  purple: 'bg-accent',
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

export const TaskBoard = ({ embedded = false, lockedProjectId = null }) => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = lockedProjectId || searchParams.get('projectId')

  const {
    tasks,
    projects,
    statuses,
    addTask,
    updateTaskStatus,
    deleteTask,
    pauseTaskTimer,
    resumeTaskTimer,
    fetchProjectsAndTasks,
    addCustomStatus,
    deleteCustomStatus,
    selectedProjectId,
    setSelectedProjectId,
  } = useProjectStore()
  const { employees, setEmployees, clockedIn, isOnBreak, isOnLunch } = useTeamStore()
  const { user, userDoc, claims } = useUserStore()

  const currentUserId = userDoc?.uid || user?.uid
  const currentUserEmail = userDoc?.email || user?.email
  const userRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'owner' ||
    userRole === 'superadmin' ||
    claims?.role === 'admin' ||
    claims?.role === 'owner' ||
    claims?.role === 'superadmin'

  // Sync URL search param with selectedProjectId
  useEffect(() => {
    if (urlProjectId) {
      setSelectedProjectId(urlProjectId)
    }
  }, [urlProjectId, setSelectedProjectId])

  const DEFAULT_STATUS_IDS = ['todo', 'in_progress', 'in_review', 'done']

  const visibleStatuses = (statuses || []).filter((s) => {
    const isDefault = DEFAULT_STATUS_IDS.includes(s.id)
    if (isDefault) return true
    if (isAdmin) return true
    const isAdminCreated =
      s.createdByRole === 'admin' ||
      s.createdByRole === 'owner' ||
      s.createdByRole === 'superadmin' ||
      s.isAdminCreated === true
    if (isAdminCreated) return true
    const isCreatorByUid =
      s.createdBy && currentUserId && String(s.createdBy) === String(currentUserId)
    const isCreatorByEmail =
      s.createdByEmail &&
      currentUserEmail &&
      String(s.createdByEmail).toLowerCase() === String(currentUserEmail).toLowerCase()
    return Boolean(isCreatorByUid || isCreatorByEmail)
  })

  const canDeleteStatus = (status) => {
    const isDefault = DEFAULT_STATUS_IDS.includes(status.id)
    if (isDefault) return false
    if (isAdmin) return true
    const isCreatorByUid =
      status.createdBy && currentUserId && String(status.createdBy) === String(currentUserId)
    const isCreatorByEmail =
      status.createdByEmail &&
      currentUserEmail &&
      String(status.createdByEmail).toLowerCase() === String(currentUserEmail).toLowerCase()
    return Boolean(isCreatorByUid || isCreatorByEmail)
  }

  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('board') // board | list | calendar
  const boardScrollRef = useRef(null)
  const boardBarRef = useRef(null)
  const boardScrollSync = useRef(false)
  const [boardScrollWidth, setBoardScrollWidth] = useState(0)

  const [showAddModal, setShowAddModal] = useState(false)
  const [showAddStatusModal, setShowAddStatusModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [activeSubtaskId, setActiveSubtaskId] = useState(null)
  const [commentFocus, setCommentFocus] = useState(0)
  const [deleteConfirmTask, setDeleteConfirmTask] = useState(null)
  const [deleteConfirmStatus, setDeleteConfirmStatus] = useState(null)
  const [showTrash, setShowTrash] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())

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
    }
  }

  // New status form state
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('purple')

  // New task form state
  const defaultProjId =
    selectedProjectId && selectedProjectId !== 'all'
      ? selectedProjectId
      : projects[0]?.projectId || projects[0]?.id || ''

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [createError, setCreateError] = useState('')
  const [projectId, setProjectId] = useState(defaultProjId)
  const [priority, setPriority] = useState('medium')

  useEffect(() => {
    fetchProjectsAndTasks()
  }, [fetchProjectsAndTasks])

  useEffect(() => {
    setActiveSubtaskId(null)
  }, [selectedTask?.taskId])

  useEffect(() => {
    if (employees.length === 0) {
      getEmployees().then((data) => {
        if (data && data.length > 0) setEmployees(data)
      }).catch(() => {})
    }
  }, [employees.length, setEmployees])

  const handleProjectFilterChange = (pId) => {
    if (embedded) return
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

  const visIndex = React.useMemo(
    () => buildTaskVisibilityIndex(projects, tasks, user, userDoc, claims),
    [projects, tasks, user, userDoc, claims]
  )

  const visibleProjects = React.useMemo(() => {
    return visIndex.isAdmin
      ? projects
      : projects.filter((p) => visIndex.visibleProjectIds.has(String(p.projectId || p.id || '')))
  }, [visIndex, projects])

  const handleOpenAddModal = () => {
    const fallbackId = visibleProjects[0]?.projectId || visibleProjects[0]?.id || ''
    setProjectId(
      selectedProjectId && selectedProjectId !== 'all' ? selectedProjectId : fallbackId
    )
    setCreateError('')
    setShowAddModal(true)
  }

  const filteredTasks = tasks.filter((t) => {
    if (!isTaskVisibleToUser(t, user, userDoc, claims, projects, tasks, visIndex)) return false

    if (selectedProjectId && selectedProjectId !== 'all') {
      const isProjectMatch =
        t.projectId === selectedProjectId ||
        (activeProject &&
          t.projectName &&
          t.projectName.toLowerCase() === activeProject.name.toLowerCase())
      if (!isProjectMatch) return false
    }

    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.projectName?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  const liveSelectedTask = selectedTask
    ? tasks.find((t) => t.taskId === selectedTask.taskId) || null
    : null

  useEffect(() => {
    if (!liveSelectedTask || deleteConfirmTask) return undefined
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setSelectedTask(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [liveSelectedTask, deleteConfirmTask])

  useEffect(() => {
    if (viewMode !== 'board') return undefined
    const board = boardScrollRef.current
    if (!board) return undefined
    const update = () => {
      const width = board.scrollWidth
      setBoardScrollWidth((current) => (current === width ? current : width))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(board)
    Array.from(board.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [viewMode, visibleStatuses, filteredTasks])

  useEffect(() => {
    const hasRunning =
      tasks.some(
        (t) =>
          t.timerStatus === 'running' ||
          (t.subtasks || []).some((st) => st.timerStatus === 'running')
      )
    if (!hasRunning) return undefined
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [tasks])

  const handleCreateTask = (e) => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    // Without a resolved id the task has no assignee, so it would be written as
    // an unowned row that nobody matches.
    if (!currentUserId) {
      setCreateError('Your account is still loading. Please refresh and try again.')
      return
    }
    setCreateError('')

    const targetProjId = projectId || defaultProjId
    const proj = projects.find((p) => p.projectId === targetProjId || p.id === targetProjId)
    const employeeName = userDoc?.displayName || user?.displayName || currentUserEmail || 'Employee'

    addTask({
      title: taskTitle,
      description: taskDesc,
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

    setTaskTitle('')
    setTaskDesc('')
    setShowAddModal(false)
  }

  const handleCreateStatus = async (e) => {
    e.preventDefault()
    if (!newStatusName.trim()) return

    await addCustomStatus(
      {
        name: newStatusName.trim(),
        color: newStatusColor,
      },
      {
        uid: currentUserId,
        email: currentUserEmail,
        displayName: userDoc?.displayName || user?.displayName || currentUserEmail,
        role: userRole,
      }
    )

    setNewStatusName('')
    setShowAddStatusModal(false)
  }

  const formatTaskTimerLabel = (task) => {
    void nowTick
    const attendance = { clockedIn, isOnBreak, isOnLunch }
    const elapsed = formatElapsed(getAttendanceGatedElapsedMs(task, attendance))
    if (task?.status === 'todo') return elapsed
    const offDutyRunning =
      task?.timerStatus === 'running' && !isEmployeeActivelyWorking(attendance)
    if (task?.timerStatus === 'paused' || offDutyRunning) return `Paused · ${elapsed}`
    if (task?.timerStatus === 'stopped') return elapsed
    if (task?.timerStatus === 'running') return elapsed
    return elapsed
  }

  const taskElapsedLabel = (task) => {
    void nowTick
    return formatElapsed(getAttendanceGatedElapsedMs(task, { clockedIn, isOnBreak, isOnLunch }))
  }

  const formatTaskDate = (value) => {
    if (!value) return null
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const timerStateLabel = (task) => {
    if (!task) return 'Not started'
    if (task.status === 'done' || task.timerStatus === 'stopped') return 'Stopped'
    const attendance = { clockedIn, isOnBreak, isOnLunch }
    const offDutyRunning = task.timerStatus === 'running' && !isEmployeeActivelyWorking(attendance)
    if (task.timerStatus === 'paused' || offDutyRunning) return 'Paused'
    if (task.timerStatus === 'running') return 'Running'
    return 'Not started'
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        {!embedded && (
          <PageHeader
            title="Task Sprint Board"
            description="Track cross-project task assignments, sprint statuses, and subtask execution timelines"
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Trash"
                  onClick={() => setShowTrash(true)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-chrome text-muted hover:text-fg hover:bg-border transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Button icon={Plus} variant="primary" onClick={handleOpenAddModal}>
                  New Task
                </Button>
              </div>
            }
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            {embedded ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  title="Trash"
                  onClick={() => setShowTrash(true)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-xl border border-border bg-chrome text-muted hover:text-fg hover:bg-border transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Button icon={Plus} variant="primary" size="sm" onClick={handleOpenAddModal}>
                  New Task
                </Button>
              </div>
            ) : (
              <>
                <NavLink
                  to="/projects/list"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                        : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
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
                        ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                        : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
                    }`
                  }
                >
                  <Kanban className="w-3.5 h-3.5" /> Task Board
                </NavLink>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!embedded && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-accent" /> Filter Project:
                </span>
                <select
                  value={selectedProjectId || 'all'}
                  onChange={(e) => handleProjectFilterChange(e.target.value)}
                  className="bg-chrome border border-border text-xs text-fg font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer transition-colors"
                >
                  <option value="all">All Projects ({visibleProjects.length})</option>
                  {visibleProjects.map((p) => (
                    <option key={p.projectId || p.id} value={p.projectId || p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="relative w-52">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-chrome border border-border text-xs text-fg placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-chrome border border-border rounded-xl p-0.5">
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
                      : 'text-muted hover:text-slate-900 dark:hover:text-slate-200'
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

      {/* Active Project Filter Alert Banner */}
      {!embedded && selectedProjectId && selectedProjectId !== 'all' && (
        <div className="flex items-center justify-between bg-accent-soft border border-accent/20 rounded-xl px-4 py-2.5 text-xs text-accent">
          <div className="flex items-center gap-2">
            <span className="font-medium text-muted">
              Showing tasks for project:
            </span>
            <span className="bg-accent text-white px-2.5 py-0.5 rounded-lg font-bold">
              {activeProject ? activeProject.name : selectedProjectId}
            </span>
            <span className="text-muted">
              ({filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'})
            </span>
          </div>
          <button
            onClick={() => handleProjectFilterChange('all')}
            className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <X className="w-3.5 h-3.5" /> Show All Projects
          </button>
        </div>
      )}

      {/* Task Views: Board / List / Calendar */}
      {viewMode === 'list' && (
        <TaskListView
          tasks={filteredTasks}
          statuses={visibleStatuses}
          onTaskClick={setSelectedTask}
          onStatusChange={updateTaskStatus}
          metaLabel="Timer"
          getMetaValue={formatTaskTimerLabel}
        />
      )}

      {viewMode === 'calendar' && (
        <TaskCalendarView
          tasks={filteredTasks}
          statuses={visibleStatuses}
          onTaskClick={setSelectedTask}
        />
      )}

      {viewMode === 'board' && (
      <div className="min-w-0">
      <div
        ref={boardBarRef}
        onScroll={() => {
          if (boardScrollSync.current) return
          const bar = boardBarRef.current
          const board = boardScrollRef.current
          if (!bar || !board) return
          boardScrollSync.current = true
          board.scrollLeft = bar.scrollLeft
          boardScrollSync.current = false
        }}
        className="mb-2 overflow-x-scroll overflow-y-hidden [scrollbar-width:thin] [scrollbar-color:rgb(148_163_184)_rgb(226_232_240)] dark:[scrollbar-color:rgb(100_116_139)_rgb(30_41_59)] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-200 dark:[&::-webkit-scrollbar-track]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-slate-500"
        aria-label="Scroll task columns"
      >
        <div style={{ width: boardScrollWidth || '100%' }} className="h-px" />
      </div>
      <div
        ref={boardScrollRef}
        onScroll={() => {
          if (boardScrollSync.current) return
          const bar = boardBarRef.current
          const board = boardScrollRef.current
          if (!bar || !board) return
          boardScrollSync.current = true
          bar.scrollLeft = board.scrollLeft
          boardScrollSync.current = false
        }}
        className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visibleStatuses.map((status) => {
          const colTasks = filteredTasks.filter((t) => t.status === status.id)
          const allowDelete = canDeleteStatus(status)

          return (
            <div
              key={status.id}
              onDragOver={(e) => handleDragOver(e, status.id)}
              onDragLeave={(e) => handleDragLeave(e, status.id)}
              onDrop={(e) => handleDrop(e, status.id)}
              className={`w-72 shrink-0 border rounded-2xl p-3 flex flex-col space-y-3 transition-all ${
                draggedOverCol === status.id
                  ? 'bg-accent-soft border-accent/80 ring-2 ring-accent/40 shadow-lg'
                  : 'bg-chrome border-border'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                <span className="font-bold text-fg text-xs flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${getStatusDotBg(status)}`} />
                  {status.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant="brand">{colTasks.length}</Badge>
                  {allowDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmStatus(status)
                      }}
                      title="Delete Custom Status"
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                {colTasks.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-xl text-[11px] text-slate-400 dark:text-slate-500 bg-white/50 dark:bg-transparent">
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
                          <span className="text-xs font-bold text-fg group-hover:text-accent transition-colors">
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

                        <p className="text-[11px] text-accent font-medium truncate">
                          {t.projectName}
                        </p>

                        {/* Subtask Mini Stepper Bar on Kanban Card */}
                        <SubtaskStepper taskId={t.taskId} subtasks={t.subtasks || []} compact={true} />

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                          <span className="flex items-center gap-1 text-[11px] text-muted">
                            <Clock className="w-3 h-3 text-accent" />{' '}
                            {formatTaskTimerLabel(t)}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-muted">
                            <User className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {t.assigneeName}
                          </span>
                        </div>

                        <div
                          className="pt-2 flex items-center justify-between gap-2 text-[10px] text-muted"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex items-center gap-1.5 shrink-0">
                            Status:
                            {t.timerStatus === 'running' && t.status !== 'done' && t.status !== 'todo' && (
                              <button
                                type="button"
                                onClick={() => pauseTaskTimer(t.taskId)}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-chrome text-muted hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 transition-colors"
                                title="Pause timer"
                              >
                                <Pause className="w-2.5 h-2.5" /> Pause
                              </button>
                            )}
                            {t.timerStatus === 'paused' && t.status !== 'done' && t.status !== 'todo' && (
                              <button
                                type="button"
                                onClick={() => resumeTaskTimer(t.taskId)}
                                disabled={!isEmployeeActivelyWorking({ clockedIn, isOnBreak, isOnLunch })}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent-soft text-accent hover:bg-accent-soft dark:hover:bg-accent-hover/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  isEmployeeActivelyWorking({ clockedIn, isOnBreak, isOnLunch })
                                    ? 'Resume timer'
                                    : 'Clock in to resume the timer'
                                }
                              >
                                <Play className="w-2.5 h-2.5" /> Resume
                              </button>
                            )}
                          </span>
                          <select
                            value={t.status}
                            onChange={(e) => updateTaskStatus(t.taskId, e.target.value)}
                            className="bg-chrome border border-border text-[10px] text-fg rounded px-1.5 py-0.5 focus:outline-none min-w-0"
                          >
                            {visibleStatuses.map((s) => (
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

        {/* Sticky Floating + Add Status Button */}
        <div className="sticky right-0 shrink-0 self-start z-10 pl-3 py-1 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent dark:from-canvas dark:via-canvas/90">
          <button
            type="button"
            onClick={() => setShowAddStatusModal(true)}
            title="Add Custom Status Column"
            className="w-10 h-10 rounded-2xl bg-accent hover:bg-accent-hover text-white flex items-center justify-center transition-all shadow-lg shadow-accent/30 hover:scale-105 active:scale-95 border border-accent/30 group"
          >
            <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>
      </div>
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
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
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
                  disabled={embedded}
                  className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {visibleProjects.map((p) => (
                    <option
                      key={p.projectId || p.id}
                      value={p.projectId || p.id}
                      className="bg-surface text-fg"
                    >
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
                  className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="low" className="bg-surface text-fg">Low</option>
                  <option value="medium" className="bg-surface text-fg">Medium</option>
                  <option value="high" className="bg-surface text-fg">High</option>
                  <option value="critical" className="bg-surface text-fg">Critical</option>
                </select>
              </div>

              <p className="text-[11px] text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-accent" />
                Timer starts automatically when the task is created.
              </p>

              {createError && (
                <p className="text-xs font-semibold text-rose-500">{createError}</p>
              )}

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

      {/* Task Time & Subtask Timeline Detail Modal */}
      {liveSelectedTask && (() => {
        const statusMeta = visibleStatuses.find((status) => status.id === liveSelectedTask.status)
        const dueLabel = formatTaskDate(liveSelectedTask.dueDate)
        const assigneeName = liveSelectedTask.assigneeName || 'Unassigned'
        const createdByName = liveSelectedTask.createdByName || liveSelectedTask.assigneeName || 'Employee'
        const stateLabel = timerStateLabel(liveSelectedTask)
        const activelyWorking = isEmployeeActivelyWorking({ clockedIn, isOnBreak, isOnLunch })
        const timerHeld =
          !activelyWorking &&
          (liveSelectedTask.timerStatus === 'paused' || liveSelectedTask.timerStatus === 'running') &&
          liveSelectedTask.status !== 'done' &&
          liveSelectedTask.status !== 'todo'
        const priorityLabel = String(liveSelectedTask.priority || 'medium')
        const stateTone =
          stateLabel === 'Running'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30'
            : stateLabel === 'Paused'
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30'
              : 'bg-chrome text-muted border-border'
        return (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!deleteConfirmTask) setSelectedTask(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
            className="w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden bg-surface border border-border rounded-2xl shadow-2xl text-fg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 border-b border-border px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 id="task-detail-title" className="text-lg font-bold text-fg break-words">
                    {liveSelectedTask.title}
                  </h3>
                  <p className="text-xs text-accent font-medium mt-0.5">{liveSelectedTask.projectName}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-chrome px-2 py-0.5 text-[11px] font-semibold text-fg">
                      <span className={`h-2 w-2 rounded-full ${getStatusDotBg(statusMeta || liveSelectedTask.status)}`} />
                      {statusMeta?.name || 'To Do'}
                    </span>
                    <Badge
                      variant={
                        liveSelectedTask.priority === 'critical' || liveSelectedTask.priority === 'high'
                          ? 'danger'
                          : 'info'
                      }
                    >
                      {priorityLabel}
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-chrome px-2 py-0.5 text-[11px] font-medium text-fg">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent-soft text-[9px] font-bold text-accent">
                        {(assigneeName.trim().charAt(0) || '?').toUpperCase()}
                      </span>
                      {assigneeName}
                    </span>
                    {dueLabel && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-chrome px-2 py-0.5 text-[11px] font-medium text-fg">
                        <Calendar className="w-3 h-3 text-muted" />
                        Due {dueLabel}
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-border bg-chrome px-2 py-0.5 text-[11px] font-medium text-muted">
                      Created by {createdByName}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2 shrink-0">
                  <div className="text-right" title="Runs only while clocked in">
                    <div className="font-mono text-lg font-bold tabular-nums text-fg leading-none">
                      {taskElapsedLabel(liveSelectedTask)}
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stateTone}`}>
                        {stateLabel}
                      </span>
                      {liveSelectedTask.timerStatus === 'running' && liveSelectedTask.status !== 'done' && liveSelectedTask.status !== 'todo' && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Pause}
                          onClick={() => pauseTaskTimer(liveSelectedTask.taskId)}
                        >
                          Pause
                        </Button>
                      )}
                      {liveSelectedTask.timerStatus === 'paused' && liveSelectedTask.status !== 'done' && liveSelectedTask.status !== 'todo' && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          icon={Play}
                          disabled={!activelyWorking}
                          title={activelyWorking ? 'Resume timer' : 'Clock in to resume the timer'}
                          onClick={() => resumeTaskTimer(liveSelectedTask.taskId)}
                        >
                          Resume
                        </Button>
                      )}
                    </div>
                    {timerHeld && (
                      <p className="mt-1 text-[11px] text-muted">Paused - clock in to resume</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTask(null)}
                    aria-label="Close"
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <SubtaskStepper
                taskId={liveSelectedTask.taskId}
                subtasks={liveSelectedTask.subtasks || []}
                onActiveSubtaskChange={setActiveSubtaskId}
                onCommentSubtask={(subtask) => {
                  setActiveSubtaskId(subtask.id)
                  setCommentFocus((value) => value + 1)
                }}
              />
              <TaskActivity
                taskId={liveSelectedTask.taskId}
                activity={liveSelectedTask.activity || []}
                focusRequest={commentFocus}
                subtask={
                  (liveSelectedTask.subtasks || []).find((st) => st.id === activeSubtaskId) || null
                }
              />
            </div>

            <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => setDeleteConfirmTask(liveSelectedTask)}
              >
                Delete task
              </Button>
              {liveSelectedTask.status === 'done' && (
                <span className="text-xs text-muted">Task is done</span>
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedTask(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
        )
      })()}

      {/* Confirm Delete Task Modal */}
      {deleteConfirmTask && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Task
              </h3>
              <button
                onClick={() => setDeleteConfirmTask(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Move <strong className="text-fg">{deleteConfirmTask.title}</strong> to Trash? Open the trash icon on this page if you want to restore it.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmTask(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const id = deleteConfirmTask?.taskId || deleteConfirmTask?.id
                  if (!id) {
                    setDeleteConfirmTask(null)
                    return
                  }
                  try {
                    await deleteTask(id)
                    setDeleteConfirmTask(null)
                    setSelectedTask(null)
                  } catch (err) {
                    console.error('Error deleting task:', err)
                  }
                }}
              >
                Move to Trash
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirm Delete Status Modal */}
      {deleteConfirmStatus && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Status Column
              </h3>
              <button
                onClick={() => setDeleteConfirmStatus(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete status column <strong className="text-fg">{deleteConfirmStatus.name}</strong>? Any tasks currently in this status will be automatically moved to <strong className="text-accent">To Do</strong>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmStatus(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await deleteCustomStatus(deleteConfirmStatus.id)
                  setDeleteConfirmStatus(null)
                }}
              >
                Yes, Delete Status
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create Custom Status Modal */}
      {showAddStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Add Custom Task Status</h3>
              <button
                onClick={() => setShowAddStatusModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStatus} className="space-y-4">
              <Input
                label="Status Name"
                placeholder="e.g. In QA, Blocked, Testing, Backlog"
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                required
              />

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-fg">Badge Theme Color</label>
                <select
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  className="w-full bg-chrome border border-border text-xs text-fg rounded-xl p-2.5 focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="purple">Purple Theme</option>
                  <option value="indigo">Indigo Theme</option>
                  <option value="blue">Blue Theme</option>
                  <option value="emerald">Emerald Theme</option>
                  <option value="amber">Amber Theme</option>
                  <option value="rose">Rose / Red Theme</option>
                  <option value="cyan">Cyan Theme</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddStatusModal(false)}
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Add Status
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      <EmployeeTrashPanel open={showTrash} kind="tasks" onClose={() => setShowTrash(false)} />
    </div>
  )
}
