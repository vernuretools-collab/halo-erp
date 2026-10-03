import React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ScrumPage as SharedScrumPage } from '../../../shared/scrum/ScrumPage.jsx'
import { useIsScrumConductor } from '../../../shared/scrum/useScrumConductor.js'
import { useUserStore } from '../../shared/stores/userStore'

export function ScrumPage() {
  const { user, userDoc, claims } = useUserStore()
  const isEmployee = claims?.role === 'employee'
  const { isConductor, ready } = useIsScrumConductor(user, userDoc)

  if (isEmployee && !ready) {
    return (
      <p className="text-sm text-muted inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking scrum access
      </p>
    )
  }

  if (isEmployee && !isConductor) return <Navigate to="/dashboard" replace />
  return <SharedScrumPage canAssignConductor={!isEmployee} />
}
