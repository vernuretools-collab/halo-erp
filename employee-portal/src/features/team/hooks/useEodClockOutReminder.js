import { useEffect, useRef } from 'react'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'
import { useUserStore } from '../../../stores/userStore'

const TICK_MS = 15000
const REMINDER_HOUR = 18
const INFLIGHT_MS = 30000
const TITLE = 'End of day'
const BODY = "It's 6:00 PM. Report your EOD update and clock out."

export function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isEodReminderDue(date) {
  return date.getHours() >= REMINDER_HOUR
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

  useEffect(() => {
    if (!uid) return undefined

    const check = async () => {
      if (inflightRef.current) return
      const now = new Date()
      if (!isEodReminderDue(now)) return

      const dateKey = localDateKey(now)
      const key = storageKey(uid, dateKey)
      const marker = readMarker(key)
      if (marker === 'done') return
      if (marker && Date.now() - Number(marker) < INFLIGHT_MS) return

      inflightRef.current = true
      writeMarker(key, String(Date.now()))
      const ref = doc(db, 'notifications', uid, 'items', `eod-clockout-${dateKey}`)
      try {
        const snap = await getDoc(ref)
        if (snap.exists()) {
          writeMarker(key, 'done')
          return
        }
        await setDoc(ref, {
          title: TITLE,
          message: BODY,
          type: 'eod',
          isRead: false,
          link: '/dashboard',
          createdAt: now.toISOString(),
          serverCreatedAt: serverTimestamp(),
        })
        void showForegroundBrowserNotification({
          notification: { title: TITLE, body: BODY },
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

    void check()
    const timer = setInterval(() => {
      void check()
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [uid])
}
