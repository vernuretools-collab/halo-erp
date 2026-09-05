import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, User, Sun, Moon } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useUIStore } from '../../stores/uiStore'
import { useNotificationStore } from '../../features/notifications/stores/notificationStore'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'

export const ClientTopBar = () => {
  const location = useLocation()
  const { user, userDoc } = useUserStore()
  const { theme, toggleTheme } = useUIStore()
  const { notifications, toggleOpen } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Derive current page title
  const getPageTitle = () => {
    const path = location.pathname
    if (path === '/portal' || path === '/portal/') return 'Overview'
    if (path.includes('/projects')) return 'My Projects'
    if (path.includes('/invoices')) return 'Invoices'
    if (path.includes('/files')) return 'Documents'
    if (path.includes('/support')) return 'Support'
    if (path.includes('/profile')) return 'My Profile'
    return 'Overview'
  }

  const displayName =
    userDoc?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Client User'

  return (
    <header className="h-20 bg-surface/90 backdrop-blur-md border-b border-border px-8 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Page Title */}
      <div>
        <h1 className="text-base font-bold text-fg tracking-tight">
          {getPageTitle()}
        </h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Sun/Moon Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-xl bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-all cursor-pointer border border-border"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={toggleOpen}
            aria-label="Notifications"
            className="w-9 h-9 rounded-xl bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors border border-border cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
            )}
          </button>
          <NotificationCenter />
        </div>

        {/* User Profile Pill - Icon & Username only */}
        <Link
          to="/portal/profile"
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full hover:bg-chrome transition-colors cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold text-xs shrink-0">
            <User className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-fg group-hover:text-accent transition-colors">
            {displayName}
          </span>
        </Link>
      </div>
    </header>
  )
}



