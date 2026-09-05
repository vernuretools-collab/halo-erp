import { create } from 'zustand'
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  notificationsLoaded: false,
  isOpen: false,
  unsubscribe: null,

  setIsOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  fetchNotifications: (uidOrIds) => {
    const ids = [...new Set((Array.isArray(uidOrIds) ? uidOrIds : [uidOrIds]).filter(Boolean).map(String))]
    if (!ids.length) return

    const { unsubscribe: currentUnsubscribe } = get()
    if (currentUnsubscribe) {
      currentUnsubscribe()
    }

    const buckets = new Map()
    const emit = () => {
      const merged = []
      const seen = new Set()
      for (const list of buckets.values()) {
        for (const item of list) {
          const key =
            item.type === 'announcement' && item.announcementId
              ? `announcement:${item.announcementId}`
              : item.type === 'payslip'
                ? `payslip:${item.year}-${item.month}-${item.title || ''}`
                : `${item._inboxUid}:${item.notificationId}`
          if (seen.has(key)) continue
          seen.add(key)
          merged.push(item)
        }
      }
      merged.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
      set({ notifications: merged, notificationsLoaded: true })
    }

    const unsubs = ids.map((uid) => {
      const notificationsRef = collection(db, 'notifications', uid, 'items')
      const q = query(notificationsRef, orderBy('createdAt', 'desc'))
      return onSnapshot(q, (snapshot) => {
        buckets.set(
          uid,
          snapshot.docs.map((docSnap) => ({
            notificationId: docSnap.id,
            _inboxUid: uid,
            ...docSnap.data(),
          }))
        )
        emit()
      })
    })

    const unsubscribe = () => unsubs.forEach((unsub) => unsub())
    set({ unsubscribe, notificationsLoaded: false })
    return unsubscribe
  },

  markAsRead: async (uid, notificationId) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      ),
    }))

    if (!uid) return
    const inboxUid = get().notifications.find((n) => n.notificationId === notificationId)?._inboxUid || uid
    try {
      const notifRef = doc(db, 'notifications', inboxUid, 'items', notificationId)
      await updateDoc(notifRef, { isRead: true })
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  },

  markAllAsRead: async (uid) => {
    // Optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    }))

    if (!uid) return
    try {
      const unreadNotifications = get().notifications.filter(n => !n.isRead)
      if (unreadNotifications.length === 0) return

      const batch = writeBatch(db)
      unreadNotifications.forEach((n) => {
        const notifRef = doc(db, 'notifications', n._inboxUid || uid, 'items', n.notificationId)
        batch.update(notifRef, { isRead: true })
      })
      await batch.commit()
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  },

  addNotification: (newNotif) =>
    set((state) => ({
      notifications: [
        {
          notificationId: `notif_${Date.now()}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          type: 'info',
          ...newNotif,
        },
        ...state.notifications,
      ],
    })),
}))
