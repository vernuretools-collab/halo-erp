import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home,
  Folder,
  Receipt,
  FileText,
  Headphones,
  User,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'

const NAV_ITEMS = [
  { name: 'Overview', path: '/portal', icon: Home, end: true },
  { name: 'My Projects', path: '/portal/projects', icon: Folder },
  { name: 'Invoices', path: '/portal/invoices', icon: Receipt },
  { name: 'Billing', path: '/portal/billing', icon: CreditCard },
  { name: 'Documents', path: '/portal/files', icon: FileText },
  { name: 'Support', path: '/portal/support', icon: Headphones },
  { name: 'My Profile', path: '/portal/profile', icon: User },
]

export const ClientSidebar = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { user, userDoc, clearUser } = useUserStore()

  const companyName =
    userDoc?.companyName ||
    userDoc?.organization ||
    user?.companyName ||
    'Client Workspace'


  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-chrome border-r border-border transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-accent-soft border border-accent/20 text-accent flex items-center justify-center shrink-0 shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          {sidebarOpen && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="font-bold text-fg text-xs tracking-wider uppercase truncate">
                CLIENT PORTAL
              </span>
              <span className="text-xs text-muted font-normal truncate mt-0.5">
                {companyName}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="w-7 h-7 rounded-lg bg-surface hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-border"
        >
          {sidebarOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3.5 py-5 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-accent-soft text-accent shadow-sm font-semibold'
                    : 'text-muted hover:text-fg hover:bg-surface'
                } ${!sidebarOpen ? 'justify-center px-2' : ''}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.name}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => clearUser()}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer ${
            !sidebarOpen ? 'justify-center px-2' : ''
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {sidebarOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}


