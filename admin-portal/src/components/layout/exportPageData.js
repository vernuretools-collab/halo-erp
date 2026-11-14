function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function todayKey(date = new Date()) {
  return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`
}

function csvCell(value) {
  if (value == null) return ''
  const text = String(value).replace(/"/g, '""')
  return /[",\n]/.test(text) ? `"${text}"` : text
}

function plain(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => (item && typeof item === 'object' ? item.displayName || item.name || item.title || item.id || '' : item))
      .filter(Boolean)
      .join('; ')
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString()
      } catch {
        return ''
      }
    }
    return value.displayName || value.name || value.title || value.email || ''
  }
  return ''
}

function flattenRow(row) {
  const out = {}
  Object.entries(row || {}).forEach(([key, value]) => {
    if (key.startsWith('_')) return
    const next = plain(value)
    if (next !== '' || typeof value === 'number') out[key] = next
  })
  return out
}

function xmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnWidth(values) {
  const longest = values.reduce((max, value) => {
    const line = String(value ?? '')
      .split('\n')
      .reduce((width, part) => Math.max(width, part.length), 0)
    return Math.max(max, line)
  }, 12)
  return Math.min(80, longest + 2) * 7
}

/** Excel opens this XML workbook with wrapped cells, so notes are not clipped the way a CSV is. */
function downloadSpreadsheet(filename, columns, rows) {
  const body = rows.map((row) => columns.map((column) => row[column.key] ?? ''))
  const widths = columns.map((column, index) => columnWidth([column.header, ...body.map((row) => row[index])]))
  const header = columns
    .map((column) => `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlText(column.header)}</Data></Cell>`)
    .join('')
  const lines = body
    .map((row) => {
      const cells = row
        .map((value) => `<Cell ss:StyleID="wrap"><Data ss:Type="String">${xmlText(value)}</Data></Cell>`)
        .join('')
      return `<Row ss:AutoFitHeight="1">${cells}</Row>`
    })
    .join('')
  const cols = widths.map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${width}"/>`).join('')
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles>
<Style ss:ID="header"><Font ss:Bold="1"/><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
<Style ss:ID="wrap"><Alignment ss:Vertical="Top" ss:WrapText="1"/></Style>
</Styles>
<Worksheet ss:Name="Scrum">
<Table>${cols}<Row ss:AutoFitHeight="1">${header}</Row>${lines}</Table>
</Worksheet>
</Workbook>`
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename}.xls`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename, rows) {
  const list = (Array.isArray(rows) ? rows : rows ? [rows] : []).map(flattenRow)
  const safe = list.length ? list : [{ message: 'No rows to export' }]
  const keys = [...new Set(safe.flatMap((row) => Object.keys(row)))]
  const lines = [keys.join(','), ...safe.map((row) => keys.map((key) => csvCell(row[key])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function readCollection(name) {
  const { collection, getDocs } = await import('firebase/firestore')
  const { db } = await import('../../shared/services/firebaseService')
  const snap = await getDocs(collection(db, name))
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function exportCurrentPage(pathname, session = {}) {
  const path = pathname || '/'
  const month = monthKey()
  const today = todayKey()
  const file = (name, rows) => downloadCsv(`${name}-${today}`, rows)

  if (path.startsWith('/crm')) {
    if (path.includes('contacts')) {
      const { getClientsFromDb } = await import('../../features/crm/services/clientService')
      file('contacts', await getClientsFromDb())
      return
    }
    const { getLeads } = await import('../../features/crm/services/crmService')
    file('leads', await getLeads())
    return
  }

  if (path.startsWith('/projects/trash')) {
    const { getTrashedProjectsFromDb } = await import('../../features/projects/services/projectService')
    file('trashed-projects', await getTrashedProjectsFromDb())
    return
  }
  if (path.startsWith('/projects/tasks')) {
    const { getTasks } = await import('../../features/projects/services/projectService')
    file('tasks', await getTasks())
    return
  }
  if (path.startsWith('/projects/time')) {
    const { getTimelineEntriesForMonth } = await import('../../features/team/services/teamService')
    file('time-entries', await getTimelineEntriesForMonth(month))
    return
  }
  if (path.startsWith('/projects')) {
    const { getProjects } = await import('../../features/projects/services/projectService')
    file('projects', await getProjects())
    return
  }

  if (path.startsWith('/finance/expenses')) {
    const { getExpenses } = await import('../../features/finance/services/financeService')
    file('expenses', await getExpenses())
    return
  }
  if (path.startsWith('/finance/recurring')) {
    const { getRetainersFromDb } = await import('../../features/finance/services/financeService')
    file('recurring-billing', await getRetainersFromDb())
    return
  }
  if (path.startsWith('/finance')) {
    const { getInvoices } = await import('../../features/finance/services/financeService')
    file('invoices', await getInvoices())
    return
  }

  if (path.startsWith('/team/onboarding')) {
    const { listEmployeeOnboarding } = await import('../../features/team/services/employeeOnboardingService')
    file('onboarding', await listEmployeeOnboarding())
    return
  }
  if (path.startsWith('/team/scrum')) {
    const { listActiveEmployees, listScrumForDate } = await import('../../../../shared/scrum/scrumService.js')
    const [employees, records] = await Promise.all([listActiveEmployees(), listScrumForDate(today)])
    const rows = employees.map((employee) => {
      const record = records.get(employee.id)
      return {
        employee: employee.name || '',
        email: employee.email || '',
        date: today,
        morningScrum: record?.morningScrum || '',
        eodUpdate: record?.eodUpdate || '',
      }
    })
    downloadSpreadsheet(`scrum-${today}`, [
      { key: 'employee', header: 'Employee' },
      { key: 'email', header: 'Email' },
      { key: 'date', header: 'Date' },
      { key: 'morningScrum', header: 'Morning Scrum' },
      { key: 'eodUpdate', header: 'EOD Update' },
    ], rows)
    return
  }
  if (path.startsWith('/team/announcements')) {
    file('announcements', await readCollection('announcements'))
    return
  }
  if (path.startsWith('/team/helpdesk')) {
    file('client-support', await readCollection('helpDeskTickets'))
    return
  }
  if (path.startsWith('/team/attendance') || path.startsWith('/dashboard') || path.startsWith('/assistant')) {
    const { getAttendanceLogsForMonth } = await import('../../features/team/services/teamService')
    const logs = await getAttendanceLogsForMonth(month)
    file(path.startsWith('/team/attendance') ? 'attendance' : 'attendance-today', path.startsWith('/team/attendance') ? logs : logs.filter((row) => row.date === today))
    return
  }
  if (path.startsWith('/team/leave')) {
    const { getLeaveRequests } = await import('../../features/team/services/teamService')
    file('leave-requests', await getLeaveRequests())
    return
  }
  if (path.startsWith('/team/holidays')) {
    const { getCompanyHolidays } = await import('../../features/team/services/teamService')
    file('holidays', await getCompanyHolidays())
    return
  }
  if (path.startsWith('/team/payslips')) {
    file('payslips', await readCollection('payslip_records').catch(() => readCollection('payslips')))
    return
  }
  if (path.startsWith('/team/documents')) {
    file('employee-documents', await readCollection('document_files').catch(() => []))
    return
  }
  if (path.startsWith('/team/wfh-policy')) {
    const { getWfhPolicy, getOfficeLocation } = await import('../../features/team/services/teamService')
    const [policy, office] = await Promise.all([getWfhPolicy(), getOfficeLocation()])
    file('wfh-and-office', [{ ...policy, officeLat: office.lat, officeLng: office.lng, radiusMeters: office.radiusMeters }])
    return
  }
  if (path.startsWith('/team/timeline')) {
    const { getTimelineEntriesForMonth } = await import('../../features/team/services/teamService')
    file('timelines', await getTimelineEntriesForMonth(month))
    return
  }
  if (path.startsWith('/team/reports')) {
    const { listMonthlyReports } = await import('../../features/team/services/teamService')
    file('monthly-reports', await listMonthlyReports({ month }))
    return
  }
  if (path.startsWith('/team')) {
    const { getEmployees } = await import('../../features/team/services/teamService')
    file('employees', await getEmployees())
    return
  }

  if (path.startsWith('/marketing/content')) {
    const { getContentItems } = await import('../../features/marketing/services/marketingService')
    file('content-calendar', await getContentItems())
    return
  }
  if (path.startsWith('/marketing')) {
    const { getCampaigns } = await import('../../features/marketing/services/marketingService')
    file('campaigns', await getCampaigns())
    return
  }

  if (path.startsWith('/kpi')) {
    const { getKpiDefinitions, getLatestHealthScore } = await import('../../features/kpi/services/kpiService')
    const [kpis, score] = await Promise.all([getKpiDefinitions(), getLatestHealthScore()])
    file('kpi', [...(kpis || []), ...(score ? [{ record: 'latest-health-score', ...score }] : [])])
    return
  }

  if (path.startsWith('/reports/finance')) {
    const { getFinanceMetrics } = await import('../../features/reports/services/reportService')
    file('finance-report', await getFinanceMetrics())
    return
  }
  if (path.startsWith('/reports/projects')) {
    const { getProjectMetrics } = await import('../../features/reports/services/reportService')
    file('project-report', await getProjectMetrics())
    return
  }
  if (path.startsWith('/reports')) {
    const { getSalesMetrics } = await import('../../features/reports/services/reportService')
    const sales = await getSalesMetrics()
    file('sales-report', sales?.leadsBySource || sales || [])
    return
  }

  if (path.startsWith('/workflows/history')) {
    const { getWorkflowRuns } = await import('../../features/workflows/services/workflowService')
    file('workflow-history', await getWorkflowRuns())
    return
  }
  if (path.startsWith('/workflows')) {
    const { getWorkflows } = await import('../../features/workflows/services/workflowService')
    file('workflows', await getWorkflows())
    return
  }

  if (path.startsWith('/knowledge')) {
    const { getArticles } = await import('../../features/knowledge/services/knowledgeService')
    file('knowledge-base', await getArticles())
    return
  }

  if (path.startsWith('/settings/profile')) {
    file('profile', [{
      name: session.userDoc?.displayName || session.user?.displayName || '',
      email: session.user?.email || '',
      role: session.userDoc?.role || '',
    }])
    return
  }
  if (path.startsWith('/settings')) {
    const { getPaymentDetails } = await import('../../shared/services/paymentDetailsService')
    file('organization-settings', await getPaymentDetails())
    return
  }

  const { getEmployees } = await import('../../features/team/services/teamService')
  file('employees', await getEmployees())
}
