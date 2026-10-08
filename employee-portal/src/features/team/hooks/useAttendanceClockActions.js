import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTeamStore } from '../stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import { getEmployees } from '../services/teamService'
import { prepareClockInGate, LOCATION_GATE_ENABLED } from '../services/wfhAttendanceUtils'
import { collectUserIdentityIds } from '../../projects/services/projectService'
import {
  fixedLunchEndMs,
  getCachedEmployeeControls,
  isWithinFixedLunch,
  lunchDurationMs,
} from '../../../../../shared/employeeControls.js'
import { subscribeLeaveRequestsForUids } from '../services/leaveRequestsLive'

export const DESKTOP_ATTENDANCE_EVENT = 'crm-desktop-attendance'

export function useAttendanceClockActions({ listenForDesktopEvents = false } = {}) {
  const { user, userDoc } = useUserStore()
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])
  const activeUid = identityIds[0] || userDoc?.uid || user?.uid
  const displayName = userDoc?.displayName || user?.displayName || 'Employee'
  const departmentName = userDoc?.departmentName || ''

  const employees = useTeamStore((s) => s.employees)
  const setEmployees = useTeamStore((s) => s.setEmployees)
  const leaveRequests = useTeamStore((s) => s.leaveRequests)
  const setLeaveRequests = useTeamStore((s) => s.setLeaveRequests)
  const clockedIn = useTeamStore((s) => s.clockedIn)
  const isOnBreak = useTeamStore((s) => s.isOnBreak)
  const isOnLunch = useTeamStore((s) => s.isOnLunch)
  const accumulatedWorkSeconds = useTeamStore((s) => s.accumulatedWorkSeconds)
  const clockOutTime = useTeamStore((s) => s.clockOutTime)
  const loadUserAttendance = useTeamStore((s) => s.loadUserAttendance)
  const toggleClockIn = useTeamStore((s) => s.toggleClockIn)
  const toggleBreak = useTeamStore((s) => s.toggleBreak)
  const startLunch = useTeamStore((s) => s.startLunch)
  const finishLunch = useTeamStore((s) => s.finishLunch)

  const [clockBusy, setClockBusy] = useState(false)
  const [clockError, setClockError] = useState('')
  const [clockHint, setClockHint] = useState('')

  useEffect(() => {
    if (identityIds.length) loadUserAttendance(identityIds)
  }, [identityIds, loadUserAttendance])

  useEffect(() => {
    getEmployees()
      .then((list) => {
        if (list?.length) setEmployees(list)
      })
      .catch(() => {})
  }, [setEmployees])

  useEffect(() => {
    return subscribeLeaveRequestsForUids(identityIds, setLeaveRequests, (err) =>
      console.error('Error listening to leave requests:', err)
    )
  }, [identityIds, setLeaveRequests])

  const currentEmp =
    employees.find(
      (e) =>
        (activeUid && (e.uid === activeUid || e.employeeId === activeUid)) ||
        (user?.email && e.email?.toLowerCase() === user.email.toLowerCase())
    ) ||
    userDoc ||
    {}

  const userMeta = useMemo(
    () => ({ uid: activeUid, displayName, departmentName }),
    [activeUid, displayName, departmentName]
  )

  const clockOut = useCallback(() => {
    setClockError('')
    setClockHint('')
    if (!useTeamStore.getState().clockedIn) return { success: true }
    return toggleClockIn(userMeta)
  }, [toggleClockIn, userMeta])

  const clockIn = useCallback(async () => {
    setClockError('')
    setClockHint('')
    if (useTeamStore.getState().clockedIn) return { success: true }

    setClockBusy(true)
    try {
      const gate = await prepareClockInGate({
        emp: currentEmp,
        leaveRequests: useTeamStore.getState().leaveRequests,
        employeeFilter: {
          employeeId: activeUid,
          uid: activeUid,
          employeeEmail: user?.email || userDoc?.email || currentEmp?.email,
          employeeName: displayName,
        },
      })

      if (!gate.ok) {
        setClockError(gate.error || 'Unable to clock in.')
        return { success: false, error: gate.error }
      }

      if (LOCATION_GATE_ENABLED && gate.wfhExempt) {
        setClockHint(gate.reason || 'WFH — location not required')
      }

      const result = toggleClockIn(userMeta, {
        requireOfficeLocation: gate.requireOfficeLocation,
        locationVerified: gate.locationVerified,
        wfhExempt: gate.wfhExempt,
        coords: gate.coords,
      })

      if (result && result.success === false) {
        setClockError(result.error || 'Unable to clock in.')
      }
      return result || { success: true }
    } catch (err) {
      console.error('Clock-in gate error:', err)
      setClockError('Unable to verify location. Try again.')
      return { success: false, error: 'Unable to verify location. Try again.' }
    } finally {
      setClockBusy(false)
    }
  }, [activeUid, currentEmp, displayName, toggleClockIn, user, userDoc, userMeta])

  const handleClockToggle = useCallback(async () => {
    if (useTeamStore.getState().clockedIn) {
      clockOut()
      return
    }
    await clockIn()
  }, [clockIn, clockOut])

  const handleBreakToggle = useCallback(() => {
    if (!useTeamStore.getState().clockedIn) return
    toggleBreak(userMeta)
  }, [toggleBreak, userMeta])

  const handleLunchStart = useCallback(() => {
    const controls = getCachedEmployeeControls()
    if (!controls.showLunchButton) return
    const state = useTeamStore.getState()
    if (!state.clockedIn || state.isOnLunch) return
    const endsAt = controls.fixedLunchEnabled
      ? (isWithinFixedLunch(controls) ? fixedLunchEndMs(controls) : Date.now() + lunchDurationMs(controls))
      : undefined
    startLunch(userMeta, endsAt ? { endsAt } : {})
  }, [startLunch, userMeta])

  const handleLunchEnd = useCallback(() => {
    const state = useTeamStore.getState()
    if (!state.isOnLunch) return
    finishLunch()
  }, [finishLunch])

  const handleDesktopAction = useCallback(
    async (action) => {
      const state = useTeamStore.getState()
      if (action === 'clockIn' && !state.clockedIn) await clockIn()
      else if (action === 'clockOut' && state.clockedIn) clockOut()
      else if (action === 'break' && state.clockedIn && !state.isOnBreak) handleBreakToggle()
      else if (action === 'resume' && state.clockedIn && state.isOnBreak) handleBreakToggle()
    },
    [clockIn, clockOut, handleBreakToggle]
  )

  useEffect(() => {
    if (!listenForDesktopEvents || typeof window === 'undefined') return undefined
    const onDesktop = (event) => {
      const action = event?.detail?.action
      if (action) handleDesktopAction(action)
    }
    window.addEventListener(DESKTOP_ATTENDANCE_EVENT, onDesktop)
    return () => window.removeEventListener(DESKTOP_ATTENDANCE_EVENT, onDesktop)
  }, [handleDesktopAction, listenForDesktopEvents])

  let statusText = 'Absent'
  if (clockedIn && isOnLunch) statusText = 'On Lunch'
  else if (clockedIn && isOnBreak) statusText = 'On Break'
  else if (clockedIn) statusText = 'Present'
  else if (accumulatedWorkSeconds > 0 || clockOutTime) statusText = 'Off Duty'

  return {
    activeUid,
    displayName,
    departmentName,
    currentEmp,
    identityIds,
    userMeta,
    clockedIn,
    isOnBreak,
    isOnLunch,
    statusText,
    clockBusy,
    clockError,
    clockHint,
    locationGateEnabled: LOCATION_GATE_ENABLED,
    clockIn,
    clockOut,
    handleClockToggle,
    handleBreakToggle,
    handleLunchStart,
    handleLunchEnd,
    handleDesktopAction,
  }
}
