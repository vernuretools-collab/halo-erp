import { useEffect, useRef } from 'react'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'
import { useNotificationStore } from '../../notifications/stores/notificationStore'
import { useUserStore } from '../../../stores/userStore'
import {
  isPostedOn,
  isScheduledToday,
  localDateKey,
  parseTimeToMinutes,
  subscribeMySocialPostReminders,
  updateSocialPostReminder,
} from '../services/socialPostRemindersService'

const EARLY_MINUTES = 15
const TICK_MS = 15000

const reminderBody = (reminder, kind) => {
  const company = reminder.company ? ` for ${reminder.company}` : ''
  if (kind === 'early') {
    return `Upload "${reminder.title}"${company} in 15 minutes.`
  }
  return `Time to upload "${reminder.title}"${company}.`
}

export const useSocialPostReminders = () => {
  const uid = useUserStore((s) => s.user?.uid)
  const remindersRef = useRef([])
  const inflightRef = useRef(new Set())

  useEffect(() => {
    if (!uid) {
      remindersRef.current = []
      return undefined
    }
    return subscribeMySocialPostReminders(
      uid,
      (rows) => {
        remindersRef.current = rows
      },
      () => {
        remindersRef.current = []
      }
    )
  }, [uid])

  useEffect(() => {
    const fire = async (reminder, kind, todayKey) => {
      const currentUid = useUserStore.getState().user?.uid
      if (!currentUid) return
      const lockKey = `${reminder.id}:${kind}:${todayKey}`
      if (inflightRef.current.has(lockKey)) return
      inflightRef.current.add(lockKey)

      const field = kind === 'early' ? 'lastEarlyAt' : 'lastDueAt'
      reminder[field] = todayKey
      try {
        await updateSocialPostReminder(currentUid, reminder.id, { [field]: todayKey })
        const title = kind === 'early' ? 'Post in 15 minutes' : 'Time to upload'
        const message = reminderBody(reminder, kind)
        void showForegroundBrowserNotification({
          notification: { title, body: message },
          data: {
            type: 'social_post',
            link: '/post-reminders',
            tag: `social-post-${reminder.id}-${kind}-${todayKey}`,
          },
        })
        useNotificationStore.getState().addNotification({
          title,
          message,
          type: 'social_post',
          link: '/post-reminders',
        })
      } catch (err) {
        inflightRef.current.delete(lockKey)
        console.error('Social post reminder failed', err)
      }
    }

    const check = () => {
      const now = new Date()
      const todayKey = localDateKey(now)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      remindersRef.current.forEach((reminder) => {
        if (reminder.enabled === false) return
        if (!isScheduledToday(reminder, now)) return
        if (isPostedOn(reminder, todayKey)) return

        const due = parseTimeToMinutes(reminder.time)
        if (due == null) return
        const early = due - EARLY_MINUTES

        if (nowMinutes >= due && reminder.lastDueAt !== todayKey) {
          void fire(reminder, 'due', todayKey)
          return
        }
        if (early >= 0 && nowMinutes >= early && nowMinutes < due && reminder.lastEarlyAt !== todayKey) {
          void fire(reminder, 'early', todayKey)
        }
      })
    }

    check()
    const timer = setInterval(check, TICK_MS)
    return () => clearInterval(timer)
  }, [])
}
