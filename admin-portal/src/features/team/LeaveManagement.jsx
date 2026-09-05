import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { getEmployees, getLeaveRequests, createLeaveRequest, updateLeaveStatusInDb, deleteLeaveRequestFromDb } from './services/teamService'
import {
  resolveEmployeeWfhPolicy,
  countUsedWfhDays,
  validateWfhRequest,
  getWfhAllowanceLabel,
  getWfhLeaveStatus,
} from './services/wfhPolicyUtils'
import {
  applyLopConversion,
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
import { TeamSubNav } from './components/TeamSubNav'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { Plus, Check, X, AlertTriangle, Trash2, Filter, Calendar } from 'lucide-react'

const SINGLE_DAY_LEAVE_TYPES = new Set([
  'Work From Home',
  'Sick Leave',
  'Casual Leave',
  'Permission',
])

const isSingleDayLeaveType = (type) => SINGLE_DAY_LEAVE_TYPES.has(type)
const ON_DUTY_BACKDATE_DAYS = 3

const FILTER_SELECT_CLASS =
  'w-full bg-canvas border border-border text-fg text-xs rounded-xl py-2.5 px-3 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer'

const LEAVE_TYPE_OPTIONS = [
  'Annual Leave',
  'Sick Leave',
  'Casual Leave',
  'Emergency Leave',
  'Permission',
  'Work From Home',
  'On Duty',
  'LOP (Loss of Pay)',
]

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'cancelled']

const toYmd = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  try {
    const d = value.toDate ? value.toDate() : new Date(value)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

const todayYmd = () => toYmd(new Date())

const getLeaveBounds = (req) => {
  const start = toYmd(req.startDate) || toYmd(req.endDate)
  const end = toYmd(req.endDate) || start
  return { start, end }
}

const leaveCoversDate = (req, dateStr) => {
  if (!dateStr) return true
  const { start, end } = getLeaveBounds(req)
  if (!start) return false
  return dateStr >= start && dateStr <= end
}

const leaveOverlapsRange = (req, from, to) => {
  if (!from && !to) return true
  const { start, end } = getLeaveBounds(req)
  if (!start) return false
  if (from && end < from) return false
  if (to && start > to) return false
  return true
}

export const LeaveManagement = () => {
  const { employees, setEmployees, leaveRequests, setLeaveRequests, addLeaveRequest, updateLeaveStatus, removeLeaveRequest } = useTeamStore()
  const { user } = useUserStore()
  const adminName = user?.displayName || user?.email || 'Admin'

  const [showAddModal, setShowAddModal] = useState(false)
  const [employeeName, setEmployeeName] = useState('')
  const [leaveType, setLeaveType] = useState('Annual Leave')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [validationError, setValidationError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [viewDate, setViewDate] = useState('')
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterLeaveType, setFilterLeaveType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Load employees from Firestore
  useEffect(() => {
    getEmployees().then((empData) => {
      if (empData && empData.length > 0) setEmployees(empData)
    }).catch(() => {})
  }, [setEmployees])

  // Subscribe to real-time Firestore leave requests
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'leaveRequests'),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), leaveId: d.id }))
        setLeaveRequests(list)
      },
      (err) => {
        console.error('Error listening to leave requests:', err)
      }
    )
    return () => unsub()
  }, [setLeaveRequests])

  // Set default employee once employees are loaded
  useEffect(() => {
    if (employees.length > 0 && !employeeName) {
      setEmployeeName(employees[0].displayName || employees[0].name || '')
    }
  }, [employees, employeeName])

  const selectedEmployee = employees.find(
    (emp) => (emp.displayName || emp.name) === employeeName
  )
  const selectedWfhPolicy = resolveEmployeeWfhPolicy(selectedEmployee || {})
  const singleDayOnly = isSingleDayLeaveType(leaveType)
  const onDutyMinDate = useMemo(() => {
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    cursor.setDate(cursor.getDate() - ON_DUTY_BACKDATE_DAYS)
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])
  const dateMin = leaveType === 'On Duty' ? onDutyMinDate : undefined

  useEffect(() => {
    if (!selectedWfhPolicy.canRequest && leaveType === 'Work From Home') {
      setLeaveType('Annual Leave')
    }
  }, [selectedWfhPolicy.canRequest, leaveType])

  useEffect(() => {
    if (singleDayOnly && startDate) {
      setEndDate(startDate)
    }
  }, [singleDayOnly, startDate])

  const handleRequestLeave = async (e) => {
    e.preventDefault()
    setValidationError('')

    const reqStartDate = startDate ? new Date(startDate) : new Date()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    reqStartDate.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((reqStartDate - today) / (1000 * 60 * 60 * 24))

    if (leaveType === 'Casual Leave' && diffDays < 3) {
      setValidationError(
        'Casual Leave can only be requested at least 3 days in advance. Please select a later date.'
      )
      return
    }

    const isUrgentLeave =
      leaveType === 'Sick Leave' ||
      leaveType === EMERGENCY_LEAVE_TYPE ||
      leaveType === 'LOP (Loss of Pay)' ||
      leaveType === 'Work From Home' ||
      leaveType === 'On Duty' ||
      leaveType === PERMISSION_LEAVE_TYPE

    // LOP may be recorded for any past date; On Duty allows the previous 3 dates
    if (leaveType === 'On Duty' && diffDays < -ON_DUTY_BACKDATE_DAYS) {
      setValidationError(
        `On Duty can be applied only up to the previous ${ON_DUTY_BACKDATE_DAYS} dates.`
      )
      return
    }

    if (leaveType !== 'LOP (Loss of Pay)' && leaveType !== 'On Duty' && diffDays < 0) {
      setValidationError('Past dates cannot be selected for this leave type.')
      return
    }

    // Non-urgent types (except Casual, already checked) still need 3-day advance
    if (!isUrgentLeave && leaveType !== 'Casual Leave' && diffDays < 3) {
      setValidationError(
        'Standard leave must be requested at least 3 days in advance. Select "Sick Leave", "Emergency Leave", "LOP (Loss of Pay)", "Work From Home", "On Duty", or "Permission" for urgent requests.'
      )
      return
    }

    const matchedEmp = selectedEmployee
    const policy = resolveEmployeeWfhPolicy(matchedEmp || {})
    const employeeFilter = {
      employeeId: matchedEmp?.uid || matchedEmp?.employeeId || '',
      employeeEmail: matchedEmp?.email || '',
      employeeName,
    }

    const resolvedStart = startDate || new Date().toISOString().split('T')[0]
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
      const monthStr = resolvedStart.slice(0, 7)
      const usedHours = countUsedPermissionHours(leaveRequests, employeeFilter, monthStr)
      const limit = resolvePermissionHours(matchedEmp || {})
      const remaining = Math.max(0, limit - usedHours)
      if (permissionHours > remaining + 1e-9) {
        setValidationError(
          remaining <= 0
            ? `No Permission hours remaining this month (${formatHoursAsHrsMins(limit)}).`
            : `This request is ${formatHoursAsHrsMins(permissionHours)}. Only ${formatHoursAsHrsMins(remaining)} remaining this month.`
        )
        return
      }
    }

    const resolvedEnd = singleDayOnly ? resolvedStart : (endDate || resolvedStart)
    const daysCount = isPermission
      ? 0
      : expandLeaveWorkingDates(resolvedStart, resolvedEnd).length

    if (!isPermission && daysCount === 0) {
      setValidationError('Selected dates fall on Sunday or a company holiday. Pick working days only.')
      return
    }

    const conversion = applyLopConversion({
      requestedType: leaveType,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      days: daysCount,
      leaveRequests,
      employeeFilter: {
        employeeId: matchedEmp?.uid || matchedEmp?.employeeId || '',
        employeeEmail: matchedEmp?.email || '',
        employeeName,
      },
      limits: resolveLeaveLimits(matchedEmp || {}),
    })

    let wfhExtras = {}
    if (leaveType === 'Work From Home') {
      if (!policy.canRequest) {
        setValidationError(
          policy.mode === 'full'
            ? 'This employee is on Full WFH and does not need WFH leave requests.'
            : 'WFH is not enabled for this employee. Set their policy under Team → Leave & WFH Policy.'
        )
        return
      }
      const employeeFilter = {
        employeeId: matchedEmp?.uid || matchedEmp?.employeeId || '',
        employeeEmail: matchedEmp?.email || '',
        employeeName,
      }
      if (!conversion.convertedToLop && policy.mode === 'weekly') {
        const usedForRequest = countUsedWfhDays(
          leaveRequests,
          employeeFilter,
          policy,
          resolvedStart
        )
        const wfhError = validateWfhRequest(policy, usedForRequest, daysCount)
        if (wfhError) {
          setValidationError(wfhError)
          return
        }
      }
      const status = conversion.convertedToLop
        ? 'approved'
        : getWfhLeaveStatus(policy, { createdByAdmin: true })
      wfhExtras = {
        status,
        autoApproved: policy.mode === 'weekly' || conversion.convertedToLop,
        reviewedBy: policy.mode === 'weekly' ? 'WFH Policy' : adminName,
      }
    }

    const leaveData = {
      employeeName,
      employeeId: matchedEmp?.uid || matchedEmp?.employeeId || '',
      employeeEmail: matchedEmp?.email || '',
      leaveType: conversion.leaveType,
      requestedLeaveType: conversion.requestedLeaveType,
      convertedToLop: conversion.convertedToLop,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      days: daysCount,
      reason: reason || `${leaveType} request`,
      ...(isPermission
        ? {
            startTime,
            endTime,
            hours: permissionHours,
            status: 'approved',
            autoApproved: true,
            reviewedBy: adminName,
          }
        : {}),
      ...wfhExtras,
    }

    if (!leaveData.employeeId && !leaveData.employeeEmail) {
      setValidationError('Selected employee is missing identity fields. Re-select the employee and try again.')
      return
    }

    try {
      const created = await createLeaveRequest(leaveData)
      addLeaveRequest(created)

      setLeaveType('Annual Leave')
      setStartDate('')
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setReason('')
      setValidationError('')
      setShowAddModal(false)
    } catch (err) {
      console.error('Failed to create leave request:', err)
      setValidationError('Failed to create leave request. Please try again.')
    }
  }

  const handleUpdateLeaveStatus = async (leaveId, newStatus) => {
    updateLeaveStatus(leaveId, newStatus)
    await updateLeaveStatusInDb(leaveId, newStatus, adminName)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.leaveId) return
    setDeleteLoading(true)
    try {
      await deleteLeaveRequestFromDb(deleteTarget.leaveId)
      removeLeaveRequest(deleteTarget.leaveId)
    } catch (err) {
      console.error('Failed to delete leave request:', err)
    } finally {
      setDeleteLoading(false)
      setDeleteTarget(null)
    }
  }

  // Helper to resolve employee name, avatar, and email details from employee list or email
  const getEmployeeInfo = (req) => {
    const matched = employees.find(
      (e) =>
        (req.employeeId && (e.uid === req.employeeId || e.employeeId === req.employeeId)) ||
        (req.employeeEmail && e.email?.toLowerCase() === req.employeeEmail.toLowerCase()) ||
        (req.employeeName &&
          req.employeeName !== 'Team Staff' &&
          (e.displayName?.toLowerCase() === req.employeeName.toLowerCase() || e.name?.toLowerCase() === req.employeeName.toLowerCase()))
    )

    let name = matched?.displayName || matched?.name || req.employeeName
    let email = req.employeeEmail || matched?.email || ''
    let role = matched?.role || matched?.department || matched?.designation || ''

    if (!name || name === 'Team Staff') {
      if (email) {
        name = email
          .split('@')[0]
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      } else {
        name = 'Team Member'
      }
    }

    const avatar = matched?.avatar || matched?.photoURL || null
    const initials = name
      ? name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((n) => n[0].toUpperCase())
          .join('')
      : 'TM'

    return { name, email, role, avatar, initials }
  }

  const visibleRequests = useMemo(() => {
    return leaveRequests.filter((req) => {
      if (req.hiddenFromAdmin) return false
      if (!leaveCoversDate(req, viewDate)) return false
      if (!leaveOverlapsRange(req, rangeFrom, rangeTo)) return false
      if (filterLeaveType && req.leaveType !== filterLeaveType) return false
      if (filterStatus && (req.status || 'pending') !== filterStatus) return false
      if (filterEmployee) {
        const matchedEmp = employees.find(
          (emp) =>
            emp.uid === filterEmployee ||
            emp.employeeId === filterEmployee ||
            emp.email === filterEmployee ||
            (emp.displayName || emp.name) === filterEmployee
        )
        const info = getEmployeeInfo(req)
        const matchedName = matchedEmp?.displayName || matchedEmp?.name
        const matches =
          req.employeeId === filterEmployee ||
          req.employeeEmail === filterEmployee ||
          req.employeeName === filterEmployee ||
          info.name === filterEmployee ||
          (matchedEmp &&
            ((req.employeeId && (req.employeeId === matchedEmp.uid || req.employeeId === matchedEmp.employeeId)) ||
              (req.employeeEmail &&
                matchedEmp.email &&
                req.employeeEmail.toLowerCase() === matchedEmp.email.toLowerCase()) ||
              (matchedName && info.name === matchedName)))
        if (!matches) return false
      }
      return true
    })
  }, [leaveRequests, viewDate, rangeFrom, rangeTo, filterEmployee, filterLeaveType, filterStatus, employees])

  const employeeFilterOptions = useMemo(() => {
    const seen = new Set()
    const options = []
    const addOption = (value, label) => {
      if (!value || !label) return
      const nameKey = label.toLowerCase()
      if (seen.has(value) || seen.has(nameKey)) return
      seen.add(value)
      seen.add(nameKey)
      options.push({ value, label })
    }
    employees.forEach((emp) => {
      addOption(emp.uid || emp.employeeId || emp.email || emp.displayName || emp.name, emp.displayName || emp.name)
    })
    leaveRequests.forEach((req) => {
      if (req.hiddenFromAdmin) return
      const info = getEmployeeInfo(req)
      addOption(req.employeeId || req.employeeEmail || info.name, info.name)
    })
    return options.sort((a, b) => a.label.localeCompare(b.label))
  }, [employees, leaveRequests])

  const leaveTypeFilterOptions = useMemo(() => {
    const fromData = leaveRequests.map((req) => req.leaveType).filter(Boolean)
    return Array.from(new Set([...LEAVE_TYPE_OPTIONS, ...fromData]))
  }, [leaveRequests])

  const hasActiveFilters = Boolean(
    viewDate || rangeFrom || rangeTo || filterEmployee || filterLeaveType || filterStatus
  )

  const clearFilters = () => {
    setViewDate('')
    setRangeFrom('')
    setRangeTo('')
    setFilterEmployee('')
    setFilterLeaveType('')
    setFilterStatus('')
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Leave & PTO Management"
          description="Employee leave requests, PTO balances, annual holidays, and manager approvals"
        />

        <TeamSubNav />
      </div>

      <Card className="p-4 border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-fg">
            <Filter className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold">Filter leave & WFH requests</h3>
            {hasActiveFilters && (
              <span className="text-[11px] text-muted">
                Showing {visibleRequests.length} of {leaveRequests.filter((r) => !r.hiddenFromAdmin).length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={viewDate === todayYmd() ? 'primary' : 'secondary'}
              icon={Calendar}
              onClick={() => {
                const today = todayYmd()
                setViewDate(today)
                setRangeFrom('')
                setRangeTo('')
              }}
            >
              Today
            </Button>
            {hasActiveFilters && (
              <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3">
          <Input
            label="View date"
            type="date"
            value={viewDate}
            onChange={(e) => setViewDate(e.target.value)}
          />
          <Input
            label="From"
            type="date"
            value={rangeFrom}
            max={rangeTo || undefined}
            onChange={(e) => {
              const next = e.target.value
              setRangeFrom(next)
              if (rangeTo && next && rangeTo < next) setRangeTo(next)
            }}
          />
          <Input
            label="To"
            type="date"
            value={rangeTo}
            min={rangeFrom || undefined}
            onChange={(e) => setRangeTo(e.target.value)}
          />
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-fg">Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All employees</option>
              {employeeFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-fg">Leave type</label>
            <select
              value={filterLeaveType}
              onChange={(e) => setFilterLeaveType(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All types</option>
              {leaveTypeFilterOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-fg">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={FILTER_SELECT_CLASS}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Leave Requests Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Employee</th>
              <th className="p-4 font-semibold">Leave Type</th>
              <th className="p-4 font-semibold">Duration</th>
              <th className="p-4 font-semibold">Reason</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Manager Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {visibleRequests.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  <p className="text-sm font-medium text-fg">No leave or WFH requests found</p>
                  <p className="text-xs mt-1">
                    {hasActiveFilters
                      ? 'Try another date, expand the date range, or clear filters.'
                      : 'Leave and WFH requests will appear here once submitted.'}
                  </p>
                </td>
              </tr>
            )}
            {visibleRequests.map((req) => (
              <tr key={req.leaveId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-fg">
                <td className="p-4">
                  {(() => {
                    const info = getEmployeeInfo(req)
                    return (
                      <div className="flex items-center gap-3">
                        {info.avatar ? (
                          <img
                            src={info.avatar}
                            alt={info.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-accent-soft text-accent border border-accent/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {info.initials}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-fg text-xs truncate">
                            {info.name}
                          </span>
                          {info.email ? (
                            <span className="text-[11px] text-muted truncate">
                              {info.email}
                            </span>
                          ) : info.role ? (
                            <span className="text-[11px] text-muted truncate">
                              {info.role}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })()}
                </td>
                <td className="p-4 text-slate-800 dark:text-slate-300 font-medium">{formatLeaveTypeLabel(req)}</td>
                <td className="p-4 text-muted">
                  {formatLeaveDuration(req)}
                </td>
                <td className="p-4 text-muted min-w-[14rem] max-w-lg whitespace-pre-wrap break-words">{req.reason}</td>
                <td className="p-4">
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant={
                        req.status === 'approved'
                          ? 'success'
                          : req.status === 'rejected'
                          ? 'danger'
                          : req.status === 'cancelled'
                          ? 'neutral'
                          : 'warning'
                      }
                    >
                      {req.status}
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
                  <div className="inline-flex items-center justify-end gap-2">
                    {req.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateLeaveStatus(req.leaveId, 'approved')}
                          className="p-1.5 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-500/30 transition-colors"
                          title="Approve Leave"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUpdateLeaveStatus(req.leaveId, 'rejected')}
                          className="p-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-500/30 transition-colors"
                          title="Reject Leave"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setDeleteTarget(req)}
                      className="p-1.5 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg border border-rose-200 dark:border-rose-500/30 transition-colors"
                      title="Hide Leave Request"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl rounded-2xl bg-surface">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-fg text-sm">Hide Leave Request?</h3>
                <p className="text-xs text-muted mt-1.5 leading-relaxed">
                  This will remove the {deleteTarget.leaveType} request for{' '}
                  {deleteTarget.employeeName || 'this employee'} ({deleteTarget.startDate}
                  {deleteTarget.endDate && deleteTarget.endDate !== deleteTarget.startDate
                    ? ` to ${deleteTarget.endDate}`
                    : ''}
                  ) from this admin list only. The employee leave record and calendar marks will stay unchanged.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => !deleteLoading && setDeleteTarget(null)}
                className="w-1/3"
                disabled={deleteLoading}
              >
                Keep
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                className="w-2/3"
                disabled={deleteLoading}
                icon={Trash2}
              >
                {deleteLoading ? 'Hiding…' : 'Hide from Admin'}
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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                <label className="block text-xs font-medium text-fg">Employee</label>
                <select
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                >
                  {employees.map((emp) => (
                    <option key={emp.uid || emp.employeeId} value={emp.displayName} className="bg-surface text-fg">
                      {emp.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => {
                    const nextType = e.target.value
                    setLeaveType(nextType)
                    setValidationError('')
                    if (isSingleDayLeaveType(nextType) && startDate) {
                      setEndDate(startDate)
                    }
                  }}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                >
                  <option value="Annual Leave" className="bg-surface text-fg">Annual Leave</option>
                  <option value="Sick Leave" className="bg-surface text-fg">Sick Leave</option>
                  <option value="Casual Leave" className="bg-surface text-fg">Casual Leave</option>
                  <option value="Emergency Leave" className="bg-surface text-fg">Emergency Leave</option>
                  <option value="Permission" className="bg-surface text-fg">
                    Permission ({formatHoursAsHrsMins(resolvePermissionHours(selectedEmployee || {}))}/month · no approval)
                  </option>
                  {selectedWfhPolicy.canRequest && (
                    <option value="Work From Home" className="bg-surface text-fg">
                      Work From Home ({getWfhAllowanceLabel(selectedWfhPolicy)})
                    </option>
                  )}
                  <option value="On Duty" className="bg-surface text-fg">On Duty (outdoor / official work · previous {ON_DUTY_BACKDATE_DAYS} dates)</option>
                  <option value="LOP (Loss of Pay)" className="bg-surface text-fg">LOP (Loss of Pay)</option>
                </select>
                {selectedEmployee && (
                  <p className="text-[11px] text-muted mt-1">
                    Employee WFH: {getWfhAllowanceLabel(selectedWfhPolicy)}
                    {selectedWfhPolicy.mode === 'full' ? ' (no leave request needed)' : ''}
                    {selectedWfhPolicy.mode === 'monthly' ? ' (admin approval for employee requests)' : ''}
                    {selectedWfhPolicy.mode === 'weekly' ? ' (employee chooses WFH/Office at Check In)' : ''}
                  </p>
                )}
                {leaveType === EMERGENCY_LEAVE_TYPE && (
                  <p className="text-[11px] text-muted mt-1">
                    Same-day allowed. Shows as dark red on the attendance calendar. Does not use Casual/Sick quota.
                  </p>
                )}
                {leaveType === 'On Duty' && (
                  <p className="text-[11px] text-muted mt-1">
                    Can be applied for today and up to the previous {ON_DUTY_BACKDATE_DAYS} dates. Counts as present when approved.
                  </p>
                )}
                {leaveType === PERMISSION_LEAVE_TYPE && selectedEmployee && (
                  <p className="text-[11px] text-muted mt-1">
                    Permission remaining this month:{' '}
                    {formatHoursAsHrsMins(
                      Math.max(
                        0,
                        resolvePermissionHours(selectedEmployee) -
                          countUsedPermissionHours(
                            leaveRequests,
                            {
                              employeeId: selectedEmployee?.uid || selectedEmployee?.employeeId || '',
                              employeeEmail: selectedEmployee?.email || '',
                              employeeName,
                            },
                            (startDate || new Date().toISOString()).slice(0, 7)
                          )
                      )
                    )}{' '}
                    of {formatHoursAsHrsMins(resolvePermissionHours(selectedEmployee))}. Auto-granted within the monthly limit.
                  </p>
                )}
              </div>

              {singleDayOnly ? (
                <div className="space-y-1.5">
                  <Input
                    label="Leave Date"
                    type="date"
                    min={dateMin}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      setEndDate(e.target.value)
                    }}
                  />
                  {startDate && (
                    <p className="text-[11px] text-muted">
                      Selected: <span className="font-semibold text-accent">{startDate}</span>
                      {leaveType === PERMISSION_LEAVE_TYPE ? '' : ' (1 Day)'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Start Date"
                      type="date"
                      min={dateMin}
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    <Input
                      label="End Date"
                      type="date"
                      min={dateMin}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  {startDate && endDate && (
                    <p className="text-[11px] text-muted">
                      Selected:{' '}
                      <span className="font-semibold text-accent">{startDate}</span>
                      {' '}to{' '}
                      <span className="font-semibold text-accent">{endDate}</span>
                      {' '}(
                      {Math.max(
                        1,
                        Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1
                      )}{' '}
                      Days)
                    </p>
                  )}
                </div>
              )}

              {leaveType === PERMISSION_LEAVE_TYPE && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Start Time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <Input
                    label="End Time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                  {startTime && endTime && hoursBetween(startTime, endTime) > 0 && (
                    <p className="col-span-2 text-[11px] text-muted">
                      Duration: {formatHoursAsHrsMins(hoursBetween(startTime, endTime))}
                    </p>
                  )}
                </div>
              )}

              <Input
                label="Reason for Leave"
                placeholder="Brief explanation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

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
                  Submit Request
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
