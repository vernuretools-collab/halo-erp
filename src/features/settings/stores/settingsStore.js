import { create } from 'zustand'
import { PERMISSIONS } from '../../../shared/constants/permissions'

const DEMO_CUSTOM_ROLES = [
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
  {
    roleId: 'role_manager',
    name: 'Operations Manager',
    tier: 'company',
    isSystem: false,
    permissions: [
      PERMISSIONS.CRM_LEADS_READ,
      PERMISSIONS.CRM_LEADS_CREATE,
      PERMISSIONS.PROJECTS_READ,
      PERMISSIONS.PROJECTS_TASKS_ASSIGN,
      PERMISSIONS.TEAM_EMPLOYEES_READ,
      PERMISSIONS.TEAM_ATTENDANCE_MANAGE,
    ],
  },
]

const DEMO_INTEGRATIONS = [
  { id: 'algolia', name: 'Algolia Search Sync', status: 'connected', description: 'Full-text index synchronization for CRM leads & files' },
  { id: 'stripe', name: 'Stripe Billing & Payments', status: 'connected', description: 'Automatic client invoice payment links & subscriptions' },
  { id: 'slack', name: 'Slack Webhook Notifications', status: 'disconnected', description: 'Real-time channel alerts for workflow triggers' },
]

export const useSettingsStore = create((set) => ({
  customRoles: DEMO_CUSTOM_ROLES,
  integrations: DEMO_INTEGRATIONS,
  orgDetails: {
    name: 'Acme Services Ltd',
    slug: 'acme-services',
    plan: 'Growth Plan',
    currency: 'USD ($)',
    timezone: 'UTC-5 (Eastern Time)',
  },

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
}))
