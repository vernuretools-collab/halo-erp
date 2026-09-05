import React from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useProjectStore } from './stores/projectStore'
import { FolderKanban, Kanban, Clock, User, CheckCircle2 } from 'lucide-react'

export const TimeTracker = () => {
  const { tasks } = useProjectStore()

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
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Task Name</th>
              <th className="p-4 font-semibold">Project</th>
              <th className="p-4 font-semibold">Assignee</th>
              <th className="p-4 font-semibold">Estimated</th>
              <th className="p-4 font-semibold">Logged Hours</th>
              <th className="p-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {tasks.map((t) => (
              <tr key={t.taskId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-fg">
                <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{t.title}</td>
                <td className="p-4 text-slate-800 dark:text-slate-300">{t.projectName}</td>
                <td className="p-4 text-muted">{t.assigneeName}</td>
                <td className="p-4 text-muted">{t.estimatedHours} hrs</td>
                <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{t.loggedHours} hrs</td>
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
