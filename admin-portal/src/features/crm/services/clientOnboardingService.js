import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import { normalizeOnboardingStatus } from '../../../shared/services/contractTemplates'

/**
 * Fetch onboarding details (signatures, contract wording, billing) for a specific client
 */
export const getClientOnboardingAdmin = async (clientId) => {
  if (!clientId) return null

  try {
    const onboardingRef = doc(db, 'clientOnboarding', clientId)
    const snap = await getDoc(onboardingRef)
    if (snap.exists()) {
      const data = snap.data()
      return { ...data, onboardingStatus: normalizeOnboardingStatus(data.onboardingStatus) }
    }

    // Check fallback in users doc
    const userRef = doc(db, 'users', clientId)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const uData = userSnap.data()
      return {
        uid: clientId,
        email: uData.email,
        companyName: uData.companyName || '',
        displayName: uData.displayName || '',
        onboardingStatus: normalizeOnboardingStatus(uData.onboardingStatus),
        rejectionReason: uData.rejectionReason || null,
        agreements: uData.agreements || {},
        agreementTexts: uData.agreementTexts || null,
        billingInfo: uData.billingInfo || null,
        skipAgreements: Boolean(uData.skipAgreements),
      }
    }
  } catch (err) {
    console.warn('Error fetching onboarding doc in admin:', err.message)
  }

  // Local storage fallback for dev/demo sync
  try {
    const localData = localStorage.getItem(`onboarding_${clientId}`)
    if (localData) {
      const parsed = JSON.parse(localData)
      return { ...parsed, onboardingStatus: normalizeOnboardingStatus(parsed.onboardingStatus) }
    }
  } catch {
    // ignore
  }

  return null
}

/**
 * Save admin-tailored wording for a single agreement on one client.
 * Signed agreements are rejected so an executed contract can never be altered.
 */
export const updateClientAgreementText = async (clientId, agreementId, { title, summary, content }, existingAgreements = {}) => {
  if (!clientId || !agreementId) throw new Error('Missing client or agreement reference.')
  if (existingAgreements?.[agreementId]?.signed) {
    throw new Error('This agreement has already been signed and can no longer be edited.')
  }
  if (!content || !content.trim()) {
    throw new Error('Contract text cannot be empty.')
  }

  const updates = {
    [`agreementTexts.${agreementId}`]: {
      title: String(title || '').trim(),
      summary: String(summary || '').trim(),
      content: String(content),
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  }

  try {
    const onboardingRef = doc(db, 'clientOnboarding', clientId)
    await updateDoc(onboardingRef, updates)
  } catch (err) {
    // The record may not exist yet for clients created before this feature
    try {
      const onboardingRef = doc(db, 'clientOnboarding', clientId)
      await setDoc(
        onboardingRef,
        {
          uid: clientId,
          agreementTexts: {
            [agreementId]: {
              title: String(title || '').trim(),
              summary: String(summary || '').trim(),
              content: String(content),
              updatedAt: new Date().toISOString(),
            },
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    } catch (innerErr) {
      console.warn('Error saving agreement text:', innerErr.message)
      throw innerErr
    }
  }

  return true
}

/**
 * Approve client onboarding submission, granting full workspace access
 */
export const approveClientOnboarding = async (clientId, adminUid = 'admin') => {
  const updates = {
    onboardingStatus: 'approved',
    status: 'active',
    approvedAt: new Date().toISOString(),
    approvedBy: adminUid,
    rejectionReason: null,
    updatedAt: new Date().toISOString(),
  }

  try {
    const onboardingRef = doc(db, 'clientOnboarding', clientId)
    await setDoc(onboardingRef, updates, { merge: true })

    const userRef = doc(db, 'users', clientId)
    await updateDoc(userRef, {
      onboardingStatus: 'approved',
      status: 'active',
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('Error approving client onboarding (offline fallback):', err.message)
  }

  // Safe update localStorage for seamless demo verification
  try {
    localStorage.setItem(`onboarding_status_${clientId}`, 'approved')
    const localData = localStorage.getItem(`onboarding_${clientId}`)
    if (localData) {
      const parsed = JSON.parse(localData)
      localStorage.setItem(
        `onboarding_${clientId}`,
        JSON.stringify({ ...parsed, ...updates })
      )
    }
  } catch {
    // ignore
  }

  return true
}

/**
 * Request re-submission with feedback notes from compliance admin
 */
export const rejectClientOnboarding = async (clientId, rejectionReason, adminUid = 'admin') => {
  const updates = {
    onboardingStatus: 'rejected',
    rejectionReason: rejectionReason || 'Please review and re-sign the agreements.',
    rejectedAt: new Date().toISOString(),
    rejectedBy: adminUid,
    updatedAt: new Date().toISOString(),
    agreements: {},
  }

  try {
    const onboardingRef = doc(db, 'clientOnboarding', clientId)
    await setDoc(onboardingRef, updates, { merge: true })

    const userRef = doc(db, 'users', clientId)
    await updateDoc(userRef, {
      onboardingStatus: 'rejected',
      rejectionReason: updates.rejectionReason,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('Error rejecting client onboarding (offline fallback):', err.message)
  }

  try {
    localStorage.setItem(`onboarding_status_${clientId}`, 'rejected')
    const localData = localStorage.getItem(`onboarding_${clientId}`)
    if (localData) {
      const parsed = JSON.parse(localData)
      localStorage.setItem(
        `onboarding_${clientId}`,
        JSON.stringify({ ...parsed, ...updates })
      )
    }
  } catch {
    // ignore
  }

  return true
}

const ALL_AGREEMENT_IDS = ['msa', 'nda', 'sow']

const hasAllAgreementsSigned = (agreements = {}) =>
  ALL_AGREEMENT_IDS.every((id) => Boolean(agreements?.[id]?.signed))

const persistOnboardingLocal = (clientId, updates) => {
  try {
    if (updates.onboardingStatus) {
      localStorage.setItem(`onboarding_status_${clientId}`, updates.onboardingStatus)
    }
    const localData = localStorage.getItem(`onboarding_${clientId}`)
    if (localData) {
      const parsed = JSON.parse(localData)
      localStorage.setItem(`onboarding_${clientId}`, JSON.stringify({ ...parsed, ...updates }))
    }
  } catch {
    // ignore
  }
}

/**
 * Admin override: skip MSA/NDA/SOW signing and unlock portal access,
 * or restore the signature requirement if the waiver is turned off.
 */
export const setClientAgreementsWaiver = async (clientId, skipAgreements, adminUid = 'admin', existingAgreements = {}) => {
  if (!clientId) throw new Error('Missing client id.')

  const now = new Date().toISOString()
  let updates

  if (skipAgreements) {
    updates = {
      skipAgreements: true,
      onboardingStatus: 'approved',
      status: 'active',
      agreementsWaivedAt: now,
      agreementsWaivedBy: adminUid,
      rejectionReason: null,
      updatedAt: now,
    }
  } else {
    const keepApproved = hasAllAgreementsSigned(existingAgreements)
    updates = {
      skipAgreements: false,
      onboardingStatus: keepApproved ? 'approved' : 'pending_signature',
      updatedAt: now,
    }
  }

  try {
    const onboardingRef = doc(db, 'clientOnboarding', clientId)
    await setDoc(onboardingRef, { uid: clientId, ...updates }, { merge: true })

    const userRef = doc(db, 'users', clientId)
    await setDoc(
      userRef,
      {
        skipAgreements: updates.skipAgreements,
        onboardingStatus: updates.onboardingStatus,
        ...(skipAgreements ? { status: 'active' } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch (err) {
    console.warn('Error saving agreements waiver (offline fallback):', err.message)
  }

  persistOnboardingLocal(clientId, updates)
  return updates
}

/**
 * Update GST, address and billing profile on the client's onboarding record.
 */
export const updateClientBillingProfile = async (clientId, payload = {}) => {
  if (!clientId) throw new Error('Missing client id.')

  const {
    companyName = '',
    signatoryTitle = '',
    billingEmail = '',
    billingAddress = '',
    taxId = '',
    paymentMethod = 'ach',
    signerPhone = '',
  } = payload

  const updates = {
    companyName,
    signatoryTitle,
    billingInfo: {
      billingEmail,
      billingAddress,
      taxId,
      paymentMethod,
      signerPhone,
    },
    updatedAt: new Date().toISOString(),
  }

  const onboardingRef = doc(db, 'clientOnboarding', clientId)
  await setDoc(onboardingRef, { uid: clientId, ...updates }, { merge: true })

  try {
    const userRef = doc(db, 'users', clientId)
    await updateDoc(userRef, {
      companyName,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Could not sync company name to users doc:', err.message)
  }

  return true
}
