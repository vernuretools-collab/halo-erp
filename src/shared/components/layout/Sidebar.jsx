import React from 'react'
import { NavLink } from 'react-router-dom'
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
  Shield,
  Layers,
  Clock,
  FileText,
  Download,
  FolderKanban,
  CheckCircle2,
  Crown,
  User,
  CreditCard
} from 'lucide-react'
import haloLogo from '../../../assets/halologo.png'
import { useUIStore } from '../../stores/uiStore'
import { useUserStore } from '../../stores/userStore'

export const Sidebar = () => {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { claims, user } = useUserStore()

  const userRole = claims?.role || 'admin'
  const userTier = claims?.tier || 'company'
  const displayRole = (userRole === 'owner' || userRole === 'admin') ? 'ADMIN' : userRole.toUpperCase()

  // Dynamic Navigation Items Filtered by Role
  const getNavItemsForRole = () => {
    // 1. Client Role Menu
    if (userTier === 'client' || userRole === 'client') {
      return [
        { name: 'Portal Overview', path: '/portal', icon: Layers },
        { name: 'My Projects', path: '/portal/projects', icon: Briefcase },
        { name: 'Invoices & Receipts', path: '/portal/invoices', icon: FileText },
        { name: 'Billing', path: '/portal/billing', icon: CreditCard },
        { name: 'Deliverables & Files', path: '/portal/files', icon: Download },
      ]
    }

    // 2. Employee / EMPLOYEERole Menu
    if (userRole === 'employee') {
      return [
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Projects List', path: '/projects/list', icon: FolderKanban },
        { name: 'Sprint Task Board', path: '/projects/tasks', icon: Briefcase },
        { name: 'Time Tracking', path: '/projects/time', icon: Clock },
        { name: 'Team Directory', path: '/team/employees', icon: Users },
        { name: 'Attendance', path: '/team/attendance', icon: CheckCircle2 },
        { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
        { name: 'My Profile', path: '/employee/profile', icon: User },
      ]
    }

    // 3. Admin / Founder Role Menu (Full Executive Suite)
    return [
      { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
      { name: 'CRM & Pipeline', path: '/crm', icon: Users },
      { name: 'Projects Management', path: '/projects', icon: Briefcase },
      { name: 'Finance & Invoicing', path: '/finance', icon: DollarSign },
      { name: 'Team Management', path: '/team', icon: UserCheck },
      { name: 'Marketing Hub', path: '/marketing', icon: Megaphone },
      { name: 'KPIs & Health', path: '/kpi', icon: Activity },
      { name: 'Workflows', path: '/workflows', icon: GitBranch },
      { name: 'Knowledge Base', path: '/knowledge', icon: BookOpen },
      { name: 'Client Portal View', path: '/portal', icon: Layers },
      { name: 'Settings', path: '/settings', icon: Settings },
      { name: 'My Profile', path: '/settings/profile', icon: User },
    ]
  }

  const navItems = getNavItemsForRole()

  const getRoleLabel = () => {
    if (userTier === 'client' || userRole === 'client') return { label: 'Client Workspace', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }
    if (userRole === 'employee') return { label: 'Employee Portal', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' }
    return { label: 'Admin Executive Suite', color: 'text-accent bg-accent-soft border-accent/20' }
  }

  const roleMeta = getRoleLabel()

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-chrome border-r border-border transition-all duration-300 flex flex-col ${sidebarOpen ? 'w-64' : 'w-20'
        }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-3 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-11 h-11 bg-white p-1 rounded-full border border-slate-200 dark:border-white/30 shadow-sm flex items-center justify-center shrink-0">
            <img src={haloLogo} alt="The Halo Effect Consulting" className="w-full h-full object-contain rounded-full" />
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

      {/* Nav Links Filtered by Role */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 shadow-sm'
                  : 'text-muted hover:text-fg hover:bg-surface'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="truncate">{item.name}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer / Active Role Indicator Badge */}
      <div className="p-3 border-t border-border">
        <div className={`flex items-center gap-3 p-2 rounded-xl bg-surface border border-border ${!sidebarOpen && 'justify-center'}`}>
          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-xs shrink-0">
            {userRole.charAt(0).toUpperCase()}
          </div>
          {sidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-fg truncate">{user?.displayName || 'Acme Executive'}</span>
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

