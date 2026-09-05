import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { TeamSubNav } from './components/TeamSubNav'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { getEmployees } from './services/teamService'
import {
  draftsFromRecord,
  loadPayslipForMonth,
  savePayslipAmounts,
  markPayslipNotified,
  rowAmountPaid,
  rowTotalDue,
  splitSum,
} from './services/payslipRosterService'
import { notifyEmployeeCheckBalance } from './services/notifyEmployeeBalance'
import { useUserStore } from '../../stores/userStore'
import { Bell, CheckCircle, IndianRupee, Minus, Plus, Save, Search } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]
const MAX_SPLIT_COLUMNS = 6

const formatInr = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0)

const isActiveEmployee = (emp) =>
  emp.status !== 'inactive' && emp.status !== 'terminated'

const AmountInput = ({ value, onChange, placeholder }) => (
  <div className="relative min-w-[120px] max-w-[150px]">
    <IndianRupee className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
    <Input
      type="number"
      min="0"
      step="0.01"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="pl-7 h-9"
    />
  </div>
)

export const PayslipManager = () => {
  const { user } = useUserStore()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingPayslips, setLoadingPayslips] = useState(false)
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [searchQuery, setSearchQuery] = useState('')
  const [drafts, setDrafts] = useState({})
  const [splitColumnCount, setSplitColumnCount] = useState(0)
  const [savingUid, setSavingUid] = useState('')
  const [notifyingUid, setNotifyingUid] = useState('')
  const [notifyingAll, setNotifyingAll] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true)
      try {
        const data = await getEmployees()
        setEmployees((data || []).filter(isActiveEmployee))
      } catch (error) {
        console.error('Error fetching employees', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (employees.length === 0) {
      setDrafts({})
      setSplitColumnCount(0)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingPayslips(true)
      try {
        const next = {}
        await Promise.all(
          employees.map(async (emp) => {
            const rec = await loadPayslipForMonth(emp, year, month)
            next[emp.uid] = draftsFromRecord(rec)
          })
        )
        if (!cancelled) {
          setDrafts(next)
          const maxSplits = Object.values(next).reduce(
            (max, row) => Math.max(max, (row.splits || []).filter(Boolean).length),
            0
          )
          setSplitColumnCount(maxSplits)
        }
      } catch (error) {
        console.error('Error loading payslips', error)
        if (!cancelled) {
          setDrafts({})
          setSplitColumnCount(0)
        }
      } finally {
        if (!cancelled) setLoadingPayslips(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [employees, month, year])

  const filteredEmployees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((emp) => {
      const name = (emp.displayName || emp.name || '').toLowerCase()
      const email = (emp.email || '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [employees, searchQuery])

  const monthTotalPaid = useMemo(
    () =>
      employees.reduce((sum, emp) => {
        const row = drafts[emp.uid]
        if (!row) return sum
        return sum + rowAmountPaid(row)
      }, 0),
    [employees, drafts]
  )

  const flash = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const paddedSplits = (row) => {
    const splits = [...(row?.splits || [])]
    while (splits.length < splitColumnCount) splits.push('')
    return splits.slice(0, splitColumnCount)
  }

  const updateTotal = (uid, value) => {
    setDrafts((prev) => ({
      ...prev,
      [uid]: { ...(prev[uid] || draftsFromRecord(null)), total: value },
    }))
  }

  const updateSplit = (uid, index, value) => {
    setDrafts((prev) => {
      const current = prev[uid] || draftsFromRecord(null)
      const splits = paddedSplits(current)
      splits[index] = value
      return { ...prev, [uid]: { ...current, splits } }
    })
  }

  const addSplitColumn = () => {
    if (splitColumnCount >= MAX_SPLIT_COLUMNS) return
    setSplitColumnCount((n) => n + 1)
  }

  const removeSplitColumn = () => {
    if (splitColumnCount <= 0) return
    const nextCount = splitColumnCount - 1
    setSplitColumnCount(nextCount)
    setDrafts((prev) => {
      const updated = {}
      Object.entries(prev).forEach(([uid, row]) => {
        updated[uid] = { ...row, splits: (row.splits || []).slice(0, nextCount) }
      })
      return updated
    })
  }

  const handleSave = async (emp) => {
    const row = drafts[emp.uid] || draftsFromRecord(null)
    setSavingUid(emp.uid)
    try {
      const saved = await savePayslipAmounts({
        employee: emp,
        year,
        month,
        total: row.total,
        splits: paddedSplits(row),
        updatedBy: user?.displayName || user?.email || 'Admin',
      })
      setDrafts((prev) => ({
        ...prev,
        [emp.uid]: {
          ...(prev[emp.uid] || {}),
          total: saved.total ? String(saved.total) : '',
          splits: saved.splits,
          persistedTotal: saved.total,
        },
      }))
      flash(`Saved ${emp.displayName || emp.email}`)
    } catch (error) {
      console.error('Error saving payslip', error)
      alert('Failed to save amounts.')
    } finally {
      setSavingUid('')
    }
  }

  const handleNotify = async (emp) => {
    const row = drafts[emp.uid] || draftsFromRecord(null)
    const total = rowTotalDue(row)
    if (total <= 0 && row.persistedTotal <= 0) {
      alert('Enter a total amount before sending a notification.')
      return
    }
    setNotifyingUid(emp.uid)
    try {
      if (total > 0 && total !== row.persistedTotal) {
        await savePayslipAmounts({
          employee: emp,
          year,
          month,
          total: row.total,
          splits: paddedSplits(row),
          updatedBy: user?.displayName || user?.email || 'Admin',
        })
      }
      await notifyEmployeeCheckBalance({
        employee: emp,
        month,
        year,
        author: user?.displayName || user?.email || 'Admin',
      })
      await markPayslipNotified({ employee: emp, year, month })
      setDrafts((prev) => ({
        ...prev,
        [emp.uid]: {
          ...(prev[emp.uid] || {}),
          persistedTotal: total || row.persistedTotal,
          lastNotifiedAt: new Date(),
        },
      }))
      flash(`Notified ${emp.displayName || emp.email}`)
    } catch (error) {
      console.error('Error notifying employee', error)
      alert('Failed to send notification.')
    } finally {
      setNotifyingUid('')
    }
  }

  const handleNotifyAll = async () => {
    const targets = employees.filter((emp) => (drafts[emp.uid]?.persistedTotal || 0) > 0)
    if (targets.length === 0) {
      alert('Save at least one employee amount greater than 0 first.')
      return
    }
    setNotifyingAll(true)
    try {
      for (const emp of targets) {
        await notifyEmployeeCheckBalance({
          employee: emp,
          month,
          year,
          author: user?.displayName || user?.email || 'Admin',
        })
        await markPayslipNotified({ employee: emp, year, month })
      }
      setDrafts((prev) => {
        const next = { ...prev }
        targets.forEach((emp) => {
          next[emp.uid] = { ...(next[emp.uid] || {}), lastNotifiedAt: new Date() }
        })
        return next
      })
      flash(`Notified ${targets.length} employee${targets.length === 1 ? '' : 's'}`)
    } catch (error) {
      console.error('Error notifying employees', error)
      alert('Failed to send notifications.')
    } finally {
      setNotifyingAll(false)
    }
  }

  const selectClass =
    'h-10 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslip Manager"
        description="Enter each employee’s total, then add split columns only when salary is paid in parts."
      />
      <TeamSubNav />

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md flex items-center text-sm">
          <CheckCircle className="w-4 h-4 mr-2 shrink-0" />
          {successMsg}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Month</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={selectClass}>
              {MONTHS.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Year</label>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={selectClass}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 min-w-[220px]">
            <label className="text-xs font-medium text-muted">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name or email"
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm text-muted mr-1">
            Total paid ({MONTHS[month - 1]} {year}):{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatInr(monthTotalPaid)}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={Plus}
            disabled={splitColumnCount >= MAX_SPLIT_COLUMNS || loadingPayslips}
            onClick={addSplitColumn}
          >
            Add split column
          </Button>
          {splitColumnCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={Minus}
              onClick={removeSplitColumn}
            >
              Remove split
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={Bell}
            disabled={notifyingAll || loadingPayslips}
            onClick={handleNotifyAll}
          >
            {notifyingAll ? 'Notifying…' : 'Notify all'}
          </Button>
        </div>
      </div>

      <Card className="p-0 overflow-hidden border border-border/80">
        {loading || loadingPayslips ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 bg-canvas/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
            <IndianRupee className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-fg">No employees found</p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? 'No employees match your search.' : 'Add employees in Team Management first.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-border">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Total amount</th>
                  {Array.from({ length: splitColumnCount }, (_, i) => (
                    <th key={i} className="px-5 py-3.5">Split {i + 1}</th>
                  ))}
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEmployees.map((emp) => {
                  const row = drafts[emp.uid] || draftsFromRecord(null)
                  const splits = paddedSplits(row)
                  const total = rowTotalDue(row)
                  const partsSum = splitSum(splits)
                  const remaining = Math.round((total - partsSum) * 100) / 100
                  const showRemaining = splitColumnCount > 0 && total > 0 && remaining !== 0
                  const name = emp.displayName || emp.name || emp.email || 'Employee'
                  return (
                    <tr
                      key={emp.uid}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent-soft flex items-center justify-center text-accent font-semibold text-xs shrink-0">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-fg truncate">{name}</div>
                            <div className="text-xs text-muted truncate">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <AmountInput
                          value={row.total}
                          onChange={(value) => updateTotal(emp.uid, value)}
                          placeholder="0"
                        />
                        {showRemaining && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            {remaining > 0
                              ? `Remaining to pay ${formatInr(remaining)}`
                              : `Overpaid ${formatInr(Math.abs(remaining))}`}
                          </p>
                        )}
                      </td>
                      {splits.map((value, index) => (
                        <td key={index} className="px-5 py-3.5">
                          <AmountInput
                            value={value}
                            onChange={(next) => updateSplit(emp.uid, index, next)}
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon={Save}
                            disabled={savingUid === emp.uid}
                            onClick={() => handleSave(emp)}
                          >
                            {savingUid === emp.uid ? 'Saving…' : 'Save'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            icon={Bell}
                            disabled={notifyingUid === emp.uid || notifyingAll}
                            onClick={() => handleNotify(emp)}
                          >
                            {notifyingUid === emp.uid ? 'Sending…' : 'Notify'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
