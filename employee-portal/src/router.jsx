import React, { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell, AppShellError } from './components/layout/AppShell'
import { EmployeeLoginPage } from './features/auth/EmployeeLoginPage'
import { JoiningLoginPage } from './features/joining/JoiningLoginPage'
import { JoiningFormPage } from './features/joining/JoiningFormPage'
import { DesktopTimingLayout } from './features/desktop/DesktopTimingLayout'
import { ReelAccess } from './features/reels/ReelAccess'

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
const ScrumConductorPage = lazy(() =>
  import('./features/team/ScrumConductorPage').then((m) => ({ default: m.ScrumConductorPage }))
)
const OrganizationStructure = lazy(() =>
  import('./features/team/OrganizationStructure').then((m) => ({ default: m.OrganizationStructure }))
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
const SocialPostRemindersPage = lazy(() =>
  import('./features/social-posts/SocialPostRemindersPage').then((m) => ({ default: m.SocialPostRemindersPage }))
)
const QcPage = lazy(() => import('./features/qc/QcPage').then((m) => ({ default: m.QcPage })))
const ReelsBoardPage = lazy(() =>
  import('./features/reels/ReelsBoardPage').then((m) => ({ default: m.ReelsBoardPage }))
)
const ReelsCalendarPage = lazy(() =>
  import('./features/reels/ReelsCalendarPage').then((m) => ({ default: m.ReelsCalendarPage }))
)
const ReelQuotaPage = lazy(() =>
  import('./features/reels/ReelQuotaPage').then((m) => ({ default: m.ReelQuotaPage }))
)
const ReelLeadershipPage = lazy(() =>
  import('./features/reels/ReelLeadershipPage').then((m) => ({ default: m.ReelLeadershipPage }))
)
const ReelDetailPage = lazy(() =>
  import('./features/reels/ReelDetailPage').then((m) => ({ default: m.ReelDetailPage }))
)
const ReelsListPage = lazy(() =>
  import('./features/reels/ReelsListPage').then((m) => ({ default: m.ReelsListPage }))
)
const ReelGuidePage = lazy(() =>
  import('./features/reels/ReelGuidePage').then((m) => ({ default: m.ReelGuidePage }))
)
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
    path: '/joining',
    element: <JoiningLoginPage />,
  },
  {
    path: '/joining/form',
    element: <JoiningFormPage />,
  },
  {
    path: '/desktop-timing',
    element: <DesktopTimingLayout />,
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
      { path: 'projects/trash', element: <Navigate to="/projects/list" replace /> },
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
      { path: 'team/organization', element: <OrganizationStructure /> },
      { path: 'team/attendance', element: <Navigate to="/dashboard" replace /> },
      { path: 'team/leave', element: <LeaveManagement /> },
      { path: 'team/scrum', element: <ScrumConductorPage /> },
      { path: 'directory', element: <EmployeeList /> },
      { path: 'attendance', element: <Navigate to="/dashboard" replace /> },
      { path: 'leave', element: <LeaveManagement /> },

      { path: 'wellness', element: <WellnessSettings /> },
      { path: 'post-reminders', element: <SocialPostRemindersPage /> },
      { path: 'qc', element: <QcPage /> },
      { path: 'reels', element: <ReelAccess><ReelsBoardPage /></ReelAccess> },
      { path: 'reels/calendar', element: <ReelAccess><ReelsCalendarPage /></ReelAccess> },
      { path: 'reels/list', element: <ReelAccess><ReelsListPage /></ReelAccess> },
      { path: 'reels/quota', element: <ReelAccess><ReelQuotaPage /></ReelAccess> },
      { path: 'reels/leadership', element: <ReelAccess><ReelLeadershipPage /></ReelAccess> },
      { path: 'reels/guide', element: <ReelAccess><ReelGuidePage /></ReelAccess> },
      { path: 'reels/:reelId', element: <ReelAccess><ReelDetailPage /></ReelAccess> },
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
