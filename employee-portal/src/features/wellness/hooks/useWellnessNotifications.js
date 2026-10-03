import { useEffect, useRef } from 'react'
import { useWellnessStore, WELLNESS_REMINDERS } from '../stores/wellnessStore'
import { useNotificationStore } from '../../notifications/stores/notificationStore'
import { useTeamStore } from '../../team/stores/teamStore'
import { showForegroundBrowserNotification, armBrowserNotifications } from '../../../shared/services/fcmService'

/**
 * Custom hook that manages the wellness notification engine.
 * Runs interval timers for each enabled reminder, checks work hours and snooze state,
 * and sends native browser notifications (or falls back to in-app notifications).
 * Reminders stay quiet until the employee is clocked in, then wait one full interval
 * from that clock-in so overdue reminders do not all fire at once.
 *
 * Mount this in AppShell so it runs app-wide while the user is authenticated.
 */
export const useWellnessNotifications = () => {
  const timerRef = useRef(null)

  // Keep permission state in sync; the actual prompt runs on a user click (AppShell / Wellness).
  useEffect(() => {
    if (!('Notification' in window)) {
      useWellnessStore.getState().setNotificationPermission('denied')
      return
    }
    useWellnessStore.getState().setNotificationPermission(Notification.permission)
  }, [])

  // Core ticker engine — checks real timestamps against intervals every 5 seconds
  useEffect(() => {
    const sendNotification = (reminder) => {
      void showForegroundBrowserNotification({
        notification: {
          title: reminder.name,
          body: reminder.message,
        },
        data: {
          type: 'wellness',
          link: '/wellness',
          tag: `wellness-${reminder.id}`,
        },
      })

      useNotificationStore.getState().addNotification({
        title: reminder.name,
        message: reminder.message,
        type: 'wellness',
        link: '/wellness',
      })
    }

    const checkReminders = () => {
      const state = useWellnessStore.getState()

      // Guard: work hours, snooze, global toggle, and an open clock-in
      if (!state.globalEnabled) return
      if (!state.isWithinWorkHours()) return
      if (state.isSnoozed()) return

      const attendance = useTeamStore.getState()
      if (!attendance.clockedIn) return

      const shiftStart = Number(attendance.clockInTimestamp)
      // Wait until this shift's clock-in time is known so we don't stamp lastFired on every tick.
      if (!Number.isFinite(shiftStart) || shiftStart <= 0) return

      const now = Date.now()

      WELLNESS_REMINDERS.forEach((reminder) => {
        const settings = state.reminderSettings[reminder.id]
        if (!settings?.enabled) return

        const intervalMs = Math.max((settings.interval || reminder.defaultInterval) * 60 * 1000, 1000)
        const lastFiredIso = state.lastFiredAt[reminder.id]
        const lastFiredTime = lastFiredIso ? new Date(lastFiredIso).getTime() : NaN

        // First run, or last fire belongs to a previous shift: start the interval now.
        if (!Number.isFinite(lastFiredTime) || lastFiredTime < shiftStart) {
          state.setLastFired(reminder.id)
          return
        }

        if (now - lastFiredTime >= intervalMs) {
          // Record new fired timestamp BEFORE sending to prevent double firing
          state.setLastFired(reminder.id)
          sendNotification(reminder)
        }
      })
    }

    // Run check immediately on mount
    checkReminders()

    // Ticker loop every 5 seconds
    timerRef.current = setInterval(checkReminders, 5000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, []) // no deps — everything reads from store directly, no stale closures

  return { requestPermission: () => armBrowserNotifications() }
}

