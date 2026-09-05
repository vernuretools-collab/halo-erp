import {
  armBrowserNotifications,
  ensureNotificationPermission,
  playAnnouncementChime,
  showForegroundAnnouncementNotification,
  showForegroundBrowserNotification,
} from '../../../../shared/supabase/browserNotifications.js'

export {
  armBrowserNotifications,
  ensureNotificationPermission,
  playAnnouncementChime,
  showForegroundAnnouncementNotification,
  showForegroundBrowserNotification,
}

export const alertLocalAnnouncement = async ({ title, body, announcementId, link = '/announcements' }) => {
  await armBrowserNotifications()
  return showForegroundAnnouncementNotification({
    notification: { title: `📢 ${title || 'New Announcement'}`, body: body || '' },
    data: { type: 'announcement', announcementId: announcementId || '', link },
  })
}
