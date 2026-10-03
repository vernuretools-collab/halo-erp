import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Save, Search } from 'lucide-react'
import {
  getScrumConductor,
  listActiveEmployees,
  listMarkedScrumDays,
  listScrumForDate,
  saveEmployeeScrumDay,
  saveScrumConductor,
} from './scrumService.js'
import {
  calendarCells,
  formatLongDate,
  formatMonthLabel,
  hasScrumNotes,
  isFutureDay,
  matchesEmployeeSearch,
  scrumHasStarted,
  todayISO,
  yesterdayISO,
} from './scrumModel.js'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const fieldClass =
  'w-full min-h-[88px] px-3 py-2 text-sm rounded-xl bg-canvas border border-border text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-y leading-relaxed'

function emptyDraft() {
  return { morningScrum: '', eodUpdate: '', dirty: false, exists: false, saving: false, error: '' }
}

function draftsFromRecords(employees, records) {
  const next = {}
  for (const employee of employees) {
    const record = records.get(employee.id)
    next[employee.id] = {
      morningScrum: record?.morningScrum || '',
      eodUpdate: record?.eodUpdate || '',
      dirty: false,
      exists: Boolean(record),
      saving: false,
      error: '',
    }
  }
  return next
}

export function ScrumPage({ canAssignConductor = true }) {
  const initialNow = useRef(new Date()).current
  const [now, setNow] = useState(initialNow)
  const [employees, setEmployees] = useState([])
  const [employeesReady, setEmployeesReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => todayISO(initialNow))
  const [viewYear, setViewYear] = useState(initialNow.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialNow.getMonth())
  const [followToday, setFollowToday] = useState(true)
  const [markedDays, setMarkedDays] = useState(() => new Set())
  const [drafts, setDrafts] = useState({})
  const [dayLoading, setDayLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [savingAll, setSavingAll] = useState(false)
  const [conductorId, setConductorId] = useState('')
  const [savingConductor, setSavingConductor] = useState(false)
  const [conductorError, setConductorError] = useState('')

  const draftsRef = useRef(drafts)
  const employeesRef = useRef(employees)
  const selectedDateRef = useRef(selectedDate)
  const followTodayRef = useRef(followToday)
  const dayRequestRef = useRef(0)

  useEffect(() => {
    draftsRef.current = drafts
  }, [drafts])
  useEffect(() => {
    employeesRef.current = employees
  }, [employees])
  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])
  useEffect(() => {
    followTodayRef.current = followToday
  }, [followToday])

  const refreshMarks = useCallback(async (year, monthIndex) => {
    const marked = await listMarkedScrumDays(year, monthIndex)
    setMarkedDays(marked)
  }, [])

  useEffect(() => {
    if (!canAssignConductor) return undefined
    let cancelled = false
    getScrumConductor()
      .then((conductor) => {
        if (!cancelled) setConductorId(conductor?.employeeId || '')
      })
      .catch(() => {
        if (!cancelled) setConductorId('')
      })
    return () => {
      cancelled = true
    }
  }, [canAssignConductor])

  useEffect(() => {
    let cancelled = false
    listActiveEmployees()
      .then((rows) => {
        if (cancelled) return
        setEmployees(rows)
        setEmployeesReady(true)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err?.message || 'Could not load employees.')
        setEmployeesReady(true)
        setDayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!employeesReady) return undefined
    const requestId = dayRequestRef.current + 1
    dayRequestRef.current = requestId
    let cancelled = false
    setDayLoading(true)
    setLoadError('')
    listScrumForDate(selectedDate)
      .then((records) => {
        if (cancelled || dayRequestRef.current !== requestId) return
        setDrafts(draftsFromRecords(employees, records))
      })
      .catch((err) => {
        if (cancelled || dayRequestRef.current !== requestId) return
        setLoadError(err?.message || 'Could not load this day.')
        setDrafts(draftsFromRecords(employees, new Map()))
      })
      .finally(() => {
        if (!cancelled && dayRequestRef.current === requestId) setDayLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [employees, employeesReady, selectedDate])

  useEffect(() => {
    let cancelled = false
    listMarkedScrumDays(viewYear, viewMonth)
      .then((marked) => {
        if (!cancelled) setMarkedDays(marked)
      })
      .catch(() => {
        if (!cancelled) setMarkedDays(new Set())
      })
    return () => {
      cancelled = true
    }
  }, [viewYear, viewMonth])

  const persistEmployee = useCallback(async (employee, dateISO, draft) => {
    if (!draft?.dirty) return
    const morning = draft.morningScrum
    const eod = draft.eodUpdate
    if (!draft.exists && !hasScrumNotes({ morningScrum: morning, eodUpdate: eod })) {
      setDrafts((prev) => {
        const current = prev[employee.id]
        if (!current) return prev
        return { ...prev, [employee.id]: { ...current, dirty: false, error: '' } }
      })
      return
    }
    if (isFutureDay(dateISO)) return
    setDrafts((prev) => ({
      ...prev,
      [employee.id]: { ...(prev[employee.id] || draft), saving: true, error: '' },
    }))
    try {
      await saveEmployeeScrumDay({
        employee,
        dateISO,
        morningScrum: morning,
        eodUpdate: eod,
      })
      if (selectedDateRef.current === dateISO) {
        setDrafts((prev) => {
          const current = prev[employee.id]
          if (!current) return prev
          const unchanged = current.morningScrum === morning && current.eodUpdate === eod
          return {
            ...prev,
            [employee.id]: {
              ...current,
              saving: false,
              error: '',
              exists: true,
              dirty: unchanged ? false : current.dirty,
            },
          }
        })
      }
      const parsed = dateISO.split('-').map(Number)
      if (parsed[0] === viewYear && parsed[1] - 1 === viewMonth) {
        refreshMarks(viewYear, viewMonth).catch(() => {})
      }
    } catch (err) {
      if (selectedDateRef.current === dateISO) {
        setDrafts((prev) => ({
          ...prev,
          [employee.id]: {
            ...(prev[employee.id] || draft),
            saving: false,
            error: err?.message || 'Could not save this day.',
          },
        }))
      }
      throw err
    }
  }, [refreshMarks, viewMonth, viewYear])

  const persistDirty = useCallback(async (dateISO) => {
    const pending = employeesRef.current.filter((employee) => draftsRef.current[employee.id]?.dirty)
    for (const employee of pending) {
      await persistEmployee(employee, dateISO, draftsRef.current[employee.id])
    }
  }, [persistEmployee])

  const openDay = useCallback(async (iso, { follow = false } = {}) => {
    if (!iso || isFutureDay(iso, new Date())) return
    if (iso === selectedDateRef.current) {
      setFollowToday(follow || iso === todayISO())
      return
    }
    try {
      await persistDirty(selectedDateRef.current)
    } catch (err) {
      setLoadError(err?.message || 'Save this day before opening another.')
      return
    }
    const parsed = iso.split('-').map(Number)
    setFollowToday(follow || iso === todayISO())
    setViewYear(parsed[0])
    setViewMonth(parsed[1] - 1)
    setSelectedDate(iso)
  }, [persistDirty])

  useEffect(() => {
    const timer = setInterval(() => {
      const nextNow = new Date()
      setNow(nextNow)
      const nextToday = todayISO(nextNow)
      if (followTodayRef.current && nextToday !== selectedDateRef.current) {
        openDay(nextToday, { follow: true }).catch((err) => {
          setLoadError(err?.message || 'Could not open the new day.')
        })
      }
    }, 15000)
    return () => clearInterval(timer)
  }, [openDay])

  const visibleEmployees = useMemo(
    () => employees.filter((employee) => matchesEmployeeSearch(employee, search)),
    [employees, search],
  )

  const dirtyCount = visibleEmployees.filter((employee) => drafts[employee.id]?.dirty).length
  const today = todayISO(now)
  const yesterday = yesterdayISO(now)
  const cells = calendarCells(viewYear, viewMonth)
  const started = scrumHasStarted(now)
  const viewingToday = selectedDate === today

  function updateField(employeeId, field, value) {
    setDrafts((prev) => {
      const current = prev[employeeId] || emptyDraft()
      const next = {
        ...prev,
        [employeeId]: { ...current, [field]: value, dirty: true, error: '' },
      }
      draftsRef.current = next
      return next
    })
  }

  async function saveRow(employee) {
    const draft = draftsRef.current[employee.id]
    if (!draft?.dirty) return
    try {
      await persistEmployee(employee, selectedDateRef.current, draft)
    } catch {
      /* row error is stored on the draft */
    }
  }

  async function saveVisible() {
    setSavingAll(true)
    try {
      await persistDirty(selectedDateRef.current)
    } catch (err) {
      setLoadError(err?.message || 'Could not save this day.')
    } finally {
      setSavingAll(false)
    }
  }

  async function changeConductor(nextId) {
    const previous = conductorId
    setConductorId(nextId)
    setSavingConductor(true)
    setConductorError('')
    try {
      const employee = employees.find((row) => row.id === nextId) || null
      await saveScrumConductor(employee)
    } catch (err) {
      setConductorId(previous)
      setConductorError(err?.message || 'Could not update who conducts scrum.')
    } finally {
      setSavingConductor(false)
    }
  }

  function shiftMonth(delta) {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="text-left">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fg tracking-tight">Scrum</h1>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            One row per active employee. Morning scrum starts at 10:30 AM. At 12:00 AM the board
            opens a new day with empty notes. Earlier days stay saved.
          </p>
          {canAssignConductor ? (
            <label className="block mt-3 max-w-sm">
              <span className="block text-xs font-semibold text-fg mb-1.5">Conduct scrum</span>
              <select
                value={conductorId}
                disabled={!employeesReady || savingConductor}
                onChange={(event) => changeConductor(event.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl bg-canvas border border-border text-fg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="">None</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}{employee.email ? ` · ${employee.email}` : ''}
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-muted mt-1">
                {conductorId
                  ? 'Only this employee sees Scrum in their portal. Choose someone else when they are absent.'
                  : 'Choose an employee to conduct scrum while admin is absent.'}
              </span>
              {conductorError && (
                <span className="block text-[11px] text-rose-600 dark:text-rose-400 mt-1">{conductorError}</span>
              )}
            </label>
          ) : (
            <p className="text-xs text-muted mt-2">You are conducting scrum for the team.</p>
          )}
        </div>
        <button
          type="button"
          onClick={saveVisible}
          disabled={savingAll || dirtyCount === 0 || dayLoading}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-accent text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {savingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save day
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4 mb-4">
        <section className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="w-8 h-8 rounded-lg border border-border text-muted hover:text-fg hover:bg-canvas cursor-pointer inline-flex items-center justify-center"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-sm font-semibold text-fg">{formatMonthLabel(viewYear, viewMonth)}</h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="w-8 h-8 rounded-lg border border-border text-muted hover:text-fg hover:bg-canvas cursor-pointer inline-flex items-center justify-center"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => openDay(yesterday)}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted hover:text-fg hover:bg-canvas cursor-pointer"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => openDay(today, { follow: true })}
              className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-accent-soft text-accent border border-accent/30 cursor-pointer"
            >
              Today
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((label) => (
              <div key={label} className="text-[10px] font-semibold uppercase tracking-wide text-muted py-1">
                {label}
              </div>
            ))}
            {cells.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} />
              const future = isFutureDay(cell.iso, now)
              const selected = cell.iso === selectedDate
              const isToday = cell.iso === today
              const marked = markedDays.has(cell.iso)
              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={future}
                  onClick={() => openDay(cell.iso)}
                  aria-label={`${future ? 'Closed' : 'Open'} ${formatLongDate(cell.iso)}`}
                  className={`relative h-9 rounded-lg text-xs font-semibold transition-colors ${
                    future
                      ? 'text-muted/40 cursor-not-allowed'
                      : selected
                        ? 'bg-accent text-white cursor-pointer'
                        : isToday
                          ? 'text-accent ring-1 ring-accent/40 hover:bg-accent-soft cursor-pointer'
                          : 'text-fg hover:bg-canvas cursor-pointer'
                  }`}
                >
                  {cell.day}
                  {marked && (
                    <span
                      className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                        selected ? 'bg-white' : 'bg-accent'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Days with notes are marked. Future days stay closed.
          </p>
        </section>

        <section className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-fg">{formatLongDate(selectedDate)}</h2>
              <p className="text-xs text-muted mt-1">
                {viewingToday
                  ? started
                    ? 'Morning scrum started at 10:30 AM. This day is open for notes.'
                    : 'Morning scrum starts at 10:30 AM. This day is open, and notes are still empty until you save them.'
                  : 'Showing this day’s morning scrum and end-of-day update only.'}
              </p>
            </div>
            <label className="relative block w-full md:w-72">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or email"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-canvas border border-border text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </label>
          </div>
          {loadError && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{loadError}</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted border-b border-border">
                  <th className="font-semibold py-2 pr-3 w-[22%]">Employee Name</th>
                  <th className="font-semibold py-2 pr-3 w-[34%]">Morning Scrum</th>
                  <th className="font-semibold py-2 pr-3 w-[34%]">EOD Update</th>
                  <th className="font-semibold py-2 w-[10%]" />
                </tr>
              </thead>
              <tbody>
                {!employeesReady || dayLoading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-sm text-muted">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading {formatLongDate(selectedDate)}
                      </span>
                    </td>
                  </tr>
                ) : visibleEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-sm text-muted">
                      {employees.length === 0
                        ? 'No active employees to show.'
                        : 'No employees match that name or email.'}
                    </td>
                  </tr>
                ) : (
                  visibleEmployees.map((employee) => {
                    const draft = drafts[employee.id] || emptyDraft()
                    return (
                      <tr key={employee.id} className="border-b border-border align-top">
                        <td className="py-3 pr-3">
                          <div className="text-sm font-semibold text-fg">{employee.name}</div>
                          {employee.email && (
                            <div className="text-xs text-muted mt-0.5 break-all">{employee.email}</div>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <textarea
                            value={draft.morningScrum}
                            onChange={(event) => updateField(employee.id, 'morningScrum', event.target.value)}
                            onBlur={() => saveRow(employee)}
                            rows={3}
                            placeholder="What are you working on this morning?"
                            className={fieldClass}
                          />
                        </td>
                        <td className="py-3 pr-3">
                          <textarea
                            value={draft.eodUpdate}
                            onChange={(event) => updateField(employee.id, 'eodUpdate', event.target.value)}
                            onBlur={() => saveRow(employee)}
                            rows={3}
                            placeholder="What was finished by end of day?"
                            className={fieldClass}
                          />
                        </td>
                        <td className="py-3">
                          <button
                            type="button"
                            onClick={() => saveRow(employee)}
                            disabled={!draft.dirty || draft.saving}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-border text-fg hover:bg-canvas disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          >
                            {draft.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Save
                          </button>
                          {draft.error && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{draft.error}</p>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
