import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { RISK_LABEL, computeRisk, formatWhen, monthKey } from '../../../../shared/reels/deadlines.js'
import { listReels, listReminderLog, onTimeScores } from '../../../../shared/reels/reelService.js'
import { FIELD, ReelNav } from './reelsUi'

function percent(part, total) {
  if (!total) return '—'
  return `${Math.round((part / total) * 100)}%`
}

export function ReelLeadershipPage() {
  const [month, setMonth] = useState(monthKey())
  const [reels, setReels] = useState([])
  const [scores, setScores] = useState([])
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([listReels(), onTimeScores(month), listReminderLog()])
      .then(([reelRows, scoreRows, logRows]) => {
        if (cancelled) return
        setReels(reelRows)
        setScores(scoreRows)
        setLog(logRows)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load leadership tracking.')
      })
    return () => {
      cancelled = true
    }
  }, [month])

  const putoffs = log.filter((row) => row.answer === 'no')

  return (
    <div>
      <PageHeader
        title="Leadership"
        description="Risk, escalations, on-time score, and every Yes or No on a reminder. An SMM sees their own reels."
      />
      <ReelNav />
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      <label className="mb-4 block max-w-xs text-sm">
        <span className="mb-1 block text-muted">Month</span>
        <input className={FIELD} value={month} onChange={(e) => setMonth(e.target.value)} />
      </label>

      <h2 className="mb-2 text-sm font-semibold text-fg">On-time score</h2>
      <div className="mb-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2">Who</th>
              <th>Scheduled by T-3</th>
              <th>Live within 60 min</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((row) => (
              <tr key={`${row.scope}-${row.scope_id}`} className="border-t border-border">
                <td className="py-2">{row.scope === 'client' ? 'Client' : 'SMM'} {row.scope_id}</td>
                <td>{percent(row.scheduled_on_time, row.scheduled_due)} ({row.scheduled_on_time}/{row.scheduled_due})</td>
                <td>{percent(row.live_on_time, row.live_due)} ({row.live_on_time}/{row.live_due})</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-fg">Reels</h2>
      <ul className="mb-6 space-y-2 text-sm">
        {reels.map((reel) => (
          <li key={reel.id} className="rounded-xl border border-border px-3 py-2">
            <Link className="font-medium text-accent" to={`/reels/${reel.id}`}>{reel.id}</Link>
            <span className="ml-2 text-muted">{reel.title}</span>
            <span className="ml-2">{RISK_LABEL[computeRisk(reel)]}</span>
            <span className="ml-2 text-xs text-muted">Go-live {formatWhen(reel.golive_at)}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-semibold text-fg">Put-offs</h2>
      <ul className="mb-6 space-y-2 text-sm">
        {putoffs.length === 0 && <li className="text-muted">No “No” answers yet.</li>}
        {putoffs.map((row) => (
          <li key={row.id}>
            <Link className="text-accent" to={`/reels/${row.reel_id}`}>{row.reel_id}</Link>
            {' '}{row.kind} · No at {formatWhen(row.answered_at)}
          </li>
        ))}
      </ul>

      <h2 className="mb-2 text-sm font-semibold text-fg">Reminder log</h2>
      <ul className="space-y-1 text-xs text-muted">
        {log.map((row) => (
          <li key={row.id}>
            {formatWhen(row.sent_at)} · {row.reel_id} · {row.kind} · {row.answer || 'no answer yet'}
          </li>
        ))}
      </ul>
    </div>
  )
}
