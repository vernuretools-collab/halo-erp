import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, DollarSign, HeartPulse, Info, Briefcase, CheckCircle2, Megaphone } from 'lucide-react'
import { useNotificationStore } from './stores/notificationStore'
import { useUserStore } from '../../stores/userStore'
import { collectUserIdentityIds } from '../../features/projects/services/projectService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

const getIconForType = (type) => {
  switch (type) {
    case 'announcement':
      return <Megaphone className="w-5 h-5 text-amber-500" />
    case 'payslip':
      return <DollarSign className="w-5 h-5 text-emerald-500" />
    case 'finance':
      return <DollarSign className="w-5 h-5 text-emerald-500" />
    case 'project':
    case 'task':
      return <Briefcase className="w-5 h-5 text-accent" />
    case 'wellness':
      return <HeartPulse className="w-5 h-5 text-rose-500" />
    case 'crm':
      return <CheckCircle2 className="w-5 h-5 text-accent" />
    case 'info':
    default:
      return <Info className="w-5 h-5 text-slate-500" />
  }
}

const getBgForType = (type) => {
  switch (type) {
    case 'announcement':
      return 'bg-amber-50 dark:bg-amber-500/10'
    case 'payslip':
      return 'bg-emerald-50 dark:bg-emerald-500/10'
    case 'finance':
      return 'bg-emerald-50 dark:bg-emerald-500/10'
    case 'project':
    case 'task':
      return 'bg-accent-soft'
    case 'wellness':
      return 'bg-rose-50 dark:bg-rose-500/10'
    case 'crm':
      return 'bg-accent-soft'
    case 'info':
    default:
      return 'bg-slate-50 dark:bg-slate-500/10'
  }
}

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'finance', label: 'Finance' },
  { id: 'project', label: 'Project' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'info', label: 'Info' }
]

const formatDistanceToNow = (dateStr) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)
  
  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  return `${Math.floor(diffInSeconds / 86400)} days ago`
}

const isToday = (dateStr) => {
  const date = new Date(dateStr)
  const today = new Date()
  return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
}

const isYesterday = (dateStr) => {
  const date = new Date(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()
}

export const NotificationsPage = () => {
  const navigate = useNavigate()
  const { user, userDoc } = useUserStore()
  const { notifications, fetchNotifications, unsubscribe, markAsRead, markAllAsRead } = useNotificationStore()
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    const ids = collectUserIdentityIds(user, userDoc)
    if (ids.length) {
      fetchNotifications(ids)
    }
    return () => {
      if (unsubscribe) unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userDoc?.employeeDocId])

  const handleMarkAllRead = () => {
    if (user?.uid) {
      markAllAsRead(user.uid)
    }
  }

  const handleMarkAsRead = (notificationId) => {
    if (user?.uid) {
      markAsRead(user.uid, notificationId)
    }
  }

  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.notificationId)
    }
    if (notif.link) {
      navigate(notif.link)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'all') return true
    if (activeTab === 'unread') return !n.isRead
    if (activeTab === 'project') return n.type === 'project' || n.type === 'task'
    return n.type === activeTab
  })

  // Group by date
  const groupedNotifications = filteredNotifications.reduce((acc, notif) => {
    let group = 'Earlier'
    if (isToday(notif.createdAt)) group = 'Today'
    else if (isYesterday(notif.createdAt)) group = 'Yesterday'

    if (!acc[group]) acc[group] = []
    acc[group].push(notif)
    return acc
  }, {})

  const renderGroup = (title, items) => {
    if (!items || items.length === 0) return null

    return (
      <div key={title} className="mb-8">
        <h3 className="text-sm font-medium text-muted mb-4 px-1">{title}</h3>
        <div className="space-y-3">
          {items.map((notif) => (
            <Card 
              key={notif.notificationId}
              className={`p-4 transition-colors ${!notif.isRead ? 'bg-surface' : 'bg-canvas/50'} cursor-pointer hover:border-accent/50`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 rounded-xl shrink-0 ${getBgForType(notif.type)}`}>
                  {getIconForType(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className={`text-base font-semibold truncate ${!notif.isRead ? 'text-fg' : 'text-fg'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-muted shrink-0 whitespace-nowrap">
                      {formatDistanceToNow(notif.createdAt)}
                    </span>
                  </div>
                  <p className={`text-sm ${!notif.isRead ? 'text-fg' : 'text-muted'}`}>
                    {notif.message}
                  </p>
                </div>
                {!notif.isRead && (
                  <div className="shrink-0 w-2.5 h-2.5 rounded-full bg-accent mt-2" />
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <PageHeader
        title="Notifications"
        description="Stay updated with your latest alerts and activities."
        action={
          <Button variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <Check className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-chrome text-fg border border-border hover:bg-surface'
            }`}
          >
            {tab.label}
            {tab.id === 'unread' && unreadCount > 0 && (
              <Badge variant={activeTab === 'unread' ? 'default' : 'primary'} className={activeTab === 'unread' ? 'bg-white/20 text-white border-transparent' : ''}>
                {unreadCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {filteredNotifications.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-chrome flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-fg mb-2">
            No notifications found
          </h3>
          <p className="text-muted max-w-sm">
            {activeTab === 'all' 
              ? "You're all caught up! Check back later for new updates." 
              : `You don't have any ${activeTab} notifications at the moment.`}
          </p>
        </Card>
      ) : (
        <div>
          {renderGroup('Today', groupedNotifications['Today'])}
          {renderGroup('Yesterday', groupedNotifications['Yesterday'])}
          {renderGroup('Earlier', groupedNotifications['Earlier'])}
        </div>
      )}
    </div>
  )
}
