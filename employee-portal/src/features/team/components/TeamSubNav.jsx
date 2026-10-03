import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Users, Network, Calendar } from 'lucide-react'

const linkClass = ({ isActive }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
    isActive
      ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
      : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
  }`

export function TeamSubNav({ className = '' }) {
  const { pathname } = useLocation()
  const directoryActive = pathname === '/directory' || pathname === '/team/employees'

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <NavLink to="/directory" className={() => linkClass({ isActive: directoryActive })}>
        <Users className="w-3.5 h-3.5" /> Employee Directory
      </NavLink>
      <NavLink to="/team/organization" className={linkClass}>
        <Network className="w-3.5 h-3.5" /> Organization Structure
      </NavLink>
      <NavLink to="/team/leave" className={linkClass}>
        <Calendar className="w-3.5 h-3.5" /> Leave Management
      </NavLink>
    </div>
  )
}
