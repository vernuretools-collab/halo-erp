import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { isUserOnProject, matchesUserIdentity } from '../../projects/services/projectService'

const isClientSupportTicket = (ticket) =>
  !!(ticket?.clientId || ticket?.clientEmail || ticket?.projectName || ticket?.projectId)

const ticketTime = (ticket) => {
  if (ticket?.createdAt?.seconds) return ticket.createdAt.seconds * 1000
  return ticket?.createdAt ? new Date(ticket.createdAt).getTime() : 0
}

/**
 * Subscribe to tickets relevant to this employee:
 * 1) Internal tickets they created
 * 2) Client support tickets for projects they are on (members / employeeId)
 * 3) Tickets that listed them in assignedEmployeeIds at create time
 */
export const subscribeEmployeeHelpDesk = (user, userDoc, callback) => {
  const uid = user?.uid || userDoc?.uid
  if (!uid) return () => {}

  let tickets = []
  let projects = []

  const emit = () => {
    const relevant = tickets.filter((ticket) => {
      const isCreator = matchesUserIdentity(
        ticket.createdBy,
        ticket.createdByEmail,
        ticket.createdByName,
        user,
        userDoc
      )
      const assignedIds = Array.isArray(ticket.assignedEmployeeIds) ? ticket.assignedEmployeeIds : []
      const isAssigned = assignedIds.some((id) => matchesUserIdentity(id, ticket.assigneeEmail, ticket.assigneeName, user, userDoc))

      if (isClientSupportTicket(ticket)) {
        const ticketProjectId = String(ticket.projectId || '')
        const project = projects.find(
          (p) =>
            String(p.id || p.projectId || '') === ticketProjectId ||
            (ticket.projectName && p.name && String(p.name).toLowerCase() === String(ticket.projectName).toLowerCase())
        )
        const onProject = Boolean(project && isUserOnProject(project, user, userDoc))
        return isAssigned || onProject || isCreator
      }

      return isCreator || isAssigned
    })

    relevant.sort((a, b) => ticketTime(b) - ticketTime(a))
    callback(relevant)
  }

  try {
    const unsubTickets = onSnapshot(
      collection(db, 'helpDeskTickets'),
      (snapshot) => {
        tickets = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        emit()
      },
      (error) => {
        console.error('Error subscribing to employee help desk:', error)
        callback([])
      }
    )

    const unsubProjects = onSnapshot(
      collection(db, 'projects'),
      (snapshot) => {
        projects = snapshot.docs.map((d) => ({ id: d.id, projectId: d.id, ...d.data() }))
        emit()
      },
      (error) => {
        console.warn('Error subscribing to projects for support tickets:', error.message)
        emit()
      }
    )

    return () => {
      unsubTickets()
      unsubProjects()
    }
  } catch (err) {
    console.error('Failed to setup subscribeEmployeeHelpDesk:', err)
    return () => {}
  }
}

export const subscribeMyTickets = subscribeEmployeeHelpDesk

export const createTicket = async (uid, ticketData) => {
  if (!uid) throw new Error('User ID is required')
  const ticketsRef = collection(db, 'helpDeskTickets')
  return await addDoc(ticketsRef, {
    ...ticketData,
    createdBy: uid,
    replies: [],
    status: ticketData.status || 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

export const addTicketReply = async (ticketId, reply) => {
  if (!ticketId) throw new Error('Ticket ID is required')
  const ticketRef = doc(db, 'helpDeskTickets', ticketId)
  const replyItem = {
    id: `rep_${Date.now()}`,
    senderId: reply.senderId,
    senderName: reply.senderName,
    senderRole: reply.senderRole || 'employee',
    message: reply.message,
    createdAt: new Date().toISOString(),
  }
  await updateDoc(ticketRef, {
    replies: arrayUnion(replyItem),
    updatedAt: new Date().toISOString(),
  })
  return replyItem
}

export const updateTicketStatus = async (ticketId, status) => {
  if (!ticketId) throw new Error('Ticket ID is required')
  const ticketRef = doc(db, 'helpDeskTickets', ticketId)
  return await updateDoc(ticketRef, {
    status: status.toLowerCase(),
    updatedAt: new Date().toISOString(),
  })
}

export const closeTicket = async (ticketId) => {
  return updateTicketStatus(ticketId, 'resolved')
}
