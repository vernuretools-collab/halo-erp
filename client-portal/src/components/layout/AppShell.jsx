import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { ClientSidebar } from './ClientSidebar'
import { ClientTopBar } from './ClientTopBar'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'

export const AppShell = () => {
  const { sidebarOpen } = useUIStore()
  const { user, userDoc } = useUserStore()

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check Onboarding & Admin Approval Gate
  const isApproved =
    userDoc?.skipAgreements === true ||
    userDoc?.onboardingStatus === 'approved' ||
    localStorage.getItem(`onboarding_status_${user.uid}`) === 'approved'

  // If user has not been approved by admin, strictly redirect to /onboarding
  if (!isApproved) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col transition-colors">
      <ClientSidebar />
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'pl-64' : 'pl-20'
        }`}
      >
        <ClientTopBar />
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

