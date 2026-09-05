import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '../../../components/ui/Card'
import { useTeamStore, OFFICE_START_HOUR, OFFICE_START_MINUTE, LATE_GRACE_MINUTES } from '../stores/teamStore'
import { formatTo12HourTime, computeLiveWorkedSeconds } from '../services/attendanceStatsUtils'
import { getMorningPermissionExpectedStartMinutes } from '../services/leaveEntitlementUtils'
import { useUserStore } from '../../../stores/userStore'
import { UserCheck, LogIn, LogOut, Timer, AlertCircle } from 'lucide-react'

export const AttendanceMetricsBar = () => {
  const {
    clockedIn,
    clockInTime,
    clockInTimestamp,
    clockOutTime,
    isOnBreak,
    breakStartTime,
    accumulatedBreakSeconds,
    accumulatedWorkSeconds,
    leaveRequests,
  } = useTeamStore()
  const { user, userDoc } = useUserStore()

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const officeStartMinutes = OFFICE_START_HOUR * 60 + OFFICE_START_MINUTE
  const expectedStartMinutes = useMemo(() => {
    const uid = userDoc?.uid || user?.uid
    return getMorningPermissionExpectedStartMinutes(
      leaveRequests,
      {
        employeeId: uid,
        uid,
        employeeEmail: userDoc?.email || user?.email || '',
        employeeName: userDoc?.displayName || user?.displayName || '',
      },
      todayStr,
      officeStartMinutes
    )
  }, [leaveRequests, userDoc, user, todayStr, officeStartMinutes])

  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Live timer for Worked Hours ticker
  useEffect(() => {
    const updateTicker = () => {
      setElapsedSeconds(
        computeLiveWorkedSeconds({
          clockInTime,
          clockOutTime,
          clockedIn,
          clockInTimestamp,
          accumulatedBreakSeconds,
          accumulatedWorkSeconds,
          isOnBreak,
          breakStartTime,
        })
      )
    }
    updateTicker()
    const timer = setInterval(updateTicker, 1000)
    return () => clearInterval(timer)
  }, [
    clockedIn,
    clockInTime,
    clockOutTime,
    clockInTimestamp,
    isOnBreak,
    breakStartTime,
    accumulatedBreakSeconds,
    accumulatedWorkSeconds,
  ])

  const formatHoursStr = (totalSec) => {
    if (!totalSec || totalSec <= 0) return '0h 0m'
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    return `${hrs}h ${mins}m`
  }

  // Late By vs 10:30 AM with 10 min grace (cutoff 10:40) — day's first clock-in
  const getLateByInfo = () => {
    if (!clockInTime && !clockInTimestamp) {
      return { text: 'On time', isLate: false }
    }

    let clockInDate = null

    // Prefer displayed first-of-day clockInTime so re-clock-ins don't inflate lateness
    if (clockInTime) {
      const match = clockInTime.match(/(\d+):(\d+)(?::\d+)?\s*(AM|PM)?/i)
      if (match) {
        let hrs = parseInt(match[1], 10)
        const mins = parseInt(match[2], 10)
        const ampm = match[3] ? match[3].toUpperCase() : null
        if (ampm === 'PM' && hrs < 12) hrs += 12
        if (ampm === 'AM' && hrs === 12) hrs = 0
        // 24h locale strings without AM/PM (e.g. "10:28")
        if (!ampm && hrs <= 23) {
          // keep hrs as-is
        }
        clockInDate = new Date()
        clockInDate.setHours(hrs, mins, 0, 0)
      }
    }

    if (!clockInDate && clockInTimestamp) {
      clockInDate = new Date(clockInTimestamp)
    }

    if (!clockInDate) return { text: 'On time', isLate: false }

    const officeStart = new Date(clockInDate)
    officeStart.setHours(Math.floor(expectedStartMinutes / 60), expectedStartMinutes % 60, 0, 0)
    const graceCutoff = new Date(officeStart.getTime() + LATE_GRACE_MINUTES * 60 * 1000)

    if (clockInDate.getTime() < graceCutoff.getTime()) {
      return { text: 'On time', isLate: false }
    }

    const diffMins = Math.floor((clockInDate.getTime() - officeStart.getTime()) / (1000 * 60))
    if (diffMins <= 0) return { text: 'On time', isLate: false }

    const h = Math.floor(diffMins / 60)
    const m = diffMins % 60
    const lateStr = h > 0 ? `${h}h ${m}m late` : `${m}m late`
    return { text: lateStr, isLate: true }
  }

  const lateInfo = getLateByInfo()

  // Status computation
  let statusText = 'Absent'
  let statusColor = 'text-rose-600 dark:text-rose-400'
  let statusBg = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20'

  if (clockedIn) {
    if (isOnBreak) {
      statusText = 'On Break'
      statusColor = 'text-amber-600 dark:text-amber-400'
    } else {
      statusText = 'Present'
      statusColor = 'text-emerald-600 dark:text-emerald-400'
    }
  } else if (accumulatedWorkSeconds > 0 || clockOutTime) {
    statusText = 'Off Duty'
    statusColor = 'text-amber-600 dark:text-amber-400'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {/* 1. Status Card */}
      <Card className="p-4 bg-surface border-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl ${statusBg} flex items-center justify-center shrink-0`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block">Status</span>
            <span className={`text-base font-extrabold ${statusColor} block mt-0.5`}>
              {statusText}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Clock In Card */}
      <Card className="p-4 bg-surface border-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-soft text-accent border border-accent/20 dark:border-accent/20 flex items-center justify-center shrink-0">
            <LogIn className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block">Clock In</span>
            <span className="text-base font-extrabold text-fg block mt-0.5">
              {formatTo12HourTime(clockInTime) || '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* 3. Clock Out Card */}
      <Card className="p-4 bg-surface border-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-soft text-accent border border-accent/20 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block">Clock Out</span>
            <span className="text-base font-extrabold text-fg block mt-0.5">
              {formatTo12HourTime(clockOutTime) || '—'}
            </span>
          </div>
        </div>
      </Card>

      {/* 4. Worked Hours Card */}
      <Card className="p-4 bg-surface border-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-500/20 flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block">Worked Hours</span>
            <span className="text-base font-extrabold text-teal-600 dark:text-teal-400 block mt-0.5">
              {formatHoursStr(elapsedSeconds)}
            </span>
          </div>
        </div>
      </Card>

      {/* 5. Late By Card */}
      <Card className="p-4 bg-surface border-border rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-chrome text-slate-400 dark:text-slate-500 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-muted block">Late By</span>
            <span className={`text-base font-extrabold block mt-0.5 ${lateInfo.isLate ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {lateInfo.text}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
