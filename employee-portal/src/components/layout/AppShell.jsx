import React, { useEffect, useMemo, Suspense } from 'react'
import { Navigate, Outlet, useRouteError } from 'react-router-dom'
import { EmployeeSidebar } from './EmployeeSidebar'
import { EmployeeTopBar } from './EmployeeTopBar'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'
import { auth } from '../../shared/services/firebaseService'
import { getUserDoc, fetchCustomClaims } from '../../shared/services/authService'
import { useLiveAuthSession } from '../../../../shared/supabase/useLiveAuthSession.js'
import { useWellnessNotifications } from '../../features/wellness/hooks/useWellnessNotifications'
import { useAutoClockOutAfterWorkday } from '../../features/team/hooks/useAutoClockOutAfterWorkday'
import { useAnnouncementBrowserAlerts } from '../../features/announcements/hooks/useAnnouncementBrowserAlerts'
import { usePayslipBrowserAlerts } from '../../features/payslips/hooks/usePayslipBrowserAlerts'
import { useProjectBrowserAlerts } from '../../features/projects/hooks/useProjectBrowserAlerts'
import { collectUserIdentityIds } from '../../features/projects/services/projectService'

export const AppShell = () => {
  const { sidebarOpen } = useUIStore()
  const { user, sessionReady } = useLiveAuthSession({
    auth,
    useUserStore,
    fetchCustomClaims,
  })
  const { claims, setUser, userDoc } = useUserStore()
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])

  useAnnouncementBrowserAlerts(identityIds)
  usePayslipBrowserAlerts(identityIds)
  useProjectBrowserAlerts(identityIds, { user, userDoc })

  useEffect(() => {
    if (!user?.uid) return
    let cancelled = false
    getUserDoc(user.uid, user.email).then((docData) => {
      if (cancelled || !docData) return
      const { user: currentUser, userDoc: currentDoc, claims: currentClaims } = useUserStore.getState()
      const incomingTs = Date.parse(docData.quoteUpdatedAt || '') || 0
      const localTs = Date.parse(currentDoc?.quoteUpdatedAt || '') || 0
      const quoteLock =
        localTs > incomingTs
          ? {
              quote: currentDoc.quote,
              proverb: currentDoc.proverb,
              quoteUpdatedAt: currentDoc.quoteUpdatedAt,
            }
          : {
              quote: docData.quote ?? docData.proverb ?? currentDoc?.quote ?? '',
              proverb: docData.quote ?? docData.proverb ?? currentDoc?.proverb ?? '',
              quoteUpdatedAt: docData.quoteUpdatedAt || currentDoc?.quoteUpdatedAt,
            }
      setUser(currentUser || user, { ...currentDoc, ...docData, ...quoteLock }, currentClaims || claims)
    })
    return () => {
      cancelled = true
    }
    // Refresh profile once per signed-in user so the sidebar shows the current job role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid])

  useWellnessNotifications()
  useAutoClockOutAfterWorkday()

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
      <EmployeeSidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'pl-64' : 'pl-20'
        }`}
      >
        <EmployeeTopBar />
        <main className="flex-1 p-6 overflow-y-auto">
          <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export const AppShellError = () => {
  const error = useRouteError()
  const user = useUserStore((s) => s.user)
  console.error(error)
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-6">
      <p className="text-sm text-muted">Something went wrong. Refresh the page to continue.</p>
    </div>
  )
}
