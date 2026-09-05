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
    shortName: 'MSA',
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
    shortName: 'NDA',
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
    shortName: 'SOW',
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
