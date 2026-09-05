import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

/**
 * Fetch all Knowledge Base articles from Firestore (primary: knowledgeArticles, fallback: knowledge)
 */
export const getArticles = async () => {
  try {
    const primarySnap = await getDocs(collection(db, 'knowledgeArticles'))
    const primaryDocs = primarySnap.docs.map((d) => {
      const data = d.data()
      return {
        articleId: d.id,
        id: d.id,
        ...data,
        updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
      }
    })

    let fallbackDocs = []
    try {
      const fallbackSnap = await getDocs(collection(db, 'knowledge'))
      fallbackDocs = fallbackSnap.docs.map((d) => {
        const data = d.data()
        return {
          articleId: d.id,
          id: d.id,
          ...data,
          updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
        }
      })
    } catch (e) {
      // Ignore if fallback collection does not exist
    }

    const map = new Map()
    primaryDocs.forEach((item) => map.set(item.id, item))
    fallbackDocs.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item)
      }
    })

    const allArticles = Array.from(map.values())
    allArticles.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
    return allArticles
  } catch (err) {
    console.error('Error fetching articles from Firestore:', err)
    return []
  }
}

/**
 * Create a new Knowledge Base article in Firestore
 */
export const createArticle = async (articleData) => {
  try {
    const payload = {
      title: articleData.title || '',
      category: articleData.category || 'General SOP',
      summary: articleData.summary || articleData.content?.substring(0, 150) || '',
      content: articleData.content || '',
      author: articleData.author || 'Admin',
      createdByRole: articleData.createdByRole || 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const docRef = await addDoc(collection(db, 'knowledgeArticles'), payload)
    return { articleId: docRef.id, id: docRef.id, ...payload }
  } catch (err) {
    console.error('Error creating article in Firestore:', err)
    const fallbackId = `art_${Date.now()}`
    return {
      articleId: fallbackId,
      id: fallbackId,
      ...articleData,
      author: articleData.author || 'Admin',
      createdByRole: articleData.createdByRole || 'Admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
}

/**
 * Delete an article from Firestore
 */
export const deleteArticleFromDb = async (articleId) => {
  try {
    if (!articleId) return
    await deleteDoc(doc(db, 'knowledgeArticles', articleId)).catch(() => {})
    await deleteDoc(doc(db, 'knowledge', articleId)).catch(() => {})
  } catch (err) {
    console.error('Error deleting article from Firestore:', err)
  }
}

