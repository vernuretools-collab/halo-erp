import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { TeamSubNav } from './components/TeamSubNav'
import { getDepartments } from './services/teamService'
import { createEmployeeOnboarding } from './services/employeeOnboardingService'
import {
  CUSTOM_KRA_TARGET,
  FIXED_KRAS,
  PROBATION_PERIODS,
  WORK_MODES,
  customKraWeight,
  isValidJoiningUsername,
  joiningPageUrl,
  normalizeJoiningUsername,
} from '../../../../shared/supabase/employeeOnboarding.js'
import { Plus, Trash2 } from 'lucide-react'

const FALLBACK_DEPARTMENTS = ['Sales', 'Engineering & Product', 'Operations', 'Human Resources']

const emptyKra = (weight) => ({ keyResultArea: '', kpi: '', weight })

export const EmployeeOnboardingSetup = () => {
  const [departments, setDepartments] = useState(FALLBACK_DEPARTMENTS)
  const [employment, setEmployment] = useState({
    employeeId: '',
    fullName: '',
    designation: '',
    department: FALLBACK_DEPARTMENTS[0],
    reportingManager: '',
    dateOfJoining: '',
    workMode: WORK_MODES[0],
    monthlyCtc: '',
    probationPeriod: '3 months',
    workLocation: '',
    assets: '',
    issueDate: '',
  })
  const [kras, setKras] = useState([emptyKra(40), emptyKra(20), emptyKra(20)])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    getDepartments()
      .then((rows) => {
        const names = rows.map((row) => row.name).filter(Boolean)
        if (names.length === 0) return
        setDepartments(names)
        setEmployment((current) => ({ ...current, department: current.department || names[0] }))
      })
      .catch(() => {})
  }, [])

  const weight = useMemo(() => customKraWeight(kras), [kras])

  const setField = (key, value) => setEmployment((current) => ({ ...current, [key]: value }))

  const updateKra = (index, key, value) => {
    setKras((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const login = normalizeJoiningUsername(username)
    if (!isValidJoiningUsername(login)) {
      setError('Username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (Math.abs(weight - CUSTOM_KRA_TARGET) > 0.001) {
      const gap = Math.abs(weight - CUSTOM_KRA_TARGET)
      const direction = weight > CUSTOM_KRA_TARGET ? 'Reduce' : 'Increase'
      setError(`Editable KRA weights total ${weight}%. ${direction} them by ${gap}% so they total ${CUSTOM_KRA_TARGET}%. Portal Compliance and Client Satisfaction already take 10% each.`)
      return
    }
    setSaving(true)
    try {
      const result = await createEmployeeOnboarding({
        username: login,
        password,
        employment,
        kras: kras.map((row) => ({
          keyResultArea: row.keyResultArea.trim(),
          kpi: row.kpi.trim(),
          weight: Number(row.weight),
        })),
      })
      setCreated({ ...result, username: login, password, url: joiningPageUrl() })
    } catch (err) {
      setError(err.message || 'Could not create the joining account.')
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Joining login ready"
          description="Share this page and username with the hire. This login cannot open the employee portal."
        />
        <TeamSubNav />
        <Card className="space-y-3 max-w-xl">
          <p className="text-sm text-fg"><span className="text-muted">Joining page</span><br />{created.url}</p>
          <p className="text-sm text-fg"><span className="text-muted">Username</span><br />{created.username}</p>
          <p className="text-sm text-fg"><span className="text-muted">Password</span><br />{created.password}</p>
          <p className="text-xs text-muted">The password is not stored in the onboarding record. Copy it now.</p>
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(`${created.url}\nUsername: ${created.username}\nPassword: ${created.password}`)}
            >
              Copy details
            </Button>
            <Link to="/team/onboarding">
              <Button type="button" variant="primary">Back to list</Button>
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Setup New Employee"
        description="Enter the employment details. These will be pre-filled (read-only) for the employee in their form."
      />
      <TeamSubNav />
      <Link to="/team/onboarding" className="text-sm text-accent font-medium">← Back to onboarding list</Link>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-4">Employment details</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Employee ID *" placeholder="e.g. THEC-2026-SAL-001" value={employment.employeeId} onChange={(e) => setField('employeeId', e.target.value)} required />
            <Input label="Full name *" placeholder="Employee's full name" value={employment.fullName} onChange={(e) => setField('fullName', e.target.value)} required />
            <Input label="Designation *" placeholder="e.g. Inside Sales Executive" value={employment.designation} onChange={(e) => setField('designation', e.target.value)} required />
            <label className="w-full space-y-1.5 text-left">
              <span className="block text-xs font-medium text-fg">Department *</span>
              <select
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                value={employment.department}
                onChange={(e) => setField('department', e.target.value)}
                required
              >
                {departments.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
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
                {WORK_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
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
                {PROBATION_PERIODS.map((period) => <option key={period} value={period}>{period}</option>)}
              </select>
            </label>
            <Input label="Work location" placeholder="Padi, Chennai" value={employment.workLocation} onChange={(e) => setField('workLocation', e.target.value)} />
            <div>
              <Input label="Assets to be issued" placeholder="Laptop, mouse — or leave blank / None" value={employment.assets} onChange={(e) => setField('assets', e.target.value)} />
              <p className="text-xs text-muted mt-1">Leave blank or type None / Nil if nothing is issued. Asset pages appear in the packs only when you list real items.</p>
            </div>
            <Input label="Issue date" type="date" value={employment.issueDate} onChange={(e) => setField('issueDate', e.target.value)} />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Joining login</p>
          <p className="text-sm text-muted mb-4">This is the only joining login. Give these details to the hire for the joining page. They cannot sign in to the employee portal.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Username *" placeholder="e.g. priya.sales" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
            <Input label="Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
        </Card>

        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">KRA / KPI</p>
          <p className="text-sm text-muted mb-4">These will appear in the performance section of the document pack.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent text-white text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Key Result Area</th>
                  <th className="text-left px-3 py-2 font-semibold">KPI / Metric</th>
                  <th className="text-left px-3 py-2 font-semibold w-28">Weight</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {kras.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    <td className="p-2">
                      <input
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                        placeholder="e.g. Prospect Generation"
                        value={row.keyResultArea}
                        onChange={(e) => updateKra(index, 'keyResultArea', e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                        placeholder="e.g. 10 qualified calls/month"
                        value={row.kpi}
                        onChange={(e) => updateKra(index, 'kpi', e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        max="80"
                        className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                        value={row.weight}
                        onChange={(e) => updateKra(index, 'weight', e.target.value)}
                        required
                      />
                    </td>
                    <td className="p-2">
                      <button
                        type="button"
                        className="text-rose-600 p-1"
                        aria-label="Remove KRA row"
                        onClick={() => setKras((current) => current.filter((_, i) => i !== index))}
                        disabled={kras.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {FIXED_KRAS.map((kra) => (
                  <tr key={kra.keyResultArea} className="border-t border-border bg-chrome/60 text-muted">
                    <td className="px-3 py-2">{kra.keyResultArea}</td>
                    <td className="px-3 py-2">{kra.kpi}</td>
                    <td className="px-3 py-2">{kra.weight}%</td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 gap-3">
            <Button type="button" variant="outline" icon={Plus} onClick={() => setKras((current) => [...current, emptyKra('')])}>
              Add KRA row
            </Button>
            <p className={`text-xs text-right ${weight === CUSTOM_KRA_TARGET ? 'text-muted' : 'text-rose-600'}`}>
              {weight === CUSTOM_KRA_TARGET
                ? `Editable rows total ${weight}%. With the two locked 10% rows, the scorecard is 100%.`
                : `Editable rows total ${weight}%. They need to total ${CUSTOM_KRA_TARGET}% (${weight > CUSTOM_KRA_TARGET ? `${weight - CUSTOM_KRA_TARGET}% too high` : `${CUSTOM_KRA_TARGET - weight}% too low`}). The locked rows already use 20%.`}
            </p>
          </div>
        </Card>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save & create joining login'}</Button>
      </form>
    </div>
  )
}
