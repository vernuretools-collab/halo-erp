import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import {
  formatClockLabel,
  formatDayLabel,
  fromIstInput,
  isBeforeTodayIst,
  isRush,
  kolkataParts,
  reelDeadlines,
  weekMonday,
} from '../../../../shared/reels/deadlines.js'
import { nextReelId, planReel } from '../../../../shared/reels/reelService.js'
import { clientCodeFromName, clientProjectOptions, FIELD, personId, personName, projectOptionLabel } from './reelsUi'

const emptyForm = () => ({
  projectId: '',
  title: '',
  brief: '',
  golive: '',
  editorId: '',
  rawFootageUrl: '',
  platforms: '',
  collaborators: '',
  rushReason: '',
})

function sameWeek(a, b) {
  return weekMonday(a).getTime() === weekMonday(b).getTime()
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseGolive(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '')
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }
}

function formatGolive({ year, month, day, hour, minute }) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hour)}:${pad(minute)}`
}

function goliveLabel(value) {
  const date = fromIstInput(value)
  if (!date) return ''
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function GoLiveField({ value, onChange }) {
  const parsed = parseGolive(value)
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState(null)
  const today = new Date()
  const [viewYear, setViewYear] = useState(parsed?.year || today.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth())
  const [clock, setClock] = useState({ hour: parsed?.hour ?? 10, minute: parsed?.minute ?? 0 })

  useEffect(() => {
    const current = parseGolive(value)
    if (!current) return
    setClock({ hour: current.hour, minute: current.minute })
  }, [value])

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const place = () => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const height = 380
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < height && rect.top > height ? rect.top - height - 4 : rect.bottom + 4
    setBox({ top, left: rect.left, width: Math.max(rect.width, 288) })
  }

  const openPicker = () => {
    const now = new Date()
    setViewYear(parsed?.year || now.getFullYear())
    setViewMonth(parsed?.month ?? now.getMonth())
    place()
    setOpen(true)
  }

  const write = (nextClock, dayParts = parsed) => {
    if (!dayParts) {
      setClock(nextClock)
      return
    }
    setClock(nextClock)
    onChange(formatGolive({ ...dayParts, hour: nextClock.hour, minute: nextClock.minute }))
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const todayParts = kolkataParts(new Date())
  const todayKey = todayParts.y * 10000 + (todayParts.m + 1) * 100 + todayParts.d
  const viewingCurrentOrEarlier = viewYear < todayParts.y || (viewYear === todayParts.y && viewMonth <= todayParts.m)
  const hour12 = clock.hour % 12 || 12
  const period = clock.hour >= 12 ? 'PM' : 'AM'

  const setPeriod = (nextPeriod) => {
    const base = clock.hour % 12
    write({ ...clock, hour: nextPeriod === 'PM' ? base + 12 : base })
  }

  const shiftMonth = (delta) => {
    const next = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`${FIELD} flex cursor-pointer items-center justify-between text-left ${value ? '' : 'text-muted'}`}
      >
        <span>{goliveLabel(value) || 'Choose date'}</span>
        <Calendar className="h-4 w-4 shrink-0 text-accent" />
      </button>
      <input className="sr-only" tabIndex={-1} value={value} required onChange={() => {}} />
      {open && box && (
        <div
          className="fixed z-[60] rounded-xl border border-border bg-surface p-3 text-fg shadow-lg"
          style={{ top: box.top, left: box.left, width: box.width }}
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" disabled={viewingCurrentOrEarlier} className="cursor-pointer rounded-lg p-1 hover:bg-chrome disabled:cursor-not-allowed disabled:opacity-30" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium">{MONTHS[viewMonth]} {viewYear}</p>
            <button type="button" aria-label="Next month" className="cursor-pointer rounded-lg p-1 hover:bg-chrome" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const selected = parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === day
              const past = viewYear * 10000 + (viewMonth + 1) * 100 + day < todayKey
              return (
                <button
                  key={day}
                  type="button"
                  disabled={past}
                  onClick={() => write(clock, { year: viewYear, month: viewMonth, day })}
                  className={`h-8 rounded-md text-sm ${
                    past
                      ? 'cursor-not-allowed text-muted/40'
                      : selected
                        ? 'cursor-pointer bg-accent text-white'
                        : 'cursor-pointer hover:bg-chrome'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted">Time</span>
            <select
              aria-label="Hour"
              className={`${FIELD} cursor-pointer py-1`}
              value={hour12}
              onChange={(event) => {
                const nextHour = Number(event.target.value) % 12
                write({ ...clock, hour: period === 'PM' ? nextHour + 12 : nextHour })
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
            <select
              aria-label="Minute"
              className={`${FIELD} cursor-pointer py-1`}
              value={clock.minute}
              onChange={(event) => write({ ...clock, minute: Number(event.target.value) })}
            >
              {Array.from({ length: 12 }, (_, index) => index * 5).map((minute) => (
                <option key={minute} value={minute}>{String(minute).padStart(2, '0')}</option>
              ))}
            </select>
            <button type="button" className={`cursor-pointer rounded-lg px-2 py-1 ${period === 'AM' ? 'bg-accent text-white' : 'hover:bg-chrome'}`} onClick={() => setPeriod('AM')}>AM</button>
            <button type="button" className={`cursor-pointer rounded-lg px-2 py-1 ${period === 'PM' ? 'bg-accent text-white' : 'hover:bg-chrome'}`} onClick={() => setPeriod('PM')}>PM</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PlanReelDialog({ open, onClose, projects, employees, reels, onPlanned }) {
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)
  const [form, setForm] = useState(emptyForm)
  const [previewId, setPreviewId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const editors = useMemo(() => employees.filter((emp) => emp.qcEditor === true), [employees])
  const clientOptions = useMemo(() => clientProjectOptions(projects), [projects])
  const project = clientOptions.find((item) => (item.projectId || item.id) === form.projectId)
  const clientCode = project?.reelPrefix || clientCodeFromName(project?.clientName)
  const goliveDate = fromIstInput(form.golive)
  const deadlines = goliveDate ? reelDeadlines(goliveDate) : null
  const rush = goliveDate ? isRush(goliveDate) : false

  useEffect(() => {
    if (!open) {
      setForm(emptyForm())
      setError('')
      setPreviewId('')
    }
  }, [open])

  useEffect(() => {
    if (!open || !form.projectId) return undefined
    let cancelled = false
    nextReelId(form.projectId, clientCode)
      .then((id) => {
        if (!cancelled) setPreviewId(id || '')
      })
      .catch(() => {
        if (!cancelled) setPreviewId('')
      })
    return () => {
      cancelled = true
    }
  }, [open, form.projectId, clientCode])

  const workloadLine = useMemo(() => {
    if (!deadlines) return ''
    const monday = weekMonday(deadlines.t5)
    const counts = new Map()
    reels.forEach((reel) => {
      if (!reel.t5 || !sameWeek(reel.t5, deadlines.t5)) return
      const name = reel.editor_name || 'Editor'
      counts.set(name, (counts.get(name) || 0) + 1)
    })
    const parts = [...counts.entries()].map(([name, count]) => `${name.split(' ')[0]} ${count}`)
    return `Editor workload, other first cuts due the week of ${formatDayLabel(monday)}: ${parts.join(' · ') || 'none yet'}`
  }, [deadlines, reels])

  if (!open) return null

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const editor = editors.find((emp) => personId(emp) === form.editorId)
      if (!goliveDate || isBeforeTodayIst(goliveDate)) throw new Error('Choose today or a later go-live.')
      const platforms = form.platforms.split(',').map((item) => item.trim()).filter(Boolean)
      if (!clientCode) throw new Error('This client name is too short to make a client code.')
      const id = await planReel({
        projectId: form.projectId,
        prefix: clientCode,
        title: form.title,
        brief: form.brief,
        rawFootageUrl: form.rawFootageUrl,
        editorId: form.editorId,
        editorName: editor ? personName(editor) : '',
        golive: goliveDate,
        platforms,
        collaborators: form.collaborators.split(',').map((item) => item.trim()).filter(Boolean),
        rushReason: form.rushReason,
        smmName: userDoc?.name || userDoc?.displayName || user?.displayName || '',
      })
      onClose()
      onPlanned(id)
    } catch (err) {
      setError(err.message || 'Could not plan this reel.')
    } finally {
      setSaving(false)
    }
  }

  const deadlineRows = deadlines
    ? [
        ['T-7', 'Editor assigned, brief + raw footage in', formatDayLabel(deadlines.t7), false],
        ['T-5', 'First cut uploaded', formatDayLabel(deadlines.t5), false],
        ['T-4', 'QC approved', formatDayLabel(deadlines.t4), false],
        ['T-3', 'Scheduled in Meta Business Suite', formatDayLabel(deadlines.t3), true],
        ['T', 'Live', formatClockLabel(goliveDate), false],
      ]
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-4">
      <form onSubmit={submit} className="my-8 w-full max-w-3xl rounded-2xl border border-border bg-surface p-5 text-fg [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Plan reel</h2>
          <button type="button" aria-label="Close" className="cursor-pointer rounded-lg p-1 text-muted hover:bg-chrome hover:text-fg" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Client</span>
            <select className={`${FIELD} cursor-pointer`} value={form.projectId} onChange={(e) => set({ projectId: e.target.value })} required>
              <option value="">Choose</option>
              {clientOptions.map((item) => (
                <option key={item.projectId || item.id} value={item.projectId || item.id}>
                  {projectOptionLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Reel</span>
            <input className={FIELD} readOnly value={previewId || clientCode || ''} />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block text-muted">Title</span>
            <input className={FIELD} value={form.title} onChange={(e) => set({ title: e.target.value })} required />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Go-live</span>
            <GoLiveField value={form.golive} onChange={(golive) => set({ golive })} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Platforms</span>
            <input
              className={FIELD}
              value={form.platforms}
              placeholder="Instagram, Facebook"
              onChange={(e) => set({ platforms: e.target.value })}
              required
            />
          </label>
        </div>
        {deadlineRows.length > 0 && (
          <div className="mt-3 space-y-1 text-sm">
            {deadlineRows.map(([tag, label, when, strong]) => (
              <div key={tag} className={`flex items-baseline justify-between gap-4 ${strong ? 'font-semibold' : ''}`}>
                <p>
                  <span className="mr-3 inline-block w-8 text-muted">{tag}</span>
                  {label}
                </p>
                <p className="shrink-0 text-fg">{when}</p>
              </div>
            ))}
          </div>
        )}
        {rush && (
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-danger">Rush — go-live is under 72 hours. Reason required.</span>
            <input className={FIELD} value={form.rushReason} onChange={(e) => set({ rushReason: e.target.value })} required />
          </label>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted">Editor</span>
            <select className={`${FIELD} cursor-pointer`} value={form.editorId} onChange={(e) => set({ editorId: e.target.value })} required>
              <option value="">Choose</option>
              {editors.map((emp) => (
                <option key={personId(emp)} value={personId(emp)}>{personName(emp)}</option>
              ))}
            </select>
            {editors.length === 0 && (
              <span className="mt-1 block text-[11px] text-muted">No editors yet. Mark Editor on Team Management.</span>
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">Collaborators</span>
            <input className={FIELD} value={form.collaborators} placeholder="@shamini.heksh" onChange={(e) => set({ collaborators: e.target.value })} />
          </label>
        </div>
        {workloadLine && <p className="mt-3 text-xs text-accent">{workloadLine}</p>}
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted">Raw footage link</span>
          <input className={FIELD} value={form.rawFootageUrl} placeholder="https://" onChange={(e) => set({ rawFootageUrl: e.target.value })} required />
        </label>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-muted">Brief</span>
          <textarea className={FIELD} rows={3} value={form.brief} onChange={(e) => set({ brief: e.target.value })} />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="cursor-pointer rounded-lg px-4 py-2 text-sm text-muted" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className="cursor-pointer rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Saving…' : 'Plan reel'}
          </button>
        </div>
      </form>
    </div>
  )
}
