import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TeamSubNav } from './components/TeamSubNav'
import { listEmployeeOnboarding } from './services/employeeOnboardingService'
import { ONBOARDING_STATUS } from '../../../../shared/supabase/employeeOnboarding.js'
import { UserPlus } from 'lucide-react'

function statusLabel(status) {
  if (status === ONBOARDING_STATUS.SUBMITTED) return 'Submitted'
  return 'Waiting for answers'
}

export const EmployeeOnboardingList = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        description="Set up a new hire and give them a joining login. That login cannot open the employee portal."
        actions={
          <Link to="/team/onboarding/new">
            <Button icon={UserPlus}>Setup new employee</Button>
          </Link>
        }
      />
      <TeamSubNav />

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
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-muted">Loading onboarding records…</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-muted">No onboarding records yet.</td>
              </tr>
            )}
            {rows.map((row) => {
              const employment = row.employment || {}
              const submitted = row.status === ONBOARDING_STATUS.SUBMITTED
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
