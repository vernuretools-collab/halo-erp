import { doc, getDoc } from 'firebase/firestore'
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

export const getPaymentDetails = async () => {
  try {
    const snap = await getDoc(doc(db, 'companySettings', 'paymentDetails'))
    if (snap.exists()) {
      return { ...DEFAULT_PAYMENT_DETAILS, ...snap.data() }
    }
  } catch (err) {
    console.warn('Could not load company payment details:', err.message)
  }
  return { ...DEFAULT_PAYMENT_DETAILS }
}
