import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { usePortalStore } from './stores/portalStore'
import { useUserStore } from '../../stores/userStore'
import {
  getClientProjects,
  getClientInvoices,
  getClientDeliverables,
  getClientTickets,
} from './services/portalService'
import {
  Folder,
  CheckCircle2,
  FileText,
  Headphones,
  Calendar,
  MessageSquare,
  Receipt,
} from 'lucide-react'

export const ClientPortal = () => {
  const { user, userDoc } = useUserStore()
  const {
    projects,
    invoices,
    files,
    activities,
    tickets,
    setProjects,
    setInvoices,
    setFiles,
    setTickets,
  } = usePortalStore()

  useEffect(() => {
    const fetchPortalData = async () => {
      try {
        const projs = await getClientProjects(user?.uid)
        const invs = await getClientInvoices(user?.uid)
        const delivs = await getClientDeliverables(user?.uid)
        const tcks = await getClientTickets(user?.uid)

        setProjects(projs)
        setInvoices(invs)
        setFiles(delivs)
        setTickets(tcks)
      } catch (err) {
        console.warn('Failed to load remote Firestore portal data:', err)
      }
    }
    fetchPortalData()
  }, [user, setProjects, setInvoices, setFiles, setTickets])

  // Greeting name
  const firstName =
    userDoc?.displayName?.split(' ')[0] ||
    user?.displayName?.split(' ')[0] ||
    'Client'

  // Metric counts dynamically calculated from real data
  const activeProjectsCount = projects.length
  const pendingInvoicesCount = invoices.filter(
    (i) => i.status?.toLowerCase() !== 'paid'
  ).length
  const documentsCount = files.length
  const openTicketsCount = tickets.filter(
    (t) => t.status?.toLowerCase() === 'open'
  ).length

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      {/* 1. Greeting Section */}
      <div>
        <h2 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-2">
          <span>Welcome, {firstName}!</span>
        </h2>
        <p className="text-sm text-muted mt-1">
          Here&apos;s what&apos;s happening with your account.
        </p>
      </div>

      {/* 2. Top 4 Stat Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Active Projects */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fg leading-tight">
                {activeProjectsCount}
              </div>
              <div className="text-xs text-muted font-medium mt-0.5">
                Active Projects
              </div>
            </div>
          </div>
          <div className="mt-5 pt-1">
            <Link
              to="/portal/projects"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1 group"
            >
              <span>View all</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </Card>

        {/* Card 2: Pending Invoice */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fg leading-tight">
                {pendingInvoicesCount}
              </div>
              <div className="text-xs text-muted font-medium mt-0.5">
                Pending Invoice
              </div>
            </div>
          </div>
          <div className="mt-5 pt-1">
            <Link
              to="/portal/invoices"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1 group"
            >
              <span>View all</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </Card>

        {/* Card 3: Documents */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fg leading-tight">
                {documentsCount}
              </div>
              <div className="text-xs text-muted font-medium mt-0.5">
                Documents
              </div>
            </div>
          </div>
          <div className="mt-5 pt-1">
            <Link
              to="/portal/files"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1 group"
            >
              <span>View all</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </Card>

        {/* Card 4: Open Tickets */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-fg leading-tight">
                {openTicketsCount}
              </div>
              <div className="text-xs text-muted font-medium mt-0.5">
                Open Tickets
              </div>
            </div>
          </div>
          <div className="mt-5 pt-1">
            <Link
              to="/portal/support"
              className="text-xs font-semibold text-accent hover:text-accent-hover inline-flex items-center gap-1 group"
            >
              <span>View all</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
          </div>
        </Card>
      </div>

      {/* 3. Middle Section: My Projects & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: My Projects */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-fg text-sm">
              My Projects
            </h3>
            <Link
              to="/portal/projects"
              className="text-xs font-semibold text-accent hover:text-accent-hover"
            >
              View all projects
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No active projects assigned yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {projects.slice(0, 4).map((p) => (
                <div key={p.projectId || p.name} className="py-5 first:pt-4 last:pb-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-fg text-xs">
                        {p.name}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {p.status || 'In Progress'}
                      </span>
                    </div>
                    <span className="font-bold text-fg text-xs">
                      {p.completionPercent || 0}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                      <span>Next Milestone: {p.nextMilestone || 'Under Review'}</span>
                    </div>
                    {p.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-chrome h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-500"
                      style={{ width: `${p.completionPercent || 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right Card: Recent Activity */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-fg text-sm">
              Recent Activity
            </h3>
            <Link
              to="/portal/projects"
              className="text-xs font-semibold text-accent hover:text-accent-hover"
            >
              View all
            </Link>
          </div>

          {activities.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">
              No recent activity recorded yet.
            </div>
          ) : (
            <div className="space-y-4 pt-4">
              {activities.map((act) => {
                let Icon = FileText
                let iconStyle = 'bg-accent-soft text-accent'
                if (act.type === 'milestone') {
                  Icon = CheckCircle2
                  iconStyle = 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                } else if (act.type === 'invoice') {
                  Icon = Receipt
                  iconStyle = 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                } else if (act.type === 'comment') {
                  Icon = MessageSquare
                  iconStyle = 'bg-accent-soft text-accent'
                }

                return (
                  <div key={act.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconStyle}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-fg truncate">
                          {act.title}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate mt-0.5">
                          {act.project}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {act.time}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 4. Bottom Section: Recent Invoices Table */}
      <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
          <h3 className="font-bold text-fg text-sm">
            Recent Invoices
          </h3>
          <Link
            to="/portal/invoices"
            className="text-xs font-semibold text-accent hover:text-accent-hover"
          >
            View all invoices
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No recent invoices found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-400 font-semibold">
                  <th className="py-4 font-semibold">Invoice #</th>
                  <th className="py-4 font-semibold">Project</th>
                  <th className="py-4 font-semibold">Amount</th>
                  <th className="py-4 font-semibold">Status</th>
                  <th className="py-4 font-semibold">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {invoices.slice(0, 3).map((inv) => (
                  <tr key={inv.invoiceId} className="hover:bg-slate-50/60 dark:hover:bg-chrome/40 transition-colors">
                    <td className="py-4 font-semibold text-fg">
                      {inv.invoiceNumber || inv.invoiceId}
                    </td>
                    <td className="py-4 text-fg">
                      {inv.projectName || 'General Consulting'}
                    </td>
                    <td className="py-4 font-semibold text-fg">
                      ${Number(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          inv.status?.toLowerCase() === 'paid'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400'
                        }`}
                      >
                        {inv.status || 'Due'}
                      </span>
                    </td>
                    <td className="py-4 text-fg">
                      {inv.dueDate || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}



