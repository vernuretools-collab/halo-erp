import { useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import {
  armBrowserNotifications,
  showForegroundBrowserNotification,
} from '../../../shared/services/fcmService'
import { subscribeProjectTaskAlerts } from '../../../../../shared/supabase/subscribeProjectTaskAlerts.js'

const asIdList = (userIdOrIds) =>
  [...new Set((Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds]).filter(Boolean).map(String))]

export const collectAdminIdentityIds = (user, userDoc, claims) => {
  const ids = new Set()
  const add = (value) => {
    if (value == null || value === '') return
    ids.add(String(value))
  }
  add(user?.uid)
  add(userDoc?.uid)
  add(userDoc?.id)
  add(userDoc?.auth_id)
  add(userDoc?.authId)
  add(user?.auth_id)
  add(claims?.business_uid)
  add(claims?.uid)
  if (Array.isArray(userDoc?.identityIds)) {
    userDoc.identityIds.forEach(add)
  }
  return [...ids]
}

export const useInboxBrowserAlerts = (userIdOrIds, profile = {}) => {
  const ids = asIdList(userIdOrIds)
  const { user, userDoc } = profile

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    if (!ids.length && !user?.uid) return undefined

    return subscribeProjectTaskAlerts({
      mode: 'admin',
      identityIds: ids,
      user,
      userDoc,
      onAlert: (payload) => {
        void showForegroundBrowserNotification(payload)
      },
    })
  }, [ids.join('|'), user?.uid, userDoc?.uid, userDoc?.email])

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
          if (data.type !== 'project' && data.type !== 'task') return

          void showForegroundBrowserNotification({
            notification: {
              title: data.title || (data.type === 'project' ? 'New project created' : 'Task status updated'),
              body: data.message || '',
            },
            data: {
              type: data.type,
              link: data.adminLink || (data.type === 'project' ? '/projects/list' : '/projects/tasks'),
              tag: data.tag || `${data.type}-${change.doc.id}`,
              projectId: data.projectId,
              taskId: data.taskId,
            },
          })
        })
      })
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [ids.join('|')])
}
