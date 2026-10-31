import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BLOCK_DURATION = '876000h'

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function findAuthUserId(admin, authId: string, email: string) {
  const candidate = String(authId || '').trim()
  if (candidate) {
    const { data, error } = await admin.auth.admin.getUserById(candidate)
    if (!error && data?.user?.id) return data.user.id
  }
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized) return ''
  const { data: profiles } = await admin.from('profiles').select('id,auth_id,data').eq('data->>email', normalized)
  for (const row of profiles || []) {
    const id = row.auth_id || row.id
    if (!id) continue
    const { data, error } = await admin.auth.admin.getUserById(id)
    if (!error && data?.user?.id) return data.user.id
  }
  const { data: employees } = await admin.from('employees').select('id,auth_id,user_id,data').eq('data->>email', normalized)
  for (const row of employees || []) {
    for (const id of [row.auth_id, row.user_id, row.id, row.data?.authId, row.data?.uid]) {
      if (!id) continue
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (!error && data?.user?.id) return data.user.id
    }
  }
  return ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey || !anonKey) return json({ error: 'server-misconfigured' }, 500)

  const admin = createClient(supabaseUrl, serviceKey)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })

  const { data: authData, error: authErr } = await userClient.auth.getUser()
  if (authErr || !authData.user) return json({ error: 'unauthenticated' }, 401)

  const { data: callerRows } = await admin.from('profiles').select('id,data').eq('auth_id', authData.user.id)
  const caller = (callerRows || []).sort((a, b) => {
    const rank = (role: string) => (['admin', 'owner', 'superadmin'].includes(role) ? 0 : 1)
    return rank(String(a?.data?.role || '').toLowerCase()) - rank(String(b?.data?.role || '').toLowerCase())
  })[0]
  const role = String(caller?.data?.role || authData.user.app_metadata?.role || '').toLowerCase()
  if (!['admin', 'owner', 'superadmin'].includes(role)) return json({ error: 'permission-denied' }, 403)

  const body = await req.json().catch(() => ({}))
  const access = body.access === 'allowed' ? 'allowed' : body.access === 'blocked' ? 'blocked' : ''
  if (!access) return json({ error: 'access must be blocked or allowed' }, 400)

  const authUserId = await findAuthUserId(admin, String(body.authId || ''), String(body.email || ''))
  if (!authUserId) return json({ ok: true, banned: false, reason: 'no-auth-user' })

  const { error: updateErr } = await admin.auth.admin.updateUserById(authUserId, {
    ban_duration: access === 'blocked' ? BLOCK_DURATION : 'none',
  })
  if (updateErr) return json({ error: updateErr.message }, 400)

  if (access === 'blocked') {
    const logout = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scope: 'global' }),
    })
    if (!logout.ok) {
      const signOutWarning = await logout.text()
      return json({ ok: true, banned: true, signOutWarning })
    }
  }

  return json({ ok: true, banned: access === 'blocked' })
})
