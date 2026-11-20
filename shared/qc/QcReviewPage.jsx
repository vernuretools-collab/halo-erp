import React, { useEffect, useMemo, useRef, useState } from 'react'
import { QcStage } from './QcStage.jsx'
import { addReelVersion, decideReel, listReels, moveReelStage, startReel, validateReelReviewFile } from '../reels/reelService.js'
import {
  QC_ACCEPT,
  QC_FILTERS,
  addQcComment,
  addQcVersion,
  createQcItem,
  listQcItems,
  mediaKind,
  qcStatusLabel,
  setQcStatus,
  signedMediaUrl,
  validateQcFile,
} from './qcService.js'

const FIELD =
  'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40'

const STATUS_CLASS = {
  planned: 'bg-chrome text-muted',
  in_review: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  changes_requested: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
}

function samePerson(id, identityIds) {
  return (identityIds || []).map(String).includes(String(id || ''))
}

function isAssignedEditor(reel, identityIds, actor) {
  if (!reel) return false
  const ids = [...(identityIds || [])]
  if (actor?.id) ids.push(String(actor.id))
  if (samePerson(reel.editor_id, ids)) return true
  const assigned = String(reel.editor_name || '').trim().toLowerCase()
  const name = String(actor?.name || '').trim().toLowerCase()
  if (!assigned || !name || name === 'editor') return false
  return assigned === name || assigned.includes(name) || name.includes(assigned)
}

function reelNeedsCut(item) {
  const reel = item?.planned
  if (!reel || item.versions?.length) return false
  return ['todo', 'in_progress', 'changes_requested', 'in_review'].includes(reel.status)
}

function reelListStatus(status) {
  if (status === 'in_review') return 'in_review'
  if (status === 'changes_requested') return 'changes_requested'
  if (status === 'ready_to_schedule' || status === 'scheduled' || status === 'published') return 'approved'
  return 'planned'
}

function mergePlannedReels(items, reels) {
  const covered = new Set(items.map((item) => item.reel_id).filter(Boolean))
  const withPlan = items.map((item) => {
    const planned = (reels || []).find((reel) => reel.id === item.reel_id)
    if (!planned) return item
    return { ...item, planned, status: reelListStatus(planned.status) }
  })
  const extras = (reels || [])
    .filter((reel) => !covered.has(reel.id))
    .map((reel) => ({
      id: `planned:${reel.id}`,
      reel_id: reel.id,
      title: reel.title || reel.id,
      project_id: reel.project_id,
      status: reelListStatus(reel.status),
      versions: [],
      planned: reel,
      plannedOnly: true,
    }))
  return [...extras, ...withPlan]
}

function PlannedReelDetails({ reel }) {
  if (!reel) return null
  return (
    <div className="mb-4 rounded-xl border border-border bg-chrome/40 p-4 text-sm">
      <p className="font-medium text-fg">{reel.title || reel.id}</p>
      <p className="mt-1 text-muted">{reel.client_name || reel.project_name || 'No client'}</p>
      <p className="mt-2 whitespace-pre-wrap text-fg">{reel.brief || 'No brief yet.'}</p>
      <p className="mt-2 text-muted">Editor: {reel.editor_name || reel.editor_id || '—'}</p>
      <p className="text-muted">SMM: {reel.smm_name || reel.smm_id || '—'}</p>
      <p className="text-muted">Go-live: {formatWhen(reel.golive_at) || '—'}</p>
      {(reel.platforms || []).length > 0 && (
        <p className="text-muted">Platforms: {reel.platforms.join(', ')}</p>
      )}
      {reel.rush && <p className="mt-2 font-medium text-rose-600">Rush: {reel.rush_reason || 'Yes'}</p>}
      {reel.raw_footage_url && (
        <a className="mt-2 block text-accent" href={reel.raw_footage_url} target="_blank" rel="noreferrer">
          Raw footage
        </a>
      )}
    </div>
  )
}

function formatWhen(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function projectName(projects, projectId) {
  if (!projectId) return ''
  const match = projects.find((project) => (project.projectId || project.id) === projectId)
  return match?.name || ''
}

export function QcReviewPage({ mode, projects, actor, editor = false, reviewer = false, identityIds = [] }) {
  const canReview = mode === 'admin' || reviewer
  const showPlannedReels = true
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(editor && !reviewer ? 'planned' : canReview ? 'in_review' : 'all')
  const [selectedId, setSelectedId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState(null)
  const nextFileInputRef = useRef(null)
  const [comment, setComment] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [shapes, setShapes] = useState([])
  const [mark, setMark] = useState({ timeSeconds: 0, timecode: '0:00.00 · F0', frameNumber: 0 })
  const [focusCommentId, setFocusCommentId] = useState('')
  const [seek, setSeek] = useState({ token: 0, time: null })
  const [compareOptions, setCompareOptions] = useState([])
  const [pinned, setPinned] = useState(null)
  const [plannedReels, setPlannedReels] = useState([])
  const [cutFile, setCutFile] = useState(null)

  const projectOptions = useMemo(
    () =>
      [...projects]
        .filter((project) => !project.deletedAt)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [projects]
  )

  async function refresh(preferId) {
    const [next, reels] = await Promise.all([
      listQcItems(),
      showPlannedReels ? listReels().catch(() => []) : Promise.resolve([]),
    ])
    setItems(next)
    setPlannedReels(reels)
    const merged = mergePlannedReels(next, reels)
    setSelectedId((current) => {
      const wanted = preferId || current
      if (wanted && merged.some((item) => item.id === wanted)) return wanted
      const byReel = preferId && merged.find((item) => item.reel_id === preferId)
      if (byReel) return byReel.id
      return merged[0]?.id || ''
    })
    return next
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    refresh()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load QC reviews.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [showPlannedReels])

  const queue = mergePlannedReels(items, showPlannedReels ? plannedReels : [])
  const visible = queue.filter((item) => filter === 'all' || item.status === filter)
  const selected = visible.find((item) => item.id === selectedId) || visible[0] || null
  const selectedVersion =
    selected?.versions?.find((version) => version.id === versionId) ||
    selected?.versions?.[selected.versions.length - 1] ||
    null
  const isReel = Boolean(selected?.reel_id)
  const showDecision = canReview || (!editor && isReel && selected?.uploader_id !== actor?.id)
  const showNextUpload =
    mode !== 'admin' && (editor || selected?.uploader_id === actor?.id || (!reviewer && !showDecision))
  const showCreate = mode === 'admin'
  const hideApprovedVideo = selected?.planned?.hide_video === true
  const canSendCut =
    mode === 'employee' &&
    reelNeedsCut(selected) &&
    (samePerson(selected?.planned?.editor_id, [...identityIds, actor?.id]) ||
      (editor && isAssignedEditor(selected?.planned, identityIds, actor)))

  useEffect(() => {
    if (!selected) return
    if (!selected.versions?.some((version) => version.id === versionId)) {
      setVersionId(selected.versions?.[selected.versions.length - 1]?.id || '')
    }
  }, [selected, versionId])

  useEffect(() => {
    let cancelled = false
    setMediaUrl('')
    if (!selectedVersion?.storage_path) return undefined
    signedMediaUrl(selectedVersion.storage_path)
      .then((url) => {
        if (!cancelled) setMediaUrl(url)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not open this file.')
      })
    return () => {
      cancelled = true
    }
  }, [selectedVersion?.id, selectedVersion?.storage_path])

  useEffect(() => {
    setDrawing(false)
    setShapes([])
    setFocusCommentId('')
    setSeek({ token: 0, time: null })
    setPinned(null)
  }, [selectedVersion?.id])

  const compareKey = (selected?.versions || [])
    .map((version) => `${version.id}:${version.storage_path || ''}`)
    .join('|')

  useEffect(() => {
    let cancelled = false
    const others = (selected?.versions || []).filter(
      (version) => version.id !== selectedVersion?.id && version.storage_path
    )
    if (!others.length) {
      setCompareOptions([])
      return undefined
    }
    Promise.all(
      others.map(async (version) => ({
        id: version.id,
        label: `v${version.version_number}`,
        url: await signedMediaUrl(version.storage_path),
        kind: mediaKind(version.file_name, version.content_type),
      }))
    )
      .then((list) => {
        if (!cancelled) setCompareOptions(list.filter((option) => option.url))
      })
      .catch(() => {
        if (!cancelled) setCompareOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [compareKey, selectedVersion?.id])

  function commentFields() {
    if (!selectedVersion) return {}
    const image = mediaKind(selectedVersion.file_name, selectedVersion.content_type) === 'image'
    const spot = pinned || mark
    return {
      timeSeconds: image ? 0 : spot.timeSeconds,
      timecode: image ? 'Image' : spot.timecode,
      frameNumber: image ? null : spot.frameNumber,
      shapes,
    }
  }

  function openNote(note) {
    setFocusCommentId(note.id)
    setDrawing(false)
    if (note.time_seconds != null) {
      setSeek({ token: Date.now(), time: Number(note.time_seconds) })
    }
  }

  async function run(action) {
    setError('')
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  function uploadNextVersion(chosen) {
    if (!chosen || !selected) return
    run(async () => {
      if (selected.reel_id) {
        const message = validateReelReviewFile(chosen)
        if (message) throw new Error(message)
        const versionNo =
          (selected.versions?.reduce((max, version) => Math.max(max, version.version_number), 0) || 0) + 1
        await addReelVersion({
          reelId: selected.reel_id,
          versionNo,
          file: chosen,
        })
      } else {
        await addQcVersion({ item: selected, file: chosen, actor })
      }
      await refresh(selected.id)
    })
  }

  return (
    <div className="text-left">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-fg">QC</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'admin'
            ? 'Review the latest cut, mark a time, leave a note, then approve it or send it back.'
            : reviewer && editor
              ? 'Reviewers mark a time and attach a note. Editors jump to that mark, make the change, and submit the next version.'
              : reviewer
                ? 'Play the cut, mark the time, and attach a note for the editor.'
                : 'Open a planned reel, read the brief, upload the cut, and send it back for review.'}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {showCreate && (
        <form
          className="mb-6 grid gap-3 rounded-2xl border border-border bg-surface p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              const itemId = await createQcItem({ title, file, actor })
              setTitle('')
              setFile(null)
              event.target.reset()
              await refresh(itemId)
              setFilter('all')
              setSelectedId(itemId)
            })
          }}
        >
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-muted">Title</span>
            <input className={FIELD} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="" />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-muted">File (MP4, WebM, or image)</span>
            <input
              className="block w-full text-sm text-fg"
              type="file"
              accept={QC_ACCEPT}
              onChange={(event) => {
                const next = event.target.files?.[0] || null
                setFile(next)
                const message = next ? validateQcFile(next) : ''
                if (message) setError(message)
              }}
            />
          </label>
          <div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Send for review'}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {QC_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === option.id ? 'bg-accent text-white' : 'bg-chrome text-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading reviews…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
          {filter === 'approved'
            ? 'No approved files yet.'
            : filter === 'planned'
              ? 'No planned items yet.'
              : 'No reviews in this list.'}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col gap-4">
            <ul className="space-y-2">
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-2xl border p-3 text-left ${
                      item.id === selected?.id ? 'border-accent bg-surface' : 'border-border bg-surface'
                    }`}
                  >
                    <p className="text-sm font-medium text-fg">{item.reel_id ? `${item.reel_id} · ` : ''}{item.title}</p>
                    {projectName(projectOptions, item.project_id) && (
                      <p className="mt-1 text-xs text-muted">{projectName(projectOptions, item.project_id)}</p>
                    )}
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status] || ''}`}>
                      {qcStatusLabel(item.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {selectedVersion && (
              <div className="min-h-0 flex-1">
                <h3 className="mb-2 text-sm font-medium text-fg">Marks</h3>
                {selectedVersion.comments?.length ? (
                  <ul className="space-y-2">
                    {selectedVersion.comments.map((note) => (
                      <li key={note.id}>
                        <button
                          type="button"
                          onClick={() => openNote(note)}
                          className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                            note.id === focusCommentId ? 'bg-accent/10' : 'bg-chrome'
                          }`}
                        >
                          <p className="text-xs font-medium text-muted">{note.timecode || 'Comment'}</p>
                          <p className="text-fg">{note.body}</p>
                          <p className="mt-1 text-xs text-muted">
                            {note.author_name || 'Team'} · {formatWhen(note.created_at)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No marks on this version.</p>
                )}
              </div>
            )}
          </div>

          {selected && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <PlannedReelDetails reel={selected.planned} />
              {canSendCut ? (
                  <form
                    className="grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const chosen = cutFile
                      run(async () => {
                        const message = validateReelReviewFile(chosen)
                        if (message) throw new Error(message)
                        const reel = selected.planned
                        if (reel.status === 'todo') await startReel(reel.id)
                        else if (reel.status === 'in_review') await moveReelStage(reel.id, 'in_progress')
                        await addReelVersion({
                          reelId: reel.id,
                          versionNo: 1,
                          file: chosen,
                        })
                        setCutFile(null)
                        await refresh(reel.id)
                      })
                    }}
                  >
                    <label className="block text-sm">
                      <span className="mb-1 block text-muted">Review file (MP4 or WebM)</span>
                      <input
                        className="block w-full text-sm text-fg"
                        type="file"
                        accept="video/mp4,video/webm,.mp4,.webm"
                        onChange={(event) => {
                          const next = event.target.files?.[0] || null
                          setCutFile(next)
                          const message = next ? validateReelReviewFile(next) : ''
                          if (message) setError(message)
                        }}
                      />
                    </label>
                    <div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {busy ? 'Sending…' : 'Send for review'}
                      </button>
                    </div>
                  </form>
              ) : selected.plannedOnly && editor ? (
                  <p className="text-sm text-muted">
                    {isAssignedEditor(selected.planned, identityIds, actor)
                      ? 'This cut is already in review.'
                      : `Assigned to ${selected.planned?.editor_name || 'an editor'}.`}
                  </p>
              ) : null}
              {!selected.plannedOnly && (
              <>
              <div className="mb-4 flex flex-wrap items-start justify-end gap-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {showDecision && selectedVersion && (
                    <>
                      <button
                        type="button"
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                          drawing ? 'bg-accent text-white' : 'border border-border text-fg'
                        }`}
                        onClick={() => setDrawing((value) => !value)}
                      >
                        {drawing ? 'Drawing on' : 'Draw on this frame'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() =>
                          run(async () => {
                            if (selected.reel_id) {
                              await decideReel({ reelId: selected.reel_id, decision: 'approved', feedback: '' })
                            } else {
                              await setQcStatus({ itemId: selected.id, status: 'approved', actor })
                            }
                            await refresh(selected.id)
                            setFilter('approved')
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        onClick={() =>
                          run(async () => {
                            const feedback = comment.trim() || selectedVersion.comments?.[selectedVersion.comments.length - 1]?.body || ''
                            if (!feedback && !selectedVersion.comments?.length) {
                              throw new Error('Tell the editor what to change.')
                            }
                            if (comment.trim()) {
                              await addQcComment({
                                versionId: selectedVersion.id,
                                body: comment,
                                actor,
                                ...commentFields(),
                              })
                              setComment('')
                              setShapes([])
                              setDrawing(false)
                            }
                            if (selected.reel_id) {
                              await decideReel({
                                reelId: selected.reel_id,
                                decision: 'changes',
                                feedback: feedback || 'See the frame comments.',
                              })
                            } else {
                              await setQcStatus({ itemId: selected.id, status: 'changes_requested', actor })
                            }
                            await refresh(selected.id)
                          })
                        }
                      >
                        Request changes
                      </button>
                    </>
                  )}
                  {showNextUpload && selectedVersion && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => nextFileInputRef.current?.click()}
                      className="rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Submit next version
                    </button>
                  )}
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {selected.versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setVersionId(version.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      version.id === selectedVersion?.id ? 'bg-accent text-white' : 'bg-chrome text-muted'
                    }`}
                  >
                    v{version.version_number}
                  </button>
                ))}
              </div>

              {selectedVersion && (
                <div className="space-y-4">
                  <p className="text-xs text-muted">
                    {selectedVersion.file_name}
                    {selectedVersion.uploaded_by_name ? ` · ${selectedVersion.uploaded_by_name}` : ''}
                    {selectedVersion.created_at ? ` · ${formatWhen(selectedVersion.created_at)}` : ''}
                  </p>
                  {hideApprovedVideo ? (
                    <p className="text-sm text-muted">Approved</p>
                  ) : (
                  <QcStage
                    url={mediaUrl}
                    kind={mediaKind(selectedVersion.file_name, selectedVersion.content_type)}
                    notes={selectedVersion.comments || []}
                    focusId={focusCommentId}
                    seekToken={seek.token}
                    seekTime={seek.time}
                    drawing={drawing}
                    shapes={shapes}
                    onShapes={setShapes}
                    onTime={setMark}
                    onPickNote={openNote}
                    compareOptions={compareOptions}
                  />
                  )}

                  {focusCommentId && selectedVersion.comments?.some((note) => note.id === focusCommentId) && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Change requested · {selectedVersion.comments.find((note) => note.id === focusCommentId)?.timecode}
                      </p>
                      <p className="mt-1 text-fg">
                        {selectedVersion.comments.find((note) => note.id === focusCommentId)?.body}
                      </p>
                    </div>
                  )}

                  {showDecision && (
                    <form
                      id="qc-mark-form"
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault()
                        run(async () => {
                          await addQcComment({
                            versionId: selectedVersion.id,
                            body: comment,
                            actor,
                            ...commentFields(),
                          })
                          setComment('')
                          setShapes([])
                          setDrawing(false)
                          setPinned(null)
                          await refresh(selected.id)
                        })
                      }}
                    >
                      <p className="text-xs text-muted">
                        {pinned
                          ? `This note is attached to ${pinned.timecode}.`
                          : `This note will attach to ${mark.timecode || 'the current time'}.`}
                      </p>
                      <textarea
                        className={FIELD}
                        rows={3}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="Command or note for this moment"
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        className="rounded-xl border border-border px-3 py-2.5 text-xs font-medium text-fg disabled:opacity-50"
                      >
                        Save mark
                      </button>
                    </form>
                  )}

                  {showNextUpload && (
                    <form
                      id="qc-next-form"
                      className="flex flex-wrap items-center gap-3"
                      onSubmit={(event) => event.preventDefault()}
                    >
                      <input
                        ref={nextFileInputRef}
                        type="file"
                        accept={selected?.reel_id ? 'video/mp4,video/webm,.mp4,.webm' : QC_ACCEPT}
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => {
                          const input = event.currentTarget
                          const chosen = input.files?.[0] || null
                          input.value = ''
                          if (!chosen) return
                          uploadNextVersion(chosen)
                        }}
                      />
                    </form>
                  )}
                </div>
              )}
              </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
