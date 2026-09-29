import React, { useEffect, useMemo, useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { assignEmployeeDayLeave, getLeaveRequests } from '../services/teamService'
import {
  countUsedPermissionHours,
  formatHoursAsHrsMins,
  hoursBetween,
  isPermissionLeave,
  leaveMatchesEmployeeFilter,
  PERMISSION_LEAVE_TYPE,
  resolvePermissionHours,
} from '../services/leaveEntitlementUtils'
import { Trash2 } from 'lucide-react'

const DAY_LEAVE_TYPES = [
  'Casual Leave',
  'Sick Leave',
  'Emergency Leave',
  'Annual Leave',
  'Permission',
  'Work From Home',
  'On Duty',
  'LOP (Loss of Pay)',
]

const SELECT_CLASS =
  'w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer'

const leaveRange = (leave) => {
  const start = String(leave?.startDate || '').slice(0, 10)
  const end = String(leave?.endDate || leave?.startDate || '').slice(0, 10)
  return { start, end }
}

const coveringLeaves = (leaveRequests, employee, date) => {
  const uid = employee?.uid || employee?.employeeId || employee?.id || ''
  const filter = {
    employeeId: uid,
    uid,
    employeeEmail: employee?.email || '',
    employeeName: employee?.displayName || employee?.name || '',
  }
  return (leaveRequests || []).filter((leave) => {
    const status = String(leave?.status || '').toLowerCase()
    if (status === 'rejected' || status === 'cancelled') return false
    if (!leaveMatchesEmployeeFilter(leave, filter)) return false
    const { start, end } = leaveRange(leave)
    return Boolean(start) && date >= start && date <= end
  })
}

export function DayLeaveModal({
  open,
  onClose,
  employee,
  date,
  reviewedBy = 'Admin',
  onSaved,
}) {
  const [leaveType, setLeaveType] = useState('Casual Leave')
  const [reason, setReason] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [leaveRequests, setLeaveRequests] = useState([])
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const [hasExisting, setHasExisting] = useState(false)

  const employeeName = employee?.displayName || employee?.name || employee?.email || 'Employee'

  useEffect(() => {
    if (!open || !employee || !date) return
    let cancelled = false
    setError('')
    getLeaveRequests()
      .then((list) => {
        if (cancelled) return
        const rows = list || []
        setLeaveRequests(rows)
        const covering = coveringLeaves(rows, employee, date)
        setHasExisting(covering.length > 0)
        const current =
          covering.find((leave) => !isPermissionLeave(leave)) ||
          covering.find((leave) => isPermissionLeave(leave))
        setLeaveType(current?.requestedLeaveType || current?.leaveType || 'Casual Leave')
        setReason(current?.reason || '')
        setStartTime(current?.startTime || '')
        setEndTime(current?.endTime || '')
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load leave for this day.')
      })
    return () => {
      cancelled = true
    }
  }, [open, employee, date])

  const permissionRemaining = useMemo(() => {
    if (!employee || !date || leaveType !== PERMISSION_LEAVE_TYPE) return null
    const uid = employee.uid || employee.employeeId || employee.id || ''
    const covering = coveringLeaves(leaveRequests, employee, date)
    const exact = covering.find((leave) => {
      if (!isPermissionLeave(leave)) return false
      const { start, end } = leaveRange(leave)
      return start === date && end === date
    })
    const used = countUsedPermissionHours(
      leaveRequests,
      {
        employeeId: uid,
        uid,
        employeeEmail: employee.email || '',
        employeeName,
      },
      date.slice(0, 7),
      { excludeLeaveId: exact?.leaveId || exact?.id }
    )
    const limit = resolvePermissionHours(employee)
    return Math.max(0, Math.round((limit - used) * 100) / 100)
  }, [employee, employeeName, date, leaveType, leaveRequests])

  const save = async (nextType) => {
    if (!employee || !date) return
    setPending(nextType ? 'save' : 'delete')
    setError('')
    try {
      await assignEmployeeDayLeave({
        employee,
        date,
        leaveType: nextType,
        reason,
        startTime,
        endTime,
        reviewedBy,
      })
      if (onSaved) await onSaved()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Unable to update this day.')
    } finally {
      setPending('')
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (pending) return
        onClose?.()
      }}
      title={`Leave on ${date || ''}`}
      size="md"
      footer={
        <>
          {hasExisting && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              icon={Trash2}
              disabled={Boolean(pending)}
              onClick={() => save('')}
              className="mr-auto"
            >
              {pending === 'delete' ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" disabled={Boolean(pending)} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={Boolean(pending)} onClick={() => save(leaveType)}>
            {pending === 'save' ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted">
          {employeeName}. Saving marks this day as the selected leave and stores it for this employee.
          A longer leave that includes this date is split so only this day changes.
        </p>
        {error && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-300">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-fg">Leave type</label>
          <select
            value={leaveType}
            onChange={(e) => setLeaveType(e.target.value)}
            className={SELECT_CLASS}
          >
            {DAY_LEAVE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        {leaveType === PERMISSION_LEAVE_TYPE && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <Input label="End Time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            {startTime && endTime && hoursBetween(startTime, endTime) > 0 && (
              <p className="text-[11px] text-muted">
                Duration: {formatHoursAsHrsMins(hoursBetween(startTime, endTime))}
                {permissionRemaining != null
                  ? ` · ${formatHoursAsHrsMins(permissionRemaining)} remaining this month`
                  : ''}
              </p>
            )}
          </div>
        )}
        <Input
          label="Reason"
          placeholder="Optional note"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  )
}
