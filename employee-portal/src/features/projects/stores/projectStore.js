import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getProjectsFromDb,
  getTasksFromDb,
  getTaskStatusesFromDb,
  createTaskStatusInDb,
  createProjectInDb,
  createTaskInDb,
  updateTaskStatusInDb,
  updateTaskSubtasksInDb,
  logHoursToTaskInDb,
  updateTaskTimerInDb,
  startTimerFields,
  idleTimerFields,
  timerPatchForStatusMove,
  pauseTimerFields,
  resumeTimerFields,
  stopTimerFields,
  deleteTaskFromDb,
  restoreTaskFromDb,
  permanentlyDeleteTaskFromDb,
  appendTaskActivityInDb,
  deleteTaskStatusFromDb,
  updateProjectMembersInDb,
  updateProjectInDb,
  updateProjectStatsInDb,
  deleteProjectFromDb,
  restoreProjectFromDb,
  permanentlyDeleteProjectFromDb,
  computeProjectMetrics,
  applyProjectTaskMetrics,
  isEmployeeActivelyWorking,
  isTaskTimerOwnedByUser,
  DEFAULT_TASK_STATUSES,
} from '../services/projectService'
import { useTeamStore } from '../../team/stores/teamStore'
import {
  commentEntry,
  mergeActivity,
  subtaskHistoryEntries,
  taskStatusHistory,
} from '../services/taskActivity'

const applySubtaskWorkflowStatus = (st, status) => {
  const nextStatus = status || 'todo'
  const now = new Date().toISOString()
  const base = { ...st, status: nextStatus, isCompleted: nextStatus === 'done' }

  if (nextStatus === 'done') {
    return { ...base, ...stopTimerFields(st, now) }
  }

  if (nextStatus === 'todo') {
    const priorStatus = st.status || 'todo'
    if (priorStatus !== 'todo' && st.timerStatus === 'running') {
      return { ...base, ...pauseTimerFields(st, now, { byAttendance: false }) }
    }
    return {
      ...base,
      timerStatus: 'paused',
      timerAccumulatedMs: Number(st.timerAccumulatedMs) || 0,
      timerStartedAt: null,
      timerStoppedAt: null,
      timerPausedByAttendance: false,
    }
  }

  const counted =
    (st.status || 'todo') === 'todo' && st.timerStatus === 'running'
      ? { ...st, timerStatus: 'paused', timerStartedAt: null, timerAccumulatedMs: Number(st.timerAccumulatedMs) || 0 }
      : st

  const working = counted.timerStatus === 'stopped'
    ? { ...counted, timerStatus: 'paused', timerAccumulatedMs: Number(counted.timerAccumulatedMs) || 0, timerStoppedAt: null }
    : counted

  if (!isEmployeeActivelyWorking(attendanceSnapshot())) {
    if (working.timerStatus === 'running') {
      return { ...base, ...pauseTimerFields(working, now, { byAttendance: true }) }
    }
    return {
      ...base,
      timerStatus: 'paused',
      timerAccumulatedMs: Number(working.timerAccumulatedMs) || 0,
      timerStartedAt: null,
      timerStoppedAt: null,
      timerPausedByAttendance: true,
    }
  }

  if (working.timerStatus === 'running') return { ...base, ...working, status: nextStatus, isCompleted: false }
  return { ...base, ...resumeTimerFields(working, now) }
}

const attendanceSnapshot = () => {
  const { clockedIn, isOnBreak, isOnLunch } = useTeamStore.getState()
  return { clockedIn, isOnBreak, isOnLunch }
}

const applyMetricsToProjects = (projects = [], tasks = []) => {
  const attendance = attendanceSnapshot()
  return (projects || []).map((p) => {
    const pId = p.projectId || p.id
    return applyProjectTaskMetrics(p, computeProjectMetrics(pId, tasks, attendance))
  })
}

let attendanceTimerSyncChain = Promise.resolve()

let projectsFetchInflight = null

const DEMO_PROJECTS = [
  {
    projectId: 'proj_201',
    name: 'SaaS Platform Redesign',
    description: 'Complete UI/UX refactor with Tailwind CSS & React 19',
    status: 'active',
    completionPercent: 75,
    totalTaskCount: 8,
    completedTaskCount: 6,
    totalHoursLogged: 142,
    createdAt: '2024-07-01T10:00:00.000Z',
  },
  {
    projectId: 'proj_202',
    name: 'Mobile App API Integration',
    description: 'REST API endpoint setup and authentication middleware',
    status: 'active',
    completionPercent: 40,
    totalTaskCount: 5,
    completedTaskCount: 2,
    totalHoursLogged: 68,
    createdAt: '2024-07-10T10:00:00.000Z',
  },
]

const DEMO_TASKS = [
  {
    taskId: 'task_101',
    title: 'Daily Engineering & Architecture Sprint',
    description: 'Complete core engineering deliverables, architecture syncs, and client handoffs',
    projectId: 'proj_201',
    projectName: 'SaaS Platform Redesign',
    priority: 'high',
    status: 'in_progress',
    loggedHours: 12,
    estimatedHours: 14,
    dueDate: '2024-07-28',
    subtasks: [
      { id: 'sub_1', title: 'Daily Engineering Standup', isCompleted: true },
      { id: 'sub_2', title: 'AWS Cloud Architecture Sync', isCompleted: true },
      { id: 'sub_3', title: 'Sprint Review & Code Walkthrough', isCompleted: false },
      { id: 'sub_4', title: 'Client Deliverable Handoff', isCompleted: false },
    ],
  },
  {
    taskId: 'task_102',
    title: 'Implement Dark Mode Theme Toggle',
    description: 'Ensure dark class applies to html root and persists to localStorage',
    projectId: 'proj_201',
    projectName: 'SaaS Platform Redesign',
    priority: 'high',
    status: 'done',
    loggedHours: 12,
    estimatedHours: 14,
    dueDate: '2024-07-28',
    subtasks: [
      { id: 'sub_101', title: 'Setup CSS Variables & Color Tokens', isCompleted: true },
      { id: 'sub_102', title: 'Create Theme Switcher Component', isCompleted: true },
      { id: 'sub_103', title: 'Test Across Browsers & LocalStorage', isCompleted: true },
    ],
  },
  {
    taskId: 'task_103',
    title: 'Design Component Design System',
    description: 'Create reusable Card, Badge, Button, and Modal components',
    projectId: 'proj_201',
    projectName: 'SaaS Platform Redesign',
    priority: 'critical',
    status: 'in_progress',
    loggedHours: 24,
    estimatedHours: 30,
    dueDate: '2024-08-05',
    subtasks: [
      { id: 'sub_201', title: 'Figma UI Wireframe Sync', isCompleted: true },
      { id: 'sub_202', title: 'Build Atomic UI Components in React', isCompleted: false },
      { id: 'sub_203', title: 'Team Accessibility & Theme Review', isCompleted: false },
    ],
  },
  {
    taskId: 'task_104',
    title: 'Audit API Rate Limits & Auth Tokens',
    description: 'Check Bearer token expiration and token refresh flow',
    projectId: 'proj_202',
    projectName: 'Mobile App API Integration',
    priority: 'medium',
    status: 'todo',
    loggedHours: 4,
    estimatedHours: 10,
    dueDate: '2024-08-10',
    subtasks: [
      { id: 'sub_301', title: 'Review Token Refresh Security SOP', isCompleted: false },
      { id: 'sub_302', title: 'Benchmark API Middleware Rate Limiter', isCompleted: false },
    ],
  },
]

export const useProjectStore = create(
  persist(
    (set, get) => ({
      projects: [],
      tasks: [],
      statuses: DEFAULT_TASK_STATUSES,
      loading: false,
      selectedProjectId: null,
      taskFilterStatus: 'all',

      lastFetchedAt: 0,

      setProjects: (projects) => set({ projects: projects || [] }),
      setTasks: (tasks) => set({ tasks: tasks || [] }),
      setStatuses: (statuses) => set({ statuses }),
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
      setTaskFilterStatus: (taskFilterStatus) => set({ taskFilterStatus }),

      fetchProjectsAndTasks: async (force = false) => {
        if (!force && projectsFetchInflight) return projectsFetchInflight

        const cached = get()
        const hasCache = (cached.projects?.length || 0) > 0 || (cached.tasks?.length || 0) > 0
        if (
          !force &&
          hasCache &&
          cached.lastFetchedAt &&
          Date.now() - cached.lastFetchedAt < 45_000
        ) {
          return
        }

        if (!hasCache) set({ loading: true })

        projectsFetchInflight = (async () => {
          try {
            const [projectsData, tasksData, statusesData] = await Promise.all([
              getProjectsFromDb(),
              getTasksFromDb(),
              getTaskStatusesFromDb(),
            ])

            const mergedTasks = (tasksData || []).map((dbTask) => {
              return {
                ...dbTask,
                subtasks: dbTask.subtasks || [],
                status: dbTask.status || 'todo',
              }
            })

            const projectsWithMetrics = applyMetricsToProjects(projectsData || [], mergedTasks)

            set({
              projects: projectsWithMetrics,
              tasks: mergedTasks,
              statuses: statusesData && statusesData.length > 0 ? statusesData : DEFAULT_TASK_STATUSES,
              loading: false,
              lastFetchedAt: Date.now(),
            })
          } catch (err) {
            console.error('Error fetching project store data from Firestore:', err)
            set({ loading: false })
          } finally {
            projectsFetchInflight = null
          }
        })()

        return projectsFetchInflight
      },

      addCustomStatus: async (statusObj, currentUser = null) => {
        const id = statusObj.id || statusObj.name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        const isUserAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner' || currentUser?.role === 'superadmin'
        const payload = {
          id,
          name: statusObj.name,
          color: statusObj.color || 'purple',
          createdBy: currentUser?.uid || statusObj.createdBy || null,
          createdByEmail: currentUser?.email || statusObj.createdByEmail || null,
          createdByName: currentUser?.displayName || currentUser?.email || statusObj.createdByName || 'Employee',
          createdByRole: currentUser?.role || statusObj.createdByRole || 'employee',
          isAdminCreated: Boolean(isUserAdmin || statusObj.isAdminCreated),
        }

        set((state) => {
          if (state.statuses.some((s) => s.id === id)) return state
          return { statuses: [...state.statuses, payload] }
        })

        await createTaskStatusInDb(payload)
      },

      deleteCustomStatus: async (statusId) => {
        if (!statusId) return
        const now = new Date().toISOString()
        const attendance = attendanceSnapshot()
        const affectedTasks = get().tasks.filter((t) => t.status === statusId)

        set((state) => ({
          statuses: state.statuses.filter((s) => s.id !== statusId),
          tasks: state.tasks.map((t) => {
            if (t.status !== statusId) return t
            const timerPatch = timerPatchForStatusMove(t, 'todo', attendance, now)
            return { ...t, status: 'todo', ...(timerPatch || {}) }
          }),
        }))

        await deleteTaskStatusFromDb(statusId)
        const projectIds = new Set()
        for (const task of affectedTasks) {
          const timerPatch = timerPatchForStatusMove(task, 'todo', attendance, now)
          await updateTaskStatusInDb(task.taskId, 'todo', timerPatch)
          if (task.projectId) projectIds.add(task.projectId)
        }

        const tasks = get().tasks
        for (const projectId of projectIds) {
          const metrics = computeProjectMetrics(projectId, tasks, attendance)
          set((state) => ({
            projects: state.projects.map((p) =>
              p.projectId === projectId || p.id === projectId
                ? applyProjectTaskMetrics(p, metrics)
                : p
            ),
          }))
          await updateProjectStatsInDb(projectId, metrics)
        }
      },

      addProject: async (newProj) => {
        const payload = {
          projectId: `proj_${Date.now()}`,
          status: 'active',
          type: 'client',
          completionPercent: 0,
          totalTaskCount: 0,
          completedTaskCount: 0,
          totalHoursLogged: 0,
          createdAt: new Date().toISOString(),
          ...newProj,
        }

        set((state) => ({
          projects: [payload, ...state.projects],
        }))

        await createProjectInDb(payload)
      },

      updateProject: async (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.projectId === projectId || p.id === projectId ? { ...p, ...updates } : p
          ),
          tasks: updates.name
            ? state.tasks.map((t) =>
                t.projectId === projectId
                  ? { ...t, projectName: updates.name }
                  : t
              )
            : state.tasks,
        }))

        await updateProjectInDb(projectId, updates)
      },

      updateProjectMembers: async (projectId, members) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.projectId === projectId || p.id === projectId ? { ...p, members } : p
          ),
        }))

        await updateProjectMembersInDb(projectId, members)
      },

      deleteProject: async (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.projectId !== projectId && p.id !== projectId),
          tasks: state.tasks.filter((t) => t.projectId !== projectId),
        }))

        await deleteProjectFromDb(projectId)
      },

      restoreProject: async (projectId) => {
        await restoreProjectFromDb(projectId)
        await get().fetchProjectsAndTasks(true)
      },

      permanentlyDeleteProject: async (projectId) => {
        await permanentlyDeleteProjectFromDb(projectId)
      },


      addTask: async (newTask) => {
        const taskId = `task_${Date.now()}`
        const timer = idleTimerFields()
        const payload = {
          taskId,
          status: 'todo',
          priority: 'medium',
          loggedHours: 0,
          subtasks: newTask.subtasks || [],
          createdBy: newTask.createdBy || null,
          createdByEmail: newTask.createdByEmail || null,
          createdByName: newTask.createdByName || null,
          createdByRole: newTask.createdByRole || 'employee',
          isEmployeeCreated: newTask.isEmployeeCreated !== undefined ? newTask.isEmployeeCreated : true,
          ...newTask,
          ...timer,
          taskId,
        }

        let projectStats = null
        set((state) => {
          const updatedTasks = [payload, ...state.tasks]
          const metrics = computeProjectMetrics(newTask.projectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics

          const updatedProjects = state.projects.map((p) =>
            p.projectId === newTask.projectId || p.id === newTask.projectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await createTaskInDb(payload)
        if (newTask.projectId && projectStats) {
          await updateProjectStatsInDb(newTask.projectId, projectStats)
        }
      },

      updateTaskStatus: async (taskId, newStatus) => {
        let targetSubtasks = []
        let targetProjectId = null
        let projectStats = null
        let timerPatch = null
        const previous = get().tasks.find((t) => t.taskId === taskId)
        const activityEntries = [
          taskStatusHistory(previous?.status, newStatus, get().statuses),
        ].filter(Boolean)

        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            targetSubtasks = t.subtasks || []
            timerPatch = timerPatchForStatusMove(t, newStatus, attendanceSnapshot())
            let next = {
              ...t,
              status: newStatus,
              ...(timerPatch || {}),
              activity: mergeActivity(t.activity, activityEntries),
            }
            if (newStatus === 'done') {
              targetSubtasks = (targetSubtasks || []).map((st) => ({
                ...st,
                isCompleted: true,
                ...(st.timerStatus !== 'stopped' ? stopTimerFields(st) : {}),
              }))
              next.subtasks = targetSubtasks
            }
            return next
          })

          const targetTask = state.tasks.find((t) => t.taskId === taskId)
          if (!targetTask) return { tasks: updatedTasks }

          targetProjectId = targetTask.projectId
          const metrics = computeProjectMetrics(targetTask.projectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics

          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetTask.projectId || p.id === targetTask.projectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskStatusInDb(taskId, newStatus, timerPatch)
        await appendTaskActivityInDb(taskId, activityEntries)
        await updateTaskSubtasksInDb(taskId, targetSubtasks, newStatus)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      pauseTaskTimer: async (taskId) => {
        const targetTask = get().tasks.find((t) => t.taskId === taskId)
        if (!targetTask || targetTask.timerStatus !== 'running') return

        const patch = pauseTimerFields(targetTask, new Date().toISOString(), { byAttendance: false })
        let projectStats = null
        const targetProjectId = targetTask.projectId || null

        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.taskId === taskId ? { ...t, ...patch } : t
          )
          if (!targetProjectId) return { tasks: updatedTasks }
          const metrics = computeProjectMetrics(targetProjectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )
          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskTimerInDb(taskId, patch)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      resumeTaskTimer: async (taskId) => {
        const targetTask = get().tasks.find((t) => t.taskId === taskId)
        if (!targetTask || targetTask.timerStatus !== 'paused') return
        if (targetTask.status === 'done' || targetTask.status === 'todo') return
        if (!isEmployeeActivelyWorking(attendanceSnapshot())) return

        const patch = resumeTimerFields(targetTask)

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.taskId === taskId ? { ...t, ...patch } : t
          ),
        }))

        await updateTaskTimerInDb(taskId, patch)
      },

      syncTaskTimersWithAttendance: async ({
        clockedIn,
        isOnBreak,
        isOnLunch,
        user,
        userDoc,
        freezeElapsed = false,
      } = {}) => {
        const job = attendanceTimerSyncChain.then(async () => {
          const attendance = {
            clockedIn: clockedIn ?? attendanceSnapshot().clockedIn,
            isOnBreak: isOnBreak ?? attendanceSnapshot().isOnBreak,
            isOnLunch: isOnLunch ?? attendanceSnapshot().isOnLunch,
          }
          const active = isEmployeeActivelyWorking(attendance)
          const now = new Date().toISOString()
          const persisted = []
          const projectIds = new Set()

          set((state) => {
            const updatedTasks = state.tasks.map((t) => {
              if (!isTaskTimerOwnedByUser(t, user, userDoc) || t.status === 'done') return t

              let next = t
              let parentChanged = false
              let subtasksChanged = false

              if (t.status === 'todo' && t.timerStatus === 'running') {
                next = {
                  ...t,
                  ...pauseTimerFields(t, now, { byAttendance: false }),
                }
                parentChanged = true
              } else if (!active) {
                if (t.timerStatus === 'running') {
                  next = {
                    ...t,
                    ...pauseTimerFields(t, now, { byAttendance: true, freezeElapsed }),
                  }
                  parentChanged = true
                }
              } else if (t.status !== 'todo' && t.timerStatus === 'paused' && t.timerPausedByAttendance) {
                next = { ...t, ...resumeTimerFields(t, now) }
                parentChanged = true
              }

              const subtasks = (next.subtasks || []).map((st) => {
                const subtaskStatus = st.status || (st.isCompleted ? 'done' : 'todo')
                if (subtaskStatus === 'done' || st.isCompleted) {
                  if (st.timerStatus !== 'running') return st
                  subtasksChanged = true
                  return { ...st, status: 'done', isCompleted: true, ...stopTimerFields(st, now) }
                }
                if (subtaskStatus === 'todo') {
                  if (st.timerStatus !== 'running') return st
                  subtasksChanged = true
                  return { ...st, ...pauseTimerFields(st, now, { byAttendance: false }) }
                }
                if (!active) {
                  if (st.timerStatus !== 'running') return st
                  subtasksChanged = true
                  return {
                    ...st,
                    ...pauseTimerFields(st, now, { byAttendance: true, freezeElapsed }),
                  }
                }
                if (st.timerStatus !== 'paused' || !st.timerPausedByAttendance) return st
                subtasksChanged = true
                return { ...st, ...resumeTimerFields(st, now) }
              })
              if (subtasksChanged) next = { ...next, subtasks }

              if (parentChanged || subtasksChanged) {
                persisted.push({
                  taskId: next.taskId,
                  patch: parentChanged
                    ? {
                        timerStatus: next.timerStatus,
                        timerAccumulatedMs: next.timerAccumulatedMs,
                        timerStartedAt: next.timerStartedAt,
                        timerStoppedAt: next.timerStoppedAt,
                        loggedHours: next.loggedHours,
                        timerPausedByAttendance: next.timerPausedByAttendance,
                      }
                    : null,
                  subtasks: subtasksChanged ? next.subtasks : null,
                  status: next.status,
                })
                if (next.projectId) projectIds.add(next.projectId)
              }

              return next
            })

            if (!persisted.length) return state

            let updatedProjects = state.projects
            const statsByProject = {}
            for (const pId of projectIds) {
              const metrics = computeProjectMetrics(pId, updatedTasks, attendance)
              statsByProject[pId] = metrics
              updatedProjects = updatedProjects.map((p) =>
                p.projectId === pId || p.id === pId ? applyProjectTaskMetrics(p, metrics) : p
              )
            }

            persisted._statsByProject = statsByProject
            return { tasks: updatedTasks, projects: updatedProjects }
          })

          const statsByProject = persisted._statsByProject || {}
          delete persisted._statsByProject

          for (const item of persisted) {
            if (item.patch) await updateTaskTimerInDb(item.taskId, item.patch)
            if (item.subtasks) await updateTaskSubtasksInDb(item.taskId, item.subtasks, item.status)
          }
          for (const [pId, metrics] of Object.entries(statsByProject)) {
            await updateProjectStatsInDb(pId, metrics)
          }
        })

        attendanceTimerSyncChain = job.catch((err) => {
          console.error('Error syncing task timers with attendance:', err)
        })
        return job
      },

      logHoursToTask: async (taskId, hours) => {
        const state = get()
        const targetTask = state.tasks.find((t) => t.taskId === taskId)
        const currentHours = targetTask ? Number(targetTask.loggedHours) || 0 : 0
        let projectStats = null
        const targetProjectId = targetTask?.projectId || null

        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.taskId === taskId
              ? { ...t, loggedHours: (Number(t.loggedHours) || 0) + Number(hours) }
              : t
          )

          if (!targetProjectId) return { tasks: updatedTasks }

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await logHoursToTaskInDb(taskId, hours, currentHours)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      deleteTask: async (taskId) => {
        const existing = get().tasks.find((t) => t.taskId === taskId)
        const targetProjectId = existing?.projectId || null
        let projectStats = null

        set((state) => {
          const updatedTasks = state.tasks.filter((t) => t.taskId !== taskId)
          if (!targetProjectId) return { tasks: updatedTasks }

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await deleteTaskFromDb(taskId)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      restoreTask: async (taskId) => {
        await restoreTaskFromDb(taskId)
        await get().fetchProjectsAndTasks(true)
      },

      permanentlyDeleteTask: async (taskId) => {
        await permanentlyDeleteTaskFromDb(taskId)
      },

      // Subtask Store Actions with Firestore Persistence
      addSubtask: async (taskId, newSubtask) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            const existingSubtasks = t.subtasks || []
            const createdSubtask = applySubtaskWorkflowStatus(
              {
                id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                title: newSubtask.title,
                description: newSubtask.description || null,
                priority: newSubtask.priority || 'medium',
                assigneeId: newSubtask.assigneeId || null,
                assigneeName: newSubtask.assigneeName || null,
                assigneeEmail: newSubtask.assigneeEmail || null,
                startDate: newSubtask.startDate || null,
                dueDate: newSubtask.dueDate || null,
                status: 'todo',
                isCompleted: false,
                timerStatus: 'paused',
                timerAccumulatedMs: 0,
                timerStartedAt: null,
                timerStoppedAt: null,
                timerPausedByAttendance: false,
                loggedHours: 0,
                createdBy: newSubtask.createdBy || null,
                createdByEmail: newSubtask.createdByEmail || null,
                createdByName: newSubtask.createdByName || null,
              },
              newSubtask.status || 'todo'
            )
            updatedSubtasks = [...existingSubtasks, createdSubtask]
            currentTaskStatus = t.status
            return {
              ...t,
              subtasks: updatedSubtasks,
            }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      pauseSubtaskTimer: async (taskId, subtaskId) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            currentTaskStatus = t.status
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId || st.timerStatus !== 'running') return st
              return { ...st, ...pauseTimerFields(st, new Date().toISOString(), { byAttendance: false }) }
            })
            return { ...t, subtasks: updatedSubtasks }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      resumeSubtaskTimer: async (taskId, subtaskId) => {
        if (!isEmployeeActivelyWorking(attendanceSnapshot())) return
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            currentTaskStatus = t.status
            updatedSubtasks = (t.subtasks || []).map((st) => {
              const subtaskStatus = st.status || (st.isCompleted ? 'done' : 'todo')
              if (
                st.id !== subtaskId ||
                st.timerStatus !== 'paused' ||
                st.isCompleted ||
                subtaskStatus === 'todo' ||
                subtaskStatus === 'done'
              ) {
                return st
              }
              return { ...st, ...resumeTimerFields(st) }
            })
            return { ...t, subtasks: updatedSubtasks }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      toggleSubtask: async (taskId, subtaskId) => {
        let updatedSubtasks = []
        let nextStatus = 'todo'
        let targetProjectId = null
        let projectStats = null
        let taskTimerPatch = null
        let activityEntries = []

        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            activityEntries = []
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId) return st
              const next = st.isCompleted || st.status === 'done'
                ? applySubtaskWorkflowStatus(st, 'todo')
                : applySubtaskWorkflowStatus(st, 'done')
              activityEntries.push(...subtaskHistoryEntries(st, next, state.statuses))
              return next
            })

            const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.isCompleted)
            nextStatus = allDone ? 'done' : t.status === 'done' ? 'in_progress' : t.status
            targetProjectId = t.projectId

            const statusEvent = taskStatusHistory(t.status, nextStatus, state.statuses)
            if (statusEvent) activityEntries.push(statusEvent)

            let nextTask = {
              ...t,
              subtasks: updatedSubtasks,
              status: nextStatus,
              activity: mergeActivity(t.activity, activityEntries),
            }

            if (nextStatus === 'done' && t.timerStatus !== 'stopped') {
              taskTimerPatch = stopTimerFields(t)
              nextTask = { ...nextTask, ...taskTimerPatch }
            }

            return nextTask
          })

          if (!targetProjectId) return { tasks: updatedTasks }

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, nextStatus)
        await appendTaskActivityInDb(taskId, activityEntries)
        await updateTaskStatusInDb(taskId, nextStatus, taskTimerPatch)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      deleteSubtask: async (taskId, subtaskId) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            updatedSubtasks = (t.subtasks || []).filter((st) => st.id !== subtaskId)
            currentTaskStatus = t.status
            return {
              ...t,
              subtasks: updatedSubtasks,
            }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      updateSubtask: async (taskId, subtaskId, updates) => {
        let updatedSubtasks = []
        let nextStatus = 'todo'
        let targetProjectId = null
        let projectStats = null
        let taskTimerPatch = null
        let activityEntries = []
        const statusChanging = updates.status !== undefined

        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            nextStatus = t.status
            targetProjectId = t.projectId
            activityEntries = []
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId) return st
              let next = {
                ...st,
                title: updates.title?.trim() || st.title,
                description:
                  updates.description !== undefined
                    ? updates.description?.trim() || null
                    : st.description,
                priority: updates.priority || st.priority || 'medium',
                assigneeId:
                  updates.assigneeId !== undefined ? updates.assigneeId || null : st.assigneeId || null,
                assigneeName:
                  updates.assigneeName !== undefined ? updates.assigneeName || null : st.assigneeName || null,
                assigneeEmail:
                  updates.assigneeEmail !== undefined ? updates.assigneeEmail || null : st.assigneeEmail || null,
                startDate:
                  updates.startDate !== undefined ? updates.startDate || null : st.startDate || null,
                dueDate: updates.dueDate !== undefined ? updates.dueDate || null : st.dueDate || null,
              }
              if (statusChanging) next = applySubtaskWorkflowStatus(next, updates.status)
              activityEntries.push(...subtaskHistoryEntries(st, next, state.statuses))
              return next
            })

            if (statusChanging) {
              const allDone =
                updatedSubtasks.length > 0 &&
                updatedSubtasks.every((st) => st.isCompleted || st.status === 'done')
              nextStatus = allDone ? 'done' : t.status === 'done' ? 'in_progress' : t.status
            }

            const statusEvent = taskStatusHistory(t.status, nextStatus, state.statuses)
            if (statusEvent) activityEntries.push(statusEvent)

            let nextTask = {
              ...t,
              subtasks: updatedSubtasks,
              status: nextStatus,
              activity: mergeActivity(t.activity, activityEntries),
            }
            if (statusChanging && nextStatus === 'done' && t.timerStatus !== 'stopped') {
              taskTimerPatch = stopTimerFields(t)
              nextTask = { ...nextTask, ...taskTimerPatch }
            }
            return nextTask
          })

          if (!targetProjectId) return { tasks: updatedTasks }

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks, attendanceSnapshot())
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? applyProjectTaskMetrics(p, metrics)
              : p
          )
          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, nextStatus)
        await appendTaskActivityInDb(taskId, activityEntries)
        if (statusChanging) {
          await updateTaskStatusInDb(taskId, nextStatus, taskTimerPatch)
          if (targetProjectId && projectStats) {
            await updateProjectStatsInDb(targetProjectId, projectStats)
          }
        }
      },

      addSubtaskComment: async (taskId, subtaskId, text) => {
        const entry = commentEntry(text)
        if (!taskId || !subtaskId || !entry) return
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            currentTaskStatus = t.status
            updatedSubtasks = (t.subtasks || []).map((st) =>
              st.id === subtaskId
                ? { ...st, comments: [...(Array.isArray(st.comments) ? st.comments : []), entry] }
                : st
            )
            return { ...t, subtasks: updatedSubtasks }
          }),
        }))
        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      addTaskComment: async (taskId, text) => {
        const entry = commentEntry(text)
        if (!taskId || !entry) return
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.taskId === taskId ? { ...t, activity: mergeActivity(t.activity, [entry]) } : t
          ),
        }))
        await appendTaskActivityInDb(taskId, [entry])
      },
    }),
    {
      name: 'crm_employee_project_store',
      partialize: (state) => ({
        tasks: state.tasks,
        projects: state.projects,
        statuses: state.statuses,
      }),
    }
  )
)
