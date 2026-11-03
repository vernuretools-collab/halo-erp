import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import {
  collectEmployeeIdentityIds,
  isDirectoryVisible,
} from '../../../../../shared/employees/employmentStatus.js'

const blockedFromNotify = (data) => {
  const status = String(data?.status || '').trim().toLowerCase()
  if (status === 'inactive' || status === 'terminated') return true
  return !isDirectoryVisible(data)
}

const rememberBlocked = (ids, emails, rowId, data) => {
  collectEmployeeIdentityIds({ ...data, id: rowId, uid: data.uid || rowId }).forEach((id) => ids.add(String(id)))
  ids.add(String(rowId))
  const email = String(data.email || '').trim().toLowerCase()
  if (email) emails.add(email)
}

const addCurrentIds = (employeeIds, rowId, data) => {
  employeeIds.add(rowId)
  if (data.uid) employeeIds.add(data.uid)
  if (data.auth_id) employeeIds.add(data.auth_id)
  if (data.authId) employeeIds.add(data.authId)
  if (data.employeeId) employeeIds.add(data.employeeId)
}

const collectEmployeeIds = async () => {
  const employeeIds = new Set()
  const blockedIds = new Set()
  const blockedEmails = new Set()
  const empSnap = await getDocs(collection(db, 'employees')).catch(() => ({ docs: [] }))

  empSnap.docs?.forEach((d) => {
    const data = d.data() || {}
    if (blockedFromNotify(data)) {
      rememberBlocked(blockedIds, blockedEmails, d.id, data)
      return
    }
    addCurrentIds(employeeIds, d.id, data)
  })

  try {
    const userSnap = await getDocs(collection(db, 'users'))
    userSnap.docs?.forEach((d) => {
      const data = d.data() || {}
      const email = String(data.email || '').trim().toLowerCase()
      if (data.role === 'admin' || data.role === 'owner') return
      if (blockedFromNotify(data)) return
      if (data.status === 'inactive' || data.status === 'terminated') return
      const linked = [d.id, data.uid, data.auth_id, data.authId, data.employeeId]
        .filter((value) => value != null && value !== '')
        .some((value) => blockedIds.has(String(value)))
      if (linked || (email && blockedEmails.has(email))) return
      addCurrentIds(employeeIds, d.id, data)
    })
  } catch {
    // users collection may be restricted
  }

  return employeeIds
}

export const notifyEmployeesOnAnnouncement = async ({ announcementId, title, body, priority, author }) => {
  try {
    const employeeIds = await collectEmployeeIds()
    if (employeeIds.size === 0) return

    const previewMessage = body.length > 120 ? `${body.slice(0, 120)}...` : body
    const nowIso = new Date().toISOString()
    const idList = Array.from(employeeIds)
    const CHUNK_SIZE = 400

    for (let i = 0; i < idList.length; i += CHUNK_SIZE) {
      const chunk = idList.slice(i, i + CHUNK_SIZE)
      const batch = writeBatch(db)

      chunk.forEach((empId) => {
        const notifDocRef = doc(collection(db, 'notifications', empId, 'items'))
        batch.set(notifDocRef, {
          notificationId: notifDocRef.id,
          title: `📢 ${title}`,
          message: previewMessage,
          type: 'announcement',
          priority: (priority || 'info').toLowerCase(),
          isRead: false,
          announcementId,
          link: '/announcements',
          author: author || 'Admin',
          createdAt: nowIso,
          serverCreatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
    }
  } catch (notifErr) {
    console.error('Failed to dispatch notifications to employees:', notifErr)
  }
}

export const removeEmployeeNotificationsForAnnouncement = async (announcementId) => {
  if (!announcementId) return
  try {
    const employeeIds = await collectEmployeeIds()
    if (employeeIds.size === 0) return

    for (const empId of employeeIds) {
      const itemsSnap = await getDocs(
        query(
          collection(db, 'notifications', empId, 'items'),
          where('announcementId', '==', announcementId)
        )
      )
      if (itemsSnap.empty) continue

      const batch = writeBatch(db)
      itemsSnap.docs.forEach((itemDoc) => batch.delete(itemDoc.ref))
      await batch.commit()
    }
  } catch (err) {
    console.error('Failed to remove announcement notifications:', err)
  }
}
