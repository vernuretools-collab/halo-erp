import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { REEL_STATUS_LABEL, RISK_LABEL, computeRisk, formatDayLabel } from '../../../../shared/reels/deadlines.js'
import { PlanReelDialog } from './PlanReelDialog'
import { ReelShell, RiskPill, quotaSummary } from './reelsUi'
import { useReelDirectory } from './useReelDirectory'

export function ReelsListPage() {
  const navigate = useNavigate()
  const { reels, quotas, projects, employees, loading, error, reload } = useReelDirectory()
  const [open, setOpen] = useState(false)

  return (
    <>
      <ReelShell summary={quotaSummary(reels, quotas)} onPlan={() => setOpen(true)}>
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="text-sm text-muted">Loading reels…</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-chrome text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Reel</th>
                  <th className="px-3 py-2 font-medium">Client</th>
                  <th className="px-3 py-2 font-medium">Live</th>
                  <th className="px-3 py-2 font-medium">Editor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {reels.map((reel) => {
                  const risk = computeRisk(reel)
                  return (
                    <tr key={reel.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <Link to={`/reels/${reel.id}`} className="font-medium text-fg">{reel.id}</Link>
                        <p className="text-xs text-muted">{reel.title}</p>
                      </td>
                      <td className="px-3 py-2 text-fg">{reel.client_name || reel.project_name}</td>
                      <td className="px-3 py-2 text-fg">{formatDayLabel(reel.golive_at)}</td>
                      <td className="px-3 py-2 text-fg">{reel.editor_name}</td>
                      <td className="px-3 py-2 text-fg">{REEL_STATUS_LABEL[reel.status]}</td>
                      <td className="px-3 py-2"><RiskPill risk={risk} label={RISK_LABEL[risk]} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="border-t border-border px-3 py-2 text-xs text-muted">
              <Link to="/reels/quota" className="text-accent">Quota</Link>
              <span> · </span>
              <Link to="/reels/leadership" className="text-accent">Leadership</Link>
            </p>
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
