import { useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { showForegroundBrowserNotification } from '../../../shared/services/fcmService'

const asIdList = (userIdOrIds) =>
  [...new Set((Array.isArray(userIdOrIds) ? userIdOrIds : [userIdOrIds]).filter(Boolean).map(String))]

export const usePayslipBrowserAlerts = (userIdOrIds) => {
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
          if (data.type !== 'payslip') return

          void showForegroundBrowserNotification({
            notification: {
              title: data.title || 'Check your balance',
              body: data.message || 'Check your balance.',
            },
            data: {
              type: 'payslip',
              link: data.link || '/payslips',
              month: data.month,
              year: data.year,
              tag: `payslip-${data.year || ''}-${data.month || ''}`,
            },
          })
        })
      })
    })

    return () => unsubs.forEach((unsub) => unsub())
  }, [ids.join('|')])
}
