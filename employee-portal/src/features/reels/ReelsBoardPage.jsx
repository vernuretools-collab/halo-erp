import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  REEL_STATUSES,
  REEL_STATUS_LABEL,
  REEL_WORK_STAGES,
  RISK_LABEL,
  computeRisk,
  formatDayLabel,
} from '../../../../shared/reels/deadlines.js'
import { moveReelStage } from '../../../../shared/reels/reelService.js'
import { PlanReelDialog } from './PlanReelDialog'
import { ReelShell, RiskPill, STATUS_DOT, quotaSummary } from './reelsUi'
import { useReelDirectory } from './useReelDirectory'

const workStage = (status) => REEL_WORK_STAGES.includes(status)

export function ReelsBoardPage() {
  const navigate = useNavigate()
  const { reels, quotas, projects, employees, loading, error, reload } = useReelDirectory()
  const [open, setOpen] = useState(false)
  const [dragId, setDragId] = useState('')
  const [over, setOver] = useState('')
  const [moveError, setMoveError] = useState('')
  const summary = quotaSummary(reels, quotas)

  const move = async (reelId, status) => {
    const reel = reels.find((row) => row.id === reelId)
    if (!reel || reel.status === status || !workStage(reel.status) || !workStage(status)) return
    setMoveError('')
    try {
      await moveReelStage(reelId, status)
      await reload()
    } catch (err) {
      setMoveError(err.message || 'Could not move this reel.')
    }
  }

  return (
    <>
      <ReelShell summary={summary} onPlan={() => setOpen(true)}>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {moveError && <p className="mb-3 text-sm text-danger">{moveError}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading reels…</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {REEL_STATUSES.map((status) => {
              const cards = reels.filter((reel) => reel.status === status)
              const droppable = workStage(status)
              return (
                <section
                  key={status}
                  className={`w-60 shrink-0 rounded-xl p-1 ${over === status ? 'bg-chrome' : ''}`}
                  onDragOver={(event) => {
                    if (!droppable || !dragId) return
                    event.preventDefault()
                    if (over !== status) setOver(status)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const reelId = event.dataTransfer.getData('text/plain')
                    setOver('')
                    setDragId('')
                    if (reelId) move(reelId, status)
                  }}
                >
                  <header className="mb-2 flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[status] }} />
                    <span className="font-medium">{REEL_STATUS_LABEL[status]}</span>
                    <span className="ml-auto rounded-md bg-chrome px-1.5 text-xs text-muted">{cards.length}</span>
                  </header>
                  <div className="space-y-2">
                    {cards.length === 0 && (
                      <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                        {droppable ? 'Drop a reel here' : 'Nothing here'}
                      </div>
                    )}
                    {cards.map((reel) => {
                      const risk = computeRisk(reel)
                      const movable = workStage(reel.status)
                      return (
                        <article
                          key={reel.id}
                          draggable={movable}
                          onDragStart={(event) => {
                            if (!movable) return
                            event.dataTransfer.setData('text/plain', reel.id)
                            event.dataTransfer.effectAllowed = 'move'
                            setDragId(reel.id)
                          }}
                          onDragEnd={() => {
                            setDragId('')
                            setOver('')
                          }}
                          className={`rounded-xl border border-border bg-surface p-3 ${movable ? 'cursor-grab' : ''} ${dragId === reel.id ? 'opacity-60' : ''}`}
                        >
                          <Link draggable={false} to={`/reels/${reel.id}`} className="block hover:text-accent">
                            <p className="text-[11px] tracking-wide text-muted">{reel.id}</p>
                            <p className="mt-1 text-sm font-semibold leading-snug text-fg">{reel.title}</p>
                          </Link>
                          <p className="mt-2 text-xs text-fg">{reel.client_name || reel.project_name}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                            <span>Live {formatDayLabel(reel.golive_at)}</span>
                            <span className="truncate">{reel.editor_name}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1">
                            <RiskPill risk={risk} label={RISK_LABEL[risk]} />
                            {reel.rush && (
                              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] text-danger">Rush</span>
                            )}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        )}
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
