import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

/**
 * Fetch all leads for an organization
 */
export const getLeads = async (orgId) => {
  if (!orgId || import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev') {
    return null // use store defaults
  }

  const leadsRef = collection(db, `organizations/${orgId}/leads`)
  const q = query(leadsRef, orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((docSnap) => ({ leadId: docSnap.id, ...docSnap.data() }))
}

/**
 * Create a new lead in Firestore
 */
export const createLead = async (orgId, leadData) => {
  if (import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev') {
    return { leadId: `lead_${Date.now()}`, ...leadData }
  }

  const leadsRef = collection(db, `organizations/${orgId}/leads`)
  const docRef = await addDoc(leadsRef, {
    ...leadData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return { leadId: docRef.id, ...leadData }
}

/**
 * Update lead pipeline stage
 */
export const updateLeadStageInDb = async (orgId, leadId, stageId, stageName) => {
  if (import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev') return

  const leadRef = doc(db, `organizations/${orgId}/leads`, leadId)
  await updateDoc(leadRef, {
    pipelineStageId: stageId,
    pipelineStage: stageName,
    updatedAt: serverTimestamp(),
  })
}

/**
 * Delete a lead
 */
export const deleteLeadFromDb = async (orgId, leadId) => {
  if (import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev') return

  const leadRef = doc(db, `organizations/${orgId}/leads`, leadId)
  await deleteDoc(leadRef)
}
