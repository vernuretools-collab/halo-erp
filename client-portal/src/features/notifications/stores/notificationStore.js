import { create } from 'zustand'



export const useNotificationStore = create((set) => ({
  notifications: [],
  isOpen: false,

  setIsOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),

  markAsRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.notificationId === notificationId ? { ...n, isRead: true } : n
      ),
    })),

  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
    })),

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
