import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { NativePickerInput } from '../../components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { TeamSubNav } from './components/TeamSubNav'
import { EmployeeAttendanceCalendar } from './components/EmployeeAttendanceCalendar'
import {
  getEmployees,
  getMonthlyReport,
  listMonthlyReports,
  generateEmployeeMonthlyReport,
  generateAllEmployeesMonthlyReports,
} from './services/teamService'
import {
  currentMonthStr,
  monthlyReportToCsv,
} from './services/monthlyReportEngine'
import { formatSecondsToHrsMins, formatTo12HourTime } from './services/attendanceStatsUtils'
import {
  RefreshCw,
  Download,
  Users,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react'

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function StatCard({ label, value, sub, icon: Icon, accent = 'indigo' }) {
  const accents = {
    indigo: 'bg-accent-soft text-accent',
    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    slate: 'bg-canvas text-muted',
    violet: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400',
  }
  return (
    <Card className="p-4 border-border flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accents[accent] || accents.indigo}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted">
          {label}
        </div>
        <div className="text-xl font-bold text-fg truncate">{value}</div>
        {sub ? <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div> : null}
      </div>
    </Card>
  )
}

export function EmployeeMonthlyReportPage() {
  const { employees, setEmployees } = useTeamStore()
  const { user } = useUserStore()
  const adminName = user?.displayName || user?.email || 'Admin'
  const [searchParams, setSearchParams] = useSearchParams()

  const initialMonth = searchParams.get('month') || currentMonthStr()
  const initialUid = searchParams.get('uid') || ''

  const [month, setMonth] = useState(initialMonth)
  const [selectedUid, setSelectedUid] = useState(initialUid)
  const [report, setReport] = useState(null)
  const [monthReports, setMonthReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    getEmployees().then((emps) => {
      if (emps?.length) setEmployees(emps)
    }).catch(() => {})
  }, [setEmployees])

  useEffect(() => {
    if (!selectedUid && employees.length > 0) {
      const fromQuery = searchParams.get('uid')
      if (fromQuery && employees.some((e) => (e.uid || e.employeeId) === fromQuery)) {
        setSelectedUid(fromQuery)
      } else {
        setSelectedUid(employees[0].uid || employees[0].employeeId || '')
      }
    }
  }, [employees, selectedUid, searchParams])

  // Sync URL when month/uid change
  useEffect(() => {
    const next = {}
    if (selectedUid) next.uid = selectedUid
    if (month) next.month = month
    setSearchParams(next, { replace: true })
  }, [selectedUid, month, setSearchParams])

  const selectedEmployee = useMemo(
    () => employees.find((e) => (e.uid || e.employeeId) === selectedUid),
    [employees, selectedUid]
  )

  const accountStartDate = useMemo(() => {
    const emp = selectedEmployee
    if (!emp) return null
    const raw = emp.joinedAt || emp.createdAt
    if (!raw) return null
    if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10)
    if (typeof raw?.toDate === 'function') {
      try {
        const d = raw.toDate()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      } catch {
        return null
      }
    }
    if (typeof raw?.seconds === 'number') {
      const d = new Date(raw.seconds * 1000)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [selectedEmployee])

  const todayStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  const loadStored = useCallback(async () => {
    if (!selectedUid || !month) {
      setReport(null)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [stored, list] = await Promise.all([
        getMonthlyReport(selectedUid, month),
        listMonthlyReports({ month }),
      ])
      setReport(stored)
      setMonthReports(list || [])
    } catch (err) {
      console.error(err)
      setError('Unable to load monthly report.')
    } finally {
      setLoading(false)
    }
  }, [selectedUid, month])

  useEffect(() => {
    loadStored()
  }, [loadStored])

  const handleGenerate = async () => {
    if (!selectedEmployee || !month) return
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      const saved = await generateEmployeeMonthlyReport(selectedEmployee, month, adminName)
      setReport(saved)
      setMessage(`Report generated for ${saved.displayName} (${month}).`)
      const list = await listMonthlyReports({ month })
      setMonthReports(list || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to generate report.')
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerateAll = async () => {
    if (!month) return
    setGeneratingAll(true)
    setError('')
    setMessage('')
    try {
      const results = await generateAllEmployeesMonthlyReports(month, adminName)
      setMonthReports(results || [])
      setMessage(`Generated ${results.length} employee report(s) for ${month}.`)
      if (selectedUid) {
        const mine = results.find((r) => r.uid === selectedUid)
        if (mine) setReport(mine)
        else {
          const stored = await getMonthlyReport(selectedUid, month)
          setReport(stored)
        }
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to generate all reports.')
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleExportCsv = () => {
    if (!report) return
    const csv = monthlyReportToCsv(report)
    downloadCsv(`${report.displayName || 'employee'}_${report.month}_report.csv`, csv)
  }

  const att = report?.attendance || {}
  const leave = report?.leave || {}
  const timeline = report?.timeline || {}

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title="Employee Monthly Reports"
          description="View and generate month-wise attendance, leave, work hours, and timeline reports per employee"
        />
        <TeamSubNav />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted font-medium">Month</label>
          <NativePickerInput
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-canvas border border-border text-sm text-fg rounded-xl px-3 py-2 focus:outline-none"
          />
          <label className="text-xs text-muted font-medium ml-2">Employee</label>
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="bg-canvas border border-border text-sm text-fg rounded-xl px-3 py-2 focus:outline-none min-w-[200px]"
          >
            {employees.length === 0 && <option value="">No employees</option>}
            {employees.map((emp) => {
              const id = emp.uid || emp.employeeId
              return (
                <option key={id} value={id}>
                  {emp.displayName || emp.name || emp.email || 'Employee'}
                </option>
              )
            })}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={generating ? Loader2 : RefreshCw}
            onClick={handleGenerate}
            disabled={generating || !selectedEmployee}
          >
            {generating ? 'Generating…' : 'Generate / Refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={generatingAll ? Loader2 : Users}
            onClick={handleGenerateAll}
            disabled={generatingAll}
          >
            {generatingAll ? 'Generating all…' : 'Generate All'}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Download}
            onClick={handleExportCsv}
            disabled={!report}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-3 border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </Card>
      )}
      {message && (
        <Card className="p-3 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {message}
        </Card>
      )}

      {loading ? (
        <Card className="p-12 flex items-center justify-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading report…
        </Card>
      ) : !report ? (
        <div className="space-y-4">
          <Card className="p-10 text-center border-dashed border-border space-y-3">
            <FileText className="w-10 h-10 mx-auto text-slate-400" />
            <p className="text-sm text-muted font-medium">
              No stored report for this employee and month.
            </p>
            <p className="text-xs text-slate-400">
              Click <strong>Generate / Refresh</strong> to aggregate attendance, leave, and timeline data and save a snapshot.
            </p>
          </Card>
          {selectedUid && (
            <div className="max-w-md">
              <EmployeeAttendanceCalendar
                employeeUid={selectedUid}
                employeeEmail={selectedEmployee?.email || ''}
                employeeName={selectedEmployee?.displayName || selectedEmployee?.name || ''}
                employee={selectedEmployee}
                month={month}
                accountStartDate={accountStartDate}
              />
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-fg">
                {report.displayName}
                <span className="text-slate-400 font-normal"> · {report.month}</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {report.departmentName || '—'} · Status:{' '}
                <Badge variant={report.status === 'final' ? 'success' : 'warning'}>
                  {report.status || 'draft'}
                </Badge>
                {report.generatedAt ? ` · Generated ${new Date(report.generatedAt).toLocaleString()}` : ''}
                {report.generatedBy ? ` by ${report.generatedBy}` : ''}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Present"
              value={att.presentDays ?? 0}
              sub={`of ${att.workingDays ?? 0} working days (WFH counts as present)`}
              icon={CheckCircle2}
              accent="emerald"
            />
            <StatCard
              label="Late"
              value={att.lateDays ?? 0}
              sub="after 10:40 AM (10 min grace)"
              icon={AlertCircle}
              accent="amber"
            />
            <StatCard
              label="Absent"
              value={att.absentDays ?? 0}
              sub={`${att.attendancePercentage ?? 0}% attendance`}
              icon={Users}
              accent="rose"
            />
            <StatCard
              label="Leave / PTO"
              value={leave.approvedDays ?? 0}
              sub={`${leave.pendingDays ?? 0} pending`}
              icon={Calendar}
              accent="indigo"
            />
            <StatCard
              label="LOP (unpaid)"
              value={leave.lopDays ?? leave.unpaidLeaveDays ?? 0}
              sub={`${leave.unpaidDays ?? 0} unpaid days for salary (LOP + absent)`}
              icon={AlertCircle}
              accent="violet"
            />
            <StatCard
              label="Avg Hours"
              value={att.avgHours || '0h 0m'}
              sub={`Total ${att.totalRegularHoursLabel || formatSecondsToHrsMins(att.totalRegularSeconds)}`}
              icon={Clock}
              accent="slate"
            />
            <StatCard
              label="Timeline"
              value={`${timeline.totalHours ?? 0}h`}
              sub={`${timeline.entryCount ?? 0} entries`}
              icon={FileText}
              accent="indigo"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <EmployeeAttendanceCalendar
              employeeUid={selectedUid}
              employeeEmail={selectedEmployee?.email || ''}
              employeeName={selectedEmployee?.displayName || selectedEmployee?.name || report.displayName || ''}
              employee={selectedEmployee}
              month={month}
              accountStartDate={accountStartDate}
            />

            <Card className="p-4 border-border space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Averages</h4>
              <div className="text-sm text-fg space-y-1.5">
                <div className="flex justify-between"><span>Avg check-in</span><span className="font-mono">{att.avgCheckIn || '—'}</span></div>
                <div className="flex justify-between"><span>Avg check-out</span><span className="font-mono">{att.avgCheckOut || '—'}</span></div>
                <div className="flex justify-between"><span>Extra hours</span><span className="font-mono">{att.totalExtraHoursLabel || '0h 0m'}</span></div>
                <div className="flex justify-between"><span>On duty days</span><span>{att.onDutyDays ?? 0}</span></div>
                <div className="flex justify-between"><span>On-time days</span><span>{att.onTimeDays ?? 0}</span></div>
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted pt-3">Leave by type</h4>
              {Object.keys(leave.byType || {}).length === 0 ? (
                <p className="text-xs text-slate-400">No approved leave this month</p>
              ) : (
                <div className="space-y-1">
                  {Object.entries(leave.byType).map(([type, days]) => (
                    <div key={type} className="flex justify-between text-sm text-fg">
                      <span>{type}</span>
                      <span className="font-semibold">{days}d</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="overflow-x-auto p-0 border-border lg:col-span-2">
              <div className="px-4 py-3 border-b border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Daily breakdown</h4>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-canvas/80 text-muted text-left">
                    <th className="p-3 font-semibold">Date</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Clock in</th>
                    <th className="p-3 font-semibold">Clock out</th>
                    <th className="p-3 font-semibold">Hours</th>
                    <th className="p-3 font-semibold">Late</th>
                    <th className="p-3 font-semibold">Leave</th>
                    <th className="p-3 font-semibold">Timeline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(report.daily || []).map((row) => (
                    <tr key={row.date} className="text-fg">
                      <td className="p-3 font-medium whitespace-nowrap">{row.date}</td>
                      <td className="p-3">
                        {row.present ? (
                          <Badge variant="success">{row.onDuty ? 'On Duty' : 'Present'}</Badge>
                        ) : row.leaveType ? (
                          <Badge variant="warning">Leave</Badge>
                        ) : row.isFuture ||
                          row.isBeforeJoin ||
                          row.date > todayStr ||
                          (accountStartDate && row.date < accountStartDate) ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <Badge variant="danger">Absent</Badge>
                        )}
                      </td>
                      <td className="p-3 font-mono">{formatTo12HourTime(row.clockInTime) || '—'}</td>
                      <td className="p-3 font-mono">{formatTo12HourTime(row.clockOutTime) || '—'}</td>
                      <td className="p-3 font-mono">{formatSecondsToHrsMins(row.regularSeconds)}</td>
                      <td className="p-3">
                        {row.late ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            {row.lateMinutes}m
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3">{row.leaveType || '—'}</td>
                      <td className="p-3">{row.timelineHours ? `${row.timelineHours}h` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}

      {/* Month roster summary */}
      <Card className="overflow-x-auto p-0 border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted">
            All stored reports · {month}
          </h4>
          <span className="text-[11px] text-slate-400">{monthReports.length} snapshot(s)</span>
        </div>
        {monthReports.length === 0 ? (
          <p className="p-6 text-xs text-slate-400 text-center">
            No snapshots yet. Use Generate All to create reports for every employee.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-canvas/80 text-muted text-left">
                <th className="p-3 font-semibold">Employee</th>
                <th className="p-3 font-semibold">Present</th>
                <th className="p-3 font-semibold">Late</th>
                <th className="p-3 font-semibold">Leave</th>
                <th className="p-3 font-semibold">Avg hours</th>
                <th className="p-3 font-semibold">Timeline</th>
                <th className="p-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {monthReports.map((r) => (
                <tr
                  key={r.id || `${r.uid}_${r.month}`}
                  className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                    r.uid === selectedUid ? 'bg-accent-soft ' : ''
                  }`}
                  onClick={() => setSelectedUid(r.uid)}
                >
                  <td className="p-3 font-semibold text-fg">{r.displayName}</td>
                  <td className="p-3">{r.attendance?.presentDays ?? '—'}</td>
                  <td className="p-3 text-amber-600 dark:text-amber-400">{r.attendance?.lateDays ?? '—'}</td>
                  <td className="p-3">{r.leave?.approvedDays ?? '—'}</td>
                  <td className="p-3 font-mono">{r.attendance?.avgHours || '—'}</td>
                  <td className="p-3">{r.timeline?.totalHours ?? '—'}h</td>
                  <td className="p-3">
                    <Badge variant={r.status === 'final' ? 'success' : 'warning'}>{r.status || 'draft'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
