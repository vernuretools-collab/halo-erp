import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { Users, CheckCircle2, Calendar, Plus, Check, X } from 'lucide-react'

export const LeaveManagement = () => {
  const { employees, leaveRequests, addLeaveRequest, updateLeaveStatus } = useTeamStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [employeeName, setEmployeeName] = useState('')
  const [leaveType, setLeaveType] = useState('Annual Leave')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const getEmployeeInfo = (req) => {
    const matched = (employees || []).find(
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

  const handleRequestLeave = (e) => {
    e.preventDefault()

    addLeaveRequest({
      employeeName,
      leaveType,
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      days: 3,
      reason: reason || 'Personal leave request',
    })

    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Leave & PTO Management"
          description="Employee leave requests, PTO balances, annual holidays, and manager approvals"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Request Leave
            </Button>
          }
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/team/employees"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Users className="w-3.5 h-3.5" /> Employee Directory
          </NavLink>
          <NavLink
            to="/team/attendance"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Calendar className="w-3.5 h-3.5" /> Leave Management
          </NavLink>
        </div>
      </div>

      {/* Leave Requests Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-border text-slate-400">
              <th className="p-4 font-semibold">Employee</th>
              <th className="p-4 font-semibold">Leave Type</th>
              <th className="p-4 font-semibold">Duration</th>
              <th className="p-4 font-semibold">Reason</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Manager Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leaveRequests.map((req) => (
              <tr key={req.leaveId} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4">
                  {(() => {
                    const info = getEmployeeInfo(req)
                    return (
                      <div className="flex items-center gap-3">
                        {info.avatar ? (
                          <img
                            src={info.avatar}
                            alt={info.name}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-accent-soft text-accent border border-accent/30 flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                            {info.initials}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-slate-200 text-xs truncate">
                            {info.name}
                          </span>
                          {info.email ? (
                            <span className="text-[11px] text-slate-400 truncate">
                              {info.email}
                            </span>
                          ) : info.role ? (
                            <span className="text-[11px] text-slate-400 truncate">
                              {info.role}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )
                  })()}
                </td>
                <td className="p-4 text-slate-300 font-medium">{req.leaveType}</td>
                <td className="p-4 text-slate-400">
                  {req.startDate} to {req.endDate} ({req.days} days)
                </td>
                <td className="p-4 text-slate-400 max-w-xs truncate">{req.reason}</td>
                <td className="p-4">
                  <Badge
                    variant={
                      req.status === 'approved'
                        ? 'success'
                        : req.status === 'rejected'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {req.status}
                  </Badge>
                </td>
                <td className="p-4 text-right space-x-2">
                  {req.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateLeaveStatus(req.leaveId, 'approved')}
                        className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30 transition-colors"
                        title="Approve Leave"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateLeaveStatus(req.leaveId, 'rejected')}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 transition-colors"
                        title="Reject Leave"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Request Leave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Submit Leave Request</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestLeave} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-300">Employee</label>
                <select
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
                >
                  <option value="Sarah Jenkins">Sarah Jenkins</option>
                  <option value="Alex Rivera">Alex Rivera</option>
                  <option value="David Chen">David Chen</option>
                </select>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-300">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
                >
                  <option value="Annual Leave">Annual Leave</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Unpaid Leave">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <Input
                label="Reason for Leave"
                placeholder="Brief explanation..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
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
