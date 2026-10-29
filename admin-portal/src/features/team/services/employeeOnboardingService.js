import { createClient } from '@supabase/supabase-js'
import { supabase } from '../../../shared/services/firebaseService'
import { FIXED_KRAS, JOINING_ROLE, isJoiningEmail, joiningUsernameToAuthEmail, learningPoints, onboardingFromProfile } from '../../../../../shared/supabase/employeeOnboarding.js'

async function invokeCreateUser(body) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.functions.invoke('create-user', { body })
  const payloadError = data?.error || data?.message
  if (!error && !payloadError) return data

  let detail = payloadError || error?.message || 'Failed to create the joining account.'
  try {
    if (error?.context && typeof error.context.json === 'function') {
      const payload = await error.context.json()
      detail = payload?.error || payload?.message || detail
    }
  } catch {
    /* gateway response had no JSON body */
  }
  if (detail === 'Failed to send a request to the Edge Function' || detail === 'Requested function was not found') {
    detail = 'The create-user Edge Function is not deployed on this Supabase project.'
  }
  throw new Error(detail)
}

function joiningAuthId(data) {
  const uid = String(data?.uid || '').trim()
  if (uid) return uid
  const id = String(data?.id || '').trim()
  return /^[0-9a-f-]{36}$/i.test(id) ? id : ''
}

function savedKraRows(kras) {
  const rows = Array.isArray(kras) ? kras : Array.isArray(kras?.custom) ? kras.custom : []
  return rows.filter((row) => row && typeof row === 'object')
}

function handbookKras({ kras, learningPlan, reviews }) {
  return {
    custom: savedKraRows(kras),
    fixed: FIXED_KRAS,
    learningPlan: (learningPlan || []).map((phase) => ({
      id: phase.id || '',
      label: String(phase.label || '').trim(),
      title: String(phase.title || '').trim(),
      points: learningPoints(phase.points),
    })),
    reviews: (reviews || []).map((review) => ({
      id: review.id || '',
      review: String(review.review || '').trim(),
      date: String(review.date || '').trim(),
      reviewer: String(review.reviewer || '').trim(),
      focus: String(review.focus || '').trim(),
    })),
  }
}

function alreadyRegistered(error) {
  return /already been registered/i.test(String(error?.message || error || ''))
}

function sameEmail(row, email) {
  return String(row?.data?.email || '').trim().toLowerCase() === email
}

async function findJoiningAuthId(email) {
  const username = String(email || '').split('@')[0]
  if (username) {
    const { data: onboarding } = await supabase
      .from('employee_onboarding')
      .select('auth_id')
      .eq('username', username)
      .maybeSingle()
    if (onboarding?.auth_id) return onboarding.auth_id
  }

  const { data: matched } = await supabase
    .from('profiles')
    .select('id, auth_id, data')
    .eq('data->>email', email)
    .limit(1)
  const direct = matched?.[0]
  if (direct && sameEmail(direct, email)) return direct.auth_id || direct.id

  const { data: profiles } = await supabase.from('profiles').select('id, auth_id, data').limit(500)
  const profile = (profiles || []).find((row) => sameEmail(row, email))
  if (profile) return profile.auth_id || profile.id

  const { data: employees } = await supabase.from('employees').select('id, auth_id, user_id, data').limit(500)
  const employee = (employees || []).find((row) => sameEmail(row, email))
  return employee?.auth_id || employee?.user_id || employee?.id || ''
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

async function updateOnboardingRows(patch, { id, authId }) {
  const next = { ...patch, updated_at: new Date().toISOString() }
  if (id) {
    const { data, error } = await supabase.from('employee_onboarding').update(next).eq('id', id).select('id')
    if (error) throw error
    if (data?.length) return data[0].id
  }
  if (authId && authId !== id) {
    const { data, error } = await supabase.from('employee_onboarding').update(next).eq('auth_id', authId).select('id')
    if (error) throw error
    if (data?.length) return data[0].id
  }
  return ''
}

async function loadProfileRow(id) {
  if (!id) return null
  const { data, error } = await supabase.from('profiles').select('id, auth_id, org_id, data, created_at').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

async function insertOnboardingFromProfile(profile, patch = {}) {
  const data = profile?.data && typeof profile.data === 'object' ? profile.data : {}
  const authId = profile?.auth_id || profile?.id
  const email = String(data.email || '')
  const username = String(data.username || email.split('@')[0] || '').trim().toLowerCase()
  if (!authId || username.length < 3) throw new Error('Could not save this onboarding record.')
  const submitted = data.joiningStatus === 'submitted'
  const { data: inserted, error } = await supabase.from('employee_onboarding').insert({
    id: authId,
    org_id: profile.org_id || data.orgId || 'org_demo',
    auth_id: authId,
    username,
    status: submitted ? 'submitted' : 'awaiting_answers',
    employment: patch.employment || (data.employment && typeof data.employment === 'object' ? data.employment : {}),
    kras: patch.kras || (data.kras && typeof data.kras === 'object' ? data.kras : {}),
    answers: data.answers && typeof data.answers === 'object' ? data.answers : {},
    documents: Array.isArray(data.documents) ? data.documents : [],
    login_password: patch.login_password || data.loginPassword || null,
    submitted_at: submitted ? (data.submittedAt || profile.created_at || new Date().toISOString()) : null,
    updated_at: new Date().toISOString(),
  }).select('id').single()
  if (error) throw error
  return inserted.id
}

async function saveOnboardingPatch(patch, { id, authId }) {
  const savedId = await updateOnboardingRows(patch, { id, authId })
  if (savedId) return savedId
  const profile = await loadProfileRow(authId) || await loadProfileRow(id)
  if (!profile) throw new Error('Could not save this onboarding record.')
  return insertOnboardingFromProfile(profile, patch)
}

async function rememberJoiningPassword({ id, authId, password }) {
  const value = String(password || '')
  if (value.length < 6) return
  await saveOnboardingPatch({ login_password: value }, { id, authId })
}

async function linkJoiningAuth(onboardingId, authId) {
  if (!onboardingId || !authId) return
  const { error } = await supabase.from('employee_onboarding').update({ auth_id: authId }).eq('id', onboardingId)
  if (error) throw error
}

async function setJoiningPassword(authId, password, email) {
  await invokeCreateUser({ action: 'set-password', uid: authId || '', email, password })
}

async function ensureJoiningPassword(email, password, authId) {
  try {
    await setJoiningPassword(authId, password, email)
  } catch (err) {
    if (!alreadyRegistered(err) && !/no sign-in exists/i.test(String(err.message || ''))) throw err
  }
  await assertJoiningPasswordWorks(email, password)
}

async function createJoiningAuthUser({ username, password, email, displayName, employment, kras, learningPlan, reviews }) {
  try {
    const data = await invokeCreateUser({
      type: 'employee_onboarding',
      email,
      password,
      username,
      displayName: displayName || username,
      employment,
      kras: savedKraRows(kras),
      learningPlan,
      reviews,
    })
    return { ...data, uid: joiningAuthId(data), email }
  } catch (err) {
    if (!alreadyRegistered(err)) throw err
    return { uid: await findJoiningAuthId(email), email, alreadyRegistered: true }
  }
}

async function saveHandbookKras({ id, authId, kras }) {
  if (!kras) return
  await saveOnboardingPatch({ kras }, { id, authId })
}

async function markJoiningProfile(authId, { username, email, displayName, employment, kras, password }) {
  if (!authId) return
  const { data: profile } = await supabase.from('profiles').select('id, data').eq('id', authId).maybeSingle()
  const current = profile?.data && typeof profile.data === 'object' ? profile.data : {}
  const { error } = await supabase.from('profiles').upsert({
    id: authId,
    auth_id: authId,
    data: {
      ...current,
      uid: authId,
      username,
      email,
      displayName: displayName || current.displayName || username,
      role: JOINING_ROLE,
      status: 'active',
      loginPassword: password || current.loginPassword || '',
      joiningStatus: current.joiningStatus === 'submitted' ? 'submitted' : 'draft',
      employment: employment || current.employment || {},
      kras: kras?.learningPlan || kras?.reviews
        ? kras
        : {
          custom: savedKraRows(kras || current.kras),
          fixed: FIXED_KRAS,
          learningPlan: current.kras?.learningPlan || [],
          reviews: current.kras?.reviews || [],
        },
      answers: current.answers || {},
    },
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

async function assertJoiningPasswordWorks(email, password) {
  const checker = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'joining-password-check' },
  })
  const { error } = await checker.auth.signInWithPassword({ email, password })
  if (!error) {
    await checker.auth.signOut()
    return
  }
  const detail = String(error.message || error.error_code || '')
  if (/invalid login|invalid_credentials/i.test(detail)) {
    throw new Error('The joining sign-in was not created. Click Save & create joining login again. If it still fails, the create-user function did not save this username.')
  }
  throw new Error(detail || 'Joining sign-in failed after creating the account.')
}

export async function resetJoiningLogin({ id, username, password, displayName, employment }) {
  const record = id ? await getEmployeeOnboarding(id) : null
  const savedEmployment = { ...(employment || {}), ...(record?.employment || {}) }
  const login = username || record?.username
  const email = joiningUsernameToAuthEmail(login)
  const handbook = record?.kras && typeof record.kras === 'object' ? record.kras : {}
  const created = await createJoiningAuthUser({
    username: login,
    password,
    email,
    displayName: displayName || savedEmployment.fullName || login,
    employment: savedEmployment,
    kras: handbook,
    learningPlan: handbook.learningPlan,
    reviews: handbook.reviews,
  })
  const authId = created.uid || await findJoiningAuthId(email)
  await ensureJoiningPassword(email, password, authId)
  await rememberJoiningPassword({ id: created.id || id, authId, password })
  await markJoiningProfile(authId, {
    username: login,
    email,
    displayName: displayName || savedEmployment.fullName,
    employment: savedEmployment,
    kras: record?.kras,
    password,
  })
  try {
    await linkJoiningAuth(id, authId)
  } catch {
    /* employee_onboarding may block client writes; profile is enough. */
  }
  return { uid: authId, email, username: login }
}

export async function createEmployeeOnboarding({ username, password, employment, kras, learningPlan, reviews }) {
  const email = joiningUsernameToAuthEmail(username)
  const handbook = handbookKras({ kras, learningPlan, reviews })
  const created = await createJoiningAuthUser({
    username,
    password,
    email,
    displayName: employment?.fullName || username,
    employment,
    kras,
    learningPlan: handbook.learningPlan,
    reviews: handbook.reviews,
  })
  const authId = created.uid || ''
  if (created.id && authId && !created.alreadyRegistered) {
    return {
      ...created,
      id: created.id,
      uid: authId,
      auth_id: authId,
      username: created.username || username,
      email,
      employment,
      kras: handbook,
      login_password: password,
    }
  }
  const resolvedAuthId = authId || await findJoiningAuthId(email)
  if (!resolvedAuthId) throw new Error('The joining sign-in could not be created.')
  await ensureJoiningPassword(email, password, resolvedAuthId)
  await markJoiningProfile(resolvedAuthId, {
    username,
    email,
    displayName: employment?.fullName || username,
    employment,
    kras: handbook,
    password,
  })
  const recordId = created.id || resolvedAuthId
  await rememberJoiningPassword({ id: recordId, authId: resolvedAuthId, password })
  await saveHandbookKras({ id: recordId, authId: resolvedAuthId, kras: handbook })
  return {
    ...created,
    id: recordId,
    uid: resolvedAuthId,
    auth_id: resolvedAuthId,
    username: created.username || username,
    email,
    employment,
    kras: handbook,
    login_password: password,
  }
}

export async function updateEmployeeHandbook({ id, authId, kras, learningPlan, reviews }) {
  const handbook = handbookKras({ kras, learningPlan, reviews })
  const now = new Date().toISOString()
  const savedId = await saveOnboardingPatch({ kras: handbook }, { id, authId })

  const profileIds = [...new Set([authId, id, savedId].filter(Boolean))]
  for (const profileId of profileIds) {
    const { data: profile, error: readErr } = await supabase.from('profiles').select('id, data').eq('id', profileId).maybeSingle()
    if (readErr) throw readErr
    if (!profile) continue
    const current = profile.data && typeof profile.data === 'object' ? profile.data : {}
    const { data: updated, error } = await supabase.from('profiles').update({
      data: { ...current, kras: handbook },
      updated_at: now,
    }).eq('id', profile.id).select('id')
    if (error) throw error
    if (!updated?.length) continue
  }

  if (!savedId) throw new Error('Could not save the handbook on this record.')
  return handbook
}

export async function deleteEmployeeOnboarding(recordOrId) {
  const record = recordOrId && typeof recordOrId === 'object' ? recordOrId : null
  const id = String(record?.id || recordOrId || '').trim()
  if (!id) throw new Error('Onboarding record not found')
  await invokeCreateUser({
    action: 'delete-onboarding',
    id,
    username: record?.username || '',
    authId: record?.auth_id || '',
  })
}

function mergeKras(tableKras, profileKras) {
  const table = tableKras && typeof tableKras === 'object' && !Array.isArray(tableKras) ? tableKras : {}
  const profile = profileKras && typeof profileKras === 'object' && !Array.isArray(profileKras) ? profileKras : {}
  return {
    ...table,
    ...profile,
    custom: profile.custom?.length ? profile.custom : (table.custom || []),
    fixed: profile.fixed?.length ? profile.fixed : (table.fixed || FIXED_KRAS),
    learningPlan: profile.learningPlan?.length ? profile.learningPlan : (table.learningPlan || []),
    reviews: profile.reviews?.length ? profile.reviews : (table.reviews || []),
  }
}

function mergeOnboarding(tableRow, profileRow) {
  const fromProfile = onboardingFromProfile(profileRow)
  if (!tableRow) return fromProfile
  if (!fromProfile) return tableRow
  const submitted = fromProfile.status === 'submitted' || tableRow.status === 'submitted'
  return {
    ...tableRow,
    status: submitted ? 'submitted' : tableRow.status,
    answers: fromProfile.answers && Object.keys(fromProfile.answers).length ? fromProfile.answers : tableRow.answers,
    employment: { ...(tableRow.employment || {}), ...(fromProfile.employment || {}) },
    kras: mergeKras(tableRow.kras, fromProfile.kras),
    submitted_at: fromProfile.submitted_at || tableRow.submitted_at,
    auth_id: tableRow.auth_id || fromProfile.auth_id,
    login_password: tableRow.login_password || fromProfile.login_password || '',
  }
}

const PROFILE_LIST_COLUMNS = 'id, auth_id, org_id, data, created_at'

async function listJoiningProfiles() {
  const [byRole, byJoin, byLegacy] = await Promise.all([
    supabase.from('profiles').select(PROFILE_LIST_COLUMNS).eq('data->>role', JOINING_ROLE),
    supabase.from('profiles').select(PROFILE_LIST_COLUMNS).ilike('data->>email', '%@join.halo.local'),
    supabase.from('profiles').select(PROFILE_LIST_COLUMNS).ilike('data->>email', '%@joining.halo.local'),
  ])
  const error = byRole.error || byJoin.error || byLegacy.error
  if (error) throw error
  const seen = new Set()
  const rows = []
  for (const row of [...(byRole.data || []), ...(byJoin.data || []), ...(byLegacy.data || [])]) {
    if (!row?.id || seen.has(row.id)) continue
    seen.add(row.id)
    rows.push(row)
  }
  return rows
}

function profileRecord(profile) {
  const row = onboardingFromProfile(profile)
  if (!row) return null
  if (row.username) return row
  const email = String(profile?.data?.email || '')
  const login = email.split('@')[0]
  const hasSetup = Object.keys(row.employment || {}).length > 0 || Object.keys(row.answers || {}).length > 0
  if (!isJoiningEmail(email) || !login || !hasSetup) return null
  return { ...row, username: login }
}

async function readOnboarding(column, value) {
  if (!value) return null
  const { data, error } = await supabase.from('employee_onboarding').select('*').eq(column, value).maybeSingle()
  if (error) {
    if (column === 'auth_id' && /invalid input syntax for type uuid/i.test(error.message || '')) return null
    throw error
  }
  return data
}

async function readProfile(column, value) {
  if (!value) return null
  const query = supabase.from('profiles').select(PROFILE_LIST_COLUMNS).eq(column, value)
  if (column === 'data->>username') {
    const { data, error } = await query.limit(1)
    if (error) throw error
    return data?.[0] || null
  }
  const { data, error } = await query.maybeSingle()
  if (error) {
    if (column === 'auth_id' && /invalid input syntax for type uuid/i.test(error.message || '')) return null
    throw error
  }
  return data
}

export async function listEmployeeOnboarding() {
  const { data, error } = await supabase
    .from('employee_onboarding')
    .select('id, username, status, employment, created_at, submitted_at, auth_id, login_password')
    .order('created_at', { ascending: false })
  if (error) throw error
  const tableRows = data || []
  const profileList = await listJoiningProfiles()
  const merged = tableRows.map((row) => {
    const profile = profileList.find((item) => item.id === row.id || item.id === row.auth_id || item.auth_id === row.auth_id || String(item.data?.username || '').toLowerCase() === String(row.username || '').toLowerCase())
    return mergeOnboarding(row, profile)
  })
  const seen = new Set(merged.map((row) => String(row.username || '').toLowerCase()))
  const extras = profileList.map(profileRecord).filter((row) => row?.username && !seen.has(row.username.toLowerCase()))
  return [...merged, ...extras]
}

export async function getEmployeeOnboarding(id) {
  const key = String(id || '').trim()
  if (!key) return null
  let data = await readOnboarding('id', key)
  if (!data && isUuid(key)) data = await readOnboarding('auth_id', key)
  if (!data) data = await readOnboarding('username', key.toLowerCase())

  let profile = await readProfile('id', key)
  if (!profile && data?.auth_id) profile = await readProfile('id', data.auth_id)
  if (!profile && isUuid(key)) profile = await readProfile('auth_id', key)
  if (!profile && data?.username) profile = await readProfile('data->>username', data.username)
  if (!profile && !isUuid(key)) profile = await readProfile('data->>username', key.toLowerCase())

  if (!data && profile) {
    if (profile.auth_id) data = await readOnboarding('auth_id', profile.auth_id)
    const login = String(profile.data?.username || '').trim().toLowerCase()
    if (!data && login) data = await readOnboarding('username', login)
  }
  return mergeOnboarding(data, profile)
}
