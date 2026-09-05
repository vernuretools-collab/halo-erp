import { create } from 'zustand'

export const useOrgStore = create((set) => ({
  orgId: null,
  org: null,
  membership: null,
  permissions: [],
  setOrg: (org) => set({ org, orgId: org?.orgId || null }),
  setMembership: (membership) => set({ membership }),
  setPermissions: (permissions) => set({ permissions }),
  clearOrg: () => set({ orgId: null, org: null, membership: null, permissions: [] }),
}))
