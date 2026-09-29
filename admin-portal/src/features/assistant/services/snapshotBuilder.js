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

function hasWord(haystack, word) {
  if (!word || word.length < 4) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(haystack)
}

function personLabels(person) {
  return [person?.displayName, person?.name, person?.email]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
}

export function matchEmployees(employees, message) {
  const q = String(message || '').toLowerCase()
  return (employees || []).filter((employee) =>
    personLabels(employee).some((label) => {
      if (hasWord(q, label)) return true
      const local = label.split('@')[0]
      if (hasWord(q, local)) return true
      return label.split(/[\s._@-]+/).some((part) => hasWord(q, part))
    })
  )
}

function samePerson(row, people) {
  const ids = new Set(
    people.flatMap((person) => [person.uid, person.employeeId].filter(Boolean).map(String))
  )
  const rowIds = [row?.uid, row?.employeeId, row?.ownerId].filter(Boolean).map(String)
  if (rowIds.some((id) => ids.has(id))) return true
  const rowNames = [row?.employeeName, row?.displayName, row?.name, row?.ownerName, row?.employeeEmail]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())
  return people.some((person) =>
    personLabels(person).some((label) => rowNames.some((rowName) => rowName === label || rowName.includes(label)))
  )
}

/** Keep only the records the question needs so the model request stays small. */
export function focusSnapshot(snapshot, message) {
  if (!snapshot) return snapshot
  const q = String(message || '').toLowerCase()
  const people = matchEmployees(snapshot.employees, message)
  const wantsLeads = /lead|pipeline|deal/.test(q)
  const wantsInvoices = /invoice|unpaid|payment|due/.test(q)
  const wantsProjects = /project|assigned|member/.test(q)
  const focusedPeople = people.length ? people : (snapshot.employees || []).slice(0, 30)

  const timeline = (snapshot.timelineEntries || []).filter((row) =>
    people.length ? samePerson(row, people) : true
  )
  const attendance = (snapshot.attendanceLogs || []).filter((row) =>
    people.length ? samePerson(row, people) : true
  )
  const leave = (snapshot.leaveRequests || []).filter((row) =>
    people.length ? samePerson(row, people) : true
  )
  const projects = (snapshot.projects || []).filter((project) => {
    if (!people.length) return wantsProjects || /project/.test(q)
    return (
      samePerson(project, people) ||
      (project.members || []).some((member) => samePerson(member, people))
    )
  })

  return {
    month: snapshot.month,
    employees: focusedPeople.slice(0, people.length ? people.length : 30),
    attendanceLogs: attendance.slice(0, 120),
    leaveRequests: leave.slice(0, 80),
    timelineEntries: timeline.slice(0, 80).map((row) => ({
      ...row,
      description: String(row.description || '').slice(0, 240),
    })),
    projects: (people.length || wantsProjects ? projects : []).slice(0, 20),
    leads: wantsLeads ? (snapshot.leads || []).slice(0, 30) : [],
    invoices: wantsInvoices ? (snapshot.invoices || []).slice(0, 30) : [],
  }
}
