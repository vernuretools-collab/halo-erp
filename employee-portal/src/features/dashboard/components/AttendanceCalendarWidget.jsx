import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '../../../components/ui/Card'
import { useTeamStore } from '../../team/stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import { getUserMonthlyAttendance, attendanceRecordLooksPresent } from '../../team/services/attendanceService'
import { subscribeToCompanyHolidays } from '../../team/services/teamService'
import {
  classifyApprovedLeaveByDate,
  resolveLeaveLimits,
  attendanceStatusDotClass,
  attendanceStatusDotSizeClass,
  attendanceStatusTooltip,
} from '../../team/services/leaveEntitlementUtils'
import { collectUserIdentityIds } from '../../projects/services/projectService'
import { collection, doc, getDoc, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const AttendanceCalendarWidget = () => {
  const { clockedIn, todayShiftLogs } = useTeamStore()
  const { user, userDoc } = useUserStore()
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])
  const activeUid = identityIds[0] || userDoc?.uid || user?.uid
  const activeEmail = userDoc?.email || user?.email || ''
  const activeName = userDoc?.displayName || user?.displayName || userDoc?.name || ''

  // Default view date (current month/year)
  const [currentViewDate, setCurrentViewDate] = useState(() => new Date())
  
  // Selected date state (defaults to today's date)
  const todayDateObj = new Date()
  const [selectedDay, setSelectedDay] = useState(todayDateObj.getDate())
  const [selectedMonth, setSelectedMonth] = useState(todayDateObj.getMonth())
  const [selectedYear, setSelectedYear] = useState(todayDateObj.getFullYear())

  const [monthlyRecords, setMonthlyRecords] = useState({})
  const [isLoadingRecords, setIsLoadingRecords] = useState(true)
  const [companyHolidays, setCompanyHolidays] = useState({})
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employeeProfile, setEmployeeProfile] = useState(null)

  const year = currentViewDate.getFullYear()
  const month = currentViewDate.getMonth()

  // Fetch real attendance records from Firestore for current user
  useEffect(() => {
    if (!identityIds.length) {
      setMonthlyRecords({})
      setIsLoadingRecords(false)
      return
    }
    setIsLoadingRecords(true)
    getUserMonthlyAttendance(identityIds)
      .then((records) => {
        setMonthlyRecords(records || {})
      })
      .finally(() => {
        setIsLoadingRecords(false)
      })
  }, [identityIds, year, month])

  useEffect(() => {
    if (!identityIds.length) {
      setEmployeeProfile(null)
      return
    }
    let cancelled = false
    const loadProfile = async () => {
      for (const id of identityIds) {
        const snap = await getDoc(doc(db, 'employees', id))
        if (cancelled) return
        if (snap.exists()) {
          setEmployeeProfile({ id: snap.id, ...snap.data() })
          return
        }
      }
      if (activeEmail) {
        const snap = await getDocs(collection(db, 'employees'))
        const match = snap.docs.find(
          (d) =>
            String(d.data()?.email || '').trim().toLowerCase() ===
            String(activeEmail).trim().toLowerCase()
        )
        if (!cancelled && match) {
          setEmployeeProfile({ id: match.id, ...match.data() })
          return
        }
      }
      if (!cancelled) setEmployeeProfile(null)
    }
    loadProfile().catch(() => {
      if (!cancelled) setEmployeeProfile(null)
    })
    return () => {
      cancelled = true
    }
  }, [identityIds, activeEmail])

  // Subscribe to company-wide holidays in real-time
  useEffect(() => {
    const unsub = subscribeToCompanyHolidays((list) => {
      // Build a date -> holiday object map for O(1) lookup
      const map = {}
      list.forEach((h) => {
        if (h.date) map[h.date] = h
      })
      setCompanyHolidays(map)
    })
    return () => unsub()
  }, [])

  // Live leaveRequests — calendar overlays must clear when Admin deletes/rejects approval
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) => {
        // Prefer Firestore doc id so deletes always target the real document
        setLeaveRequests(snap.docs.map((d) => ({ ...d.data(), leaveId: d.id })))
      },
      (err) => console.error('Error listening to leave requests:', err)
    )
    return () => unsub()
  }, [])

  const approvedLeaveByDate = useMemo(() => {
    const emp = {
      employeeId: employeeProfile?.id || activeUid,
      uid: activeUid,
      employeeEmail: activeEmail,
      employeeName: activeName,
      identityIds,
    }
    return classifyApprovedLeaveByDate(leaveRequests, emp, resolveLeaveLimits(employeeProfile), companyHolidays)
  }, [leaveRequests, activeUid, activeEmail, activeName, employeeProfile, companyHolidays, identityIds])

  // Month name formatting e.g. "July 2026"
  const monthName = currentViewDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  // Navigation handlers
  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1)
    setCurrentViewDate(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1)
    setCurrentViewDate(newDate)
  }

  // Calculate calendar grid days
  const firstDayOfMonth = new Date(year, month, 1).getDay() // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Build grid items
  const gridCells = []

  // 1. Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i
    gridCells.push({
      day: dayNum,
      isCurrentMonth: false,
      isPrevMonth: true,
      key: `prev-${dayNum}`,
    })
  }

  // 2. Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    gridCells.push({
      day: d,
      isCurrentMonth: true,
      key: `curr-${d}`,
    })
  }

  // 3. Next month leading days (complete to 35 or 42 slots)
  const totalSlotsNeeded = gridCells.length > 35 ? 42 : 35
  const remainingSlots = totalSlotsNeeded - gridCells.length
  for (let n = 1; n <= remainingSlots; n++) {
    gridCells.push({
      day: n,
      isCurrentMonth: false,
      isNextMonth: true,
      key: `next-${n}`,
    })
  }

  // Parse employee account creation date (joinedAt / createdAt / auth creationTime)
  const parseRawDate = (rawDate) => {
    if (!rawDate) return null
    if (typeof rawDate?.toDate === 'function') {
      try {
        return rawDate.toDate()
      } catch {
        return null
      }
    }
    if (typeof rawDate === 'object' && typeof rawDate.seconds === 'number') {
      return new Date(rawDate.seconds * 1000)
    }
    const parsed = new Date(rawDate)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const getAccountCreatedDate = () => {
    const candidates = [
      employeeProfile?.joinedAt,
      employeeProfile?.createdAt,
      userDoc?.joinedAt,
      userDoc?.createdAt,
      user?.metadata?.creationTime,
    ]
    for (const raw of candidates) {
      const parsed = parseRawDate(raw)
      if (parsed) return parsed
    }
    return null
  }

  /** Lower bound for inventing Absent: account start, else earliest real activity, else start of current month. */
  const getAttendanceStartMidnight = () => {
    const accountCreatedDate = getAccountCreatedDate()
    if (accountCreatedDate) {
      return new Date(
        accountCreatedDate.getFullYear(),
        accountCreatedDate.getMonth(),
        accountCreatedDate.getDate()
      )
    }

    const activityDates = [
      ...Object.keys(monthlyRecords || {}),
      ...Object.keys(approvedLeaveByDate || {}),
    ]
      .filter(Boolean)
      .sort()
    if (activityDates.length > 0) {
      const d = new Date(`${activityDates[0]}T00:00:00`)
      if (!Number.isNaN(d.getTime())) return d
    }

    return new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), 1)
  }

  // Determine presence/absence status for a date using real Firestore data
  // Priority: holiday → approved LOP → approved leave (Casual/Sick/etc) → present → unexcused absent
  // Leave overlays come ONLY from currently approved leaveRequests (deleted/rejected clear immediately)
  const getAttendanceStatus = (dayNum, isCurrentMonth) => {
    if (!isCurrentMonth) return null

    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
    const cellDate = new Date(year, month, dayNum)
    cellDate.setHours(0, 0, 0, 0)

    const attendanceStart = getAttendanceStartMidnight()
    // Before account creation / effective start: show nothing (no full-month Absent)
    if (cellDate < attendanceStart) return null

    // ── Company holiday takes priority ──
    if (companyHolidays[dateKey]) return 'holiday'

    // ── Live approved leave overlays ──
    const approvedLeave = approvedLeaveByDate[dateKey]
    if (approvedLeave?.status === 'lop') return 'lop'
    if (approvedLeave?.status === 'wfh') return 'wfh'
    if (approvedLeave?.status === 'casual') return 'casual'
    if (approvedLeave?.status === 'sick') return 'sick'
    if (approvedLeave?.status === 'emergency') return 'emergency'
    if (approvedLeave?.status === 'leave') return 'leave'

    const dayOfWeek = cellDate.getDay() // 0 = Sun (Sunday is the only weekend rest day; Saturday is a regular working day)
    const isWeekend = dayOfWeek === 0

    const todayMidnight = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate())
    const isToday =
      dayNum === todayDateObj.getDate() &&
      month === todayDateObj.getMonth() &&
      year === todayDateObj.getFullYear()

    const isFuture = cellDate > todayMidnight

    // Today's dynamic sync with clockedIn state, shift log activity, or Firestore record
    if (isToday) {
      const recordForToday = monthlyRecords[dateKey]
      const isPresentToday =
        clockedIn ||
        (todayShiftLogs && todayShiftLogs.length > 0) ||
        attendanceRecordLooksPresent(recordForToday)
      
      if (isPresentToday) {
        return 'present'
      }
      if (isWeekend) {
        return null
      }
      return 'absent'
    }

    // Future dates show no status dot (unless covered by approved leave above)
    if (isFuture) {
      return null
    }

    // Past dates check Firestore records
    const pastRecord = monthlyRecords[dateKey]
    if (attendanceRecordLooksPresent(pastRecord)) return 'present'

    // Past weekends with no work record return null
    if (isWeekend) {
      return null
    }

    // While fetching monthly records from Firestore, do NOT flash false 'absent' red dots for past dates
    if (isLoadingRecords) {
      return null
    }

    // Past working weekday without presence and without approved leave: unexcused absent
    return 'absent'
  }

  const handleCellClick = (cell) => {
    if (!cell.isCurrentMonth) return
    setSelectedDay(cell.day)
    setSelectedMonth(month)
    setSelectedYear(year)
  }

  const weekHeader = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const is6Rows = totalSlotsNeeded > 35

  return (
    <Card className="p-3 w-full h-full border-border flex flex-col justify-between bg-surface shadow-sm select-none">
      <div className="flex flex-col  justify-between">
        {/* Top Header & Month Nav */}
        <div>
          {/* Header Title */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-fg text-xs sm:text-sm tracking-tight">
              Attendance Calendar
            </h3>
          </div>

          {/* Month & Year Navigation */}
          <div className="flex items-center justify-center gap-2 py-1.5">
            <button
              onClick={handlePrevMonth}
              className="p-0.5 rounded hover:bg-chrome text-accent transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span className="font-bold text-fg text-xs tracking-tight min-w-[80px] text-center">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-0.5 rounded hover:bg-chrome text-accent transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-0.5 mb-1 text-center">
            {weekHeader.map((d) => (
              <span
                key={d}
                className="text-[9px] font-bold text-slate-400 dark:text-slate-500 tracking-wider"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-y-0.5 gap-x-0.5 items-center justify-items-center">
            {gridCells.map((cell) => {
              const status = getAttendanceStatus(cell.day, cell.isCurrentMonth)
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
              const leaveOverlay = approvedLeaveByDate[dateKey]
              const isSelected =
                cell.isCurrentMonth &&
                cell.day === selectedDay &&
                month === selectedMonth &&
                year === selectedYear

              return (
                <div
                  key={cell.key}
                  onClick={() => handleCellClick(cell)}
                  className={`flex flex-col items-center justify-center w-full cursor-pointer rounded transition-all ${
                    cell.isCurrentMonth ? 'hover:bg-accent-soft/60' : 'cursor-default'
                  }`}
                >
                  {/* Day Number */}
                  <div
                    className={`rounded-full flex items-center justify-center font-semibold leading-none transition-colors ${
                      is6Rows ? 'w-4.5 h-4.5 text-[10px]' : 'w-5 h-5 text-[11px]'
                    } ${
                      isSelected
                        ? 'bg-accent text-white font-bold'
                        : cell.isCurrentMonth
                        ? 'text-fg'
                        : 'text-slate-300 dark:text-slate-600 font-normal'
                    }`}
                  >
                    {cell.day}
                  </div>

                  {/* Dot Indicator */}
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
        </div>

        {/* Legend Footer */}
        <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-3 text-[10px] font-medium text-muted flex-wrap">
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
      </div>
    </Card>
  )
}
