import { create } from 'zustand'
import {
  getInvoices,
  getExpenses,
  getRetainersFromDb,
  getExpenseCategoriesFromDb,
  createExpenseCategoryInDb,
  DEFAULT_EXPENSE_CATEGORIES,
  createExpense,
  deleteExpenseFromDb,
  createRetainerInDb,
  updateRetainerInDb,
  deleteRetainerFromDb,
} from '../services/financeService'

export const useFinanceStore = create((set) => ({
  invoices: [],
  expenses: [],
  retainers: [],
  categories: DEFAULT_EXPENSE_CATEGORIES,
  isLoading: true,
  selectedInvoice: null,
  invoiceStatusFilter: 'all',

  setInvoices: (invoices) =>
    set({
      invoices: Array.isArray(invoices) ? invoices : [],
      isLoading: false,
    }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setExpenses: (expenses) => set({ expenses: Array.isArray(expenses) ? expenses : [] }),
  setRetainers: (retainers) => set({ retainers: Array.isArray(retainers) ? retainers : [] }),
  setCategories: (categories) => set({ categories: Array.isArray(categories) ? categories : DEFAULT_EXPENSE_CATEGORIES }),
  setSelectedInvoice: (selectedInvoice) => set({ selectedInvoice }),
  setInvoiceStatusFilter: (invoiceStatusFilter) => set({ invoiceStatusFilter }),

  fetchFinanceData: async () => {
    set({ isLoading: true })
    try {
      const [invData, expData, retData, catData] = await Promise.all([
        getInvoices(),
        getExpenses(),
        getRetainersFromDb(),
        getExpenseCategoriesFromDb(),
      ])
      set({
        invoices: invData || [],
        expenses: expData || [],
        retainers: retData || [],
        categories: catData && catData.length > 0 ? catData : DEFAULT_EXPENSE_CATEGORIES,
        isLoading: false,
      })
    } catch (err) {
      console.error('Error fetching finance data from Firestore:', err)
      set({ isLoading: false })
    }
  },

  addCategory: async (categoryName) => {
    const name = categoryName?.trim()
    if (!name) return
    set((state) => {
      if (state.categories.includes(name)) return state
      return { categories: [...state.categories, name] }
    })
    await createExpenseCategoryInDb(name)
  },

  addInvoice: (newInv) =>
    set((state) => ({
      invoices: [
        {
          invoiceId: newInv.invoiceId || `inv_${Date.now()}`,
          invoiceNumber: newInv.invoiceNumber || `INV-${new Date().getFullYear()}-${String(state.invoices.length + 1).padStart(3, '0')}`,
          status: newInv.status || 'draft',
          issueDate: new Date().toISOString().split('T')[0],
          amountPaid: 0,
          amountDue: newInv.total || 0,
          currency: 'INR',
          ...newInv,
        },
        ...state.invoices,
      ],
    })),

  sendInvoiceToClient: (invoiceId) =>
    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.invoiceId === invoiceId
          ? {
              ...inv,
              status: 'sent',
              sentAt: new Date().toLocaleString(),
            }
          : inv
      ),
    })),

  updateInvoiceStatus: (invoiceId, newStatus) =>
    set((state) => ({
      invoices: state.invoices.map((inv) => {
        if (inv.invoiceId !== invoiceId) return inv
        const isPaid = newStatus === 'paid'
        return {
          ...inv,
          status: newStatus,
          amountPaid: isPaid ? inv.total : inv.amountPaid,
          amountDue: isPaid ? 0 : inv.total,
        }
      }),
    })),

  deleteInvoice: (invoiceId) =>
    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.invoiceId !== invoiceId),
    })),

  addExpense: async (newExp) => {
    const payload = {
      status: 'approved',
      date: new Date().toISOString().split('T')[0],
      ...newExp,
    }
    const created = await createExpense(payload)
    set((state) => ({
      expenses: [created, ...state.expenses],
    }))
  },

  deleteExpense: async (expenseId) => {
    const eId = String(expenseId)
    set((state) => ({
      expenses: state.expenses.filter((e) => String(e.expenseId) !== eId && String(e.id) !== eId),
    }))
    await deleteExpenseFromDb(eId)
  },

  addRetainer: async (newRet) => {
    const payload = {
      status: 'Active',
      interval: 'Monthly (1st)',
      createdAt: new Date().toISOString(),
      ...newRet,
    }
    const created = await createRetainerInDb(payload)
    set((state) => ({
      retainers: [created, ...state.retainers],
    }))
  },

  updateRetainer: async (retainerId, updates) => {
    const rId = String(retainerId)
    set((state) => ({
      retainers: state.retainers.map((r) =>
        String(r.retainerId) === rId || String(r.id) === rId ? { ...r, ...updates } : r
      ),
    }))
    await updateRetainerInDb(rId, updates)
  },

  deleteRetainer: async (retainerId) => {
    const rId = String(retainerId)
    set((state) => ({
      retainers: state.retainers.filter((r) => String(r.retainerId) !== rId && String(r.id) !== rId),
    }))
    await deleteRetainerFromDb(rId)
  },
}))
