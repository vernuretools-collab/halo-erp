import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { usePortalStore } from './stores/portalStore'
import { Briefcase, FileText, Download, Layers, CreditCard } from 'lucide-react'

export const ClientInvoices = () => {
  const { invoices } = usePortalStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Invoices & Payment History"
          description="View client invoices, payment status, receipts, and download PDF copies"
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

      {/* Invoices Table */}
      <Card className="overflow-x-auto p-0 border-border shadow-xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Invoice #</th>
              <th className="p-4 font-semibold">Issue Date</th>
              <th className="p-4 font-semibold">Due Date</th>
              <th className="p-4 font-semibold">Amount ($ USD)</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {invoices.map((inv) => (
              <tr key={inv.invoiceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-fg">
                <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{inv.invoiceNumber}</td>
                <td className="p-4 text-muted">{inv.issueDate}</td>
                <td className="p-4 text-muted">{inv.dueDate}</td>
                <td className="p-4 font-bold text-fg">${inv.total.toLocaleString()}</td>
                <td className="p-4">
                  <Badge variant={inv.status === 'paid' ? 'success' : 'warning'}>{inv.status}</Badge>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-muted hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors cursor-pointer" title="Download PDF">
                    <Download className="w-4 h-4" />
                  </button>
                  {inv.status !== 'paid' && (
                    <Button size="sm" variant="primary" icon={CreditCard}>
                      Pay Now
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
