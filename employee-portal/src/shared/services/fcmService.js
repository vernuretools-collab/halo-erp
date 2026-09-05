import { db } from './firebaseService'
import { doc, getDoc } from 'firebase/firestore'
import {
  armBrowserNotifications,
  closeAnnouncementNotification,
  ensureNotificationPermission,
  ensureNotificationServiceWorker,
  playAnnouncementChime,
  showForegroundBrowserNotification as showSharedBrowser,
  unlockAnnouncementAudio,
} from '../../../../shared/supabase/browserNotifications.js'

export {
  armBrowserNotifications,
  closeAnnouncementNotification,
  ensureNotificationPermission,
  ensureNotificationServiceWorker,
  playAnnouncementChime,
  unlockAnnouncementAudio,
}

export const requestFcmToken = async () => {
  await armBrowserNotifications()
  return 'browser'
}

export const onForegroundMessage = () => () => {}

export const showForegroundBrowserNotification = async (payload) => {
  const announcementId = payload?.data?.announcementId ? String(payload.data.announcementId) : ''
  if (announcementId && payload?.data?.type !== 'announcement_deleted') {
    try {
      const snap = await getDoc(doc(db, 'announcements', announcementId))
      if (!snap.exists()) {
        closeAnnouncementNotification(announcementId)
        return
      }
    } catch {
      // still show — inbox listener is the source of truth
    }
  }
  return showSharedBrowser(payload)
}

export const showForegroundAnnouncementNotification = (payload) =>
  showForegroundBrowserNotification(payload)
