import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell, AppShellError } from './components/layout/AppShell'
import { EmployeeLoginPage } from './features/auth/EmployeeLoginPage'
import { EmployeeDashboard } from './features/dashboard/EmployeeDashboard'
import { ProjectList } from './features/projects/ProjectList'
import { TaskBoard } from './features/projects/TaskBoard'
import {
  ProjectSessionPage,
  SessionTaskBoard,
  SessionTimelinePage,
  SessionDocumentsPage,
  SessionNotesPage,
  SessionIndexRedirect,
} from './features/projects/ProjectSessionPage'
import { EmployeeList } from './features/team/EmployeeList'
import { AttendancePage } from './features/team/AttendancePage'
import { LeaveManagement } from './features/team/LeaveManagement'
import { EmployeeProfile } from './features/profile/EmployeeProfile'
import { WellnessSettings } from './features/wellness/WellnessSettings'
import { WorkTimelinePage } from './features/timeline/WorkTimelinePage'
// New feature pages
import { NotificationsPage } from './features/notifications/NotificationsPage'
import { AnnouncementsPage } from './features/announcements/AnnouncementsPage'
import { CompanyCalendarPage } from './features/calendar/CompanyCalendarPage'
import { DocumentsPage } from './features/documents/DocumentsPage'
import { ClientDocumentsPage } from './features/documents/ClientDocumentsPage'
import { PayslipsPage } from './features/payslips/PayslipsPage'
import { GoalsPage } from './features/goals/GoalsPage'
import { HelpDeskPage } from './features/helpdesk/HelpDeskPage'
import { ProjectNotesStandalone } from './features/projects/ProjectNotesStandalone'
import { ProjectManagePage } from './features/projects/ProjectManagePage'

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

      // Projects Sub-routes & Aliases
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

      // Work Timeline (daily work diary)
      { path: 'timeline', element: <WorkTimelinePage /> },

      // Team Sub-routes & Aliases
      { path: 'team', element: <Navigate to="/team/employees" replace /> },
      { path: 'team/employees', element: <EmployeeList /> },
      { path: 'team/attendance', element: <AttendancePage /> },
      { path: 'team/leave', element: <LeaveManagement /> },
      { path: 'directory', element: <EmployeeList /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'leave', element: <LeaveManagement /> },

      // Wellness
      { path: 'wellness', element: <WellnessSettings /> },

      // Profile
      { path: 'profile', element: <EmployeeProfile /> },

      // ── NEW FEATURES ──────────────────────────────────────────────
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
