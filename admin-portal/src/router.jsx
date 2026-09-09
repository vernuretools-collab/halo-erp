import React, { lazy } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminLoginPage } from './features/auth/AdminLoginPage'

const FounderDashboard = lazy(() =>
  import('./features/dashboard/FounderDashboard').then((m) => ({ default: m.FounderDashboard }))
)
const Pipeline = lazy(() => import('./features/crm/Pipeline').then((m) => ({ default: m.Pipeline })))
const LeadList = lazy(() => import('./features/crm/LeadList').then((m) => ({ default: m.LeadList })))
const ContactList = lazy(() => import('./features/crm/ContactList').then((m) => ({ default: m.ContactList })))
const ClientProfileView = lazy(() =>
  import('./features/crm/ClientProfileView').then((m) => ({ default: m.ClientProfileView }))
)
const ProjectList = lazy(() =>
  import('./features/projects/ProjectList').then((m) => ({ default: m.ProjectList }))
)
const ProjectDetailPage = lazy(() =>
  import('./features/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage }))
)
const TaskBoard = lazy(() =>
  import('./features/projects/TaskBoard').then((m) => ({ default: m.TaskBoard }))
)
const TimeTracker = lazy(() =>
  import('./features/projects/TimeTracker').then((m) => ({ default: m.TimeTracker }))
)
const InvoiceList = lazy(() =>
  import('./features/finance/InvoiceList').then((m) => ({ default: m.InvoiceList }))
)
const ExpenseList = lazy(() =>
  import('./features/finance/ExpenseList').then((m) => ({ default: m.ExpenseList }))
)
const RecurringBilling = lazy(() =>
  import('./features/finance/RecurringBilling').then((m) => ({ default: m.RecurringBilling }))
)
const EmployeeList = lazy(() =>
  import('./features/team/EmployeeList').then((m) => ({ default: m.EmployeeList }))
)
const AnnouncementManager = lazy(() =>
  import('./features/team/AnnouncementManager').then((m) => ({ default: m.AnnouncementManager }))
)
const HelpDeskManager = lazy(() =>
  import('./features/team/HelpDeskManager').then((m) => ({ default: m.HelpDeskManager }))
)
const AttendancePage = lazy(() =>
  import('./features/team/AttendancePage').then((m) => ({ default: m.AttendancePage }))
)
const LeaveManagement = lazy(() =>
  import('./features/team/LeaveManagement').then((m) => ({ default: m.LeaveManagement }))
)
const HolidayManager = lazy(() =>
  import('./features/team/HolidayManager').then((m) => ({ default: m.HolidayManager }))
)
const PayslipManager = lazy(() =>
  import('./features/team/PayslipManager').then((m) => ({ default: m.PayslipManager }))
)
const EmployeeDocumentManager = lazy(() =>
  import('./features/team/EmployeeDocumentManager').then((m) => ({ default: m.EmployeeDocumentManager }))
)
const WfhPolicyPage = lazy(() =>
  import('./features/team/WfhPolicyPage').then((m) => ({ default: m.WfhPolicyPage }))
)
const EmployeeTimelinePage = lazy(() =>
  import('./features/team/EmployeeTimelinePage').then((m) => ({ default: m.EmployeeTimelinePage }))
)
const EmployeeMonthlyReportPage = lazy(() =>
  import('./features/team/EmployeeMonthlyReportPage').then((m) => ({ default: m.EmployeeMonthlyReportPage }))
)
const CampaignList = lazy(() =>
  import('./features/marketing/CampaignList').then((m) => ({ default: m.CampaignList }))
)
const ContentCalendar = lazy(() =>
  import('./features/marketing/ContentCalendar').then((m) => ({ default: m.ContentCalendar }))
)
const UtmBuilder = lazy(() =>
  import('./features/marketing/UtmBuilder').then((m) => ({ default: m.UtmBuilder }))
)
const SalesReport = lazy(() =>
  import('./features/reports/SalesReport').then((m) => ({ default: m.SalesReport }))
)
const FinanceReport = lazy(() =>
  import('./features/reports/FinanceReport').then((m) => ({ default: m.FinanceReport }))
)
const ProjectReport = lazy(() =>
  import('./features/reports/ProjectReport').then((m) => ({ default: m.ProjectReport }))
)
const KpiDashboard = lazy(() =>
  import('./features/kpi/KpiDashboard').then((m) => ({ default: m.KpiDashboard }))
)
const KpiBuilder = lazy(() =>
  import('./features/kpi/KpiBuilder').then((m) => ({ default: m.KpiBuilder }))
)
const WorkflowList = lazy(() =>
  import('./features/workflows/WorkflowList').then((m) => ({ default: m.WorkflowList }))
)
const WorkflowBuilder = lazy(() =>
  import('./features/workflows/WorkflowBuilder').then((m) => ({ default: m.WorkflowBuilder }))
)
const WorkflowHistory = lazy(() =>
  import('./features/workflows/WorkflowHistory').then((m) => ({ default: m.WorkflowHistory }))
)
const KnowledgeBase = lazy(() =>
  import('./features/knowledge/KnowledgeBase').then((m) => ({ default: m.KnowledgeBase }))
)
const OrgSettings = lazy(() =>
  import('./features/settings/OrgSettings').then((m) => ({ default: m.OrgSettings }))
)
const RoleManager = lazy(() =>
  import('./features/settings/RoleManager').then((m) => ({ default: m.RoleManager }))
)
const IntegrationsPage = lazy(() =>
  import('./features/settings/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage }))
)
const AdminProfile = lazy(() =>
  import('./features/settings/AdminProfile').then((m) => ({ default: m.AdminProfile }))
)
const AdminAssistantPage = lazy(() =>
  import('./features/assistant/AdminAssistantPage').then((m) => ({ default: m.AdminAssistantPage }))
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <FounderDashboard /> },
      { path: 'assistant', element: <AdminAssistantPage /> },

      { path: 'crm', element: <Navigate to="/crm/pipeline" replace /> },
      { path: 'crm/pipeline', element: <Pipeline /> },
      { path: 'crm/leads', element: <LeadList /> },
      { path: 'crm/contacts', element: <ContactList /> },
      { path: 'crm/client/:clientId', element: <ClientProfileView /> },

      { path: 'projects', element: <Navigate to="/projects/list" replace /> },
      { path: 'projects/list', element: <ProjectList /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/manage/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/tasks', element: <TaskBoard /> },
      { path: 'projects/time', element: <TimeTracker /> },

      { path: 'finance', element: <Navigate to="/finance/invoices" replace /> },
      { path: 'finance/invoices', element: <InvoiceList /> },
      { path: 'finance/expenses', element: <ExpenseList /> },
      { path: 'finance/recurring', element: <RecurringBilling /> },

      {
        path: 'team',
        element: <Outlet />,
        children: [
          { index: true, element: <Navigate to="/team/employees" replace /> },
          { path: 'employees', element: <EmployeeList /> },
          { path: 'announcements', element: <AnnouncementManager /> },
          { path: 'helpdesk', element: <HelpDeskManager /> },
          { path: 'attendance', element: <AttendancePage /> },
          { path: 'leave', element: <LeaveManagement /> },
          { path: 'holidays', element: <HolidayManager /> },
          { path: 'payslips', element: <PayslipManager /> },
          { path: 'documents', element: <EmployeeDocumentManager /> },
          { path: 'wfh-policy', element: <WfhPolicyPage /> },
          { path: 'timeline', element: <EmployeeTimelinePage /> },
          { path: 'reports', element: <EmployeeMonthlyReportPage /> },
        ],
      },

      { path: 'marketing', element: <Navigate to="/marketing/campaigns" replace /> },
      { path: 'marketing/campaigns', element: <CampaignList /> },
      { path: 'marketing/content', element: <ContentCalendar /> },
      { path: 'marketing/utm-builder', element: <UtmBuilder /> },

      { path: 'reports', element: <Navigate to="/reports/sales" replace /> },
      { path: 'reports/sales', element: <SalesReport /> },
      { path: 'reports/finance', element: <FinanceReport /> },
      { path: 'reports/projects', element: <ProjectReport /> },

      { path: 'kpi', element: <KpiDashboard /> },
      { path: 'kpi/builder', element: <KpiBuilder /> },

      { path: 'workflows', element: <WorkflowList /> },
      { path: 'workflows/builder', element: <WorkflowBuilder /> },
      { path: 'workflows/history', element: <WorkflowHistory /> },

      { path: 'knowledge/*', element: <KnowledgeBase /> },

      { path: 'announcements', element: <Navigate to="/team/announcements" replace /> },
      { path: 'helpdesk', element: <Navigate to="/team/helpdesk" replace /> },

      { path: 'settings', element: <Navigate to="/settings/profile" replace /> },
      { path: 'settings/org', element: <OrgSettings /> },
      { path: 'settings/roles', element: <RoleManager /> },
      { path: 'settings/integrations', element: <IntegrationsPage /> },
      { path: 'settings/profile', element: <AdminProfile /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
