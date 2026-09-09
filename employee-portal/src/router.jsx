import React, { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell, AppShellError } from './components/layout/AppShell'
import { EmployeeLoginPage } from './features/auth/EmployeeLoginPage'

const EmployeeDashboard = lazy(() =>
  import('./features/dashboard/EmployeeDashboard').then((m) => ({ default: m.EmployeeDashboard }))
)
const ProjectList = lazy(() =>
  import('./features/projects/ProjectList').then((m) => ({ default: m.ProjectList }))
)
const TaskBoard = lazy(() =>
  import('./features/projects/TaskBoard').then((m) => ({ default: m.TaskBoard }))
)
const ProjectSessionPage = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.ProjectSessionPage }))
)
const SessionTaskBoard = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.SessionTaskBoard }))
)
const SessionTimelinePage = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.SessionTimelinePage }))
)
const SessionDocumentsPage = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.SessionDocumentsPage }))
)
const SessionNotesPage = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.SessionNotesPage }))
)
const SessionIndexRedirect = lazy(() =>
  import('./features/projects/ProjectSessionPage').then((m) => ({ default: m.SessionIndexRedirect }))
)
const EmployeeList = lazy(() =>
  import('./features/team/EmployeeList').then((m) => ({ default: m.EmployeeList }))
)
const LeaveManagement = lazy(() =>
  import('./features/team/LeaveManagement').then((m) => ({ default: m.LeaveManagement }))
)
const EmployeeProfile = lazy(() =>
  import('./features/profile/EmployeeProfile').then((m) => ({ default: m.EmployeeProfile }))
)
const WellnessSettings = lazy(() =>
  import('./features/wellness/WellnessSettings').then((m) => ({ default: m.WellnessSettings }))
)
const WorkTimelinePage = lazy(() =>
  import('./features/timeline/WorkTimelinePage').then((m) => ({ default: m.WorkTimelinePage }))
)
const NotificationsPage = lazy(() =>
  import('./features/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
)
const AnnouncementsPage = lazy(() =>
  import('./features/announcements/AnnouncementsPage').then((m) => ({ default: m.AnnouncementsPage }))
)
const CompanyCalendarPage = lazy(() =>
  import('./features/calendar/CompanyCalendarPage').then((m) => ({ default: m.CompanyCalendarPage }))
)
const DocumentsPage = lazy(() =>
  import('./features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage }))
)
const ClientDocumentsPage = lazy(() =>
  import('./features/documents/ClientDocumentsPage').then((m) => ({ default: m.ClientDocumentsPage }))
)
const PayslipsPage = lazy(() =>
  import('./features/payslips/PayslipsPage').then((m) => ({ default: m.PayslipsPage }))
)
const GoalsPage = lazy(() => import('./features/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })))
const HelpDeskPage = lazy(() =>
  import('./features/helpdesk/HelpDeskPage').then((m) => ({ default: m.HelpDeskPage }))
)
const ProjectNotesStandalone = lazy(() =>
  import('./features/projects/ProjectNotesStandalone').then((m) => ({ default: m.ProjectNotesStandalone }))
)
const ProjectManagePage = lazy(() =>
  import('./features/projects/ProjectManagePage').then((m) => ({ default: m.ProjectManagePage }))
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <EmployeeLoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <AppShellError />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <EmployeeDashboard /> },

      { path: 'projects', element: <Navigate to="/projects/list" replace /> },
      { path: 'projects/list', element: <ProjectList /> },
      { path: 'projects/tasks', element: <TaskBoard /> },
      { path: 'projects/:projectId/manage', element: <ProjectManagePage /> },
      {
        path: 'projects/:projectId',
        element: <ProjectSessionPage />,
        children: [
          { index: true, element: <SessionIndexRedirect /> },
          { path: 'tasks', element: <SessionTaskBoard /> },
          { path: 'timeline', element: <SessionTimelinePage /> },
          { path: 'documents', element: <SessionDocumentsPage /> },
          { path: 'notes', element: <SessionNotesPage /> },
        ],
      },
      { path: 'tasks', element: <TaskBoard /> },
      { path: 'client-documents', element: <ClientDocumentsPage /> },
      { path: 'project-notes', element: <ProjectNotesStandalone /> },

      { path: 'timeline', element: <WorkTimelinePage /> },

      { path: 'team', element: <Navigate to="/team/employees" replace /> },
      { path: 'team/employees', element: <EmployeeList /> },
      { path: 'team/attendance', element: <Navigate to="/dashboard" replace /> },
      { path: 'team/leave', element: <LeaveManagement /> },
      { path: 'directory', element: <EmployeeList /> },
      { path: 'attendance', element: <Navigate to="/dashboard" replace /> },
      { path: 'leave', element: <LeaveManagement /> },

      { path: 'wellness', element: <WellnessSettings /> },
      { path: 'profile', element: <EmployeeProfile /> },

      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'announcements', element: <AnnouncementsPage /> },
      { path: 'calendar', element: <CompanyCalendarPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'payslips', element: <PayslipsPage /> },
      { path: 'goals', element: <GoalsPage /> },
      { path: 'helpdesk', element: <HelpDeskPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
