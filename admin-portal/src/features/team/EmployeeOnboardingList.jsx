import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TeamSubNav } from './components/TeamSubNav'
import { deleteEmployeeOnboarding, listEmployeeOnboarding, resetJoiningLogin } from './services/employeeOnboardingService'
import { ONBOARDING_STATUS, joiningPageUrl } from '../../../../shared/supabase/employeeOnboarding.js'
import { UserPlus } from 'lucide-react'

function statusLabel(status) {
  if (status === ONBOARDING_STATUS.SUBMITTED) return 'Submitted'
  return 'Waiting for answers'
}

export const EmployeeOnboardingList = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState({})
  const [resettingId, setResettingId] = useState('')
  const [savingId, setSavingId] = useState('')
  const [savedId, setSavedId] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const joiningUrl = joiningPageUrl()

  const saveLogin = async (row) => {
    const password = String(passwords[row.id] || '')
    if (password.length < 6) {
      setError('Reset password must be at least 6 characters.')
      return
    }
    setError('')
    setSavingId(row.id)
    try {
      await resetJoiningLogin({
        id: row.id,
        username: row.username,
        password,
        displayName: row.employment?.fullName,
        employment: row.employment,
      })
      setSavedId(row.id)
      setResettingId('')
      setPasswords((current) => ({ ...current, [row.id]: '' }))
    } catch (err) {
      setError(err.message || 'Could not reset this joining password.')
    } finally {
      setSavingId('')
    }
  }

  const removeRow = async (row) => {
    if (confirmDeleteId !== row.id) {
      setConfirmDeleteId(row.id)
      return
    }
    setError('')
    setDeletingId(row.id)
    try {
      await deleteEmployeeOnboarding(row.id)
      setRows((current) => current.filter((item) => item.id !== row.id))
      setConfirmDeleteId('')
    } catch (err) {
      setError(err.message || 'Could not delete this joining record.')
    } finally {
      setDeletingId('')
    }
  }

  useEffect(() => {
    let cancelled = false
    listEmployeeOnboarding()
      .then((data) => {
        if (!cancelled) setRows(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load onboarding records.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Onboarding"
        description="Username and password are created in Setup new employee. This list is only for status. The hire signs in at the joining page with that same login."
        actions={
          <Link to="/team/onboarding/new">
            <Button icon={UserPlus}>Setup new employee</Button>
          </Link>
        }
      />
      <TeamSubNav />

      <Card className="space-y-2">
        <p className="text-sm text-fg">Joining page for new hires: <span className="font-medium">{joiningUrl}</span></p>
        <p className="text-xs text-muted">Waiting for answers = hire has not submitted yet. Submitted = click the employee name to see the filled form and download the 3 PDF packs.</p>
      </Card>

      {error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-chrome text-muted text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Joining username</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">Loading onboarding records…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-muted">No onboarding records yet.</td>
              </tr>
            )}
            {rows.map((row) => {
              const employment = row.employment || {}
              const submitted = row.status === ONBOARDING_STATUS.SUBMITTED
              const resetting = resettingId === row.id
              return (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link to={`/team/onboarding/${row.id}`} className="font-medium text-fg hover:text-accent">
                      {employment.fullName || 'Unnamed hire'}
                    </Link>
                    <p className="text-xs text-muted">{employment.employeeId}</p>
                  </td>
                  <td className="px-4 py-3 text-muted">{employment.department || '—'}</td>
                  <td className="px-4 py-3">{row.username}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${submitted ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700'}`}>
                      {statusLabel(row.status)}
                    </span>
                    {submitted && (
                      <p className="text-[11px] text-muted mt-1">Click the name to open answers and PDFs</p>
                    )}
                    {savedId === row.id && (
                      <p className="text-[11px] text-emerald-700 mt-1">Password reset. Hire can use the new password on the joining page.</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-2">
                      {resetting ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="password"
                            className="w-36 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
                            placeholder="New password"
                            value={passwords[row.id] || ''}
                            onChange={(event) => setPasswords((current) => ({ ...current, [row.id]: event.target.value }))}
                            autoComplete="new-password"
                          />
                          <Button type="button" size="sm" variant="secondary" disabled={savingId === row.id} onClick={() => saveLogin(row)}>
                            {savingId === row.id ? 'Saving…' : 'Save new password'}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setResettingId('')}>Cancel</Button>
                        </div>
                      ) : (
                        <Button type="button" size="sm" variant="ghost" onClick={() => setResettingId(row.id)}>
                          Forgot password?
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="danger" disabled={deletingId === row.id} onClick={() => removeRow(row)}>
                        {deletingId === row.id ? 'Deleting…' : confirmDeleteId === row.id ? 'Confirm delete' : 'Delete'}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
