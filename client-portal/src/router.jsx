import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ClientLoginPage } from './features/auth/ClientLoginPage'
import { ClientOnboardingGate } from './features/auth/ClientOnboardingGate'
import { ClientPortal } from './features/portal/ClientPortal'
import { ClientProjects } from './features/portal/ClientProjects'
import { ClientInvoices } from './features/portal/ClientInvoices'
import { ClientBilling } from './features/portal/ClientBilling'
import { ClientFiles } from './features/portal/ClientFiles'
import { ClientSupport } from './features/portal/ClientSupport'
import { ClientProfile } from './features/portal/ClientProfile'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <ClientLoginPage />,
  },
  {
    path: '/onboarding',
    element: <ClientOnboardingGate />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/portal" replace /> },
      { path: 'portal', element: <ClientPortal /> },
      { path: 'portal/projects', element: <ClientProjects /> },
      { path: 'portal/projects/:projectId', element: <ClientProjects /> },
      { path: 'portal/invoices', element: <ClientInvoices /> },
      { path: 'portal/billing', element: <ClientBilling /> },
      { path: 'portal/files', element: <ClientFiles /> },
      { path: 'portal/support', element: <ClientSupport /> },
      { path: 'portal/profile', element: <ClientProfile /> },
    ],
  },
  { path: '*', element: <Navigate to="/portal" replace /> },
])

