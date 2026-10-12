export const JOINING_STEPS = [
  { id: 'personal', label: 'Personal' },
  { id: 'employment', label: 'Employment' },
  { id: 'bank', label: 'Bank' },
  { id: 'kyc', label: 'KYC' },
  { id: 'emergency', label: 'Emergency' },
  { id: 'policies', label: 'Policies' },
  { id: 'signature', label: 'Sign' },
  { id: 'preview', label: 'Review' },
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
    id: 'employmentAgreement',
    title: 'Employment Agreement',
    text: 'I understand my designation, CTC, probation period, notice period (30 days during probation, 60 days post-confirmation), and reporting structure.',
    brief: [],
  },
  {
    id: 'nda',
    title: 'NDA & Confidentiality',
    text: 'I understand that all client information, company data, pricing, and internal processes are strictly confidential, indefinitely and permanently, including after my employment ends.',
    brief: [
      'Confidential information includes client names, briefs, campaign data, pricing, financials, processes, and prospect pipeline.',
      'You may use it only to do your job, and you must not share it with anyone without written consent.',
      'These duties do not end when you leave. They continue with no time limit.',
      'You may say only that you worked at The Halo Effect Consulting LLP, in your role, from your joining date.',
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio Restriction',
    text: 'I understand I cannot display, share, or reference any client work in my personal portfolio, social media, or CV — permanently, even after leaving the company.',
    brief: [
      'You must not put client logos, screenshots, results, or case studies on a portfolio, social media, Behance, Dribbble, LinkedIn, or a CV.',
      'You must not mention client names in public, in interviews, or in job applications.',
      'This restriction is permanent because the work belongs to the client.',
    ],
  },
  {
    id: 'conflict',
    title: 'Conflict of interest',
    text: 'I will not share prospect pricing, client data, or pipeline information with any person including family members. I will disclose any conflict of interest immediately in writing.',
    brief: [
      'Tell the Company in writing if a family member, relative, or close associate works in digital marketing, web, SEO, sales, or a related field.',
      'Update that disclosure whenever it changes.',
      'Prospect pricing, client commercial terms, and pipeline data must not be shared with anyone, including family.',
      'Hiding a conflict, or sharing that information, is gross misconduct and can end employment immediately.',
    ],
  },
  {
    id: 'leave',
    title: 'Leave & Attendance',
    text: 'I understand the leave policy (1 CL + 1 SL + 1 WFH per month), attendance requirements (Mon–Sat, 9:30–6:30), and that I must submit daily scrum updates and EOD reports on the THEC Employee Portal.',
    brief: [
      'Casual leave: 1 day a month. Sick leave: 1 day a month. Work from home: 1 day a month, requested on the portal 3 days ahead.',
      'Unused casual leave becomes earned leave. Leave starts from the sixth month, not from the joining date.',
      'Working days are Monday to Saturday, 9:30 AM – 6:30 PM. Lunch is 1:00 PM – 1:45 PM. Grace is 15 minutes.',
      'Mark attendance daily. Scrum is due by 10:00 AM and the EOD report by 6:30 PM. Missing these is a disciplinary matter.',
      'Loss of pay is monthly CTC ÷ 26 for each unpaid day. More than 3 loss-of-pay days in a month leads to a review.',
    ],
  },
  {
    id: 'posh',
    title: 'POSH Policy',
    text: 'I have read and understood the Prevention of Sexual Harassment (POSH) Policy and commit to maintaining a harassment-free workplace. I am aware of the ICC process.',
    brief: [
      'Sexual harassment is not allowed, in the office, at client sites, at events, or on digital channels. This applies to every employee, including remote staff.',
      'It covers unwelcome physical, verbal, or non-verbal conduct of a sexual nature.',
      'Report what you see or experience to the Internal Complaints Committee. A written complaint is due within 3 months. The inquiry is completed within 60 days.',
      'Proceedings stay confidential. Retaliation is misconduct. A knowingly false complaint is also misconduct.',
      'A proven case can lead to termination and may be reported to law enforcement.',
    ],
  },
  {
    id: 'technology',
    title: 'Technology & Security',
    text: 'I will not input client data into public AI tools, will use 2FA on all company accounts, and will not share client information via personal email or cloud accounts.',
    brief: [
      'Company devices and accounts are for work only. Do not share logins, and use a unique password of at least 12 characters.',
      'Turn on two-factor authentication for every Company account, including on a personal device.',
      'Do not store client data on a personal device, personal email, or personal cloud, and do not forward client mail to a personal account.',
      'AI tools may be used for research and drafts. Do not type client names or client data into a public AI tool, and review any AI output before it goes to a client.',
      'Report phishing at once. Report a lost or stolen Company device within 1 hour.',
    ],
  },
  {
    id: 'ip',
    title: 'IP & Work Product',
    text: 'I understand all work I create during my employment belongs to the Company or its clients. I waive moral rights over all work product.',
    brief: [
      'Creatives, code, copy, strategies, and other deliverables made for the Company or its clients belong to the Company or the client.',
      'This includes work done outside office hours when it relates to the Company’s business or clients.',
      'You waive moral rights in that work to the extent Indian law allows.',
      'Any work you already owned before joining must be declared in writing. If you do not declare it and use it in Company work, it is treated as assigned to the Company.',
    ],
  },
  {
    id: 'documentPack',
    title: '',
    text: 'I confirm I have read the full onboarding document pack provided to me — including all 3 documents (Employment Agreement, Legal Agreements & HR Records, Employee Handbook) — and agree to be bound by all terms therein.',
    brief: [
      'Document 1, Employment Agreement Pack: offer letter, appointment agreement, job description, and probation terms.',
      'Document 2, Legal Agreements & HR Records: NDA, confidentiality, data protection, IP, conflict of interest, KYC, bank details, and emergency contact.',
      'Document 3, Employee Handbook: leave, attendance, POSH, IT and AI security, KRA and KPI, the 30/60/90-day plan, and disciplinary rules.',
    ],
  },
]

export function policyBrief(item, employment = {}) {
  if (item.id !== 'employmentAgreement') return item.brief || []
  const role = [employment.designation, employment.department].filter(Boolean).join(' in ') || 'the role in your offer'
  const manager = employment.reportingManager || 'your reporting manager'
  const joining = employment.dateOfJoining || 'your joining date'
  const mode = employment.workMode || 'the work mode set by HR'
  const probation = employment.probationPeriod || 'the period in your offer'
  return [
    `You are appointed as ${role}, reporting to ${manager}, from ${joining}. Work mode: ${mode}.`,
    `Probation is ${probation}. Notice is 30 days during probation and 60 days after confirmation. Confirmation is the Company’s decision.`,
    'Hours are Monday to Saturday, 9:30 AM – 6:30 PM. Daily attendance, scrum, and EOD reports on the THEC portal are required.',
    'For 18 months after you leave, do not solicit Company clients you dealt with. For 12 months, do not recruit Company employees.',
  ]
}

export function policyLabel(item) {
  return item.title ? `${item.title} — ${item.text}` : item.text
}

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
