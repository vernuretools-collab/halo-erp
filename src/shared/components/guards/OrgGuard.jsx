import React from 'react'
import { Outlet } from 'react-router-dom'
import { useOrgStore } from '../../stores/orgStore'
import { useUserStore } from '../../stores/userStore'

export const OrgGuard = () => {
  const { orgId } = useOrgStore()
  const { claims } = useUserStore()

  // Always resolve orgId or default to 'org_demo' so onboarding is only visited intentionally
  const resolvedOrgId = orgId || claims?.orgId || 'org_demo'

  return <Outlet />
}
