import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from './stores/notificationStore'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import {
  Bell,
  CheckCheck,
  DollarSign,
  Users,
  Briefcase,
  Info,
  X,
  ExternalLink
} from 'lucide-react'

export const NotificationCenter = () => {
  const navigate = useNavigate()
  const { notifications, isOpen, setIsOpen, markAsRead, markAllAsRead } =
    useNotificationStore()

  if (!isOpen) return null

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const getIcon = (type) => {
    switch (type) {
      case 'finance':
        return <DollarSign className="w-4 h-4 text-emerald-400" />
      case 'crm':
        return <Users className="w-4 h-4 text-accent" />
      case 'project':
        return <Briefcase className="w-4 h-4 text-accent" />
      default:
        return <Info className="w-4 h-4 text-accent" />
    }
  }

  return (
    <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 shadow-2xl">
      <Card className="p-0 border-border bg-surface overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-3.5 border-b border-border flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-fg text-xs">Notifications</h3>
            {unreadCount > 0 && <Badge variant="success">{unreadCount} New</Badge>}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-semibold px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-chrome transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No notifications yet.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notificationId}
                onClick={() => {
                  markAsRead(n.notificationId)
                  if (n.link) {
                    setIsOpen(false)
                    navigate(n.link)
                  }
                }}
                className={`p-3.5 flex items-start gap-3 text-xs cursor-pointer transition-colors ${
                  n.isRead
                    ? 'bg-surface opacity-75 hover:bg-chrome/30'
                    : 'bg-emerald-50/50 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40'
                }`}
              >
                <div className="p-2 rounded-lg bg-chrome border border-border shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-200">{n.title}</span>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-muted text-[11px] leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block pt-0.5 font-medium">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
