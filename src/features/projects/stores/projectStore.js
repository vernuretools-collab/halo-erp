import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getProjects,
  getTasks,
  getTaskStatusesFromDb,
  createProject,
  createTask,
  updateTaskStatusInDb,
  updateTaskSubtasksInDb,
  deleteTaskFromDb,
  DEFAULT_TASK_STATUSES,
} from '../services/projectService'

export { DEFAULT_TASK_STATUSES }

export const DEMO_PROJECTS = [
  {
    projectId: 'proj_201',
    id: 'proj_201',
    name: 'SaaS Platform Redesign',
    clientName: 'Acme Corporation',
    description: 'Complete UI/UX refactor with Tailwind CSS & React 19',
    status: 'active',
    budget: 45000,
    completionPercent: 66,
    totalTaskCount: 3,
    completedTaskCount: 1,
    totalHoursLogged: 36,
    ownerName: 'Sarah Jenkins',
    createdAt: new Date().toISOString(),
  },
  {
    projectId: 'proj_202',
    id: 'proj_202',
    name: 'Mobile App API Integration',
    clientName: 'Global Logistics Inc',
    description: 'REST API endpoint setup and authentication middleware',
    status: 'active',
    budget: 32000,
    completionPercent: 0,
    totalTaskCount: 2,
    completedTaskCount: 0,
    totalHoursLogged: 18,
    ownerName: 'Alex Rivera',
    createdAt: new Date().toISOString(),
  },
]

export const DEMO_TASKS = [
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
    assigneeName: 'Sarah Jenkins',
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
    assigneeName: 'Sarah Jenkins',
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
    assigneeName: 'Alex Rivera',
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
    priority: 'high',
    status: 'in_review',
    loggedHours: 10,
    estimatedHours: 12,
    assigneeName: 'David Chen',
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
      selectedProjectId: null,
      taskFilterStatus: 'all',

      setProjects: (projects) =>
        set({ projects: projects || [] }),
      setTasks: (tasks) => {
        const merged = (tasks || []).map((dbTask) => {
          return {
            ...dbTask,
            subtasks: dbTask.subtasks || [],
            status: dbTask.status || 'todo',
          }
        })
        set({ tasks: merged })
      },
      setStatuses: (statuses) => set({ statuses }),
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
      setTaskFilterStatus: (taskFilterStatus) => set({ taskFilterStatus }),

      addProject: (newProj) =>
        set((state) => ({
          projects: [
            {
              projectId: newProj.projectId || newProj.id || `proj_${Date.now()}`,
              id: newProj.id || newProj.projectId || `proj_${Date.now()}`,
              status: 'active',
              type: 'client',
              completionPercent: 0,
              totalTaskCount: 0,
              completedTaskCount: 0,
              totalHoursLogged: 0,
              createdAt: new Date().toISOString(),
              ...newProj,
            },
            ...state.projects,
          ],
        })),

      updateProject: (projectId, updates) =>
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
        })),

      deleteProject: (projectId) =>
        set((state) => ({
          projects: state.projects.filter(
            (p) => p.projectId !== projectId && p.id !== projectId
          ),
        })),

      addTask: (newTask) =>
        set((state) => {
          const updatedTasks = [
            {
              taskId: `task_${Date.now()}`,
              status: 'todo',
              priority: 'medium',
              loggedHours: 0,
              subtasks: newTask.subtasks || [],
              ...newTask,
            },
            ...state.tasks,
          ]

          const projTasks = updatedTasks.filter((t) => t.projectId === newTask.projectId)
          const completedCount = projTasks.filter((t) => t.status === 'done').length
          const totalCount = projTasks.length
          const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

          const updatedProjects = state.projects.map((p) =>
            p.projectId === newTask.projectId || p.id === newTask.projectId
              ? {
                  ...p,
                  totalTaskCount: totalCount,
                  completedTaskCount: completedCount,
                  completionPercent,
                }
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        }),

      updateTaskStatus: async (taskId, newStatus) => {
        let targetSubtasks = []
        set((state) => {
          const updatedTasks = state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            targetSubtasks = t.subtasks || []
            return { ...t, status: newStatus }
          })

          const targetTask = state.tasks.find((t) => t.taskId === taskId)
          if (!targetTask) return { tasks: updatedTasks }

          const projTasks = updatedTasks.filter((t) => t.projectId === targetTask.projectId)
          const completedCount = projTasks.filter((t) => t.status === 'done').length
          const totalCount = projTasks.length
          const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

          const updatedProjects = state.projects.map((p) =>
            p.projectId === targetTask.projectId || p.id === targetTask.projectId
              ? {
                  ...p,
                  completedTaskCount: completedCount,
                  completionPercent,
                }
              : p
          )

          return { tasks: updatedTasks, projects: updatedProjects }
        })

        await updateTaskStatusInDb(taskId, newStatus)
        await updateTaskSubtasksInDb(taskId, targetSubtasks, newStatus)
      },

      logHoursToTask: (taskId, hours) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.taskId === taskId
              ? { ...t, loggedHours: (Number(t.loggedHours) || 0) + Number(hours) }
              : t
          ),
        })),

      deleteTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.taskId !== taskId),
        })),

      // Subtask Store Actions with Firestore Persistence
      addSubtask: async (taskId, newSubtask) => {
        let updatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            const existingSubtasks = t.subtasks || []
            const createdSubtask = {
              id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              title: newSubtask.title,
              description: newSubtask.description || null,
              estimatedTime: newSubtask.estimatedTime || null,
              isCompleted: false,
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

      toggleSubtask: async (taskId, subtaskId) => {
        let updatedSubtasks = []
        let nextStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            updatedSubtasks = (t.subtasks || []).map((st) =>
              st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
            )

            // Check if all subtasks completed
            const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((st) => st.isCompleted)
            nextStatus = allDone ? 'done' : t.status === 'done' ? 'in_progress' : t.status

            return {
              ...t,
              subtasks: updatedSubtasks,
              status: nextStatus,
            }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, updatedSubtasks, nextStatus)
        await updateTaskStatusInDb(taskId, nextStatus)
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

      autoDecomposeTask: async (taskId) => {
        let generatedSubtasks = []
        let currentTaskStatus = 'todo'

        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.taskId !== taskId) return t
            generatedSubtasks = [
              { id: `sub_auto_1_${Date.now()}`, title: `Kickoff & Scope Alignment: ${t.title}`, isCompleted: false },
              { id: `sub_auto_2_${Date.now()}`, title: `Technical Core Implementation`, isCompleted: false },
              { id: `sub_auto_3_${Date.now()}`, title: `Peer Review & Integration Test`, isCompleted: false },
              { id: `sub_auto_4_${Date.now()}`, title: `Client Handoff & Documentation`, isCompleted: false },
            ]
            currentTaskStatus = t.status
            return {
              ...t,
              subtasks: generatedSubtasks,
            }
          }),
        }))

        await updateTaskSubtasksInDb(taskId, generatedSubtasks, currentTaskStatus)
      },
    }),
    {
      name: 'crm_main_project_store',
      partialize: (state) => ({
        tasks: state.tasks,
        projects: state.projects,
        statuses: state.statuses,
      }),
    }
  )
)
