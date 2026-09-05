import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { useTeamStore } from './stores/teamStore'
import { Users, CheckCircle2, Calendar, Clock, LogIn, LogOut } from 'lucide-react'

export const AttendancePage = () => {
  const { employees, clockedIn, clockInTime, toggleClockIn } = useTeamStore()

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Attendance & Daily Presence Tracker"
          description="Real-time employee clock-in/out tracking, shift logs, and presence status"
          actions={
            <Button
              icon={clockedIn ? LogOut : LogIn}
              variant={clockedIn ? 'danger' : 'primary'}
              onClick={toggleClockIn}
            >
              {clockedIn ? `Clock Out (${clockInTime})` : 'Clock In Now'}
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

      {/* Attendance Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-border text-slate-400">
              <th className="p-4 font-semibold">Employee</th>
              <th className="p-4 font-semibold">Department</th>
              <th className="p-4 font-semibold">Clock In Time</th>
              <th className="p-4 font-semibold">Shift Hours</th>
              <th className="p-4 font-semibold">Presence Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {employees.map((emp) => (
              <tr key={emp.uid} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-200">{emp.displayName}</td>
                <td className="p-4 text-slate-300">{emp.departmentName}</td>
                <td className="p-4 text-slate-400">09:00 AM</td>
                <td className="p-4 font-semibold text-accent">8.0 hrs</td>
                <td className="p-4">
                  <Badge variant={emp.status === 'active' ? 'success' : 'warning'}>
                    {emp.status === 'active' ? 'Present' : 'On Leave'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
