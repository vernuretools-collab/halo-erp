import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import {
  getAttendanceLogsForMonth,
  subscribeToCompanyHolidays,
} from '../services/teamService'
import { isAttendancePresent } from '../services/attendanceStatsUtils'
import {
  classifyApprovedLeaveByDate,
  resolveLeaveLimits,
  attendanceStatusDotClass,
  attendanceStatusDotSizeClass,
  attendanceStatusDayClass,
  attendanceStatusTooltip,
} from '../services/leaveEntitlementUtils'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function EmployeeAttendanceCalendar({
  employeeUid,
  employeeEmail = '',
  employeeName = '',
  employee = null,
  month,
  accountStartDate = null,
}) {
  const [viewMonth, setViewMonth] = useState(month)
  const [logsByDate, setLogsByDate] = useState({})
  const [leaveRequests, setLeaveRequests] = useState([])
  const [companyHolidays, setCompanyHolidays] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (month) setViewMonth(month)
  }, [month])

  useEffect(() => {
    const unsub = subscribeToCompanyHolidays((list) => {
      const map = {}
      list.forEach((h) => {
        if (h.date) map[h.date] = h
      })
      setCompanyHolidays(map)
    })
    return () => unsub()
  }, [])

  // Live leaveRequests so deleted/revoked approvals clear from the calendar immediately
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) => {
        setLeaveRequests(snap.docs.map((d) => ({ ...d.data(), leaveId: d.id })))
      },
      (err) => console.error('Error listening to leave requests:', err)
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!employeeUid || !viewMonth) {
      setLogsByDate({})
      return
    }

    let cancelled = false
    setLoading(true)

    getAttendanceLogsForMonth(viewMonth)
      .then((logs) => {
        if (cancelled) return
        const map = {}
        ;(logs || []).forEach((log) => {
          if (!log?.date) return
          if (log.uid !== employeeUid && log.employeeId !== employeeUid) return
          map[log.date] = log
        })
        setLogsByDate(map)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [employeeUid, viewMonth])

  const approvedLeaveByDate = useMemo(() => {
    if (!employeeUid && !employeeEmail && !employeeName) return {}
    return classifyApprovedLeaveByDate(
      leaveRequests,
      {
        employeeId: employeeUid,
        uid: employeeUid,
        employeeEmail,
        employeeName,
      },
      resolveLeaveLimits(employee),
      companyHolidays
    )
  }, [leaveRequests, employeeUid, employeeEmail, employeeName, employee, companyHolidays])

  const [year, monthIndex] = useMemo(() => {
    if (!viewMonth || !/^\d{4}-\d{2}$/.test(viewMonth)) {
      const now = new Date()
      return [now.getFullYear(), now.getMonth()]
    }
    const [y, m] = viewMonth.split('-').map(Number)
    return [y, m - 1]
  }, [viewMonth])

  const monthName = useMemo(
    () =>
      new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [year, monthIndex]
  )

  const handlePrevMonth = () => {
    const d = new Date(year, monthIndex - 1, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const handleNextMonth = () => {
    const d = new Date(year, monthIndex + 1, 1)
    setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const firstDayOfMonth = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()

  const gridCells = []
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i
    gridCells.push({ day: dayNum, isCurrentMonth: false, key: `prev-${dayNum}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({ day: d, isCurrentMonth: true, key: `curr-${d}` })
  }
  const totalSlotsNeeded = gridCells.length > 35 ? 42 : 35
  for (let n = 1; n <= totalSlotsNeeded - gridCells.length; n++) {
    gridCells.push({ day: n, isCurrentMonth: false, key: `next-${n}` })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const getStatus = (dayNum, isCurrentMonth) => {
    if (!isCurrentMonth) return null
    const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`

    const cellDate = new Date(year, monthIndex, dayNum)
    cellDate.setHours(0, 0, 0, 0)
    const isWeekend = cellDate.getDay() === 0
    const isFuture = cellDate > today

    // No attendance markers before the employee account exists
    if (accountStartDate && dateKey < accountStartDate) return null

    if (companyHolidays[dateKey]) return 'holiday'

    const approvedLeave = approvedLeaveByDate[dateKey]
    if (approvedLeave?.status === 'lop') return 'lop'
    if (approvedLeave?.status === 'wfh') return 'wfh'
    if (approvedLeave?.status === 'casual') return 'casual'
    if (approvedLeave?.status === 'sick') return 'sick'
    if (approvedLeave?.status === 'emergency') return 'emergency'
    if (approvedLeave?.status === 'leave') return 'leave'

    // Future days: never show Absent
    if (isFuture) return null

    const log = logsByDate[dateKey]
    if (log && isAttendancePresent(log)) return 'present'

    if (isWeekend) return null
    if (loading) return null

    // Without a known join date, don't invent Absent for historical months
    // (avoids painting entire past months red when createdAt is missing)
    if (!accountStartDate) {
      const isCurrentMonthView =
        year === today.getFullYear() && monthIndex === today.getMonth()
      if (!isCurrentMonthView) return null
    }

    return 'absent'
  }

  const weekHeader = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const is6Rows = totalSlotsNeeded > 35

  return (
    <Card className="p-4 border-border bg-surface select-none">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-border/80">
        <h4 className="font-bold text-fg text-xs sm:text-sm tracking-tight">
          Attendance Calendar
        </h4>
        {loading && (
          <span className="text-[10px] text-slate-400">Loading…</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 py-2">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-accent transition-colors"
          title="Previous Month"
        >
          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <span className="font-bold text-fg text-xs tracking-tight min-w-[100px] text-center">
          {monthName}
        </span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-accent transition-colors"
          title="Next Month"
        >
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1 text-center">
        {weekHeader.map((d) => (
          <span
            key={d}
            className="text-[9px] font-bold text-muted tracking-wider"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 items-center justify-items-center">
        {gridCells.map((cell) => {
          const status = getStatus(cell.day, cell.isCurrentMonth)
          const dateKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
          const leaveOverlay = approvedLeaveByDate[dateKey]

          return (
            <div
              key={cell.key}
              className="flex flex-col items-center justify-center w-full rounded"
            >
              <div
                className={`rounded-full flex items-center justify-center font-semibold leading-none ${
                  is6Rows ? 'w-4.5 h-4.5 text-[10px]' : 'w-5 h-5 text-[11px]'
                } ${
                  cell.isCurrentMonth
                    ? attendanceStatusDayClass(status) || 'text-fg'
                    : 'text-slate-300 dark:text-slate-600 font-normal'
                }`}
              >
                {cell.day}
              </div>
              <div className="h-1.5 flex items-center justify-center mt-0.5 relative group/dot">
                {cell.isCurrentMonth && status && (
                  <>
                    <span
                      className={`rounded-full ${attendanceStatusDotSizeClass(status)} ${attendanceStatusDotClass(status)}`}
                    />
                    {attendanceStatusTooltip(
                      status,
                      leaveOverlay?.leaveType,
                      companyHolidays[dateKey]?.name
                    ) && (
                      <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-20 hidden group-hover/dot:block pointer-events-none">
                        <div className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[8px] font-semibold rounded-lg px-2 py-1 whitespace-nowrap shadow-xl">
                          {attendanceStatusTooltip(
                            status,
                            leaveOverlay?.leaveType,
                            companyHolidays[dateKey]?.name
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="pt-2 mt-1 border-t border-slate-100 dark:border-border/80 flex items-center justify-center gap-3 text-[10px] font-medium text-muted flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
          <span>WFH</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A855F7]" />
          <span>Casual Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
          <span>Sick Leave</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7F1D1D]" />
          <span>Emergency</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EAB308]" />
          <span>Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EC4899]" />
          <span>LOP</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
          <span>Absent</span>
        </div>
      </div>
    </Card>
  )
}
