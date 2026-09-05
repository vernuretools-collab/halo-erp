import { create } from 'zustand'

export const useReportStore = create((set) => ({
  sales: null,
  finance: null,
  projects: null,
  dateRange: 'this_quarter', // 'this_month' | 'this_quarter' | 'this_year' | 'all_time'
  isLoading: false,

  setSalesMetrics: (sales) => set({ sales }),
  setFinanceMetrics: (finance) => set({ finance }),
  setProjectMetrics: (projects) => set({ projects }),
  setDateRange: (dateRange) => set({ dateRange }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setIsExporting: (isExporting) => set({ isExporting }),

  isExporting: false,
}))
