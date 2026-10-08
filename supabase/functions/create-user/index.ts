import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_AUTH_EMAIL_DOMAIN = 'client.halo.local'
const JOINING_AUTH_EMAIL_DOMAIN = 'joining.halo.local'
const JOINING_ROLE = 'employee_onboarding'

function normalizeUsername(raw: string) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '')
}

function isValidUsername(username: string) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(username)
}

function usernameToAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${CLIENT_AUTH_EMAIL_DOMAIN}`
}

function joiningAuthEmail(username: string) {
  return `${normalizeUsername(username)}@${JOINING_AUTH_EMAIL_DOMAIN}`
}

async function findAuthUserByEmail(admin, email: string) {
  if (typeof admin.auth.admin.getUserByEmail === 'function') {
    const found = await admin.auth.admin.getUserByEmail(email)
    if (!found.error && found.data?.user) return found.data.user
  }
  for (let page = 1; page <= 20; page += 1) {
    const listed = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (listed.error) throw new Error(listed.error.message)
    const users = listed.data?.users || []
    const match = users.find((user) => String(user.email || '').toLowerCase() === email)
    if (match) return match
    if (users.length < 200) return null
  }
  return null
}

async function upsertJoiningAuth(admin, { username, password, displayName, orgId }) {
  const email = joiningAuthEmail(username)
  const metadata = {
    app_metadata: { role: JOINING_ROLE, orgId },
    user_metadata: { username, displayName: displayName || username },
  }
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    ...metadata,
  })
  if (!created.error) {
    const uid = created.data.user.id
    const confirmed = await admin.auth.admin.updateUserById(uid, { password, email_confirm: true })
    if (confirmed.error) throw new Error(confirmed.error.message)
    return { user: confirmed.data.user || created.data.user, email }
  }

  if (!/already|registered|exists/i.test(created.error.message || '')) {
    throw new Error(created.error.message)
  }
  const existing = await findAuthUserByEmail(admin, email)
  if (!existing) throw new Error(created.error.message)
  const updated = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
    app_metadata: { ...(existing.app_metadata || {}), role: JOINING_ROLE, orgId },
    user_metadata: { ...(existing.user_metadata || {}), username, displayName: displayName || username },
  })
  if (updated.error) throw new Error(updated.error.message)
  return { user: updated.data.user, email }
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
    let uid = String(body.uid || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    if (!uid && email) {
      const existing = await findAuthUserByEmail(admin, email)
      if (!existing) return json({ error: 'No sign-in exists for this username' }, 400)
      uid = existing.id
    }
    if (!uid || password.length < 6) {
      return json({ error: 'uid and a password of at least 6 characters are required' }, 400)
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(uid, {
      password,
      email_confirm: true,
    })
    if (updateErr) return json({ error: updateErr.message }, 400)
    return json({ ok: true, uid })
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
    if (target && targetRole && targetRole !== 'client' && targetRole !== 'employee_onboarding') {
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

  if (kind === 'employee_onboarding' || body.action === 'ensure-joining-login') {
    const username = normalizeUsername(body.username)
    if (!isValidUsername(username)) {
      return json({ error: 'username must be 3–32 characters: letters, numbers, dots, underscores, or hyphens' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'Password must be at least 6 characters' }, 400)
    }
    const employment = body.employment && typeof body.employment === 'object' ? body.employment : {}
    const displayName = String(employment.fullName || body.displayName || username).trim()
    try {
      const { user, email } = await upsertJoiningAuth(admin, { username, password, displayName, orgId })
      const uid = user.id
      const now = new Date().toISOString()
      const onboardingId = String(body.onboardingId || '').trim()
      let existing = null
      if (onboardingId) {
        const byId = await admin.from('employee_onboarding').select('id').eq('id', onboardingId).maybeSingle()
        existing = byId.data
      }
      if (!existing) {
        const byName = await admin.from('employee_onboarding').select('id').eq('username', username).maybeSingle()
        existing = byName.data
      }
      const kras = Array.isArray(body.kras)
        ? { custom: body.kras, fixed: [
          { keyResultArea: 'THEC Portal Compliance', kpi: 'Daily submission rate at least 95%', weight: 10 },
          { keyResultArea: 'Client Satisfaction & Professional Conduct', kpi: 'No escalations; positive manager feedback', weight: 10 },
        ] }
        : null
      if (existing) {
        const patch: Record<string, unknown> = { auth_id: uid, username }
        if (Object.keys(employment).length) patch.employment = employment
        if (kras) patch.kras = kras
        const { error: updateErr } = await admin.from('employee_onboarding').update(patch).eq('id', existing.id)
        if (updateErr) return json({ error: updateErr.message }, 400)
      } else {
        const { error: insertErr } = await admin.from('employee_onboarding').insert({
          id: uid,
          auth_id: uid,
          username,
          status: 'draft',
          employment,
          kras,
          created_at: now,
        })
        if (insertErr) return json({ error: insertErr.message }, 400)
      }
      await admin.from('profiles').upsert({
        id: uid,
        auth_id: uid,
        org_id: orgId,
        data: {
          uid,
          username,
          email,
          displayName,
          role: JOINING_ROLE,
          tier: 'company',
          status: 'active',
          orgId,
          updatedAt: now,
        },
        updated_at: now,
      })
      return json({ id: existing?.id || uid, uid, username, email })
    } catch (err) {
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
