import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export function payslipRecordId(year, month) {
  return `${Number(year)}-${String(Number(month)).padStart(2, '0')}`
}

export function parseAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

export function splitSum(splits = []) {
  return Math.round(splits.reduce((sum, value) => sum + parseAmount(value), 0) * 100) / 100
}

/** Salary due (the Total amount field). */
export function rowTotalDue(row) {
  const total = parseAmount(row?.total)
  if (total > 0) return total
  return splitSum(row?.splits)
}

/** Money actually sent: sum of splits, or full total if no splits. */
export function rowAmountPaid(row) {
  const paid = splitSum(row?.splits)
  if (paid > 0) return paid
  return parseAmount(row?.total)
}

export function rowTotalPaid(row) {
  return rowAmountPaid(row)
}

export function draftsFromRecord(record) {
  if (!record) {
    return { total: '', splits: [], persistedTotal: 0, lastNotifiedAt: null }
  }

  const storedSplits = Array.isArray(record.splits)
    ? record.splits.map((v) => (parseAmount(v) ? String(parseAmount(v)) : ''))
    : []

  const legacyA1 = record.amount1 != null ? parseAmount(record.amount1) : 0
  const legacyA2 = record.amount2 != null ? parseAmount(record.amount2) : 0
  const legacySplits = []
  if (!storedSplits.length && (legacyA1 || legacyA2)) {
    if (legacyA1) legacySplits.push(String(legacyA1))
    if (legacyA2) legacySplits.push(String(legacyA2))
  }

  const splits = storedSplits.length ? storedSplits : legacySplits
  const totalValue =
    record.totalAmount != null
      ? parseAmount(record.totalAmount)
      : parseAmount(record.netSalary ?? record.grossSalary) || splitSum(splits)

  return {
    total: totalValue ? String(totalValue) : '',
    splits,
    persistedTotal: totalValue || splitSum(splits),
    lastNotifiedAt: record.lastNotifiedAt || null,
  }
}

export function employeePayslipIds(emp) {
  if (!emp) return []
  if (typeof emp === 'string') return [emp]
  return [
    ...new Set(
      [emp.uid, emp.employeeId, emp.id, emp.auth_id, emp.authId, emp.userId]
        .filter((value) => value != null && value !== '')
        .map(String)
    ),
  ]
}

export async function loadPayslipForMonth(uidOrEmp, year, month) {
  const ids = employeePayslipIds(uidOrEmp)
  const recordId = payslipRecordId(year, month)
  let fallback = null

  for (const uid of ids) {
    const snap = await getDoc(doc(db, `payslips/${uid}/records`, recordId))
    if (snap.exists()) {
      const rec = { id: snap.id, ...snap.data(), _payslipUid: uid }
      if (rec.totalAmount != null || rec.netSalary != null || rec.grossSalary != null) return rec
      if (!fallback) fallback = rec
    }

    const all = await getDocs(collection(db, `payslips/${uid}/records`))
    const match = all.docs
      .map((d) => ({ id: d.id, ...d.data(), _payslipUid: uid }))
      .find((r) => Number(r.year) === Number(year) && Number(r.month) === Number(month))
    if (match) {
      if (match.totalAmount != null || match.netSalary != null || match.grossSalary != null) return match
      if (!fallback) fallback = match
    }
  }

  return fallback
}

export async function resolvePayslipUid(emp) {
  const ids = employeePayslipIds(emp)
  for (const uid of ids) {
    const all = await getDocs(collection(db, `payslips/${uid}/records`))
    if (!all.empty) return uid
  }
  return ids[0] || ''
}

export async function savePayslipAmounts({ uid, employee, year, month, total, splits = [], updatedBy }) {
  const storageUid = (employee ? await resolvePayslipUid(employee) : '') || uid
  if (!storageUid) throw new Error('Employee id is required')
  const splitNumbers = splits.map((v) => parseAmount(v))
  const totalValue = parseAmount(total) || splitSum(splitNumbers)
  const paidValue = splitSum(splitNumbers) || totalValue
  const id = payslipRecordId(year, month)
  await setDoc(
    doc(db, `payslips/${storageUid}/records`, id),
    {
      month: Number(month),
      year: Number(year),
      totalAmount: totalValue,
      amountPaid: paidValue,
      splits: splitNumbers,
      amount1: splitNumbers[0] || (splitNumbers.length ? 0 : totalValue),
      amount2: splitNumbers[1] || 0,
      grossSalary: totalValue,
      netSalary: paidValue,
      deductions: 0,
      currency: 'INR',
      updatedAt: serverTimestamp(),
      updatedBy: updatedBy || 'Admin',
    },
    { merge: true }
  )
  return {
    total: totalValue,
    splits: splitNumbers.map((n) => (n ? String(n) : '')),
  }
}

export async function markPayslipNotified({ uid, employee, year, month }) {
  const storageUid = (employee ? await resolvePayslipUid(employee) : '') || uid
  if (!storageUid) return
  const id = payslipRecordId(year, month)
  await setDoc(
    doc(db, `payslips/${storageUid}/records`, id),
    {
      month: Number(month),
      year: Number(year),
      lastNotifiedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
