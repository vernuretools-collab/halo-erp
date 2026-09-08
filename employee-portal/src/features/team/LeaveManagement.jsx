import React, { useState, useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { getEmployees, createLeaveRequest, updateLeaveStatusInDb, deleteLeaveRequestFromDb } from './services/teamService'
import {
  resolveEmployeeWfhPolicy,
  countUsedWfhDays,
  validateWfhRequest,
  getWfhAllowanceLabel,
  getWfhLeaveStatus,
} from './services/wfhPolicyUtils'
import {
  applyLopConversion,
  countUsedPaidDays,
  expandLeaveWorkingDates,
  countUsedPermissionHours,
  formatHoursAsHrsMins,
  formatLeaveDuration,
  formatLeaveTypeLabel,
  hoursBetween,
  PERMISSION_LEAVE_TYPE,
  EMERGENCY_LEAVE_TYPE,
  resolveLeaveLimits,
  resolvePermissionHours,
} from './services/leaveEntitlementUtils'
import { Users, CheckCircle2, Calendar, Plus, X, Clock, AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, ChevronDown, Trash2, Ban, Home } from 'lucide-react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'

const SINGLE_DAY_LEAVE_TYPES = new Set([
  'Work From Home',
  'Sick Leave',
  'Casual Leave',
  'Permission',
])

const isSingleDayLeaveType = (type) => SINGLE_DAY_LEAVE_TYPES.has(type)
const ON_DUTY_BACKDATE_DAYS = 3

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

const parseHHmm = (value) => {
  if (!value || !/^\d{1,2}:\d{2}/.test(value)) return { hour: '', minute: '', period: 'AM' }
  const [hStr, mStr] = value.split(':')
  const h24 = Number(hStr)
  if (!Number.isFinite(h24)) return { hour: '', minute: '', period: 'AM' }
  return {
    hour: String(h24 % 12 === 0 ? 12 : h24 % 12),
    minute: String(Number(mStr)).padStart(2, '0'),
    period: h24 >= 12 ? 'PM' : 'AM',
  }
}

const toHHmm = (hour, minute, period) => {
  if (!hour || minute === '' || minute == null || !period) return ''
  let h = Number(hour)
  if (period === 'AM') {
    if (h === 12) h = 0
  } else if (h !== 12) {
    h += 12
  }
  return `${String(h).padStart(2, '0')}:${minute}`
}

const NumberDropdownField = ({ value, onChange, options, placeholder, min, max, pad }) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const wrapRef = useRef(null)

  useEffect(() => {
    setDraft(value || '')
  }, [value])

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const commit = (raw) => {
    const digits = String(raw ?? '').replace(/\D/g, '')
    if (digits === '') {
      setDraft('')
      onChange('')
      return
    }
    let n = Number(digits)
    if (Number.isFinite(min)) n = Math.max(min, n)
    if (Number.isFinite(max)) n = Math.min(max, n)
    const next = pad ? String(n).padStart(2, '0') : String(n)
    setDraft(next)
    onChange(next)
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, '').slice(0, 2)
          setDraft(next)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => commit(draft)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit(draft)
            setOpen(false)
          }
        }}
        className="w-full bg-surface border border-border text-fg text-sm rounded-xl py-2.5 pl-2.5 pr-6 focus:outline-none focus:border-accent"
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Choose ${placeholder}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-36 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                commit(opt)
                setOpen(false)
              }}
              className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-chrome ${
                String(value) === String(opt) ? 'text-accent font-semibold' : 'text-fg'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const PermissionTimeSelect = ({ label, value, onChange }) => {
  const parsed = parseHHmm(value)
  const [hour, setHour] = useState(parsed.hour)
  const [minute, setMinute] = useState(parsed.minute)
  const [period, setPeriod] = useState(parsed.period)

  useEffect(() => {
    const next = parseHHmm(value)
    setHour(next.hour)
    setMinute(next.minute)
    setPeriod(next.period)
  }, [value])

  const emit = (nextHour, nextMinute, nextPeriod) => {
    onChange(toHHmm(nextHour, nextMinute, nextPeriod))
  }

  return (
    <div className="space-y-1.5 text-left">
      <label className="block text-xs font-medium text-fg">{label}</label>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
        <NumberDropdownField
          value={hour}
          onChange={(next) => {
            setHour(next)
            emit(next, minute, period)
          }}
          options={HOUR_OPTIONS}
          placeholder="Hr"
          min={1}
          max={12}
        />
        <NumberDropdownField
          value={minute}
          onChange={(next) => {
            setMinute(next)
            emit(hour, next, period)
          }}
          options={MINUTE_OPTIONS}
          placeholder="Min"
          min={0}
          max={59}
          pad
        />
        <div className="inline-flex rounded-xl border border-border overflow-hidden text-[11px] font-semibold">
          {['AM', 'PM'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setPeriod(p)
                emit(hour, minute, p)
              }}
              className={`px-2.5 py-2.5 ${
                period === p
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:text-fg'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Modern Interactive Calendar Picker Component ─────────────────────────────
const InteractiveCalendarPicker = ({ startDate, setStartDate, endDate, setEndDate, leaveType, setValidationError }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const singleDayOnly = isSingleDayLeaveType(leaveType)

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate()

  const toLocalDateStr = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const todayLocal = new Date()
  todayLocal.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateStr(todayLocal)

  // Min selectable date by leave type.
  // Casual Leave: exactly 3 calendar days in advance (today + 3).
  // On Duty: today minus 3 calendar days (backdated apply window).
  // Urgent types: today onwards.
  const getMinAllowedDate = () => {
    if (leaveType === 'On Duty') {
      const cursor = new Date(todayLocal)
      cursor.setDate(cursor.getDate() - ON_DUTY_BACKDATE_DAYS)
      return toLocalDateStr(cursor)
    }

    if (
      leaveType === 'Sick Leave' ||
      leaveType === EMERGENCY_LEAVE_TYPE ||
      leaveType === 'LOP (Loss of Pay)' ||
      leaveType === 'Work From Home' ||
      leaveType === 'Permission'
    ) {
      return todayStr
    }

    if (leaveType === 'Casual Leave') {
      const cursor = new Date(todayLocal)
      cursor.setDate(cursor.getDate() + 3)
      return toLocalDateStr(cursor)
    }

    // Other standard leave types: 3 calendar days advance
    const cursor = new Date(todayLocal)
    cursor.setDate(cursor.getDate() + 3)
    return toLocalDateStr(cursor)
  }

  const minAllowedDate = getMinAllowedDate()

  const handleDayClick = (day) => {
    const mStr = String(currentMonth + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    const clickedDate = `${currentYear}-${mStr}-${dStr}`

    if (clickedDate < minAllowedDate) {
      if (leaveType === 'On Duty') {
        setValidationError(
          `On Duty can be applied only up to the previous ${ON_DUTY_BACKDATE_DAYS} dates. Earliest available date is ${minAllowedDate}.`
        )
      } else if (
        leaveType === 'Sick Leave' ||
        leaveType === EMERGENCY_LEAVE_TYPE ||
        leaveType === 'LOP (Loss of Pay)' ||
        leaveType === 'Work From Home' ||
        leaveType === 'Permission'
      ) {
        setValidationError('Past dates cannot be selected.')
      } else if (leaveType === 'Casual Leave') {
        setValidationError(
          `Casual Leave can only be selected at least 3 days in advance. Earliest available date is ${minAllowedDate}.`
        )
      } else {
        setValidationError(`Standard leaves require 3 days advance notice. Earliest available date is ${minAllowedDate}.`)
      }
      return
    }

    setValidationError('')

    // WFH / Sick / Casual: single date only (1 Day)
    if (singleDayOnly) {
      setStartDate(clickedDate)
      setEndDate(clickedDate)
      return
    }

    // On Duty and other types: allow start–end range
    if (!startDate || (startDate && endDate && startDate !== endDate)) {
      setStartDate(clickedDate)
      setEndDate(clickedDate)
    } else if (startDate && (!endDate || endDate === startDate)) {
      if (clickedDate < startDate) {
        setStartDate(clickedDate)
        setEndDate(clickedDate)
      } else {
        setEndDate(clickedDate)
      }
    }
  }

  const daysCount = singleDayOnly
    ? 1
    : startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
      : 1

  return (
    <div className="space-y-2">
      {/* Trigger Button (Always visible) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface border border-border hover:border-accent/50 text-fg text-xs font-medium rounded-xl py-3 px-3.5 flex items-center justify-between transition-all group"
      >
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
          {startDate ? (
            singleDayOnly || !endDate || endDate === startDate ? (
              <span className="text-fg">
                Leave Date: <strong className="text-accent font-semibold">{startDate}</strong>
                {leaveType === 'Permission' ? '' : ' (1 Day)'}
              </span>
            ) : (
              <span className="text-fg">
                Leave: <strong className="text-accent font-semibold">{startDate}</strong> to <strong className="text-accent font-semibold">{endDate}</strong> ({daysCount} Days)
              </span>
            )
          ) : (
            <span className="text-muted">
              {singleDayOnly ? 'Click to choose leave date from calendar...' : 'Click to choose leave dates from calendar...'}
            </span>
          )}
        </div>
        <span className="text-[11px] text-accent font-semibold bg-accent-soft px-2.5 py-1 rounded-lg">
          {isOpen ? 'Close Calendar' : startDate ? 'Change Date' : 'Choose Date'}
        </span>
      </button>

      {/* Expandable Calendar Grid */}
      {isOpen && (
        <div className="space-y-3 bg-surface border border-border rounded-2xl p-4 text-left shadow-sm transition-all">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span className="font-bold text-fg text-xs">
                {months[currentMonth]} {currentYear}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 text-muted hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-chrome transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 text-muted hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-chrome transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-slate-400">
            {weekDays.map((wd) => (
              <div key={wd} className="py-1">{wd}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty_${i}`} className="py-2" />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const day = i + 1
              const mStr = String(currentMonth + 1).padStart(2, '0')
              const dStr = String(day).padStart(2, '0')
              const dateStr = `${currentYear}-${mStr}-${dStr}`

              const isToday = dateStr === todayStr
              const isDisabled = dateStr < minAllowedDate
              const isSelectedStart = dateStr === startDate
              const isSelectedEnd = !singleDayOnly && dateStr === endDate && endDate !== startDate
              const isInRange = !singleDayOnly && startDate && endDate && dateStr > startDate && dateStr < endDate

              let cellClass = 'text-fg hover:bg-accent-soft hover:text-accent font-medium'
              if (isDisabled) {
                cellClass = 'text-muted opacity-60 cursor-not-allowed line-through bg-chrome font-normal'
              } else if (isSelectedStart || isSelectedEnd) {
                cellClass = 'bg-accent text-white font-bold'
              } else if (isInRange) {
                cellClass = 'bg-accent-soft text-accent font-semibold'
              } else if (isToday) {
                cellClass = 'border border-accent/50 text-accent font-bold'
              }

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleDayClick(day)}
                  className={`py-2 rounded-xl text-xs transition-all ${cellClass}`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted font-medium">
              {leaveType === 'Casual Leave'
                ? `Casual Leave: select a date from ${minAllowedDate} onwards (3 days advance)`
                : leaveType === 'On Duty'
                  ? `On Duty: from ${minAllowedDate} onwards (up to previous ${ON_DUTY_BACKDATE_DAYS} dates)`
                : singleDayOnly
                  ? 'Select a single date (1 Day)'
                  : 'Click start and end dates to select leave range'}
            </span>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-accent hover:opacity-90 text-white font-semibold rounded-lg text-xs transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export const LeaveManagement = () => {
  const { employees, setEmployees, leaveRequests, setLeaveRequests, addLeaveRequest, updateLeaveStatus, removeLeaveRequest } = useTeamStore()
  const { user, userDoc } = useUserStore()

  // Match current user in employees list or derive from userDoc / user / email
  const currentEmp = employees.find(
    (e) => (user?.uid && (e.uid === user.uid || e.employeeId === user.uid)) || (user?.email && e.email?.toLowerCase() === user.email.toLowerCase())
  )

  const resolvedEmployeeName =
    currentEmp?.displayName ||
    currentEmp?.name ||
    userDoc?.displayName ||
    userDoc?.name ||
    user?.displayName ||
    (user?.email
      ? user.email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Employee')

  const resolvedEmployeeEmail = user?.email || userDoc?.email || currentEmp?.email || ''
  const resolvedEmployeeId = user?.uid || userDoc?.uid || currentEmp?.uid || ''

  const loggedInEmployeeInitials = resolvedEmployeeName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('') || 'E'

  const [showAddModal, setShowAddModal] = useState(false)
  const [leaveType, setLeaveType] = useState('Casual Leave')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const [loadingLeave, setLoadingLeave] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'cancel' | 'delete', request }
  const [actionLoading, setActionLoading] = useState(false)
  const singleDayOnly = isSingleDayLeaveType(leaveType)

  const currentMonthStr = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const currentMonthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  const wfhPolicy = resolveEmployeeWfhPolicy(currentEmp || userDoc || {})
  const leaveLimits = resolveLeaveLimits(currentEmp || userDoc || {})
  const permissionHoursLimit = resolvePermissionHours(currentEmp || userDoc || {})

  // Real-time Firestore sync for leave requests
  useEffect(() => {
    setLoadingLeave(true)
    const unsub = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), leaveId: d.id }))
        setLeaveRequests(list)
        setLoadingLeave(false)
      },
      (err) => {
        console.error('Error listening to leave requests:', err)
        setLoadingLeave(false)
      }
    )
    getEmployees().then((empData) => {
      if (empData && empData.length > 0) setEmployees(empData)
    }).catch(() => {})
    return () => unsub()
  }, [setLeaveRequests, setEmployees])

  useEffect(() => {
    if (!wfhPolicy.leaveFormEnabled && leaveType === 'Work From Home') {
      setLeaveType('Casual Leave')
    }
  }, [wfhPolicy.leaveFormEnabled, leaveType])

  // Filter this employee's own leave requests using UID, Email, or Name for robust persistence across refreshes
  const myLeaveRequests = leaveRequests.filter((l) => {
    const uid = resolvedEmployeeId || user?.uid || ''
    if (uid && (l.employeeId === uid || l.uid === uid || l.employeeId === user?.uid)) return true
    if (
      resolvedEmployeeEmail &&
      l.employeeEmail &&
      l.employeeEmail.toLowerCase() === resolvedEmployeeEmail.toLowerCase()
    ) {
      return true
    }
    if (
      l.employeeName &&
      l.employeeName !== 'Team Staff' &&
      resolvedEmployeeName &&
      l.employeeName.toLowerCase() === resolvedEmployeeName.toLowerCase()
    ) {
      return true
    }
    if (
      l.employeeName === 'Team Staff' &&
      resolvedEmployeeEmail &&
      (!l.employeeEmail || l.employeeEmail.toLowerCase() === resolvedEmployeeEmail.toLowerCase())
    ) {
      return true
    }
    return false
  })

  const pendingRequests = myLeaveRequests.filter((l) => l.status === 'pending').length
  const approvedRequests = myLeaveRequests.filter((l) => l.status === 'approved')

  const currentMonthApproved = approvedRequests.filter((l) => {
    return l.startDate && l.startDate.startsWith(currentMonthStr)
  })

  const leaveMonthKey = (date) => (date ? String(date).slice(0, 7) : '')
  const visibleLeaveRequests = myLeaveRequests.filter((l) => {
    const startMonth = leaveMonthKey(l.startDate)
    const endMonth = leaveMonthKey(l.endDate || l.startDate)
    if (!startMonth && !endMonth) return true
    return startMonth >= currentMonthStr || endMonth >= currentMonthStr
  })

  const employeeWfhFilter = {
    employeeId: resolvedEmployeeId,
    uid: user?.uid,
    employeeEmail: resolvedEmployeeEmail,
    employeeName: resolvedEmployeeName,
  }

  const usedCasualDaysThisMonth = countUsedPaidDays(
    myLeaveRequests,
    employeeWfhFilter,
    'casual',
    currentMonthStr
  )

  const usedSickDaysThisMonth = countUsedPaidDays(
    myLeaveRequests,
    employeeWfhFilter,
    'sick',
    currentMonthStr
  )

  const usedPaidWfhDaysThisMonth = countUsedPaidDays(
    myLeaveRequests,
    employeeWfhFilter,
    'wfh',
    currentMonthStr
  )

  const remainingCasualDays = Math.max(0, leaveLimits.casual - usedCasualDaysThisMonth)
  const remainingSickDays = Math.max(0, leaveLimits.sick - usedSickDaysThisMonth)
  const remainingPaidWfhDays = Math.max(0, leaveLimits.wfh - usedPaidWfhDaysThisMonth)

  const usedPermissionHoursThisMonth = countUsedPermissionHours(
    myLeaveRequests,
    employeeWfhFilter,
    currentMonthStr
  )
  const remainingPermissionHours = Math.max(
    0,
    Math.round((permissionHoursLimit - usedPermissionHoursThisMonth) * 100) / 100
  )

  const wfhReferenceDate = startDate || new Date().toISOString().split('T')[0]
  const usedWfhDays = countUsedWfhDays(myLeaveRequests, employeeWfhFilter, wfhPolicy, wfhReferenceDate)
  const remainingWfhDays =
    wfhPolicy.leaveFormEnabled || wfhPolicy.clockInChoice
      ? Math.max(0, (Number(wfhPolicy.limit) || 1) - usedWfhDays)
      : null
  const isFullWfh = wfhPolicy.mode === 'full'
  const isWeeklyWfh = wfhPolicy.mode === 'weekly'
  const wfhCardLimit = isWeeklyWfh ? (Number(wfhPolicy.limit) || 1) : leaveLimits.wfh
  const wfhCardUsed = isWeeklyWfh ? usedWfhDays : usedPaidWfhDaysThisMonth
  const wfhCardRemaining = isWeeklyWfh
    ? Math.max(0, wfhCardLimit - usedWfhDays)
    : remainingPaidWfhDays
  const wfhCardPeriodLabel = isWeeklyWfh ? 'this week' : currentMonthName
  const wfhCardTitle = isWeeklyWfh ? 'Weekly Work From Home' : 'Monthly Work From Home'

  const handleRequestLeave = async (e) => {
    e.preventDefault()
    setValidationError('')

    // Require reason
    if (!reason.trim()) {
      setValidationError('Reason for leave is required.')
      return
    }

    if (!startDate) {
      setValidationError('Please select a leave date.')
      return
    }

    const stableEmployeeId = user?.uid || userDoc?.uid || currentEmp?.uid || resolvedEmployeeId
    const stableEmployeeEmail =
      user?.email || userDoc?.email || currentEmp?.email || resolvedEmployeeEmail || ''
    const stableEmployeeName = resolvedEmployeeName

    if (!stableEmployeeId && !stableEmployeeEmail) {
      setValidationError('Unable to identify your account. Please sign in again and retry.')
      return
    }

    const reqStartDate = new Date(startDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    reqStartDate.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((reqStartDate - today) / (1000 * 60 * 60 * 24))

    // Casual Leave requires at least 3 calendar days advance notice
    if (leaveType === 'Casual Leave' && diffDays < 3) {
      setValidationError(
        'Casual Leave can only be requested at least 3 days in advance. Please select a later date.'
      )
      return
    }

    // ─── 3-Day Advance Notice Rule ───
    // LOP, Sick Leave, Work From Home, and On Duty are exempt from the 3-day advance notice rule.
    const isUrgentLeave =
      leaveType === 'Sick Leave' ||
      leaveType === EMERGENCY_LEAVE_TYPE ||
      leaveType === 'LOP (Loss of Pay)' ||
      leaveType === 'Work From Home' ||
      leaveType === 'On Duty' ||
      leaveType === PERMISSION_LEAVE_TYPE

    if (leaveType === 'On Duty' && diffDays < -ON_DUTY_BACKDATE_DAYS) {
      setValidationError(
        `On Duty can be applied only up to the previous ${ON_DUTY_BACKDATE_DAYS} dates.`
      )
      return
    }

    if (!isUrgentLeave && leaveType !== 'Casual Leave' && diffDays < 3) {
      setValidationError(
        'Standard leave must be requested at least 3 days in advance. For urgent situations, please select "Sick Leave", "Emergency Leave", "LOP (Loss of Pay)", "Work From Home", "On Duty", or "Permission".'
      )
      return
    }

    const isPermission = leaveType === PERMISSION_LEAVE_TYPE
    let permissionHours = 0
    if (isPermission) {
      if (!startTime || !endTime) {
        setValidationError('Please select a start time and end time for Permission.')
        return
      }
      permissionHours = hoursBetween(startTime, endTime)
      if (permissionHours <= 0) {
        setValidationError('End time must be after start time.')
        return
      }
      const monthStr = startDate.slice(0, 7)
      const usedHours = countUsedPermissionHours(myLeaveRequests, employeeWfhFilter, monthStr)
      const remaining = Math.max(0, resolvePermissionHours(currentEmp || userDoc || {}) - usedHours)
      if (permissionHours > remaining + 1e-9) {
        setValidationError(
          remaining <= 0
            ? `No Permission hours remaining this month (${formatHoursAsHrsMins(permissionHoursLimit)}).`
            : `This request is ${formatHoursAsHrsMins(permissionHours)}. Only ${formatHoursAsHrsMins(remaining)} remaining this month.`
        )
        return
      }
    }

    // WFH / Sick / Casual / Permission are always 1 day; LOP / On Duty allow a date range
    const finalEndDate = singleDayOnly ? startDate : (endDate || startDate)
    const daysCount = isPermission
      ? 0
      : expandLeaveWorkingDates(startDate, finalEndDate).length

    if (!isPermission && daysCount === 0) {
      setValidationError('Selected dates fall on Sunday or a company holiday. Pick working days only.')
      return
    }

    const conversion = applyLopConversion({
      requestedType: leaveType,
      startDate,
      endDate: finalEndDate,
      days: daysCount,
      leaveRequests: myLeaveRequests,
      employeeFilter: employeeWfhFilter,
      limits: leaveLimits,
    })

    let wfhStatus = 'pending'
    let wfhAutoApproved = false
    if (leaveType === 'Work From Home') {
      if (!wfhPolicy.leaveFormEnabled) {
        setValidationError(
          wfhPolicy.clockInChoice
            ? 'Weekly WFH is selected at Check In on Attendance — no leave request needed.'
            : 'Work From Home leave requests are not available for your account.'
        )
        return
      }
      if (wfhPolicy.mode === 'weekly' && !conversion.convertedToLop) {
        const usedForRequest = countUsedWfhDays(
          myLeaveRequests,
          employeeWfhFilter,
          wfhPolicy,
          startDate
        )
        const wfhError = validateWfhRequest(wfhPolicy, usedForRequest, daysCount)
        if (wfhError) {
          setValidationError(wfhError)
          return
        }
      }
      wfhStatus = getWfhLeaveStatus(wfhPolicy, { createdByAdmin: false })
      wfhAutoApproved = wfhStatus === 'approved'
    }

    const leaveData = {
      employeeName: stableEmployeeName,
      employeeId: stableEmployeeId || '',
      employeeEmail: stableEmployeeEmail,
      leaveType: conversion.leaveType,
      requestedLeaveType: conversion.requestedLeaveType,
      convertedToLop: conversion.convertedToLop,
      startDate,
      endDate: finalEndDate,
      days: daysCount,
      reason: reason.trim(),
      ...(isPermission
        ? {
            startTime,
            endTime,
            hours: permissionHours,
            status: 'approved',
            autoApproved: true,
            reviewedBy: 'Permission Policy',
          }
        : {}),
      ...(leaveType === 'Work From Home' && !conversion.convertedToLop
        ? {
            status: wfhStatus,
            autoApproved: wfhAutoApproved,
            ...(wfhAutoApproved ? { reviewedBy: 'WFH Policy' } : {}),
          }
        : {}),
    }

    try {
      const created = await createLeaveRequest(leaveData)
      addLeaveRequest(created)

      setLeaveType('Casual Leave')
      setStartDate('')
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setReason('')
      setValidationError('')
      setShowAddModal(false)
    } catch (err) {
      console.error('Failed to create leave request:', err)
      setValidationError(
        err?.message?.includes('undefined')
          ? 'Failed to submit leave request due to invalid data. Please try again.'
          : 'Failed to submit leave request. Please try again.'
      )
    }
  }

  const isOwnRequest = (req) => {
    if (!req) return false
    const uid = resolvedEmployeeId || user?.uid || ''
    if (uid && (req.employeeId === uid || req.uid === uid || req.employeeId === user?.uid)) return true
    if (
      resolvedEmployeeEmail &&
      req.employeeEmail &&
      req.employeeEmail.toLowerCase() === resolvedEmployeeEmail.toLowerCase()
    ) {
      return true
    }
    if (
      req.employeeName &&
      req.employeeName !== 'Team Staff' &&
      resolvedEmployeeName &&
      req.employeeName.toLowerCase() === resolvedEmployeeName.toLowerCase()
    ) {
      return true
    }
    return false
  }

  const isOwnPendingRequest = (req) => isOwnRequest(req) && req.status === 'pending'

  /** Employees may delete their own pending or cancelled requests only */
  const canDeleteOwnRequest = (req) =>
    isOwnRequest(req) && (req.status === 'pending' || req.status === 'cancelled')

  const handleConfirmAction = async () => {
    if (!confirmAction?.request) return
    const req = confirmAction.request

    if (confirmAction.type === 'cancel') {
      if (!isOwnPendingRequest(req)) {
        setConfirmAction(null)
        return
      }
    } else if (confirmAction.type === 'delete') {
      if (!canDeleteOwnRequest(req)) {
        setConfirmAction(null)
        return
      }
    } else {
      setConfirmAction(null)
      return
    }

    setActionLoading(true)
    try {
      if (confirmAction.type === 'cancel') {
        const extras = {
          cancelledBy: resolvedEmployeeName,
          cancelledAt: new Date().toISOString(),
        }
        updateLeaveStatus(req.leaveId, 'cancelled', extras)
        await updateLeaveStatusInDb(req.leaveId, 'cancelled', extras)
      } else if (confirmAction.type === 'delete') {
        await deleteLeaveRequestFromDb(req.leaveId)
        removeLeaveRequest(req.leaveId)
      }
    } catch (err) {
      console.error('Failed to update leave request:', err)
    } finally {
      setActionLoading(false)
      setConfirmAction(null)
    }
  }

  const getStatusBadge = (status) => {
    if (status === 'approved') return { variant: 'success', label: 'Granted' }
    if (status === 'rejected') return { variant: 'danger', label: 'Declined' }
    if (status === 'cancelled') return { variant: 'neutral', label: 'Cancelled' }
    return { variant: 'warning', label: 'Pending Review' }
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Monthly Leave & PTO Management"
          description={`Track monthly leave. Extra days beyond your entitlement are marked LOP (unpaid) (${currentMonthName}).`}
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Request Leave
            </Button>
          }
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

      {/* Monthly PTO Balance Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Monthly Casual Leave
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {remainingCasualDays} {remainingCasualDays === 1 ? 'Day' : 'Days'} Remaining
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {usedCasualDaysThisMonth} of {leaveLimits.casual} {leaveLimits.casual === 1 ? 'Day' : 'Days'} Used ({currentMonthName})
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Monthly Sick Leave
            </span>
            <p className="text-xl font-bold text-accent mt-1">
              {remainingSickDays} {remainingSickDays === 1 ? 'Day' : 'Days'} Remaining
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {usedSickDaysThisMonth} of {leaveLimits.sick} {leaveLimits.sick === 1 ? 'Day' : 'Days'} Used ({currentMonthName})
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Monthly Permission
            </span>
            <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
              {formatHoursAsHrsMins(remainingPermissionHours)} Remaining
            </p>
            <p className="text-[10px] text-muted mt-0.5">
              {formatHoursAsHrsMins(usedPermissionHoursThisMonth)} of {formatHoursAsHrsMins(permissionHoursLimit)} Used ({currentMonthName})
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        {isFullWfh ? (
          <Card className="p-4 flex items-center justify-between border-border">
            <div>
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Pending Approvals
              </span>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingRequests} Requests</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Awaiting review</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </Card>
        ) : (
          <Card className="p-4 flex items-center justify-between border-border">
            <div>
              <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                {wfhCardTitle}
              </span>
              <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                {wfhCardRemaining} {wfhCardRemaining === 1 ? 'Day' : 'Days'} Remaining
              </p>
              <p className="text-[10px] text-muted mt-0.5">
                {wfhCardUsed} of {wfhCardLimit} {wfhCardLimit === 1 ? 'Day' : 'Days'} Used ({wfhCardPeriodLabel})
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
          </Card>
        )}

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Approved ({currentMonthName})
            </span>
            <p className="text-xl font-bold text-accent mt-1">{currentMonthApproved.length} Granted</p>
            <p className="text-[10px] text-slate-400 mt-0.5">This month total</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Leave Requests Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-chrome/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Leave Type</th>
              <th className="p-4 font-semibold">Duration</th>
              <th className="p-4 font-semibold">Reason</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {visibleLeaveRequests.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-6 text-center text-muted text-xs">
                  No leave from {currentMonthName} onward. Click "Request Leave" above to apply.
                </td>
              </tr>
            ) : (
              visibleLeaveRequests.map((req) => {
                const statusBadge = getStatusBadge(req.status)
                const canCancel = isOwnPendingRequest(req)
                const canDelete = canDeleteOwnRequest(req)
                return (
                  <tr key={req.leaveId} className="hover:bg-chrome/30 transition-colors text-fg">
                    <td className="p-4 text-fg font-medium">
                      {formatLeaveTypeLabel(req)}
                    </td>
                    <td className="p-4 text-muted">
                      {formatLeaveDuration(req)}
                    </td>
                    <td className="p-4 text-muted max-w-xs truncate">{req.reason}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                        {req.reviewedBy && req.status !== 'pending' && req.status !== 'cancelled' && (
                          <span className="text-[10px] text-muted font-medium">
                            by {req.reviewedBy}
                          </span>
                        )}
                        {req.status === 'cancelled' && req.cancelledBy && (
                          <span className="text-[10px] text-muted font-medium">
                            by {req.cancelledBy}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      {canCancel || canDelete ? (
                        <div className="flex items-center justify-end gap-2">
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ type: 'cancel', request: req })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-chrome text-fg border border-border hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              title="Cancel Request"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Cancel Request
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ type: 'delete', request: req })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                              title="Delete Request"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Cancel / Delete Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl rounded-2xl bg-surface">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmAction.type === 'delete'
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                    : 'bg-chrome text-muted border-border'
                }`}
              >
                {confirmAction.type === 'delete' ? <Trash2 className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-fg text-sm">
                  {confirmAction.type === 'delete' ? 'Delete Leave Request?' : 'Cancel Leave Request?'}
                </h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  {confirmAction.type === 'delete'
                    ? `This will permanently remove your ${confirmAction.request.leaveType} request for ${confirmAction.request.startDate}. This cannot be undone.`
                    : `Your ${confirmAction.request.leaveType} request for ${confirmAction.request.startDate} will be marked as Cancelled. It will not count against your leave balance.`}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => !actionLoading && setConfirmAction(null)}
                className="w-1/3"
                disabled={actionLoading}
              >
                Keep Request
              </Button>
              <Button
                type="button"
                variant={confirmAction.type === 'delete' ? 'danger' : 'primary'}
                onClick={handleConfirmAction}
                className="w-2/3"
                disabled={actionLoading}
                icon={confirmAction.type === 'delete' ? Trash2 : Ban}
              >
                {actionLoading
                  ? 'Please wait…'
                  : confirmAction.type === 'delete'
                    ? 'Delete Permanently'
                    : 'Confirm Cancel'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Request Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 border-border shadow-2xl relative rounded-2xl bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border sticky top-0 bg-surface/95 backdrop-blur-md z-10 py-1">
              <h3 className="font-bold text-fg text-sm">Submit Leave Request</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setValidationError('')
                }}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleRequestLeave} className="space-y-4">


              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => {
                    const nextType = e.target.value
                    setLeaveType(nextType)
                    setValidationError('')
                    // Collapse any prior range when switching to a single-day leave type
                    if (isSingleDayLeaveType(nextType) && startDate) {
                      setEndDate(startDate)
                    }
                    // Casual Leave requires 3 calendar days advance — clear too-early dates
                    if (nextType === 'Casual Leave' && startDate) {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      const cursor = new Date(today)
                      cursor.setDate(cursor.getDate() + 3)
                      const y = cursor.getFullYear()
                      const m = String(cursor.getMonth() + 1).padStart(2, '0')
                      const d = String(cursor.getDate()).padStart(2, '0')
                      const minCasual = `${y}-${m}-${d}`
                      if (startDate < minCasual) {
                        setStartDate('')
                        setEndDate('')
                        setValidationError(
                          `Casual Leave can only be selected at least 3 days in advance. Earliest available date is ${minCasual}.`
                        )
                      }
                    }
                  }}
                  className="w-full bg-surface border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                >
                  <option value="Casual Leave">Casual Leave ({leaveLimits.casual}/month · 3 days advance)</option>
                  <option value="Sick Leave">Sick Leave ({leaveLimits.sick}/month)</option>
                  <option value="Emergency Leave">Emergency Leave (same day · needs approval)</option>
                  <option value="Permission">Permission ({formatHoursAsHrsMins(permissionHoursLimit)}/month · no admin approval)</option>
                  {wfhPolicy.leaveFormEnabled && (
                    <option value="Work From Home">
                      Work From Home ({getWfhAllowanceLabel(wfhPolicy)}) — needs approval
                    </option>
                  )}
                  <option value="On Duty">On Duty (outdoor / official work · previous {ON_DUTY_BACKDATE_DAYS} dates)</option>
                  <option value="LOP (Loss of Pay)">LOP (Loss of Pay)</option>
                </select>
                {wfhPolicy.leaveFormEnabled && leaveType === 'Work From Home' && remainingWfhDays !== null && (
                  <p className="text-[11px] text-muted mt-1">
                    Paid WFH remaining this month: {remainingPaidWfhDays} of {leaveLimits.wfh}. Extra days are LOP (unpaid). Admin approval required.
                  </p>
                )}
                {(leaveType === 'Casual Leave' || leaveType === 'Sick Leave') && (
                  <p className="text-[11px] text-muted mt-1">
                    Remaining this month:{' '}
                    {leaveType === 'Casual Leave'
                      ? `${remainingCasualDays} of ${leaveLimits.casual} Casual`
                      : `${remainingSickDays} of ${leaveLimits.sick} Sick`}
                    . Extra days are marked LOP (unpaid).
                  </p>
                )}
                {leaveType === EMERGENCY_LEAVE_TYPE && (
                  <p className="text-[11px] text-muted mt-1">
                    Same-day requests allowed. Needs admin approval. Shows as dark red on the attendance calendar. Does not use Casual/Sick quota.
                  </p>
                )}
                {leaveType === 'On Duty' && (
                  <p className="text-[11px] text-muted mt-1">
                    You can apply for today and up to the previous {ON_DUTY_BACKDATE_DAYS} dates. Needs admin approval. Counts as present when approved.
                  </p>
                )}
                {leaveType === PERMISSION_LEAVE_TYPE && (
                  <p className="text-[11px] text-muted mt-1">
                    Remaining this month: {formatHoursAsHrsMins(remainingPermissionHours)} of {formatHoursAsHrsMins(permissionHoursLimit)}. Granted immediately — no admin approval. Over-limit requests cannot be submitted.
                  </p>
                )}
                {wfhPolicy.clockInChoice && remainingWfhDays !== null && (
                  <p className="text-[11px] text-muted mt-1">
                    Weekly WFH ({remainingWfhDays} of {wfhPolicy.limit} remaining this week) — choose WFH or Office when you Check In. No leave request needed.
                  </p>
                )}
                {wfhPolicy.mode === 'full' && (
                  <p className="text-[11px] text-muted mt-1">
                    You are on Full WFH — no leave request is required.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">
                  {singleDayOnly ? 'Select Leave Date' : 'Select Date Range'}
                </label>
                <InteractiveCalendarPicker
                  startDate={startDate}
                  setStartDate={setStartDate}
                  endDate={endDate}
                  setEndDate={setEndDate}
                  leaveType={leaveType}
                  setValidationError={setValidationError}
                />
              </div>

              {leaveType === PERMISSION_LEAVE_TYPE && (
                <div className="grid grid-cols-2 gap-3">
                  <PermissionTimeSelect label="Start Time" value={startTime} onChange={setStartTime} />
                  <PermissionTimeSelect label="End Time" value={endTime} onChange={setEndTime} />
                  {startTime && endTime && hoursBetween(startTime, endTime) > 0 && (
                    <p className="col-span-2 text-[11px] text-muted">
                      Duration: {formatHoursAsHrsMins(hoursBetween(startTime, endTime))}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Reason for Request</label>
                <textarea
                  placeholder="State the purpose for leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-surface border border-border text-fg text-xs rounded-xl p-3 h-20 focus:outline-none focus:border-accent placeholder-muted"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowAddModal(false)
                    setValidationError('')
                  }}
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  {leaveType === PERMISSION_LEAVE_TYPE ? 'Take Permission' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
