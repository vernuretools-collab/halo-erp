import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

/**
 * Compute sales metrics by reading the leads collection
 */
export const getSalesMetrics = async () => {
  try {
    const snap = await getDocs(collection(db, 'leads'))
    const leads = snap.docs.map((d) => d.data())

    const totalLeads = leads.length
    const wonDeals = leads.filter((l) => l.pipelineStage === 'Won' || l.pipelineStageId === 'stage_won').length
    const lostDeals = leads.filter((l) => l.pipelineStage === 'Lost' || l.pipelineStageId === 'stage_lost').length
    const closedDeals = wonDeals + lostDeals
    const winRate = closedDeals > 0 ? Math.round((wonDeals / closedDeals) * 100 * 10) / 10 : 0
    const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.estimatedValue) || 0), 0)

    // Group by source
    const sourceMap = {}
    leads.forEach((l) => {
      const src = l.source || 'Other'
      if (!sourceMap[src]) sourceMap[src] = { source: src, count: 0, value: 0 }
      sourceMap[src].count += 1
      sourceMap[src].value += Number(l.estimatedValue) || 0
    })
    const leadsBySource = Object.values(sourceMap).sort((a, b) => b.count - a.count)

    return {
      totalLeads,
      wonDeals,
      lostDeals,
      winRate,
      avgSalesCycleDays: 0, // Requires timestamps to compute properly
      totalPipelineValue,
      leadsBySource,
      lostReasons: [],
    }
  } catch (err) {
    console.error('Error computing sales metrics from Firestore:', err)
    return {
      totalLeads: 0, wonDeals: 0, lostDeals: 0, winRate: 0,
      avgSalesCycleDays: 0, totalPipelineValue: 0, leadsBySource: [], lostReasons: [],
    }
  }
}

/**
 * Compute finance metrics by reading invoices and expenses collections
 */
export const getFinanceMetrics = async () => {
  try {
    const [invoiceSnap, expenseSnap] = await Promise.all([
      getDocs(collection(db, 'invoices')),
      getDocs(collection(db, 'expenses')),
    ])

    const invoices = invoiceSnap.docs.map((d) => d.data())
    const expenses = expenseSnap.docs.map((d) => d.data())

    const grossRevenue = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
    const collectedRevenue = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
    const overdueAmount = invoices
      .filter((inv) => inv.status === 'overdue')
      .reduce((sum, inv) => sum + (Number(inv.amountDue) || 0), 0)
    const totalExpenses = expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)
    const netProfit = grossRevenue - totalExpenses
    const netMargin = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100 * 10) / 10 : 0

    return { grossRevenue, totalExpenses, netProfit, netMargin, collectedRevenue, overdueAmount }
  } catch (err) {
    console.error('Error computing finance metrics from Firestore:', err)
    return { grossRevenue: 0, totalExpenses: 0, netProfit: 0, netMargin: 0, collectedRevenue: 0, overdueAmount: 0 }
  }
}

/**
 * Compute project metrics by reading the projects collection
 */
export const getProjectMetrics = async () => {
  try {
    const snap = await getDocs(collection(db, 'projects'))
    const projects = snap.docs.map((d) => d.data())

    const activeProjectsCount = projects.filter((p) => p.status === 'active').length
    const completed = projects.filter((p) => p.status === 'completed')
    const onTimeCount = completed.filter((p) => (p.completionPercent || 0) >= 100).length
    const onTimeDeliveryRate = completed.length > 0
      ? Math.round((onTimeCount / completed.length) * 100 * 10) / 10
      : 0
    const totalBudgeted = projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0)
    const totalSpentHours = projects.reduce((sum, p) => sum + (Number(p.totalHoursLogged) || 0), 0)

    return { activeProjectsCount, onTimeDeliveryRate, avgCompletionDays: 0, totalBudgeted, totalSpentHours }
  } catch (err) {
    console.error('Error computing project metrics from Firestore:', err)
    return { activeProjectsCount: 0, onTimeDeliveryRate: 0, avgCompletionDays: 0, totalBudgeted: 0, totalSpentHours: 0 }
  }
}
