import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebaseService'

export const DEFAULT_PAYMENT_DETAILS = {
  bankName: 'HDFC Commercial Bank',
  accountName: 'NEXT-GEN CRM CORP',
  accountNumber: '50200084920192',
  ifsc: 'HDFC0001892',
  swift: '',
  upi: '',
  branch: '',
  notes: 'Please include the invoice number in the transfer reference.',
}

const paymentDocRef = () => doc(db, 'companySettings', 'paymentDetails')

export const getPaymentDetails = async () => {
  try {
    const snap = await getDoc(paymentDocRef())
    if (snap.exists()) {
      return { ...DEFAULT_PAYMENT_DETAILS, ...snap.data() }
    }
  } catch (err) {
    console.warn('Could not load company payment details:', err.message)
  }
  return { ...DEFAULT_PAYMENT_DETAILS }
}

export const savePaymentDetails = async (payload = {}) => {
  const next = {
    bankName: String(payload.bankName || '').trim(),
    accountName: String(payload.accountName || '').trim(),
    accountNumber: String(payload.accountNumber || '').trim(),
    ifsc: String(payload.ifsc || '').trim(),
    swift: String(payload.swift || '').trim(),
    upi: String(payload.upi || '').trim(),
    branch: String(payload.branch || '').trim(),
    notes: String(payload.notes || '').trim(),
    updatedAt: new Date().toISOString(),
  }
  await setDoc(paymentDocRef(), next, { merge: true })
  return next
}
