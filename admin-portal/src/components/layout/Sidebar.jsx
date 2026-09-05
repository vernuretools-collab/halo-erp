import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  DollarSign,
  UserCheck,
  Megaphone,
  BookOpen,
  Activity,
  GitBranch,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  Clock,
  FileText,
  Download,
  FolderKanban,
  CheckCircle2,
  User,
  Building,
  BarChart2,
  Calendar,
  LifeBuoy,
  IndianRupee,
  Shield,
  Sliders,
  Bot,
} from 'lucide-react'
import haloLogo from '../../assets/halologo.png'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'

// ─── Role-based Nav Group Definitions ────────────────────────────────────────

const CLIENT_GROUPS = [
  {
    key: 'portal',
    label: 'Client Portal',
    icon: Layers,
    items: [
      { name: 'Portal Overview', path: '/portal', icon: Layers },
      { name: 'My Projects', path: '/portal/projects', icon: Briefcase },
      { name: 'Invoices & Receipts', path: '/portal/invoices', icon: FileText },
      { name: 'Deliverables & Files', path: '/portal/files', icon: Download },
    ],
  },
]

const EMPLOYEE_GROUPS = [
  {
    key: 'workspace',
    label: 'Workspace',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: Briefcase,
    items: [
      { name: 'Sprint Task Board', path: '/projects/tasks', icon: Briefcase },
      { name: 'Time Tracking', path: '/projects/time', icon: Clock },
    ],
  },
  {
    key: 'team',
    label: 'Team',
    icon: Users,
    items: [
      { name: 'Team Directory', path: '/team/employees', icon: Users },
      { name: 'Attendance', path: '/team/attendance', icon: CheckCircle2 },
    ],
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    icon: BookOpen,
    items: [
      { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
    ],
  },
]

const ADMIN_GROUPS = [
  {
    key: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    items: [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'Assistant', path: '/assistant', icon: Bot },
    ],
  },
  {
    key: 'crm',
    label: 'CRM & Pipeline',
    icon: Users,
    items: [
      { name: 'CRM Pipeline', path: '/crm/pipeline', icon: Users },
      { name: 'Leads', path: '/crm/leads', icon: UserCheck },
      { name: 'Contacts', path: '/crm/contacts', icon: User },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: Briefcase,
    items: [
      { name: 'Project List', path: '/projects/list', icon: FolderKanban },
      { name: 'Task Board', path: '/projects/tasks', icon: Briefcase },
      { name: 'Time Tracker', path: '/projects/time', icon: Clock },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: IndianRupee,
    items: [
      { name: 'Invoices', path: '/finance/invoices', icon: FileText },
      { name: 'Expenses', path: '/finance/expenses', icon: IndianRupee },
      { name: 'Recurring Billing', path: '/finance/recurring', icon: Calendar },
    ],
  },
  {
    key: 'team',
    label: 'Team Management',
    icon: UserCheck,
    items: [
      { name: 'Employees', path: '/team/employees', icon: Users },
      { name: 'Announcements', path: '/team/announcements', icon: Megaphone },
      { name: 'Client Support', path: '/team/helpdesk', icon: LifeBuoy },
      { name: 'Attendance', path: '/team/attendance', icon: CheckCircle2 },
      { name: 'Leave Management', path: '/team/leave', icon: Calendar },
      { name: 'Holidays', path: '/team/holidays', icon: Calendar },
      { name: 'Payslips', path: '/team/payslips', icon: FileText },
      { name: 'Employee Documents', path: '/team/documents', icon: FileText },
      { name: 'Leave & WFH Policy', path: '/team/wfh-policy', icon: Building },
      { name: 'Timelines', path: '/team/timeline', icon: Clock },
      { name: 'Monthly Reports', path: '/team/reports', icon: BarChart2 },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { name: 'Campaigns', path: '/marketing/campaigns', icon: Megaphone },
      { name: 'Content Calendar', path: '/marketing/content', icon: Calendar },
      { name: 'UTM Builder', path: '/marketing/utm-builder', icon: GitBranch },
    ],
  },
  {
    key: 'kpi',
    label: 'Business Health',
    icon: Activity,
    items: [
      { name: 'KPI Dashboard', path: '/kpi', icon: Activity },
      { name: 'KPI Builder', path: '/kpi/builder', icon: GitBranch },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: BarChart2,
    items: [
      { name: 'Sales Report', path: '/reports/sales', icon: BarChart2 },
      { name: 'Finance Report', path: '/reports/finance', icon: DollarSign },
      { name: 'Project Report', path: '/reports/projects', icon: Briefcase },
    ],
  },
  {
    key: 'workflows',
    label: 'Workflows',
    icon: GitBranch,
    items: [
      { name: 'Workflow List', path: '/workflows', icon: GitBranch },
      { name: 'Builder', path: '/workflows/builder', icon: Settings },
      { name: 'History', path: '/workflows/history', icon: Clock },
    ],
  },
  {
    key: 'knowledge',
    label: 'Knowledge Base',
    icon: BookOpen,
    items: [
      { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    items: [
      { name: 'Organization Settings', path: '/settings/org', icon: Building },
      { name: 'My Profile', path: '/settings/profile', icon: User },
    ],
  },
]

export const Sidebar = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { claims, user, userDoc } = useUserStore()
  const location = useLocation()

  const userRole = claims?.role || 'admin'
  const userTier = claims?.tier || 'company'
  const displayRole =
    userRole === 'owner' || userRole === 'admin' ? 'ADMIN' : userRole.toUpperCase()

  const getNavGroups = () => {
    if (userTier === 'client' || userRole === 'client') return CLIENT_GROUPS
    if (userRole === 'employee') return EMPLOYEE_GROUPS
    return ADMIN_GROUPS
  }

  const navGroups = getNavGroups()

  const getInitialExpanded = () => {
    const activeGroup = navGroups.find((g) =>
      g.items.length > 1 && g.items.some((item) => location.pathname.startsWith(item.path))
    )
    return activeGroup ? { [activeGroup.key]: true } : {}
  }

  const [expandedGroups, setExpandedGroups] = useState(getInitialExpanded)

  useEffect(() => {
    const activeGroup = navGroups.find((g) =>
      g.items.length > 1 && g.items.some((item) => location.pathname.startsWith(item.path))
    )
    if (activeGroup) {
      setExpandedGroups({ [activeGroup.key]: true })
    }
  }, [location.pathname, userRole, userTier])

  const toggleGroup = (key) => {
    if (!sidebarOpen) return
    setExpandedGroups((prev) => (prev[key] ? {} : { [key]: true }))
  }

  const getRoleLabel = () => {
    if (userTier === 'client' || userRole === 'client')
      return { label: 'Client Workspace', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    if (userRole === 'employee')
      return { label: 'Employee Portal', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
    return {
      label: 'Admin Executive Suite',
      color: 'text-accent bg-accent-soft border-accent/20',
    }
  }

  const roleMeta = getRoleLabel()

  const isGroupActive = (group) =>
    group.items.some((item) => location.pathname.startsWith(item.path))

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-chrome border-r border-border transition-all duration-300 flex flex-col ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-11 h-11 bg-white p-1 rounded-full border border-slate-200 dark:border-white/30 shadow-sm flex items-center justify-center shrink-0">
            <img
              src={haloLogo}
              alt="The Halo Effect Consulting"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          {sidebarOpen && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="font-bold text-fg text-xs tracking-wide whitespace-nowrap">
                BUSINESS OS
              </span>
              <span className="text-[10px] text-accent font-semibold tracking-wider mt-1 uppercase whitespace-nowrap">
                {displayRole} MODE
              </span>
            </div>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          className="w-8 h-8 rounded-lg bg-surface hover:bg-border text-muted hover:text-fg flex items-center justify-center transition-colors cursor-pointer shrink-0 border border-border"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navGroups.map((group) => {
          const GroupIcon = group.icon
          const isExpanded = expandedGroups[group.key]
          const groupActive = isGroupActive(group)
          const isSingleItem = group.items.length === 1

          if (isSingleItem) {
            const item = group.items[0]
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={!sidebarOpen ? item.name : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mx-1 ${
                    isActive
                      ? 'bg-accent-soft text-accent border border-accent/20 shadow-sm'
                      : 'text-muted hover:text-fg hover:bg-surface'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="truncate">{item.name}</span>}
              </NavLink>
            )
          }

          return (
            <div key={group.key} className="mx-1">
              <button
                onClick={() => toggleGroup(group.key)}
                title={!sidebarOpen ? group.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  groupActive && !isExpanded
                    ? 'bg-accent-soft text-accent border border-accent/20 shadow-sm'
                    : groupActive && isExpanded
                    ? 'text-accent'
                    : 'text-muted hover:text-fg hover:bg-surface'
                }`}
              >
                <GroupIcon className="w-5 h-5 shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 truncate text-left">{group.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-300 ease-in-out ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </>
                )}
              </button>

              {sidebarOpen && (
                <div
                  className={`grid transition-all duration-300 ease-in-out ${
                    isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-3 mt-0.5 pl-3 border-l border-border space-y-0.5 pb-1">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <NavLink
                            key={item.path}
                            to={item.path}
                            tabIndex={isExpanded ? 0 : -1}
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all ${
                                isActive
                                  ? 'bg-accent-soft text-accent border border-accent/20 shadow-sm'
                                  : 'text-muted hover:text-fg hover:bg-surface'
                              }`
                            }
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </NavLink>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer / Role Indicator */}
      <div className="p-3 border-t border-border">
        <div
          className={`flex items-center gap-3 p-2 rounded-xl bg-surface border border-border ${
            !sidebarOpen && 'justify-center'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-xs shrink-0">
            {(userDoc?.displayName || user?.displayName || userRole).charAt(0).toUpperCase()}
          </div>
          {sidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-fg truncate">
                {userDoc?.displayName || user?.displayName || 'Acme Executive'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border mt-0.5 ${roleMeta.color} truncate`}>
                {roleMeta.label}
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
