import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { notifyEmployeesOnAnnouncement, removeEmployeeNotificationsForAnnouncement } from './announcementNotify'

const COLLECTION_NAME = 'announcements'

/**
 * Subscribe to real-time announcements ordered by creation time descending.
 * @param {Function} callback
 * @returns {Function} unsubscribe function
 */
export const subscribeToAnnouncements = (callback) => {
  try {
    const colRef = collection(db, COLLECTION_NAME)
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }))
        // Sort client-side by createdAt descending safely
        list.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
          return timeB - timeA
        })
        callback(list)
      },
      (error) => {
        console.error('Error in subscribeToAnnouncements:', error)
        callback([])
      }
    )
  } catch (err) {
    console.error('Failed to setup subscribeToAnnouncements query:', err)
    return () => {}
  }
}

/**
 * Create a new announcement in Firestore and notify all employees
 * @param {Object} data - { title, body, priority, pinned, author, authorId }
 */
export const createAnnouncement = async ({ title, body, priority = 'info', pinned = false, author = 'Admin', authorId = null }) => {
  const payload = {
    title: title.trim(),
    body: body.trim(),
    priority: (priority || 'info').toLowerCase(),
    pinned: Boolean(pinned),
    author: author || 'Admin',
    authorId: authorId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  const docRef = await addDoc(collection(db, COLLECTION_NAME), payload)
  void notifyEmployeesOnAnnouncement({
    announcementId: docRef.id,
    title: payload.title,
    body: payload.body,
    priority: payload.priority,
    author: payload.author,
  })
  return docRef.id
}

/**
 * Update an existing announcement in Firestore
 * @param {string} id - announcement document ID
 * @param {Object} data - fields to update
 */
export const updateAnnouncement = async (id, { title, body, priority, pinned }) => {
  const docRef = doc(db, COLLECTION_NAME, id)
  const payload = {
    updatedAt: serverTimestamp(),
  }

  if (title !== undefined) payload.title = title.trim()
  if (body !== undefined) payload.body = body.trim()
  if (priority !== undefined) payload.priority = (priority || 'info').toLowerCase()
  if (pinned !== undefined) payload.pinned = Boolean(pinned)

  await updateDoc(docRef, payload)
}

/**
 * Toggle the pinned status of an announcement
 * @param {string} id
 * @param {boolean} currentPinnedStatus
 */
export const togglePinAnnouncement = async (id, currentPinnedStatus) => {
  const docRef = doc(db, COLLECTION_NAME, id)
  await updateDoc(docRef, {
    pinned: !currentPinnedStatus,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Delete an announcement from Firestore
 * @param {string} id
 */
export const deleteAnnouncement = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id)
  await deleteDoc(docRef)
  await removeEmployeeNotificationsForAnnouncement(id)
}
