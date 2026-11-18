import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { kolkataParts, monthName } from '../../../../shared/reels/deadlines.js'
import { PlanReelDialog } from './PlanReelDialog'
import { ReelShell, quotaSummary } from './reelsUi'
import { useReelDirectory } from './useReelDirectory'

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthMatrix(year, month) {
  const first = new Date(Date.UTC(year, month, 1))
  const startOffset = (first.getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const cells = Array.from({ length: startOffset }, () => null)
  for (let day = 1; day <= days; day += 1) cells.push(day)
  while (cells.length % 7) cells.push(null)
  return cells
}

export function ReelsCalendarPage() {
  const navigate = useNavigate()
  const now = kolkataParts(new Date())
  const [cursor, setCursor] = useState({ y: now.y, m: now.m })
  const [open, setOpen] = useState(false)
  const { reels, quotas, projects, employees, error, reload } = useReelDirectory()

  const cells = useMemo(() => monthMatrix(cursor.y, cursor.m), [cursor])
  const label = `${monthName(new Date(Date.UTC(cursor.y, cursor.m, 15)))} ${cursor.y}`

  const onDay = (day) => {
    if (!day) return []
    return reels.flatMap((reel) => {
      const marks = []
      const add = (value, kind) => {
        const parts = kolkataParts(value)
        if (parts.y === cursor.y && parts.m === cursor.m && parts.d === day) marks.push({ reel, kind })
      }
      add(reel.golive_at, 'Go-live')
      add(reel.t7, 'T-7')
      add(reel.t5, 'T-5')
      add(reel.t4, 'T-4')
      add(reel.t3, 'T-3')
      return marks
    })
  }

  return (
    <>
      <ReelShell summary={quotaSummary(reels, quotas)} onPlan={() => setOpen(true)}>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{label}</h2>
          <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs" onClick={() => setCursor((c) => ({ y: c.m === 0 ? c.y - 1 : c.y, m: c.m === 0 ? 11 : c.m - 1 }))}>Previous</button>
          <button type="button" className="rounded-lg border border-border px-2 py-1 text-xs" onClick={() => setCursor((c) => ({ y: c.m === 11 ? c.y + 1 : c.y, m: c.m === 11 ? 0 : c.m + 1 }))}>Next</button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-xs">
          {WEEK.map((day) => (
            <div key={day} className="px-1 font-semibold text-muted">{day}</div>
          ))}
          {cells.map((day, index) => (
            <div key={index} className="min-h-24 rounded-xl border border-border bg-surface p-1">
              <div className="text-muted">{day || ''}</div>
              <div className="space-y-1">
                {onDay(day).map((mark, markIndex) => (
                  <Link key={`${mark.reel.id}-${mark.kind}-${markIndex}`} to={`/reels/${mark.reel.id}`} className="block truncate rounded bg-chrome px-1 py-0.5 text-[10px] text-fg">
                    {mark.kind} {mark.reel.id}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ReelShell>
      <PlanReelDialog
        open={open}
        onClose={() => setOpen(false)}
        projects={projects}
        employees={employees}
        reels={reels}
        quotas={quotas}
        onPlanned={async (id) => {
          await reload()
          if (id) navigate(`/reels/${id}`)
        }}
      />
    </>
  )
}
