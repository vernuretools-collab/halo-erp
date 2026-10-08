import { useEffect, useRef } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'
import { collectUserIdentityIds } from '../../projects/services/projectService'
import { useUserStore } from '../../../stores/userStore'
import {
  localDateKey,
  resolveSocialPostPing,
  socialPostPingCopy,
  subscribeMySocialPostReminders,
  updateSocialPostReminder,
} from '../services/socialPostRemindersService'

const TICK_MS = 15000

export const useSocialPostReminders = () => {
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)
  const remindersRef = useRef([])
  const identityRef = useRef([])
  const inflightRef = useRef(new Set())

  const identityIds = collectUserIdentityIds(user, userDoc)
  const identityKey = identityIds.join('|')
  identityRef.current = identityIds

  useEffect(() => {
    const ids = identityRef.current
    if (!ids.length) {
      remindersRef.current = []
      return undefined
    }
    return subscribeMySocialPostReminders(
      ids,
      (rows) => {
        remindersRef.current = rows
      },
      () => {
        remindersRef.current = []
      }
    )
  }, [identityKey])

  useEffect(() => {
    const fire = async (reminder, decision, todayKey) => {
      const currentUid = useUserStore.getState().user?.uid
      if (!currentUid) return
      const kind = decision.kind
      const lockKey = `${reminder.id}:${kind}:${decision.updates.lastEarlyAt || decision.updates.lastDueAt || todayKey}`
      if (inflightRef.current.has(lockKey)) return
      inflightRef.current.add(lockKey)

      Object.assign(reminder, decision.updates)
      try {
        await updateSocialPostReminder(reminder.id, decision.updates)
        const { title, message } = socialPostPingCopy(reminder, kind)
        const occurrenceKey = decision.updates.lastEarlyAt || decision.updates.lastDueAt || todayKey
        void showForegroundBrowserNotification({
          notification: { title, body: message },
          data: {
            type: 'social_post',
            link: '/post-reminders',
            tag: `social-post-${reminder.id}-${kind}-${occurrenceKey}`,
          },
        })
        await addDoc(collection(db, 'notifications', currentUid, 'items'), {
          title,
          message,
          type: 'social_post',
          isRead: false,
          link: '/post-reminders',
          createdAt: new Date().toISOString(),
          serverCreatedAt: serverTimestamp(),
        })
      } catch (err) {
        inflightRef.current.delete(lockKey)
        console.error('Social post reminder failed', err)
      }
    }

    const check = () => {
      const now = new Date()
      const todayKey = localDateKey(now)
      remindersRef.current.forEach((reminder) => {
        const decision = resolveSocialPostPing(reminder, now, identityRef.current)
        if (!decision) return
        void fire(reminder, decision, todayKey)
      })
    }

    check()
    const timer = setInterval(check, TICK_MS)
    return () => clearInterval(timer)
  }, [])
}
