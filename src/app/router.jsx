import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AuthGuard } from '../shared/components/guards/AuthGuard'
import { OrgGuard } from '../shared/components/guards/OrgGuard'
import { RequirePermission } from '../shared/components/guards/RequirePermission'
import { AppShell } from '../shared/components/layout/AppShell'

import { AdminLoginPage } from '../features/auth/AdminLoginPage'
import { InviteAcceptPage } from '../features/auth/InviteAcceptPage'
import { OnboardingWizard } from '../features/onboarding/OnboardingWizard'

import { FounderDashboard } from '../features/dashboard/FounderDashboard'

import { Pipeline } from '../features/crm/Pipeline'
import { LeadList } from '../features/crm/LeadList'
import { ContactList } from '../features/crm/ContactList'
import { ClientProfileView } from '../features/crm/ClientProfileView'

import { ProjectList } from '../features/projects/ProjectList'
import { TaskBoard } from '../features/projects/TaskBoard'
import { TimeTracker } from '../features/projects/TimeTracker'

import { InvoiceList } from '../features/finance/InvoiceList'
import { ExpenseList } from '../features/finance/ExpenseList'
import { RecurringBilling } from '../features/finance/RecurringBilling'

import { EmployeeList } from '../features/team/EmployeeList'
import { AttendancePage } from '../features/team/AttendancePage'
import { LeaveManagement } from '../features/team/LeaveManagement'

import { CampaignList } from '../features/marketing/CampaignList'
import { ContentCalendar } from '../features/marketing/ContentCalendar'
import { UtmBuilder } from '../features/marketing/UtmBuilder'

import { ClientPortal } from '../features/portal/ClientPortal'
import { ClientProjects } from '../features/portal/ClientProjects'
import { ClientInvoices } from '../features/portal/ClientInvoices'
import { ClientBilling } from '../features/portal/ClientBilling'
import { ClientFiles } from '../features/portal/ClientFiles'
import { ClientProfile } from '../features/portal/ClientProfile'
import { EmployeeProfile } from '../features/portal/EmployeeProfile'

import { SalesReport } from '../features/reports/SalesReport'
import { FinanceReport } from '../features/reports/FinanceReport'
import { ProjectReport } from '../features/reports/ProjectReport'

import { KpiDashboard } from '../features/kpi/KpiDashboard'
import { KpiBuilder } from '../features/kpi/KpiBuilder'

import { WorkflowList } from '../features/workflows/WorkflowList'
import { WorkflowBuilder } from '../features/workflows/WorkflowBuilder'
import { WorkflowHistory } from '../features/workflows/WorkflowHistory'

import { KnowledgeBase } from '../features/knowledge/KnowledgeBase'

import { OrgSettings } from '../features/settings/OrgSettings'
import { RoleManager } from '../features/settings/RoleManager'
import { IntegrationsPage } from '../features/settings/IntegrationsPage'
import { AdminProfile } from '../features/settings/AdminProfile'

export const router = createBrowserRouter([
  // Public Login route
  {
    path: '/login',
    element: <AdminLoginPage />,
  },
  {
    path: '/invite',
    element: <InviteAcceptPage />,
  },

  // Authenticated-only routes (before Org context)
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/onboarding',
        element: <OnboardingWizard />,
      },
      // App Shell with Org context
      {
        element: <OrgGuard />,
        children: [
          {
            path: '/',
            element: <AppShell />,
            children: [
              {
                index: true,
                element: <Navigate to="/dashboard" replace />,
              },
              {
                path: 'dashboard',
                element: <FounderDashboard />,
              },
              // CRM Module Sub-Routes
              {
                element: <RequirePermission perm="crm:leads:read" />,
                children: [
                  { path: 'crm', element: <Navigate to="/crm/pipeline" replace /> },
                  { path: 'crm/pipeline', element: <Pipeline /> },
                  { path: 'crm/leads', element: <LeadList /> },
                  { path: 'crm/contacts', element: <ContactList /> },
                  { path: 'crm/client/:clientId', element: <ClientProfileView /> },
                ],
              },
              // Projects Module Sub-Routes
              {
                element: <RequirePermission perm="projects:read" />,
                children: [
                  { path: 'projects', element: <Navigate to="/projects/list" replace /> },
                  { path: 'projects/list', element: <ProjectList /> },
                  { path: 'projects/tasks', element: <TaskBoard /> },
                  { path: 'projects/time', element: <TimeTracker /> },
                ],
              },
              // Finance Module Sub-Routes
              {
                element: <RequirePermission perm="finance:invoices:read" />,
                children: [
                  { path: 'finance', element: <Navigate to="/finance/invoices" replace /> },
                  { path: 'finance/invoices', element: <InvoiceList /> },
                  { path: 'finance/expenses', element: <ExpenseList /> },
                  { path: 'finance/recurring', element: <RecurringBilling /> },
                ],
              },
              // Team Module Sub-Routes
              {
                element: <RequirePermission perm="team:employees:read" />,
                children: [
                  { path: 'team', element: <Navigate to="/team/employees" replace /> },
                  { path: 'team/employees', element: <EmployeeList /> },
                  { path: 'team/attendance', element: <AttendancePage /> },
                  { path: 'team/leave', element: <LeaveManagement /> },
                ],
              },
              // Marketing Module Sub-Routes
              {
                path: 'marketing',
                element: <Navigate to="/marketing/campaigns" replace />,
              },
              {
                path: 'marketing/campaigns',
                element: <CampaignList />,
              },
              {
                path: 'marketing/content',
                element: <ContentCalendar />,
              },
              {
                path: 'marketing/utm-builder',
                element: <UtmBuilder />,
              },
              // Client Portal Sub-Routes
              {
                path: 'portal',
                element: <ClientPortal />,
              },
              {
                path: 'portal/projects',
                element: <ClientProjects />,
              },
              {
                path: 'portal/invoices',
                element: <ClientInvoices />,
              },
              {
                path: 'portal/billing',
                element: <ClientBilling />,
              },
              {
                path: 'portal/files',
                element: <ClientFiles />,
              },
              {
                path: 'portal/profile',
                element: <ClientProfile />,
              },
              {
                path: 'employee/profile',
                element: <EmployeeProfile />,
              },
              // Reports & Analytics Sub-Routes
              {
                path: 'reports',
                element: <Navigate to="/reports/sales" replace />,
              },
              {
                path: 'reports/sales',
                element: <SalesReport />,
              },
              {
                path: 'reports/finance',
                element: <FinanceReport />,
              },
              {
                path: 'reports/projects',
                element: <ProjectReport />,
              },
              // KPI Engine Sub-Routes
              {
                path: 'kpi',
                element: <KpiDashboard />,
              },
              {
                path: 'kpi/builder',
                element: <KpiBuilder />,
              },
              // Workflow Engine Sub-Routes
              {
                path: 'workflows',
                element: <WorkflowList />,
              },
              {
                path: 'workflows/builder',
                element: <WorkflowBuilder />,
              },
              {
                path: 'workflows/history',
                element: <WorkflowHistory />,
              },
              // Knowledge Base
              {
                path: 'knowledge/*',
                element: <KnowledgeBase />,
              },
              // Settings & Role Manager Sub-Routes
              {
                path: 'settings',
                element: <Navigate to="/settings/profile" replace />,
              },
              {
                path: 'settings/org',
                element: <OrgSettings />,
              },
              {
                path: 'settings/roles',
                element: <RoleManager />,
              },
              {
                path: 'settings/integrations',
                element: <IntegrationsPage />,
              },
              {
                path: 'settings/profile',
                element: <AdminProfile />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
])
