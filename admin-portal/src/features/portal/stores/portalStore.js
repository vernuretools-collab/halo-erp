import { create } from 'zustand'

export const usePortalStore = create((set) => ({
  projects: [],
  invoices: [],
  files: [],
  approvals: [],

  setProjects: (projects) => set({ projects }),
  setInvoices: (invoices) => set({ invoices }),
  setFiles: (files) => set({ files }),
  setApprovals: (approvals) => set({ approvals }),

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
