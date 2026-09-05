import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore'

import { db } from '../../../shared/services/firebaseService'

const COLLECTION_NAME = 'helpDeskTickets'

export const isClientSupportTicket = (ticket) =>
  !!(ticket?.clientId || ticket?.clientEmail || ticket?.projectName || ticket?.projectId)

/**
 * Real-time subscription to client support tickets (not internal employee help-desk).
 */
export const subscribeToAllTickets = (callback) => {
  try {
    const colRef = collection(db, COLLECTION_NAME)
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter(isClientSupportTicket)
        list.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0)
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0)
          return timeB - timeA
        })
        callback(list)
      },
      (error) => {
        console.error('Error subscribing to helpDeskTickets:', error)
        callback([])
      }
    )
  } catch (err) {
    console.error('Failed to setup subscribeToAllTickets:', err)
    return () => {}
  }
}

/**
 * Update the status of a help desk ticket
 * @param {string} ticketId
 * @param {string} status - 'open' | 'in_progress' | 'resolved' | 'closed'
 */
export const updateTicketStatus = async (ticketId, status) => {
  const docRef = doc(db, COLLECTION_NAME, ticketId)
  await updateDoc(docRef, {
    status: status.toLowerCase(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Update the priority of a help desk ticket
 * @param {string} ticketId
 * @param {string} priority - 'high' | 'medium' | 'low'
 */
export const updateTicketPriority = async (ticketId, priority) => {
  const docRef = doc(db, COLLECTION_NAME, ticketId)
  await updateDoc(docRef, {
    priority: priority.toLowerCase(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Add an admin response / resolution note to a ticket
 * @param {string} ticketId
 * @param {string} resolutionNote
 * @param {string} adminName
 */
export const addTicketResolution = async (ticketId, resolutionNote, adminName) => {
  const docRef = doc(db, COLLECTION_NAME, ticketId)
  await updateDoc(docRef, {
    resolutionNote: resolutionNote.trim(),
    resolvedBy: adminName,
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Add an admin reply to a ticket thread
 */
export const addTicketReply = async (ticketId, reply) => {
  const docRef = doc(db, COLLECTION_NAME, ticketId)
  const replyItem = {
    id: `rep_${Date.now()}`,
    senderId: reply.senderId || 'admin',
    senderName: reply.senderName || 'Admin Support',
    senderRole: reply.senderRole || 'admin',
    message: reply.message,
    createdAt: new Date().toISOString(),
  }
  await updateDoc(docRef, {
    replies: arrayUnion(replyItem),
    updatedAt: serverTimestamp(),
  })
  return replyItem
}

/**
 * Delete a ticket from Firestore
 */
export const deleteTicket = async (ticketId) => {
  const docRef = doc(db, COLLECTION_NAME, ticketId)
  await deleteDoc(docRef)
}

