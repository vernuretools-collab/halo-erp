import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { useUserStore } from '../../stores/userStore'
import { collectUserIdentityIds } from '../projects/services/projectService'
import { createTimelineEntry } from '../timeline/services/timelineService'
import {
  RISK_LABEL,
  REEL_STATUS_LABEL,
  REEL_WORK_STAGES,
  computeRisk,
  formatWhen,
  fromIstInput,
  isBeforeTodayIst,
  isLeadershipUser,
  monthKey,
  reelDeadlines,
  toIstInput,
} from '../../../../shared/reels/deadlines.js'
import {
  addReelVersion,
  getReel,
  listReelActivity,
  listReelVersions,
  moveReelStage,
  publishReel,
  scheduleReel,
  setReelGolive,
  startReel,
  validateReelReviewFile,
} from '../../../../shared/reels/reelService.js'
import { FIELD, ReelNav } from './reelsUi'
import { employeeCanSeeQc } from '../../../../shared/qc/qcAccess.js'

const same = (id, ids) => ids.map(String).includes(String(id || ''))

export function ReelDetailPage() {
  const { reelId } = useParams()
  const [params] = useSearchParams()
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])
  const leadership = isLeadershipUser(user, userDoc)
  const [reel, setReel] = useState(null)
  const [versions, setVersions] = useState([])
  const [activity, setActivity] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [caption, setCaption] = useState('')
  const [coverSet, setCoverSet] = useState(false)
  const [collabSent, setCollabSent] = useState(false)
  const [postUrl, setPostUrl] = useState('')
  const [golive, setGolive] = useState('')

  const load = async () => {
    const row = await getReel(reelId)
    setReel(row)
    if (row) setGolive(toIstInput(row.golive_at))
    const [versionRows, activityRows] = await Promise.all([listReelVersions(reelId), listReelActivity(reelId)])
    setVersions(versionRows)
    setActivity(activityRows)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message || 'Could not open this reel.'))
  }, [reelId])

  useEffect(() => {
    if (params.get('checklist') === '1') document.getElementById('schedule-checklist')?.scrollIntoView()
    if (params.get('publish') === '1') document.getElementById('post-url')?.focus()
  }, [params, reel])

  if (!reel) {
    return <p className="text-sm text-muted">{error || 'Loading reel…'}</p>
  }

  const isEditor = same(reel.editor_id, identityIds)
  const isSmm = same(reel.smm_id, identityIds)
  const canSchedule = isSmm || leadership
  const risk = computeRisk(reel)
  const deadlines = reelDeadlines(reel.golive_at)
  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await load()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={reel.id}
        description={`${reel.title} · ${REEL_STATUS_LABEL[reel.status] || reel.status} · ${RISK_LABEL[risk]}`}
        actions={<Link to="/reels" className="text-sm text-accent">Back to board</Link>}
      />
      <ReelNav />
      {error && <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="text-fg">{reel.client_name || reel.project_name}</p>
          <p className="mt-2 text-muted">{reel.brief || 'No brief yet.'}</p>
          <p className="mt-3">Editor: {reel.editor_name || reel.editor_id}</p>
          <p>Platforms: {(reel.platforms || []).join(', ') || '—'}</p>
          <p>SMM: {reel.smm_name || reel.smm_id}</p>
          {reel.rush && <p className="mt-2 font-medium text-rose-600">Rush: {reel.rush_reason}</p>}
          <a className="mt-2 block text-accent" href={reel.raw_footage_url} target="_blank" rel="noreferrer">Raw footage</a>
          {reel.full_quality_url && (
            <a className="block text-accent" href={reel.full_quality_url} target="_blank" rel="noreferrer">Approved full-quality link</a>
          )}
          {reel.post_url && <a className="block text-accent" href={reel.post_url} target="_blank" rel="noreferrer">Live post</a>}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <h2 className="font-semibold text-fg">Deadlines</h2>
          <ul className="mt-2 space-y-1 text-muted">
            <li>Go-live {formatWhen(reel.golive_at)}</li>
            <li>T-7 brief {formatWhen(deadlines.t7)} · met when the reel was planned</li>
            <li>T-5 first cut {formatWhen(deadlines.t5)}</li>
            <li>T-4 QC approved {formatWhen(deadlines.t4)}</li>
            <li>T-3 scheduled {formatWhen(deadlines.t3)}</li>
          </ul>
          <p className="mt-2 text-xs text-muted">Month {monthKey(reel.golive_at)}. Sundays are skipped. Deadlines close at 8 PM India time.</p>
          {REEL_WORK_STAGES.includes(reel.status) && (
            <label className="mt-4 block text-xs text-muted">
              Stage
              <select
                aria-label="Reel stage"
                className={`${FIELD} mt-1`}
                value={reel.status}
                disabled={busy}
                onChange={(event) => run(() => moveReelStage(reel.id, event.target.value))}
              >
                {REEL_WORK_STAGES.map((stage) => (
                  <option key={stage} value={stage}>{REEL_STATUS_LABEL[stage]}</option>
                ))}
              </select>
            </label>
          )}
          {canSchedule && reel.status !== 'published' && (
            <form
              className="mt-4 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const next = fromIstInput(golive)
                if (!next) return
                if (isBeforeTodayIst(next)) {
                  setError('Choose today or a later go-live.')
                  return
                }
                run(() => setReelGolive({ reelId: reel.id, golive: next }))
              }}
            >
              <label className="text-xs text-muted">
                Change go-live
                <input className={FIELD} type="datetime-local" min={toIstInput(new Date()).slice(0, 11) + '00:00'} value={golive} onChange={(e) => setGolive(e.target.value)} />
              </label>
              <Button type="submit" disabled={busy} size="sm">Save date</Button>
            </form>
          )}
        </section>
      </div>

      <section className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Versions</h2>
        {versions.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No cut uploaded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {versions.map((version) => (
              <li key={version.id} className="rounded-xl border border-border px-3 py-2">
                v{version.version_no} · {version.decision}
                {version.feedback ? ` · ${version.feedback}` : ''}
                {version.qc_item_id && employeeCanSeeQc(userDoc) && (
                  <Link className="ml-2 text-accent" to="/qc">Open in QC</Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {isEditor && reel.status === 'todo' && (
          <Button
            className="mt-3"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await startReel(reel.id)
                const now = new Date()
                const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now)
                await createTimelineEntry({
                  uid: user?.uid,
                  employeeName: userDoc?.name || userDoc?.displayName || '',
                  date,
                  description: `Started reel ${reel.id}`,
                  hours: 0,
                  entryType: 'work',
                })
              })
            }
          >
            Start
          </Button>
        )}
        {isEditor && (reel.status === 'in_progress' || reel.status === 'changes_requested') && (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              const message = validateReelReviewFile(file)
              if (message) {
                setError(message)
                return
              }
              run(() =>
                addReelVersion({
                  reelId: reel.id,
                  versionNo: versions.length + 1,
                  file,
                })
              )
            }}
          >
            <label className="text-sm">
              <span className="mb-1 block text-muted">Review file (MP4 or WebM, 50 MB or less)</span>
              <input
                type="file"
                accept="video/mp4,video/webm,.mp4,.webm"
                onChange={(e) => {
                  const next = e.target.files?.[0] || null
                  setFile(next)
                  const message = next ? validateReelReviewFile(next) : ''
                  if (message) setError(message)
                }}
              />
            </label>
            <Button type="submit" disabled={busy}>Upload version</Button>
          </form>
        )}
      </section>

      {canSchedule && reel.status === 'ready_to_schedule' && (
        <form
          id="schedule-checklist"
          className="mt-4 rounded-2xl border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => scheduleReel({ reelId: reel.id, caption, coverSet, collabSent }))
          }}
        >
          <h2 className="text-sm font-semibold text-fg">Schedule checklist</h2>
          <p className="mt-1 text-xs text-muted">Confirmed time is the go-live, {formatWhen(reel.golive_at)}.</p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Caption</span>
            <textarea className={FIELD} rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} required />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={coverSet} onChange={(e) => setCoverSet(e.target.checked)} />
            Cover is set
          </label>
          {(reel.collaborators || []).length > 0 && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={collabSent} onChange={(e) => setCollabSent(e.target.checked)} />
              Collab invite sent ({reel.collaborators.join(', ')})
            </label>
          )}
          <Button className="mt-4" type="submit" disabled={busy}>Mark scheduled</Button>
        </form>
      )}

      {canSchedule && reel.status === 'scheduled' && (
        <form
          className="mt-4 rounded-2xl border border-border bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => publishReel({ reelId: reel.id, postUrl }))
          }}
        >
          <h2 className="text-sm font-semibold text-fg">Publish</h2>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Post link</span>
            <input id="post-url" className={FIELD} value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://" />
          </label>
          <Button className="mt-4" type="submit" disabled={busy}>Mark published</Button>
        </form>
      )}

      <section className="mt-4 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Activity</h2>
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {activity.map((row) => (
            <li key={row.id}>
              {formatWhen(row.created_at)} · {row.action}
              {row.from_status ? ` · ${row.from_status} → ${row.to_status}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
