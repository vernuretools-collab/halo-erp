import React, { useEffect, useMemo, useState } from 'react'
import { QcStage } from './QcStage.jsx'
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
  in_review: 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300',
  changes_requested: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
  approved: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
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
  const match = projects.find((project) => (project.projectId || project.id) === projectId)
  return match?.name || 'Project'
}

export function QcReviewPage({ mode, projects, actor }) {
  const canReview = mode === 'admin'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(canReview ? 'in_review' : 'all')
  const [selectedId, setSelectedId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [file, setFile] = useState(null)
  const [nextFile, setNextFile] = useState(null)
  const [comment, setComment] = useState('')
  const [drawing, setDrawing] = useState(false)
  const [shapes, setShapes] = useState([])
  const [mark, setMark] = useState({ timeSeconds: 0, timecode: '0:00.00 · F0', frameNumber: 0 })
  const [focusCommentId, setFocusCommentId] = useState('')
  const [seek, setSeek] = useState({ token: 0, time: null })

  const projectOptions = useMemo(
    () =>
      [...projects]
        .filter((project) => !project.deletedAt)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [projects]
  )

  async function refresh(preferId) {
    const next = await listQcItems()
    setItems(next)
    setSelectedId((current) => {
      const wanted = preferId || current
      if (wanted && next.some((item) => item.id === wanted)) return wanted
      return next[0]?.id || ''
    })
    return next
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listQcItems()
      .then((next) => {
        if (cancelled) return
        setItems(next)
        setSelectedId(next[0]?.id || '')
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load QC reviews.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const visible = items.filter((item) => filter === 'all' || item.status === filter)
  const selected = visible.find((item) => item.id === selectedId) || visible[0] || null
  const selectedVersion =
    selected?.versions?.find((version) => version.id === versionId) ||
    selected?.versions?.[selected.versions.length - 1] ||
    null

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
  }, [selectedVersion?.id])

  function commentFields() {
    if (!selectedVersion) return {}
    const image = mediaKind(selectedVersion.file_name, selectedVersion.content_type) === 'image'
    return {
      timeSeconds: image ? 0 : mark.timeSeconds,
      timecode: image ? 'Image' : mark.timecode,
      frameNumber: image ? null : mark.frameNumber,
      shapes,
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

  return (
    <div className="text-left">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-fg">QC</h1>
        <p className="mt-1 text-sm text-muted">
          {canReview
            ? 'Review the latest cut, leave a comment, then approve it or send it back.'
            : 'Upload a cut for review. A new file on the same item becomes the next version.'}
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {!canReview && (
        <form
          className="mb-6 grid gap-3 rounded-2xl border border-border bg-surface p-5 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(async () => {
              const itemId = await createQcItem({ projectId, title, file, actor })
              setTitle('')
              setFile(null)
              event.target.reset()
              await refresh(itemId)
              setFilter('all')
              setSelectedId(itemId)
            })
          }}
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Title</span>
            <input className={FIELD} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Reel v1" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Project</span>
            <select className={FIELD} value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="">Select a project</option>
              {projectOptions.map((project) => (
                <option key={project.projectId || project.id} value={project.projectId || project.id}>
                  {project.name || 'Untitled project'}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-muted">File (MP4, WebM, or image, up to 50 MB)</span>
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
          {filter === 'approved' ? 'No approved files yet.' : 'No reviews in this list.'}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
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
                  <p className="text-sm font-medium text-fg">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">{projectName(projectOptions, item.project_id)}</p>
                  <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status] || ''}`}>
                    {qcStatusLabel(item.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {selected && (
            <section className="rounded-2xl border border-border bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-fg">{selected.title}</h2>
                  <p className="text-sm text-muted">
                    {projectName(projectOptions, selected.project_id)}
                    {selected.uploader_name ? ` · ${selected.uploader_name}` : ''}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[selected.status] || ''}`}>
                  {qcStatusLabel(selected.status)}
                </span>
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
                  />

                  <div>
                    <h3 className="mb-2 text-sm font-medium text-fg">Comments</h3>
                    {selectedVersion.comments?.length ? (
                      <ul className="space-y-2">
                        {selectedVersion.comments.map((note) => (
                          <li key={note.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusCommentId(note.id)
                                setDrawing(false)
                                if (note.time_seconds != null) {
                                  setSeek({ token: Date.now(), time: Number(note.time_seconds) })
                                }
                              }}
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
                      <p className="text-sm text-muted">No comments on this version.</p>
                    )}
                  </div>

                  {canReview && (
                    <form
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
                          await refresh(selected.id)
                        })
                      }}
                    >
                      <textarea
                        className={FIELD}
                        rows={3}
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        placeholder="What should change on this frame?"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded-xl px-4 py-2 text-sm font-medium ${
                            drawing ? 'bg-accent text-white' : 'border border-border text-fg'
                          }`}
                          onClick={() => setDrawing((value) => !value)}
                        >
                          {drawing ? 'Drawing on' : 'Draw on this frame'}
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-fg disabled:opacity-50"
                        >
                          Add comment
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() =>
                            run(async () => {
                              await setQcStatus({ itemId: selected.id, status: 'approved', actor })
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
                          className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                          onClick={() =>
                            run(async () => {
                              if (!comment.trim() && !selectedVersion.comments?.length) {
                                throw new Error('Add a comment so the editor knows what to change.')
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
                              await setQcStatus({ itemId: selected.id, status: 'changes_requested', actor })
                              await refresh(selected.id)
                            })
                          }
                        >
                          Request changes
                        </button>
                      </div>
                    </form>
                  )}

                  {!canReview && (
                    <form
                      className="flex flex-wrap items-center gap-3"
                      onSubmit={(event) => {
                        event.preventDefault()
                        run(async () => {
                          await addQcVersion({ item: selected, file: nextFile, actor })
                          setNextFile(null)
                          event.target.reset()
                          await refresh(selected.id)
                        })
                      }}
                    >
                      <input
                        type="file"
                        accept={QC_ACCEPT}
                        className="text-sm text-fg"
                        onChange={(event) => setNextFile(event.target.files?.[0] || null)}
                      />
                      <button
                        type="submit"
                        disabled={busy || !nextFile}
                        className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        Upload next version
                      </button>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
