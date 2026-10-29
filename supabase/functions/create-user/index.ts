import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_AUTH_EMAIL_DOMAIN = 'client.halo.local'
const JOINING_AUTH_EMAIL_DOMAIN = 'join.halo.local'
const FIXED_KRAS = [
  { keyResultArea: 'THEC Portal Compliance', kpi: 'Portal compliance', weight: 10, locked: true },
  { keyResultArea: 'Client Satisfaction', kpi: 'Client satisfaction', weight: 10, locked: true },
]

function normalizeUsername(raw: string) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '')
}

function isValidUsername(username: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(username)
}

function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${CLIENT_AUTH_EMAIL_DOMAIN}`
}

function joiningUsernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${JOINING_AUTH_EMAIL_DOMAIN}`
}

function textField(value: unknown) {
  return String(value || '').trim()
}

function sanitizeEmployment(raw: Record<string, unknown> | undefined) {
  const source = raw || {}
  return {
    employeeId: textField(source.employeeId),
    fullName: textField(source.fullName),
    designation: textField(source.designation),
    department: textField(source.department),
    reportingManager: textField(source.reportingManager),
    dateOfJoining: textField(source.dateOfJoining),
    workMode: textField(source.workMode),
    monthlyCtc: textField(source.monthlyCtc),
    probationPeriod: textField(source.probationPeriod),
    workLocation: textField(source.workLocation),
    assets: textField(source.assets),
    issueDate: textField(source.issueDate),
  }
}

function requiredEmploymentError(employment: ReturnType<typeof sanitizeEmployment>) {
  const required = [
    ['employeeId', 'Employee ID'],
    ['fullName', 'Full name'],
    ['designation', 'Designation'],
    ['department', 'Department'],
    ['reportingManager', 'Reporting manager'],
    ['dateOfJoining', 'Date of joining'],
    ['workMode', 'Work mode'],
    ['monthlyCtc', 'Monthly CTC'],
  ]
  for (const [key, label] of required) {
    if (!employment[key as keyof typeof employment]) return `${label} is required`
  }
  return ''
}

function sanitizeLearningPlan(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as { id?: string; label?: string; title?: string; points?: unknown }
    const points = Array.isArray(row.points)
      ? row.points.map((point) => String(point || '').trim()).filter(Boolean)
      : String(row.points || '').split(/\n+/).map((point) => point.trim()).filter(Boolean)
    return {
      id: String(row.id || ''),
      label: String(row.label || '').trim(),
      title: String(row.title || '').trim(),
      points,
    }
  }).filter((row) => row.label || row.title)
}

function sanitizeReviews(raw: unknown) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const row = item as { id?: string; review?: string; date?: string; reviewer?: string; focus?: string }
    return {
      id: String(row.id || ''),
      review: String(row.review || '').trim(),
      date: String(row.date || '').trim(),
      reviewer: String(row.reviewer || '').trim(),
      focus: String(row.focus || '').trim(),
    }
  }).filter((row) => row.review)
}

function kraError(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) return ''
  for (const raw of rows) {
    const row = raw as { keyResultArea?: string; kpi?: string; weight?: number }
    const area = String(row.keyResultArea || '').trim()
    const kpi = String(row.kpi || '').trim()
    const weight = Number(row.weight)
    if (!area || !kpi) return 'Each KRA needs an area and a metric'
    if (!Number.isFinite(weight) || weight <= 0) return 'Each KRA weight must be greater than 0'
  }
  return ''
}

function isJoiningLoginEmail(email: string) {
  const value = String(email || '').trim().toLowerCase()
  return value.endsWith('@join.halo.local') || value.endsWith('@joining.halo.local')
}

async function rememberJoiningPassword(admin, uid: string, password: string) {
  if (!uid || password.length < 6) return
  await admin.from('employee_onboarding').update({ login_password: password }).eq('auth_id', uid)
  const { data: profile } = await admin.from('profiles').select('id, data').eq('id', uid).maybeSingle()
  if (!profile) return
  const role = String(profile.data?.role || '').toLowerCase()
  const email = String(profile.data?.email || '')
  if (role !== 'employee_onboarding' && !isJoiningLoginEmail(email)) return
  await admin.from('profiles').update({
    data: { ...(profile.data || {}), loginPassword: password },
    updated_at: new Date().toISOString(),
  }).eq('id', profile.id)
}

function joiningKras(customKras: unknown[], learningPlan: unknown, reviews: unknown) {
  const rows = Array.isArray(customKras) ? customKras : []
  return {
    custom: rows.map((row) => ({
      keyResultArea: String((row as { keyResultArea?: string }).keyResultArea || '').trim(),
      kpi: String((row as { kpi?: string }).kpi || '').trim(),
      weight: Number((row as { weight?: number }).weight),
    })),
    fixed: FIXED_KRAS,
    learningPlan,
    reviews,
  }
}

async function findAuthIdForJoining(admin, email: string, username: string) {
  const { data: profiles } = await admin.from('profiles').select('id, auth_id, data').eq('data->>email', email).limit(5)
  const profile = (profiles || []).find((row) => String(row?.data?.email || '').trim().toLowerCase() === email)
  if (profile) return String(profile.auth_id || profile.id || '')

  const { data: onboarding } = await admin.from('employee_onboarding').select('auth_id').eq('username', username).maybeSingle()
  if (onboarding?.auth_id) return String(onboarding.auth_id)

  const { data: employees } = await admin.from('employees').select('id, auth_id, user_id, data').eq('data->>email', email).limit(5)
  const employee = (employees || []).find((row) => String(row?.data?.email || '').trim().toLowerCase() === email)
  return String(employee?.auth_id || employee?.user_id || employee?.id || '')
}

async function upsertJoiningProfile(admin, { uid, orgId, username, email, displayName, employment, kras, password }) {
  const { data: profile, error: readErr } = await admin.from('profiles').select('id, data').eq('id', uid).maybeSingle()
  if (readErr) throw new Error(readErr.message)
  const current = profile?.data && typeof profile.data === 'object' ? profile.data : {}
  const { error } = await admin.from('profiles').upsert({
    id: uid,
    auth_id: uid,
    org_id: orgId,
    data: {
      ...current,
      uid,
      username,
      email,
      displayName: displayName || current.displayName || username,
      role: 'employee_onboarding',
      status: 'active',
      tier: 'joining',
      orgId,
      loginPassword: password || current.loginPassword || '',
      joiningStatus: current.joiningStatus === 'submitted' ? 'submitted' : 'draft',
      employment: employment || current.employment || {},
      kras,
      answers: current.answers || {},
    },
    updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
}

async function saveJoiningOnboarding(admin, { orgId, uid, username, password, employment, kras }) {
  const now = new Date().toISOString()
  const byName = await admin.from('employee_onboarding').select('id, status').eq('username', username).maybeSingle()
  if (byName.error) throw new Error(byName.error.message)
  let existing = byName.data
  if (!existing && uid) {
    const byAuth = await admin.from('employee_onboarding').select('id, status').eq('auth_id', uid).maybeSingle()
    if (byAuth.error) throw new Error(byAuth.error.message)
    existing = byAuth.data
  }
  if (existing?.id) {
    const { data, error } = await admin.from('employee_onboarding').update({
      org_id: orgId,
      auth_id: uid,
      username,
      login_password: password,
      employment,
      kras,
      updated_at: now,
    }).eq('id', existing.id).select('id, username, status').single()
    if (error) throw new Error(error.message)
    return data
  }
  const { data, error } = await admin.from('employee_onboarding').insert({
    org_id: orgId,
    auth_id: uid,
    username,
    status: 'awaiting_answers',
    login_password: password,
    employment,
    kras,
    answers: {},
    documents: [],
    updated_at: now,
  }).select('id, username, status').single()
  if (error) throw new Error(error.message)
  return data
}

async function profilesByIds(admin, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return []
  const results = await Promise.all(unique.map((profileId) =>
    admin.from('profiles').select('id, auth_id, data').eq('id', profileId).maybeSingle()
  ))
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)
  return results.map((result) => result.data).filter(Boolean)
}

async function removeJoiningDirectoryRows(admin, { uid, username }) {
  const emails = [`${username}@join.halo.local`, `${username}@joining.halo.local`]
  const jobs = emails.map((email) => admin.from('employees').delete().eq('data->>email', email))
  if (uid) jobs.push(admin.from('employees').delete().eq('id', uid))
  const results = await Promise.all(jobs)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw new Error(failed.error.message)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const admin = createClient(supabaseUrl, serviceKey)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })

  const { data: authData, error: authErr } = await userClient.auth.getUser()
  if (authErr || !authData.user) {
    return json({ error: 'unauthenticated' }, 401)
  }

  const { data: callerRows } = await admin.from('profiles').select('id,data,org_id').eq('auth_id', authData.user.id)
  const caller = (callerRows || []).sort((a, b) => {
    const ar = String(a?.data?.role || '').toLowerCase()
    const br = String(b?.data?.role || '').toLowerCase()
    const rank = (r) => (['admin', 'owner', 'superadmin'].includes(r) ? 0 : 1)
    return rank(ar) - rank(br)
  })[0]
  const role = String(caller?.data?.role || authData.user.app_metadata?.role || '').toLowerCase()
  if (!['admin', 'owner', 'superadmin'].includes(role)) {
    return json({ error: 'permission-denied' }, 403)
  }

  const orgId = String(
    caller?.data?.orgId || caller?.org_id || authData.user.app_metadata?.orgId || 'org_demo'
  )

  const body = await req.json()
  const password = String(body.password || '')
  const kind = body.type || 'employee'

  if (body.action === 'set-password') {
    const uid = String(body.uid || '').trim()
    if (!uid || password.length < 6) {
      return json({ error: 'uid and a password of at least 6 characters are required' }, 400)
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(uid, { password })
    if (updateErr) return json({ error: updateErr.message }, 400)
    await rememberJoiningPassword(admin, uid, password)
    return json({ ok: true })
  }

  if (body.action === 'delete-user') {
    const uid = String(body.uid || '').trim()
    if (!uid || uid.length > 80) return json({ error: 'A valid user id is required' }, 400)
    if (uid === authData.user.id) return json({ error: 'You cannot delete your own account' }, 400)

    const { data: byId, error: byIdErr } = await admin.from('profiles').select('id,auth_id,data').eq('id', uid).maybeSingle()
    if (byIdErr) return json({ error: byIdErr.message }, 400)
    let target = byId
    if (!target) {
      const { data: byAuth, error: byAuthErr } = await admin.from('profiles').select('id,auth_id,data').eq('auth_id', uid).maybeSingle()
      if (byAuthErr) return json({ error: byAuthErr.message }, 400)
      target = byAuth
    }
    const targetRole = String(target?.data?.role || '').toLowerCase()
    if (target && targetRole && targetRole !== 'client') {
      return json({ error: 'Only client portal users can be deleted here' }, 400)
    }

    const authId = String(target?.auth_id || uid)
    const profileId = String(target?.id || uid)
    const { error: authDeleteErr } = await admin.auth.admin.deleteUser(authId)
    if (authDeleteErr && !/not found/i.test(authDeleteErr.message || '')) {
      return json({ error: authDeleteErr.message }, 400)
    }

    const [onboardById, onboardByUser, profileDelete] = await Promise.all([
      admin.from('client_onboarding').delete().eq('id', profileId),
      admin.from('client_onboarding').delete().eq('user_id', profileId),
      admin.from('profiles').delete().eq('id', profileId),
    ])
    const cleanupErr = onboardById.error || onboardByUser.error || profileDelete.error
    if (cleanupErr) return json({ error: cleanupErr.message }, 400)
    return json({ ok: true })
  }

  if (body.action === 'delete-onboarding') {
    const id = String(body.id || '').trim()
    const username = normalizeUsername(body.username || '')
    const authIdHint = String(body.authId || body.uid || '').trim()
    if ((!id || id.length > 80) && !username) return json({ error: 'A valid onboarding id is required' }, 400)

    const [byId, byName] = await Promise.all([
      id
        ? admin.from('employee_onboarding').select('id, auth_id, org_id, username').eq('id', id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      username
        ? admin.from('employee_onboarding').select('id, auth_id, org_id, username').eq('username', username).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (byId.error) return json({ error: byId.error.message }, 400)
    if (byName.error) return json({ error: byName.error.message }, 400)
    const row = byId.data || byName.data
    if (row && String(row.org_id || '') !== orgId) return json({ error: 'permission-denied' }, 403)

    const login = normalizeUsername(row?.username || username)
    const authIds = new Set<string>()
    const profileIds = new Set<string>()
    if (row?.auth_id) authIds.add(String(row.auth_id))
    if (authIdHint && authIdHint !== authData.user.id) authIds.add(authIdHint)

    const considerProfile = (profile) => {
      if (!profile?.id) return
      const targetRole = String(profile.data?.role || '').toLowerCase()
      const email = String(profile.data?.email || '')
      const joining = targetRole === 'employee_onboarding' || isJoiningLoginEmail(email) || (!targetRole && authIds.has(String(profile.id)))
      if (!joining || targetRole === 'admin' || targetRole === 'employee' || targetRole === 'client') return
      profileIds.add(String(profile.id))
      if (profile.auth_id) authIds.add(String(profile.auth_id))
    }

    const namedPromise = login
      ? admin.from('profiles').select('id, auth_id, data').eq('data->>username', login)
      : Promise.resolve({ data: [], error: null })
    let named
    let seeded
    try {
      ;[named, seeded] = await Promise.all([
        namedPromise,
        profilesByIds(admin, [id, ...authIds]),
      ])
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Could not load the joining login' }, 400)
    }
    if (named.error) return json({ error: named.error.message }, 400)
    const seenProfiles = new Set<string>()
    for (const profile of [...(named.data || []), ...seeded]) {
      if (!profile?.id || seenProfiles.has(profile.id)) continue
      seenProfiles.add(profile.id)
      considerProfile(profile)
    }
    const missing = [...authIds].filter((authId) => !seenProfiles.has(authId))
    if (missing.length) {
      try {
        for (const profile of await profilesByIds(admin, missing)) considerProfile(profile)
      } catch (err) {
        return json({ error: err instanceof Error ? err.message : 'Could not load the joining login' }, 400)
      }
    }

    if (!row && profileIds.size === 0) return json({ error: 'Onboarding record not found' }, 404)

    const cleanups = [...profileIds].map(async (profileId) => {
      const employee = await admin.from('employees').select('id, data').eq('id', profileId).maybeSingle()
      if (employee.error) throw new Error(employee.error.message)
      const employeeEmail = String(employee.data?.data?.email || '').toLowerCase()
      if (isJoiningLoginEmail(employeeEmail)) {
        const { error: employeeErr } = await admin.from('employees').delete().eq('id', profileId)
        if (employeeErr) throw new Error(employeeErr.message)
      }
      const { error: profileErr } = await admin.from('profiles').delete().eq('id', profileId)
      if (profileErr) throw new Error(profileErr.message)
    })
    if (row) {
      cleanups.push((async () => {
        const { error: deleteErr } = await admin.from('employee_onboarding').delete().eq('id', row.id)
        if (deleteErr) throw new Error(deleteErr.message)
      })())
    }
    let authWarning = ''
    for (const authId of authIds) {
      if (!authId || authId === authData.user.id) continue
      cleanups.push((async () => {
        const { error: authDeleteErr } = await admin.auth.admin.deleteUser(authId)
        if (authDeleteErr && !/not found/i.test(authDeleteErr.message || '')) authWarning = authDeleteErr.message
      })())
    }
    try {
      await Promise.all(cleanups)
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Could not delete the joining login' }, 400)
    }
    return json(authWarning ? { ok: true, authWarning } : { ok: true })
  }

  if (kind === 'employee_onboarding') {
    const username = normalizeUsername(body.username)
    if (!isValidUsername(username)) {
      return json({ error: 'username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'password must be at least 6 characters' }, 400)
    }
    const employment = sanitizeEmployment(body.employment)
    const employmentError = requiredEmploymentError(employment)
    if (employmentError) return json({ error: employmentError }, 400)
    const customKras = Array.isArray(body.kras) ? body.kras : []
    const weightError = kraError(customKras)
    if (weightError) return json({ error: weightError }, 400)
    const learningPlan = sanitizeLearningPlan(body.learningPlan)
    const reviews = sanitizeReviews(body.reviews)

    const email = joiningUsernameToAuthEmail(username)
    const displayName = String(employment.fullName || username).trim()
    const kras = joiningKras(customKras, learningPlan, reviews)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'employee_onboarding', orgId, tier: 'joining' },
      user_metadata: { displayName, username },
    })

    let uid = ''
    let createdNew = false
    if (createErr) {
      if (!/already been registered/i.test(createErr.message || '')) {
        return json({ error: createErr.message }, 400)
      }
      uid = await findAuthIdForJoining(admin, email, username)
      if (!uid) return json({ error: createErr.message }, 400)
      const { error: updateErr } = await admin.auth.admin.updateUserById(uid, {
        password,
        app_metadata: { role: 'employee_onboarding', orgId, tier: 'joining' },
      })
      if (updateErr) return json({ error: updateErr.message }, 400)
    } else {
      uid = created.user.id
      createdNew = true
    }

    try {
      const row = await saveJoiningOnboarding(admin, { orgId, uid, username, password, employment, kras })
      await Promise.all([
        upsertJoiningProfile(admin, { uid, orgId, username, email, displayName, employment, kras, password }),
        removeJoiningDirectoryRows(admin, { uid, username }),
      ])
      return json({ id: row.id, uid, username: row.username, status: row.status, joiningPath: '/joining' })
    } catch (err) {
      if (createdNew) await admin.auth.admin.deleteUser(uid)
      return json({ error: err instanceof Error ? err.message : 'Could not save the joining login' }, 400)
    }
  }

  let email = String(body.email || '').trim().toLowerCase()
  let username = normalizeUsername(body.username)
  if (kind === 'client') {
    if (!username && email.endsWith(`@${CLIENT_AUTH_EMAIL_DOMAIN}`)) {
      username = email.split('@')[0]
    }
    if (!isValidUsername(username)) {
      return json({ error: 'username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens' }, 400)
    }
    email = usernameToAuthEmail(username)
  }
  if (!email || !password) {
    return json({ error: kind === 'client' ? 'username and password required' : 'email and password required' }, 400)
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: body.displayName || username || email.split('@')[0], username: username || null },
  })
  if (createErr) return json({ error: createErr.message }, 400)

  const uid = created.user.id
  const now = new Date().toISOString()

  if (kind === 'client') {
    const clientData = {
      uid,
      username,
      email,
      displayName: String(body.displayName || username).trim().replace(/\s+/g, ' '),
      companyName: body.companyName || '',
      phoneNumber: body.phone || null,
      role: 'client',
      tier: 'client',
      status: 'active',
      onboardingStatus: body.onboardingStatus || 'pending_signature',
      createdAt: now,
      updatedAt: now,
    }
    await Promise.all([
      admin.from('profiles').upsert({
        id: uid,
        auth_id: uid,
        org_id: orgId,
        data: { ...clientData, orgId },
        updated_at: now,
      }),
      admin.from('client_onboarding').upsert({
        id: uid,
        user_id: uid,
        org_id: orgId,
        data: body.onboardingData || { uid, email, orgId, ...clientData },
        updated_at: now,
      }),
    ])
    return json(clientData)
  }

  if (kind === 'admin') {
    const adminData = {
      uid,
      email,
      displayName: body.displayName,
      roleName: body.roleName || 'Executive Admin',
      departmentName: 'Executive Management',
      role: 'admin',
      tier: 'company',
      status: 'active',
      orgId,
      createdAt: now,
      updatedAt: now,
    }
    await admin.from('profiles').upsert({
      id: uid,
      auth_id: uid,
      org_id: orgId,
      data: adminData,
      updated_at: now,
    })
    return json(adminData)
  }

  const emp = {
    uid,
    email,
    displayName: body.displayName,
    roleName: body.roleName || 'Software Specialist',
    departmentName: body.departmentName || 'Engineering & Product',
    phoneNumber: body.phone || body.phoneNumber || ' ',
    skills: ['Productivity'],
    status: 'active',
    joinedAt: now.split('T')[0],
    utilizationRate: 85,
    role: 'employee',
    tier: 'company',
    orgId,
    createdAt: now,
    updatedAt: now,
  }
  await admin.from('profiles').upsert({
    id: uid,
    auth_id: uid,
    org_id: orgId,
    data: emp,
    updated_at: now,
  })
  await admin.from('employees').upsert({
    id: uid,
    user_id: uid,
    org_id: orgId,
    data: emp,
    updated_at: now,
  })
  return json(emp)
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
