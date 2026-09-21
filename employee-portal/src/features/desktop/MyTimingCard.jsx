import React, { useEffect, useState } from 'react'
import { Minus, LogIn, LogOut, Coffee, Play, Loader2, AlertCircle, Sun, Moon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useTeamStore } from '../team/stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { useUIStore } from '../../stores/uiStore'
import { useAttendanceClockActions } from '../team/hooks/useAttendanceClockActions'
import {
  computeLiveWorkedSeconds,
  computeLiveBreakSeconds,
  formatSecondsToHms,
} from '../team/services/attendanceStatsUtils'
import haloLogo from '../../assets/halologo.png'
import { EmployeeAvatar } from '../../../../shared/ui/EmployeeAvatar.jsx'
import { MyTimingTasks } from './MyTimingTasks'
import { useTimingWindowDrag } from './useTimingWindowDrag'

function formatProductive(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0))
  const hrs = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  return `${String(hrs).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`
}

function formatWallClock(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function initialsFromName(name, fallback = 'E') {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase()
  return fallback
}

export const MyTimingCard = ({
  listenForDesktopEvents = false,
  onHide,
  fillWindow = false,
} = {}) => {
  const { user, userDoc } = useUserStore()
  const { theme, toggleTheme } = useUIStore()
  const {
    clockedIn,
    isOnBreak,
    clockBusy,
    clockError,
    clockIn,
    clockOut,
    handleBreakToggle,
  } = useAttendanceClockActions({ listenForDesktopEvents })

  const clockInTime = useTeamStore((s) => s.clockInTime)
  const clockOutTime = useTeamStore((s) => s.clockOutTime)
  const clockInTimestamp = useTeamStore((s) => s.clockInTimestamp)
  const breakStartTime = useTeamStore((s) => s.breakStartTime)
  const accumulatedBreakSeconds = useTeamStore((s) => s.accumulatedBreakSeconds)
  const accumulatedWorkSeconds = useTeamStore((s) => s.accumulatedWorkSeconds)

  const [workedSec, setWorkedSec] = useState(0)
  const [breakSec, setBreakSec] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = () => {
      const snapshot = {
        clockInTime,
        clockOutTime,
        clockedIn,
        clockInTimestamp,
        accumulatedBreakSeconds,
        accumulatedWorkSeconds,
        isOnBreak,
        breakStartTime,
      }
      setWorkedSec(computeLiveWorkedSeconds(snapshot))
      setBreakSec(computeLiveBreakSeconds(snapshot))
      setNow(new Date())
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [
    clockInTime,
    clockOutTime,
    clockedIn,
    clockInTimestamp,
    accumulatedBreakSeconds,
    accumulatedWorkSeconds,
    isOnBreak,
    breakStartTime,
  ])

  const displayName = userDoc?.displayName || user?.displayName || 'Employee'
  const photo = userDoc?.photoURL || userDoc?.avatar || user?.photoURL
  const initials = initialsFromName(displayName)

  const primaryAction = !clockedIn
    ? {
        label: 'CLOCK IN',
        onClick: clockIn,
        disabled: clockBusy,
        variant: 'primary',
        className: 'bg-accent hover:bg-accent-hover text-white border border-accent',
        icon: clockBusy ? Loader2 : LogIn,
        spin: clockBusy,
      }
    : isOnBreak
      ? {
          label: 'RESUME',
          onClick: handleBreakToggle,
          disabled: clockBusy,
          variant: 'primary',
          className: 'bg-accent hover:bg-accent-hover text-white border border-accent',
          icon: clockBusy ? Loader2 : Play,
          spin: clockBusy,
        }
      : {
          label: 'BREAK',
          onClick: handleBreakToggle,
          disabled: clockBusy,
          variant: 'outline',
          className:
            '!bg-accent-soft hover:!bg-accent !text-accent hover:!text-white !border-2 !border-accent',
          icon: clockBusy ? Loader2 : Coffee,
          spin: clockBusy,
        }

  const PrimaryIcon = primaryAction.icon
  const windowDrag = useTimingWindowDrag()

  return (
    <div
      className={`relative flex flex-col overflow-hidden bg-surface text-fg border border-border ${
        fillWindow
          ? 'h-full w-full'
          : 'rounded-2xl w-full max-h-[min(640px,calc(100vh-48px))] shadow-xl shadow-slate-300/40 dark:shadow-none'
      }`}
    >
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border shrink-0 cursor-move"
        style={{ WebkitAppRegion: 'no-drag' }}
        data-timing-drag="true"
        title="Drag to move"
        {...windowDrag}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-white p-0.5 rounded-full border border-border shadow-sm flex items-center justify-center shrink-0">
            <img
              src={haloLogo}
              alt="The Halo Effect Consulting"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <span className="text-xs font-semibold text-fg leading-tight">
            The Halo Effect Consulting
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 cursor-auto" data-no-drag="true">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-7 h-7 rounded-lg bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-all border border-border cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-700" />
            )}
          </button>
          <EmployeeAvatar
            src={photo}
            name={displayName}
            fallback={initials}
            initialsCount={2}
            className="w-8 h-8 rounded-full bg-accent-soft text-accent border border-accent/20"
            textClassName="text-[10px] font-bold"
          />
          {onHide ? (
            <button
              type="button"
              onClick={onHide}
              title="Hide"
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:bg-chrome hover:text-fg cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-start justify-between gap-3 px-3 pt-3 pb-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <p className="text-sm font-semibold text-fg">My Timing</p>
        <p className="text-xs text-muted text-right">
          Productive Time:{' '}
          <span className="font-semibold text-fg tabular-nums">{formatProductive(workedSec)}</span>
        </p>
      </div>

      <div className="px-3 py-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <div className="rounded-xl border border-border bg-chrome/50 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Current Time</span>
            <span className="text-base font-bold tabular-nums text-fg">{formatWallClock(now)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">Break Time</span>
            <span className="text-base font-bold tabular-nums text-fg">{formatSecondsToHms(breakSec)}</span>
          </div>
        </div>
      </div>

      {clockError ? (
        <div className="mx-3 mb-1.5 flex items-start gap-1.5 text-[11px] text-danger bg-danger-soft border border-danger/30 rounded-lg px-2 py-1.5">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{clockError}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 px-3 pb-3" style={{ WebkitAppRegion: 'no-drag' }}>
        <Button
          size="sm"
          variant={primaryAction.variant}
          disabled={primaryAction.disabled}
          onClick={primaryAction.onClick}
          className={`w-full justify-center text-xs font-extrabold py-2.5 tracking-wide ${primaryAction.className}`}
        >
          <PrimaryIcon className={`w-3.5 h-3.5 ${primaryAction.spin ? 'animate-spin' : ''}`} />
          {primaryAction.label}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={clockBusy || !clockedIn}
          onClick={clockOut}
          className="w-full justify-center text-xs font-extrabold py-2.5 tracking-wide bg-danger hover:opacity-90 text-white"
        >
          {clockBusy && clockedIn && !isOnBreak ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          CLOCK OUT
        </Button>
      </div>

      <MyTimingTasks fillWindow={fillWindow} />
    </div>
  )
}
