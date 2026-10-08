/** Internal auth address for username-only joining accounts. Never shown in the UI. */
export const JOINING_AUTH_EMAIL_DOMAIN = 'joining.halo.local'

export const ONBOARDING_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
}

export const JOINING_ROLE = 'employee_onboarding'

export const WORK_MODES = ['Office', 'Hybrid', 'Remote']

export const PROBATION_PERIODS = ['3 months', '6 months']

export const CUSTOM_KRA_TARGET = 80

export const FIXED_KRAS = [
  {
    keyResultArea: 'THEC Portal Compliance',
    kpi: 'Daily submission rate at least 95%',
    weight: 10,
  },
  {
    keyResultArea: 'Client Satisfaction & Professional Conduct',
    kpi: 'No escalations; positive manager feedback',
    weight: 10,
  },
]

export function isJoiningRole(role) {
  return String(role || '').trim().toLowerCase() === JOINING_ROLE
}

export function isJoiningEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(`@${JOINING_AUTH_EMAIL_DOMAIN}`)
}

export function isJoiningAccount({ role, email } = {}) {
  return isJoiningRole(role) || isJoiningEmail(email)
}

export function normalizeJoiningUsername(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '')
}

export function isValidJoiningUsername(username) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(normalizeJoiningUsername(username))
}

export function joiningUsernameToAuthEmail(username) {
  return `${normalizeJoiningUsername(username)}@${JOINING_AUTH_EMAIL_DOMAIN}`
}

export function customKraWeight(kras = []) {
  return kras.reduce((sum, row) => sum + (Number(row?.weight) || 0), 0)
}

export function joiningPageUrl() {
  if (typeof window === 'undefined') return 'http://localhost:3002/joining'
  const { protocol, hostname, port } = window.location
  const employeePort = port === '3001' ? '3002' : port
  const host = employeePort ? `${hostname}:${employeePort}` : hostname
  return `${protocol}//${host}/joining`
}

export function onboardingFromProfile(profile) {
  const data = profile?.data && typeof profile.data === 'object' ? profile.data : {}
  if (!profile?.id) return null
  if (!isJoiningRole(data.role) && !data.employment && !data.joiningStatus) return null
  return {
    id: profile.id,
    auth_id: profile.auth_id || profile.id,
    username: data.username || '',
    status: data.joiningStatus === 'submitted' ? 'submitted' : 'draft',
    employment: data.employment && typeof data.employment === 'object' ? data.employment : {},
    kras: data.kras && typeof data.kras === 'object' ? data.kras : { custom: [], fixed: FIXED_KRAS },
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    documents: Array.isArray(data.documents) ? data.documents : [],
    created_at: profile.created_at || data.createdAt || data.updatedAt,
    submitted_at: data.submittedAt || null,
    source: 'profile',
  }
}
