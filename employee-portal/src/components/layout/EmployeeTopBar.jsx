import React, { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bell, UserCheck, Search, Sun, Moon } from 'lucide-react'
import haloLogo from '../../assets/halologo.png'
import { useUserStore } from '../../stores/userStore'
import { useUIStore } from '../../stores/uiStore'
import { useNotificationStore } from '../../features/notifications/stores/notificationStore'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'
import { collectUserIdentityIds } from '../../features/projects/services/projectService'
import { EmployeeAvatar } from '../../../../shared/ui/EmployeeAvatar.jsx'

export const EmployeeTopBar = () => {
  const { user, userDoc } = useUserStore()
  const { theme, toggleTheme } = useUIStore()
  const { notifications, isOpen, toggleOpen, setIsOpen, fetchNotifications } = useNotificationStore()
  const panelRef = useRef(null)
  const bellRef = useRef(null)
  const navigate = useNavigate()

  const displayName = userDoc?.displayName || user?.displayName || 'Employee Staff'
  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Subscribe to Firestore notifications on mount
  useEffect(() => {
    const ids = collectUserIdentityIds(user, userDoc)
    if (!ids.length) return
    const unsubscribe = fetchNotifications(ids)
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [user?.uid, userDoc?.identityIds, userDoc?.employeeDocId, fetchNotifications])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        bellRef.current &&
        !bellRef.current.contains(e.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, setIsOpen])

  return (
    <header className="h-16 bg-surface/90 backdrop-blur-md border-b border-border px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* EMPLOYEE Environment Badge & Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-muted">
          <UserCheck className="w-4 h-4 text-accent" />
          <span className="font-semibold hidden sm:block">
            Employee workspace
          </span>
        </div>

        <div className="relative w-64 hidden md:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search tasks, docs..."
            className="w-full bg-surface border border-border text-xs text-fg placeholder-muted rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Sun/Moon Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="relative w-9 h-9 rounded-xl bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-all cursor-pointer border border-border"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            ref={bellRef}
            onClick={toggleOpen}
            className="relative w-9 h-9 rounded-xl bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors border border-border cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-surface leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown panel */}
          {isOpen && (
            <div ref={panelRef} className="absolute right-0 top-12 z-50 w-80 sm:w-96 shadow-2xl">
              <NotificationCenter />
            </div>
          )}
        </div>

        {/* User Profile */}
        <Link
          to="/profile"
          className="flex items-center gap-3 pl-3 border-l border-border hover:opacity-80 transition-opacity cursor-pointer group"
        >
          <EmployeeAvatar
            src={userDoc?.photoURL || userDoc?.avatar || user?.photoURL}
            name={displayName}
            fallback="E"
            className="w-9 h-9 rounded-xl bg-accent-soft text-accent font-medium text-xs group-hover:scale-105 transition-transform"
          />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold text-fg truncate max-w-[120px]">
              {displayName}
            </span>
            <span className="text-[10px] text-muted font-medium">
              Employee
            </span>
          </div>
        </Link>
      </div>
    </header>
  )
}
