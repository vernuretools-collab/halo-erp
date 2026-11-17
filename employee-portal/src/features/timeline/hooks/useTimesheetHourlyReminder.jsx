import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { CalendarDays } from 'lucide-react'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'
import { useUserStore } from '../../../stores/userStore'
import { useTeamStore } from '../../team/stores/teamStore'

const TICK_MS = 60000
const HOUR_MS = 60 * 60 * 1000
const SOON_MS = 20 * 60 * 1000
const TITLE = 'Please fill your timesheet'
const MESSAGE = 'Have you filled your work timeline for this hour?'
const LINK = '/timeline'

const dueKey = (uid) => `timesheet-reminder-due:${uid}`

const readDue = (uid) => {
  try {
    const value = Number(localStorage.getItem(dueKey(uid)))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

const writeDue = (uid, at) => {
  try {
    localStorage.setItem(dueKey(uid), String(at))
  } catch {
    // The popup still closes. The next visit can ask again.
  }
}

const openTimeline = (navigate) => {
  if (
    window.location.pathname.startsWith('/desktop-timing') &&
    window.desktop?.openEmployeePortal
  ) {
    window.desktop.openEmployeePortal({ path: LINK })
    return
  }
  navigate(LINK)
}

export const TimesheetHourlyReminder = () => {
  const uid = useUserStore((s) => s.user?.uid)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const inflightRef = useRef(false)

  useEffect(() => {
    if (!uid) return undefined
    let cancelled = false
    let timer

    const check = async () => {
      if (cancelled || openRef.current || inflightRef.current) return
      const { clockedIn, isOnBreak, isOnLunch } = useTeamStore.getState()
      if (!clockedIn || isOnBreak || isOnLunch) return

      const dueAt = readDue(uid)
      if (dueAt && Date.now() < dueAt) return

      inflightRef.current = true
      openRef.current = true
      setOpen(true)
      const now = new Date()
      const stamp = now.getTime()
      try {
        await setDoc(doc(db, 'notifications', uid, 'items', `timesheet-reminder-${stamp}`), {
          title: TITLE,
          message: MESSAGE,
          type: 'timesheet',
          isRead: false,
          link: LINK,
          createdAt: now.toISOString(),
          serverCreatedAt: serverTimestamp(),
        })
        void showForegroundBrowserNotification({
          notification: { title: TITLE, body: MESSAGE },
          data: {
            type: 'timesheet',
            link: LINK,
            tag: `timesheet-reminder-${stamp}`,
          },
        })
      } catch (err) {
        console.error('Timesheet reminder failed', err)
      } finally {
        inflightRef.current = false
      }
    }

    void check()
    timer = setInterval(() => {
      void check()
    }, TICK_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [uid])

  const choose = (yes) => {
    if (uid) writeDue(uid, Date.now() + (yes ? HOUR_MS : SOON_MS))
    openRef.current = false
    setOpen(false)
    if (yes) openTimeline(navigate)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => choose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-reminder-title"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-fg shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 id="timesheet-reminder-title" className="text-base font-bold">
              {TITLE}
            </h2>
            <p className="mt-1 text-sm text-muted">{MESSAGE}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => choose(false)}
            className="rounded-xl border border-border bg-chrome px-4 py-2 text-sm font-semibold text-fg hover:bg-border"
          >
            No
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
