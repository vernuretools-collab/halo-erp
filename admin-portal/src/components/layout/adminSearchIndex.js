import { getClientsFromDb } from '../../features/crm/services/clientService'
import { getLeads } from '../../features/crm/services/crmService'
import { getInvoices } from '../../features/finance/services/financeService'
import { getProjects } from '../../features/projects/services/projectService'
import { getEmployees } from '../../features/team/services/teamService'
import {
  employeeDepartment,
  employeeDesignation,
  employeeDisplayName,
  employeePublicId,
  isDirectoryVisible,
  isFormerEmployee,
} from '../../../../shared/employees/employmentStatus.js'

const CACHE_MS = 60_000

const PAGES = [
  { title: 'Dashboard', path: '/dashboard', group: 'Overview' },
  { title: 'Assistant', path: '/assistant', group: 'Overview' },
  { title: 'CRM Pipeline', path: '/crm/pipeline', group: 'CRM & Pipeline' },
  { title: 'Leads', path: '/crm/leads', group: 'CRM & Pipeline' },
  { title: 'Client', path: '/crm/contacts', group: 'CRM & Pipeline' },
  { title: 'Project List', path: '/projects/list', group: 'Projects' },
  { title: 'Task Board', path: '/projects/tasks', group: 'Projects' },
  { title: 'Time Tracker', path: '/projects/time', group: 'Projects' },
  { title: 'QC', path: '/qc', group: 'Projects' },
  { title: 'Trash', path: '/projects/trash', group: 'Projects' },
  { title: 'Invoices', path: '/finance/invoices', group: 'Finance' },
  { title: 'Expenses', path: '/finance/expenses', group: 'Finance' },
  { title: 'Recurring Billing', path: '/finance/recurring', group: 'Finance' },
  { title: 'Employees', path: '/team/employees', group: 'Team' },
  { title: 'Ex-Employees', path: '/team/ex-employees', group: 'Team' },
  { title: 'Employee Onboarding', path: '/team/onboarding', group: 'Team' },
  { title: 'Scrum', path: '/team/scrum', group: 'Team' },
  { title: 'Announcements', path: '/team/announcements', group: 'Team' },
  { title: 'Client Support', path: '/team/helpdesk', group: 'Team' },
  { title: 'Attendance', path: '/team/attendance', group: 'Team' },
  { title: 'Leave Management', path: '/team/leave', group: 'Team' },
  { title: 'Holidays', path: '/team/holidays', group: 'Team' },
  { title: 'Payslips', path: '/team/payslips', group: 'Team' },
  { title: 'Employee Documents', path: '/team/documents', group: 'Team' },
  { title: 'Final Documentation', path: '/team/relieving-letter', group: 'Team' },
  { title: 'Leave & WFH Policy', path: '/team/wfh-policy', group: 'Team' },
  { title: 'Timelines', path: '/team/timeline', group: 'Team' },
  { title: 'Monthly Reports', path: '/team/reports', group: 'Team' },
  { title: 'Campaigns', path: '/marketing/campaigns', group: 'Marketing' },
  { title: 'Content Calendar', path: '/marketing/content', group: 'Marketing' },
  { title: 'UTM Builder', path: '/marketing/utm-builder', group: 'Marketing' },
  { title: 'KPI Dashboard', path: '/kpi', group: 'Business Health' },
  { title: 'KPI Builder', path: '/kpi/builder', group: 'Business Health' },
  { title: 'Sales Report', path: '/reports/sales', group: 'Reports' },
  { title: 'Finance Report', path: '/reports/finance', group: 'Reports' },
  { title: 'Project Report', path: '/reports/projects', group: 'Reports' },
  { title: 'Workflow List', path: '/workflows', group: 'Workflows' },
  { title: 'Workflow Builder', path: '/workflows/builder', group: 'Workflows' },
  { title: 'Workflow History', path: '/workflows/history', group: 'Workflows' },
  { title: 'Knowledge Base', path: '/knowledge', group: 'Knowledge Base' },
  { title: 'Organization Settings', path: '/settings/org', group: 'Settings' },
  { title: 'My Profile', path: '/settings/profile', group: 'Settings' },
]

const GROUP_ORDER = ['Pages', 'Employees', 'Ex-employees', 'Clients', 'Leads', 'Projects', 'Invoices']
const PER_GROUP = 6

let cached = null
let cachedAt = 0
let inflight = null

function text(value) {
  return String(value || '').trim()
}

function norm(value) {
  return text(value).toLowerCase()
}

async function loadOne(loader) {
  try {
    const rows = await loader()
    return { rows: Array.isArray(rows) ? rows : [], failed: false }
  } catch {
    return { rows: [], failed: true }
  }
}

async function fetchIndex() {
  const [employees, clients, leads, projects, invoices] = await Promise.all([
    loadOne(() => getEmployees()),
    loadOne(() => getClientsFromDb()),
    loadOne(() => getLeads()),
    loadOne(() => getProjects()),
    loadOne(() => getInvoices()),
  ])
  const failed = [employees, clients, leads, projects, invoices].filter((item) => item.failed).length
  return {
    employees: employees.rows,
    clients: clients.rows,
    leads: leads.rows,
    projects: projects.rows,
    invoices: invoices.rows,
    error: failed ? 'Some records could not be loaded. Page names still work.' : '',
  }
}

export function loadSearchIndex() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = fetchIndex()
    .then((data) => {
      cached = data
      cachedAt = Date.now()
      return data
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

function rank(query, title, extras) {
  const q = norm(query)
  if (!q) return 0
  const titleN = norm(title)
  const blob = [titleN, ...extras.map(norm)].filter(Boolean).join(' ')
  if (!blob.includes(q)) return 0
  if (titleN.startsWith(q)) return 3
  if (titleN.includes(q)) return 2
  return 1
}

function take(query, rows) {
  return rows
    .map((row) => ({ ...row, score: rank(query, row.title, row.extras || []) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, PER_GROUP)
    .map(({ extras, score, ...row }) => row)
}

function listHref(path, query) {
  return `${path}?q=${encodeURIComponent(query.trim())}`
}

export function searchAdmin(query, index) {
  const q = text(query)
  if (!q) return []

  const pages = PAGES.map((page) => ({
    id: `page:${page.path}`,
    group: 'Pages',
    title: page.title,
    subtitle: page.group,
    href: page.path,
    extras: [page.group, page.path],
  }))

  const employees = (index?.employees || []).filter(isDirectoryVisible).map((employee) => {
    const docId = String(employee.uid || employee.employeeDocId || '')
    const publicId = employeePublicId(employee)
    return {
      id: `employee:${docId || publicId}`,
      group: 'Employees',
      title: employeeDisplayName(employee),
      subtitle: [employeeDesignation(employee), employeeDepartment(employee), employee.email].filter(Boolean).join(' · '),
      href: listHref('/team/employees', q),
      extras: [
        employee.email,
        employeeDepartment(employee),
        employeeDesignation(employee),
        employee.employeeCode,
        employee.staffId,
        publicId !== docId ? publicId : '',
      ],
    }
  })

  const former = (index?.employees || []).filter(isFormerEmployee).map((employee) => {
    const docId = String(employee.uid || employee.employeeDocId || '')
    const publicId = employeePublicId(employee)
    return {
      id: `former:${docId || publicId}`,
      group: 'Ex-employees',
      title: employeeDisplayName(employee),
      subtitle: [employeeDesignation(employee), employee.email].filter(Boolean).join(' · ') || 'Ex-employee',
      href: listHref('/team/ex-employees', q),
      extras: [
        employee.email,
        employeeDepartment(employee),
        employeeDesignation(employee),
        employee.employeeCode,
        employee.staffId,
        publicId !== docId ? publicId : '',
      ],
    }
  })

  const clients = (index?.clients || []).filter((client) => client.uid || client.clientId).map((client) => {
    const title = client.displayName || client.companyName || client.email || 'Client'
    return {
      id: `client:${client.uid || client.clientId}`,
      group: 'Clients',
      title,
      subtitle: [client.companyName && client.companyName !== title ? client.companyName : '', client.email, client.phoneNumber || client.phone]
        .filter(Boolean)
        .join(' · '),
      href: `/crm/client/${client.uid || client.clientId}`,
      extras: [client.companyName, client.email, client.phoneNumber, client.phone, client.username],
    }
  })

  const leads = (index?.leads || []).map((lead) => ({
    id: `lead:${lead.leadId}`,
    group: 'Leads',
    title: lead.name || lead.companyName || lead.contactName || 'Lead',
    subtitle: [lead.companyName, lead.pipelineStage || lead.email].filter(Boolean).join(' · '),
    href: listHref('/crm/leads', q),
    extras: [lead.companyName, lead.contactName, lead.email, lead.phone, lead.phoneNumber],
  }))

  const projects = (index?.projects || []).filter((project) => project.projectId || project.id).map((project) => {
    const id = project.projectId || project.id
    return {
      id: `project:${id}`,
      group: 'Projects',
      title: project.name || 'Project',
      subtitle: [project.clientName, project.status].filter(Boolean).join(' · '),
      href: `/projects/${id}`,
      extras: [project.clientName, project.status],
    }
  })

  const invoices = (index?.invoices || []).map((invoice) => ({
    id: `invoice:${invoice.invoiceId || invoice.id}`,
    group: 'Invoices',
    title: invoice.invoiceNumber || 'Invoice',
    subtitle: [invoice.clientName, invoice.projectName, invoice.status].filter(Boolean).join(' · '),
    href: listHref('/finance/invoices', q),
    extras: [invoice.clientName, invoice.projectName, invoice.status, invoice.invoiceNumber],
  }))

  const buckets = {
    Pages: take(q, pages),
    Employees: take(q, employees),
    'Ex-employees': take(q, former),
    Clients: take(q, clients),
    Leads: take(q, leads),
    Projects: take(q, projects),
    Invoices: take(q, invoices),
  }

  return GROUP_ORDER.flatMap((group) => buckets[group] || [])
}
