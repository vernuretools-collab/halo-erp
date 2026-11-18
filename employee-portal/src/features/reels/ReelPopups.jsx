import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  armBrowserNotifications,
  playAnnouncementChime,
  showForegroundBrowserNotification,
} from '../../shared/services/fcmService'
import { answerReelNotification, listPendingReelNotifications, subscribeReelNotifications } from '../../../../shared/reels/reelService.js'
import { reelSoundEnabled } from './reelsUi'

const popupKeys = (key) =>
  key === 'schedule_reminder' ||
  key === 'golive_check' ||
  key === 'qc_approved' ||
  String(key || '').startsWith('cut_uploaded') ||
  String(key || '').startsWith('changes_requested')

function buttonPair(row) {
  if (row.key === 'schedule_reminder') return ['Yes', 'No']
  if (row.key === 'golive_check') return ["Yes, it's live", 'No, fix now']
  if (row.key === 'qc_approved') return ['Schedule now', 'Later']
  if (String(row.key).startsWith('cut_uploaded')) return ['Open review', 'Dismiss']
  if (String(row.key).startsWith('changes_requested')) return ['Open task', 'Dismiss']
  return ['Open', 'Dismiss']
}

function openPath(path) {
  if (!path) return
  if (window.location.pathname.startsWith('/desktop-timing') && window.desktop?.openEmployeePortal) {
    window.desktop.openEmployeePortal({ path })
    return
  }
  return path
}

export function ReelPopups({ identityIds }) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const identityKey = (identityIds || []).join('|')

  useEffect(() => {
    void armBrowserNotifications()
  }, [])

  useEffect(() => {
    if (!identityKey) return undefined
    let cancelled = false
    const ids = identityKey.split('|').filter(Boolean)

    const toast = (row) => {
      if (!row || row.answer || !row.needs_answer) return
      if (row.presentation !== 'popup' && row.presentation !== 'desktop_bell') return
      const link = row.reel_id ? `/reels/${row.reel_id}` : '/reels'
      if (typeof window.desktop?.showNotification === 'function') {
        void window.desktop.showNotification({
          title: row.title,
          body: row.body || '',
          link,
          tag: `reel-${row.id}`,
          sound: Boolean(row.sound) && reelSoundEnabled(),
        })
      } else {
        void showForegroundBrowserNotification({
          data: { title: row.title, body: row.body || '', link, tag: `reel-${row.id}`, skipChime: true },
        })
      }
      if (row.sound && row.presentation !== 'popup' && reelSoundEnabled()) playAnnouncementChime()
    }

    const consider = (row) => {
      if (!row || row.answer || !popupKeys(row.key) || !row.needs_answer) return
      setCurrent((open) => {
        if (!open) return row
        return new Date(row.created_at) >= new Date(open.created_at) ? row : open
      })
    }

    listPendingReelNotifications(ids)
      .then((rows) => {
        if (cancelled) return
        rows.filter((row) => popupKeys(row.key)).forEach(consider)
      })
      .catch(() => {})

    const unsubscribe = subscribeReelNotifications(ids, (payload) => {
      const row = payload.new
      if (!row) return
      toast(row)
      consider(row)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [identityKey, refresh])

  useEffect(() => {
    if (current?.sound && reelSoundEnabled()) playAnnouncementChime()
  }, [current?.id, current?.sound])

  if (!current) return null
  const [yesLabel, noLabel] = buttonPair(current)

  const answer = async (value) => {
    setBusy(true)
    try {
      const result = await answerReelNotification(current.id, value)
      const path = openPath(result?.open_path)
      setCurrent(null)
      setRefresh((value) => value + 1)
      if (typeof path === 'string') navigate(path)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Reel</p>
        <h2 className="mt-1 text-lg font-bold text-fg">{current.title}</h2>
        <p className="mt-2 text-sm text-muted">{current.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-fg disabled:opacity-50"
            onClick={() => answer('no')}
          >
            {noLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => answer('yes')}
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
