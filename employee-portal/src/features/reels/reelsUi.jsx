import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { formatClockLabel, monthKey, monthName } from '../../../../shared/reels/deadlines.js'

export function reelSoundEnabled() {
  return true
}

export const FIELD =
  'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-fg outline-none focus:border-accent'

export const STATUS_DOT = {
  todo: 'var(--info)',
  in_progress: 'var(--success)',
  in_review: 'var(--warning)',
  changes_requested: 'var(--danger)',
  ready_to_schedule: 'var(--accent)',
  scheduled: 'var(--info)',
  published: 'var(--muted)',
}

export const RISK_PILL = {
  on_track: 'bg-success-soft text-success',
  at_risk: 'bg-warning-soft text-warning',
  late: 'bg-warning-soft text-warning',
  missed: 'bg-danger-soft text-danger',
  published: 'bg-chrome text-muted',
}

export function personId(emp) {
  return emp?.docId || emp?.uid || emp?.id || emp?.employeeId || ''
}

export function personName(emp) {
  return emp?.name || emp?.displayName || emp?.fullName || emp?.email || 'Employee'
}

export function clientCodeFromName(name) {
  const code = String(name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  return code.length >= 2 ? code : ''
}

export function projectOptionLabel(item) {
  const client = String(item?.clientName || '').trim()
  const name = String(item?.name || item?.projectName || '').trim()
  if (client && name && client.toLowerCase() !== name.toLowerCase()) return `${client} — ${name}`
  return client || name || 'Project'
}

export function clientProjectOptions(projects) {
  const seen = new Set()
  return (projects || [])
    .filter((item) => {
      if (item?.deletedAt) return false
      const id = item?.projectId || item?.id
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    .sort((a, b) => projectOptionLabel(a).localeCompare(projectOptionLabel(b)))
}

export function quotaSummary(reels, quotas) {
  const month = monthKey()
  const label = monthName()
  const counts = new Map()
  reels.forEach((reel) => {
    if (monthKey(reel.golive_at) !== month) return
    const current = counts.get(reel.project_id) || {
      planned: 0,
      name: reel.client_name || reel.project_name || 'Client',
    }
    current.planned += 1
    counts.set(reel.project_id, current)
  })
  const first = [...counts.entries()][0]
  if (!first) return { text: `${label}: no reels planned`, strong: '' }
  const [projectId, info] = first
  const quota = quotas.find((row) => row.project_id === projectId && row.month === month)
  if (!quota) {
    return { name: info.name, month: label, planned: info.planned, contracted: null, left: 0 }
  }
  return {
    name: info.name,
    month: label,
    planned: info.planned,
    contracted: quota.reels_contracted,
    left: Math.max(0, quota.reels_contracted - info.planned),
  }
}

const REEL_LINKS = [
  { to: '/reels', end: true, label: 'Board' },
  { to: '/reels/calendar', label: 'Calendar' },
  { to: '/reels/list', label: 'List' },
  { to: '/reels/quota', label: 'Quota' },
  { to: '/reels/leadership', label: 'Leadership' },
  { to: '/reels/guide', label: 'Guide' },
]

function ReelLinkRow() {
  const tab = ({ isActive }) =>
    `rounded-lg px-3 py-1.5 text-sm ${
      isActive ? 'cursor-pointer bg-accent text-white' : 'cursor-pointer border border-border text-fg hover:bg-chrome'
    }`
  return (
    <div className="flex flex-wrap gap-2">
      {REEL_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={tab}>
          {link.label}
        </NavLink>
      ))}
    </div>
  )
}

function ReelTabs() {
  return <ReelLinkRow />
}

export function ReelNav() {
  return (
    <div className="mb-4">
      <ReelLinkRow />
    </div>
  )
}

export function ReelShell({ summary, onPlan, children }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const line = summary || {}

  return (
    <div className="-m-6 min-h-[calc(100vh-4.5rem)] bg-canvas text-fg">
      <div className="bg-chrome px-4 py-2 text-xs text-muted">
        <span>Demo clock {formatClockLabel(now)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <ReelTabs />
        <p className="text-sm text-fg">
          {line.name ? (
            <>
              {line.name} · {line.month}:{' '}
              <span className="font-semibold">
                {line.contracted == null ? line.planned : `${line.planned} of ${line.contracted}`}
              </span>
              {line.contracted == null ? ' reels planned' : ' reels planned'}
              {line.left > 0 ? ` · ${line.left} still ${line.left === 1 ? 'needs' : 'need'} a date` : ''}
            </>
          ) : (
            line.text || 'No reels planned this month'
          )}
        </p>
        <Button type="button" icon={Plus} size="sm" className="ml-auto" onClick={onPlan}>
          Plan reel
        </Button>
      </div>
      <div className="px-4 pb-6">{children}</div>
    </div>
  )
}

export function RiskPill({ risk, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${RISK_PILL[risk] || RISK_PILL.on_track}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
