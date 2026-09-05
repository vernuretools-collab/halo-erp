/**
 * Default Business Health Score configuration.
 * Pillar weights are auto-normalized at compute time.
 */

export const DEFAULT_HEALTH_CONFIG = {
  pillarWeights: {
    crm: 0.3,
    finance: 0.3,
    projects: 0.25,
    team: 0.15,
  },
  metricWeights: {
    crm: {
      winRate: 0.4,
      pipelineCoverage: 0.35,
      pipelineHygiene: 0.25,
    },
    finance: {
      momGrowth: 0.35,
      collectionRate: 0.4,
      overdueHealth: 0.25,
    },
    projects: {
      onTimeTaskRate: 0.45,
      activeProjectHealth: 0.35,
      completionRate: 0.2,
    },
    team: {
      headcountUtilization: 0.6,
      leaveLoadHealth: 0.4,
    },
  },
  targets: {
    winRate: 40,
    pipelineCoverage: 3,
    pipelineHygiene: 70,
    momGrowth: 10,
    collectionRate: 85,
    overdueMaxPct: 10,
    onTimeTaskRate: 80,
    activeProjectHealth: 70,
    completionRate: 40,
    headcountUtilization: 70,
    leaveMaxPct: 20,
  },
  bands: {
    healthy: 80,
    watch: 60,
  },
}

export const PILLAR_LABELS = {
  crm: 'Pipeline',
  finance: 'Revenue',
  projects: 'Delivery',
  team: 'Team',
}

export const METRIC_LABELS = {
  winRate: 'Win Rate',
  pipelineCoverage: 'Pipeline Coverage',
  pipelineHygiene: 'Pipeline Hygiene',
  momGrowth: 'MoM Revenue Growth',
  collectionRate: 'Collection Rate',
  overdueHealth: 'Overdue Pressure',
  onTimeTaskRate: 'On-Time Task Rate',
  activeProjectHealth: 'Active Project Health',
  completionRate: 'Project Completion Rate',
  headcountUtilization: 'Headcount Utilization',
  leaveLoadHealth: 'Leave Load Health',
}

export const METRIC_UNITS = {
  winRate: '%',
  pipelineCoverage: '×',
  pipelineHygiene: '%',
  momGrowth: '%',
  collectionRate: '%',
  overdueHealth: '%',
  onTimeTaskRate: '%',
  activeProjectHealth: '%',
  completionRate: '%',
  headcountUtilization: '%',
  leaveLoadHealth: '%',
}
