import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { getEmployees, recordAttendanceInDb, createLeaveRequest } from './services/teamService'
import {
  prepareClockInGate,
  getWeeklyClockInPromptState,
  LOCATION_GATE_ENABLED,
} from './services/wfhAttendanceUtils'
import {
  resolveEmployeeWfhPolicy,
  countUsedWfhDays,
  validateWfhRequest,
} from './services/wfhPolicyUtils'
import { applyLopConversion, resolveLeaveLimits } from './services/leaveEntitlementUtils'
import { AttendanceMetricsBar } from './components/AttendanceMetricsBar'
import { formatTo12HourTime, resolveEmployeeDisplayName } from './services/attendanceStatsUtils'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import {
  Users,
  CheckCircle2,
  Calendar,
  Clock,
  LogIn,
  LogOut,
  AlertCircle,
  Loader2,
  Home,
  Building2,
  X,
} from 'lucide-react'

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const AttendancePage = () => {
  const {
    employees,
    setEmployees,
    leaveRequests,
    setLeaveRequests,
    addLeaveRequest,
    clockedIn,
    clockInTime,
    toggleClockIn,
    loadUserAttendance,
  } = useTeamStore()
  const { user, userDoc } = useUserStore()

  const activeUid = userDoc?.uid || user?.uid
  const [clockBusy, setClockBusy] = useState(false)
  const [clockError, setClockError] = useState('')
  const [wfhChoiceOpen, setWfhChoiceOpen] = useState(false)
  const [wfhChoiceMeta, setWfhChoiceMeta] = useState({ remaining: 0, limit: 0 })

  useEffect(() => {
    if (activeUid) {
      loadUserAttendance(activeUid)
    }
  }, [activeUid, loadUserAttendance])

  useEffect(() => {
    if (employees.length === 0) {
      getEmployees().then((data) => {
        if (data && data.length > 0) setEmployees(data)
      }).catch(() => {})
    }
  }, [employees.length, setEmployees])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) => {
        setLeaveRequests(snap.docs.map((d) => ({ ...d.data(), leaveId: d.id })))
      },
      (err) => console.error('Error listening to leave requests:', err)
    )
    return () => unsub()
  }, [setLeaveRequests])

  const currentEmp =
    employees.find(
      (e) =>
        (activeUid && (e.uid === activeUid || e.employeeId === activeUid)) ||
        (user?.email && e.email?.toLowerCase() === user.email.toLowerCase())
    ) || userDoc || {}

  const loggedInName = resolveEmployeeDisplayName(
    currentEmp,
    { displayName: user?.displayName, email: user?.email || userDoc?.email },
    user?.email || ''
  )

  const employeeFilter = {
    employeeId: activeUid,
    uid: activeUid,
    employeeEmail: user?.email || userDoc?.email || currentEmp?.email,
    employeeName: loggedInName,
  }

  const completeClockIn = async (gate) => {
    const meta = {
      uid: activeUid,
      displayName: loggedInName,
      departmentName: currentEmp?.departmentName || userDoc?.departmentName || '',
      email: user?.email || userDoc?.email || currentEmp?.email,
    }

    const result = toggleClockIn(meta, {
      requireOfficeLocation: gate.requireOfficeLocation,
      locationVerified: gate.locationVerified,
      wfhExempt: gate.wfhExempt,
      coords: gate.coords,
    })

    if (result && result.success === false) {
      setClockError(result.error || 'Unable to clock in.')
      return false
    }

    await recordAttendanceInDb({
      uid: activeUid,
      displayName: loggedInName,
      action: 'clock_in',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      date: toDateKey(),
    })
    return true
  }

  const runOfficeClockIn = async () => {
    const gate = await prepareClockInGate({
      emp: currentEmp,
      leaveRequests,
      employeeFilter,
    })

    if (!gate.ok) {
      setClockError(gate.error || 'Unable to clock in.')
      return
    }

    await completeClockIn(gate)
  }

  const handleClockToggle = async () => {
    setClockError('')
    const meta = {
      uid: activeUid,
      displayName: loggedInName,
      departmentName: currentEmp?.departmentName || userDoc?.departmentName || '',
      email: user?.email || userDoc?.email || currentEmp?.email,
    }

    if (clockedIn) {
      toggleClockIn(meta)
      await recordAttendanceInDb({
        uid: activeUid,
        displayName: loggedInName,
        action: 'clock_out',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        date: toDateKey(),
      })
      return
    }

    setClockBusy(true)
    try {
      if (LOCATION_GATE_ENABLED) {
        const prompt = getWeeklyClockInPromptState({
          emp: currentEmp,
          leaveRequests,
          employeeFilter,
        })

        if (prompt.showPrompt) {
          setWfhChoiceMeta({ remaining: prompt.remaining, limit: prompt.limit })
          setWfhChoiceOpen(true)
          return
        }
      }

      await runOfficeClockIn()
    } catch (err) {
      console.error('Clock-in gate error:', err)
      setClockError('Unable to verify location. Try again.')
    } finally {
      setClockBusy(false)
    }
  }

  const handleChooseOffice = async () => {
    setWfhChoiceOpen(false)
    setClockError('')
    setClockBusy(true)
    try {
      await runOfficeClockIn()
    } catch (err) {
      console.error('Clock-in gate error:', err)
      setClockError('Unable to verify location. Try again.')
    } finally {
      setClockBusy(false)
    }
  }

  const handleChooseWfh = async () => {
    setClockError('')
    setClockBusy(true)
    try {
      const today = toDateKey()
      const policy = resolveEmployeeWfhPolicy(currentEmp)
      const used = countUsedWfhDays(leaveRequests, employeeFilter, policy, today)
      const wfhError = validateWfhRequest(policy, used, 1)
      if (wfhError) {
        setClockError(wfhError)
        setWfhChoiceOpen(false)
        return
      }

      const conversion = applyLopConversion({
        requestedType: 'Work From Home',
        startDate: today,
        endDate: today,
        days: 1,
        leaveRequests,
        employeeFilter,
        limits: resolveLeaveLimits(currentEmp || {}),
      })

      const created = await createLeaveRequest({
        employeeName: loggedInName,
        employeeId: activeUid,
        employeeEmail: employeeFilter.employeeEmail || '',
        leaveType: conversion.leaveType,
        requestedLeaveType: conversion.requestedLeaveType,
        convertedToLop: conversion.convertedToLop,
        startDate: today,
        endDate: today,
        days: 1,
        reason: conversion.convertedToLop
          ? 'Weekly WFH selected at clock-in (over monthly WFH cap → LOP)'
          : 'Weekly WFH selected at clock-in',
        status: 'approved',
        autoApproved: true,
        reviewedBy: 'WFH Clock-In',
        createdVia: 'clock_in',
      })
      addLeaveRequest(created)

      setWfhChoiceOpen(false)
      await completeClockIn({
        requireOfficeLocation: false,
        locationVerified: false,
        wfhExempt: true,
        coords: null,
      })
    } catch (err) {
      console.error('Weekly WFH clock-in error:', err)
      setClockError('Unable to start WFH clock-in. Try again.')
    } finally {
      setClockBusy(false)
    }
  }

  // Only show the currently logged-in employee's record
  const myRecord = employees.find(
    (e) => e.displayName === loggedInName || e.uid === user?.uid
  )

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Attendance & Daily Presence Tracker"
          description="Your clock-in/out status, shift log, and daily presence"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/directory"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
              }`
            }
          >
            <Users className="w-3.5 h-3.5" /> Employee Directory
          </NavLink>
          <NavLink
            to="/attendance"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
              }`
            }
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Tracker
          </NavLink>
          <NavLink
            to="/team/leave"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
              }`
            }
          >
            <Calendar className="w-3.5 h-3.5" /> Leave Management
          </NavLink>
        </div>
      </div>

      {/* Clock Status Banner */}
      <Card className="p-5 bg-gradient-to-r from-chrome via-accent-soft to-chrome dark:from-surface dark:via-surface dark:to-accent-soft border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold shadow-lg ${clockedIn ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'}`}>
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-fg text-sm">
              Your Current Status:{' '}
              <span className={clockedIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                {clockedIn ? `Clocked In since ${formatTo12HourTime(clockInTime)}` : 'Clocked Out'}
              </span>
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Shift duration automatically calculated and synced with your attendance records.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {clockError && (
            <div className="flex items-start gap-2 text-xs text-rose-600 dark:text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 max-w-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{clockError}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Badge variant={clockedIn ? 'success' : 'warning'}>
              {clockedIn ? 'On Duty' : 'Off Duty'}
            </Badge>
            <Button
              variant={clockedIn ? 'danger' : 'primary'}
              onClick={handleClockToggle}
              disabled={clockBusy}
              icon={clockBusy ? Loader2 : clockedIn ? LogOut : LogIn}
            >
              {clockBusy ? (LOCATION_GATE_ENABLED ? 'Checking…' : 'Working…') : clockedIn ? 'Clock Out' : 'Check In'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Weekly WFH vs Office choice — used when LOCATION_GATE_ENABLED */}
      {LOCATION_GATE_ENABLED && wfhChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]">
          <Card className="w-full max-w-md p-5 border-border shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-fg">
                  How are you working today?
                </h3>
                <p className="text-xs text-muted mt-1">
                  Weekly WFH remaining: {wfhChoiceMeta.remaining} of {wfhChoiceMeta.limit} day(s).
                  Choosing WFH uses 1 day and skips office location.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWfhChoiceOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-chrome"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={clockBusy}
                onClick={handleChooseWfh}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-accent/20 dark:border-accent/40 bg-accent-soft hover:border-accent transition-colors text-left disabled:opacity-60"
              >
                <Home className="w-5 h-5 text-accent" />
                <span className="text-sm font-semibold text-fg">WFH mode</span>
                <span className="text-[11px] text-muted">
                  Work from home — no office GPS required
                </span>
              </button>
              <button
                type="button"
                disabled={clockBusy}
                onClick={handleChooseOffice}
                className="flex flex-col items-start gap-2 p-4 rounded-xl border border-border bg-slate-50 dark:bg-slate-900/60 hover:border-slate-400 dark:hover:border-slate-500 transition-colors text-left disabled:opacity-60"
              >
                <Building2 className="w-5 h-5 text-fg" />
                <span className="text-sm font-semibold text-fg">Office mode</span>
                <span className="text-[11px] text-muted">
                  Must be at the office location to check in
                </span>
              </button>
            </div>
            {clockBusy && (
              <p className="text-xs text-muted flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
              </p>
            )}
          </Card>
        </div>
      )}

      {/* Personal Summary Metrics: 5-Card Bar (Status, Clock In, Clock Out, Worked Hours, Late By) */}
      <AttendanceMetricsBar />

      {/* My Attendance Record */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-chrome/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Employee</th>
              <th className="p-4 font-semibold">Department</th>
              <th className="p-4 font-semibold">Clock In Time</th>
              <th className="p-4 font-semibold">Shift Hours</th>
              <th className="p-4 font-semibold">Presence Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {myRecord ? (
              <tr className="hover:bg-chrome/30 transition-colors text-fg">
                <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{myRecord.displayName}</td>
                <td className="p-4 text-fg">{myRecord.departmentName || '—'}</td>
                <td className="p-4 text-muted">{clockedIn ? formatTo12HourTime(clockInTime) : '—'}</td>
                <td className="p-4 font-semibold text-accent">
                  {clockedIn ? '8.0 hrs' : '—'}
                </td>
                <td className="p-4">
                  <Badge variant={clockedIn ? 'success' : 'warning'}>
                    {clockedIn ? 'Present' : 'Off Duty'}
                  </Badge>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan="5" className="p-6 text-center text-muted text-xs">
                  No attendance record found. Clock in to start your shift.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
