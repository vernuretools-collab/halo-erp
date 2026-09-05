import { create } from 'zustand'

const DEMO_SALES_METRICS = {
  totalLeads: 57,
  wonDeals: 18,
  lostDeals: 4,
  winRate: 81.8,
  avgSalesCycleDays: 14,
  totalPipelineValue: 410000,
  leadsBySource: [
    { source: 'Website Form', count: 24, value: 180000 },
    { source: 'LinkedIn Referral', count: 18, value: 140000 },
    { source: 'Inbound Inquiries', count: 10, value: 60000 },
    { source: 'Cold Outreach', count: 5, value: 30000 },
  ],
  lostReasons: [
    { reason: 'Competitor Lower Price', count: 2 },
    { reason: 'Project Postponed', count: 1 },
    { reason: 'Feature Misalignment', count: 1 },
  ],
}

const DEMO_FINANCE_METRICS = {
  grossRevenue: 124500,
  totalExpenses: 28400,
  netProfit: 96100,
  netMargin: 77.2,
  collectedRevenue: 104000,
  overdueAmount: 20500,
}

const DEMO_PROJECT_METRICS = {
  activeProjectsCount: 18,
  onTimeDeliveryRate: 94.4,
  avgCompletionDays: 22,
  totalBudgeted: 185000,
  totalSpentHours: 316,
}

export const useReportStore = create((set) => ({
  sales: DEMO_SALES_METRICS,
  finance: DEMO_FINANCE_METRICS,
  projects: DEMO_PROJECT_METRICS,
  dateRange: 'this_quarter', // 'this_month' | 'this_quarter' | 'this_year' | 'all_time'
  isExporting: false,

  setDateRange: (dateRange) => set({ dateRange }),
  setIsExporting: (isExporting) => set({ isExporting }),
}))
