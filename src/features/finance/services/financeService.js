import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

/**
 * Fetch all invoices from Firestore
 */
export const getInvoices = async () => {
  try {
    const snap = await getDocs(collection(db, 'invoices'))
    return snap.docs.map((d) => ({ invoiceId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching invoices from Firestore:', err)
    return []
  }
}

/**
 * Create an invoice document in Firestore
 */
export const createInvoice = async (invoiceData) => {
  try {
    const newDocRef = doc(collection(db, 'invoices'))
    const invoiceId = newDocRef.id
    const payload = {
      ...invoiceData,
      invoiceId,
      id: invoiceId,
      createdAt: new Date().toISOString(),
    }
    await setDoc(newDocRef, payload)
    return payload
  } catch (err) {
    console.error('Error creating invoice in Firestore:', err)
    return { invoiceId: `inv_${Date.now()}`, ...invoiceData }
  }
}

/**
 * Update invoice status in Firestore
 */
export const updateInvoiceStatusInDb = async (invoiceId, status) => {
  try {
    if (!invoiceId) return
    await updateDoc(doc(db, 'invoices', invoiceId), {
      status,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating invoice status in Firestore:', err)
  }
}

/**
 * Delete an invoice from Firestore
 */
export const deleteInvoiceFromDb = async (invoiceId) => {
  try {
    if (!invoiceId) return
    try {
      await deleteDoc(doc(db, 'invoices', invoiceId))
    } catch (_) {}

    const q = query(collection(db, 'invoices'), where('invoiceId', '==', invoiceId))
    const snap = await getDocs(q)
    await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'invoices', d.id))))
  } catch (err) {
    console.error('Error deleting invoice from Firestore:', err)
  }
}

/**
 * Fetch expenses from Firestore
 */
export const getExpenses = async () => {
  try {
    const snap = await getDocs(collection(db, 'expenses'))
    return snap.docs.map((d) => ({ expenseId: d.id, id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching expenses from Firestore:', err)
    return []
  }
}

/**
 * Create an expense in Firestore
 */
export const createExpense = async (expenseData) => {
  try {
    const newDocRef = doc(collection(db, 'expenses'))
    const expenseId = newDocRef.id
    const payload = {
      ...expenseData,
      expenseId,
      id: expenseId,
      createdAt: new Date().toISOString(),
    }
    await setDoc(newDocRef, payload)
    return payload
  } catch (err) {
    console.error('Error creating expense in Firestore:', err)
    return { expenseId: `exp_${Date.now()}`, id: `exp_${Date.now()}`, ...expenseData }
  }
}

/**
 * Delete an expense from Firestore
 */
export const deleteExpenseFromDb = async (expenseId) => {
  try {
    if (!expenseId) return
    try {
      await deleteDoc(doc(db, 'expenses', expenseId))
    } catch (_) {}

    const q1 = query(collection(db, 'expenses'), where('expenseId', '==', expenseId))
    const snap1 = await getDocs(q1)
    await Promise.all(snap1.docs.map((d) => deleteDoc(doc(db, 'expenses', d.id))))

    const q2 = query(collection(db, 'expenses'), where('id', '==', expenseId))
    const snap2 = await getDocs(q2)
    await Promise.all(snap2.docs.map((d) => deleteDoc(doc(db, 'expenses', d.id))))
  } catch (err) {
    console.error('Error deleting expense from Firestore:', err)
  }
}

/**
 * Fetch all retainer profiles from Firestore
 */
export const getRetainersFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'retainers'))
    return snap.docs.map((d) => ({ retainerId: d.id, id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching retainers from Firestore:', err)
    return []
  }
}

/**
 * Create a retainer profile in Firestore
 */
export const createRetainerInDb = async (retainerData) => {
  try {
    const newDocRef = doc(collection(db, 'retainers'))
    const retainerId = newDocRef.id
    const payload = {
      ...retainerData,
      retainerId,
      id: retainerId,
      createdAt: new Date().toISOString(),
    }
    await setDoc(newDocRef, payload)
    return payload
  } catch (err) {
    console.error('Error creating retainer in Firestore:', err)
    return { retainerId: `ret_${Date.now()}`, id: `ret_${Date.now()}`, ...retainerData }
  }
}

/**
 * Update a retainer profile in Firestore
 */
export const updateRetainerInDb = async (retainerId, updates) => {
  try {
    if (!retainerId) return
    await updateDoc(doc(db, 'retainers', retainerId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating retainer in Firestore:', err)
  }
}

/**
 * Delete a retainer profile from Firestore
 */
export const deleteRetainerFromDb = async (retainerId) => {
  try {
    if (!retainerId) return
    try {
      await deleteDoc(doc(db, 'retainers', retainerId))
    } catch (_) {}

    const q1 = query(collection(db, 'retainers'), where('retainerId', '==', retainerId))
    const snap1 = await getDocs(q1)
    await Promise.all(snap1.docs.map((d) => deleteDoc(doc(db, 'retainers', d.id))))

    const q2 = query(collection(db, 'retainers'), where('id', '==', retainerId))
    const snap2 = await getDocs(q2)
    await Promise.all(snap2.docs.map((d) => deleteDoc(doc(db, 'retainers', d.id))))
  } catch (err) {
    console.error('Error deleting retainer from Firestore:', err)
  }
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Software & Infrastructure',
  'Office & Supplies',
  'Marketing & Ads',
  'Legal & Professional',
  'Travel & Meals',
]

/**
 * Fetch all custom expense categories from Firestore
 */
export const getExpenseCategoriesFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'expenseCategories'))
    const custom = snap.docs.map((d) => d.data().name).filter(Boolean)
    const merged = [...DEFAULT_EXPENSE_CATEGORIES]
    custom.forEach((c) => {
      if (!merged.includes(c)) merged.push(c)
    })
    return merged
  } catch (err) {
    console.error('Error fetching expense categories from Firestore:', err)
    return DEFAULT_EXPENSE_CATEGORIES
  }
}

/**
 * Create a custom expense category in Firestore
 */
export const createExpenseCategoryInDb = async (categoryName) => {
  try {
    if (!categoryName || !categoryName.trim()) return
    await addDoc(collection(db, 'expenseCategories'), {
      name: categoryName.trim(),
      createdAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error saving expense category to Firestore:', err)
  }
}
