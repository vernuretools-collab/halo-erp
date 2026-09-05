import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { useUserStore } from '../../stores/userStore'
import {
  subscribeToCompanyHolidays,
  createCompanyHoliday,
  deleteCompanyHoliday,
} from './services/teamService'
import { TeamSubNav } from './components/TeamSubNav'
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  PartyPopper,
  Plus,
  Calendar,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatDateKey = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  const dt = new Date(Number(y), Number(m) - 1, Number(d))
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// ─── Component ────────────────────────────────────────────────────────────────
export const HolidayManager = () => {
  const { user } = useUserStore()
  const adminName = user?.displayName || user?.email || 'Admin'

  // Calendar view state
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()

  // Holidays from Firestore
  const [holidays, setHolidays] = useState([])

  // Modal state
  const [pendingDate, setPendingDate] = useState(null) // "YYYY-MM-DD" of clicked date
  const [holidayName, setHolidayName] = useState('')
  const [saving, setSaving] = useState(false)

  // Real-time subscription to /companyHolidays
  useEffect(() => {
    const unsub = subscribeToCompanyHolidays((list) => setHolidays(list))
    return () => unsub()
  }, [])

  // Build a set of holiday date strings for O(1) lookup
  const holidayMap = {}
  holidays.forEach((h) => {
    holidayMap[h.date] = h
  })

  // ─── Calendar Grid ──────────────────────────────────────────────────────────
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const gridCells = []

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    gridCells.push({ day: daysInPrevMonth - i, isCurrentMonth: false, isPrev: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({ day: d, isCurrentMonth: true })
  }
  const totalSlots = gridCells.length > 35 ? 42 : 35
  for (let n = 1; gridCells.length < totalSlots; n++) {
    gridCells.push({ day: n, isCurrentMonth: false, isNext: true })
  }

  const monthLabel = viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const handlePrevMonth = () => setViewDate(new Date(viewYear, viewMonth - 1, 1))
  const handleNextMonth = () => setViewDate(new Date(viewYear, viewMonth + 1, 1))

  const handleDayClick = (cell) => {
    if (!cell.isCurrentMonth) return
    const key = formatDateKey(viewYear, viewMonth, cell.day)
    if (holidayMap[key]) return // Already a holiday — handled via delete button in list
    setPendingDate(key)
    setHolidayName('')
  }

  const handleSaveHoliday = async () => {
    if (!pendingDate || !holidayName.trim()) return
    setSaving(true)
    await createCompanyHoliday(pendingDate, holidayName.trim(), adminName)
    setSaving(false)
    setPendingDate(null)
    setHolidayName('')
  }

  const handleDeleteHoliday = async (holidayId) => {
    await deleteCompanyHoliday(holidayId)
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header & Sub-nav ── */}
      <div className="space-y-4">
        <PageHeader
          title="Public Holidays"
          description="Mark company-wide public holidays. These dates will appear on every employee's attendance calendar."
        />

        <TeamSubNav />
      </div>

      {/* ── Main Content: Calendar + Saved List ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Interactive Calendar ── */}
        <Card className="lg:col-span-3 p-5 border-border space-y-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <PartyPopper className="w-4 h-4 text-amber-500" />
              Mark Holidays
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-fg min-w-[110px] text-center">
                {monthLabel}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Helper tip */}
          <p className="text-[10px] text-muted -mt-1">
            Click any date to mark it as a public holiday. Sundays are shown dimmed as weekly offs.
          </p>

          {/* Week-day headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_DAYS.map((d) => (
              <span key={d} className="text-[10px] font-bold text-slate-400 dark:text-slate-600 tracking-wider">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {gridCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={idx}
                    className="h-9 flex items-center justify-center text-[11px] text-slate-300 dark:text-slate-700 font-normal rounded-xl"
                  >
                    {cell.day}
                  </div>
                )
              }

              const dateKey = formatDateKey(viewYear, viewMonth, cell.day)
              const isHoliday = Boolean(holidayMap[dateKey])
              const isSunday = new Date(viewYear, viewMonth, cell.day).getDay() === 0
              const isToday =
                cell.day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear()

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(cell)}
                  title={isHoliday ? holidayMap[dateKey].name : isSunday ? 'Sunday (Weekly Off)' : 'Click to mark as holiday'}
                  className={`
                    h-9 w-full flex flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition-all select-none relative group
                    ${isHoliday
                      ? 'bg-amber-400/20 border border-amber-400/50 text-amber-600 dark:text-amber-400 cursor-default shadow-sm'
                      : isSunday
                      ? 'text-slate-400 dark:text-slate-600 cursor-default bg-canvas/30'
                      : isToday
                      ? 'bg-accent text-white font-bold shadow-md shadow-accent/30 cursor-pointer hover:bg-accent'
                      : 'text-fg hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer border border-transparent hover:border-amber-300/50'
                    }
                  `}
                >
                  {cell.day}
                  {isHoliday && (
                    <span className="w-1 h-1 rounded-full bg-amber-500 mt-0.5" />
                  )}
                  {/* Tooltip on hover for holiday name */}
                  {isHoliday && (
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 hidden group-hover:block pointer-events-none">
                      <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[9px] font-semibold rounded-lg px-2 py-1 whitespace-nowrap shadow-xl">
                        {holidayMap[dateKey].name}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="pt-2 border-t border-slate-100 dark:border-border/80 flex items-center gap-5 text-[10px] font-medium text-muted">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-amber-400/20 border border-amber-400/50" />
              <span>Marked Holiday</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-accent" />
              <span>Today</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-md bg-canvas/30 border border-border" />
              <span>Sunday (Weekly Off)</span>
            </div>
          </div>
        </Card>

        {/* ── Saved Holidays List ── */}
        <Card className="lg:col-span-2 p-5 border-border flex flex-col gap-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border/80">
            <h2 className="text-sm font-bold text-fg flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              Saved Holidays
            </h2>
            <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 rounded-full px-2 py-0.5">
              {holidays.length} total
            </span>
          </div>

          {holidays.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 py-10 text-slate-400 dark:text-slate-600">
              <PartyPopper className="w-8 h-8 opacity-40" />
              <p className="text-xs font-medium">No holidays marked yet.</p>
              <p className="text-[10px] text-center">Click on any calendar date to add a public holiday.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[480px] pr-1">
              {[...holidays]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((h) => (
                  <div
                    key={h.holidayId}
                    className="flex items-center justify-between gap-2 p-3 rounded-xl bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/60 dark:border-amber-500/20 group"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
                        <PartyPopper className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-fg truncate">{h.name}</p>
                        <p className="text-[10px] text-muted">{formatDisplayDate(h.date)}</p>
                        {h.createdBy && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-0.5">by {h.createdBy}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h.holidayId)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remove holiday"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Add Holiday Modal (name input) ── */}
      {pendingDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                  <PartyPopper className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fg">Add Public Holiday</h3>
                  <p className="text-[10px] text-slate-400">{formatDisplayDate(pendingDate)}</p>
                </div>
              </div>
              <button
                onClick={() => setPendingDate(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-fg">
                Holiday Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. Diwali, Republic Day, Christmas…"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveHoliday()}
                className="w-full bg-canvas border border-border text-fg text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-muted"
              />
            </div>

            {/* Info note */}
            <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 flex items-start gap-2">
              <PartyPopper className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                This holiday will appear as a <strong>gold dot</strong> on every employee's attendance calendar immediately.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPendingDate(null)}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-muted hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHoliday}
                disabled={!holidayName.trim() || saving}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/30"
              >
                <Plus className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Mark Holiday'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
