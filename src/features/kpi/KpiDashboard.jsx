import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useKPIStore } from './stores/kpiStore'
import {
  Activity,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Lightbulb,
  Plus,
  Trash2
} from 'lucide-react'

export const KpiDashboard = () => {
  const { kpiDefinitions, latestScore, recalculateHealthScore, deleteKpiDefinition } =
    useKPIStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Business Health Score & KPI Engine"
          description="Composite 0-100 health scoring, automated KPI snapshots, risk indicators, and executive recommendations"
          actions={
            <div className="flex items-center gap-3">
              <NavLink to="/kpi/builder">
                <Button icon={Plus} variant="secondary">
                  Define New KPI
                </Button>
              </NavLink>
              <Button
                icon={RefreshCw}
                variant="primary"
                onClick={() => recalculateHealthScore()}
              >
                Recalculate Score
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
            <SlidersHorizontal className="w-3.5 h-3.5" /> KPI Rules Builder
          </NavLink>
        </div>
      </div>

      {/* Hero Health Score Card */}
      <Card className="p-6 border-accent/30 bg-gradient-to-r from-surface via-accent-soft to-surface relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="brand">Weighted Health Index</Badge>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> +{latestScore.overallScore - latestScore.previousScore}% vs previous run
              </span>
            </div>
            <div className="flex items-baseline gap-4">
              <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-accent via-accent-hover to-emerald-500">
                {latestScore.overallScore} / 100
              </h2>
              <span className="text-xs font-semibold text-fg">Optimal Growth Status</span>
            </div>
            <p className="text-xs text-muted">
              Evaluated across CRM, Finance, Project Velocity, and Team Utilization indicators.
            </p>
          </div>

          {/* Module Health Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full md:w-auto">
            {Object.entries(latestScore.breakdown || {}).map(([mod, data]) => (
              <div key={mod} className="p-3 rounded-xl bg-canvas/80 border border-border text-center space-y-1">
                <span className="text-[10px] text-muted uppercase font-bold tracking-wider">{mod}</span>
                <p className="text-lg font-bold text-fg">{data.score}%</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Risk Alert & Recommendations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Alerts */}
        <Card className="space-y-4 border-border">
          <div className="flex items-center gap-2 pb-3 border-b border-border text-fg font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Active Risk Alerts</span>
          </div>
          <div className="space-y-3">
            {latestScore.risks?.map((risk, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{risk.message}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recommended Actions */}
        <Card className="space-y-4 border-border">
          <div className="flex items-center gap-2 pb-3 border-b border-border text-fg font-bold text-sm">
            <Lightbulb className="w-4 h-4 text-accent" />
            <span>Recommended Executive Actions</span>
          </div>
          <div className="space-y-3">
            {latestScore.recommendations?.map((rec, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-canvas border border-border text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="brand">{rec.category}</Badge>
                  <span className="text-[10px] text-muted">Priority #{rec.priority}</span>
                </div>
                <p className="text-fg font-medium">{rec.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active KPI Definitions Table */}
      <Card className="space-y-4 border-border p-0 overflow-x-auto">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-fg text-sm">Active Organization KPI Definitions</h3>
          <span className="text-xs text-muted">{kpiDefinitions.length} KPI Rules Active</span>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">KPI Name</th>
              <th className="p-4 font-semibold">Module</th>
              <th className="p-4 font-semibold">Formula</th>
              <th className="p-4 font-semibold">Target</th>
              <th className="p-4 font-semibold">Current Value</th>
              <th className="p-4 font-semibold">Weight</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-fg">
            {kpiDefinitions.map((kpi) => (
              <tr key={kpi.kpiId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{kpi.name}</td>
                <td className="p-4 uppercase text-muted font-mono text-[11px]">{kpi.module}</td>
                <td className="p-4 text-muted font-mono text-[11px] max-w-xs truncate">{kpi.formula}</td>
                <td className="p-4 text-slate-800 dark:text-slate-300 font-medium">≥ {kpi.targetValue}{kpi.unit}</td>
                <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{kpi.currentValue}{kpi.unit}</td>
                <td className="p-4 text-muted">{kpi.healthScoreWeight * 100}%</td>
                <td className="p-4">
                  <Badge variant={kpi.status === 'exceeded' || kpi.status === 'on_track' ? 'success' : 'danger'}>
                    {kpi.status}
                  </Badge>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => deleteKpiDefinition(kpi.kpiId)}
                    className="p-1.5 text-muted hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
