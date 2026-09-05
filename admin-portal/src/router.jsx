import React from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { AdminLoginPage } from './features/auth/AdminLoginPage'
import { FounderDashboard } from './features/dashboard/FounderDashboard'
import { Pipeline } from './features/crm/Pipeline'
import { LeadList } from './features/crm/LeadList'
import { ContactList } from './features/crm/ContactList'
import { ClientProfileView } from './features/crm/ClientProfileView'
import { ProjectList } from './features/projects/ProjectList'
import { ProjectDetailPage } from './features/projects/ProjectDetailPage'
import { TaskBoard } from './features/projects/TaskBoard'
import { TimeTracker } from './features/projects/TimeTracker'
import { InvoiceList } from './features/finance/InvoiceList'
import { ExpenseList } from './features/finance/ExpenseList'
import { RecurringBilling } from './features/finance/RecurringBilling'
import { EmployeeList } from './features/team/EmployeeList'
import { AnnouncementManager } from './features/team/AnnouncementManager'
import { HelpDeskManager } from './features/team/HelpDeskManager'
import { AttendancePage } from './features/team/AttendancePage'
import { LeaveManagement } from './features/team/LeaveManagement'
import { HolidayManager } from './features/team/HolidayManager'
import { PayslipManager } from './features/team/PayslipManager'
import { EmployeeDocumentManager } from './features/team/EmployeeDocumentManager'
import { WfhPolicyPage } from './features/team/WfhPolicyPage'
import { EmployeeTimelinePage } from './features/team/EmployeeTimelinePage'
import { EmployeeMonthlyReportPage } from './features/team/EmployeeMonthlyReportPage'
import { CampaignList } from './features/marketing/CampaignList'
import { ContentCalendar } from './features/marketing/ContentCalendar'
import { UtmBuilder } from './features/marketing/UtmBuilder'
import { SalesReport } from './features/reports/SalesReport'
import { FinanceReport } from './features/reports/FinanceReport'
import { ProjectReport } from './features/reports/ProjectReport'
import { KpiDashboard } from './features/kpi/KpiDashboard'
import { KpiBuilder } from './features/kpi/KpiBuilder'
import { WorkflowList } from './features/workflows/WorkflowList'
import { WorkflowBuilder } from './features/workflows/WorkflowBuilder'
import { WorkflowHistory } from './features/workflows/WorkflowHistory'
import { KnowledgeBase } from './features/knowledge/KnowledgeBase'
import { OrgSettings } from './features/settings/OrgSettings'
import { RoleManager } from './features/settings/RoleManager'
import { IntegrationsPage } from './features/settings/IntegrationsPage'
import { AdminProfile } from './features/settings/AdminProfile'
import { AdminAssistantPage } from './features/assistant/AdminAssistantPage'

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

      // CRM Module
      { path: 'crm', element: <Navigate to="/crm/pipeline" replace /> },
      { path: 'crm/pipeline', element: <Pipeline /> },
      { path: 'crm/leads', element: <LeadList /> },
      { path: 'crm/contacts', element: <ContactList /> },
      { path: 'crm/client/:clientId', element: <ClientProfileView /> },

      // Projects Module
      { path: 'projects', element: <Navigate to="/projects/list" replace /> },
      { path: 'projects/list', element: <ProjectList /> },
      { path: 'projects/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/manage/:projectId', element: <ProjectDetailPage /> },
      { path: 'projects/tasks', element: <TaskBoard /> },
      { path: 'projects/time', element: <TimeTracker /> },

      // Finance Module
      { path: 'finance', element: <Navigate to="/finance/invoices" replace /> },
      { path: 'finance/invoices', element: <InvoiceList /> },
      { path: 'finance/expenses', element: <ExpenseList /> },
      { path: 'finance/recurring', element: <RecurringBilling /> },

      // Team Module (nested under Outlet so /team/timeline never hits the catch-all)
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

      // Marketing Module
      { path: 'marketing', element: <Navigate to="/marketing/campaigns" replace /> },
      { path: 'marketing/campaigns', element: <CampaignList /> },
      { path: 'marketing/content', element: <ContentCalendar /> },
      { path: 'marketing/utm-builder', element: <UtmBuilder /> },

      // Reports Module
      { path: 'reports', element: <Navigate to="/reports/sales" replace /> },
      { path: 'reports/sales', element: <SalesReport /> },
      { path: 'reports/finance', element: <FinanceReport /> },
      { path: 'reports/projects', element: <ProjectReport /> },

      // KPI Engine
      { path: 'kpi', element: <KpiDashboard /> },
      { path: 'kpi/builder', element: <KpiBuilder /> },

      // Workflows
      { path: 'workflows', element: <WorkflowList /> },
      { path: 'workflows/builder', element: <WorkflowBuilder /> },
      { path: 'workflows/history', element: <WorkflowHistory /> },

      // Knowledge Base
      { path: 'knowledge/*', element: <KnowledgeBase /> },

      // Help Desk & Announcements Top-Level Aliases
      { path: 'announcements', element: <Navigate to="/team/announcements" replace /> },
      { path: 'helpdesk', element: <Navigate to="/team/helpdesk" replace /> },

      // Settings
      { path: 'settings', element: <Navigate to="/settings/profile" replace /> },
      { path: 'settings/org', element: <OrgSettings /> },
      { path: 'settings/roles', element: <RoleManager /> },
      { path: 'settings/integrations', element: <IntegrationsPage /> },
      { path: 'settings/profile', element: <AdminProfile /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
