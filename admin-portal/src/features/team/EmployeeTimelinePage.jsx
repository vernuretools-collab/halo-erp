import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useTeamStore } from './stores/teamStore'
import { getEmployees } from './services/teamService'
import {
  fetchEmployeeTimelineEntries,
  getWeekDates,
  toDateStr,
} from './services/timelineService'
import { TeamSubNav } from './components/TeamSubNav'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
} from 'lucide-react'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TARGET_DAY_HOURS = 8

function formatHours(hours) {
  const n = Number(hours) || 0
  if (n === 0) return '0h'
  if (Number.isInteger(n)) return `${n}h`
  return `${n}h`
}

function TimelineEntryCard({ entry }) {
  const type = entry.entryType === 'upskilling' ? 'upskilling' : 'work'
  return (
    <div className="rounded-xl bg-canvas border border-border p-2.5">
      <p className="w-full text-xs text-slate-800 dark:text-fg leading-snug break-words whitespace-pre-wrap">
        {entry.description}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          className={`text-[10px] ${
            type === 'upskilling'
              ? 'text-violet-500 dark:text-violet-400'
              : 'text-muted'
          }`}
        >
          {type === 'upskilling' ? 'Upskilling' : 'Work'}
        </p>
        <span className="shrink-0 text-[10px] font-semibold text-muted bg-slate-200/80 dark:bg-slate-700/80 rounded-md px-1.5 py-0.5">
          {formatHours(entry.hours)}
        </span>
      </div>
    </div>
  )
}

function weekRangeLabel(days) {
  if (!days?.length) return ''
  const start = days[0]
  const end = days[days.length - 1]
  const opts = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString([], opts)
  const endStr = end.toLocaleDateString([], {
    ...opts,
    year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined,
  })
  const year =
    start.getFullYear() === end.getFullYear() ? `, ${start.getFullYear()}` : ''
  return `${startStr} – ${endStr}${year}`
}

export function EmployeeTimelinePage() {
  const { employees, setEmployees } = useTeamStore()
  const [searchParams, setSearchParams] = useSearchParams()

  const [selectedUid, setSelectedUid] = useState(() => searchParams.get('uid') || '')
  const [weekAnchor, setWeekAnchor] = useState(() => new Date())
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)

  const weekDays = useMemo(() => getWeekDates(weekAnchor), [weekAnchor])

  useEffect(() => {
    getEmployees().then((emps) => {
      if (emps?.length) setEmployees(emps)
    }).catch(() => {})
  }, [setEmployees])

  // Initialize selection once (from URL, else first employee). Do not sync URL → state
  // on every selectedUid change — that races the dropdown and snaps back to the old uid.
  useEffect(() => {
    if (selectedUid || employees.length === 0) return
    const fromQuery = searchParams.get('uid')
    if (fromQuery && employees.some((e) => (e.uid || e.employeeId) === fromQuery)) {
      setSelectedUid(fromQuery)
    } else {
      setSelectedUid(employees[0].uid || employees[0].employeeId || '')
    }
  }, [employees, selectedUid, searchParams])

  useEffect(() => {
    if (!selectedUid) return
    if (searchParams.get('uid') === selectedUid) return
    setSearchParams({ uid: selectedUid }, { replace: true })
  }, [selectedUid, searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedUid) {
      setEntries([])
      return
    }

    const startDate = toDateStr(weekDays[0])
    const endDate = toDateStr(weekDays[weekDays.length - 1])
    let cancelled = false

    setLoading(true)
    fetchEmployeeTimelineEntries(selectedUid, startDate, endDate).then((data) => {
      if (!cancelled) {
        setEntries(data)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [selectedUid, weekDays])

  const shiftWeek = (delta) => {
    const next = new Date(weekAnchor)
    next.setDate(next.getDate() + delta * 7)
    setWeekAnchor(next)
  }

  const entriesByDate = useMemo(() => {
    const map = {}
    for (const day of weekDays) {
      map[toDateStr(day)] = []
    }
    for (const entry of entries) {
      if (!map[entry.date]) map[entry.date] = []
      map[entry.date].push(entry)
    }
    return map
  }, [entries, weekDays])

  const weekTotal = useMemo(
    () => entries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0),
    [entries]
  )

  const selectedEmployee = employees.find(
    (e) => (e.uid || e.employeeId) === selectedUid
  )
  const todayStr = toDateStr(new Date())

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <PageHeader
          title="Employee Work Timeline"
          description="View what each employee logged for Mon–Sat"
        />
        <TeamSubNav />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedUid}
            onChange={(e) => setSelectedUid(e.target.value)}
            className="bg-canvas border border-border text-sm text-fg rounded-xl px-3 py-2 focus:outline-none min-w-[200px]"
          >
            {employees.length === 0 && (
              <option value="">No employees</option>
            )}
            {employees.map((emp) => {
              const id = emp.uid || emp.employeeId
              const name = emp.displayName || emp.name || emp.email || 'Employee'
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              )
            })}
          </select>

          <Button
            variant="outline"
            size="sm"
            icon={ChevronLeft}
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
          />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas/60 border border-slate-200 dark:border-slate-700">
            <CalendarDays className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-slate-800 dark:text-fg">
              {weekRangeLabel(weekDays)}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={ChevronRight}
            onClick={() => shiftWeek(1)}
            aria-label="Next week"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekAnchor(new Date())}
          >
            This week
          </Button>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted">
          <Clock className="w-4 h-4 text-accent" />
          <span>
            {selectedEmployee
              ? `${selectedEmployee.displayName || selectedEmployee.name}: `
              : ''}
            Week total:{' '}
            <strong className="text-fg">
              {formatHours(weekTotal)}
            </strong>
          </span>
        </div>
      </div>

      {/* Read-only Mon–Sat grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {weekDays.map((day, idx) => {
          const dateStr = toDateStr(day)
          const dayEntries = entriesByDate[dateStr] || []
          const dayTotal = dayEntries.reduce(
            (sum, e) => sum + (Number(e.hours) || 0),
            0
          )
          const isToday = dateStr === todayStr
          const isFullDay = dayTotal >= TARGET_DAY_HOURS

          return (
            <Card
              key={dateStr}
              className={`flex flex-col min-h-[260px] p-3 border ${
                isToday
                  ? 'border-accent/30/50 ring-1 ring-accent/20'
                  : 'border-border'
              }`}
            >
              <div className="mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isToday
                          ? 'text-accent'
                          : 'text-fg'
                      }`}
                    >
                      {DAY_LABELS[idx]} {day.getDate()}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">View only</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 border ${
                      isFullDay
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-400/60 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'text-muted border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {formatHours(dayTotal)} of {TARGET_DAY_HOURS}h
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-72">
                {loading ? (
                  <p className="text-[11px] text-slate-400 py-4 text-center">Loading…</p>
                ) : dayEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-8 text-[11px] text-slate-400 text-center">
                    No entries
                  </div>
                ) : (
                  dayEntries.map((entry) => (
                    <TimelineEntryCard key={entry.entryId} entry={entry} />
                  ))
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
