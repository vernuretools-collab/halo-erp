import React, { useState, useEffect, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import { useTeamStore } from '../../team/stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import { useAttendanceClockActions } from '../../team/hooks/useAttendanceClockActions'
import { LOCATION_GATE_ENABLED } from '../../team/services/wfhAttendanceUtils'
import { formatTo12HourTime, computeLiveWorkedSeconds } from '../../team/services/attendanceStatsUtils'
import { AttendanceCalendarWidget } from './AttendanceCalendarWidget'
import { AttendanceMetricsBar } from '../../team/components/AttendanceMetricsBar'
import {
  classifyApprovedLeaveByDate,
  resolveLeaveLimits,
  attendanceStatusChip,
} from '../../team/services/leaveEntitlementUtils'
import {
  LogIn,
  LogOut,
  Coffee,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ListFilter,
  Utensils,
  AlertCircle,
  Zap,
  Loader2,
  MapPin,
} from 'lucide-react'

export const ClockInOverviewWidget = ({ children }) => {
  const { user, userDoc } = useUserStore()
  const {
    activeUid,
    displayName,
    departmentName,
    currentEmp,
    identityIds,
    clockedIn,
    isOnBreak,
    isOnLunch,
    clockBusy,
    clockError,
    clockHint,
    handleClockToggle,
    handleBreakToggle,
    handleLunchStart,
    handleLunchEnd,
  } = useAttendanceClockActions()

  const {
    leaveRequests,
    clockInTime,
    clockInTimestamp,
    clockOutTime,
    breakStartTime,
    accumulatedBreakSeconds,
    lunchStartTime,
    accumulatedLunchSeconds,
    accumulatedWorkSeconds,
    isInExtraTime,
    extraTimeStart,
    accumulatedExtraSeconds,
    toggleExtraTime,
  } = useTeamStore()

  const todayKey = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const overlayChip = useMemo(() => {
    const map = classifyApprovedLeaveByDate(
      leaveRequests,
      {
        employeeId: activeUid,
        uid: activeUid,
        employeeEmail: user?.email || userDoc?.email || currentEmp?.email,
        employeeName: displayName,
        identityIds,
      },
      resolveLeaveLimits(currentEmp),
      null
    )
    const overlay = map[todayKey]
    return overlay?.status ? attendanceStatusChip(overlay.status, overlay.leaveType) : null
  }, [leaveRequests, activeUid, user, userDoc, currentEmp, displayName, identityIds, todayKey])

  const [confirmKind, setConfirmKind] = useState(null)
  const [currentTimeStr, setCurrentTimeStr] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [elapsedExtraSec, setElapsedExtraSec] = useState(0)

  // Live real-time ticker for extra work hours
  useEffect(() => {
    let timer
    if (isInExtraTime && extraTimeStart) {
      const updateExtraTicker = () => {
        const netExtra = Math.max(0, Math.floor((Date.now() - extraTimeStart) / 1000))
        setElapsedExtraSec(accumulatedExtraSeconds + netExtra)
      }
      updateExtraTicker()
      timer = setInterval(updateExtraTicker, 1000)
    } else {
      setElapsedExtraSec(accumulatedExtraSeconds)
    }
    return () => clearInterval(timer)
  }, [isInExtraTime, extraTimeStart, accumulatedExtraSeconds])

  // Extra work hours unlock after regular 8-hour workday (or already in overtime)
  const isWorkDone =
    elapsedSeconds >= 8 * 3600 ||
    (!clockedIn && accumulatedWorkSeconds > 0) ||
    isInExtraTime



  // Live real-time clock & elapsed work time ticker
  useEffect(() => {
    const updateTicker = () => {
      const now = new Date()
      setCurrentTimeStr(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      )

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
          isOnLunch,
          lunchStartTime,
          accumulatedLunchSeconds,
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
    isOnLunch,
    lunchStartTime,
    accumulatedLunchSeconds,
    accumulatedWorkSeconds,
  ])

  // Format seconds to "Xh Ym" or "0h 0m"
  const formatWorkdayHours = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    return `${hrs}h ${mins}m`
  }

  // Calculate target progress % based on 8-hour workday (28,800 sec)
  const targetWorkdaySec = 8 * 3600
  const progressPercentage = Math.min(100, Math.round((elapsedSeconds / targetWorkdaySec) * 100))

  // SVG Gauge dimensions
  const gaugeRadius = 38
  const gaugeCircumference = 2 * Math.PI * gaugeRadius
  const strokeDashoffset = gaugeCircumference - (progressPercentage / 100) * gaugeCircumference

  return (
    <div className="space-y-3">
      {/* 5-Card Attendance Metrics Bar: Status, Clock In, Clock Out, Worked Hours, Late By */}
      <AttendanceMetricsBar />

      {/* Main Top Attendance Hub Grid */}
      <div className={`grid grid-cols-1 gap-3 items-stretch ${children ? 'lg:grid-cols-3' : 'lg:grid-cols-12'}`}>

        {/* CARD 1: Today's Overview (Main Clock-In Card) */}
        <Card className={`${children ? '' : 'lg:col-span-7'} p-5 sm:p-6 border-border flex flex-col relative overflow-hidden bg-gradient-to-br from-white via-slate-50/50 to-emerald-50/20 dark:from-surface dark:via-surface dark:to-emerald-950/20 shadow-lg shadow-slate-200/50 dark:shadow-none`}>
          {/* Top Row: Title & Badge & Live Clock */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-fg text-base tracking-tight">
                  Today's Overview
                </h3>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-muted bg-chrome/90 px-2.5 py-1 rounded-lg border border-border/80 shadow-xs font-medium">
                  {currentTimeStr}
                </span>

                {clockedIn && isOnLunch ? (
                    <Badge variant="warning" className="animate-pulse text-xs px-2.5 py-0.5 font-semibold">
                      On Lunch
                    </Badge>
                  ) : clockedIn && isOnBreak ? (
                    <Badge variant="warning" className="animate-pulse text-xs px-2.5 py-0.5 font-semibold">
                      On Break
                    </Badge>
                  ) : overlayChip ? (
                    <Badge variant="outline" className={`text-xs px-2.5 py-0.5 font-semibold ${overlayChip.badgeClass}`}>
                      {overlayChip.label}
                    </Badge>
                  ) : clockedIn ? (
                    <Badge variant="success" className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Present
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="text-xs px-2.5 py-0.5 font-semibold">Absent</Badge>
                  )}
              </div>
            </div>

            {/* Gauge & Progress Details — vertically centered between header and actions */}
            <div className="flex-1 min-h-0 flex items-center">
            <div className="grid grid-cols-12 gap-4 items-center w-full py-2">
              {/* Circular Gauge */}
              <div className="col-span-5 sm:col-span-4 flex flex-col items-center justify-center relative">
                <div className="relative w-28 h-28 sm:w-30 sm:h-30 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Ring */}
                    <circle
                      cx="50"
                      cy="50"
                      r={gaugeRadius}
                      className="text-slate-200 dark:text-slate-800 stroke-current"
                      strokeWidth="9"
                      fill="transparent"
                    />
                    {/* Progress Arc */}
                    <circle
                      cx="50"
                      cy="50"
                      r={gaugeRadius}
                      className="text-emerald-600 dark:text-emerald-500 stroke-current transition-all duration-700 ease-out"
                      strokeWidth="9"
                      strokeDasharray={gaugeCircumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xl sm:text-2xl font-black text-fg leading-none tracking-tight">
                      {progressPercentage}%
                    </span>
                    <span className="text-[11px] font-semibold text-muted mt-1">
                      in office
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress Text Information */}
              <div className="col-span-7 sm:col-span-8 space-y-2 pl-2">
                <div>
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                    Workday Progress
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight mt-0.5">
                    {formatWorkdayHours(elapsedSeconds)}
                  </div>
                </div>

                {/* Sub progress line */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all duration-500 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>

                <p className="text-xs sm:text-sm text-muted font-medium pt-0.5">
                  {!clockedIn ? (
                    <span className="text-muted italic">
                      You haven't clocked in today
                    </span>
                  ) : isOnLunch ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      On lunch
                    </span>
                  ) : isOnBreak ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Paused for break
                    </span>
                  ) : (
                    <span className="text-fg">
                      Clocked in at <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatTo12HourTime(clockInTime)}</strong>
                    </span>
                  )}
                </p>
              </div>
            </div>
            </div>

          {/* Action Button Strip */}
          <div className="pt-3 space-y-2 shrink-0">
            {clockError && (
              <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{clockError}</span>
              </div>
            )}
            {clockHint && !clockError && (
              <div className="flex items-start gap-2 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{clockHint}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5">
            <Button
              onClick={handleClockToggle}
              disabled={clockBusy}
              className={`flex-1 justify-center py-2.5 font-extrabold shadow-md transition-all text-sm sm:text-base rounded-xl ${
                clockedIn
                  ? 'bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-500/20'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-700/20'
              }`}
            >
              {clockBusy ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" /> {LOCATION_GATE_ENABLED ? 'Checking location…' : 'Working…'}
                </>
              ) : clockedIn ? (
                <>
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Clock Out
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" /> Check In
                </>
              )}
            </Button>

            {clockedIn && (
              <Button
                variant={isOnBreak ? 'primary' : 'secondary'}
                onClick={() => {
                  if (isOnBreak) handleBreakToggle()
                  else setConfirmKind('break')
                }}
                title={isOnBreak ? 'Resume Work' : 'Take Break'}
                className="py-2.5 px-3.5 rounded-xl"
              >
                <Coffee className={`w-4 h-4 sm:w-5 sm:h-5 ${isOnBreak ? 'text-white' : 'text-amber-500'}`} />
              </Button>
            )}

            {clockedIn && (
              <Button
                variant={isOnLunch ? 'primary' : 'secondary'}
                onClick={() => {
                  if (isOnLunch) handleLunchEnd()
                  else setConfirmKind('lunch')
                }}
                title={isOnLunch ? 'End lunch' : 'Take lunch'}
                className="py-2.5 px-3.5 rounded-xl"
              >
                <Utensils className={`w-4 h-4 sm:w-5 sm:h-5 ${isOnLunch ? 'text-white' : 'text-amber-500'}`} />
              </Button>
            )}
            </div>
          </div>

          {/* Extra Work Hours / Overtime — kept for later; UI hidden for now */}
          {false && (
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isInExtraTime ? 'bg-amber-500/20 text-amber-500 animate-pulse' : isWorkDone ? 'bg-accent-soft text-accent' : 'bg-chrome text-slate-400'}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-fg">
                    Extra Work Hours
                  </span>
                  <span className="text-[10px] text-muted">
                    {isInExtraTime
                      ? `Logging overtime: ${formatWorkdayHours(elapsedExtraSec)}`
                      : isWorkDone
                      ? `Unlocked! Shift completed (${formatWorkdayHours(accumulatedExtraSeconds)} logged)`
                      : ''}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant={isInExtraTime ? 'danger' : isWorkDone ? 'primary' : 'secondary'}
                disabled={!isWorkDone && !isInExtraTime}
                onClick={() => toggleExtraTime({ uid: activeUid, displayName, departmentName })}
                title={!isWorkDone ? 'Finish regular workday to unlock extra work hours' : 'Toggle extra work hours logging'}
                className="text-xs font-bold px-3 py-1.5 rounded-xl shrink-0"
              >
                {isInExtraTime ? 'Stop Extra Time' : 'Start Extra Time'}
              </Button>
            </div>
          )}
        </Card>

        {/* Attendance Calendar */}
        <div className={`${children ? '' : 'lg:col-span-5'} flex w-full min-h-0`}>
          <AttendanceCalendarWidget />
        </div>

        {children ? <div className="flex w-full min-h-0">{children}</div> : null}
      </div>

      <Modal
        open={confirmKind === 'break' || confirmKind === 'lunch'}
        onClose={() => setConfirmKind(null)}
        title={confirmKind === 'lunch' ? 'Start lunch?' : 'Start break?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmKind(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirmKind === 'lunch') handleLunchStart()
                else handleBreakToggle()
                setConfirmKind(null)
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {confirmKind === 'lunch'
            ? 'Are you taking lunch?'
            : 'Are you taking a break?'}
        </p>
      </Modal>
    </div>
  )
}