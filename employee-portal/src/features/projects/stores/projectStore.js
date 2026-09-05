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
  pauseTimerFields,
  resumeTimerFields,
  stopTimerFields,
  deleteTaskFromDb,
  deleteTaskStatusFromDb,
  updateProjectMembersInDb,
  updateProjectInDb,
  updateProjectStatsInDb,
  deleteProjectFromDb,
  computeProjectMetrics,
  DEFAULT_TASK_STATUSES,
} from '../services/projectService'

const applyMetricsToProjects = (projects = [], tasks = []) =>
  (projects || []).map((p) => {
    const pId = p.projectId || p.id
    return {
      ...p,
      ...computeProjectMetrics(pId, tasks),
    }
  })

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

      setProjects: (projects) => set({ projects: projects || [] }),
      setTasks: (tasks) => set({ tasks: tasks || [] }),
      setStatuses: (statuses) => set({ statuses }),
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
      setTaskFilterStatus: (taskFilterStatus) => set({ taskFilterStatus }),

      fetchProjectsAndTasks: async () => {
        set({ loading: true })
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

          // Always derive card metrics from live tasks so counts/velocity stay accurate
          const projectsWithMetrics = applyMetricsToProjects(projectsData || [], mergedTasks)

          set({
            projects: projectsWithMetrics,
            tasks: mergedTasks,
            statuses: statusesData && statusesData.length > 0 ? statusesData : DEFAULT_TASK_STATUSES,
            loading: false,
          })
        } catch (err) {
          console.error('Error fetching project store data from Firestore:', err)
          set({ loading: false })
        }
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
        const affectedTasks = get().tasks.filter((t) => t.status === statusId)

        set((state) => ({
          statuses: state.statuses.filter((s) => s.id !== statusId),
          tasks: state.tasks.map((t) => (t.status === statusId ? { ...t, status: 'todo' } : t)),
        }))

        await deleteTaskStatusFromDb(statusId)
        for (const task of affectedTasks) {
          await updateTaskStatusInDb(task.taskId, 'todo')
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
        }))

        await deleteProjectFromDb(projectId)
      },


      addTask: async (newTask) => {
        const taskId = `task_${Date.now()}`
        const timer = startTimerFields()
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
          const metrics = computeProjectMetrics(newTask.projectId, updatedTasks)
          projectStats = metrics

          const updatedProjects = state.projects.map((p) =>
            p.projectId === newTask.projectId || p.id === newTask.projectId
              ? { ...p, ...metrics }
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

        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            targetSubtasks = t.subtasks || []
            let next = { ...t, status: newStatus }
            if (newStatus === 'done') {
              if (t.timerStatus !== 'stopped') {
                timerPatch = stopTimerFields(t)
                next = { ...next, ...timerPatch }
              }
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
          const metrics = computeProjectMetrics(targetTask.projectId, updatedTasks)
          projectStats = metrics

          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetTask.projectId || p.id === targetTask.projectId
              ? { ...p, ...metrics }
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskStatusInDb(taskId, newStatus, timerPatch)
        await updateTaskSubtasksInDb(taskId, targetSubtasks, newStatus)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      pauseTaskTimer: async (taskId) => {
        const targetTask = get().tasks.find((t) => t.taskId === taskId)
        if (!targetTask || targetTask.timerStatus !== 'running') return

        const patch = pauseTimerFields(targetTask)
        let projectStats = null
        const targetProjectId = targetTask.projectId || null

        set((state) => {
          const updatedTasks = state.tasks.map((t) =>
            t.taskId === taskId ? { ...t, ...patch } : t
          )
          if (!targetProjectId) return { tasks: updatedTasks }
          const metrics = computeProjectMetrics(targetProjectId, updatedTasks)
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? { ...p, ...metrics }
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
        if (targetTask.status === 'done') return

        const patch = resumeTimerFields(targetTask)

        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.taskId === taskId ? { ...t, ...patch } : t
          ),
        }))

        await updateTaskTimerInDb(taskId, patch)
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

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks)
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? { ...p, ...metrics }
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

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks)
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? { ...p, ...metrics }
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await deleteTaskFromDb(taskId)
        if (targetProjectId && projectStats) {
          await updateProjectStatsInDb(targetProjectId, projectStats)
        }
      },

      // Subtask Store Actions with Firestore Persistence
      addSubtask: async (taskId, newSubtask) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'
        const timer = startTimerFields()

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            const existingSubtasks = t.subtasks || []
            const createdSubtask = {
              id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              title: newSubtask.title,
              description: newSubtask.description || null,
              priority: newSubtask.priority || 'medium',
              isCompleted: false,
              createdBy: newSubtask.createdBy || null,
              createdByEmail: newSubtask.createdByEmail || null,
              createdByName: newSubtask.createdByName || null,
              ...timer,
            }
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
              return { ...st, ...pauseTimerFields(st) }
            })
            return { ...t, subtasks: updatedSubtasks }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
      },

      resumeSubtaskTimer: async (taskId, subtaskId) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            currentTaskStatus = t.status
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId || st.timerStatus !== 'paused' || st.isCompleted) return st
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

        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId) return st
              const willComplete = !st.isCompleted
              if (willComplete) {
                return { ...st, isCompleted: true, ...stopTimerFields(st) }
              }
              return {
                ...st,
                isCompleted: false,
                ...resumeTimerFields({
                  ...st,
                  timerStatus: 'paused',
                  timerAccumulatedMs: st.timerAccumulatedMs || 0,
                }),
              }
            })

            const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.isCompleted)
            nextStatus = allDone ? 'done' : t.status === 'done' ? 'in_progress' : t.status
            targetProjectId = t.projectId

            let nextTask = {
              ...t,
              subtasks: updatedSubtasks,
              status: nextStatus,
            }

            if (nextStatus === 'done' && t.timerStatus !== 'stopped') {
              taskTimerPatch = stopTimerFields(t)
              nextTask = { ...nextTask, ...taskTimerPatch }
            }

            return nextTask
          })

          if (!targetProjectId) return { tasks: updatedTasks }

          const metrics = computeProjectMetrics(targetProjectId, updatedTasks)
          projectStats = metrics
          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetProjectId || p.id === targetProjectId
              ? { ...p, ...metrics }
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, nextStatus)
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
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            currentTaskStatus = t.status
            updatedSubtasks = (t.subtasks || []).map((st) => {
              if (st.id !== subtaskId) return st
              return {
                ...st,
                title: updates.title?.trim() || st.title,
                description:
                  updates.description !== undefined
                    ? updates.description?.trim() || null
                    : st.description,
                priority: updates.priority || st.priority || 'medium',
              }
            })
            return { ...t, subtasks: updatedSubtasks }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, currentTaskStatus)
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
