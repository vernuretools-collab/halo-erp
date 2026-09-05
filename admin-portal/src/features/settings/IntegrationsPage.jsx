import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useSettingsStore } from './stores/settingsStore'
import { Building, ShieldCheck, Key, Check, Plug } from 'lucide-react'

export const IntegrationsPage = () => {
  const { integrations, toggleIntegration } = useSettingsStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Integrations & API Settings"
          description="Manage third-party search extensions, payment gateways, and automated webhook connections"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/settings/org"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Building className="w-3.5 h-3.5" /> Organization Profile
          </NavLink>
          <NavLink
            to="/settings/roles"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Custom Roles & Permissions
          </NavLink>
          <NavLink
            to="/settings/integrations"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
              }`
            }
          >
            <Key className="w-3.5 h-3.5" /> Integrations & API
          </NavLink>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {integrations.map((item) => (
          <Card key={item.id} hover className="p-5 border-border bg-surface space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 border border-accent/20">
                    <Plug className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-fg text-sm">{item.name}</h4>
                </div>
                <Badge variant={item.status === 'connected' ? 'success' : 'neutral'}>
                  {item.status}
                </Badge>
              </div>
              <p className="text-xs text-muted leading-relaxed">{item.description}</p>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button
                size="sm"
                variant={item.status === 'connected' ? 'outline' : 'primary'}
                onClick={() => toggleIntegration(item.id)}
              >
                {item.status === 'connected' ? 'Disconnect' : 'Connect Integration'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
