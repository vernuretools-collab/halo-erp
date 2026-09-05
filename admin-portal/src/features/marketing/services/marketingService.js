import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const CAMPAIGNS_CACHE_KEY = 'marketing_campaigns_cache'
const CONTENT_CACHE_KEY = 'marketing_content_cache'

export const DEFAULT_CAMPAIGNS = []
export const DEFAULT_CONTENT_ITEMS = []

const getCollRef = (orgId, collName) => {
  return orgId ? collection(db, `organizations/${orgId}/${collName}`) : collection(db, collName)
}

const getDocRef = (orgId, collName, id) => {
  return orgId ? doc(db, `organizations/${orgId}/${collName}`, id) : doc(db, collName, id)
}

/**
 * Fetch all marketing campaigns from Firestore (with localStorage fallback)
 */
export const getCampaigns = async (orgId) => {
  try {
    const snap = await getDocs(getCollRef(orgId, 'campaigns'))
    const remoteDocs = snap.docs.map((d) => ({ campaignId: d.id, ...d.data() }))
    
    if (remoteDocs.length > 0) {
      localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify(remoteDocs))
      return remoteDocs
    }

    const cached = localStorage.getItem(CAMPAIGNS_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed
    }

    return []
  } catch (err) {
    console.error('Error fetching campaigns from Firestore:', err)
    const cached = localStorage.getItem(CAMPAIGNS_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed
    }
    return []
  }
}

/**
 * Create a marketing campaign document in Firestore
 */
export const createCampaign = async (campaignData, orgId) => {
  let createdItem = { campaignId: `camp_${Date.now()}`, ...campaignData }
  
  try {
    const docRef = await addDoc(getCollRef(orgId, 'campaigns'), {
      ...campaignData,
      createdAt: new Date().toISOString(),
    })
    createdItem = { campaignId: docRef.id, ...campaignData }
  } catch (err) {
    console.error('Error creating campaign in Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CAMPAIGNS_CACHE_KEY)
    const existing = cached ? JSON.parse(cached) : []
    const updated = [createdItem, ...existing.filter((c) => c.campaignId !== createdItem.campaignId)]
    localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify(updated))
  } catch (cacheErr) {
    console.error('Error saving campaign to local cache:', cacheErr)
  }

  return createdItem
}

/**
 * Update a marketing campaign document in Firestore
 */
export const updateCampaignInDb = async (campaignId, updateData, orgId) => {
  try {
    if (!campaignId) return
    await updateDoc(getDocRef(orgId, 'campaigns', campaignId), {
      ...updateData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating campaign in Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CAMPAIGNS_CACHE_KEY)
    if (cached) {
      const existing = JSON.parse(cached)
      const updated = existing.map((c) => (c.campaignId === campaignId ? { ...c, ...updateData } : c))
      localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify(updated))
    }
  } catch (cacheErr) {
    console.error('Error updating cache on campaign update:', cacheErr)
  }
}

/**
 * Delete a marketing campaign document from Firestore
 */
export const deleteCampaignFromDb = async (campaignId, orgId) => {
  try {
    if (!campaignId) return
    await deleteDoc(getDocRef(orgId, 'campaigns', campaignId))
  } catch (err) {
    console.error('Error deleting campaign from Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CAMPAIGNS_CACHE_KEY)
    if (cached) {
      const existing = JSON.parse(cached)
      const updated = existing.filter((c) => c.campaignId !== campaignId)
      localStorage.setItem(CAMPAIGNS_CACHE_KEY, JSON.stringify(updated))
    }
  } catch (cacheErr) {
    console.error('Error updating cache on campaign delete:', cacheErr)
  }
}

/**
 * Fetch all content items from Firestore (with localStorage fallback)
 */
export const getContentItems = async (orgId) => {
  try {
    const snap = await getDocs(getCollRef(orgId, 'marketing_content'))
    const remoteDocs = snap.docs.map((d) => ({ contentId: d.id, ...d.data() }))
    
    if (remoteDocs.length > 0) {
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(remoteDocs))
      return remoteDocs
    }
    
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed
    }

    return []
  } catch (err) {
    console.error('Error fetching content items from Firestore:', err)
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed)) return parsed
    }
    return []
  }
}

/**
 * Create a content item document in Firestore
 */
export const createContentItem = async (itemData, orgId) => {
  let createdItem = { contentId: `cnt_${Date.now()}`, ...itemData }

  try {
    const docRef = await addDoc(getCollRef(orgId, 'marketing_content'), {
      ...itemData,
      createdAt: new Date().toISOString(),
    })
    createdItem = { contentId: docRef.id, ...itemData }
  } catch (err) {
    console.error('Error creating content item in Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    const existing = cached ? JSON.parse(cached) : []
    const updated = [createdItem, ...existing.filter((i) => i.contentId !== createdItem.contentId)]
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(updated))
  } catch (cacheErr) {
    console.error('Error saving content item to local cache:', cacheErr)
  }

  return createdItem
}

/**
 * Update a content item document in Firestore
 */
export const updateContentItemInDb = async (contentId, updateData, orgId) => {
  try {
    if (!contentId) return
    await updateDoc(getDocRef(orgId, 'marketing_content', contentId), {
      ...updateData,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating content item in Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    if (cached) {
      const existing = JSON.parse(cached)
      const updated = existing.map((i) => (i.contentId === contentId ? { ...i, ...updateData } : i))
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(updated))
    }
  } catch (cacheErr) {
    console.error('Error updating cache on content item update:', cacheErr)
  }
}

/**
 * Delete a content item document from Firestore
 */
export const deleteContentItemFromDb = async (contentId, orgId) => {
  try {
    if (!contentId) return
    await deleteDoc(getDocRef(orgId, 'marketing_content', contentId))
  } catch (err) {
    console.error('Error deleting content item from Firestore:', err)
  }

  try {
    const cached = localStorage.getItem(CONTENT_CACHE_KEY)
    if (cached) {
      const existing = JSON.parse(cached)
      const updated = existing.filter((i) => i.contentId !== contentId)
      localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(updated))
    }
  } catch (cacheErr) {
    console.error('Error updating cache on content delete:', cacheErr)
  }
}
