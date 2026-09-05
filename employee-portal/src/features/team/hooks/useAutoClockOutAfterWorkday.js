import { useEffect } from 'react'
import { useTeamStore, WORKDAY_SECONDS } from '../stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import { resolveEmployeeDisplayName } from '../services/attendanceStatsUtils'

/** Set true to auto clock-out after 8 hours of work again. */
export const AUTO_CLOCK_OUT_ENABLED = false

/**
 * Auto clock-out when accumulated work time (session − breaks + prior work) reaches 8 hours.
 * Mount app-wide so it runs on dashboard, attendance, and other pages.
 */
export const useAutoClockOutAfterWorkday = () => {
  const { user, userDoc } = useUserStore()
  const activeUid = userDoc?.uid || user?.uid
  const displayName = resolveEmployeeDisplayName(
    userDoc || {},
    { displayName: user?.displayName, email: user?.email || userDoc?.email },
    user?.email || 'Employee'
  )
  const departmentName = userDoc?.departmentName || ''

  const clockedIn = useTeamStore((s) => s.clockedIn)
  const isInExtraTime = useTeamStore((s) => s.isInExtraTime)
  const isOnBreak = useTeamStore((s) => s.isOnBreak)
  const clockInTimestamp = useTeamStore((s) => s.clockInTimestamp)
  const breakStartTime = useTeamStore((s) => s.breakStartTime)
  const accumulatedBreakSeconds = useTeamStore((s) => s.accumulatedBreakSeconds)
  const accumulatedWorkSeconds = useTeamStore((s) => s.accumulatedWorkSeconds)
  const autoClockOutAfterWorkday = useTeamStore((s) => s.autoClockOutAfterWorkday)
  const rollOverStaleWorkday = useTeamStore((s) => s.rollOverStaleWorkday)

  useEffect(() => {
    rollOverStaleWorkday()
    const id = setInterval(() => {
      useTeamStore.getState().rollOverStaleWorkday()
    }, 60_000)
    return () => clearInterval(id)
  }, [rollOverStaleWorkday])

  useEffect(() => {
    if (!AUTO_CLOCK_OUT_ENABLED) return
    if (!clockedIn || isInExtraTime || !activeUid) return

    const check = () => {
      const state = useTeamStore.getState()
      if (state.rollOverStaleWorkday()) return
      if (!state.clockedIn || state.isInExtraTime) return

      const nowMs = Date.now()
      let sessionSec = 0
      if (state.clockInTimestamp) {
        sessionSec = Math.max(0, Math.floor((nowMs - state.clockInTimestamp) / 1000))
      }

      let breakSec = state.accumulatedBreakSeconds || 0
      if (state.isOnBreak && state.breakStartTime) {
        breakSec += Math.max(0, Math.floor((nowMs - state.breakStartTime) / 1000))
      }

      const livedWorked =
        (state.accumulatedWorkSeconds || 0) + Math.max(0, sessionSec - breakSec)

      if (livedWorked >= WORKDAY_SECONDS) {
        autoClockOutAfterWorkday({
          uid: activeUid,
          displayName,
          departmentName,
        })
      }
    }

    check()
    const interval = setInterval(check, 15000)
    return () => clearInterval(interval)
  }, [
    clockedIn,
    isInExtraTime,
    isOnBreak,
    clockInTimestamp,
    breakStartTime,
    accumulatedBreakSeconds,
    accumulatedWorkSeconds,
    autoClockOutAfterWorkday,
    activeUid,
    displayName,
    departmentName,
  ])
}
