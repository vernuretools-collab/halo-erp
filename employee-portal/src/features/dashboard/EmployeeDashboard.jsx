import React, { useState, useEffect } from 'react'
import { useUserStore } from '../../stores/userStore'
import { useProjectStore } from '../projects/stores/projectStore'
import { ClockInOverviewWidget } from './components/ClockInOverviewWidget'
import { WellnessWidget } from '../wellness/WellnessWidget'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useTeamStore } from '../team/stores/teamStore'
import {
  formatLeaveDuration,
  getRequestedLeaveType,
  leaveMatchesEmployeeFilter,
} from '../team/services/leaveEntitlementUtils'
import {
  CheckCircle2,
  Circle,
  Calendar,
  Briefcase,
  Users,
  FolderKanban,
  Sun,
  Moon,
  CalendarDays,
  Megaphone,
  Target,
  ChevronRight,
  Home,
  Umbrella,
  HeartPulse,
  Laptop,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { isTaskVisibleToUser } from '../projects/services/projectService'
import { db } from '../../shared/services/firebaseService'
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore'

const quickLinks = [
  { name: 'Projects', path: '/projects/list', icon: FolderKanban, tile: 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { name: 'Sprint Tasks', path: '/tasks', icon: Briefcase, tile: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { name: 'Work Timeline', path: '/timeline', icon: CalendarDays, tile: 'bg-accent-soft text-accent' },
  { name: 'Team Directory', path: '/directory', icon: Users, tile: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  { name: 'Attendance', path: '/attendance', icon: Calendar, tile: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { name: 'Leave & PTO', path: '/team/leave', icon: Calendar, tile: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { name: 'My Goals', path: '/goals', icon: Target, tile: 'bg-accent-soft text-accent' },
]

const requestStyle = (leaveType = '') => {
  const t = leaveType.toLowerCase()
  if (t.includes('wfh') || t.includes('work from home')) {
    return { icon: Home, tile: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  }
  if (t.includes('sick')) {
    return { icon: HeartPulse, tile: 'bg-accent-soft text-accent' }
  }
  if (t.includes('duty') || t.includes('permission')) {
    return { icon: Laptop, tile: 'bg-accent-soft text-accent' }
  }
  if (t.includes('emergency')) {
    return { icon: Umbrella, tile: 'bg-[#7F1D1D]/10 text-[#7F1D1D] dark:text-[#FECACA]' }
  }
  if (t.includes('lop')) {
    return { icon: Umbrella, tile: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' }
  }
  return { icon: Umbrella, tile: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' }
}

const requestStatusVariant = (status) => {
  if (status === 'approved') return 'success'
  if (status === 'rejected' || status === 'cancelled') return 'danger'
  return 'warning'
}

export const EmployeeDashboard = () => {
  const { user, userDoc, claims } = useUserStore()
  const { tasks, projects, updateTaskStatus, fetchProjectsAndTasks } = useProjectStore()
  const leaveRequests = useTeamStore((s) => s.leaveRequests)

  const currentUserId = userDoc?.uid || user?.uid
  const currentUserEmail = userDoc?.email || user?.email

  const displayName = userDoc?.displayName || user?.displayName || 'Team Member'
  const firstName = displayName.split(' ')[0]

  const [currentHour, setCurrentHour] = useState(() => new Date().getHours())

  // Dashboard data state
  const [announcements, setAnnouncements] = useState([])
  const [leaveBalance, setLeaveBalance] = useState({ annual: 12, used: 0 })
  const [loadingWidgets, setLoadingWidgets] = useState(true)

  const [userQuote, setUserQuote] = useState(() => {
    const stored = currentUserId ? localStorage.getItem(`crm_quote_${currentUserId}`) : ''
    const fromDoc = userDoc?.quote || userDoc?.proverb || ''
    const persisted = Date.parse(userDoc?.quoteUpdatedAt || '') || 0
    return (persisted > 0 ? fromDoc : stored || fromDoc) || ''
  })

  useEffect(() => {
    const stored = currentUserId ? localStorage.getItem(`crm_quote_${currentUserId}`) : ''
    const fromDoc = userDoc?.quote || userDoc?.proverb || ''
    const persisted = Date.parse(userDoc?.quoteUpdatedAt || '') || 0
    setUserQuote((persisted > 0 ? fromDoc : stored || fromDoc) || '')
  }, [userDoc, currentUserId])

  useEffect(() => {
    fetchProjectsAndTasks()
  }, [fetchProjectsAndTasks])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // Fetch dashboard widget data
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false

    const fetchWidgetData = async () => {
      try {
        // Fetch latest 3 announcements
        try {
          const annRef = collection(db, 'announcements')
          const annQ = query(annRef, orderBy('createdAt', 'desc'), limit(3))
          const annSnap = await getDocs(annQ)
          if (!cancelled) {
            setAnnouncements(annSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
          }
        } catch {
          // Collection may not exist yet; silently skip
        }

        // Fetch leave balance (approved leave requests this year)
        try {
          const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
          const leaveRef = collection(db, 'leaveRequests')
          const leaveQ = query(
            leaveRef,
            where('employeeId', '==', currentUserId),
            where('status', '==', 'approved'),
            where('startDate', '>=', yearStart)
          )
          const leaveSnap = await getDocs(leaveQ)
          const usedDays = leaveSnap.docs.reduce((sum, d) => sum + (Number(d.data().daysCount) || 1), 0)
          if (!cancelled) {
            setLeaveBalance({ annual: 24, used: usedDays })
          }
        } catch {
          // Collection may not exist yet; silently skip
        }
      } finally {
        if (!cancelled) setLoadingWidgets(false)
      }
    }

    fetchWidgetData()
    return () => { cancelled = true }
  }, [currentUserId])

  const isBrightSun = currentHour >= 10 && currentHour < 17

  const visibleTasks = tasks.filter((t) => isTaskVisibleToUser(t, user, userDoc, claims, projects, tasks))
  const focusTasks = visibleTasks.filter((t) => t.status !== 'done' && t.status !== 'completed')

  const todayIso = new Date().toISOString().split('T')[0]
  const formatTaskDue = (dueDate) => {
    if (!dueDate) return null
    const dueStr = String(dueDate).slice(0, 10)
    if (dueStr === todayIso) return { text: 'Due Today', urgent: true }
    if (dueStr < todayIso) return { text: 'Overdue', urgent: true }
    const due = new Date(`${dueStr}T00:00:00`)
    return {
      text: `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      urgent: false,
    }
  }

  const myRecentRequests = (Array.isArray(leaveRequests) ? leaveRequests : [])
    .filter((l) =>
      leaveMatchesEmployeeFilter(l, {
        employeeId: currentUserId,
        uid: currentUserId,
        employeeEmail: currentUserEmail,
        employeeName: displayName,
      })
    )
    .sort((a, b) => {
      const aDate = a.createdAt?.toDate?.() || new Date(a.startDate || 0)
      const bDate = b.createdAt?.toDate?.() || new Date(b.startDate || 0)
      return bDate - aDate
    })
    .slice(0, 5)

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const handleToggleTaskStatus = (t) => {
    const nextStatus = t.status === 'done' ? 'in_progress' : 'done'
    updateTaskStatus(t.taskId, nextStatus)
  }

  const priorityColors = {
    urgent: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30',
    info: 'bg-accent-soft border-accent/20',
    event: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-accent-soft via-accent-soft to-accent-soft border border-accent/20 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-72 h-72 bg-accent-soft blur-3xl rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center text-accent font-bold text-lg shrink-0">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-fg">
                Good {currentHour < 12 ? 'Morning' : currentHour < 17 ? 'Afternoon' : 'Evening'}, {firstName}!
              </h1>
              <p className="text-muted text-sm mt-0.5">{today}</p>
            </div>
          </div>

          {userQuote ? (
            <div className="flex-1 max-w-xl mx-0 sm:mx-4 my-2 lg:my-0">
              <p className="text-xs sm:text-sm italic font-medium text-fg truncate">
                "{userQuote}"
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-center shrink-0">
            {isBrightSun ? (
              <div
                title="10:00 AM - 5:00 PM: Bright Sun"
                className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 shadow-[0_0_20px_rgba(7,146,139,0.45)] animate-pulse flex items-center justify-center"
              >
                <Sun className="w-10 h-10 fill-amber-400/40 text-amber-500 dark:text-amber-400 drop-shadow-[0_0_12px_rgba(7,146,139,0.9)]" />
              </div>
            ) : (
              <div
                title="After 5:00 PM / Night: Moon"
                className="p-3.5 rounded-2xl bg-accent-soft border border-accent/20 text-accent flex items-center justify-center"
              >
                <Moon className="w-10 h-10 text-accent" />
              </div>
            )}
          </div>
        </div>
      </div>

      <ClockInOverviewWidget>
        <Card className="p-5 border-border space-y-3 w-full h-full flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">My Tasks</h2>
            <NavLink to="/tasks" className="text-xs text-accent hover:underline font-medium flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </NavLink>
          </div>

          {focusTasks.length === 0 ? (
            <div className="flex-1 py-8 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No open priority tasks.
            </div>
          ) : (
            <div className="space-y-1 flex-1 overflow-auto">
              {focusTasks.slice(0, 6).map((task) => {
                const due = formatTaskDue(task.dueDate)
                return (
                  <div
                    key={task.taskId}
                    onClick={() => handleToggleTaskStatus(task)}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer hover:bg-chrome/50 transition-colors"
                  >
                    <Circle className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm block truncate text-fg font-medium">
                        {task.title}
                      </span>
                      <span className={`text-[11px] ${due?.urgent ? 'text-rose-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
                        {due?.text || task.projectName || 'No due date'}
                      </span>
                    </div>
                    <Badge
                      variant={task.priority === 'critical' || task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warning' : 'success'}
                      className="shrink-0 capitalize"
                    >
                      {task.priority || 'low'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </ClockInOverviewWidget>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Recent Activity</h2>
            <NavLink to="/team/leave" className="text-xs text-accent hover:underline font-medium flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </NavLink>
          </div>
          {myRecentRequests.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              <Umbrella className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No recent requests.
            </div>
          ) : (
            <div className="space-y-2">
              {myRecentRequests.map((req) => {
                const leaveType = getRequestedLeaveType(req)
                const style = requestStyle(leaveType)
                const Icon = style.icon
                const duration = formatLeaveDuration(req)
                return (
                  <div key={req.leaveId || req.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-chrome/40">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.tile}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-fg block truncate">
                        {leaveType}
                      </span>
                      <span className="text-[10px] text-muted block truncate">
                        {duration || req.startDate}
                      </span>
                    </div>
                    <Badge variant={requestStatusVariant(req.status)} className="shrink-0 capitalize">
                      {req.status || 'pending'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5 border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Announcements</h2>
            <NavLink
              to="/announcements"
              className="text-xs text-accent hover:underline font-medium flex items-center gap-1"
            >
              View all <ChevronRight className="w-3 h-3" />
            </NavLink>
          </div>
          {loadingWidgets ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 bg-chrome/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
              <Megaphone className="w-6 h-6 mx-auto mb-2 opacity-30" />
              No announcements yet.
            </div>
          ) : (
            <div className="space-y-2">
              {announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  className={`flex items-start gap-3 p-3 rounded-xl ${priorityColors[ann.priority] || priorityColors['info']}`}
                >
                  <div className="w-8 h-8 rounded-lg bg-white/70 dark:bg-slate-900/40 flex items-center justify-center shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-fg block truncate">{ann.title}</span>
                    {ann.body && (
                      <p className="text-[11px] text-muted mt-0.5 line-clamp-2">{ann.body}</p>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">{ann.author}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5 border-border space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200">Quick Links</h2>
          <div className="grid grid-cols-3 gap-3">
            {quickLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className="flex flex-col items-center gap-2 p-2 rounded-2xl hover:bg-chrome/50 transition-colors group"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${link.tile}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-medium text-muted text-center leading-tight group-hover:text-slate-900 dark:group-hover:text-slate-100">
                    {link.name}
                  </span>
                </NavLink>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Wellness Hub Widget */}
      <WellnessWidget />
    </div>
  )
}
