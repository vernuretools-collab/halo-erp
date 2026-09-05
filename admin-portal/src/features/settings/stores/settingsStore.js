import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PERMISSIONS } from '../../../shared/constants/permissions'

// System roles are static config — not demo data
const SYSTEM_ROLES = [
  {
    roleId: 'role_owner',
    name: 'Company Owner',
    tier: 'company',
    isSystem: true,
    permissions: Object.values(PERMISSIONS),
  },
  {
    roleId: 'role_admin',
    name: 'Company Administrator',
    tier: 'company',
    isSystem: true,
    permissions: [
      PERMISSIONS.CRM_LEADS_READ,
      PERMISSIONS.CRM_LEADS_CREATE,
      PERMISSIONS.CRM_LEADS_UPDATE,
      PERMISSIONS.CRM_PIPELINE_MANAGE,
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.PROJECTS_CREATE,
      PERMISSIONS.FINANCE_INVOICES_READ,
      PERMISSIONS.FINANCE_INVOICES_CREATE,
      PERMISSIONS.TEAM_EMPLOYEES_READ,
      PERMISSIONS.ADMIN_MEMBERS_INVITE,
    ],
  },
]

// Default integrations are static UI config (no actual data seeded from Firestore)
const DEFAULT_INTEGRATIONS = [
  { id: 'algolia', name: 'Algolia Search Sync', status: 'disconnected', description: 'Full-text index synchronization for CRM leads & files' },
  { id: 'stripe', name: 'Stripe Billing & Payments', status: 'disconnected', description: 'Automatic client invoice payment links & subscriptions' },
  { id: 'slack', name: 'Slack Webhook Notifications', status: 'disconnected', description: 'Real-time channel alerts for workflow triggers' },
]

export const useSettingsStore = create(
  persist(
    (set) => ({
      customRoles: SYSTEM_ROLES,
      integrations: DEFAULT_INTEGRATIONS,
      orgDetails: {
        name: '',
        slug: '',
        plan: '',
        currency: 'INR (₹)',
        timezone: 'UTC',
      },

      setOrgDetails: (orgDetails) => set({ orgDetails }),
      setIntegrations: (integrations) => set({ integrations }),
      setCustomRoles: (customRoles) => set({ customRoles }),

      updateOrgDetails: (newDetails) =>
        set((state) => ({
          orgDetails: { ...state.orgDetails, ...newDetails },
        })),

      addCustomRole: (newRole) =>
        set((state) => ({
          customRoles: [
            {
              roleId: `role_${Date.now()}`,
              tier: 'company',
              isSystem: false,
              permissions: newRole.permissions || [],
              ...newRole,
            },
            ...state.customRoles,
          ],
        })),

      toggleRolePermission: (roleId, permissionKey) =>
        set((state) => ({
          customRoles: state.customRoles.map((r) => {
            if (r.roleId !== roleId || r.isSystem) return r
            const exists = r.permissions.includes(permissionKey)
            const updatedPerms = exists
              ? r.permissions.filter((p) => p !== permissionKey)
              : [...r.permissions, permissionKey]
            return { ...r, permissions: updatedPerms }
          }),
        })),

      deleteCustomRole: (roleId) =>
        set((state) => ({
          customRoles: state.customRoles.filter((r) => r.roleId !== roleId || r.isSystem),
        })),

      toggleIntegration: (id) =>
        set((state) => ({
          integrations: state.integrations.map((i) =>
            i.id === id ? { ...i, status: i.status === 'connected' ? 'disconnected' : 'connected' } : i
          ),
        })),
    }),
    {
      name: 'business-os-settings-store',
    }
  )
)
