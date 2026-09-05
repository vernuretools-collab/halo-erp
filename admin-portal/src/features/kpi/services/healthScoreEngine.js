import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import {
  DEFAULT_HEALTH_CONFIG,
  METRIC_LABELS,
  PILLAR_LABELS,
} from './healthScoreDefaults'

const CLOSED_WON = new Set(['won', 'closed_won', 'stage_won'])
const CLOSED_LOST = new Set(['lost', 'closed_lost', 'stage_lost'])
const ACTIVE_PROJECT = new Set(['active', 'in_progress', 'in progress'])
const DONE_TASK = new Set(['done', 'completed'])
const ACTIVE_EMPLOYEE = new Set(['active', 'employed', ''])

const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const parseDate = (value) => {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const clampScore = (n) => Math.min(100, Math.max(0, Math.round(n)))

const isWon = (lead) => {
  const stageId = String(lead.pipelineStageId || '').toLowerCase()
  const stage = String(lead.pipelineStage || '').toLowerCase()
  return CLOSED_WON.has(stageId) || stage === 'won' || CLOSED_WON.has(stage)
}

const isLost = (lead) => {
  const stageId = String(lead.pipelineStageId || '').toLowerCase()
  const stage = String(lead.pipelineStage || '').toLowerCase()
  return CLOSED_LOST.has(stageId) || stage === 'lost' || CLOSED_LOST.has(stage)
}

const isOpenLead = (lead) => !isWon(lead) && !isLost(lead)

const leadValue = (lead) => Number(lead.estimatedValue) || Number(lead.value) || 0

const invoiceAmount = (inv) =>
  Number(inv.total) || Number(inv.amount) || Number(inv.amountDue) || 0

const isPaidInvoice = (inv) => {
  const s = String(inv.status || '').toLowerCase()
  return s === 'paid'
}

const isOverdueInvoice = (inv) => {
  const s = String(inv.status || '').toLowerCase()
  if (s === 'overdue') return true
  if (isPaidInvoice(inv)) return false
  const due = parseDate(inv.dueDate)
  return due ? due < new Date() : false
}

const isActiveProject = (p) =>
  ACTIVE_PROJECT.has(String(p.status || '').toLowerCase())

const isCompletedProject = (p) => {
  const s = String(p.status || '').toLowerCase()
  return s === 'completed' || s === 'done'
}

/**
 * Score a "higher is better" metric against a target (linear 0–100, capped).
 */
export const scoreHigherBetter = (value, target) => {
  if (value == null || target == null || target <= 0) return null
  return clampScore((value / target) * 100)
}

/**
 * Score coverage: 1x → ~33, target (default 3x) → 100, soft-cap above 4x.
 */
export const scoreCoverage = (coverage, target = 3) => {
  if (coverage == null) return null
  if (coverage <= 0) return 0
  const t = target > 0 ? target : 3
  if (coverage >= t) return 100
  return clampScore((coverage / t) * 100)
}

/**
 * MoM growth: 0% → 50 baseline-ish toward target; at/above target → 100.
 * Negative growth maps below 50.
 */
export const scoreMomGrowth = (growthPct, target = 10) => {
  if (growthPct == null) return null
  const t = target > 0 ? target : 10
  if (growthPct >= t) return 100
  if (growthPct >= 0) return clampScore(50 + (growthPct / t) * 50)
  // Negative: -t or worse → 0
  return clampScore(50 + (growthPct / t) * 50)
}

/**
 * Overdue: overduePct at or below maxPct → 100; rises toward 0 as overdue grows.
 */
export const scoreOverdueHealth = (overduePct, maxPct = 10) => {
  if (overduePct == null) return null
  const max = maxPct > 0 ? maxPct : 10
  if (overduePct <= max) return 100
  // At 3x max overdue → ~0
  const excess = overduePct - max
  return clampScore(100 - (excess / (max * 2)) * 100)
}

/**
 * Leave load: leavePct at or below max → 100; worse as more of team is on leave.
 */
export const scoreLeaveLoad = (leavePct, maxPct = 20) => {
  if (leavePct == null) return null
  const max = maxPct > 0 ? maxPct : 20
  if (leavePct <= max) return 100
  const excess = leavePct - max
  return clampScore(100 - (excess / max) * 100)
}

const normalizeWeights = (weights) => {
  const entries = Object.entries(weights || {}).filter(([, w]) => Number(w) > 0)
  const total = entries.reduce((s, [, w]) => s + Number(w), 0)
  if (total <= 0) return {}
  return Object.fromEntries(entries.map(([k, w]) => [k, Number(w) / total]))
}

/**
 * Fetch raw collections needed for health scoring.
 */
export const fetchHealthInputs = async () => {
  const [
    leadsSnap,
    invoicesSnap,
    expensesSnap,
    projectsSnap,
    tasksSnap,
    employeesSnap,
    leaveSnap,
    attendanceSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'leads')),
    getDocs(collection(db, 'invoices')),
    getDocs(collection(db, 'expenses')),
    getDocs(collection(db, 'projects')),
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'employees')),
    getDocs(collection(db, 'leaveRequests')),
    getDocs(collection(db, 'attendanceLogs')).catch(() => ({ docs: [] })),
  ])

  return {
    leads: leadsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    invoices: invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    expenses: expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    projects: projectsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    employees: employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    leaveRequests: leaveSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    attendanceLogs: attendanceSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  }
}

/**
 * Derive raw metric values from live inputs.
 */
export const deriveRawMetrics = (inputs, config = DEFAULT_HEALTH_CONFIG) => {
  const { leads, invoices, projects, tasks, employees, leaveRequests, attendanceLogs } =
    inputs
  const now = new Date()
  const fourteenDaysAgo = daysAgo(14)
  const thirtyDaysAgo = daysAgo(30)
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const won = leads.filter(isWon)
  const lost = leads.filter(isLost)
  const open = leads.filter(isOpenLead)
  const closedCount = won.length + lost.length
  const winRate = closedCount > 0 ? (won.length / closedCount) * 100 : null

  const openPipelineValue = open.reduce((s, l) => s + leadValue(l), 0)
  const recentWonValue = won
    .filter((l) => {
      const d = parseDate(l.updatedAt) || parseDate(l.closedAt) || parseDate(l.createdAt)
      return d && d >= thirtyDaysAgo
    })
    .reduce((s, l) => s + leadValue(l), 0)

  const pipelineCoverage =
    recentWonValue > 0
      ? openPipelineValue / recentWonValue
      : openPipelineValue > 0
        ? null // open deals but no recent wins — insufficient for coverage ratio
        : closedCount === 0 && open.length === 0
          ? null
          : 0

  const openWithActivity = open.filter((l) => {
    const d = parseDate(l.updatedAt) || parseDate(l.createdAt)
    return d && d >= fourteenDaysAgo
  }).length
  const pipelineHygiene =
    open.length > 0 ? (openWithActivity / open.length) * 100 : null

  // ── Revenue ───────────────────────────────────────────────────────────────
  let thisMonthPaid = 0
  let lastMonthPaid = 0
  let invoicedTotal = 0
  let paidTotal = 0
  let overdueTotal = 0

  invoices.forEach((inv) => {
    const amt = invoiceAmount(inv)
    invoicedTotal += amt
    if (isPaidInvoice(inv)) {
      paidTotal += amt
      const created = parseDate(inv.paidAt) || parseDate(inv.createdAt)
      if (created) {
        if (
          created.getMonth() === currentMonth &&
          created.getFullYear() === currentYear
        ) {
          thisMonthPaid += amt
        }
        if (
          created.getMonth() === prevMonth &&
          created.getFullYear() === prevYear
        ) {
          lastMonthPaid += amt
        }
      }
    }
    if (isOverdueInvoice(inv)) {
      overdueTotal += Number(inv.amountDue) || amt
    }
  })

  const momGrowth =
    lastMonthPaid > 0
      ? ((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100
      : thisMonthPaid > 0
        ? 100
        : invoices.length === 0
          ? null
          : 0

  const collectionRate =
    invoicedTotal > 0 ? (paidTotal / invoicedTotal) * 100 : null

  const overduePct =
    invoicedTotal > 0 ? (overdueTotal / invoicedTotal) * 100 : null

  // ── Delivery ──────────────────────────────────────────────────────────────
  const doneTasks = tasks.filter((t) =>
    DONE_TASK.has(String(t.status || '').toLowerCase())
  )
  const onTimeTasks = doneTasks.filter((t) => {
    const due = parseDate(t.dueDate)
    const completed = parseDate(t.completedAt) || parseDate(t.updatedAt)
    if (!due) return true
    if (!completed) return true
    return completed <= due
  })
  const onTimeTaskRate =
    doneTasks.length > 0 ? (onTimeTasks.length / doneTasks.length) * 100 : null

  const activeProjects = projects.filter(isActiveProject)
  const completedProjects = projects.filter(isCompletedProject)
  const healthyActive = activeProjects.filter((p) => {
    const updated = parseDate(p.updatedAt) || parseDate(p.createdAt)
    const progress = Number(p.completionPercent) || Number(p.progress) || 0
    const recentlyTouched = updated && updated >= fourteenDaysAgo
    return recentlyTouched || progress > 0
  }).length
  const activeProjectHealth =
    activeProjects.length > 0
      ? (healthyActive / activeProjects.length) * 100
      : projects.length === 0
        ? null
        : 100

  const deliveryDenom = completedProjects.length + activeProjects.length
  const completionRate =
    deliveryDenom > 0
      ? (completedProjects.length / deliveryDenom) * 100
      : projects.length === 0
        ? null
        : 0

  // ── Team ──────────────────────────────────────────────────────────────────
  const totalEmployees = employees.length
  const activeEmployees = employees.filter((e) => {
    const s = String(e.status || 'active').toLowerCase()
    return ACTIVE_EMPLOYEE.has(s) || s === 'active'
  })

  const recentAttendanceUids = new Set()
  attendanceLogs.forEach((log) => {
    const d = parseDate(log.date) || parseDate(log.createdAt) || parseDate(log.timestamp)
    if (d && d >= fourteenDaysAgo) {
      if (log.uid) recentAttendanceUids.add(log.uid)
      if (log.employeeId) recentAttendanceUids.add(log.employeeId)
    }
  })

  let headcountUtilization = null
  if (activeEmployees.length > 0) {
    if (recentAttendanceUids.size > 0) {
      const withActivity = activeEmployees.filter(
        (e) =>
          recentAttendanceUids.has(e.uid) ||
          recentAttendanceUids.has(e.employeeId) ||
          recentAttendanceUids.has(e.id)
      ).length
      headcountUtilization = (withActivity / activeEmployees.length) * 100
    } else {
      // No attendance data — treat all active employees as utilized
      headcountUtilization = 100
    }
  } else if (totalEmployees === 0) {
    headcountUtilization = null
  } else {
    headcountUtilization = 0
  }

  const onLeaveNow = leaveRequests.filter((l) => {
    if (String(l.leaveType || '') === 'On Duty') return false
    const status = String(l.status || '').toLowerCase()
    if (status !== 'approved' && status !== 'pending') return false
    const start = parseDate(l.startDate) || parseDate(l.fromDate)
    const end = parseDate(l.endDate) || parseDate(l.toDate)
    if (!start || !end) return status === 'approved' || status === 'pending'
    return start <= now && end >= now
  }).length

  const leavePct =
    activeEmployees.length > 0
      ? (onLeaveNow / activeEmployees.length) * 100
      : totalEmployees === 0
        ? null
        : 0

  return {
    winRate,
    pipelineCoverage,
    pipelineHygiene,
    momGrowth,
    collectionRate,
    overduePct,
    onTimeTaskRate,
    activeProjectHealth,
    completionRate,
    headcountUtilization,
    leavePct,
    // context for display
    _context: {
      openPipelineValue,
      recentWonValue,
      thisMonthPaid,
      lastMonthPaid,
      invoicedTotal,
      paidTotal,
      overdueTotal,
      wonCount: won.length,
      lostCount: lost.length,
      openCount: open.length,
      activeProjects: activeProjects.length,
      completedProjects: completedProjects.length,
      doneTasks: doneTasks.length,
      activeEmployees: activeEmployees.length,
      onLeaveNow,
    },
  }
}

/**
 * Convert raw metrics into 0–100 metric scores using config targets.
 */
export const computeMetricScores = (raw, config = DEFAULT_HEALTH_CONFIG) => {
  const t = { ...DEFAULT_HEALTH_CONFIG.targets, ...config.targets }

  const overdueHealth =
    raw.overduePct == null
      ? null
      : scoreOverdueHealth(raw.overduePct, t.overdueMaxPct)

  const leaveLoadHealth =
    raw.leavePct == null ? null : scoreLeaveLoad(raw.leavePct, t.leaveMaxPct)

  return {
    winRate: {
      key: 'winRate',
      pillar: 'crm',
      label: METRIC_LABELS.winRate,
      rawValue: raw.winRate,
      target: t.winRate,
      score: scoreHigherBetter(raw.winRate, t.winRate),
      unit: '%',
    },
    pipelineCoverage: {
      key: 'pipelineCoverage',
      pillar: 'crm',
      label: METRIC_LABELS.pipelineCoverage,
      rawValue: raw.pipelineCoverage,
      target: t.pipelineCoverage,
      score: scoreCoverage(raw.pipelineCoverage, t.pipelineCoverage),
      unit: '×',
    },
    pipelineHygiene: {
      key: 'pipelineHygiene',
      pillar: 'crm',
      label: METRIC_LABELS.pipelineHygiene,
      rawValue: raw.pipelineHygiene,
      target: t.pipelineHygiene,
      score: scoreHigherBetter(raw.pipelineHygiene, t.pipelineHygiene),
      unit: '%',
    },
    momGrowth: {
      key: 'momGrowth',
      pillar: 'finance',
      label: METRIC_LABELS.momGrowth,
      rawValue: raw.momGrowth,
      target: t.momGrowth,
      score: scoreMomGrowth(raw.momGrowth, t.momGrowth),
      unit: '%',
    },
    collectionRate: {
      key: 'collectionRate',
      pillar: 'finance',
      label: METRIC_LABELS.collectionRate,
      rawValue: raw.collectionRate,
      target: t.collectionRate,
      score: scoreHigherBetter(raw.collectionRate, t.collectionRate),
      unit: '%',
    },
    overdueHealth: {
      key: 'overdueHealth',
      pillar: 'finance',
      label: METRIC_LABELS.overdueHealth,
      rawValue: raw.overduePct == null ? null : 100 - Math.min(100, raw.overduePct),
      target: 100 - t.overdueMaxPct,
      score: overdueHealth,
      unit: '%',
      displayRaw: raw.overduePct,
    },
    onTimeTaskRate: {
      key: 'onTimeTaskRate',
      pillar: 'projects',
      label: METRIC_LABELS.onTimeTaskRate,
      rawValue: raw.onTimeTaskRate,
      target: t.onTimeTaskRate,
      score: scoreHigherBetter(raw.onTimeTaskRate, t.onTimeTaskRate),
      unit: '%',
    },
    activeProjectHealth: {
      key: 'activeProjectHealth',
      pillar: 'projects',
      label: METRIC_LABELS.activeProjectHealth,
      rawValue: raw.activeProjectHealth,
      target: t.activeProjectHealth,
      score: scoreHigherBetter(raw.activeProjectHealth, t.activeProjectHealth),
      unit: '%',
    },
    completionRate: {
      key: 'completionRate',
      pillar: 'projects',
      label: METRIC_LABELS.completionRate,
      rawValue: raw.completionRate,
      target: t.completionRate,
      score: scoreHigherBetter(raw.completionRate, t.completionRate),
      unit: '%',
    },
    headcountUtilization: {
      key: 'headcountUtilization',
      pillar: 'team',
      label: METRIC_LABELS.headcountUtilization,
      rawValue: raw.headcountUtilization,
      target: t.headcountUtilization,
      score: scoreHigherBetter(raw.headcountUtilization, t.headcountUtilization),
      unit: '%',
    },
    leaveLoadHealth: {
      key: 'leaveLoadHealth',
      pillar: 'team',
      label: METRIC_LABELS.leaveLoadHealth,
      rawValue: raw.leavePct == null ? null : 100 - Math.min(100, raw.leavePct),
      target: 100 - t.leaveMaxPct,
      score: leaveLoadHealth,
      unit: '%',
      displayRaw: raw.leavePct,
    },
  }
}

const computePillarScore = (pillarKey, metrics, config) => {
  const weights = normalizeWeights(
    config.metricWeights?.[pillarKey] ||
      DEFAULT_HEALTH_CONFIG.metricWeights[pillarKey]
  )
  let weightedSum = 0
  let usedWeight = 0
  const metricDetails = []

  Object.entries(weights).forEach(([metricKey, weight]) => {
    const m = metrics[metricKey]
    if (!m || m.score == null) return
    weightedSum += m.score * weight
    usedWeight += weight
    metricDetails.push({ ...m, weight })
  })

  if (usedWeight <= 0) {
    return { score: null, hasData: false, metrics: metricDetails }
  }

  // Re-normalize among available metrics within pillar
  const score = clampScore(weightedSum / usedWeight)
  return { score, hasData: true, metrics: metricDetails }
}

const RISK_RULES = [
  {
    key: 'winRate',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Win rate is below healthy range — deals are closing poorly.',
    recommendation: {
      category: 'Pipeline',
      priority: 1,
      text: 'Review lost-deal reasons and tighten lead qualification before pipeline entry.',
    },
  },
  {
    key: 'pipelineCoverage',
    when: (m) => m.rawValue != null && m.rawValue < 2,
    risk: 'Pipeline coverage is thin relative to recent wins.',
    recommendation: {
      category: 'Pipeline',
      priority: 1,
      text: 'Increase lead generation — open pipeline is under 2× recent closed-won value.',
    },
  },
  {
    key: 'pipelineHygiene',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Many open deals have not been updated recently.',
    recommendation: {
      category: 'Pipeline',
      priority: 2,
      text: 'Audit stale opportunities and update or close inactive deals.',
    },
  },
  {
    key: 'momGrowth',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Month-over-month paid revenue growth is weak or negative.',
    recommendation: {
      category: 'Revenue',
      priority: 1,
      text: 'Focus on closing late-stage deals and accelerating invoice collection this month.',
    },
  },
  {
    key: 'collectionRate',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Collection rate is below target — cash conversion is slow.',
    recommendation: {
      category: 'Revenue',
      priority: 1,
      text: 'Follow up on unpaid invoices and shorten payment terms where possible.',
    },
  },
  {
    key: 'overdueHealth',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Overdue invoice pressure is elevated.',
    recommendation: {
      category: 'Revenue',
      priority: 1,
      text: 'Prioritize collections on overdue invoices to protect cash flow.',
    },
  },
  {
    key: 'onTimeTaskRate',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Tasks are frequently missing deadlines.',
    recommendation: {
      category: 'Delivery',
      priority: 1,
      text: 'Rebalance workload and deadlines on active projects.',
    },
  },
  {
    key: 'activeProjectHealth',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Active projects look stalled (little recent progress).',
    recommendation: {
      category: 'Delivery',
      priority: 2,
      text: 'Check stalled projects for blockers and reassign owners if needed.',
    },
  },
  {
    key: 'headcountUtilization',
    when: (m) => m.score != null && m.score < 60,
    risk: 'Team utilization / recent activity is low.',
    recommendation: {
      category: 'Team',
      priority: 2,
      text: 'Review attendance and workload distribution across the team.',
    },
  },
  {
    key: 'leaveLoadHealth',
    when: (m) => m.score != null && m.score < 60,
    risk: 'A high share of the team is currently on leave.',
    recommendation: {
      category: 'Team',
      priority: 3,
      text: 'Plan capacity around leave and defer non-critical delivery if coverage is thin.',
    },
  },
]

const buildRisksAndRecs = (metrics) => {
  const risks = []
  const recommendations = []
  const seenRec = new Set()

  RISK_RULES.forEach((rule) => {
    const m = metrics[rule.key]
    if (!m || !rule.when(m)) return
    risks.push({ metricKey: rule.key, message: rule.risk })
    if (rule.recommendation && !seenRec.has(rule.recommendation.text)) {
      seenRec.add(rule.recommendation.text)
      recommendations.push(rule.recommendation)
    }
  })

  recommendations.sort((a, b) => a.priority - b.priority)
  return { risks, recommendations }
}

const buildContributors = (metrics) => {
  const scored = Object.values(metrics).filter((m) => m.score != null)
  const sorted = [...scored].sort((a, b) => b.score - a.score)
  const positive = sorted.filter((m) => m.score >= 70).slice(0, 3)
  const negative = [...scored].sort((a, b) => a.score - b.score).filter((m) => m.score < 70).slice(0, 3)
  return { positive, negative }
}

/**
 * Full business health computation from inputs + config.
 * @param {object} inputs - from fetchHealthInputs
 * @param {object} config - health score config
 * @param {number|null} previousScore - prior overall for trend
 */
export const computeBusinessHealth = (
  inputs,
  config = DEFAULT_HEALTH_CONFIG,
  previousScore = null
) => {
  const mergedConfig = {
    ...DEFAULT_HEALTH_CONFIG,
    ...config,
    pillarWeights: {
      ...DEFAULT_HEALTH_CONFIG.pillarWeights,
      ...(config.pillarWeights || {}),
    },
    metricWeights: {
      ...DEFAULT_HEALTH_CONFIG.metricWeights,
      ...(config.metricWeights || {}),
    },
    targets: { ...DEFAULT_HEALTH_CONFIG.targets, ...(config.targets || {}) },
    bands: { ...DEFAULT_HEALTH_CONFIG.bands, ...(config.bands || {}) },
  }

  const raw = deriveRawMetrics(inputs, mergedConfig)
  const metrics = computeMetricScores(raw, mergedConfig)

  const pillarKeys = ['crm', 'finance', 'projects', 'team']
  const pillarResults = {}
  pillarKeys.forEach((key) => {
    pillarResults[key] = computePillarScore(key, metrics, mergedConfig)
  })

  // Rebalance pillar weights across pillars that have data
  const baseWeights = normalizeWeights(mergedConfig.pillarWeights)
  const available = pillarKeys.filter((k) => pillarResults[k].hasData)
  const rebalanced = {}
  if (available.length === 0) {
    pillarKeys.forEach((k) => {
      rebalanced[k] = 0
    })
  } else {
    const availTotal = available.reduce((s, k) => s + (baseWeights[k] || 0), 0)
    available.forEach((k) => {
      rebalanced[k] =
        availTotal > 0
          ? (baseWeights[k] || 0) / availTotal
          : 1 / available.length
    })
    pillarKeys
      .filter((k) => !available.includes(k))
      .forEach((k) => {
        rebalanced[k] = 0
      })
  }

  let overallScore = null
  if (available.length > 0) {
    const sum = available.reduce(
      (s, k) => s + pillarResults[k].score * rebalanced[k],
      0
    )
    overallScore = clampScore(sum)
  }

  const bands = mergedConfig.bands
  let band = 'insufficient_data'
  let bandLabel = 'Insufficient Data'
  if (overallScore != null) {
    if (overallScore >= bands.healthy) {
      band = 'healthy'
      bandLabel = 'Healthy'
    } else if (overallScore >= bands.watch) {
      band = 'watch'
      bandLabel = 'Watch'
    } else {
      band = 'at_risk'
      bandLabel = 'At Risk'
    }
  }

  const prev =
    previousScore != null && !Number.isNaN(Number(previousScore))
      ? Number(previousScore)
      : null
  let trend = 'stable'
  if (overallScore != null && prev != null) {
    const diff = overallScore - prev
    if (diff >= 3) trend = 'up'
    else if (diff <= -3) trend = 'down'
  }

  const { risks, recommendations } = buildRisksAndRecs(metrics)
  const contributors = buildContributors(metrics)

  const breakdown = {
    crm: {
      score: pillarResults.crm.score,
      hasData: pillarResults.crm.hasData,
      weight: rebalanced.crm,
      label: PILLAR_LABELS.crm,
      metrics: pillarResults.crm.metrics,
    },
    finance: {
      score: pillarResults.finance.score,
      hasData: pillarResults.finance.hasData,
      weight: rebalanced.finance,
      label: PILLAR_LABELS.finance,
      metrics: pillarResults.finance.metrics,
    },
    projects: {
      score: pillarResults.projects.score,
      hasData: pillarResults.projects.hasData,
      weight: rebalanced.projects,
      label: PILLAR_LABELS.projects,
      metrics: pillarResults.projects.metrics,
    },
    team: {
      score: pillarResults.team.score,
      hasData: pillarResults.team.hasData,
      weight: rebalanced.team,
      label: PILLAR_LABELS.team,
      metrics: pillarResults.team.metrics,
    },
  }

  const calculatedAt = new Date().toISOString()

  return {
    overallScore,
    previousScore: prev,
    trend,
    band,
    bandLabel,
    calculatedAt,
    breakdown,
    metrics,
    risks,
    recommendations,
    contributors,
    context: raw._context,
    // Founder dashboard compatibility fields
    overall: overallScore,
    crm: pillarResults.crm.score,
    finance: pillarResults.finance.score,
    projects: pillarResults.projects.score,
    team: pillarResults.team.score,
  }
}

/**
 * End-to-end: fetch live data and compute health.
 */
export const calculateLiveHealthScore = async (
  config = DEFAULT_HEALTH_CONFIG,
  previousScore = null
) => {
  const inputs = await fetchHealthInputs()
  return computeBusinessHealth(inputs, config, previousScore)
}
