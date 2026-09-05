import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useSettingsStore } from './stores/settingsStore'
import { PERMISSIONS } from '../../shared/constants/permissions'
import { Building, ShieldCheck, Key, Plus, Trash2, X, Check } from 'lucide-react'

export const RoleManager = () => {
  const { customRoles, addCustomRole, toggleRolePermission, deleteCustomRole } =
    useSettingsStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')

  const permissionList = Object.entries(PERMISSIONS).map(([key, val]) => ({
    key,
    value: val,
  }))

  const handleCreateRole = (e) => {
    e.preventDefault()
    if (!newRoleName.trim()) return

    addCustomRole({
      name: newRoleName,
      permissions: [PERMISSIONS.CRM_LEADS_READ, PERMISSIONS.PROJECTS_READ],
    })

    setNewRoleName('')
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Custom Roles & Permissions Matrix"
          description="Enforce path-level custom claims security rules and configure fine-grained role permissions"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Create Custom Role
            </Button>
          }
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

      {/* Role Permission Matrix Grid */}
      <div className="space-y-6">
        {customRoles.map((role) => (
          <Card key={role.roleId} hover className="space-y-4 border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-fg text-sm">{role.name}</h3>
                <Badge variant={role.isSystem ? 'brand' : 'info'}>
                  {role.isSystem ? 'System Core Role' : 'Custom Defined'}
                </Badge>
              </div>

              {!role.isSystem && (
                <button
                  onClick={() => deleteCustomRole(role.roleId)}
                  className="p-1.5 text-muted hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                  title="Delete Custom Role"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Permission Checkbox Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {permissionList.map((perm) => {
                const isChecked = role.permissions.includes(perm.value)
                return (
                  <label
                    key={perm.key}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-accent-soft border-accent/30 text-accent font-medium'
                        : 'bg-slate-900/60 border-border/80 text-muted hover:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={role.isSystem}
                      onChange={() => toggleRolePermission(role.roleId, perm.value)}
                      className="rounded bg-slate-800 border-slate-700 text-accent focus:ring-accent"
                    />
                    <span className="truncate font-mono text-[11px]">{perm.value}</span>
                  </label>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Create Custom Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Create Custom Role</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4">
              <Input
                label="Role Title"
                placeholder="e.g. Sales Director"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Create Role
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
