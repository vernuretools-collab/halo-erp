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
  const { data: authData } = await userClient.auth.getUser()
  if (!authData.user) return json({ error: 'unauthenticated' }, 401)

  const { data: profile } = await admin.from('profiles').select('data').eq('auth_id', authData.user.id).maybeSingle()
  const role = String(profile?.data?.role || authData.user.app_metadata?.role || '').toLowerCase()
  if (['employee', 'client'].includes(role)) return json({ error: 'permission-denied' }, 403)

  const apiKey = Deno.env.get('GEMINI_API_KEY') || ''
  if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set' }, 412)

  const body = await req.json()
  const message = String(body.message || '').trim()
  if (!message) return json({ error: 'message is required' }, 400)

  const [employees, leads, invoices, projects] = await Promise.all([
    rows(admin, 'employees'),
    rows(admin, 'leads'),
    rows(admin, 'invoices'),
    rows(admin, 'projects'),
  ])

  const context = JSON.stringify({
    snapshot: body.snapshot || null,
    employees: employees.slice(0, 40),
    leads: leads.slice(0, 40),
    invoices: invoices.slice(0, 40),
    projects: projects.slice(0, 40),
  }).slice(0, 120000)

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          ...(Array.isArray(body.history) ? body.history.slice(-8).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          })) : []),
          {
            role: 'user',
            parts: [{ text: `You are the Business OS admin assistant. Use this CRM context JSON:\n${context}\n\nQuestion: ${message}` }],
          },
        ],
      }),
    }
  )
  const geminiJson = await geminiRes.json()
  const answer = geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n') || 'No answer'
  return json({ answer, toolsUsed: ['supabase_crm_context'] })
})

async function rows(admin, table) {
  const { data } = await admin.from(table).select('id,data').limit(80)
  return (data || []).map((r) => ({ id: r.id, ...r.data }))
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
