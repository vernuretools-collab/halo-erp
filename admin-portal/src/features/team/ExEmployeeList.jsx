import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { TeamSubNav } from './components/TeamSubNav'
import { getEmployees } from './services/teamService'
import { downloadExEmployeeRegister } from './services/employmentRecordExports'
import {
  employeeDepartment,
  employeeDesignation,
  employeeDisplayName,
  employeeDocId,
  employeeJoiningDate,
  employeePublicId,
  employmentStatusLabel,
  isFormerEmployee,
  isoDay,
} from '../../../../shared/employees/employmentStatus.js'
import { Download, Search } from 'lucide-react'

const fieldClass =
  'bg-canvas border border-border text-xs text-fg rounded-xl px-3 py-1.5 focus:outline-none'

export const ExEmployeeList = () => {
  const [employees, setEmployees] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    let cancelled = false
    getEmployees()
      .then((rows) => {
        if (!cancelled) setEmployees((rows || []).filter(isFormerEmployee))
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load ex-employees.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const departments = useMemo(
    () => [...new Set(employees.map((employee) => employeeDepartment(employee)).filter(Boolean))].sort(),
    [employees],
  )

  const filtered = employees.filter((employee) => {
    const query = search.trim().toLowerCase()
    const haystack = [employeeDisplayName(employee), employeePublicId(employee), employeeDesignation(employee)]
      .join(' ')
      .toLowerCase()
    if (query && !haystack.includes(query)) return false
    if (department !== 'all' && employeeDepartment(employee) !== department) return false
    if (status !== 'all' && employee.status !== status) return false
    const day = isoDay(employee.lastWorkingDay)
    if (from && (!day || day < from)) return false
    if (to && (!day || day > to)) return false
    return true
  })

  return (
    <div className="space-y-6">
      <TeamSubNav />
      <PageHeader
        title="Ex-Employees"
        description="Former staff stay on their original employee id. Nothing in their history is deleted."
        actions={
          <Button variant="secondary" icon={Download} onClick={() => downloadExEmployeeRegister(filtered)} disabled={!filtered.length}>
            Export Excel
          </Button>
        }
      />

      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <label className="space-y-1 text-xs text-muted">
          Search
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${fieldClass} pl-8 w-56`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, id, designation" />
          </div>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Department
          <select className={fieldClass} value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="all">All departments</option>
            {departments.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Status
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Ex-Employee and Archived</option>
            <option value="relieved">Ex-Employee</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Last working day from
          <input className={fieldClass} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted">
          to
          <input className={fieldClass} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </Card>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading ex-employees…</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted border-b border-border">
              <tr>
                {['Name', 'Employee ID', 'Designation', 'Department', 'Date of joining', 'Last working day', 'Exit reason', 'Employment status'].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-muted">No ex-employees match these filters.</td>
                </tr>
              ) : filtered.map((employee) => {
                const id = employeeDocId(employee)
                return (
                  <tr key={id} className="border-b border-border/70 hover:bg-canvas">
                    <td className="px-3 py-2">
                      <Link className="font-semibold text-accent" to={`/team/ex-employees/${encodeURIComponent(id)}`}>
                        {employeeDisplayName(employee)}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{employeePublicId(employee)}</td>
                    <td className="px-3 py-2">{employeeDesignation(employee)}</td>
                    <td className="px-3 py-2">{employeeDepartment(employee)}</td>
                    <td className="px-3 py-2">{employeeJoiningDate(employee) || '—'}</td>
                    <td className="px-3 py-2">{isoDay(employee.lastWorkingDay) || '—'}</td>
                    <td className="px-3 py-2 max-w-[16rem] truncate">{employee.exitReason || '—'}</td>
                    <td className="px-3 py-2">{employmentStatusLabel(employee.status)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
