import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useWorkflowStore } from './stores/workflowStore'
import {
  GitBranch,
  Plus,
  Zap,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Trash2,
  History,
  SlidersHorizontal
} from 'lucide-react'

export const WorkflowList = () => {
  const { workflows, toggleWorkflowStatus, deleteWorkflow } = useWorkflowStore()

  const activeCount = workflows.filter((w) => w.status === 'active').length
  const totalRuns = workflows.reduce((sum, w) => sum + (w.runCount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Workflow & Event Automation Engine"
          description="Event-driven trigger → condition → action automation rules for CRM, Finance, and Client Portal operations"
          actions={
            <NavLink to="/workflows/builder">
              <Button icon={Plus} variant="primary">
                Create Workflow Rule
              </Button>
            </NavLink>
          }
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/workflows"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <GitBranch className="w-3.5 h-3.5" /> Automation Rules
          </NavLink>
          <NavLink
            to="/workflows/builder"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Rule Builder
          </NavLink>
          <NavLink
            to="/workflows/history"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <History className="w-3.5 h-3.5" /> Execution Logs
          </NavLink>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Active Workflow Rules
            </span>
            <p className="text-xl font-bold text-fg mt-1">{activeCount} Rules</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Executed Runs
            </span>
            <p className="text-xl font-bold text-emerald-400 mt-1">{totalRuns} Executions</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border/80">
          <div>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Failed Executions
            </span>
            <p className="text-xl font-bold text-purple-400 mt-1">0 Failures</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Workflows List */}
      <div className="space-y-3">
        {workflows.map((w) => (
          <Card key={w.workflowId} hover className="p-4 border-border space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-fg text-sm">{w.name}</h4>
                  <p className="text-xs text-accent font-mono mt-0.5">
                    Trigger: <span className="text-slate-300">{w.triggerEvent}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={w.status === 'active' ? 'success' : 'neutral'}>
                  {w.status}
                </Badge>
                <button
                  onClick={() => toggleWorkflowStatus(w.workflowId)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-border text-slate-400 hover:text-white"
                  title={w.status === 'active' ? 'Pause Rule' : 'Activate Rule'}
                >
                  {w.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteWorkflow(w.workflowId)}
                  className="p-1.5 rounded-lg bg-slate-900 border border-border text-slate-400 hover:text-rose-400"
                  title="Delete Rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-border text-xs font-mono space-y-1 text-slate-300">
              <span className="text-[10px] text-muted uppercase font-sans font-bold block">
                Condition Logic
              </span>
              <span>IF ({w.condition}) THEN DO {w.actions?.length || 1} ACTIONS</span>
            </div>

            <div className="flex justify-between items-center text-[11px] text-muted pt-1">
              <span>Total Executed Runs: <strong className="text-slate-300">{w.runCount}</strong></span>
              <span>Last Run: {w.lastRunAt ? new Date(w.lastRunAt).toLocaleTimeString() : 'Never'}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
