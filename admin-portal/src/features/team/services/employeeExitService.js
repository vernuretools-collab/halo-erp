import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db, supabase } from '../../../shared/services/firebaseService'
import {
  EMPLOYMENT_STATUS,
  employeeDocId,
  employeeDisplayName,
} from '../../../../../shared/employees/employmentStatus.js'

function historyEntry(action, extra = {}) {
  return {
    action,
    at: new Date().toISOString(),
    ...extra,
  }
}

async function readEmployee(id) {
  if (!id) throw new Error('Employee record was not found')
  const snap = await getDoc(doc(db, 'employees', id))
  if (!snap.exists()) throw new Error('Employee record was not found')
  return { id: snap.id, ...(snap.data() || {}) }
}

async function patchEmployee(id, current, fields, entry) {
  const history = Array.isArray(current.exitHistory) ? current.exitHistory : []
  const patch = {
    ...fields,
    exitHistory: [...history, entry],
  }
  await updateDoc(doc(db, 'employees', id), patch)
  return patch
}

async function setEmployeeAccess(employee, access) {
  if (!supabase) throw new Error('Supabase is not configured')
  const authId = employee.auth_id || employee.authId || employee.uid || employee.id || ''
  const { data, error } = await supabase.functions.invoke('set-employee-access', {
    body: {
      authId,
      email: employee.email || '',
      access,
    },
  })
  if (!error && !data?.error) return data

  let detail = error?.message || data?.error || 'Could not update sign-in access'
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json()
      detail = payload?.error || payload?.message || detail
    }
  } catch {
    /* gateway response had no JSON body */
  }
  throw new Error(detail)
}

export async function markNoticePeriod(employee, markedBy) {
  const id = employeeDocId(employee)
  const current = await readEmployee(id)
  const patch = await patchEmployee(
    id,
    current,
    { status: EMPLOYMENT_STATUS.NOTICE_PERIOD },
    historyEntry('notice_period', { by: markedBy || '', status: EMPLOYMENT_STATUS.NOTICE_PERIOD }),
  )
  return { id, ...patch }
}

export async function clearNoticePeriod(employee, markedBy) {
  const id = employeeDocId(employee)
  const current = await readEmployee(id)
  const patch = await patchEmployee(
    id,
    current,
    { status: EMPLOYMENT_STATUS.ACTIVE },
    historyEntry('cleared_notice', {
      by: markedBy || '',
      status: EMPLOYMENT_STATUS.ACTIVE,
      previousStatus: current.status || EMPLOYMENT_STATUS.ACTIVE,
    }),
  )
  return { id, ...patch }
}

export async function markAsExEmployee(employee, { lastWorkingDay, exitReason, markedBy }) {
  const day = String(lastWorkingDay || '').slice(0, 10)
  const reason = String(exitReason || '').trim()
  if (!day) throw new Error('Relieving date is required')
  if (!reason) throw new Error('Exit reason is required')

  const id = employeeDocId(employee)
  const current = await readEmployee(id)
  const at = new Date().toISOString()
  const patch = await patchEmployee(
    id,
    current,
    {
      status: EMPLOYMENT_STATUS.RELIEVED,
      lastWorkingDay: day,
      exitReason: reason,
      relievedAt: at,
    },
    historyEntry('relieved', {
      by: markedBy || '',
      status: EMPLOYMENT_STATUS.RELIEVED,
      lastWorkingDay: day,
      exitReason: reason,
      at,
    }),
  )

  try {
    await setEmployeeAccess(current, 'blocked')
  } catch (err) {
    const error = new Error(
      `${employeeDisplayName(current)} is saved as Ex-Employee. Sign-in could not be blocked: ${err.message}`,
    )
    error.saved = true
    error.patch = { id, ...patch }
    throw error
  }
  return { id, ...patch }
}

export async function archiveEmployeeRecord(employee, markedBy) {
  const id = employeeDocId(employee)
  const current = await readEmployee(id)
  const at = new Date().toISOString()
  const patch = await patchEmployee(
    id,
    current,
    { status: EMPLOYMENT_STATUS.ARCHIVED, archivedAt: at },
    historyEntry('archived', {
      by: markedBy || '',
      status: EMPLOYMENT_STATUS.ARCHIVED,
      at,
      lastWorkingDay: current.lastWorkingDay || '',
      exitReason: current.exitReason || '',
    }),
  )
  try {
    await setEmployeeAccess(current, 'blocked')
  } catch (err) {
    const error = new Error(`Archived, but sign-in could not be blocked: ${err.message}`)
    error.saved = true
    error.patch = { id, ...patch }
    throw error
  }
  return { id, ...patch }
}

export async function returnEmployeeToActive(employee, markedBy) {
  const id = employeeDocId(employee)
  const current = await readEmployee(id)
  const patch = await patchEmployee(
    id,
    current,
    { status: EMPLOYMENT_STATUS.ACTIVE },
    historyEntry('returned_to_active', {
      by: markedBy || '',
      status: EMPLOYMENT_STATUS.ACTIVE,
      previousStatus: current.status || '',
      lastWorkingDay: current.lastWorkingDay || '',
      exitReason: current.exitReason || '',
    }),
  )
  try {
    await setEmployeeAccess(current, 'allowed')
  } catch (err) {
    const error = new Error(
      `${employeeDisplayName(current)} is active in the directory. Sign-in could not be restored: ${err.message}`,
    )
    error.saved = true
    error.patch = { id, ...patch }
    throw error
  }
  return { id, ...patch }
}
