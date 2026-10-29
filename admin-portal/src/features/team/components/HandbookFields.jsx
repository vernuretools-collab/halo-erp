import React, { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Modal } from '../../../components/ui/Modal'
import {
  DEFAULT_LEARNING_PLAN,
  customKraWeight,
  defaultReviews,
  handbookPayload,
  handbookValidationError,
  kraRowStarted,
  learningPoints,
} from '../../../../../shared/supabase/employeeOnboarding.js'
import { Plus, Trash2 } from 'lucide-react'

export const emptyKra = (weight) => ({ keyResultArea: '', kpi: '', weight })

export function pointsToText(points) {
  return Array.isArray(points) ? points.join('\n') : String(points || '')
}

export function handbookDraftFromRecord(record) {
  const custom = Array.isArray(record?.kras?.custom) ? record.kras.custom : []
  const storedPlan = Array.isArray(record?.kras?.learningPlan) ? record.kras.learningPlan : []
  const storedReviews = Array.isArray(record?.kras?.reviews) ? record.kras.reviews : []
  const planSource = storedPlan.length ? storedPlan : DEFAULT_LEARNING_PLAN
  return {
    kras: custom.length
      ? custom.map((row) => ({
        keyResultArea: row.keyResultArea || '',
        kpi: row.kpi || '',
        weight: row.weight ?? '',
      }))
      : [emptyKra(40), emptyKra(20), emptyKra(20)],
    learningPlan: planSource.map((phase) => ({
      id: phase.id,
      label: phase.label || '',
      title: phase.title || '',
      points: pointsToText(phase.points),
    })),
    reviews: storedReviews.length
      ? storedReviews.map((review) => ({ ...review }))
      : defaultReviews(record?.employment || {}),
  }
}

export function HandbookFields({ kras, setKras, learningPlan, setLearningPlan, reviews, setReviews, onReviewTouch, onPersist }) {
  const weight = useMemo(() => customKraWeight(kras), [kras])
  const kraStarted = kras.some(kraRowStarted)
  const [activePhase, setActivePhase] = useState(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftPoints, setDraftPoints] = useState('')
  const [popupError, setPopupError] = useState('')
  const [popupSaving, setPopupSaving] = useState(false)

  const openPhase = (index) => {
    const phase = learningPlan[index]
    if (!phase) return
    setActivePhase(index)
    setDraftTitle(phase.title || '')
    setDraftPoints(pointsToText(phase.points))
    setPopupError('')
  }

  const closePhase = () => {
    if (popupSaving) return
    setActivePhase(null)
    setPopupError('')
  }

  const savePhase = async () => {
    if (activePhase == null) return
    const nextPlan = learningPlan.map((row, index) => (
      index === activePhase ? { ...row, title: draftTitle, points: draftPoints } : row
    ))
    const handbookError = handbookValidationError({ kras, learningPlan: nextPlan, reviews })
    if (handbookError) {
      setPopupError(handbookError)
      return
    }
    setLearningPlan(nextPlan)
    if (!onPersist) {
      setActivePhase(null)
      return
    }
    setPopupSaving(true)
    setPopupError('')
    try {
      await onPersist(handbookPayload({ kras, learningPlan: nextPlan, reviews }))
      setActivePhase(null)
    } catch (err) {
      setPopupError(err.message || 'Could not save this text.')
    } finally {
      setPopupSaving(false)
    }
  }

  const updateKra = (index, key, value) => {
    setKras((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  return (
    <>
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">KRA / KPI</p>
        <p className="text-sm text-muted mb-4">These replace the job-description and handbook KRA text. Leave every row blank to add them after the account is created.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent text-white text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Key Result Area</th>
                <th className="text-left px-3 py-2 font-semibold">KPI / Metric</th>
                <th className="text-left px-3 py-2 font-semibold w-28">Weight</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {kras.map((row, index) => (
                <tr key={index} className="border-t border-border">
                  <td className="p-2">
                    <input
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                      placeholder="e.g. Prospect Generation"
                      value={row.keyResultArea}
                      onChange={(e) => updateKra(index, 'keyResultArea', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                      placeholder="e.g. 10 qualified calls/month"
                      value={row.kpi}
                      onChange={(e) => updateKra(index, 'kpi', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                      value={row.weight}
                      onChange={(e) => updateKra(index, 'weight', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <button
                      type="button"
                      className="text-rose-600 p-1 cursor-pointer disabled:cursor-not-allowed"
                      aria-label="Remove KRA row"
                      onClick={() => setKras((current) => current.filter((_, i) => i !== index))}
                      disabled={kras.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4 gap-3">
          <Button type="button" variant="outline" icon={Plus} onClick={() => setKras((current) => [...current, emptyKra('')])}>
            Add KRA row
          </Button>
          <p className="text-xs text-right text-muted">
            {!kraStarted
              ? 'Blank rows are skipped. Once you fill a row, every row needs an area, a metric, and a weight.'
              : `Weights total ${weight}%.`}
          </p>
        </div>
      </Card>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">30/60/90-day learning plan</p>
        <p className="text-sm text-muted mb-4">Click 30, 60, or 90. A popup opens so you can enter the text and save it. That text replaces the handbook learning-plan lines. Put one task on each line.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {learningPlan.map((phase, index) => {
            const points = learningPoints(phase.points)
            return (
              <button
                key={phase.id || index}
                type="button"
                onClick={() => openPhase(index)}
                className="rounded-xl border border-border p-4 text-left hover:border-accent cursor-pointer"
              >
                <p className="text-sm font-semibold text-fg">{phase.label || `Phase ${index + 1}`}</p>
                <p className="text-xs text-muted mt-1">{phase.title || 'Add a title'}</p>
                <p className="text-xs text-fg mt-3 whitespace-pre-wrap line-clamp-4">{points.length ? points.join('\n') : 'Click to enter the text'}</p>
              </button>
            )
          })}
        </div>
      </Card>

      <Modal
        open={activePhase != null}
        onClose={closePhase}
        title={activePhase != null ? (learningPlan[activePhase]?.label || 'Learning plan') : ''}
        size="lg"
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={closePhase} disabled={popupSaving}>Cancel</Button>
            <Button type="button" variant="primary" onClick={savePhase} disabled={popupSaving}>{popupSaving ? 'Saving…' : 'Save'}</Button>
          </>
        )}
      >
        <div className="space-y-3" onKeyDown={(event) => {
          if (event.key === 'Enter' && event.target.tagName !== 'TEXTAREA') event.preventDefault()
        }}>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-fg">Title</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-fg">Tasks</span>
            <textarea
              className="w-full min-h-40 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm"
              placeholder={'One task per line\nReview the current projects and tech stack'}
              value={draftPoints}
              onChange={(e) => setDraftPoints(e.target.value)}
            />
          </label>
          {popupError && <p className="text-sm text-rose-600">{popupError}</p>}
        </div>
      </Modal>

      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">Review schedule</p>
        <p className="text-sm text-muted mb-4">Leave the focus blank to add it later. Dates follow the joining date until you change them. Saved rows replace the handbook review table.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent text-white text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Review</th>
                <th className="text-left px-3 py-2 font-semibold">Target date</th>
                <th className="text-left px-3 py-2 font-semibold">Reviewer</th>
                <th className="text-left px-3 py-2 font-semibold">Focus</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review, index) => (
                <tr key={review.id || index} className="border-t border-border align-top">
                  <td className="p-2">
                    <input
                      className="w-full min-w-36 rounded-lg border border-border bg-surface px-2 py-1.5"
                      value={review.review}
                      onChange={(e) => setReviews((current) => current.map((row, i) => (i === index ? { ...row, review: e.target.value } : row)))}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="date"
                      className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
                      value={review.date}
                      onChange={(e) => {
                        onReviewTouch?.(`${review.id}:date`)
                        setReviews((current) => current.map((row, i) => (i === index ? { ...row, date: e.target.value } : row)))
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="w-full min-w-40 rounded-lg border border-border bg-surface px-2 py-1.5"
                      value={review.reviewer}
                      onChange={(e) => {
                        onReviewTouch?.(`${review.id}:reviewer`)
                        setReviews((current) => current.map((row, i) => (i === index ? { ...row, reviewer: e.target.value } : row)))
                      }}
                    />
                  </td>
                  <td className="p-2">
                    <textarea
                      className="w-full min-w-52 min-h-16 rounded-lg border border-border bg-surface px-2 py-1.5"
                      placeholder="What this review covers"
                      value={review.focus}
                      onChange={(e) => setReviews((current) => current.map((row, i) => (i === index ? { ...row, focus: e.target.value } : row)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}

export function HandbookEditor({ record, onSave }) {
  const [kras, setKras] = useState(() => handbookDraftFromRecord(record).kras)
  const [learningPlan, setLearningPlan] = useState(() => handbookDraftFromRecord(record).learningPlan)
  const [reviews, setReviews] = useState(() => handbookDraftFromRecord(record).reviews)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const handbookError = handbookValidationError({ kras, learningPlan, reviews })
    if (handbookError) {
      setError(handbookError)
      return
    }
    setSaving(true)
    try {
      await onSave(handbookPayload({ kras, learningPlan, reviews }))
      setNotice('Saved. The packs and the next PDF download use this text.')
    } catch (err) {
      setError(err.message || 'Could not save the handbook.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <HandbookFields
        kras={kras}
        setKras={setKras}
        learningPlan={learningPlan}
        setLearningPlan={setLearningPlan}
        reviews={reviews}
        setReviews={setReviews}
        onPersist={onSave}
      />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {notice && <p className="text-sm text-muted">{notice}</p>}
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save handbook'}</Button>
    </form>
  )
}
