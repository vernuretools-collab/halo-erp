import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { usePortalStore } from './stores/portalStore'
import { Briefcase, FileText, Download, Layers, File } from 'lucide-react'

export const ClientFiles = () => {
  const { files } = usePortalStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Deliverables & Shared Documents"
          description="Download client contracts, design specifications, technical documentation, and project reports"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {files.map((f) => (
          <Card key={f.fileId} hover className="flex items-center justify-between p-4 border-border shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-500/20 shadow-2xs">
                <File className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-fg text-xs">{f.filename}</h4>
                <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                  <Badge variant="neutral">{f.category}</Badge>
                  <span>{f.size}</span>
                  <span>• Uploaded: {f.uploadedAt}</span>
                </div>
              </div>
            </div>

            <Button size="sm" variant="secondary" icon={Download}>
              Download
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
