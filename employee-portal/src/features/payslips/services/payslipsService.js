import { db } from '../../../shared/services/firebaseService';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

export const subscribeMyPayslips = (uidOrIds, callback) => {
  const ids = [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]
  if (!ids.length) return () => {}

  const byKey = new Map()
  const unsubs = ids.map((uid) => {
    const q = query(
      collection(db, `payslips/${uid}/records`),
      orderBy('year', 'desc'),
      orderBy('month', 'desc')
    )
    return onSnapshot(q, (snapshot) => {
      for (const key of [...byKey.keys()]) {
        if (key.startsWith(`${uid}:`)) byKey.delete(key)
      }
      snapshot.docs.forEach((docSnap) => {
        byKey.set(`${uid}:${docSnap.id}`, { id: docSnap.id, ...docSnap.data() })
      })
      callback([...byKey.values()])
    })
  })

  return () => unsubs.forEach((unsub) => unsub())
}
