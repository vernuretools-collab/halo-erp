import React from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { ScrumPage } from '../../../../shared/scrum/ScrumPage.jsx'
import { useIsScrumConductor } from '../../../../shared/scrum/useScrumConductor.js'
import { useUserStore } from '../../stores/userStore'

export function ScrumConductorPage() {
  const { user, userDoc } = useUserStore()
  const { isConductor, ready } = useIsScrumConductor(user, userDoc)

  if (!ready) {
    return (
      <p className="text-sm text-muted inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Checking scrum access
      </p>
    )
  }

  if (!isConductor) return <Navigate to="/dashboard" replace />
  return <ScrumPage canAssignConductor={false} />
}
