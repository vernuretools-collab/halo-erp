import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useReportStore } from './stores/reportStore'
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  Award,
  Clock,
  Download,
  Users,
  PieChart,
  FileSpreadsheet,
  Layers
} from 'lucide-react'

export const SalesReport = () => {
  const { sales, dateRange, setDateRange } = useReportStore()

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Source,Leads Count,Pipeline Value\n' +
      sales.leadsBySource.map((s) => `${s.source},${s.count},$${s.value}`).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Sales_Report_${dateRange}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Reporting & Executive Analytics"
          description="Cross-module data intelligence, win/loss analytics, net margin profitability, and scheduled report exports"
          actions={
            <div className="flex items-center gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="bg-canvas border border-border text-xs text-fg rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value="this_month">This Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="all_time">All Time</option>
              </select>

              <Button icon={Download} variant="primary" onClick={handleExportCSV}>
                Export CSV Report
              </Button>
            </div>
          }
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
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Pipeline Value
            </span>
            <p className="text-xl font-bold text-fg mt-1">
              ${sales.totalPipelineValue.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Win Rate
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{sales.winRate}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Avg Sales Cycle
            </span>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              {sales.avgSalesCycleDays} Days
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Deals Won vs Lost
            </span>
            <p className="text-xl font-bold text-fg mt-1">
              {sales.wonDeals} <span className="text-xs font-normal text-muted">Won</span> / {sales.lostDeals} <span className="text-xs font-normal text-muted">Lost</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-info-soft text-info flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Grid: Acquisition Source & Lost Reason Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 space-y-4 border-border">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="text-sm font-bold text-fg">Acquisition Channel Revenue Breakdown</h3>
            <Badge variant="brand">Attribution Data</Badge>
          </div>

          <div className="space-y-3">
            {sales.leadsBySource.map((src, i) => (
              <div key={i} className="p-3 rounded-xl bg-canvas border border-border space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-fg">{src.source}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">${src.value.toLocaleString()}</span>
                </div>
                <div className="w-full bg-canvas h-2 rounded-full overflow-hidden border border-slate-200/60 dark:border-none">
                  <div
                    className="bg-accent dark:bg-accent h-full"
                    style={{
                      width: `${Math.round((src.value / sales.totalPipelineValue) * 100)}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{src.count} Total Leads</span>
                  <span>{Math.round((src.value / sales.totalPipelineValue) * 100)}% Contribution</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Lost Deal Reasons Card */}
        <Card className="space-y-4 border-border">
          <h3 className="text-sm font-bold text-fg pb-3 border-b border-border">
            Lost Deal Reason Analysis
          </h3>
          <div className="space-y-3">
            {sales.lostReasons.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-canvas border border-border text-xs">
                <span className="text-fg">{r.reason}</span>
                <Badge variant="danger">{r.count} Deals</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
