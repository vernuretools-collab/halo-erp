import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { useProjectStore } from './stores/projectStore'
import { useUserStore } from '../../shared/stores/userStore'
import { FolderKanban, Kanban, Clock, User, CheckCircle2 } from 'lucide-react'

const isTaskVisibleToUser = (t, user, userDoc, claims) => {
  if (!t) return false
  const currentUserId = userDoc?.uid || user?.uid || userDoc?.id
  const currentUserEmail = userDoc?.email || user?.email

  const rawRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    rawRole === 'admin' ||
    rawRole === 'owner' ||
    rawRole === 'superadmin'

  if (isAdmin) return true

  const isCreatedByAdmin =
    t.createdByRole === 'admin' ||
    t.createdByRole === 'owner' ||
    t.createdByRole === 'superadmin' ||
    t.isAdminCreated === true

  if (isCreatedByAdmin) return true

  const hasCreatorInfo = Boolean(
    t.createdBy ||
    t.createdByEmail ||
    t.createdByName ||
    t.createdByRole === 'employee' ||
    t.isEmployeeCreated === true
  )

  if (!hasCreatorInfo) return true

  const isCreatorByUid =
    t.createdBy && currentUserId && String(t.createdBy) === String(currentUserId)
  const isCreatorByEmail =
    t.createdByEmail && currentUserEmail && String(t.createdByEmail).toLowerCase() === String(currentUserEmail).toLowerCase()

  return Boolean(isCreatorByUid || isCreatorByEmail)
}

export const TimeTracker = () => {
  const { tasks } = useProjectStore()
  const { user, userDoc, claims } = useUserStore()

  const visibleTasks = tasks.filter((t) => isTaskVisibleToUser(t, user, userDoc, claims))

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Time Tracking & Utilization"
          description="Log billable hours, monitor task time estimates, and track team productivity"
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/projects/list"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <FolderKanban className="w-3.5 h-3.5" /> All Projects
          </NavLink>
          <NavLink
            to="/projects/tasks"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Kanban className="w-3.5 h-3.5" /> Task Board
          </NavLink>
          <NavLink
            to="/projects/time"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Clock className="w-3.5 h-3.5" /> Time Tracking
          </NavLink>
        </div>
      </div>

      {/* Time Tracking Log Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-900/80 border-b border-border text-slate-400">
              <th className="p-4 font-semibold">Task Name</th>
              <th className="p-4 font-semibold">Project</th>
              <th className="p-4 font-semibold">Assignee</th>
              <th className="p-4 font-semibold">Estimated</th>
              <th className="p-4 font-semibold">Logged Hours</th>
              <th className="p-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {visibleTasks.map((t) => (
              <tr key={t.taskId} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-200">{t.title}</td>
                <td className="p-4 text-slate-300">{t.projectName}</td>
                <td className="p-4 text-slate-400">{t.assigneeName}</td>
                <td className="p-4 text-slate-400">{t.estimatedHours} hrs</td>
                <td className="p-4 font-bold text-emerald-400">{t.loggedHours} hrs</td>
                <td className="p-4">
                  <Badge variant={t.status === 'done' ? 'success' : 'info'}>{t.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
