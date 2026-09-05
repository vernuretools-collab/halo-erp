const ROOT_TABLES = {
  users: 'profiles',
  employees: 'employees',
  organizations: 'organizations',
  leads: 'leads',
  crmStages: 'crm_stages',
  projects: 'projects',
  tasks: 'tasks',
  taskStatuses: 'task_statuses',
  invoices: 'invoices',
  expenses: 'expenses',
  expenseCategories: 'expense_categories',
  retainers: 'retainers',
  companySettings: 'company_settings',
  clientOnboarding: 'client_onboarding',
  deliverables: 'deliverables',
  clientDocuments: 'client_documents',
  attendance: 'attendance',
  attendanceLogs: 'attendance_logs',
  workTimelineEntries: 'work_timeline_entries',
  leaveRequests: 'leave_requests',
  departments: 'departments',
  companyCalendar: 'company_calendar',
  companyHolidays: 'company_holidays',
  companyPolicies: 'company_policies',
  employeeMonthlyReports: 'employee_monthly_reports',
  announcements: 'announcements',
  helpDeskTickets: 'help_desk_tickets',
  knowledge: 'knowledge',
  knowledgeArticles: 'knowledge_articles',
  healthScores: 'health_scores',
  kpiDefinitions: 'kpi_definitions',
  workflows: 'workflows',
  workflowRuns: 'workflow_runs',
  projectNotes: 'project_notes',
  employeeGoals: 'goal_items',
  timesheetEntries: 'work_timeline_entries',
  supportTickets: 'help_desk_tickets',
  onboarding: 'client_onboarding',
  campaigns: 'app_docs',
}

const ORG_SUB = {
  members: 'org_members',
  leads: 'leads',
  notifications: 'org_notifications',
  invoices: 'invoices',
  healthScores: 'health_scores',
}

export function flattenPath(path) {
  return path.flatMap((p) => String(p).split('/').filter(Boolean))
}

export function resolveCollection(parts) {
  if (parts[0] === 'organizations' && parts.length >= 3) {
    const table = ORG_SUB[parts[2]]
    if (table) {
      return { table, org_id: parts[1], user_id: null, parent_id: null, collection_name: null }
    }
    return {
      table: 'app_docs',
      org_id: parts[1],
      user_id: null,
      parent_id: null,
      collection_name: `organizations/${parts[1]}/${parts.slice(2).join('/')}`,
    }
  }

  if (parts[0] === 'projects' && parts[2] === 'processSteps') {
    return { table: 'project_process_steps', org_id: null, user_id: null, parent_id: parts[1], collection_name: null }
  }
  if (parts[0] === 'projects' && parts[2] === 'timeline') {
    return { table: 'project_timeline', org_id: null, user_id: null, parent_id: parts[1], collection_name: null }
  }
  if (parts[0] === 'documents' && parts[2] === 'files') {
    return { table: 'document_files', org_id: null, user_id: parts[1], parent_id: null, collection_name: null }
  }
  if (parts[0] === 'payslips' && parts[2] === 'records') {
    return { table: 'payslip_records', org_id: null, user_id: parts[1], parent_id: null, collection_name: null }
  }
  if (parts[0] === 'goals' && parts[2] === 'items') {
    return { table: 'goal_items', org_id: null, user_id: parts[1], parent_id: null, collection_name: null }
  }
  if (parts[0] === 'employeeGoals' && parts[2] === 'items') {
    return { table: 'goal_items', org_id: null, user_id: parts[1], parent_id: null, collection_name: null }
  }
  if (parts[0] === 'notifications' && parts[2] === 'items') {
    return { table: 'notification_items', org_id: null, user_id: parts[1], parent_id: null, collection_name: null }
  }

  if (parts.length === 1 && ROOT_TABLES[parts[0]]) {
    const table = ROOT_TABLES[parts[0]]
    return {
      table,
      org_id: null,
      user_id: null,
      parent_id: null,
      collection_name: table === 'app_docs' ? parts[0] : null,
    }
  }

  return {
    table: 'app_docs',
    org_id: null,
    user_id: null,
    parent_id: parts.length > 1 ? parts[1] : null,
    collection_name: parts.join('/'),
  }
}

export { ROOT_TABLES }