import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const announcementTimeMs = (value) => {
  if (!value) return 0
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') return value.seconds * 1000
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

export const subscribeAnnouncements = (callback) => {
  return onSnapshot(
    collection(db, 'announcements'),
    (snapshot) => {
      const announcements = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      announcements.sort((a, b) => announcementTimeMs(b.createdAt) - announcementTimeMs(a.createdAt))
      callback(announcements)
    },
    () => callback([])
  )
}

export const subscribeAnnouncementCreates = (callback, onRemoved) => {
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
  let initial = true
  return onSnapshot(q, (snapshot) => {
    if (initial) {
      initial = false
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') onRemoved?.(change.doc.id)
      })
      return
    }
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'removed') {
        onRemoved?.(change.doc.id)
        return
      }
      if (change.type === 'added' && !change.doc.metadata.hasPendingWrites) {
        callback({ id: change.doc.id, ...change.doc.data() })
      }
    })
  })
}

export const getAnnouncements = async () => {
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}

/** Pinned first (newest pinned), then newest unpinned. Caps at `count`. */
export const pickDashboardAnnouncements = (list, count = 3) => {
  const items = Array.isArray(list) ? [...list] : []
  items.sort((a, b) => {
    const pinA = a.pinned ? 1 : 0
    const pinB = b.pinned ? 1 : 0
    if (pinA !== pinB) return pinB - pinA
    return announcementTimeMs(b.createdAt || b.updatedAt) - announcementTimeMs(a.createdAt || a.updatedAt)
  })
  return items.slice(0, count)
}
