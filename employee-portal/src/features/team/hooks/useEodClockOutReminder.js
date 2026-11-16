import { useEffect, useRef } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'
import { useUserStore } from '../../../stores/userStore'
import {
  DEFAULT_WORKING_HOURS,
  clockMinutes,
  formatMinutes12,
  getWorkingHours,
  subscribeWorkingHours,
} from '../../../../../shared/workingHours.js'

const TICK_MS = 15000
const INFLIGHT_MS = 30000
const TITLE = 'End of day'
const DEFAULT_END_MINUTES = clockMinutes(DEFAULT_WORKING_HOURS.workEnd)

export function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isEodReminderDue(date, endMinutes = DEFAULT_END_MINUTES) {
  const end = Number.isFinite(Number(endMinutes)) ? Number(endMinutes) : DEFAULT_END_MINUTES
  const current = date.getHours() * 60 + date.getMinutes()
  return current >= end
}

function reminderBody(endMinutes) {
  const label = formatMinutes12(Number.isFinite(Number(endMinutes)) ? Number(endMinutes) : DEFAULT_END_MINUTES)
  return `It's ${label}. Report your EOD update and clock out.`
}

const storageKey = (uid, dateKey) => `eod-clockout-reminder:${uid}:${dateKey}`

const readMarker = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeMarker = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing can block storage; the inbox document still dedupes.
  }
}

const clearMarker = (key) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export const useEodClockOutReminder = () => {
  const uid = useUserStore((s) => s.user?.uid)
  const inflightRef = useRef(false)
  const endMinutesRef = useRef(DEFAULT_END_MINUTES)

  useEffect(() => {
    if (!uid) return undefined
    let cancelled = false
    let timer

    const applyHours = (hours) => {
      const end = clockMinutes(hours?.workEnd)
      endMinutesRef.current = end == null ? DEFAULT_END_MINUTES : end
    }

    const unsubscribe = subscribeWorkingHours(applyHours)

    const check = async () => {
      if (inflightRef.current || cancelled) return
      const now = new Date()
      const endMinutes = endMinutesRef.current
      if (!isEodReminderDue(now, endMinutes)) return

      const dateKey = localDateKey(now)
      const key = storageKey(uid, dateKey)
      const marker = readMarker(key)
      if (marker === 'done') return
      if (marker && Date.now() - Number(marker) < INFLIGHT_MS) return

      inflightRef.current = true
      writeMarker(key, String(Date.now()))
      const ref = doc(db, 'notifications', uid, 'items', `eod-clockout-${dateKey}`)
      const message = reminderBody(endMinutes)
      try {
        const snap = await getDoc(ref)
        if (snap.exists()) {
          writeMarker(key, 'done')
          return
        }
        await setDoc(ref, {
          title: TITLE,
          message,
          type: 'eod',
          isRead: false,
          link: '/dashboard',
          createdAt: now.toISOString(),
          serverCreatedAt: serverTimestamp(),
        })
        void showForegroundBrowserNotification({
          notification: { title: TITLE, body: message },
          data: {
            type: 'eod',
            link: '/dashboard',
            tag: `eod-clockout-${dateKey}`,
          },
        })
        writeMarker(key, 'done')
      } catch (err) {
        clearMarker(key)
        console.error('EOD clock-out reminder failed', err)
      } finally {
        inflightRef.current = false
      }
    }

    const boot = async () => {
      try {
        applyHours(await getWorkingHours())
      } catch {
        // The subscription still applies the saved hours when they arrive.
      }
      if (cancelled) return
      void check()
      timer = setInterval(() => {
        void check()
      }, TICK_MS)
    }

    void boot()
    return () => {
      cancelled = true
      unsubscribe()
      if (timer) clearInterval(timer)
    }
  }, [uid])
}
