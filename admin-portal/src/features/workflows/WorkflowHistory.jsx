import React, { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useWorkflowStore } from './stores/workflowStore'
import { getWorkflowRuns } from './services/workflowService'
import { GitBranch, SlidersHorizontal, History, Loader2, ScrollText, Mail } from 'lucide-react'

export const WorkflowHistory = () => {
  const { runs, isLoading, setRuns, setIsLoading } = useWorkflowStore()

  // Load run logs from Firestore on mount
  useEffect(() => {
    const fetchRuns = async () => {
      setIsLoading(true)
      const data = await getWorkflowRuns()
      setRuns(data)
      setIsLoading(false)
    }
    fetchRuns()
  }, [setRuns, setIsLoading])

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Workflow Execution History Logs"
          description="Audit trail of automated execution runs, triggers, and action outputs"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/workflows"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <History className="w-3.5 h-3.5" /> Execution Logs
          </NavLink>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 text-accent animate-spin" />
          <span className="ml-3 text-slate-400 text-sm">
            Loading execution logs...
          </span>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3">
          {/* Empty state */}
          {runs.length === 0 && (
            <Card className="py-20 text-center space-y-3 border-border">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto">
                <ScrollText className="w-7 h-7 text-muted" />
              </div>
              <div className="space-y-1">
                <p className="text-slate-200 font-semibold text-sm">No execution logs yet</p>
                <p className="text-muted text-xs">
                  Logs will appear here once workflow rules are created and triggered.
                </p>
              </div>
            </Card>
          )}

          {/* Run log cards */}
          {runs.map((r) => (
            <Card key={r.runId} hover className="p-4 border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-fg text-sm">{r.workflowName}</h4>
                  {r.recipientEmail && (
                    <span className="flex items-center gap-1 text-[11px] text-accent bg-accent-soft px-2 py-0.5 rounded-md border border-accent/20">
                      <Mail className="w-3 h-3" /> {r.recipientEmail}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.emailStatus && (
                    <Badge variant={r.emailStatus === 'sent' ? 'success' : 'neutral'}>
                      Email: {r.emailStatus}
                    </Badge>
                  )}
                  <Badge variant={r.status === 'success' ? 'success' : 'danger'}>{r.status}</Badge>
                </div>
              </div>

              <p className="text-xs text-accent">Triggered by: {r.triggeredBy}</p>

              <div className="p-3 rounded-xl bg-slate-900 border border-border font-mono text-xs text-slate-400 space-y-1">
                {r.logs?.map((log, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-accent shrink-0">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>

              <span className="text-[10px] text-muted block">
                Executed at: {r.executedAt ? new Date(r.executedAt).toLocaleString() : r.executedAt}
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
