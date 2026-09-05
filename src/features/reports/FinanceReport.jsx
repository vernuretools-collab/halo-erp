import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { useReportStore } from './stores/reportStore'
import { BarChart3, DollarSign, TrendingUp, Layers, AlertCircle } from 'lucide-react'

export const FinanceReport = () => {
  const { finance } = useReportStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Profitability & Margin Intelligence"
          description="Gross revenue, operating expenses, net margins (%), and liquidity status"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Gross Invoiced Revenue
            </span>
            <p className="text-xl font-bold text-fg mt-1">
              ${finance.grossRevenue.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Net Profit
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1">
              ${finance.netProfit.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Net Profit Margin
            </span>
            <p className="text-xl font-bold text-purple-400 mt-1">{finance.netMargin}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Expenses
            </span>
            <p className="text-xl font-bold text-rose-400 mt-1">
              ${finance.totalExpenses.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>
    </div>
  )
}
