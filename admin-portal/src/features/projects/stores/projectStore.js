import { create } from 'zustand'
import { DEFAULT_TASK_STATUSES } from '../services/projectService'

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
  {
    projectId: 'proj_203',
    id: 'proj_203',
    name: 'Cloud Infrastructure Migration',
    clientName: 'Internal Platform',
    description: 'Kubernetes cluster deployment and CI/CD automated pipeline setup',
    status: 'active',
    budget: 60000,
    completionPercent: 50,
    totalTaskCount: 2,
    completedTaskCount: 1,
    totalHoursLogged: 45,
    ownerName: 'David Chen',
    createdAt: new Date().toISOString(),
  },
]

export const DEMO_TASKS = [
  {
    taskId: 'task_101',
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
  },
  {
    taskId: 'task_102',
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
  },
  {
    taskId: 'task_103',
    title: 'Setup Responsive Sidebar Navigation',
    description: 'Build sidebar with collapsible items and active route state highlighting',
    projectId: 'proj_201',
    projectName: 'SaaS Platform Redesign',
    priority: 'medium',
    status: 'todo',
    loggedHours: 0,
    estimatedHours: 8,
    assigneeName: 'Sarah Jenkins',
    dueDate: '2024-08-08',
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
  },
  {
    taskId: 'task_105',
    title: 'Setup Webhook Notifications',
    description: 'Implement event webhook listeners for mobile app updates',
    projectId: 'proj_202',
    projectName: 'Mobile App API Integration',
    priority: 'medium',
    status: 'todo',
    loggedHours: 8,
    estimatedHours: 16,
    assigneeName: 'Sarah Jenkins',
    dueDate: '2024-08-12',
  },
  {
    taskId: 'task_106',
    title: 'Configure Terraform Helm Charts',
    description: 'Automate Kubernetes pod deployment using Helm templates',
    projectId: 'proj_203',
    projectName: 'Cloud Infrastructure Migration',
    priority: 'critical',
    status: 'done',
    loggedHours: 25,
    estimatedHours: 25,
    assigneeName: 'David Chen',
    dueDate: '2024-07-20',
  },
  {
    taskId: 'task_107',
    title: 'Setup Prometheus & Grafana Monitoring',
    description: 'Deploy metrics scraper and dashboard for node health',
    projectId: 'proj_203',
    projectName: 'Cloud Infrastructure Migration',
    priority: 'high',
    status: 'in_progress',
    loggedHours: 20,
    estimatedHours: 35,
    assigneeName: 'David Chen',
    dueDate: '2024-08-02',
  },
]

export const useProjectStore = create((set) => ({
  projects: [],
  tasks: [],
  statuses: DEFAULT_TASK_STATUSES,
  selectedProjectId: null,
  taskFilterStatus: 'all',

  setProjects: (projects) =>
    set({ projects: projects || [] }),
  setTasks: (tasks) =>
    set({ tasks: tasks || [] }),
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

  deleteProject: (projectId) =>
    set((state) => ({
      projects: state.projects.filter(
        (p) => p.projectId !== projectId && p.id !== projectId
      ),
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

  updateProjectMembers: (projectId, members) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.projectId === projectId || p.id === projectId ? { ...p, members } : p
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
          ...newTask,
        },
        ...state.tasks,
      ]

      // Recalculate parent project task counts
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

  updateTaskStatus: (taskId, newStatus) =>
    set((state) => {
      const updatedTasks = state.tasks.map((t) =>
        t.taskId === taskId ? { ...t, status: newStatus } : t
      )

      const targetTask = state.tasks.find((t) => t.taskId === taskId)
      if (!targetTask) return { tasks: updatedTasks }

      // Recalculate parent project
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
    }),

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
}))

