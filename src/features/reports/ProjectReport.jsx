import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { useReportStore } from './stores/reportStore'
import { BarChart3, DollarSign, Layers, CheckCircle2, Clock } from 'lucide-react'

export const ProjectReport = () => {
  const { projects } = useReportStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Project Velocity & On-Time Delivery"
          description="Track sprint velocity, milestone completion rates, and billable vs estimated hours"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/reports/sales"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <BarChart3 className="w-3.5 h-3.5" /> Sales & CRM Performance
          </NavLink>
          <NavLink
            to="/reports/finance"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <DollarSign className="w-3.5 h-3.5" /> Profitability & Margin
          </NavLink>
          <NavLink
            to="/reports/projects"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Layers className="w-3.5 h-3.5" /> Project Velocity
          </NavLink>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              On-Time Delivery Rate
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{projects.onTimeDeliveryRate}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Logged Hours
            </span>
            <p className="text-xl font-bold text-purple-400 mt-1">{projects.totalSpentHours} hrs</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Budgeted Value
            </span>
            <p className="text-xl font-bold text-fg mt-1">
              ${projects.totalBudgeted.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>
      </div>
    </div>
  )
}
