import {
  getEmployees,
  getAttendanceLogsForMonth,
  getLeaveRequestsForMonth,
  getTimelineEntriesForMonth,
} from '../../team/services/teamService'
import { currentMonthStr } from '../../team/services/monthlyReportEngine'
import { getProjects } from '../../projects/services/projectService'
import { getLeads } from '../../crm/services/crmService'
import { getInvoices } from '../../finance/services/financeService'

function pick(obj, keys) {
  const out = {}
  keys.forEach((k) => {
    if (obj[k] != null && obj[k] !== '') out[k] = obj[k]
  })
  return out
}

export async function buildAssistantSnapshot() {
  const month = currentMonthStr()
  const [employees, attendanceLogs, leaveRequests, timelineEntries, projects, leads, invoices] =
    await Promise.all([
      getEmployees().catch(() => []),
      getAttendanceLogsForMonth(month).catch(() => []),
      getLeaveRequestsForMonth(month).catch(() => []),
      getTimelineEntriesForMonth(month).catch(() => []),
      getProjects().catch(() => []),
      getLeads().catch(() => []),
      getInvoices().catch(() => []),
    ])

  const nameByUid = {}
  ;(employees || []).forEach((e) => {
    const id = String(e.uid || e.employeeId || '')
    if (id) nameByUid[id] = e.displayName || e.name || e.email || id
  })

  const flattenMembers = (members) => {
    if (!Array.isArray(members)) return []
    return members.slice(0, 20).map((m) => {
      if (typeof m === 'string') return { uid: m, displayName: nameByUid[m] || m }
      const uid = String(m?.uid || m?.id || m?.employeeId || '')
      return {
        uid,
        displayName: m?.displayName || m?.name || nameByUid[uid] || uid,
      }
    })
  }

  return {
    month,
    employees: (employees || []).slice(0, 80).map((e) =>
      pick(e, ['uid', 'employeeId', 'displayName', 'name', 'email', 'departmentName', 'roleName', 'status', 'joinedAt'])
    ),
    attendanceLogs: (attendanceLogs || []).slice(0, 400).map((l) =>
      pick(l, ['uid', 'date', 'present', 'onDuty', 'clockedIn', 'clockInTime', 'clockOutTime', 'source', 'regularSeconds'])
    ),
    leaveRequests: (leaveRequests || []).slice(0, 200).map((l) =>
      pick(l, [
        'employeeId',
        'employeeName',
        'employeeEmail',
        'leaveType',
        'requestedLeaveType',
        'status',
        'startDate',
        'endDate',
      ])
    ),
    timelineEntries: (timelineEntries || []).slice(0, 300).map((e) => ({
      uid: e.uid || '',
      employeeName: e.employeeName || nameByUid[String(e.uid || '')] || '',
      date: e.date || '',
      hours: Number(e.hours) || 0,
      type: e.entryType || 'work',
      description: String(e.description || '').slice(0, 400),
    })),
    projects: (projects || []).slice(0, 40).map((p) => ({
      ...pick(p, ['projectId', 'id', 'name', 'status', 'clientName', 'employeeId', 'ownerId', 'completionPercentage']),
      ownerName: p.ownerName || nameByUid[String(p.ownerId || p.employeeId || '')] || '',
      members: flattenMembers(p.members),
    })),
    leads: (leads || []).slice(0, 40).map((l) =>
      pick(l, ['leadId', 'name', 'companyName', 'contactName', 'email', 'pipelineStage', 'pipelineStageId', 'estimatedValue', 'status'])
    ),
    invoices: (invoices || []).slice(0, 40).map((i) =>
      pick(i, ['invoiceId', 'clientName', 'status', 'total', 'amountDue', 'dueDate'])
    ),
  }
}
