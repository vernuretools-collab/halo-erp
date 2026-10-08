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
import { Save, Landmark, Utensils } from 'lucide-react'

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

  useEffect(() => {
    getPaymentDetails().then(setBank).catch(() => {})
    getEmployeeControls().then(setEmployeeControls).catch(() => {})
  }, [])

  const handleSave = (e) => {
    e.preventDefault()
    updateOrgDetails({ name, slug, currency, timezone })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const setBankField = (key) => (e) => setBank((prev) => ({ ...prev, [key]: e.target.value }))

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

      <Card className="max-w-2xl space-y-4 border-border bg-surface">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Utensils className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-fg text-sm">Employee Controls</h3>
        </div>
        <p className="text-xs text-muted">
          One lunch window for every employee. Screenshots pause while that lunch is running.
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
                Clocked-in employees start lunch automatically at this time, once a day. Work screenshots stop until lunch ends.
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
                Employees can start lunch themselves. Turn this off to use only the fixed window.
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
