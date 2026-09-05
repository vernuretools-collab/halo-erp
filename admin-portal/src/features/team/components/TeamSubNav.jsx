import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users,
  CheckCircle2,
  Calendar,
  CalendarDays,
  PartyPopper,
  Home,
  FileText,
  FolderOpen,
  Megaphone,
  LifeBuoy,
} from 'lucide-react'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
    isActive
      ? 'bg-accent-soft text-accent border border-accent/30'
      : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
  }`

const wfhClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
    isActive
      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
      : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
  }`

/**
 * Shared Team module sub-navigation.
 */
export function TeamSubNav({ className = '' }) {
  return (
    <div
      className={`flex items-center gap-2 border-b border-border pb-3 flex-wrap ${className}`}
    >
      <NavLink to="/team/employees" className={linkClass}>
        <Users className="w-3.5 h-3.5" /> Employee Directory
      </NavLink>
      <NavLink to="/team/announcements" className={linkClass}>
        <Megaphone className="w-3.5 h-3.5" /> Announcements
      </NavLink>
      <NavLink to="/team/helpdesk" className={linkClass}>
        <LifeBuoy className="w-3.5 h-3.5" /> Client Support
      </NavLink>
      <NavLink to="/team/attendance" className={linkClass}>
        <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Tracker
      </NavLink>
      <NavLink to="/team/leave" className={linkClass}>
        <Calendar className="w-3.5 h-3.5" /> Leave Management
      </NavLink>
      <NavLink to="/team/holidays" className={linkClass}>
        <PartyPopper className="w-3.5 h-3.5" /> Public Holidays
      </NavLink>
      <NavLink to="/team/payslips" className={linkClass}>
        <FileText className="w-3.5 h-3.5" /> Payslips
      </NavLink>
      <NavLink to="/team/documents" className={linkClass}>
        <FolderOpen className="w-3.5 h-3.5" /> Documents
      </NavLink>
      <NavLink to="/team/wfh-policy" className={wfhClass}>
        <Home className="w-3.5 h-3.5" /> Leave & WFH Policy
      </NavLink>
      <NavLink to="/team/timeline" className={linkClass}>
        <CalendarDays className="w-3.5 h-3.5" /> Work Timeline
      </NavLink>
      <NavLink to="/team/reports" className={linkClass}>
        <FileText className="w-3.5 h-3.5" /> Monthly Reports
      </NavLink>
    </div>
  )
}
