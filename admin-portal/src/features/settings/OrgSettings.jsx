import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useSettingsStore } from './stores/settingsStore'
import { getPaymentDetails, savePaymentDetails } from '../../shared/services/paymentDetailsService'
import {
  DEFAULT_EMPLOYEE_CONTROLS,
  getEmployeeControls,
  saveEmployeeControls,
} from '../../../../shared/employeeControls.js'
import {
  DEFAULT_WORKING_HOURS,
  clockMinutes,
  formatMinutes12,
  getWorkingHours,
  saveWorkingHours,
} from '../../../../shared/workingHours.js'
import { getEmployees, getDepartments, createDepartment, renameDepartment, deleteDepartment, reorderDepartments, departmentLabelKey, sortDepartments } from '../team/services/teamService'
import { isDirectoryVisible } from '../../../../shared/employees/employmentStatus.js'
import { Save, Landmark, Utensils, Plus, Pencil, Trash2, ChevronUp, ChevronDown, Network, Clock } from 'lucide-react'

export const OrgSettings = () => {
  const { orgDetails, updateOrgDetails } = useSettingsStore()

  const [name, setName] = useState(orgDetails.name)
  const [slug, setSlug] = useState(orgDetails.slug)
  const [currency, setCurrency] = useState(orgDetails.currency)
  const [timezone, setTimezone] = useState(orgDetails.timezone)
  const [saved, setSaved] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [bankSaving, setBankSaving] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bank, setBank] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
    swift: '',
    upi: '',
    branch: '',
    notes: '',
  })
  const [employeeControls, setEmployeeControls] = useState(DEFAULT_EMPLOYEE_CONTROLS)
  const [controlsSaved, setControlsSaved] = useState(false)
  const [controlsSaving, setControlsSaving] = useState(false)
  const [controlsError, setControlsError] = useState('')
  const [workingHours, setWorkingHours] = useState(DEFAULT_WORKING_HOURS)
  const [hoursSaved, setHoursSaved] = useState(false)
  const [hoursSaving, setHoursSaving] = useState(false)
  const [hoursError, setHoursError] = useState('')

  useEffect(() => {
    getPaymentDetails().then(setBank).catch(() => {})
    getEmployeeControls().then(setEmployeeControls).catch(() => {})
    getWorkingHours().then(setWorkingHours).catch(() => {})
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    updateOrgDetails({ name, slug, currency, timezone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setBankField = (key) => (e) => setBank((prev) => ({ ...prev, [key]: e.target.value }))

  const handleSaveWorkingHours = async (e) => {
    e.preventDefault()
    setHoursError('')
    setHoursSaving(true)
    try {
      const savedHours = await saveWorkingHours(workingHours)
      setWorkingHours(savedHours)
      setHoursSaved(true)
      setTimeout(() => setHoursSaved(false), 2000)
    } catch (err) {
      setHoursError(err.message || 'Failed to save working hours.')
    } finally {
      setHoursSaving(false)
    }
  }

  const handleSaveEmployeeControls = async (e) => {
    e.preventDefault()
    setControlsError('')
    setControlsSaving(true)
    try {
      const savedControls = await saveEmployeeControls(employeeControls)
      setEmployeeControls(savedControls)
      setControlsSaved(true)
      setTimeout(() => setControlsSaved(false), 2000)
    } catch (err) {
      setControlsError(err.message || 'Failed to save employee controls.')
    } finally {
      setControlsSaving(false)
    }
  }

  const handleSaveBank = async (e) => {
    e.preventDefault()
    setBankError('')
    setBankSaving(true)
    try {
      const savedBank = await savePaymentDetails(bank)
      setBank(savedBank)
      setBankSaved(true)
      setTimeout(() => setBankSaved(false), 2000)
    } catch (err) {
      setBankError(err.message || 'Failed to save bank details.')
    } finally {
      setBankSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        description="Configure company profile and workspace preferences"
      />

      <Card className="max-w-2xl space-y-4 border-border bg-surface">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-bold text-fg text-sm">General Profile Settings</h3>
          <Badge variant="brand">{orgDetails.plan}</Badge>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Organization Legal Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Workspace Identifier (Slug)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Default Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            />
            <Input
              label="Primary Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {saved && <span className="text-xs text-emerald-400 font-semibold">Settings Saved!</span>}
            <Button type="submit" variant="primary" icon={Save} className="ml-auto">
              Save Settings
            </Button>
          </div>
        </form>
      </Card>

      <DepartmentSettingsCard />

      <WorkingHoursCard
        workingHours={workingHours}
        setWorkingHours={setWorkingHours}
        hoursError={hoursError}
        hoursSaved={hoursSaved}
        hoursSaving={hoursSaving}
        onSave={handleSaveWorkingHours}
      />

      <Card className="max-w-2xl space-y-4 border-border bg-surface">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Utensils className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-fg text-sm">Employee Controls</h3>
        </div>
        <p className="text-xs text-muted">
          One lunch window for every employee. Work screenshots pause while that lunch is running. Outside the window, break, lunch, and screenshots stay as they are.
        </p>

        {controlsError && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl">{controlsError}</div>
        )}

        <form onSubmit={handleSaveEmployeeControls} className="space-y-4">
          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-0.5 accent-accent"
              checked={employeeControls.fixedLunchEnabled}
              onChange={(e) => setEmployeeControls((prev) => ({ ...prev, fixedLunchEnabled: e.target.checked }))}
            />
            <span>
              <span className="font-medium">Fixed lunch for all employees</span>
              <span className="block text-xs text-muted">
                Clocked-in employees switch to lunch at this time. Work screenshots stop until the window ends.
              </span>
            </span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Lunch start"
              type="time"
              value={employeeControls.lunchStart}
              onChange={(e) => setEmployeeControls((prev) => ({ ...prev, lunchStart: e.target.value }))}
              required={employeeControls.fixedLunchEnabled}
            />
            <Input
              label="Lunch end"
              type="time"
              value={employeeControls.lunchEnd}
              onChange={(e) => setEmployeeControls((prev) => ({ ...prev, lunchEnd: e.target.value }))}
              required={employeeControls.fixedLunchEnabled}
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-fg">
            <input
              type="checkbox"
              className="mt-0.5 accent-accent"
              checked={employeeControls.showLunchButton}
              onChange={(e) => setEmployeeControls((prev) => ({ ...prev, showLunchButton: e.target.checked }))}
            />
            <span>
              <span className="font-medium">Show lunch button</span>
              <span className="block text-xs text-muted">
                Employees can still start lunch themselves. A lunch they start stays on until they end it, unless it falls inside this window.
              </span>
            </span>
          </label>

          <div className="pt-2 flex items-center justify-between">
            {controlsSaved && <span className="text-xs text-emerald-400 font-semibold">Employee controls saved.</span>}
            <Button type="submit" variant="primary" icon={Save} className="ml-auto" disabled={controlsSaving}>
              {controlsSaving ? 'Saving...' : 'Save Employee Controls'}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="max-w-2xl space-y-4 border-border bg-surface">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Landmark className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-fg text-sm">Bank Transfer Details</h3>
        </div>
        <p className="text-xs text-muted">
          Clients see these account details on their Billing page so they can send payment to your company.
        </p>

        {bankError && (
          <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl">{bankError}</div>
        )}

        <form onSubmit={handleSaveBank} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Bank Name" value={bank.bankName} onChange={setBankField('bankName')} required />
            <Input label="Account Name" value={bank.accountName} onChange={setBankField('accountName')} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Account Number" value={bank.accountNumber} onChange={setBankField('accountNumber')} required />
            <Input label="IFSC" value={bank.ifsc} onChange={setBankField('ifsc')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="SWIFT (optional)" value={bank.swift} onChange={setBankField('swift')} />
            <Input label="UPI ID (optional)" value={bank.upi} onChange={setBankField('upi')} />
          </div>
          <Input label="Branch (optional)" value={bank.branch} onChange={setBankField('branch')} />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-fg">Payment notes</label>
            <textarea
              rows={2}
              value={bank.notes}
              onChange={setBankField('notes')}
              className="w-full bg-canvas border border-border text-fg text-sm rounded-xl p-3 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="pt-2 flex items-center justify-between">
            {bankSaved && <span className="text-xs text-emerald-400 font-semibold">Bank details saved.</span>}
            <Button type="submit" variant="primary" icon={Save} className="ml-auto" disabled={bankSaving}>
              {bankSaving ? 'Saving...' : 'Save Bank Details'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

function WorkingHoursCard({
  workingHours,
  setWorkingHours,
  hoursError,
  hoursSaved,
  hoursSaving,
  onSave,
}) {
  const start = clockMinutes(workingHours.workStart)
  const grace = Number(workingHours.graceMinutes)
  const cutoff = start != null && Number.isFinite(grace) ? formatMinutes12(start + grace) : ''
  const startLabel = start != null ? formatMinutes12(start) : ''

  return (
    <Card className="max-w-2xl space-y-4 border-border bg-surface">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Clock className="w-4 h-4 text-accent" />
        <h3 className="font-bold text-fg text-sm">Working hours</h3>
      </div>
      <p className="text-xs text-muted">
        Office start, office end, and grace time. You can change these whenever you need to.
        {cutoff && startLabel
          ? ` A clock-in at or before ${cutoff} is on time. Later is late by the minutes past ${startLabel}.`
          : ' A clock-in at or before start plus grace is on time. Later is late by the minutes past the start.'}
      </p>

      {hoursError && (
        <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl">{hoursError}</div>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Office start"
            type="time"
            value={workingHours.workStart}
            onChange={(e) => setWorkingHours((prev) => ({ ...prev, workStart: e.target.value }))}
            required
          />
          <Input
            label="Office end"
            type="time"
            value={workingHours.workEnd}
            onChange={(e) => setWorkingHours((prev) => ({ ...prev, workEnd: e.target.value }))}
            required
          />
        </div>

        <Input
          label="Grace time (minutes)"
          type="number"
          min={0}
          max={120}
          step={1}
          value={workingHours.graceMinutes}
          onChange={(e) => setWorkingHours((prev) => ({ ...prev, graceMinutes: e.target.value }))}
          required
        />

        <div className="pt-2 flex items-center justify-between">
          {hoursSaved && <span className="text-xs text-emerald-400 font-semibold">Working hours saved.</span>}
          <Button type="submit" variant="primary" icon={Save} className="ml-auto" disabled={hoursSaving}>
            {hoursSaving ? 'Saving...' : 'Save Working Hours'}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function activeCountByDepartment(employees) {
  const counts = new Map()
  employees.filter(isDirectoryVisible).forEach((emp) => {
    const key = departmentLabelKey(emp.departmentName || emp.department)
    if (!key) return
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  return counts
}

function DepartmentSettingsCard() {
  const [departments, setDepartments] = useState([])
  const [counts, setCounts] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    const [departmentRows, employees] = await Promise.all([getDepartments(), getEmployees()])
    setDepartments(sortDepartments(departmentRows))
    setCounts(activeCountByDepartment(employees))
  }

  useEffect(() => {
    let cancelled = false
    load()
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load departments.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const nameTaken = (name, ignoreId) => {
    const key = departmentLabelKey(name)
    if (!key) return false
    return departments.some((dept) => dept.deptId !== ignoreId && departmentLabelKey(dept.name) === key)
  }

  const run = async (action) => {
    setError('')
    setBusy(true)
    try {
      await action()
      await load()
    } catch (err) {
      setError(err?.message || 'Could not update departments.')
    } finally {
      setBusy(false)
    }
  }

  const handleAdd = (e) => {
    e.preventDefault()
    const name = newName.replace(/\s+/g, ' ').trim()
    if (!name) return
    if (nameTaken(name)) {
      setError('That department already exists.')
      return
    }
    run(async () => {
      const created = await createDepartment(name)
      if (String(created?.deptId || '').startsWith('dept_')) {
        throw new Error('Could not save that department.')
      }
      setNewName('')
    })
  }

  const handleRename = (dept) => {
    const name = editName.replace(/\s+/g, ' ').trim()
    if (!name) return
    if (nameTaken(name, dept.deptId)) {
      setError('That department already exists.')
      return
    }
    run(async () => {
      await renameDepartment(dept.deptId, dept.name, name)
      setEditingId('')
      setEditName('')
    })
  }

  const move = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= departments.length) return
    const ordered = [...departments]
    const [row] = ordered.splice(index, 1)
    ordered.splice(nextIndex, 0, row)
    run(() => reorderDepartments(ordered))
  }

  const handleDelete = (dept) => {
    const confirmed = window.confirm(
      `Remove ${dept.name} from the organization chart? People stay on file. Anyone left on this department shows as Unassigned.`
    )
    if (!confirmed) return
    run(() => deleteDepartment(dept.deptId))
  }

  return (
    <Card className="max-w-2xl space-y-4 border-border bg-surface">
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <Network className="w-4 h-4 text-accent" />
        <h3 className="font-bold text-fg text-sm">Departments</h3>
      </div>
      <p className="text-xs text-muted">
        These departments are the columns on the employee organization chart. Active staff appear under their department. Ex-employees are not counted.
      </p>

      {error && (
        <div className="p-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl">{error}</div>
      )}

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="New department"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Web Development"
          />
        </div>
        <Button type="submit" variant="primary" icon={Plus} disabled={busy || !newName.trim()}>
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-xs text-muted">Loading departments…</p>
      ) : departments.length === 0 ? (
        <p className="text-xs text-muted">No departments yet. Add one to show it on the organization chart.</p>
      ) : (
        <ul className="space-y-2">
          {departments.map((dept, index) => {
            const count = counts.get(departmentLabelKey(dept.name)) || 0
            const editing = editingId === dept.deptId
            return (
              <li key={dept.deptId} className="flex items-center gap-2 rounded-xl border border-border bg-chrome px-3 py-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-muted hover:text-fg disabled:opacity-30"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${dept.name} up`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="text-muted hover:text-fg disabled:opacity-30"
                    disabled={busy || index === departments.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${dept.name} down`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleRename(dept)
                      }}
                    >
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-canvas border border-border text-fg text-sm rounded-lg px-2 py-1 focus:outline-none focus:border-accent"
                        autoFocus
                      />
                      <Button type="submit" size="sm" variant="primary" disabled={busy || !editName.trim()}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingId('')
                          setEditName('')
                        }}
                      >
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-fg truncate">{dept.name}</p>
                      <p className="text-[11px] text-muted">
                        {count} active {count === 1 ? 'employee' : 'employees'}
                      </p>
                    </>
                  )}
                </div>
                {!editing && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-fg rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      disabled={busy}
                      aria-label={`Rename ${dept.name}`}
                      onClick={() => {
                        setEditingId(dept.deptId)
                        setEditName(dept.name || '')
                        setError('')
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      disabled={busy}
                      aria-label={`Delete ${dept.name}`}
                      onClick={() => handleDelete(dept)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
