import { create } from 'zustand'

export const usePortalStore = create((set) => ({
  projects: [],
  invoices: [],
  files: [],
  activities: [],
  tickets: [],
  approvals: [],

  setProjects: (projects) => set({ projects: Array.isArray(projects) ? projects : [] }),
  setInvoices: (invoices) => set({ invoices: Array.isArray(invoices) ? invoices : [] }),
  setFiles: (files) => set({ files: Array.isArray(files) ? files : [] }),
  setActivities: (activities) => set({ activities: Array.isArray(activities) ? activities : [] }),
  setTickets: (tickets) => set({ tickets: Array.isArray(tickets) ? tickets : [] }),
  setApprovals: (approvals) => set({ approvals: Array.isArray(approvals) ? approvals : [] }),

  addTicket: (ticket) =>
    set((state) => ({
      tickets: [
        {
          id: `ticket_${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'Open',
          ...ticket,
        },
        ...state.tickets,
      ],
    })),

  approveDeliverable: (approvalId) =>
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.approvalId === approvalId ? { ...a, status: 'approved' } : a
      ),
    })),

  rejectDeliverable: (approvalId) =>
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.approvalId === approvalId ? { ...a, status: 'rejected' } : a
      ),
    })),
}))


