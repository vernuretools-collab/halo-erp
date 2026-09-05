import { useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'

const asIdList = (userIdOrIds) =>
  [...new Set((Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds]).filter(Boolean).map(String))]

export const useProjectBrowserAlerts = (userIdOrIds) => {
  const ids = asIdList(userIdOrIds)

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
              link: data.link || (data.type === 'project' ? '/projects/list' : '/tasks'),
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
