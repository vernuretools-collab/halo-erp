import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useWorkflowStore } from './stores/workflowStore'
import { GitBranch, SlidersHorizontal, History, Save, Zap } from 'lucide-react'

export const WorkflowBuilder = () => {
  const navigate = useNavigate()
  const { addWorkflow } = useWorkflowStore()

  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState('crm.lead.won')
  const [condition, setCondition] = useState('lead.estimatedValue >= 10000')
  const [actionType, setActionType] = useState('send_email')

  const handleSaveWorkflow = (e) => {
    e.preventDefault()
    if (!name.trim()) return

    addWorkflow({
      name,
      triggerEvent,
      condition,
      actions: [{ type: actionType, params: {} }],
    })

    navigate('/workflows')
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Create Automation Rule"
          description="Configure event triggers, boolean logic conditions, and automated actions"
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

      <Card className="max-w-xl space-y-4 border-border">
        <form onSubmit={handleSaveWorkflow} className="space-y-4">
          <Input
            label="Rule Name"
            placeholder="e.g. Notify Manager on High Value Lead"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-300">1. Trigger Event (WHEN)</label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value)}
              className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
            >
              <option value="crm.lead.won">CRM: Lead Status Changed to Won</option>
              <option value="crm.lead.created">CRM: New Lead Created</option>
              <option value="finance.invoice.overdue">Finance: Invoice Overdue</option>
              <option value="finance.invoice.paid">Finance: Invoice Payment Received</option>
              <option value="project.task.logged_hours">Projects: Work Hours Logged</option>
            </select>
          </div>

          <Input
            label="2. Condition Expression (IF)"
            placeholder="e.g. lead.estimatedValue >= 10000"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-slate-300">3. Action Executed (THEN)</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
            >
              <option value="create_client_portal_user">Create Client Portal User Profile</option>
              <option value="send_email">Send Email Template</option>
              <option value="send_in_app_notification">Send In-App Notification</option>
              <option value="send_slack_alert">Post Slack Alert</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => navigate('/workflows')} className="w-1/3">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="w-2/3" icon={Save}>
              Save Rule
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
