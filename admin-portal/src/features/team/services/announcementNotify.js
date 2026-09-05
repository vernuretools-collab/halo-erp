import { collection, doc, getDocs, query, where, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const notifyEmployeesOnAnnouncement = async ({ announcementId, title, body, priority, author }) => {
  try {
    const empSnap = await getDocs(collection(db, 'employees')).catch(() => ({ docs: [] }))
    const employeeIds = new Set()

    empSnap.docs?.forEach((d) => {
      const data = d.data()
      if (data.status !== 'inactive' && data.status !== 'terminated') {
        employeeIds.add(d.id)
        if (data.uid) employeeIds.add(data.uid)
        if (data.auth_id) employeeIds.add(data.auth_id)
        if (data.employeeId) employeeIds.add(data.employeeId)
      }
    })

    try {
      const userSnap = await getDocs(collection(db, 'users'))
      userSnap.docs?.forEach((d) => {
        const data = d.data()
        if (data.role !== 'admin' && data.status !== 'inactive') {
          employeeIds.add(d.id)
          if (data.uid) employeeIds.add(data.uid)
          if (data.auth_id) employeeIds.add(data.auth_id)
        }
      })
    } catch {
      // users collection may be restricted
    }

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

const collectEmployeeIds = async () => {
  const employeeIds = new Set()
  const empSnap = await getDocs(collection(db, 'employees')).catch(() => ({ docs: [] }))

  empSnap.docs?.forEach((d) => {
    const data = d.data()
    if (data.status !== 'inactive' && data.status !== 'terminated') {
      employeeIds.add(d.id)
      if (data.uid) employeeIds.add(data.uid)
      if (data.auth_id) employeeIds.add(data.auth_id)
      if (data.employeeId) employeeIds.add(data.employeeId)
    }
  })

  try {
    const userSnap = await getDocs(collection(db, 'users'))
    userSnap.docs?.forEach((d) => {
      const data = d.data()
      if (data.role !== 'admin' && data.status !== 'inactive') {
        employeeIds.add(d.id)
        if (data.uid) employeeIds.add(data.uid)
        if (data.auth_id) employeeIds.add(data.auth_id)
        if (data.employeeId) employeeIds.add(data.employeeId)
      }
    })
  } catch {
    // users collection may be restricted
  }

  return employeeIds
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
