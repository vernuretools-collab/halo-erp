import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const email = String(body.email || '').trim()
  const password = String(body.password || '')
  if (!email || !password) return json({ error: 'email and password required' }, 400)

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { displayName: body.displayName || email.split('@')[0] },
  })
  if (createErr) return json({ error: createErr.message }, 400)

  const uid = created.user.id
  const now = new Date().toISOString()
  const kind = body.type || 'employee'

  if (kind === 'client') {
    const clientData = {
      uid,
      email,
      displayName: body.displayName || email.split('@')[0],
      companyName: body.companyName || '',
      phoneNumber: body.phone || null,
      role: 'client',
      tier: 'client',
      status: 'active',
      onboardingStatus: body.onboardingStatus || 'pending_signature',
      createdAt: now,
      updatedAt: now,
    }
    await admin.from('profiles').upsert({
      id: uid,
      auth_id: uid,
      org_id: orgId,
      data: { ...clientData, orgId },
      updated_at: now,
    })
    await admin.from('client_onboarding').upsert({
      id: uid,
      user_id: uid,
      org_id: orgId,
      data: body.onboardingData || { uid, email, orgId, ...clientData },
      updated_at: now,
    })
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
