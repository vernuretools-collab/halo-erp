import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

/**
 * Fetch all notifications from Firestore
 */
export const getNotifications = async () => {
  try {
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc')
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ notificationId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching notifications from Firestore:', err)
    return []
  }
}

/**
 * Mark a notification as read in Firestore
 */
export const markNotificationReadInDb = async (notificationId) => {
  try {
    if (!notificationId) return
    await updateDoc(doc(db, 'notifications', notificationId), {
      isRead: true,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error marking notification as read in Firestore:', err)
  }
}

/**
 * Mark all notifications as read in Firestore
 */
export const markAllNotificationsReadInDb = async (notificationIds = []) => {
  try {
    await Promise.all(
      notificationIds.map((id) =>
        updateDoc(doc(db, 'notifications', id), {
          isRead: true,
          updatedAt: new Date().toISOString(),
        })
      )
    )
  } catch (err) {
    console.error('Error marking all notifications as read in Firestore:', err)
  }
}

/**
 * Create a new notification in Firestore
 */
export const createNotification = async (notifData) => {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...notifData,
      isRead: false,
      createdAt: new Date().toISOString(),
    })
    return { notificationId: docRef.id, ...notifData }
  } catch (err) {
    console.error('Error creating notification in Firestore:', err)
    return { notificationId: `notif_${Date.now()}`, ...notifData }
  }
}
