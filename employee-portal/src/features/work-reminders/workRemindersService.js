import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'

const itemsRef = (uid) => collection(db, 'workReminders', uid, 'items')

const toDateKey = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return ''
}

export const subscribeMyWorkReminders = (uid, callback, onError) => {
  if (!uid) return () => {}
  const q = query(itemsRef(uid), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((docSnap) => {
          const data = docSnap.data() || {}
          return {
            id: docSnap.id,
            title: data.title || '',
            body: data.body || '',
            remindOn: toDateKey(data.remindOn),
            done: data.done === true,
          }
        })
      )
    },
    (err) => {
      console.error('Failed to load work reminders', err)
      onError?.(err)
    }
  )
}

export const addWorkReminder = async (uid, data) => {
  if (!uid) throw new Error('User ID is required')
  return addDoc(itemsRef(uid), {
    title: String(data.title || '').trim(),
    body: String(data.body || '').trim(),
    remindOn: data.remindOn || '',
    done: false,
    createdAt: serverTimestamp(),
  })
}

export const updateWorkReminder = async (uid, reminderId, updates) => {
  if (!uid || !reminderId) throw new Error('User ID and reminder ID are required')
  return updateDoc(doc(db, 'workReminders', uid, 'items', reminderId), updates)
}

export const deleteWorkReminder = async (uid, reminderId) => {
  if (!uid || !reminderId) throw new Error('User ID and reminder ID are required')
  return deleteDoc(doc(db, 'workReminders', uid, 'items', reminderId))
}
