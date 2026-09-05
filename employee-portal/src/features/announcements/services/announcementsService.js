import { collection, onSnapshot, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const subscribeAnnouncements = (callback) => {
  const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snapshot) => {
    const announcements = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    callback(announcements)
  })
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
