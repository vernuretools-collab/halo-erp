import { doc, getDoc, setDoc, updateDoc, serverTimestamp, deleteField } from 'firebase/firestore'
import { db } from './firebaseService'

export const ONBOARDING_STATUS = {
  PENDING_SIGNATURE: 'pending_signature',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

/**
 * Accounts created before admin-managed onboarding used 'pending_documents'.
 * They are read as 'pending_signature' so existing clients are not locked out.
 */
export const normalizeOnboardingStatus = (status) => {
  if (!status || status === 'pending_documents') return ONBOARDING_STATUS.PENDING_SIGNATURE
  return status
}

/**
 * House standard wording. Every client is seeded with a copy of these, which an
 * admin may then tailor per client before any signature is captured.
 */
export const DEFAULT_AGREEMENTS = [
  {
    id: 'msa',
    title: 'Master Services Agreement (MSA)',
    required: true,
    summary: 'Governing legal framework, deliverables warranty, liability limitations, and confidentiality terms.',
    content: `MASTER SERVICES AGREEMENT (MSA)
Effective Date: Upon Digital Signature
Parties: The Service Provider & The Client Entity

1. SCOPE & SERVICES
The Service Provider agrees to deliver professional services, technical consulting, and digital deliverables as specified in applicable Statements of Work (SOWs) executed under this Agreement.

2. INTELLECTUAL PROPERTY & OWNERSHIP
Upon receipt of full payment for each respective milestone, all custom deliverables, codebases, and assets created specifically for the Client shall become the exclusive property of the Client, excluding pre-existing frameworks and standard libraries.

3. CONFIDENTIALITY & DATA INTEGRITY
Both parties agree to hold in strict confidence all non-public information, system architectures, credentials, and business workflows shared during the duration of this engagement.

4. WARRANTIES & LIMITATION OF LIABILITY
Services are delivered in accordance with modern industry standards. Neither party shall be liable for indirect, incidental, or consequential damages arising from standard project execution.

5. TERMINATION
Either party may terminate an active engagement with thirty (30) days written notice, provided all outstanding billable milestones completed prior to termination are settled.`,
  },
  {
    id: 'nda',
    title: 'Mutual Non-Disclosure Agreement (NDA)',
    required: true,
    summary: 'Strict protection for trade secrets, proprietary algorithms, API keys, and customer data.',
    content: `MUTUAL NON-DISCLOSURE AGREEMENT (NDA)

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" refers to any proprietary data, customer lists, architectural diagrams, technical source code, business plans, and financial terms disclosed by either party.

2. OBLIGATIONS OF RECEIVING PARTY
The receiving party agrees to safeguard confidential materials with the same degree of care used for its own sensitive data (and no less than reasonable care), restricting access exclusively to personnel with a strict need-to-know.

3. DURATION & RETURN OF DATA
This obligation survives for a period of three (3) years from disclosure. Upon project completion or termination, all client data and credentials will be purged or securely returned.`,
  },
  {
    id: 'sow',
    title: 'Statement of Work & Deliverable Terms (SOW)',
    required: true,
    summary: 'Standardized deliverable sign-off terms, revision policies, and payment milestone commitments.',
    content: `STATEMENT OF WORK (SOW) & ACCEPTANCE TERMS

1. DELIVERABLE ACCEPTANCE CRITERIA
Each deliverable milestone deployed to staging shall have an inspection period of ten (10) business days for client review, QA validation, and formal sign-off.

2. PAYMENT & INVOICING SCHEDULE
Invoices issued through the Client Portal are payable within fourteen (14) days. Deliverable releases and production deployments are tied to completed milestone settlements.

3. CHANGE REQUEST MANAGEMENT
Any scope modifications outside approved milestone specifications shall be documented in a mutual Change Order before development commences.`,
  },
]

/**
 * Merge the house standard wording with any per-client wording an admin has saved.
 * Always returns all three agreements in a fixed order.
 */
export const resolveAgreements = (agreementTexts) => {
  return DEFAULT_AGREEMENTS.map((base) => {
    const custom = agreementTexts?.[base.id]
    if (!custom) return { ...base, customized: false }
    return {
      ...base,
      title: custom.title || base.title,
      summary: custom.summary || base.summary,
      content: custom.content || base.content,
      customized: Boolean(custom.content && custom.content !== base.content),
    }
  })
}

/**
 * Build the seed set of agreement texts written when an admin creates a client.
 */
export const buildDefaultAgreementTexts = () => {
  const texts = {}
  for (const base of DEFAULT_AGREEMENTS) {
    texts[base.id] = { title: base.title, summary: base.summary, content: base.content }
  }
  return texts
}

/**
 * Fetch client onboarding document from Firestore /clientOnboarding/{uid} or /users/{uid}
 */
export const getClientOnboardingDoc = async (uid) => {
  if (!uid) return null
  try {
    const onboardingRef = doc(db, 'clientOnboarding', uid)
    const snap = await getDoc(onboardingRef)
    if (snap.exists()) {
      const data = snap.data()
      return { ...data, onboardingStatus: normalizeOnboardingStatus(data.onboardingStatus) }
    }

    // Fallback: check users collection
    const userRef = doc(db, 'users', uid)
    const userSnap = await getDoc(userRef)
    if (userSnap.exists()) {
      const uData = userSnap.data()
      return {
        uid,
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
    console.warn('Could not fetch client onboarding doc (mock/offline fallback):', err.message)
  }

  // Local storage fallback for offline/demo testing
  try {
    const localSaved = localStorage.getItem(`onboarding_${uid}`)
    if (localSaved) {
      const parsed = JSON.parse(localSaved)
      return { ...parsed, onboardingStatus: normalizeOnboardingStatus(parsed.onboardingStatus) }
    }
  } catch {
    // ignore
  }

  return {
    uid,
    onboardingStatus: ONBOARDING_STATUS.PENDING_SIGNATURE,
    agreements: {},
    agreementTexts: null,
    billingInfo: null,
  }
}

/**
 * Deeply clean object for Firestore, ensuring only valid JSON primitives and no DOM objects/undefined
 */
const deepCleanForFirestore = (obj) => {
  if (obj === null || obj === undefined) {
    return null
  }
  if (typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(deepCleanForFirestore)
  }

  const cleaned = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || typeof val === 'function') {
      continue
    }
    if (typeof val === 'object' && val !== null) {
      cleaned[key] = deepCleanForFirestore(val)
    } else {
      cleaned[key] = val
    }
  }
  return cleaned
}

/**
 * Sanitize a single signature record to guaranteed primitives before persistence.
 * The exact contract text signed is stored alongside each signature so the
 * executed copy survives any later template change.
 */
export const sanitizeAgreementRecord = (agVal) => {
  if (!agVal || typeof agVal !== 'object') return null
  return {
    signed: Boolean(agVal.signed),
    signatoryName: String(agVal.signatoryName || ''),
    signatoryTitle: String(agVal.signatoryTitle || ''),
    mode: String(agVal.mode || 'draw'),
    signatureDataUrl: String(agVal.signatureDataUrl || ''),
    signedAt: String(agVal.signedAt || new Date().toISOString()),
    timestampFormatted: String(agVal.timestampFormatted || new Date().toLocaleString()),
    signedTitle: String(agVal.signedTitle || ''),
    signedContent: String(agVal.signedContent || ''),
  }
}

export const sanitizeAgreements = (agreements) => {
  const sanitized = {}
  if (!agreements || typeof agreements !== 'object') return sanitized

  for (const [key, agVal] of Object.entries(agreements)) {
    const cleaned = sanitizeAgreementRecord(agVal)
    if (cleaned) sanitized[key] = cleaned
  }
  return sanitized
}

const patchLocalOnboardingAgreement = (uid, agreementId, sanitizedOrNull) => {
  try {
    const key = `onboarding_${uid}`
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : { uid }
    const agreements = { ...(parsed.agreements || {}) }
    if (!sanitizedOrNull) delete agreements[agreementId]
    else agreements[agreementId] = sanitizedOrNull

    const next = {
      ...parsed,
      uid,
      agreements,
      updatedAt: new Date().toISOString(),
    }

    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      const lightAgreements = {}
      for (const [k, v] of Object.entries(agreements)) {
        lightAgreements[k] = { ...v, signatureDataUrl: '', signedContent: '' }
      }
      localStorage.setItem(key, JSON.stringify({ ...next, agreements: lightAgreements }))
    }
  } catch (storageErr) {
    console.warn('LocalStorage notice (non-fatal):', storageErr.message)
  }
}

/**
 * Persist a single agreement Sign or Re-Sign immediately so refresh and admin
 * do not restore a stale signature.
 */
export const persistClientAgreement = async (uid, agreementId, record) => {
  if (!uid || !agreementId) throw new Error('Missing client or agreement reference.')

  const sanitized = record ? sanitizeAgreementRecord(record) : null
  const updates = {
    [`agreements.${agreementId}`]: sanitized ? deepCleanForFirestore(sanitized) : deleteField(),
    updatedAt: new Date().toISOString(),
  }

  try {
    const onboardingRef = doc(db, 'clientOnboarding', uid)
    try {
      await updateDoc(onboardingRef, updates)
    } catch {
      await setDoc(onboardingRef, { uid, ...updates }, { merge: true })
    }
  } catch (err) {
    console.warn('Could not persist agreement:', err.message)
    throw new Error(err.message || 'Could not save the signature.')
  }

  patchLocalOnboardingAgreement(uid, agreementId, sanitized)
  return sanitized
}

/**
 * Submit the signed agreements for admin approval.
 * Company and billing details are set by the admin at account creation and are
 * intentionally not writable from here.
 */
export const submitClientOnboarding = async (uid, data) => {
  const submissionRecord = {
    uid: String(uid),
    agreements: sanitizeAgreements(data?.agreements),
    onboardingStatus: ONBOARDING_STATUS.PENDING_APPROVAL,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const firestoreCleanedRecord = deepCleanForFirestore(submissionRecord)

  try {
    const onboardingRef = doc(db, 'clientOnboarding', uid)
    await setDoc(onboardingRef, firestoreCleanedRecord, { merge: true })

    const userRef = doc(db, 'users', uid)
    await updateDoc(userRef, {
      onboardingStatus: ONBOARDING_STATUS.PENDING_APPROVAL,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('Firestore write notice:', err.message)
  }

  // Safe update to localStorage (guarded against QuotaExceededError)
  try {
    localStorage.setItem(`onboarding_status_${uid}`, ONBOARDING_STATUS.PENDING_APPROVAL)
    try {
      localStorage.setItem(`onboarding_${uid}`, JSON.stringify(firestoreCleanedRecord))
    } catch {
      // Signature images are the only large payload; drop them if the quota is hit
      const lightAgreements = {}
      for (const [k, v] of Object.entries(submissionRecord.agreements)) {
        lightAgreements[k] = { ...v, signatureDataUrl: '', signedContent: '' }
      }
      localStorage.setItem(
        `onboarding_${uid}`,
        JSON.stringify({ ...firestoreCleanedRecord, agreements: lightAgreements })
      )
    }
  } catch (storageErr) {
    console.warn('LocalStorage notice (non-fatal):', storageErr.message)
  }

  return submissionRecord
}
