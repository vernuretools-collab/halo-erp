import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from './stores/notificationStore'
import { useUserStore } from '../../stores/userStore'
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
  Heart,
  ArrowRight,
  Megaphone,
} from 'lucide-react'

export const NotificationCenter = () => {
  const navigate = useNavigate()
  const { user } = useUserStore()
  const { notifications, setIsOpen, markAsRead, markAllAsRead } = useNotificationStore()

  const uid = user?.uid
  const unreadCount = notifications.filter((n) => !n.isRead).length

  const getIcon = (type) => {
    switch (type) {
      case 'announcement':
        return <Megaphone className="w-4 h-4 text-amber-500" />
      case 'payslip':
        return <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      case 'finance':
        return <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
      case 'crm':
        return <Users className="w-4 h-4 text-violet-600 dark:text-violet-400" />
      case 'project':
      case 'task':
        return <Briefcase className="w-4 h-4 text-accent" />
      case 'wellness':
        return <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
      default:
        return <Info className="w-4 h-4 text-accent" />
    }
  }

  return (
    <Card className="p-0 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-chrome">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-fg text-xs">Notifications</h3>
          {unreadCount > 0 && <Badge variant="brand">{unreadCount} New</Badge>}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead(uid)}
              className="text-[10px] text-accent hover:opacity-80 font-semibold px-2 py-1 rounded hover:bg-accent-soft transition-colors flex items-center gap-1"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-muted hover:text-fg p-1 rounded-lg hover:bg-border"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-border">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No notifications yet.
          </div>
        ) : (
          notifications.slice(0, 8).map((n) => (
            <div
              key={n.notificationId}
              onClick={() => {
                markAsRead(uid, n.notificationId)
                if (n.link) {
                  setIsOpen(false)
                  navigate(n.link)
                }
              }}
              className={`p-3.5 flex items-start gap-3 text-xs cursor-pointer transition-colors ${
                n.isRead
                  ? 'bg-surface opacity-75 hover:bg-chrome'
                  : 'bg-accent-soft/50 hover:bg-accent-soft'
              }`}
            >
              <div className="p-2 rounded-lg bg-chrome border border-border shrink-0">
                {getIcon(n.type)}
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-fg truncate">{n.title}</span>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  )}
                </div>
                <p className="text-muted text-[11px] leading-relaxed line-clamp-2">{n.message}</p>
                <span className="text-[10px] text-muted block">
                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-2.5 border-t border-border bg-chrome">
          <button
            onClick={() => {
              setIsOpen(false)
              navigate('/notifications')
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-accent hover:opacity-80 py-1.5 rounded-lg hover:bg-accent-soft transition-colors"
          >
            View all notifications <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Card>
  )
}
