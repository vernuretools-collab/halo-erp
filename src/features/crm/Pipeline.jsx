import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useCRMStore } from './stores/crmStore'
import {
  Plus,
  Search,
  DollarSign,
  User,
  Building,
  Mail,
  Phone,
  Tag,
  ArrowRight,
  Trash2,
  SlidersHorizontal,
  TrendingUp,
  Award,
  Layers,
  X,
  ChevronRight,
  Kanban,
  List,
  Contact
} from 'lucide-react'

export const Pipeline = () => {
  const {
    leads,
    stages,
    addLead,
    updateLeadStage,
    deleteLead,
    searchQuery,
    setSearchQuery,
  } = useCRMStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)

  // Form State for Add Lead Modal
  const [newDealName, setNewDealName] = useState('')
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newStageId, setNewStageId] = useState('stage_new')

  // Filter leads by search query
  const filteredLeads = leads.filter((l) => {
    const q = searchQuery.toLowerCase()
    return (
      !q ||
      l.name.toLowerCase().includes(q) ||
      (l.companyName && l.companyName.toLowerCase().includes(q)) ||
      (l.contactName && l.contactName.toLowerCase().includes(q))
    )
  })

  // Calculate Pipeline Metrics
  const totalPipelineValue = filteredLeads.reduce(
    (sum, l) => sum + (Number(l.estimatedValue) || 0),
    0
  )
  const wonCount = filteredLeads.filter((l) => l.pipelineStageId === 'stage_won').length
  const winRate =
    filteredLeads.length > 0
      ? Math.round((wonCount / filteredLeads.length) * 100)
      : 0
  const avgDealSize =
    filteredLeads.length > 0
      ? Math.round(totalPipelineValue / filteredLeads.length)
      : 0

  const handleCreateLead = (e) => {
    e.preventDefault()
    if (!newDealName.trim()) return

    const stageObj = stages.find((s) => s.id === newStageId) || stages[0]

    addLead({
      name: newDealName,
      companyName: newCompanyName || 'Independent',
      contactName: newContactName || 'N/A',
      email: newEmail || null,
      estimatedValue: Number(newValue) || 0,
      pipelineStageId: stageObj.id,
      pipelineStage: stageObj.name,
      ownerName: 'Unassigned',
    })

    // Reset Form
    setNewDealName('')
    setNewCompanyName('')
    setNewContactName('')
    setNewEmail('')
    setNewValue('')
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Sales Pipeline & Deal Flow"
          description="Track opportunities, deal stages, pipeline metrics, and conversion rates"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              New Lead
            </Button>
          }
        />

        {/* CRM Sub-Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/crm/pipeline"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Kanban className="w-3.5 h-3.5" /> Pipeline Board
            </NavLink>
            <NavLink
              to="/crm/leads"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <List className="w-3.5 h-3.5" /> All Leads Directory
            </NavLink>
            <NavLink
              to="/crm/contacts"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Contact className="w-3.5 h-3.5" /> Contacts Directory
            </NavLink>
          </div>

          {/* Search Bar */}
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search deals, contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-canvas border border-border text-xs text-fg placeholder:text-muted rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
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
              ${totalPipelineValue.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Active Opportunities
            </span>
            <p className="text-xl font-bold text-fg mt-1">{filteredLeads.length}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-info-soft text-info flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Win Rate
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{winRate}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Average Deal Size
            </span>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
              ${avgDealSize.toLocaleString()}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Kanban Board Grid */}
      <div className="flex gap-4 overflow-x-auto pb-4 items-start min-h-[500px]">
        {stages.map((stage) => {
          const stageLeads = filteredLeads.filter(
            (l) => l.pipelineStageId === stage.id
          )
          const stageTotalValue = stageLeads.reduce(
            (sum, l) => sum + (Number(l.estimatedValue) || 0),
            0
          )

          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 bg-canvas border border-border/80 rounded-2xl p-3 flex flex-col space-y-3"
            >
              {/* Stage Column Header */}
              <div className="flex items-center justify-between px-1 pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-fg text-xs">{stage.name}</span>
                  <Badge variant="brand">{stageLeads.length}</Badge>
                </div>
                <span className="text-[10px] font-bold text-muted">
                  ${stageTotalValue.toLocaleString()}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                {stageLeads.length === 0 ? (
                  <div className="p-4 text-center border border-dashed border-border rounded-xl text-[11px] text-slate-400 dark:text-slate-600">
                    No deals in stage
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <Card
                      key={lead.leadId}
                      hover
                      className="p-3.5 space-y-2.5 cursor-pointer bg-surface border-border hover:border-accent/40 relative group"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-fg group-hover:text-accent dark:group-hover:text-accent transition-colors">
                          {lead.name}
                        </span>
                        <Badge
                          variant={
                            lead.score >= 85
                              ? 'success'
                              : lead.score >= 70
                              ? 'info'
                              : 'warning'
                          }
                        >
                          Score {lead.score}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted">
                        <Building className="w-3 h-3 text-muted" />
                        <span className="truncate">{lead.companyName}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          ${Number(lead.estimatedValue).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                          <User className="w-3 h-3" /> {lead.ownerName}
                        </div>
                      </div>

                      {/* Move Stage Selector */}
                      <div
                        className="pt-2 flex items-center justify-between text-[10px] text-muted"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Move Stage:</span>
                        <select
                          value={lead.pipelineStageId}
                          onChange={(e) => {
                            const newStg = stages.find((s) => s.id === e.target.value)
                            if (newStg) {
                              updateLeadStage(lead.leadId, newStg.id, newStg.name)
                            }
                          }}
                          className="bg-canvas border border-border text-[10px] text-fg rounded px-1.5 py-0.5 focus:outline-none"
                        >
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Create New Opportunity</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4">
              <Input
                label="Opportunity / Deal Name"
                placeholder="e.g. Enterprise Platform Retainer"
                value={newDealName}
                onChange={(e) => setNewDealName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Company Name"
                  placeholder="e.g. Acme Corp"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
                <Input
                  label="Contact Person"
                  placeholder="e.g. John Doe"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Contact Email"
                  type="email"
                  placeholder="john@acme.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <Input
                  label="Estimated Value ($ USD)"
                  type="number"
                  placeholder="50000"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-300">Initial Pipeline Stage</label>
                <select
                  value={newStageId}
                  onChange={(e) => setNewStageId(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Save Opportunity
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Lead Detail Drawer / Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-end">
          <div className="w-full max-w-md h-full bg-surface border-l border-border p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="font-bold text-fg text-lg">{selectedLead.name}</h3>
                  <p className="text-xs text-accent">{selectedLead.companyName}</p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-border">
                  <span className="text-slate-400">Deal Value</span>
                  <span className="font-bold text-emerald-400 text-base">
                    ${Number(selectedLead.estimatedValue).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-slate-400">Stage</span>
                    <Badge variant="brand">{selectedLead.pipelineStage}</Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-slate-400">Lead Score</span>
                    <Badge variant="success">{selectedLead.score} / 100</Badge>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-slate-400">Contact Person</span>
                    <span className="text-slate-200">{selectedLead.contactName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-slate-400">Email</span>
                    <span className="text-slate-200">{selectedLead.email || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/60">
                    <span className="text-slate-400">Owner</span>
                    <span className="text-slate-200">{selectedLead.ownerName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex gap-3">
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  deleteLead(selectedLead.leadId)
                  setSelectedLead(null)
                }}
              >
                Delete Deal
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => setSelectedLead(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
