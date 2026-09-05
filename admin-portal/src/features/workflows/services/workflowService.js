import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

// ─── Workflows ────────────────────────────────────────────────────────────────

/**
 * Fetch all workflow rules from Firestore
 */
export const getWorkflows = async () => {
  try {
    const q = query(collection(db, 'workflows'), orderBy('createdAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ workflowId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching workflows from Firestore:', err)
    return []
  }
}

/**
 * Create a new workflow rule in Firestore
 */
export const createWorkflow = async (workflowData) => {
  try {
    const payload = {
      ...workflowData,
      status: 'active',
      runCount: 0,
      lastRunAt: null,
      createdAt: new Date().toISOString(),
    }
    const docRef = await addDoc(collection(db, 'workflows'), payload)
    return { workflowId: docRef.id, ...payload }
  } catch (err) {
    console.error('Error creating workflow in Firestore:', err)
    return { workflowId: `wf_${Date.now()}`, ...workflowData, status: 'active', runCount: 0, lastRunAt: null }
  }
}

/**
 * Toggle the active/paused status of a workflow rule
 */
export const toggleWorkflowStatusInDb = async (workflowId, newStatus) => {
  try {
    if (!workflowId) return
    await updateDoc(doc(db, 'workflows', workflowId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error toggling workflow status in Firestore:', err)
  }
}

/**
 * Delete a workflow rule from Firestore
 */
export const deleteWorkflowFromDb = async (workflowId) => {
  try {
    if (!workflowId) return
    await deleteDoc(doc(db, 'workflows', workflowId))
  } catch (err) {
    console.error('Error deleting workflow from Firestore:', err)
  }
}

// ─── Workflow Run Logs ─────────────────────────────────────────────────────────

/**
 * Fetch all workflow execution run logs from Firestore
 */
export const getWorkflowRuns = async () => {
  try {
    const q = query(collection(db, 'workflowRuns'), orderBy('executedAt', 'desc'))
    const snap = await getDocs(q)
    return snap.docs.map((d) => ({ runId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching workflow runs from Firestore:', err)
    return []
  }
}

/**
 * Create a workflow run log entry in Firestore
 */
export const createWorkflowRun = async (runData) => {
  try {
    const payload = {
      ...runData,
      executedAt: new Date().toISOString(),
      status: 'success',
    }
    const docRef = await addDoc(collection(db, 'workflowRuns'), payload)
    return { runId: docRef.id, ...payload }
  } catch (err) {
    console.error('Error creating workflow run log in Firestore:', err)
    return null
  }
}

/**
 * Increment runCount and update lastRunAt for a workflow after execution
 */
export const incrementWorkflowRunCount = async (workflowId, runCount) => {
  try {
    if (!workflowId) return
    await updateDoc(doc(db, 'workflows', workflowId), {
      runCount: runCount + 1,
      lastRunAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error incrementing workflow run count in Firestore:', err)
  }
}
