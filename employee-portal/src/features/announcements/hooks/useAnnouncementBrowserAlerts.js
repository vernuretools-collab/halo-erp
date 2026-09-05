import { useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import {
  armBrowserNotifications,
  closeAnnouncementNotification,
  showForegroundAnnouncementNotification,
} from '../../../shared/services/fcmService'
import { subscribeAnnouncementCreates } from '../services/announcementsService'

const asIdList = (userIdOrIds) =>
  [...new Set((Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds]).filter(Boolean).map(String))]

export const useAnnouncementBrowserAlerts = (userIdOrIds) => {
  const ids = asIdList(userIdOrIds)

  useEffect(() => {
    if (!ids.length) return undefined

    const unlock = () => {
      void armBrowserNotifications()
    }

    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    void armBrowserNotifications()

    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [ids.join('|')])

  useEffect(() => {
    if (!ids.length) return undefined

    return subscribeAnnouncementCreates(
      (announcement) => {
        const preview = announcement.body?.length > 120
          ? `${announcement.body.slice(0, 120)}...`
          : (announcement.body || '')
        void showForegroundAnnouncementNotification({
          notification: {
            title: `📢 ${announcement.title || 'New Announcement'}`,
            body: preview,
          },
          data: {
            type: 'announcement',
            announcementId: announcement.id || '',
            link: '/announcements',
            tag: `announcement-${announcement.id || ''}`,
          },
        })
      },
      (announcementId) => {
        closeAnnouncementNotification(announcementId)
      }
    )
  }, [ids.join('|')])

  useEffect(() => {
    if (!ids.length) return undefined

    const unsubs = ids.map((uid) => {
      let primed = false
      return onSnapshot(collection(db, 'notifications', uid, 'items'), (snapshot) => {
        if (!primed) {
          primed = true
          return
        }
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return
          const data = change.doc.data() || {}
          if (data.type !== 'announcement') return
          const announcementId = data.announcementId || ''
          void showForegroundAnnouncementNotification({
            notification: {
              title: data.title || 'New Announcement',
              body: data.message || '',
            },
            data: {
              type: 'announcement',
              announcementId,
              link: data.link || '/announcements',
              tag: announcementId ? `announcement-${announcementId}` : `announcement-${change.doc.id}`,
            },
          })
        })
      })
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [ids.join('|')])
}
