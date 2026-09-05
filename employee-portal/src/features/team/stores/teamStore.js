import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { upsertAttendanceLog, getTodayAttendanceLog, getUserMonthlyAttendance } from '../services/attendanceService'
import { computeRealAttendanceStats, formatTo12HourTime, canonicalTimeFromDate, toEpochMs, timestampFromClockInTime, timeStrToMinutes, resolveEmployeeDisplayName } from '../services/attendanceStatsUtils'
import { useUserStore } from '../../../stores/userStore'

// Office hours constants (late-by still uses start time)
export const OFFICE_START_HOUR = 10
export const OFFICE_START_MINUTE = 30
export const LATE_GRACE_MINUTES = 10
export const OFFICE_END_HOUR = 19
export const OFFICE_END_MINUTE = 0

// Regular workday length: 8 hours from clock-in (auto clock-out; extra hours after)
export const WORKDAY_SECONDS = 8 * 3600

/**
 * Returns a "YYYY-MM-DD" string for today (local date).
 */
function dateKeyFromDate(d = new Date()) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayDateStr() {
  return dateKeyFromDate(new Date())
}

function dateKeyFromMs(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n)) return null
  return dateKeyFromDate(new Date(n))
}

function localMidnightMs(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function freshWorkdayFields(date = todayDateStr()) {
  return {
    clockedIn: false,
    clockInTime: null,
    clockInTimestamp: null,
    clockOutTime: null,
    isOnBreak: false,
    breakStartTime: null,
    accumulatedBreakSeconds: 0,
    accumulatedWorkSeconds: 0,
    todayShiftLogs: [],
    isInExtraTime: false,
    extraTimeStart: null,
    accumulatedExtraSeconds: 0,
    extraTimeLogs: [],
    overtimeRecords: [],
    lastWorkDate: date,
  }
}

function hasClockInOnLocalDay(logs, midnightMs) {
  return (logs || []).some(
    (l) => l?.type === 'clock_in' && Number(l.timestamp) >= midnightMs
  )
}

/**
 * True when persisted / live clock state belongs to a previous calendar day.
 * Overnight leftover 8h must not count as today's workday.
 */
function isStaleLocalAttendance(state, today = todayDateStr()) {
  if (!state) return false
  if (state.lastWorkDate && state.lastWorkDate !== today) return true

  const midnight = localMidnightMs()
  if (state.clockInTimestamp && state.clockInTimestamp < midnight) return true
  if (state.extraTimeStart && state.extraTimeStart < midnight) return true
  if (state.breakStartTime && state.breakStartTime < midnight) return true

  const logs = state.todayShiftLogs || []
  if (hasClockInOnLocalDay(logs, midnight)) return false

  const hasHours =
    (state.accumulatedWorkSeconds || 0) > 0 ||
    Boolean(state.clockOutTime) ||
    (state.accumulatedExtraSeconds || 0) > 0 ||
    Boolean(state.clockInTime)

  if (!hasHours && !state.clockedIn && !state.isInExtraTime) return false

  // Hours / clock-out with no clock-in today = yesterday carried forward
  return hasHours || state.clockedIn || state.isInExtraTime
}

/**
 * True only when this log has a real clock-in on the local calendar day.
 * Overnight leftovers (no clock-out, then a next-day write) must not count.
 */
function attendanceLogBelongsToToday(log, today = todayDateStr()) {
  if (!log) return false
  if (log.date && log.date !== today) return false

  const midnight = localMidnightMs()
  const clockInTs = toEpochMs(log.clockInTimestamp)
  if (clockInTs != null && clockInTs >= midnight) return true

  const logs = log.todayShiftLogs || log.shiftLogs || []
  return hasClockInOnLocalDay(logs, midnight)
}

function hasGenuineClockInToday(state, midnight = localMidnightMs()) {
  if (!state) return false
  const ts = toEpochMs(state.clockInTimestamp)
  if (ts != null && ts >= midnight) return true
  return hasClockInOnLocalDay(state.todayShiftLogs, midnight)
}

function previousSessionDate(state, today = todayDateStr()) {
  if (state?.lastWorkDate && state.lastWorkDate !== today) return state.lastWorkDate
  const ts = toEpochMs(state?.clockInTimestamp)
  if (ts != null && ts < localMidnightMs()) return dateKeyFromMs(ts)
  return null
}

/**
 * Convert accumulated seconds to a human-readable "Xh Ym" string.
 */
function secToHrsStr(totalSec) {
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  return `${hrs}h ${mins}m`
}

/**
 * Resolves user metadata (uid, displayName, departmentName) from passed argument or useUserStore.
 */
function resolveUserMeta(userMeta) {
  try {
    const { user, userDoc } = useUserStore.getState()
    const uid = userMeta?.uid || userDoc?.uid || user?.uid
    const displayName = resolveEmployeeDisplayName(
      {
        displayName: userMeta?.displayName || userDoc?.displayName,
        name: userMeta?.name || userDoc?.name,
        fullName: userMeta?.fullName || userDoc?.fullName,
        email: userMeta?.email || userDoc?.email || user?.email,
      },
      { displayName: user?.displayName },
      user?.email || 'Employee'
    )
    const departmentName = userMeta?.departmentName || userDoc?.departmentName || ''
    return { ...(userMeta || {}), uid, displayName, departmentName }
  } catch (e) {
    return userMeta || {}
  }
}

export const useTeamStore = create(
  persist(
    (set, get) => ({
      employees: [],
      departments: [],
      leaveRequests: [],

      // Active user tracking
      currentUserId: null,

      // Clock-in state
      clockedIn: false,
      clockInTime: null,
      clockInTimestamp: null,
      clockOutTime: null,
      isOnBreak: false,
      breakStartTime: null,
      accumulatedBreakSeconds: 0,
      accumulatedWorkSeconds: 0,
      todayShiftLogs: [],

      // Extra/overtime state – activated manually after normal hours end
      isInExtraTime: false,
      extraTimeStart: null,
      accumulatedExtraSeconds: 0,
      extraTimeLogs: [],

      // Overtime records stored per-day (for admin visibility)
      overtimeRecords: [],

      // Date tracking for auto-reset
      lastWorkDate: null,

      attendanceStats: {
        totalDays: 23,
        presentDays: 21,
        absentDays: 2,
        attendancePercentage: 91,
        avgHours: '7h 45m',
        avgCheckIn: '09:15 AM',
        avgArrival: '09:10 AM',
        avgCheckOut: '06:15 PM',
      },
      loading: false,

      setEmployees: (employees) => set({ employees }),
      setDepartments: (departments) => set({ departments }),
      setLeaveRequests: (leaveRequests) => set({ leaveRequests }),
      setLoading: (loading) => set({ loading }),

      addEmployee: (newEmp) =>
        set((state) => ({
          employees: [
            {
              uid: `emp_${Date.now()}`,
              status: 'active',
              joinedAt: new Date().toISOString().split('T')[0],
              utilizationRate: 85,
              skills: newEmp.skills || ['General'],
              ...newEmp,
            },
            ...state.employees,
          ],
        })),

      deleteEmployee: (uid) =>
        set((state) => ({
          employees: state.employees.filter((e) => e.uid !== uid && e.employeeId !== uid),
        })),

      addLeaveRequest: (newLeave) =>
        set((state) => ({
          leaveRequests: [
            {
              status: 'pending',
              ...newLeave,
              leaveId: newLeave?.leaveId || `leave_${Date.now()}`,
            },
            ...state.leaveRequests.filter((l) => l.leaveId !== newLeave?.leaveId),
          ],
        })),

      updateLeaveStatus: (leaveId, newStatus, extras = {}) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.map((l) =>
            l.leaveId === leaveId ? { ...l, status: newStatus, ...extras } : l
          ),
        })),

      removeLeaveRequest: (leaveId) =>
        set((state) => ({
          leaveRequests: state.leaveRequests.filter((l) => l.leaveId !== leaveId),
        })),

      /**
       * Resets attendance state (e.g. on logout or user switch).
       */
      resetAttendanceState: () =>
        set({
          currentUserId: null,
          ...freshWorkdayFields(null),
          lastWorkDate: null,
        }),

      /**
       * Drop yesterday's persisted clock/hours so a new calendar day starts at 0%.
       * @returns {boolean} true if state was reset
       */
      rollOverStaleWorkday: () => {
        const state = get()
        const today = todayDateStr()
        if (!isStaleLocalAttendance(state, today)) return false

        const prevDate = previousSessionDate(state, today)
        if (state.currentUserId && prevDate && (state.clockedIn || state.clockInTime)) {
          upsertAttendanceLog(state.currentUserId, {
            clockedIn: false,
            isOnBreak: false,
            breakStartTime: null,
            date: prevDate,
            clockInTime: state.clockInTime,
            clockInTimestamp: state.clockInTimestamp,
          })
        }

        set(freshWorkdayFields(today))
        return true
      },

      /**
       * Loads today's attendance state for a specific employee from Firestore.
       * @param {string} uid
       */
      loadUserAttendance: async (uidOrIds) => {
        const ids = [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]
        const uid = ids[0]
        if (!uid) {
          get().resetAttendanceState()
          return
        }

        get().rollOverStaleWorkday()
        set({ currentUserId: uid })

        try {
          const [todayLog, monthlyLogsMap] = await Promise.all([
            getTodayAttendanceLog(ids),
            getUserMonthlyAttendance(ids),
          ])

          const monthlyLogsList = Object.values(monthlyLogsMap || {})
          const today = todayDateStr()
          const live = get()
          const alreadyClockedInToday =
            live.currentUserId === uid &&
            live.lastWorkDate === today &&
            hasGenuineClockInToday(live)

          let todayState = {}
          if (alreadyClockedInToday) {
            todayState = {
              clockedIn: live.clockedIn,
              clockInTime: live.clockInTime,
              clockInTimestamp: live.clockInTimestamp,
              clockOutTime: live.clockOutTime,
              isOnBreak: live.isOnBreak,
              breakStartTime: live.breakStartTime,
              accumulatedBreakSeconds: live.accumulatedBreakSeconds,
              accumulatedWorkSeconds: live.accumulatedWorkSeconds,
              todayShiftLogs: live.todayShiftLogs,
              isInExtraTime: live.isInExtraTime,
              extraTimeStart: live.extraTimeStart,
              accumulatedExtraSeconds: live.accumulatedExtraSeconds,
              extraTimeLogs: live.extraTimeLogs,
              lastWorkDate: live.lastWorkDate,
            }
          } else if (todayLog && attendanceLogBelongsToToday(todayLog, today)) {
            // Trust today's stored totals — prior completed sessions are valid
            // even when the current open session is short (multi-session days).
            const rawWorkSec = todayLog.regularSeconds ?? todayLog.accumulatedWorkSeconds ?? 0
            const clockInTime = formatTo12HourTime(todayLog.clockInTime) || todayLog.clockInTime || null
            let clockInTimestamp = toEpochMs(todayLog.clockInTimestamp)
            const clockMins = timeStrToMinutes(clockInTime)
            if (clockMins !== null) {
              const derived = timestampFromClockInTime(clockInTime)
              const tsDate = clockInTimestamp != null ? new Date(clockInTimestamp) : null
              const tsMins = tsDate && !Number.isNaN(tsDate.getTime())
                ? tsDate.getHours() * 60 + tsDate.getMinutes()
                : null
              // Keep the displayed clock-in time as source of truth (matches admin)
              if (tsMins !== clockMins) {
                clockInTimestamp = derived
              }
            }

            todayState = {
              clockedIn: Boolean(todayLog.clockedIn),
              clockInTime,
              clockInTimestamp,
              clockOutTime: formatTo12HourTime(todayLog.clockOutTime) || todayLog.clockOutTime || null,
              isOnBreak: Boolean(todayLog.isOnBreak),
              breakStartTime: todayLog.breakStartTime || null,
              accumulatedBreakSeconds: todayLog.accumulatedBreakSeconds || 0,
              accumulatedWorkSeconds: rawWorkSec,
              todayShiftLogs: todayLog.todayShiftLogs || todayLog.shiftLogs || [],
              isInExtraTime: Boolean(todayLog.isInExtraTime),
              extraTimeStart: todayLog.extraTimeStart || null,
              accumulatedExtraSeconds: todayLog.extraSeconds ?? todayLog.accumulatedExtraSeconds ?? 0,
              extraTimeLogs: todayLog.extraTimeLogs || [],
              lastWorkDate: todayLog.date || today,
            }
          } else {
            todayState = freshWorkdayFields(today)

            const leftoverHours =
              (todayLog?.regularSeconds || todayLog?.accumulatedWorkSeconds || 0) > 0 ||
              Boolean(todayLog?.autoClockOut) ||
              Boolean(todayLog?.clockOutTime) ||
              Boolean(todayLog?.clockedIn) ||
              Boolean(todayLog?.clockInTime) ||
              (todayLog?.todayShiftLogs || todayLog?.shiftLogs || []).length > 0

            // Overnight auto clock-out may have written 8h onto today's Firestore doc.
            // Clear it so a real Check In today does not merge with leftover hours.
            if (todayLog && todayLog.date === today && leftoverHours && uid) {
              upsertAttendanceLog(uid, {
                clockedIn: false,
                present: false,
                clockInTime: null,
                clockInTimestamp: null,
                clockOutTime: null,
                autoClockOut: false,
                isOnBreak: false,
                breakStartTime: null,
                accumulatedBreakSeconds: 0,
                accumulatedWorkSeconds: 0,
                regularSeconds: 0,
                regularHours: secToHrsStr(0),
                isInExtraTime: false,
                extraTimeStart: null,
                extraSeconds: 0,
                extraHours: secToHrsStr(0),
                extraTimeLogs: [],
                todayShiftLogs: [],
                shiftLogs: [],
                date: today,
              })
            }
          }

          // Dynamically compute REAL employee-wise attendanceStats
          const currentLive = {
            date: todayDateStr(),
            clockInTime: todayState.clockInTime,
            clockOutTime: todayState.clockOutTime,
            accumulatedWorkSeconds: todayState.accumulatedWorkSeconds,
            regularSeconds: todayState.accumulatedWorkSeconds,
          }
          const realStats = computeRealAttendanceStats(monthlyLogsList, currentLive)

          set({
            ...todayState,
            attendanceStats: realStats,
          })
        } catch (err) {
          console.error('[teamStore] Error loading user attendance from Firestore:', err)
        }
      },

      /**
       * Auto clock-out after 8 hours of work from clock-in (minus breaks).
       * Called by useAutoClockOutAfterWorkday when live worked time ≥ WORKDAY_SECONDS.
       * @param {object} userMeta - { uid, displayName, departmentName }
       */
      autoClockOutAfterWorkday: (userMeta = {}) => {
        const meta = resolveUserMeta(userMeta)
        if (get().rollOverStaleWorkday()) return
        const state = get()
        if (!state.clockedIn || state.isInExtraTime) return
        if (state.lastWorkDate && state.lastWorkDate !== todayDateStr()) return
        if (state.clockInTimestamp && state.clockInTimestamp < localMidnightMs()) {
          get().rollOverStaleWorkday()
          return
        }

        const nowMs = Date.now()
        let sessionSeconds = 0
        if (state.clockInTimestamp) {
          sessionSeconds = Math.max(0, Math.floor((nowMs - state.clockInTimestamp) / 1000))
        }

        let breakSec = state.accumulatedBreakSeconds || 0
        if (state.isOnBreak && state.breakStartTime) {
          breakSec += Math.max(0, Math.floor((nowMs - state.breakStartTime) / 1000))
        }

        const netSeconds = Math.max(0, sessionSeconds - breakSec)
        const totalSoFar = (state.accumulatedWorkSeconds || 0) + netSeconds
        if (totalSoFar < WORKDAY_SECONDS) return

        // Cap regular day at 8h; clock-out at the moment the 8h threshold was reached when possible
        const overflowSec = totalSoFar - WORKDAY_SECONDS
        const endTs = Math.max(
          state.clockInTimestamp || nowMs,
          nowMs - Math.max(0, overflowSec) * 1000
        )
        const endTime = new Date(endTs)
        const timeStr = canonicalTimeFromDate(endTime)
        const totalRegularSeconds = WORKDAY_SECONDS

        const record = {
          id: `ot_${Date.now()}`,
          date: todayDateStr(),
          regularSeconds: totalRegularSeconds,
          extraSeconds: state.accumulatedExtraSeconds,
          clockIn: state.clockInTime,
          clockOut: timeStr,
          autoClockOut: true,
        }

        const updatedLogs = [
          {
            id: `log_${Date.now()}`,
            type: 'auto_clock_out',
            label: 'Auto Clocked Out (8h)',
            time: timeStr,
            timestamp: endTs,
          },
          ...state.todayShiftLogs,
        ]

        set({
          clockedIn: false,
          clockOutTime: timeStr,
          clockInTimestamp: null,
          isOnBreak: false,
          breakStartTime: null,
          accumulatedWorkSeconds: totalRegularSeconds,
          accumulatedBreakSeconds: 0,
          lastWorkDate: todayDateStr(),
          todayShiftLogs: updatedLogs,
          overtimeRecords: [record, ...state.overtimeRecords],
        })

        if (meta.uid) {
          upsertAttendanceLog(meta.uid, {
            displayName: meta.displayName || 'Employee',
            departmentName: meta.departmentName || '',
            clockedIn: false,
            clockInTime: state.clockInTime,
            clockInTimestamp: null,
            clockOutTime: timeStr,
            autoClockOut: true,
            regularSeconds: totalRegularSeconds,
            regularHours: secToHrsStr(totalRegularSeconds),
            accumulatedWorkSeconds: totalRegularSeconds,
            accumulatedBreakSeconds: 0,
            isOnBreak: false,
            extraSeconds: state.accumulatedExtraSeconds,
            extraHours: secToHrsStr(state.accumulatedExtraSeconds),
            date: todayDateStr(),
            todayShiftLogs: updatedLogs,
            shiftLogs: updatedLogs,
          })
        }
      },

      /**
       * Toggle normal clock in / clock out.
       * @param {object} userMeta - { uid, displayName, departmentName }
       * @param {object} gate - clock-in location gate
       *   { requireOfficeLocation, locationVerified, wfhExempt, coords }
       * @returns {{ success: boolean, error?: string }}
       */
      toggleClockIn: (userMeta = {}, gate = {}) => {
        const meta = resolveUserMeta(userMeta)
        get().rollOverStaleWorkday()
        const state = get()
        const now = new Date()
        const timeStr = canonicalTimeFromDate(now)
        const today = todayDateStr()
        const midnight = localMidnightMs()

        if (!state.clockedIn) {
          // --- Clocking In ---
          const requireOffice = gate.requireOfficeLocation === true
          const allowed =
            !requireOffice ||
            gate.locationVerified === true ||
            gate.wfhExempt === true

          if (!allowed) {
            return {
              success: false,
              error: gate.error || 'You must be at the office to clock in.',
            }
          }

          const nowMs = Date.now()
          const isNewDay = state.lastWorkDate !== today || !hasGenuineClockInToday(state, midnight)

          const currentAccWorkSec = isNewDay ? 0 : (state.accumulatedWorkSeconds || 0)
          const currentAccBreakSec = isNewDay ? 0 : (state.accumulatedBreakSeconds || 0)
          const currentAccExtraSec = isNewDay ? 0 : (state.accumulatedExtraSeconds || 0)
          const currentShiftLogs = isNewDay ? [] : (state.todayShiftLogs || [])

          // First clock-in of the local day only — never reuse yesterday if they forgot to clock out
          const dayFirstClockIn = !isNewDay && state.clockInTime ? state.clockInTime : timeStr
          const newLogs = [
            {
              id: `log_${nowMs}`,
              type: 'clock_in',
              label: gate.wfhExempt ? 'Clocked In (WFH)' : 'Clocked In',
              time: timeStr,
              timestamp: nowMs,
            },
            ...currentShiftLogs,
          ]

          set({
            currentUserId: meta.uid || state.currentUserId,
            clockedIn: true,
            clockInTime: dayFirstClockIn,
            clockInTimestamp: nowMs,
            clockOutTime: null,
            isOnBreak: false,
            breakStartTime: null,
            accumulatedBreakSeconds: currentAccBreakSec,
            accumulatedWorkSeconds: currentAccWorkSec,
            isInExtraTime: false,
            extraTimeStart: null,
            accumulatedExtraSeconds: currentAccExtraSec,
            extraTimeLogs: isNewDay ? [] : state.extraTimeLogs,
            todayShiftLogs: newLogs,
            lastWorkDate: today,
          })

          // Write to Firestore
          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              clockedIn: true,
              present: true,
              clockInTime: dayFirstClockIn,
              clockInTimestamp: nowMs,
              clockOutTime: null,
              autoClockOut: false,
              regularSeconds: currentAccWorkSec,
              regularHours: secToHrsStr(currentAccWorkSec),
              accumulatedWorkSeconds: currentAccWorkSec,
              accumulatedBreakSeconds: currentAccBreakSec,
              isOnBreak: false,
              isInExtraTime: false,
              extraTimeStart: null,
              extraSeconds: currentAccExtraSec,
              extraHours: secToHrsStr(currentAccExtraSec),
              date: today,
              todayShiftLogs: newLogs,
              shiftLogs: newLogs,
              locationVerified: gate.locationVerified === true,
              wfhExempt: gate.wfhExempt === true,
              clockInCoords: gate.coords || null,
            })
          }
          return { success: true }
        } else {
          // --- Clocking Out ---
          const sessionDate =
            previousSessionDate(state, today) ||
            state.lastWorkDate ||
            today

          const sessionSeconds = state.clockInTimestamp
            ? Math.floor((Date.now() - state.clockInTimestamp) / 1000)
            : 0
          const netSeconds = Math.max(0, sessionSeconds - state.accumulatedBreakSeconds)
          const totalRegularSeconds = state.accumulatedWorkSeconds + netSeconds

          const newLog = {
            id: `log_${Date.now()}`,
            type: 'clock_out',
            label: 'Clocked Out',
            time: timeStr,
            timestamp: Date.now(),
          }
          const updatedLogs = [newLog, ...state.todayShiftLogs]

          const record = {
            id: `ot_${Date.now()}`,
            date: sessionDate,
            regularSeconds: totalRegularSeconds,
            extraSeconds: state.accumulatedExtraSeconds,
            clockIn: state.clockInTime,
            clockOut: timeStr,
            autoClockOut: false,
          }

          set({
            clockedIn: false,
            clockOutTime: timeStr,
            clockInTimestamp: null,
            isOnBreak: false,
            breakStartTime: null,
            accumulatedWorkSeconds: totalRegularSeconds,
            accumulatedBreakSeconds: 0,
            lastWorkDate: sessionDate,
            todayShiftLogs: updatedLogs,
            overtimeRecords: [record, ...state.overtimeRecords],
          })

          // Write to the session's date — never attach yesterday's clock-in to today
          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              clockedIn: false,
              clockInTime: state.clockInTime,
              clockInTimestamp: toEpochMs(state.clockInTimestamp),
              clockOutTime: timeStr,
              autoClockOut: false,
              regularSeconds: totalRegularSeconds,
              regularHours: secToHrsStr(totalRegularSeconds),
              accumulatedWorkSeconds: totalRegularSeconds,
              accumulatedBreakSeconds: 0,
              isOnBreak: false,
              extraSeconds: state.accumulatedExtraSeconds,
              extraHours: secToHrsStr(state.accumulatedExtraSeconds),
              date: sessionDate,
              todayShiftLogs: updatedLogs,
              shiftLogs: updatedLogs,
            })
          }
          return { success: true }
        }
      },

      /**
       * Toggle Extra / Overtime session (only after office hours end).
       * @param {object} userMeta - { uid, displayName, departmentName }
       */
      toggleExtraTime: (userMeta = {}) => {
        const meta = resolveUserMeta(userMeta)
        const state = get()
        const now = new Date()
        const timeStr = canonicalTimeFromDate(now)

        if (!state.isInExtraTime) {
          // If employee was active clockedIn, finalize regular shift first!
          let finalRegularSec = state.accumulatedWorkSeconds
          let updatedShiftLogs = state.todayShiftLogs
          if (state.clockedIn && state.clockInTimestamp) {
            const sessionSeconds = Math.floor((Date.now() - state.clockInTimestamp) / 1000)
            const netSeconds = Math.max(0, sessionSeconds - state.accumulatedBreakSeconds)
            finalRegularSec += netSeconds
            updatedShiftLogs = [
              {
                id: `log_${Date.now()}`,
                type: 'clock_out',
                label: 'Shift Ended (Started Extra Time)',
                time: timeStr,
                timestamp: Date.now(),
              },
              ...state.todayShiftLogs,
            ]
          }

          const newExtraLog = {
            id: `xt_${Date.now()}`,
            type: 'extra_start',
            label: 'Extra Time Started',
            time: timeStr,
            timestamp: Date.now(),
          }

          set({
            clockedIn: false,
            clockInTimestamp: null,
            clockOutTime: state.clockedIn ? timeStr : state.clockOutTime,
            isOnBreak: false,
            breakStartTime: null,
            accumulatedWorkSeconds: finalRegularSec,
            accumulatedBreakSeconds: 0,
            isInExtraTime: true,
            extraTimeStart: Date.now(),
            extraTimeLogs: [newExtraLog, ...state.extraTimeLogs],
            todayShiftLogs: updatedShiftLogs,
          })

          // Write complete attendance snapshot to Firestore
          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              clockedIn: false,
              clockInTime: state.clockInTime,
              clockInTimestamp: null,
              clockOutTime: state.clockedIn ? timeStr : state.clockOutTime,
              regularSeconds: finalRegularSec,
              regularHours: secToHrsStr(finalRegularSec),
              accumulatedWorkSeconds: finalRegularSec,
              accumulatedBreakSeconds: 0,
              isOnBreak: false,
              isInExtraTime: true,
              extraTimeStart: Date.now(),
              extraSeconds: state.accumulatedExtraSeconds,
              extraHours: secToHrsStr(state.accumulatedExtraSeconds),
              date: todayDateStr(),
              todayShiftLogs: updatedShiftLogs,
              shiftLogs: updatedShiftLogs,
            })
          }
        } else {
          const extraSessionSec = state.extraTimeStart
            ? Math.floor((Date.now() - state.extraTimeStart) / 1000)
            : 0
          const totalExtra = state.accumulatedExtraSeconds + extraSessionSec

          const newLog = {
            id: `xt_${Date.now()}`,
            type: 'extra_end',
            label: 'Extra Time Ended',
            time: timeStr,
            timestamp: Date.now(),
          }
          const updatedExtraLogs = [newLog, ...state.extraTimeLogs]

          const updatedRecords = state.overtimeRecords.map((rec, idx) =>
            idx === 0 ? { ...rec, extraSeconds: totalExtra } : rec
          )

          set({
            isInExtraTime: false,
            extraTimeStart: null,
            accumulatedExtraSeconds: totalExtra,
            extraTimeLogs: updatedExtraLogs,
            overtimeRecords: updatedRecords,
          })

          // Write to Firestore
          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              isInExtraTime: false,
              extraTimeStart: null,
              extraSeconds: totalExtra,
              extraHours: secToHrsStr(totalExtra),
              extraTimeLogs: updatedExtraLogs,
            })
          }
        }
      },

      toggleBreak: (userMeta = {}) => {
        const meta = resolveUserMeta(userMeta)
        const state = get()
        if (!state.clockedIn) return
        const now = new Date()
        const timeStr = canonicalTimeFromDate(now)

        if (!state.isOnBreak) {
          const breakStartMs = Date.now()
          const newLog = {
            id: `log_${breakStartMs}`,
            type: 'break_start',
            label: 'Started Break',
            time: timeStr,
            timestamp: breakStartMs,
          }
          const updatedLogs = [newLog, ...state.todayShiftLogs]
          set({
            isOnBreak: true,
            breakStartTime: breakStartMs,
            todayShiftLogs: updatedLogs,
          })

          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              isOnBreak: true,
              breakStartTime: breakStartMs,
              todayShiftLogs: updatedLogs,
              shiftLogs: updatedLogs,
            })
          }
        } else {
          const breakDuration = state.breakStartTime
            ? Math.floor((Date.now() - state.breakStartTime) / 1000)
            : 0
          const newBreakTotal = state.accumulatedBreakSeconds + breakDuration
          const newLog = {
            id: `log_${Date.now()}`,
            type: 'break_end',
            label: 'Ended Break',
            time: timeStr,
            timestamp: Date.now(),
          }
          const updatedLogs = [newLog, ...state.todayShiftLogs]
          set({
            isOnBreak: false,
            breakStartTime: null,
            accumulatedBreakSeconds: newBreakTotal,
            todayShiftLogs: updatedLogs,
          })

          if (meta.uid) {
            upsertAttendanceLog(meta.uid, {
              displayName: meta.displayName || 'Employee',
              departmentName: meta.departmentName || '',
              isOnBreak: false,
              breakStartTime: null,
              accumulatedBreakSeconds: newBreakTotal,
              todayShiftLogs: updatedLogs,
              shiftLogs: updatedLogs,
            })
          }
        }
      },
    }),
    {
      name: 'crm_employee_team_store',
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        clockedIn: state.clockedIn,
        clockInTime: state.clockInTime,
        clockInTimestamp: state.clockInTimestamp,
        clockOutTime: state.clockOutTime,
        isOnBreak: state.isOnBreak,
        breakStartTime: state.breakStartTime,
        accumulatedBreakSeconds: state.accumulatedBreakSeconds,
        accumulatedWorkSeconds: state.accumulatedWorkSeconds,
        todayShiftLogs: state.todayShiftLogs,
        isInExtraTime: state.isInExtraTime,
        extraTimeStart: state.extraTimeStart,
        accumulatedExtraSeconds: state.accumulatedExtraSeconds,
        extraTimeLogs: state.extraTimeLogs,
        overtimeRecords: state.overtimeRecords,
        lastWorkDate: state.lastWorkDate,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const today = todayDateStr()
        if (isStaleLocalAttendance(state, today)) {
          Object.assign(state, freshWorkdayFields(today))
        }
      },
    }
  )
)

