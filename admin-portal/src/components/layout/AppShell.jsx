import React, { useMemo } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'
import { AdminAssistantWidget } from '../../features/assistant/AdminAssistantWidget'
import { auth } from '../../shared/services/firebaseService'
import { fetchCustomClaims } from '../../shared/services/authService'
import { useLiveAuthSession } from '../../../../shared/supabase/useLiveAuthSession.js'
import {
  collectAdminIdentityIds,
  useInboxBrowserAlerts,
} from '../../features/projects/hooks/useInboxBrowserAlerts'

export const AppShell = () => {
  const { sidebarOpen } = useUIStore()
  const { user, sessionReady } = useLiveAuthSession({
    auth,
    useUserStore,
    fetchCustomClaims,
  })
  const { userDoc, claims } = useUserStore()
  const identityIds = useMemo(
    () => collectAdminIdentityIds(user, userDoc, claims),
    [user, userDoc, claims]
  )

  useInboxBrowserAlerts(identityIds, { user, userDoc })

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-canvas text-fg flex items-center justify-center">
        <p className="text-sm text-muted">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col transition-colors">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'pl-64' : 'pl-20'
        }`}
      >
        <TopBar />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <AdminAssistantWidget />
    </div>
  )
}
