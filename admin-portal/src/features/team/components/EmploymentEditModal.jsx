import React, { useEffect, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { createDepartment, getDepartments } from '../services/teamService'
import { employmentDetails, updateEmployeeEmployment } from '../services/employeeOnboardingService'
import { PROBATION_PERIODS, WORK_MODES } from '../../../../../shared/supabase/employeeOnboarding.js'

function dateInputValue(value) {
  const match = String(value || '').trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function draftFromRecord(record) {
  const employment = employmentDetails(record?.employment || {})
  return {
    ...employment,
    dateOfJoining: dateInputValue(employment.dateOfJoining),
    issueDate: dateInputValue(employment.issueDate),
    workMode: employment.workMode || WORK_MODES[0],
    probationPeriod: employment.probationPeriod || '3 months',
  }
}

function withCurrentOption(options, current) {
  const value = String(current || '').trim()
  if (!value || options.includes(value)) return options
  return [value, ...options]
}

export function EmploymentEditModal({ open, record, onClose, onSaved }) {
  const [departments, setDepartments] = useState([])
  const [employment, setEmployment] = useState(() => draftFromRecord(record))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmployment(draftFromRecord(record))
    setError('')
    setSaving(false)
  }, [open, record])

  useEffect(() => {
    if (!open) return
    getDepartments()
      .then((rows) => {
        const names = [...new Set(rows.map((row) => String(row.name || '').trim()).filter(Boolean))]
        if (names.length) setDepartments(names)
      })
      .catch(() => {})
  }, [open])

  const setField = (key, value) => setEmployment((current) => ({ ...current, [key]: value }))

  const requestClose = () => {
    if (saving) return
    onClose?.()
  }

  const rememberDepartment = async (raw) => {
    const trimmed = String(raw || '').trim()
    if (!trimmed) return ''
    const existing = departments.find((name) => name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const created = await createDepartment(trimmed)
    const savedName = String(created?.name || trimmed).trim()
    setDepartments((current) => (
      current.some((name) => name.toLowerCase() === savedName.toLowerCase())
        ? current
        : [...current, savedName]
    ))
    return savedName
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!record || saving) return
    setError('')
    setSaving(true)
    try {
      const department = await rememberDepartment(employment.department)
      if (!department) {
        setError('Enter a department.')
        return
      }
      const saved = await updateEmployeeEmployment({
        id: record.id,
        authId: record.auth_id,
        employment: { ...employment, department },
      })
      try {
        await onSaved?.(saved)
      } catch (err) {
        setError(err.message || 'Saved, but this page could not refresh.')
        return
      }
      onClose?.()
    } catch (err) {
      setError(err.message || 'Could not save these employment details.')
    } finally {
      setSaving(false)
    }
  }

  const workModes = withCurrentOption(WORK_MODES, employment.workMode)
  const probationPeriods = withCurrentOption(PROBATION_PERIODS, employment.probationPeriod)

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Edit employment details"
      size="xl"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="employment-edit-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save employment details'}
          </Button>
        </>
      }
    >
      <form id="employment-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted">
          The joining username and password stay the same. These details update the onboarding record, the hire’s form, and the PDF packs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Employee ID *" placeholder="e.g. THEC-2026-SAL-001" value={employment.employeeId} onChange={(e) => setField('employeeId', e.target.value)} required />
          <Input label="Full name *" placeholder="Employee's full name" value={employment.fullName} onChange={(e) => setField('fullName', e.target.value)} required />
          <Input label="Designation *" placeholder="e.g. Inside Sales Executive" value={employment.designation} onChange={(e) => setField('designation', e.target.value)} required />
          <Input label="Department *" placeholder="e.g. Content & Creative" value={employment.department} onChange={(e) => setField('department', e.target.value)} required />
          <Input label="Reporting manager *" value={employment.reportingManager} onChange={(e) => setField('reportingManager', e.target.value)} required />
          <Input label="Date of joining *" type="date" value={employment.dateOfJoining} onChange={(e) => setField('dateOfJoining', e.target.value)} required />
          <label className="w-full space-y-1.5 text-left">
            <span className="block text-xs font-medium text-fg">Work mode *</span>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              value={employment.workMode}
              onChange={(e) => setField('workMode', e.target.value)}
              required
            >
              {workModes.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </label>
          <Input label="Monthly CTC (₹) *" placeholder="e.g. 20,000" value={employment.monthlyCtc} onChange={(e) => setField('monthlyCtc', e.target.value)} required />
          <label className="w-full space-y-1.5 text-left">
            <span className="block text-xs font-medium text-fg">Probation period</span>
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
              value={employment.probationPeriod}
              onChange={(e) => setField('probationPeriod', e.target.value)}
            >
              {probationPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
            </select>
          </label>
          <Input label="Work location" placeholder="Padi, Chennai" value={employment.workLocation} onChange={(e) => setField('workLocation', e.target.value)} />
          <div>
            <Input label="Assets to be issued" placeholder="Laptop, mouse — or leave blank / None" value={employment.assets} onChange={(e) => setField('assets', e.target.value)} />
            <p className="text-xs text-muted mt-1">Leave blank or type None / Nil if nothing is issued. Asset pages appear in the packs only when you list real items.</p>
          </div>
          <Input label="Issue date" type="date" value={employment.issueDate} onChange={(e) => setField('issueDate', e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </form>
    </Modal>
  )
}
