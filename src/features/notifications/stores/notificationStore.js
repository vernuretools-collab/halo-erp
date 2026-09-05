import { create } from 'zustand'

const DEMO_NOTIFICATIONS = [
  {
    notificationId: 'notif_1',
    title: 'Payment Received',
    message: 'Invoice INV-2024-001 ($11,000) was paid by Acme Corp.',
    type: 'finance',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    link: '/finance/invoices',
  },
  {
    notificationId: 'notif_2',
    title: 'New Lead Qualified',
    message: 'Nexus Systems Tech was moved to Qualified stage ($120,000).',
    type: 'crm',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    link: '/crm/pipeline',
  },
  {
    notificationId: 'notif_3',
    title: 'Milestone Completed',
    message: 'Phase 1 UI Design Tokens completed for SaaS Platform Redesign.',
    type: 'project',
    isRead: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    link: '/projects/list',
  },
]

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
