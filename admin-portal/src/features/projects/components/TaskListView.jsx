import React, { useMemo, useState } from 'react'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Clock, User, Calendar, ArrowUpDown } from 'lucide-react'

const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 }

export const TaskListView = ({
  tasks = [],
  statuses = [],
  onTaskClick,
  onStatusChange,
  metaLabel = 'Hours',
  getMetaValue,
  getLeadName,
}) => {
  const [sortKey, setSortKey] = useState('dueDate')
  const [sortDir, setSortDir] = useState('asc')

  const statusMap = useMemo(() => {
    const map = {}
    statuses.forEach((s) => {
      map[s.id] = s.name
    })
    return map
  }, [statuses])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedTasks = useMemo(() => {
    const list = [...tasks]
    const dir = sortDir === 'asc' ? 1 : -1

    list.sort((a, b) => {
      let av
      let bv
      switch (sortKey) {
        case 'title':
          av = (a.title || '').toLowerCase()
          bv = (b.title || '').toLowerCase()
          return av.localeCompare(bv) * dir
        case 'project':
          av = (a.projectName || '').toLowerCase()
          bv = (b.projectName || '').toLowerCase()
          return av.localeCompare(bv) * dir
        case 'status':
          av = statusMap[a.status] || a.status || ''
          bv = statusMap[b.status] || b.status || ''
          return String(av).localeCompare(String(bv)) * dir
        case 'priority':
          av = priorityRank[a.priority] ?? 99
          bv = priorityRank[b.priority] ?? 99
          return (av - bv) * dir
        case 'assignee':
          av = (getLeadName?.(a) || a.createdByName || a.assigneeName || '').toLowerCase()
          bv = (getLeadName?.(b) || b.createdByName || b.assigneeName || '').toLowerCase()
          return av.localeCompare(bv) * dir
        case 'dueDate':
        default:
          av = a.dueDate || '9999-12-31'
          bv = b.dueDate || '9999-12-31'
          return av.localeCompare(bv) * dir
      }
    })
    return list
  }, [tasks, sortKey, sortDir, statusMap, getLeadName])

  const SortHeader = ({ label, column }) => (
    <button
      type="button"
      onClick={() => toggleSort(column)}
      className="inline-flex items-center gap-1 hover:text-accent dark:hover:text-accent transition-colors"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${sortKey === column ? 'text-accent' : 'text-slate-400'}`}
      />
    </button>
  )

  if (tasks.length === 0) {
    return (
      <Card className="p-10 text-center border-border bg-surface">
        <p className="text-sm text-muted">No tasks match the current filters.</p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-border bg-surface p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[820px]">
          <thead>
            <tr className="border-b border-border bg-slate-50/80 dark:bg-slate-900/40 text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Task" column="title" />
              </th>
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Project" column="project" />
              </th>
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Status" column="status" />
              </th>
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Priority" column="priority" />
              </th>
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Assignee" column="assignee" />
              </th>
              <th className="px-4 py-3 font-semibold">
                <SortHeader label="Due" column="dueDate" />
              </th>
              <th className="px-4 py-3 font-semibold">{metaLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {sortedTasks.map((task) => (
              <tr
                key={task.taskId || task.id}
                onClick={() => onTaskClick?.(task)}
                className="hover:bg-accent-soft cursor-pointer transition-colors group"
              >
                <td className="px-4 py-3">
                  <span className="text-xs font-bold text-fg group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    {task.title}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-accent font-medium">
                    {task.projectName || '—'}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {onStatusChange ? (
                    <select
                      value={task.status}
                      onChange={(e) => onStatusChange(task.taskId || task.id, e.target.value)}
                      className="bg-canvas border border-border text-[11px] text-slate-800 dark:text-slate-300 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                    >
                      {statuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Badge variant="brand">{statusMap[task.status] || task.status}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      task.priority === 'critical' || task.priority === 'high' ? 'danger' : 'info'
                    }
                  >
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <User className="w-3 h-3 text-slate-400" />
                    {getLeadName?.(task) || task.createdByName || task.assigneeName || 'Unassigned'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Calendar className="w-3 h-3 text-accent" />
                    {task.dueDate || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Clock className="w-3 h-3 text-accent" />
                    {getMetaValue
                      ? getMetaValue(task)
                      : `${task.loggedHours || 0} / ${task.estimatedHours || 0}h`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
