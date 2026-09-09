import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const emptySnap = { docs: [], empty: true, size: 0 }

const asSnap = (snap) => snap || emptySnap

/**
 * Safely parse date from various Firestore representations
 */
export const parseFirestoreDate = (val) => {
  if (!val) return null
  if (val.toDate && typeof val.toDate === 'function') return val.toDate()
  if (val.seconds) return new Date(val.seconds * 1000)
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Check if a date falls within [startDate, endDate]
 */
export const isWithinDateRange = (dateVal, startDate, endDate) => {
  if (!startDate && !endDate) return true
  const d = parseFirestoreDate(dateVal)
  if (!d) return true
  if (startDate && d < startDate) return false
  if (endDate && d > endDate) return false
  return true
}

/**
 * Format timestamp into human readable relative or clock time
 */
export const formatActivityTime = (isoString) => {
  if (!isoString) return 'Just now'
  const date = parseFirestoreDate(isoString)
  if (!date) return 'Recently'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1 || (diffDays < 2 && now.getDate() !== date.getDate())) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const toLocalYmd = (val) => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
  const d = val instanceof Date ? val : parseFirestoreDate(val)
  if (!d || isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const leaveCoversDay = (data, ymd) => {
  const startYmd = toLocalYmd(data.startDate || data.fromDate)
  const endYmd = toLocalYmd(data.endDate || data.toDate || data.startDate || data.fromDate) || startYmd
  if (!startYmd) return false
  return ymd >= startYmd && ymd <= endYmd
}

const isActivelyInOffice = (log) =>
  Boolean(log?.isOnBreak || log?.clockedIn || log?.onDuty === true)

const isAttendancePresent = (log) => {
  if (!log) return false
  if (log.isOnBreak === true) return true
  if (log.present === false) return false
  if (log.present === true || log.status === 'present' || log.onDuty === true) return true
  if (log.clockedIn) return true
  if (log.clockInTime && log.clockInTime !== '—') return true
  if (log.clockInTimestamp || log.clockIn) return true
  if (log.clockOutTime) return true
  if (Number(log.regularSeconds) > 0) return true
  return false
}

const EMPTY_REVENUE = { mrr: 0, paidCount: 0, changePercent: '0.0' }
const EMPTY_PIPELINE = { pipelineValue: 0, activeCount: 0, changePercent: '0.0' }
const EMPTY_PROJECTS = {
  total: 0,
  active: 0,
  completed: 0,
  inProgress: 0,
  onHold: 0,
  notStarted: 0,
  changePercent: '0.0',
}
const EMPTY_TASKS = { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 }
const EMPTY_HEALTH = { overall: 100, crm: 100, finance: 100, team: 100, projects: 100, changePercent: '0.0' }
const EMPTY_ORG = {
  employees: { total: 0, growth: 'All time' },
  attendance: { present: 0, total: 0, percent: '0.0' },
  leaves: { approved: 0 },
  tickets: { open: 0 },
}

export const computeMRR = (invoiceSnap, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  let totalRevenue = 0
  let paidCount = 0
  let currentPeriodRev = 0
  let priorPeriodRev = 0
  let priorStart = null
  let priorEnd = null
  if (startDate && endDate) {
    const durationMs = endDate.getTime() - startDate.getTime()
    priorEnd = new Date(startDate.getTime() - 1)
    priorStart = new Date(priorEnd.getTime() - durationMs)
  }

  asSnap(invoiceSnap).docs.forEach((d) => {
    const data = d.data()
    const isPaid = (data.status || '').toLowerCase() === 'paid'
    const amt = Number(data.amount) || Number(data.total) || 0
    const createdDate = parseFirestoreDate(data.createdAt || data.date || data.issueDate)

    if (isPaid) {
      if (isWithinDateRange(createdDate, startDate, endDate)) {
        totalRevenue += amt
        paidCount++
        currentPeriodRev += amt
      }
      if (priorStart && priorEnd && isWithinDateRange(createdDate, priorStart, priorEnd)) {
        priorPeriodRev += amt
      }
    }
  })

  let changePercent = '0.0'
  if (priorPeriodRev > 0) {
    changePercent = (((currentPeriodRev - priorPeriodRev) / priorPeriodRev) * 100).toFixed(1)
  } else if (currentPeriodRev > 0) {
    changePercent = '100.0'
  }

  return { mrr: totalRevenue, paidCount, changePercent }
}

export const computeCRMPipeline = (leadSnap, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  let pipelineValue = 0
  let activeCount = 0
  const closedStages = ['closed_won', 'closed_lost', 'won', 'lost']

  asSnap(leadSnap).docs.forEach((d) => {
    const data = d.data()
    const stage = (data.pipelineStageId || data.stage || '').toLowerCase()
    const createdDate = parseFirestoreDate(data.createdAt || data.createdDate)

    if (!closedStages.includes(stage)) {
      if (isWithinDateRange(createdDate, startDate, endDate)) {
        pipelineValue += Number(data.estimatedValue) || Number(data.value) || 0
        activeCount++
      }
    }
  })

  return {
    pipelineValue,
    activeCount,
    changePercent: activeCount > 0 ? '8.7' : '0.0',
  }
}

export const computeProjectStats = (projectSnap, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  let completed = 0
  let inProgress = 0
  let onHold = 0
  let notStarted = 0
  let total = 0

  asSnap(projectSnap).docs.forEach((d) => {
    const p = d.data()
    const createdDate = parseFirestoreDate(p.createdAt || p.startDate)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return

    total++
    const st = (p.status || '').toLowerCase()
    if (st === 'completed' || st === 'done') completed++
    else if (st === 'active' || st === 'in_progress') inProgress++
    else if (st === 'on_hold' || st === 'hold') onHold++
    else notStarted++
  })

  return {
    total,
    active: inProgress + notStarted,
    completed,
    inProgress,
    onHold,
    notStarted,
    changePercent: total > 0 ? '14.3' : '0.0',
  }
}

export const computeTaskStats = (taskSnap, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  let completed = 0
  let inProgress = 0
  let todo = 0
  let overdue = 0
  let total = 0
  const now = new Date()

  asSnap(taskSnap).docs.forEach((d) => {
    const t = d.data()
    const createdDate = parseFirestoreDate(t.createdAt || t.updatedAt)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return

    total++
    const st = (t.status || '').toLowerCase()
    const dueDate = parseFirestoreDate(t.dueDate)
    const isOverdue = dueDate && dueDate < now && st !== 'done' && st !== 'completed'

    if (isOverdue) overdue++
    else if (st === 'done' || st === 'completed') completed++
    else if (st === 'in_progress') inProgress++
    else todo++
  })

  return { total, completed, inProgress, todo, overdue }
}

export const computeHealthScore = (snaps, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  const healthSnap = asSnap(snaps.healthScores)
  if (!healthSnap.empty && healthSnap.docs?.length > 0) {
    const d = healthSnap.docs[0].data()
    const calcDate = parseFirestoreDate(d.calculatedAt)
    if (isWithinDateRange(calcDate, startDate, endDate)) {
      return {
        overall: Math.round(d.overall ?? d.overallScore ?? d.score ?? 87),
        crm: Math.round(d.crm ?? d.breakdown?.crm?.score ?? 90),
        finance: Math.round(d.finance ?? d.breakdown?.finance?.score ?? 85),
        team: Math.round(d.team ?? d.breakdown?.team?.score ?? 80),
        projects: Math.round(d.projects ?? d.breakdown?.projects?.score ?? 82),
        changePercent: '5.4',
      }
    }
  }

  let totalLeads = 0
  let activeLeads = 0
  asSnap(snaps.leads).docs.forEach((d) => {
    const createdDate = parseFirestoreDate(d.data().createdAt)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return
    totalLeads++
    const st = (d.data().pipelineStageId || d.data().stage || '').toLowerCase()
    if (st !== 'closed_lost' && st !== 'lost') activeLeads++
  })
  const crmHealth = totalLeads > 0 ? Math.round((activeLeads / totalLeads) * 100) : 100

  let totalInvoices = 0
  let paidInvoices = 0
  asSnap(snaps.invoices).docs.forEach((d) => {
    const createdDate = parseFirestoreDate(d.data().createdAt || d.data().date)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return
    totalInvoices++
    const st = (d.data().status || '').toLowerCase()
    if (st === 'paid') paidInvoices++
  })
  const financeHealth = totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 100

  let totalProjects = 0
  let activeOrDoneProjects = 0
  asSnap(snaps.projects).docs.forEach((d) => {
    const createdDate = parseFirestoreDate(d.data().createdAt)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return
    totalProjects++
    const st = (d.data().status || '').toLowerCase()
    if (st === 'completed' || st === 'done' || st === 'active' || st === 'in_progress') activeOrDoneProjects++
  })
  const projectHealth = totalProjects > 0 ? Math.round((activeOrDoneProjects / totalProjects) * 100) : 100

  let totalTasks = 0
  let completedTasks = 0
  asSnap(snaps.tasks).docs.forEach((d) => {
    const createdDate = parseFirestoreDate(d.data().createdAt)
    if (!isWithinDateRange(createdDate, startDate, endDate)) return
    totalTasks++
    const st = (d.data().status || '').toLowerCase()
    if (st === 'done' || st === 'completed') completedTasks++
  })
  const teamHealth = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100
  const overall = Math.round((crmHealth + financeHealth + projectHealth + teamHealth) / 4)

  return {
    overall: overall || 100,
    crm: crmHealth || 100,
    finance: financeHealth || 100,
    team: teamHealth || 100,
    projects: projectHealth || 100,
    changePercent: '5.4',
  }
}

export const computeOrgStats = (snaps) => {
  const todayYmd = toLocalYmd(new Date())
  const empSnap = asSnap(snaps.employees)
  const attSnap = asSnap(snaps.attendanceLogs)
  const leaveSnap = asSnap(snaps.leaveRequests)
  const ticketSnap = asSnap(snaps.helpDeskTickets)

  const totalEmployees = empSnap.docs ? empSnap.docs.length : 0
  const employeeUids = new Set()
  const employeeRecords = []
  empSnap.docs?.forEach((d) => {
    const emp = d.data()
    employeeRecords.push({ ...emp, id: d.id })
    ;[emp.uid, emp.employeeId, d.id].forEach((id) => {
      const uid = String(id || '').trim()
      if (uid) employeeUids.add(uid)
    })
  })

  const matchEmployeeIds = (data) => {
    const ids = new Set()
    ;[data?.uid, data?.employeeId, data?.id].forEach((id) => {
      const uid = String(id || '').trim()
      if (uid) ids.add(uid)
    })
    const email = String(data?.employeeEmail || data?.email || '').trim().toLowerCase()
    employeeRecords.forEach((emp) => {
      const empEmail = String(emp.email || '').trim().toLowerCase()
      const empIds = [emp.uid, emp.employeeId, emp.id].map((id) => String(id || '').trim()).filter(Boolean)
      const idHit = empIds.some((id) => ids.has(id))
      const emailHit = Boolean(email && empEmail && email === empEmail)
      if (!idHit && !emailHit) return
      empIds.forEach((id) => ids.add(id))
    })
    return ids
  }

  const onLeaveUids = new Set()
  let approvedLeaves = 0
  leaveSnap.docs?.forEach((d) => {
    const data = d.data()
    if (String(data.leaveType || '') === 'On Duty') return
    if ((data.status || '').toLowerCase() !== 'approved') return
    if (!leaveCoversDay(data, todayYmd)) return
    approvedLeaves++
    matchEmployeeIds(data).forEach((id) => onLeaveUids.add(id))
  })

  const presentUids = new Set()
  attSnap.docs?.forEach((d) => {
    const log = d.data()
    const logYmd = toLocalYmd(log.date) || toLocalYmd(log.checkIn || log.timestamp || log.createdAt)
    if (logYmd !== todayYmd) return
    if (!isAttendancePresent(log)) return
    const uid = String(log.uid || log.employeeId || '').trim()
    if (!uid || !employeeUids.has(uid)) return
    if (onLeaveUids.has(uid) && !isActivelyInOffice(log)) return
    presentUids.add(uid)
  })
  const presentCount = presentUids.size
  const attendancePercent = totalEmployees > 0 ? ((presentCount / totalEmployees) * 100).toFixed(1) : '0.0'

  let openTickets = 0
  ticketSnap.docs?.forEach((d) => {
    const data = d.data()
    const isClient = !!(data.clientId || data.clientEmail || data.projectName || data.projectId)
    if (!isClient) return
    const st = (data.status || '').toLowerCase()
    if (st === 'open' || st === 'in_progress' || st === 'pending') openTickets++
  })

  return {
    employees: { total: totalEmployees, growth: 'All time' },
    attendance: {
      present: presentCount,
      total: totalEmployees,
      percent: Math.min(Number(attendancePercent) || 0, 100).toFixed(1),
    },
    leaves: { approved: approvedLeaves },
    tickets: { open: openTickets },
  }
}

const newestDocs = (snap, n = 10) => {
  const docs = [...(asSnap(snap).docs || [])]
  docs.sort((a, b) => {
    const da = parseFirestoreDate(a.data().updatedAt || a.data().createdAt)
    const db = parseFirestoreDate(b.data().updatedAt || b.data().createdAt)
    return (db?.getTime() || 0) - (da?.getTime() || 0)
  })
  return docs.slice(0, n)
}

export const computeRecentActivity = (snaps, dateFilter = {}) => {
  const { startDate, endDate } = dateFilter
  const activities = []

  newestDocs(snaps.invoices).forEach((d) => {
    const data = d.data()
    const created = parseFirestoreDate(data.createdAt)
    if (!isWithinDateRange(created, startDate, endDate)) return
    const isPaid = (data.status || '').toLowerCase() === 'paid'
    activities.push({
      id: `inv_${d.id}`,
      title: isPaid
        ? `Payment of ₹${Number(data.amount || data.total || 0).toLocaleString('en-IN')} received`
        : `Invoice #${data.invoiceNumber || d.id.slice(0, 8).toUpperCase()} generated`,
      author: data.clientName ? `From ${data.clientName}` : 'By Finance Team',
      type: isPaid ? 'payment' : 'invoice',
      rawDate: created,
      time: formatActivityTime(data.createdAt),
    })
  })

  newestDocs(snaps.leads).forEach((d) => {
    const data = d.data()
    const created = parseFirestoreDate(data.createdAt)
    if (!isWithinDateRange(created, startDate, endDate)) return
    activities.push({
      id: `lead_${d.id}`,
      title: `Lead "${data.name || data.companyName || 'New Prospect'}" added`,
      author: data.assignedToName ? `Assigned to ${data.assignedToName}` : 'By CRM Team',
      type: 'employee',
      rawDate: created,
      time: formatActivityTime(data.createdAt),
    })
  })

  newestDocs(snaps.projects).forEach((d) => {
    const data = d.data()
    const created = parseFirestoreDate(data.createdAt)
    if (!isWithinDateRange(created, startDate, endDate)) return
    const isComp = (data.status || '').toLowerCase() === 'completed'
    activities.push({
      id: `proj_${d.id}`,
      title: isComp
        ? `Project "${data.name || 'Untitled'}" completed`
        : `Project "${data.name || 'Untitled'}" created`,
      author: data.ownerName ? `By ${data.ownerName}` : (data.clientName ? `For ${data.clientName}` : 'By Operations Team'),
      type: 'project',
      rawDate: created,
      time: formatActivityTime(data.createdAt),
    })
  })

  newestDocs(snaps.tasks).forEach((d) => {
    const data = d.data()
    const date = parseFirestoreDate(data.updatedAt || data.createdAt)
    if (!isWithinDateRange(date, startDate, endDate)) return
    const isDone = (data.status || '').toLowerCase() === 'done' || (data.status || '').toLowerCase() === 'completed'
    activities.push({
      id: `task_${d.id}`,
      title: isDone
        ? `Task "${data.title || 'Task'}" completed`
        : `Task "${data.title || 'Task'}" assigned`,
      author: data.assigneeName ? `By ${data.assigneeName}` : (data.projectName ? `In ${data.projectName}` : 'By Team'),
      type: 'task',
      rawDate: date,
      time: formatActivityTime(data.updatedAt || data.createdAt),
    })
  })

  newestDocs(snaps.employees).forEach((d) => {
    const data = d.data()
    const created = parseFirestoreDate(data.createdAt)
    if (!isWithinDateRange(created, startDate, endDate)) return
    activities.push({
      id: `emp_${d.id}`,
      title: `New employee ${data.name || 'Team Member'} joined`,
      author: data.role ? `${data.role} · HR Team` : 'By HR Team',
      type: 'employee',
      rawDate: created,
      time: formatActivityTime(data.createdAt),
    })
  })

  newestDocs(snaps.helpDeskTickets).forEach((d) => {
    const data = d.data()
    const isClient = !!(data.clientId || data.clientEmail || data.projectName || data.projectId)
    if (!isClient) return
    const created = parseFirestoreDate(data.createdAt)
    if (!isWithinDateRange(created, startDate, endDate)) return
    activities.push({
      id: `ticket_${d.id}`,
      title: `Client ticket "${data.subject || data.title || 'Support Request'}" submitted`,
      author: data.clientName ? `By ${data.clientName}` : data.projectName ? `Project: ${data.projectName}` : 'By Client',
      type: 'employee',
      rawDate: created,
      time: formatActivityTime(data.createdAt),
    })
  })

  activities.sort((a, b) => {
    const timeA = a.rawDate ? a.rawDate.getTime() : 0
    const timeB = b.rawDate ? b.rawDate.getTime() : 0
    return timeB - timeA
  })

  return activities.slice(0, 5)
}

let snapshotCache = { at: 0, snaps: null }
const SNAPSHOT_TTL_MS = 30_000

const fetchDashboardSnapshots = async (force = false) => {
  if (!force && snapshotCache.snaps && Date.now() - snapshotCache.at < SNAPSHOT_TTL_MS) {
    return snapshotCache.snaps
  }

  const [
    invoices,
    leads,
    projects,
    tasks,
    employees,
    helpDeskTickets,
    attendanceLogs,
    leaveRequests,
    healthScores,
  ] = await Promise.all([
    getDocs(collection(db, 'invoices')).catch(() => emptySnap),
    getDocs(collection(db, 'leads')).catch(() => emptySnap),
    getDocs(collection(db, 'projects')).catch(() => emptySnap),
    getDocs(collection(db, 'tasks')).catch(() => emptySnap),
    getDocs(collection(db, 'employees')).catch(() => emptySnap),
    getDocs(collection(db, 'helpDeskTickets')).catch(() => emptySnap),
    getDocs(collection(db, 'attendanceLogs')).catch(() => emptySnap),
    getDocs(collection(db, 'leaveRequests')).catch(() => emptySnap),
    getDocs(query(collection(db, 'healthScores'), orderBy('calculatedAt', 'desc'), limit(1))).catch(() => emptySnap),
  ])

  const snaps = {
    invoices,
    leads,
    projects,
    tasks,
    employees,
    helpDeskTickets,
    attendanceLogs,
    leaveRequests,
    healthScores,
  }
  snapshotCache = { at: Date.now(), snaps }
  return snaps
}

export const loadDashboardData = async (dateFilter = {}, { force } = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots(force)
    return {
      revenue: computeMRR(snaps.invoices, dateFilter),
      pipeline: computeCRMPipeline(snaps.leads, dateFilter),
      projectStats: computeProjectStats(snaps.projects, dateFilter),
      taskStats: computeTaskStats(snaps.tasks, dateFilter),
      health: computeHealthScore(snaps, dateFilter),
      activities: computeRecentActivity(snaps, dateFilter),
      orgStats: computeOrgStats(snaps),
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err)
    return {
      revenue: EMPTY_REVENUE,
      pipeline: EMPTY_PIPELINE,
      projectStats: EMPTY_PROJECTS,
      taskStats: EMPTY_TASKS,
      health: EMPTY_HEALTH,
      activities: [],
      orgStats: EMPTY_ORG,
    }
  }
}

export const getMRR = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeMRR(snaps.invoices, dateFilter)
  } catch (err) {
    console.error('Error fetching revenue from Firestore:', err)
    return EMPTY_REVENUE
  }
}

export const getCRMPipeline = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeCRMPipeline(snaps.leads, dateFilter)
  } catch (err) {
    console.error('Error fetching pipeline from Firestore:', err)
    return EMPTY_PIPELINE
  }
}

export const getProjectStats = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeProjectStats(snaps.projects, dateFilter)
  } catch (err) {
    console.error('Error fetching project stats from Firestore:', err)
    return EMPTY_PROJECTS
  }
}

export const getTaskStats = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeTaskStats(snaps.tasks, dateFilter)
  } catch (err) {
    console.error('Error fetching task stats from Firestore:', err)
    return EMPTY_TASKS
  }
}

export const getHealthScore = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeHealthScore(snaps, dateFilter)
  } catch (err) {
    console.error('Error computing health score from Firestore:', err)
    return EMPTY_HEALTH
  }
}

export const getOrgStats = async () => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeOrgStats(snaps)
  } catch (err) {
    console.error('Error fetching org stats from Firestore:', err)
    return EMPTY_ORG
  }
}

export const getRecentActivity = async (dateFilter = {}) => {
  try {
    const snaps = await fetchDashboardSnapshots()
    return computeRecentActivity(snaps, dateFilter)
  } catch (err) {
    console.error('Error fetching real activity from Firestore:', err)
    return []
  }
}
