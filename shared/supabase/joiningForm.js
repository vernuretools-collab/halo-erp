export const JOINING_STEPS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'bank', label: 'Bank' },
  { id: 'kyc', label: 'KYC' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'policies', label: 'Policies' },
  { id: 'signature', label: 'Sign' },
]

export const GENDER_OPTIONS = ['Male', 'Female', 'Other']
export const MARITAL_OPTIONS = ['Single', 'Married', 'Other']
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
export const YES_NO = ['Yes', 'No']
export const ACCOUNT_TYPES = ['Savings', 'Current']

export const KYC_DOCUMENTS = [
  'Aadhaar card (original)',
  'PAN card (original)',
  'Passport-size photographs',
  'Educational certificates',
  'Previous employment relieving letter',
  'Bank passbook or cancelled cheque',
]

export const POLICY_ITEMS = [
  {
    id: 'confidentiality',
    text: 'I will keep client names, commercial terms, campaign data, and Company information confidential, including after I leave.',
  },
  {
    id: 'ip',
    text: 'Work I create for the Company or its clients belongs to the Company or the client, and I will not use it in a personal portfolio without written consent.',
  },
  {
    id: 'conflict',
    text: 'I will disclose in writing if a family member or close associate works in digital marketing, web, SEO, sales, or a related field, and I will update that disclosure if it changes.',
  },
  {
    id: 'conduct',
    text: 'I will follow the Company’s attendance, portal, POSH, IT security, and communication policies in the document pack.',
  },
]

const EMPTY_ANSWERS = {
  personal: {
    fullName: '',
    dateOfBirth: '',
    gender: '',
    nationality: 'Indian',
    aadhaar: '',
    pan: '',
    mobile: '',
    email: '',
    permanentAddress: '',
    currentAddress: '',
    fatherName: '',
    motherName: '',
    maritalStatus: '',
    bloodGroup: '',
  },
  employment: {
    conflictOfInterest: '',
  },
  bank: {
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    branchCity: '',
    accountType: 'Savings',
    uan: '',
  },
  kyc: {
    qualification: '',
    institutionYear: '',
    lastEmployer: '',
    lastDesignation: '',
    documents: [],
    obligations: '',
  },
  emergency: {
    primaryName: '',
    primaryRelationship: '',
    primaryMobile: '',
    address: '',
    secondaryName: '',
    secondaryRelationship: '',
    secondaryMobile: '',
    allergies: '',
  },
  policies: {},
  signature: '',
}

function fill(base, incoming) {
  const next = { ...base }
  if (!incoming || typeof incoming !== 'object') return next
  for (const key of Object.keys(base)) {
    if (incoming[key] != null && incoming[key] !== '') next[key] = incoming[key]
  }
  return next
}

export function mergeJoiningAnswers(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    personal: fill(EMPTY_ANSWERS.personal, source.personal),
    employment: fill(EMPTY_ANSWERS.employment, source.employment),
    bank: fill(EMPTY_ANSWERS.bank, source.bank),
    kyc: {
      ...fill(EMPTY_ANSWERS.kyc, source.kyc),
      documents: Array.isArray(source.kyc?.documents) ? source.kyc.documents.filter((name) => KYC_DOCUMENTS.includes(name)) : [],
    },
    emergency: fill(EMPTY_ANSWERS.emergency, source.emergency),
    policies: { ...(source.policies && typeof source.policies === 'object' ? source.policies : {}) },
    signature: typeof source.signature === 'string' ? source.signature : '',
  }
}

function required(value, label) {
  return String(value || '').trim() ? '' : `${label} is required.`
}

export function validateJoiningStep(stepId, rawAnswers) {
  const answers = mergeJoiningAnswers(rawAnswers)
  if (stepId === 'personal') {
    const personal = answers.personal
    return (
      required(personal.fullName, 'Full name')
      || required(personal.dateOfBirth, 'Date of birth')
      || required(personal.gender, 'Gender')
      || required(personal.aadhaar, 'Aadhaar number')
      || required(personal.pan, 'PAN number')
      || required(personal.mobile, 'Mobile number')
      || required(personal.email, 'Personal email')
      || required(personal.permanentAddress, 'Permanent address')
    )
  }
  if (stepId === 'employment') return required(answers.employment.conflictOfInterest, 'Conflict of interest disclosure')
  if (stepId === 'bank') {
    const bank = answers.bank
    return (
      required(bank.bankName, 'Bank name')
      || required(bank.accountHolder, 'Account holder name')
      || required(bank.accountNumber, 'Account number')
      || required(bank.ifsc, 'IFSC code')
      || required(bank.branchCity, 'Branch and city')
      || required(bank.accountType, 'Account type')
    )
  }
  if (stepId === 'kyc') {
    return answers.kyc.documents.length ? '' : 'Select the documents you will bring on joining day.'
  }
  if (stepId === 'emergency') {
    const emergency = answers.emergency
    return (
      required(emergency.primaryName, 'Primary contact name')
      || required(emergency.primaryRelationship, 'Relationship')
      || required(emergency.primaryMobile, 'Emergency mobile number')
    )
  }
  if (stepId === 'policies') {
    const missing = POLICY_ITEMS.find((item) => !answers.policies[item.id])
    return missing ? 'Acknowledge every policy before continuing.' : ''
  }
  if (stepId === 'signature') return required(answers.signature, 'Signature')
  return ''
}

export function declarationText(fullName) {
  const name = String(fullName || '').trim() || 'the undersigned'
  return `I, ${name}, declare that the details in this onboarding form are true and complete. I have read the policies in my document pack and I understand that incorrect information or a breach of those policies can lead to withdrawal of the offer or termination.`
}
