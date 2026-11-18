import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  REEL_STATUSES,
  REEL_STATUS_LABEL,
  RISK_LABEL,
  computeRisk,
  formatDayLabel,
} from '../../../../shared/reels/deadlines.js'
import { PlanReelDialog } from './PlanReelDialog'
import { ReelShell, RiskPill, STATUS_DOT, quotaSummary } from './reelsUi'
import { useReelDirectory } from './useReelDirectory'

export function ReelsBoardPage() {
  const navigate = useNavigate()
  const { reels, quotas, projects, employees, loading, error, reload } = useReelDirectory()
  const [open, setOpen] = useState(false)
  const summary = quotaSummary(reels, quotas)

  return (
    <>
      <ReelShell summary={summary} onPlan={() => setOpen(true)}>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading reels…</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {REEL_STATUSES.map((status) => {
              const cards = reels.filter((reel) => reel.status === status)
              return (
                <section key={status} className="w-60 shrink-0">
                  <header className="mb-2 flex items-center gap-2 text-sm">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[status] }} />
                    <span className="font-medium">{REEL_STATUS_LABEL[status]}</span>
                    <span className="ml-auto rounded-md bg-chrome px-1.5 text-xs text-muted">{cards.length}</span>
                  </header>
                  <div className="space-y-2">
                    {cards.length === 0 && (
                      <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                        Nothing here
                      </div>
                    )}
                    {cards.map((reel) => {
                      const risk = computeRisk(reel)
                      return (
                        <Link
                          key={reel.id}
                          to={`/reels/${reel.id}`}
                          className="block rounded-xl border border-border bg-surface p-3 hover:border-accent"
                        >
                          <p className="text-[11px] tracking-wide text-muted">{reel.id}</p>
                          <p className="mt-1 text-sm font-semibold leading-snug text-fg">{reel.title}</p>
                          <p className="mt-2 text-xs text-fg">{reel.client_name || reel.project_name}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                            <span>Live {formatDayLabel(reel.golive_at)}</span>
                            <span className="truncate">{reel.editor_name}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1">
                            <RiskPill risk={risk} label={RISK_LABEL[risk]} />
                            {reel.rush && (
                              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] text-danger">Rush</span>
                            )}
                          </div>
                        </Link>
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
