import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '../supabase/client.js'
import {
  collectIdentityIds,
  conductorList,
  hasScrumNotes,
  isActiveEmployee,
  monthBounds,
  scrumDocId,
} from './scrumModel.js'

export const SCRUM_CONDUCTOR_DOC_ID = 'current'

function mapEmployee(snapshot) {
  const data = snapshot.data() || {}
  const name = String(data.displayName || data.name || data.email || 'Employee').trim() || 'Employee'
  const employee = {
    id: snapshot.id,
    name,
    email: String(data.email || '').trim(),
    status: data.status || 'active',
    uid: data.uid || '',
    authId: data.authId || data.auth_id || '',
    employeeId: data.employeeId || snapshot.id,
    identityIds: Array.isArray(data.identityIds) ? data.identityIds : [],
  }
  employee.identityIds = collectIdentityIds(employee)
  return employee
}

export async function listActiveEmployees() {
  const snap = await getDocs(collection(db, 'employees'))
  return snap.docs
    .map(mapEmployee)
    .filter(isActiveEmployee)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function listScrumForDate(dateISO) {
  const snap = await getDocs(query(collection(db, 'dailyScrums'), where('date', '==', dateISO)))
  const byEmployee = new Map()
  snap.docs.forEach((row) => {
    const data = row.data() || {}
    const employeeId = String(data.employeeId || '')
    if (!employeeId) return
    byEmployee.set(employeeId, {
      morningScrum: data.morningScrum || '',
      eodUpdate: data.eodUpdate || '',
    })
  })
  return byEmployee
}

export async function listMarkedScrumDays(year, monthIndex) {
  const { start, end } = monthBounds(year, monthIndex)
  const snap = await getDocs(
    query(collection(db, 'dailyScrums'), where('date', '>=', start), where('date', '<=', end)),
  )
  const marked = new Set()
  snap.docs.forEach((row) => {
    const data = row.data() || {}
    if (data.date && hasScrumNotes(data)) marked.add(String(data.date))
  })
  return marked
}

/**
 * Upsert this employee’s notes for one calendar day only.
 * Previous days are separate documents and are left untouched. Rows are never deleted.
 */
export async function saveEmployeeScrumDay({ employee, dateISO, morningScrum, eodUpdate }) {
  const morning = morningScrum ?? ''
  const eod = eodUpdate ?? ''
  const id = scrumDocId(employee.id, dateISO)
  await setDoc(
    doc(db, 'dailyScrums', id),
    {
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email || '',
      date: dateISO,
      morningScrum: morning,
      eodUpdate: eod,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function conductorFromData(data) {
  if (!data?.employeeId) return null
  return {
    employeeId: String(data.employeeId),
    employeeName: data.employeeName || '',
    employeeEmail: data.employeeEmail || '',
    email: data.employeeEmail || '',
    identityIds: Array.isArray(data.identityIds) ? data.identityIds.map(String) : [],
  }
}

function conductorPayload(employee) {
  return {
    employeeId: employee.id,
    employeeName: employee.name || '',
    employeeEmail: employee.email || '',
    identityIds: collectIdentityIds(employee),
  }
}

export async function getScrumConductor() {
  const snap = await getDoc(doc(db, 'scrumConductor', SCRUM_CONDUCTOR_DOC_ID))
  if (!snap.exists()) return null
  const data = snap.data() || {}
  const employees = conductorList(data).map((row) => conductorFromData(row)).filter(Boolean)
  if (!employees.length) return null
  return { ...employees[0], employees }
}

/** Replace the employees who can open Scrum. Daily notes are not touched. */
export async function saveScrumConductors(employees) {
  const list = (employees || []).filter(Boolean).map(conductorPayload)
  const first = list[0]
  const identityIds = [...new Set(list.flatMap((row) => row.identityIds))]
  await setDoc(
    doc(db, 'scrumConductor', SCRUM_CONDUCTOR_DOC_ID),
    {
      employeeId: first?.employeeId || '',
      employeeName: first?.employeeName || '',
      employeeEmail: first?.employeeEmail || '',
      identityIds,
      employees: list,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Replace the selected scrum employees with one person. Pass null to clear them. */
export async function saveScrumConductor(employee) {
  await saveScrumConductors(employee ? [employee] : [])
}
