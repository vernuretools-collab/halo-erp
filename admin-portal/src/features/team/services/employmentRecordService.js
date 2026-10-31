import { collection, getDocs } from 'firebase/firestore'
import { db, supabase } from '../../../shared/services/firebaseService'
import { listWorkTimelineEntries, mapTimelineRow } from '../../../../../shared/supabase/listWorkTimelineEntries.js'
import { getCappedRegularSeconds } from './attendanceStatsUtils'
import {
  collectEmployeeIdentityIds,
  employeeDepartment,
  employeeDesignation,
  employeeDisplayName,
  employeeDocId,
  employeeJoiningDate,
  employeePublicId,
  employmentStatusLabel,
  formatTenure,
  inTenure,
  isoDay,
  recordMatchesEmployee,
} from '../../../../../shared/employees/employmentStatus.js'

function memberIds(member) {
  if (member == null) return []
  if (typeof member !== 'object') return [String(member)]
  return [member.uid, member.id, member.employeeId, member.email].filter((value) => value != null && value !== '').map(String)
}

function projectIncludes(project, employee) {
  const ids = new Set(collectEmployeeIdentityIds(employee))
  const email = String(employee.email || '').trim().toLowerCase()
  const members = Array.isArray(project?.members) ? project.members : []
  return members.some((member) =>
    memberIds(member).some((value) => ids.has(value) || (email && value.toLowerCase() === email)),
  )
}

function taskIncludes(task, employee) {
  if (recordMatchesEmployee(task, employee)) return true
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : []
  return subtasks.some((subtask) => recordMatchesEmployee(subtask, employee))
}

function datedInTenure(value, start, end) {
  return inTenure(value, start, end)
}

function flattenAnswers(value, prefix = '') {
  if (value == null || value === '') return []
  if (typeof value !== 'object') {
    const text = String(value)
    if (text.startsWith('data:')) return [[prefix || 'file', 'Uploaded file']]
    return [[prefix || 'value', text]]
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenAnswers(item, prefix ? `${prefix} ${index + 1}` : String(index + 1)))
  }
  return Object.entries(value).flatMap(([key, item]) => flattenAnswers(item, prefix ? `${prefix} / ${key}` : key))
}

function commentRows(task) {
  const rows = []
  for (const entry of Array.isArray(task?.activity) ? task.activity : []) {
    rows.push({
      kind: entry?.kind === 'comment' ? 'Comment' : 'Update',
      text: entry?.body || entry?.message || entry?.text || entry?.description || '',
      actor: entry?.actorName || entry?.author || '',
      at: entry?.createdAt || entry?.timestamp || '',
    })
  }
  for (const subtask of Array.isArray(task?.subtasks) ? task.subtasks : []) {
    for (const entry of Array.isArray(subtask?.comments) ? subtask.comments : []) {
      rows.push({
        kind: 'Comment',
        text: entry?.body || '',
        actor: entry?.actorName || '',
        at: entry?.createdAt || '',
        context: subtask?.title || 'Subtask',
      })
    }
  }
  return rows.filter((row) => row.text)
}

async function loadCollection(name) {
  const snap = await getDocs(collection(db, name))
  return snap.docs.map((row) => ({ id: row.id, ...row.data() }))
}

async function loadDocuments(employee) {
  const ids = collectEmployeeIdentityIds(employee)
  const rows = []
  await Promise.all(
    ids.map(async (id) => {
      try {
        const snap = await getDocs(collection(db, 'documents', id, 'files'))
        snap.docs.forEach((row) => {
          rows.push({ id: row.id, ownerId: id, ...row.data() })
        })
      } catch {
        /* this identity has no document folder */
      }
    }),
  )
  const seen = new Set()
  return rows.filter((row) => {
    const key = `${row.ownerId}:${row.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function loadOnboarding(employee) {
  if (!supabase) return []
  const { data, error } = await supabase.from('employee_onboarding').select('*')
  if (error) throw new Error(error.message)
  const ids = new Set(collectEmployeeIdentityIds(employee))
  const email = String(employee.email || '').trim().toLowerCase()
  const publicId = employeePublicId(employee)
  return (data || []).filter((row) => {
    const employment = row.employment || {}
    const answers = row.answers || {}
    if (row.auth_id && ids.has(String(row.auth_id))) return true
    if (employment.employeeId && (ids.has(String(employment.employeeId)) || employment.employeeId === publicId)) return true
    const rowEmail = String(employment.email || answers.email || answers.personalEmail || '').trim().toLowerCase()
    return Boolean(email && rowEmail && email === rowEmail)
  })
}

export async function loadEmploymentRecord(employee) {
  const start = employeeJoiningDate(employee)
  const end = isoDay(employee.lastWorkingDay)
  const ids = collectEmployeeIdentityIds(employee)

  const [projects, tasks, scrums, attendanceLogs, leaveRequests, documents, onboarding, timelineRows] = await Promise.all([
    loadCollection('projects'),
    loadCollection('tasks'),
    loadCollection('dailyScrums'),
    loadCollection('attendanceLogs'),
    loadCollection('leaveRequests'),
    loadDocuments(employee),
    loadOnboarding(employee),
    listWorkTimelineEntries(ids, start || '1970-01-01', end || '2999-12-31').catch(() => []),
  ])

  const timeline = (timelineRows || [])
    .map(mapTimelineRow)
    .filter((entry) => datedInTenure(entry.date, start, end))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const attendance = attendanceLogs
    .filter((log) => recordMatchesEmployee(log, employee) && datedInTenure(log.date, start, end))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const leave = leaveRequests
    .filter((request) => {
      if (!recordMatchesEmployee(request, employee)) return false
      const leaveStart = isoDay(request.startDate || request.date)
      const leaveEnd = isoDay(request.endDate || request.startDate || request.date)
      if (!start && !end) return true
      if (leaveEnd && start && leaveEnd < start) return false
      if (leaveStart && end && leaveStart > end) return false
      return true
    })
    .sort((a, b) => String(a.startDate || '').localeCompare(String(b.startDate || '')))

  const scrum = scrums
    .filter((row) => recordMatchesEmployee(row, employee) && datedInTenure(row.date, start, end))
    .filter((row) => String(row.morningScrum || '').trim() || String(row.eodUpdate || '').trim())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  const relatedTasks = tasks.filter((task) => taskIncludes(task, employee) && !task.deletedAt)
  const relatedProjectIds = new Set([
    ...projects.filter((project) => projectIncludes(project, employee) && !project.deletedAt).map((project) => project.id),
    ...relatedTasks.map((task) => task.projectId).filter(Boolean),
  ])

  const projectRows = []
  for (const project of projects) {
    if (!relatedProjectIds.has(project.id) || project.deletedAt) continue
    let updates = []
    try {
      const [stepsSnap, timelineSnap] = await Promise.all([
        getDocs(collection(db, 'projects', project.id, 'processSteps')),
        getDocs(collection(db, 'projects', project.id, 'timeline')),
      ])
      updates = [...stepsSnap.docs, ...timelineSnap.docs]
        .map((row) => ({ id: row.id, ...row.data() }))
        .filter((row) => recordMatchesEmployee(row, employee) || String(row.author || '') === employeeDisplayName(employee))
        .filter((row) => datedInTenure(row.createdAt || row.updatedAt || row.timestamp, start, end))
        .map((row) => ({
          title: row.title || 'Update',
          text: row.message || row.description || '',
          at: row.createdAt || row.timestamp || '',
        }))
        .filter((row) => row.text)
    } catch {
      updates = []
    }
    const projectTasks = relatedTasks
      .filter((task) => String(task.projectId || '') === String(project.id))
      .map((task) => ({
        id: task.id,
        title: task.title || task.name || 'Task',
        description: task.description || '',
        status: task.status || '',
        notes: commentRows(task).filter((note) => datedInTenure(note.at, start, end)),
      }))
    projectRows.push({
      id: project.id,
      name: project.name || 'Project',
      description: project.description || '',
      updates,
      tasks: projectTasks,
    })
  }

  for (const task of relatedTasks) {
    if (task.projectId && relatedProjectIds.has(String(task.projectId))) continue
    projectRows.push({
      id: task.projectId || `task-${task.id}`,
      name: task.projectName || 'Project',
      description: '',
      updates: [],
      tasks: [
        {
          id: task.id,
          title: task.title || task.name || 'Task',
          description: task.description || '',
          status: task.status || '',
          notes: commentRows(task).filter((note) => datedInTenure(note.at, start, end)),
        },
      ],
    })
  }

  const timelineHours = timeline.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0)
  const attendanceSeconds = attendance.reduce((sum, log) => sum + getCappedRegularSeconds(log), 0)
  const answers = onboarding.flatMap((row) => flattenAnswers(row.answers))

  return {
    employee,
    name: employeeDisplayName(employee),
    employeeId: employeePublicId(employee),
    designation: employeeDesignation(employee),
    department: employeeDepartment(employee),
    statusLabel: employmentStatusLabel(employee.status),
    joiningDate: start,
    lastWorkingDay: end,
    exitReason: employee.exitReason || '',
    tenure: formatTenure(start, end),
    timelineHours,
    attendanceSeconds,
    timeline,
    attendance,
    leave,
    scrum,
    projects: projectRows,
    documents: documents.map((file) => ({
      name: file.fileName || file.name || 'Document',
      category: file.category || '',
      date: isoDay(file.createdAt || file.uploadedAt || file.updatedAt),
    })),
    onboarding: answers,
    exitHistory: Array.isArray(employee.exitHistory) ? employee.exitHistory : [],
  }
}

export function employmentRecordFilename(record, ext) {
  const safe = String(record?.name || 'employee').replace(/[^\w.-]+/g, '_')
  return `${safe}_employment_record.${ext}`
}

export { employeeDocId }
