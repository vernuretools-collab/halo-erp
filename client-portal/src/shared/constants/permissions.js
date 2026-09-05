export const PERMISSIONS = {
  // CRM
  CRM_LEADS_READ: 'crm:leads:read',
  CRM_LEADS_CREATE: 'crm:leads:create',
  CRM_LEADS_UPDATE: 'crm:leads:update',
  CRM_LEADS_DELETE: 'crm:leads:delete',
  CRM_PIPELINE_MANAGE: 'crm:pipeline:manage',

  // Projects
  PROJECTS_READ: 'projects:read',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_TASKS_ASSIGN: 'projects:tasks:assign',
  PROJECTS_MILESTONES_APPROVE: 'projects:milestones:approve',

  // Finance
  FINANCE_INVOICES_READ: 'finance:invoices:read',
  FINANCE_INVOICES_CREATE: 'finance:invoices:create',
  FINANCE_INVOICES_APPROVE: 'finance:invoices:approve',
  FINANCE_EXPENSES_READ: 'finance:expenses:read',

  // Team
  TEAM_EMPLOYEES_READ: 'team:employees:read',
  TEAM_ATTENDANCE_MANAGE: 'team:attendance:manage',

  // Admin & Reports
  REPORTS_FINANCE_READ: 'reports:finance:read',
  ADMIN_ROLES_MANAGE: 'admin:roles:manage',
  ADMIN_MEMBERS_INVITE: 'admin:members:invite',

  // Portal
  PORTAL_FILES_DOWNLOAD: 'portal:files:download',
  PORTAL_INVOICES_VIEW: 'portal:invoices:view',
}
