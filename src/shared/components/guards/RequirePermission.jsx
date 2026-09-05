import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useOrgStore } from '../../stores/orgStore'
import { useUserStore } from '../../stores/userStore'
import { Card } from '../ui/Card'
import { ShieldAlert } from 'lucide-react'

export const RequirePermission = ({ perm }) => {
  const { permissions } = useOrgStore()
  const { claims } = useUserStore()

  // Owners and Admins bypass fine-grained permission checks
  const isAdmin = claims?.role === 'owner' || claims?.role === 'admin' || claims?.tier === 'superadmin'

  const hasPermission = isAdmin || permissions.includes(perm)

  // In demo mode or if user has permission, render outlet
  const isDemo = import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev'

  if (!hasPermission && !isDemo) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <Card className="p-8 border-rose-500/30 bg-rose-500/5 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-fg text-lg">Access Restricted</h3>
          <p className="text-xs text-slate-400">
            Your role does not have the required <code className="text-rose-400">{perm}</code> permission to access this module. Contact your organization administrator.
          </p>
        </Card>
      </div>
    )
  }

  return <Outlet />
}
