import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { usePortalStore } from './stores/portalStore'
import {
  ShieldCheck,
  Briefcase,
  FileText,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Check,
  X,
  CreditCard
} from 'lucide-react'

export const ClientPortal = () => {
  const { projects, invoices, files, approvals, approveDeliverable, rejectDeliverable } =
    usePortalStore()

  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const openBalance = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((sum, i) => sum + i.total, 0)

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Client Portal Environment"
          description="Tenant-isolated workspace for tracking your project deliverables, approving milestones, and managing invoices"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
              }`
            }
          >
            <Layers className="w-3.5 h-3.5" /> Portal Overview
          </NavLink>
          <NavLink
            to="/portal/projects"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
              }`
            }
          >
            <Briefcase className="w-3.5 h-3.5" /> Projects Status
          </NavLink>
          <NavLink
            to="/portal/invoices"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
              }`
            }
          >
            <FileText className="w-3.5 h-3.5" /> Invoices & Receipts
          </NavLink>
          <NavLink
            to="/portal/files"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
              }`
            }
          >
            <Download className="w-3.5 h-3.5" /> Deliverables & Files
          </NavLink>
        </div>
      </div>

      {/* Security Isolation Banner */}
      <Card className="p-4 border-emerald-200/80 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white dark:from-emerald-500/10 dark:to-teal-500/5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-500/30 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-fg text-xs">Secure Client Isolation Active</h4>
            <p className="text-[11px] text-muted mt-0.5">
              Filtered exclusively for <strong className="text-slate-900 dark:text-slate-200">Acme Corp</strong> via Custom Claims & Firestore Path Rules.
            </p>
          </div>
        </div>
        <Badge variant="success">Client Portal Tier</Badge>
      </Card>

      {/* Portal Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border shadow-xs">
          <div>
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Active Projects
            </span>
            <p className="text-2xl font-bold text-fg mt-1">{projects.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center shadow-xs">
            <Briefcase className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border shadow-xs">
          <div>
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Pending Approvals
            </span>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingApprovals.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border shadow-xs">
          <div>
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Outstanding Balance
            </span>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              ${openBalance.toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center shadow-xs">
            <CreditCard className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Deliverable Approvals Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-fg">Deliverable Sign-offs Needed</h3>
        {approvals.length === 0 ? (
          <Card className="p-6 text-center text-xs text-muted border-dashed">
            No pending deliverable sign-offs right now.
          </Card>
        ) : (
          approvals.map((app) => (
            <Card key={app.approvalId} hover className="flex items-center justify-between p-4 border-border shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-fg text-sm">{app.title}</h4>
                  <Badge variant={app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'danger' : 'warning'}>
                    {app.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted">{app.notes}</p>
                <span className="text-[10px] text-muted block font-medium">Project: {app.projectName} • Requested: {app.requestedAt}</span>
              </div>

              {app.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={Check}
                    onClick={() => approveDeliverable(app.approvalId)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={X}
                    onClick={() => rejectDeliverable(app.approvalId)}
                  >
                    Request Changes
                  </Button>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Project Status Overview */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-fg">Project Progress Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => (
            <Card key={p.projectId} hover className="space-y-3 border-border shadow-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-fg text-sm">{p.name}</h4>
                <Badge variant="success">{p.completionPercent}% Completed</Badge>
              </div>
              <p className="text-xs text-muted">{p.description}</p>
              <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-border">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${p.completionPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted pt-1 font-medium">
                <span>Next Milestone: {p.nextMilestone}</span>
                <span>Due: {p.dueDate}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
