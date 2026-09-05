import React, { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useTimelineStore } from './stores/timelineStore'
import { getWeekDates, toDateStr } from './services/timelineService'
import { useUserStore } from '../../stores/userStore'
import { collectUserIdentityIds } from '../projects/services/projectService'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TARGET_DAY_HOURS = 8
const MINUTE_OPTIONS = ['00', '15', '30', '45']
const ENTRY_TYPES = [
  { id: 'work', label: 'Work' },
  { id: 'upskilling', label: 'Upskilling' },
]

/** Format decimal hours cleanly (e.g. 0 -> 0h, 8 -> 8h, 1.5 -> 1h 30m). */
function formatHours(hours) {
  const n = Number(hours) || 0
  const totalMinutes = Math.round(n * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Split decimal hours into integer hours + quarter minutes (snap nearest). */
function decimalToParts(decimalHours) {
  const n = Number(decimalHours) || 0
  const totalMinutes = Math.round(n * 60)
  const h = Math.floor(totalMinutes / 60)
  const rawMins = totalMinutes % 60
  const quarters = [0, 15, 30, 45]
  let nearest = quarters[0]
  let best = Math.abs(rawMins - nearest)
  for (const q of quarters) {
    const d = Math.abs(rawMins - q)
    if (d < best) {
      best = d
      nearest = q
    }
  }
  // If closer to 60 than to 45, roll into next hour
  if (Math.abs(rawMins - 60) < best) {
    return { hoursPart: String(Math.min(h + 1, 23)), minutesPart: '00' }
  }
  return {
    hoursPart: String(Math.min(Math.max(h, 0), 23)),
    minutesPart: String(nearest).padStart(2, '0'),
  }
}

function entryTypeLabel(entryType) {
  return entryType === 'upskilling' ? 'Upskilling' : 'Work'
}

function TimelineEntryCard({ entry, interactive = false, onEdit }) {
  const type = entry.entryType === 'upskilling' ? 'upskilling' : 'work'
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onEdit : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onEdit?.(e)
              }
            }
          : undefined
      }
      className={`rounded-xl bg-chrome border border-border p-2.5 ${
        interactive
          ? 'hover:border-accent/40 dark:hover:border-accent/40 transition-colors cursor-pointer'
          : ''
      }`}
    >
      <p className="w-full text-xs text-slate-800 dark:text-slate-100 leading-snug break-words line-clamp-4">
        {entry.description}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p
          className={`text-[10px] ${
            type === 'upskilling'
              ? 'text-violet-500 dark:text-violet-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {entryTypeLabel(type)}
        </p>
        <span className="shrink-0 text-[10px] font-semibold text-muted bg-slate-200/80 dark:bg-slate-700/80 rounded-md px-1.5 py-0.5 font-mono">
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

export const WorkTimelinePage = ({ embedded = false }) => {
  const { user, userDoc } = useUserStore()
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])
  const uid = identityIds[0] || userDoc?.uid || user?.uid
  const employeeName = userDoc?.displayName || user?.displayName || 'Employee'

  const {
    weekAnchor,
    entries,
    loading,
    shiftWeek,
    setWeekAnchor,
    loadWeekEntries,
    addEntry,
    editEntry,
    removeEntry,
  } = useTimelineStore()

  // Always derive week days from anchor (supports past weeks / past days)
  const weekDays = useMemo(() => getWeekDates(weekAnchor), [weekAnchor])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [editingEntry, setEditingEntry] = useState(null)
  const [entryType, setEntryType] = useState('work')
  const [description, setDescription] = useState('')
  const [hoursPart, setHoursPart] = useState('')
  const [minutesPart, setMinutesPart] = useState('00')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (identityIds.length) loadWeekEntries(identityIds)
  }, [identityIds, weekAnchor, loadWeekEntries])

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

  const durationPreview = useMemo(() => {
    const h = Number(hoursPart)
    const m = Number(minutesPart)
    if (hoursPart === '' || Number.isNaN(h) || Number.isNaN(m)) return '0h'
    return formatHours(h + m / 60)
  }, [hoursPart, minutesPart])

  const openAddModal = (dateStr, e) => {
    e?.stopPropagation?.()
    setSelectedDate(dateStr)
    setEditingEntry(null)
    setEntryType('work')
    setDescription('')
    setHoursPart('')
    setMinutesPart('00')
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (entry, e) => {
    e?.stopPropagation?.()
    const parts = decimalToParts(entry.hours)
    setSelectedDate(entry.date)
    setEditingEntry(entry)
    setEntryType(entry.entryType === 'upskilling' ? 'upskilling' : 'work')
    setDescription(entry.description || '')
    setHoursPart(parts.hoursPart)
    setMinutesPart(parts.minutesPart)
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingEntry(null)
    setEntryType('work')
    setDescription('')
    setHoursPart('')
    setMinutesPart('00')
    setFormError('')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!uid) {
      setFormError('You must be signed in to save entries.')
      return
    }

    const trimmed = description.trim()
    const h = Number(hoursPart)
    const m = Number(minutesPart)

    if (!trimmed) {
      setFormError(
        entryType === 'upskilling'
          ? 'Please describe what you are upskilling on.'
          : 'Please describe what you worked on.'
      )
      return
    }
    if (
      hoursPart === '' ||
      Number.isNaN(h) ||
      !Number.isInteger(h) ||
      h < 0 ||
      h > 23
    ) {
      setFormError('Enter hours as a whole number from 0 to 23.')
      return
    }
    if (!MINUTE_OPTIONS.includes(minutesPart)) {
      setFormError('Minutes must be 00, 15, 30, or 45.')
      return
    }
    const hours = h + m / 60
    if (hours <= 0) {
      setFormError('Duration must be greater than 0.')
      return
    }
    if (!selectedDate) {
      setFormError('No date selected.')
      return
    }

    setSaving(true)
    try {
      if (editingEntry) {
        const ok = await editEntry(editingEntry.entryId, {
          description: trimmed,
          hours,
          entryType,
        })
        if (!ok) {
          setFormError('Could not update entry. Try again.')
          return
        }
      } else {
        const created = await addEntry({
          uid,
          employeeName,
          date: selectedDate,
          description: trimmed,
          hours,
          entryType,
        })
        if (!created) {
          setFormError('Could not save entry. Try again.')
          return
        }
      }
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingEntry) return
    setSaving(true)
    try {
      await removeEntry(editingEntry.entryId)
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const todayStr = toDateStr(new Date())
  const targetLabel = formatHours(TARGET_DAY_HOURS)

  return (
    <div className="space-y-6">
      {!embedded ? (
        <PageHeader
          title="Work Timeline"
          description="Log what you worked on each day "
          actions={
            <Button
              icon={Plus}
              variant="primary"
              onClick={(e) => openAddModal(todayStr, e)}
            >
              Add Entry
            </Button>
          }
        />
      ) : (
        <div className="flex items-center justify-end">
          <Button
            icon={Plus}
            variant="primary"
            size="sm"
            onClick={(e) => openAddModal(todayStr, e)}
          >
            Add Entry
          </Button>
        </div>
      )}

      {/* Week navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={ChevronLeft}
            onClick={() => shiftWeek(-1)}
            aria-label="Previous week"
          />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-chrome/60 border border-border">
            <CalendarDays className="w-4 h-4 text-accent" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
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
            Week total:{' '}
            <strong className="text-fg font-mono">
              {formatHours(weekTotal)}
            </strong>
          </span>
        </div>
      </div>

      {/* Mon–Sat grid — all days support add/edit */}
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
              className={`flex flex-col min-h-[260px] !p-3 border transition-colors ${
                isToday
                  ? 'border-accent ring-1 ring-accent/20'
                  : 'border-border'
              }`}
            >
              <div className="w-full text-left mb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className={`text-xs font-bold uppercase tracking-wide ${
                        isToday
                          ? 'text-accent'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {DAY_LABELS[idx]} {day.getDate()}
                    </div>
                    {isToday ? (
                      <p className="text-[10px] text-accent/80 mt-0.5">Today</p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold font-mono rounded-full px-2 py-0.5 border ${
                      isFullDay
                        ? 'text-emerald-600 dark:text-emerald-400 border-emerald-400/60 bg-emerald-50 dark:bg-emerald-500/10'
                        : 'text-muted border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {formatHours(dayTotal)} of {targetLabel}
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto max-h-56">
                {loading && dayEntries.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-4 text-center">
                    Loading…
                  </p>
                ) : dayEntries.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border py-6 text-[11px] text-slate-400 text-center">
                    No entries yet
                  </div>
                ) : (
                  dayEntries.map((entry) => (
                    <TimelineEntryCard
                      key={entry.entryId}
                      entry={entry}
                      interactive
                      onEdit={(e) => openEditModal(entry, e)}
                    />
                  ))
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Plus}
                  className="w-full justify-center text-xs"
                  onClick={(e) => openAddModal(dateStr, e)}
                >
                  Add Entry
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-md bg-surface rounded-2xl border border-border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-fg">
                {editingEntry ? 'Edit entry' : 'Add entry'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-chrome cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted">
              {selectedDate &&
                new Date(selectedDate + 'T12:00:00').toLocaleDateString([], {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
            </p>

            <div
              role="tablist"
              aria-label="Entry type"
              className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-chrome border border-border"
            >
              {ENTRY_TYPES.map((tab) => {
                const selected = entryType === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setEntryType(tab.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-surface text-accent shadow-sm'
                        : 'text-muted hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">
                  {entryType === 'upskilling'
                    ? 'What are you upskilling on?'
                    : 'What are you working on?'}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={
                    entryType === 'upskilling'
                      ? 'e.g. React advanced patterns course'
                      : 'e.g. API integration for client portal'
                  }
                  className="w-full bg-chrome border border-border text-fg placeholder-slate-400 text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <p className="block text-xs font-medium text-fg">
                  Duration
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="timeline-hours"
                      className="block text-[10px] font-medium text-muted"
                    >
                      Hours
                    </label>
                    <input
                      id="timeline-hours"
                      type="number"
                      min={0}
                      max={23}
                      step={1}
                      inputMode="numeric"
                      value={hoursPart}
                      onChange={(e) => setHoursPart(e.target.value)}
                      placeholder="0"
                      className="w-full bg-chrome border border-border text-fg placeholder-slate-400 text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="timeline-minutes"
                      className="block text-[10px] font-medium text-muted"
                    >
                      Minutes
                    </label>
                    <select
                      id="timeline-minutes"
                      value={minutesPart}
                      onChange={(e) => setMinutesPart(e.target.value)}
                      className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer"
                    >
                      {MINUTE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-muted">
                  Selected:{' '}
                  <span className="font-mono font-semibold text-fg">
                    {durationPreview}
                  </span>
                </p>
              </div>

              {formError && (
                <p className="text-xs text-rose-500">{formError}</p>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                {editingEntry ? (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    disabled={saving}
                    onClick={handleDelete}
                  >
                    Delete
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    icon={editingEntry ? Pencil : Plus}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : editingEntry ? 'Update' : 'Save'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
