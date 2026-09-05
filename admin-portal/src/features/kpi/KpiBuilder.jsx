import React, { useEffect, useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useKPIStore } from './stores/kpiStore'
import { PILLAR_LABELS } from './services/healthScoreDefaults'
import {
  Activity,
  SlidersHorizontal,
  Save,
  RotateCcw,
  Loader2,
} from 'lucide-react'

const TARGET_FIELDS = [
  { key: 'winRate', label: 'Win Rate target (%)', min: 1, max: 100, step: 1 },
  { key: 'pipelineCoverage', label: 'Pipeline coverage target (×)', min: 1, max: 10, step: 0.5 },
  { key: 'pipelineHygiene', label: 'Pipeline hygiene target (%)', min: 1, max: 100, step: 1 },
  { key: 'momGrowth', label: 'MoM revenue growth target (%)', min: 0, max: 100, step: 1 },
  { key: 'collectionRate', label: 'Collection rate target (%)', min: 1, max: 100, step: 1 },
  { key: 'overdueMaxPct', label: 'Max overdue of billed (%)', min: 1, max: 50, step: 1 },
  { key: 'onTimeTaskRate', label: 'On-time task rate target (%)', min: 1, max: 100, step: 1 },
  { key: 'activeProjectHealth', label: 'Active project health target (%)', min: 1, max: 100, step: 1 },
  { key: 'completionRate', label: 'Project completion rate target (%)', min: 1, max: 100, step: 1 },
  { key: 'headcountUtilization', label: 'Headcount utilization target (%)', min: 1, max: 100, step: 1 },
  { key: 'leaveMaxPct', label: 'Max team on leave (%)', min: 1, max: 50, step: 1 },
]

export const KpiBuilder = () => {
  const navigate = useNavigate()
  const {
    config,
    isLoading,
    isSavingConfig,
    error,
    loadHealthData,
    updateConfigDraft,
    saveConfig,
    resetConfigToDefaults,
  } = useKPIStore()

  useEffect(() => {
    // Load config without forcing recalculate
    loadHealthData({ autoRecalculateIfStale: false })
  }, [loadHealthData])

  const normalizedPillarWeights = useMemo(() => {
    const w = config.pillarWeights || {}
    const total =
      Number(w.crm || 0) +
      Number(w.finance || 0) +
      Number(w.projects || 0) +
      Number(w.team || 0)
    if (total <= 0) {
      return { crm: 0, finance: 0, projects: 0, team: 0, total: 0 }
    }
    return {
      crm: (Number(w.crm || 0) / total) * 100,
      finance: (Number(w.finance || 0) / total) * 100,
      projects: (Number(w.projects || 0) / total) * 100,
      team: (Number(w.team || 0) / total) * 100,
      total,
    }
  }, [config.pillarWeights])

  const setPillarWeight = (key, value) => {
    updateConfigDraft({
      pillarWeights: {
        ...config.pillarWeights,
        [key]: Number(value),
      },
    })
  }

  const setTarget = (key, value) => {
    updateConfigDraft({
      targets: {
        ...config.targets,
        [key]: Number(value),
      },
    })
  }

  const setBand = (key, value) => {
    updateConfigDraft({
      bands: {
        ...config.bands,
        [key]: Number(value),
      },
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    const saved = await saveConfig({ recalculate: true })
    if (saved) navigate('/kpi')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title="Health Score Settings"
          description="Adjust pillar weights, metric targets, and health bands. Scores recompute from live CRM data."
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

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">Loading settings…</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-3xl">
          {/* Pillar weights */}
          <Card className="space-y-4 border-border">
            <div>
              <h3 className="font-bold text-fg text-sm">
                Pillar Weights
              </h3>
              <p className="text-xs text-muted mt-1">
                Relative importance of each pillar. Values are auto-normalized to 100%.
              </p>
            </div>

            <div className="h-3 rounded-full overflow-hidden flex bg-canvas">
              {['crm', 'finance', 'projects', 'team'].map((key, i) => {
                const colors = [
                  'bg-accent',
                  'bg-emerald-500',
                  'bg-amber-500',
                  'bg-sky-500',
                ]
                const pct = normalizedPillarWeights[key] || 0
                if (pct <= 0) return null
                return (
                  <div
                    key={key}
                    className={`${colors[i]} h-full`}
                    style={{ width: `${pct}%` }}
                    title={`${PILLAR_LABELS[key]}: ${pct.toFixed(0)}%`}
                  />
                )
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px] text-muted">
              {['crm', 'finance', 'projects', 'team'].map((key) => (
                <span key={key}>
                  {PILLAR_LABELS[key]}:{' '}
                  <strong className="text-fg">
                    {normalizedPillarWeights[key].toFixed(0)}%
                  </strong>
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {['crm', 'finance', 'projects', 'team'].map((key) => (
                <Input
                  key={key}
                  label={`${PILLAR_LABELS[key]} weight`}
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.pillarWeights?.[key] ?? 0}
                  onChange={(e) => setPillarWeight(key, e.target.value)}
                />
              ))}
            </div>
          </Card>

          {/* Bands */}
          <Card className="space-y-4 border-border">
            <div>
              <h3 className="font-bold text-fg text-sm">
                Health Bands
              </h3>
              <p className="text-xs text-muted mt-1">
                Score thresholds for Healthy / Watch / At risk.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Healthy at or above"
                type="number"
                min="1"
                max="100"
                value={config.bands?.healthy ?? 80}
                onChange={(e) => setBand('healthy', e.target.value)}
              />
              <Input
                label="Watch at or above (below = At risk)"
                type="number"
                min="1"
                max="100"
                value={config.bands?.watch ?? 60}
                onChange={(e) => setBand('watch', e.target.value)}
              />
            </div>
          </Card>

          {/* Targets */}
          <Card className="space-y-4 border-border">
            <div>
              <h3 className="font-bold text-fg text-sm">
                Metric Targets
              </h3>
              <p className="text-xs text-muted mt-1">
                Each live metric is scored 0–100 against these targets.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TARGET_FIELDS.map((field) => (
                <Input
                  key={field.key}
                  label={field.label}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={config.targets?.[field.key] ?? ''}
                  onChange={(e) => setTarget(field.key, e.target.value)}
                />
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              icon={RotateCcw}
              onClick={() => resetConfigToDefaults()}
            >
              Reset Defaults
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/kpi')}
              className="sm:ml-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              icon={Save}
              disabled={isSavingConfig}
            >
              {isSavingConfig ? 'Saving…' : 'Save & Recalculate'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
