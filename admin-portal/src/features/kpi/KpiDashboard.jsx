import React, { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useKPIStore } from './stores/kpiStore'
import { PILLAR_LABELS } from './services/healthScoreDefaults'
import {
  Activity,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  SlidersHorizontal,
  Lightbulb,
  Loader2,
  Minus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'

const formatRaw = (metric) => {
  if (metric.displayRaw != null) {
    return `${Number(metric.displayRaw).toFixed(1)}${metric.unit === '%' ? '%' : ''}`
  }
  if (metric.rawValue == null) return '—'
  if (metric.unit === '×') return `${Number(metric.rawValue).toFixed(2)}×`
  if (metric.unit === '%') return `${Number(metric.rawValue).toFixed(1)}%`
  return String(Number(metric.rawValue).toFixed(1))
}

const bandVariant = (band) => {
  if (band === 'healthy') return 'success'
  if (band === 'watch') return 'warning'
  if (band === 'at_risk') return 'danger'
  return 'brand'
}

const ScoreSparkline = ({ history }) => {
  const points = useMemo(() => {
    const chron = [...(history || [])]
      .filter((h) => h.overallScore != null)
      .reverse()
    if (chron.length === 0) return null
    const values = chron.map((h) => h.overallScore)
    const w = 160
    const h = 40
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 100)
    const range = max - min || 1
    const coords = values.map((v, i) => {
      const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    return { polyline: coords.join(' '), w, h, chron }
  }, [history])

  if (!points) {
    return (
      <p className="text-xs text-muted">
        No history yet — recalculate to start tracking trend.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${points.w} ${points.h}`}
        className="w-full max-w-[200px] h-10 text-accent"
        preserveAspectRatio="none"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points.polyline}
        />
      </svg>
      <p className="text-[10px] text-muted">
        Last {points.chron.length} snapshot{points.chron.length === 1 ? '' : 's'}
      </p>
    </div>
  )
}

export const KpiDashboard = () => {
  const {
    latestScore,
    history,
    isLoading,
    isRecalculating,
    error,
    loadHealthData,
    recalculateHealthScore,
  } = useKPIStore()

  const [expandedPillar, setExpandedPillar] = useState(null)

  useEffect(() => {
    loadHealthData({ autoRecalculateIfStale: true })
  }, [loadHealthData])

  const score = latestScore?.overallScore
  const prev = latestScore?.previousScore
  const scoreDiff =
    score != null && prev != null ? score - prev : 0

  const pillars = ['crm', 'finance', 'projects', 'team']

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title="Business Health Score"
          description="Live composite 0–100 health from pipeline, revenue, delivery, and team signals"
          actions={
            <div className="flex items-center gap-3">
              <NavLink to="/kpi/builder">
                <Button icon={SlidersHorizontal} variant="secondary">
                  Score Settings
                </Button>
              </NavLink>
              <Button
                icon={RefreshCw}
                variant="primary"
                onClick={() => recalculateHealthScore()}
                disabled={isRecalculating}
              >
                {isRecalculating ? 'Calculating…' : 'Recalculate Score'}
              </Button>
            </div>
          }
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/kpi"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Activity className="w-3.5 h-3.5" /> Health Score Dashboard
          </NavLink>
          <NavLink
            to="/kpi/builder"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Score Settings
          </NavLink>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Loading health data…</span>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Hero */}
          <Card className="p-6 border-accent/30 bg-gradient-to-r from-surface via-accent-soft to-surface relative overflow-hidden">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="brand">Weighted Health Index</Badge>
                  <Badge variant={bandVariant(latestScore.band)}>
                    {latestScore.bandLabel || 'Insufficient Data'}
                  </Badge>
                  {score != null && prev != null && scoreDiff !== 0 && (
                    <span
                      className={`text-xs flex items-center gap-1 ${
                        scoreDiff >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {scoreDiff >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5" />
                      )}
                      {scoreDiff >= 0 ? '+' : ''}
                      {scoreDiff} vs previous
                    </span>
                  )}
                  {latestScore.trend === 'stable' && score != null && prev != null && (
                    <span className="text-xs flex items-center gap-1 text-muted">
                      <Minus className="w-3.5 h-3.5" /> Stable
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-4">
                  <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent-hover to-emerald-500">
                    {score != null ? `${score} / 100` : '— / 100'}
                  </h2>
                </div>
                <p className="text-xs text-muted">
                  {latestScore.calculatedAt
                    ? `Last calculated: ${new Date(latestScore.calculatedAt).toLocaleString()}`
                    : 'No score yet. Click Recalculate to compute from live CRM data.'}
                  {isRecalculating && ' · Recalculating…'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 w-full lg:w-auto items-start">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                  {pillars.map((key) => {
                    const p = latestScore.breakdown?.[key]
                    const label = p?.label || PILLAR_LABELS[key]
                    const pScore = p?.score
                    return (
                      <div
                        key={key}
                        className="p-3 rounded-xl bg-canvas/80 border border-border text-center space-y-1 min-w-[88px]"
                      >
                        <span className="text-[10px] text-muted uppercase font-bold tracking-wider">
                          {label}
                        </span>
                        <p className="text-lg font-bold text-fg">
                          {pScore != null ? `${pScore}%` : '—'}
                        </p>
                        {!p?.hasData && (
                          <span className="text-[9px] text-slate-400">No data</span>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="shrink-0">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-muted mb-1">
                    Trend
                  </p>
                  <ScoreSparkline history={history} />
                </div>
              </div>
            </div>
          </Card>

          {/* Why this score */}
          {(latestScore.contributors?.positive?.length > 0 ||
            latestScore.contributors?.negative?.length > 0) && (
            <Card className="p-4 border-border space-y-3">
              <h3 className="font-bold text-fg text-sm">
                Why this score
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
                    Strengths
                  </p>
                  {latestScore.contributors.positive.length === 0 ? (
                    <p className="text-xs text-muted">No strong contributors yet.</p>
                  ) : (
                    latestScore.contributors.positive.map((m) => (
                      <div
                        key={m.key}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
                      >
                        <span className="text-fg">{m.label}</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {m.score}
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                    Dragging down
                  </p>
                  {latestScore.contributors.negative.length === 0 ? (
                    <p className="text-xs text-muted">No weak contributors.</p>
                  ) : (
                    latestScore.contributors.negative.map((m) => (
                      <div
                        key={m.key}
                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20"
                      >
                        <span className="text-fg">{m.label}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">
                          {m.score}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Risks & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="space-y-4 border-border">
              <div className="flex items-center gap-2 pb-3 border-b border-border text-fg font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Active Risk Alerts</span>
              </div>
              {!latestScore.risks?.length ? (
                <div className="flex items-start gap-2 text-xs text-muted p-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>No active risks — all scored metrics are in acceptable range.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {latestScore.risks.map((risk, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{risk.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4 border-border">
              <div className="flex items-center gap-2 pb-3 border-b border-border text-fg font-bold text-sm">
                <Lightbulb className="w-4 h-4 text-accent" />
                <span>Recommended Actions</span>
              </div>
              {!latestScore.recommendations?.length ? (
                <p className="text-xs text-muted">
                  No recommendations right now. Keep monitoring weekly.
                </p>
              ) : (
                <div className="space-y-3">
                  {latestScore.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-canvas border border-border text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="brand">{rec.category}</Badge>
                        <span className="text-[10px] text-muted">
                          Priority #{rec.priority}
                        </span>
                      </div>
                      <p className="text-fg font-medium">
                        {rec.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Pillar metric drill-down */}
          <Card className="space-y-0 border-border p-0 overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="font-bold text-fg text-sm">
                Pillar & Metric Breakdown
              </h3>
              <p className="text-xs text-muted mt-1">
                Expand a pillar to see raw values, targets, and normalized scores.
              </p>
            </div>

            {pillars.map((key) => {
              const p = latestScore.breakdown?.[key]
              const isOpen = expandedPillar === key
              const metrics =
                p?.metrics?.length > 0
                  ? p.metrics
                  : Object.values(latestScore.metrics || {}).filter(
                      (m) => m.pillar === key
                    )

              return (
                <div
                  key={key}
                  className="border-b border-border last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedPillar(isOpen ? null : key)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <p className="text-sm font-bold text-fg">
                          {p?.label || PILLAR_LABELS[key]}
                        </p>
                        <p className="text-[10px] text-muted">
                          Weight{' '}
                          {p?.weight != null
                            ? `${Math.round(p.weight * 100)}%`
                            : '—'}
                          {!p?.hasData ? ' · No usable data' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-fg">
                      {p?.score != null ? p.score : '—'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 overflow-x-auto">
                      {metrics.length === 0 ? (
                        <p className="text-xs text-muted py-2">
                          No metrics available for this pillar.
                        </p>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="text-muted border-b border-border">
                              <th className="py-2 pr-3 font-semibold">Metric</th>
                              <th className="py-2 pr-3 font-semibold">Current</th>
                              <th className="py-2 pr-3 font-semibold">Target</th>
                              <th className="py-2 pr-3 font-semibold">Score</th>
                              <th className="py-2 font-semibold">Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                            {metrics.map((m) => (
                              <tr key={m.key}>
                                <td className="py-2.5 pr-3 font-medium text-fg">
                                  {m.label}
                                </td>
                                <td className="py-2.5 pr-3 text-muted">
                                  {formatRaw(m)}
                                  {m.key === 'overdueHealth' && m.displayRaw != null && (
                                    <span className="text-slate-400 ml-1">
                                      overdue
                                    </span>
                                  )}
                                  {m.key === 'leaveLoadHealth' && m.displayRaw != null && (
                                    <span className="text-slate-400 ml-1">
                                      on leave
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 pr-3 text-muted">
                                  {m.unit === '×'
                                    ? `${m.target}×`
                                    : m.key === 'overdueHealth'
                                      ? `≤ ${100 - (m.target || 90)}% overdue`
                                      : m.key === 'leaveLoadHealth'
                                        ? `≤ ${100 - (m.target || 80)}% on leave`
                                        : `≥ ${m.target}${m.unit || ''}`}
                                </td>
                                <td className="py-2.5 pr-3">
                                  {m.score != null ? (
                                    <Badge
                                      variant={
                                        m.score >= 80
                                          ? 'success'
                                          : m.score >= 60
                                            ? 'warning'
                                            : 'danger'
                                      }
                                    >
                                      {m.score}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 text-muted">
                                  {m.weight != null
                                    ? `${Math.round(m.weight * 100)}%`
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Card>
        </>
      )}
    </div>
  )
}
