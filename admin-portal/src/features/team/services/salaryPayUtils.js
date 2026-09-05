/**
 * Salary from unpaid working days: LOP + inferred Absent.
 * net = gross − (gross / eligibleWorkingDays × unpaidDays) − otherDeductions
 */

export function unpaidDaysFromReport(report) {
  const stored = Number(report?.leave?.unpaidDays)
  if (Number.isFinite(stored) && stored >= 0) return stored
  const lop = Number(report?.leave?.lopDays ?? report?.leave?.unpaidLeaveDays) || 0
  const absent = Number(report?.attendance?.absentDays) || 0
  return lop + absent
}

export function eligibleWorkingDaysFromReport(report) {
  const eligible = Number(report?.attendance?.eligibleWorkingDays)
  if (Number.isFinite(eligible) && eligible > 0) return eligible
  return Number(report?.attendance?.workingDays) || 0
}

export function computeSalaryFromUnpaidDays({
  grossSalary,
  otherDeductions = 0,
  eligibleWorkingDays,
  unpaidDays,
} = {}) {
  const gross = Number(grossSalary) || 0
  const other = Number(otherDeductions) || 0
  const eligible = Math.max(0, Number(eligibleWorkingDays) || 0)
  const unpaid = Math.min(eligible, Math.max(0, Number(unpaidDays) || 0))
  const perDayRate = eligible > 0 ? gross / eligible : 0
  const unpaidDeduction = Math.round(perDayRate * unpaid * 100) / 100
  const netSalary = Math.round((gross - unpaidDeduction - other) * 100) / 100
  return {
    perDayRate,
    unpaidDeduction,
    netSalary,
    unpaidDays: unpaid,
    eligibleWorkingDays: eligible,
  }
}

export function computeSalaryFromReport(report, grossSalary, otherDeductions = 0) {
  return computeSalaryFromUnpaidDays({
    grossSalary,
    otherDeductions,
    eligibleWorkingDays: eligibleWorkingDaysFromReport(report),
    unpaidDays: unpaidDaysFromReport(report),
  })
}
