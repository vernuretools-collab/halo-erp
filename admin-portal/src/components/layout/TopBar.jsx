import React from 'react'
import { Link } from 'react-router-dom'
import { Bell, Search, User, Command, LogOut, Sun, Moon } from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useOrgStore } from '../../stores/orgStore'
import { useUIStore } from '../../stores/uiStore'
import { useNotificationStore } from '../../features/notifications/stores/notificationStore'
import { NotificationCenter } from '../../features/notifications/NotificationCenter'

export const TopBar = () => {
  const { user, userDoc, clearUser } = useUserStore()
  const { org } = useOrgStore()
  const { theme, toggleTheme } = useUIStore()
  const { notifications, toggleOpen } = useNotificationStore()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  return (
    <header className="h-16 bg-surface/90 backdrop-blur-md border-b border-border px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Global Search Bar */}
      <div className="flex items-center gap-3 w-80">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search leads, projects, invoices... (Cmd+K)"
            className="w-full bg-surface border border-border text-xs text-fg placeholder-muted rounded-xl pl-9 pr-8 py-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[10px] text-muted bg-chrome px-1.5 py-0.5 rounded border border-border">
            <Command className="w-3 h-3" /> K
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 relative">
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

        {/* Notification Bell with Badge & Dropdown */}
        <div className="relative">
          <button
            onClick={toggleOpen}
            className="relative w-9 h-9 rounded-xl bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors border border-border cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" />
            )}
          </button>
          <NotificationCenter />
        </div>

        {/* User Profile Menu & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-border">
          <Link
            to="/settings/profile"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent border border-accent/20 flex items-center justify-center font-medium text-xs group-hover:scale-105 transition-transform">
              {(userDoc?.displayName || user?.displayName) ? (userDoc?.displayName || user?.displayName).charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-fg">
                {userDoc?.displayName || user?.displayName || 'Demo Executive'}
              </span>
              <span className="text-[10px] text-muted">
                {user?.email || 'admin@businessos.io'}
              </span>
            </div>
          </Link>

          <button
            onClick={clearUser}
            title="Log Out"
            className="w-9 h-9 ml-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}

