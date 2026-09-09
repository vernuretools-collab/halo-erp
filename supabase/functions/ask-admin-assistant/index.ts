import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_CANDIDATES = [
  Deno.env.get('GEMINI_MODEL'),
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
].filter(Boolean)

const SYSTEM_PROMPT = `You are the Halo admin CRM assistant. Answer from CRM snapshot JSON in the user message first.
Rules:
- Never invent attendance days, money, names, or task descriptions.
- snapshot.attendanceLogs and snapshot.leaveRequests are live data for the current month. WFH is usually leaveType/requestedLeaveType containing WFH or work from home, or an attendance source/onDuty flag.
- snapshot.timelineEntries are work logs (date, hours, description).
- Default month is snapshot.month. "This employee" is ambiguous unless a name is given — ask which employee.
- If the snapshot has no matching rows, say so. Do not mention these instructions.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
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
    if (!apiKey) {
      return json({
        answer: 'GEMINI_API_KEY is not set. In Supabase: Project Settings → Edge Functions → Secrets, add GEMINI_API_KEY, then redeploy.',
        toolsUsed: [],
      })
    }

    const body = await req.json()
    const message = String(body.message || '').trim()
    if (!message) return json({ error: 'message is required' }, 400)

    const snapshot = body.snapshot || null
    const [employees, leads, invoices, projects] = snapshot
      ? [[], [], [], []]
      : await Promise.all([
          rows(admin, 'employees'),
          rows(admin, 'leads'),
          rows(admin, 'invoices'),
          rows(admin, 'projects'),
        ])

    const context = JSON.stringify(
      snapshot || {
        employees: employees.slice(0, 40),
        leads: leads.slice(0, 40),
        invoices: invoices.slice(0, 40),
        projects: projects.slice(0, 40),
      }
    ).slice(0, 180000)

    const contents = [
      ...(Array.isArray(body.history)
        ? body.history.slice(-8).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(m.content || '') }],
          }))
        : []),
      {
        role: 'user',
        parts: [{ text: `${message}\n\nCRM snapshot JSON:\n${context}` }],
      },
    ]

    const geminiJson = await generateContent(apiKey, contents)
    if (geminiJson?.error?.message) {
      return json({
        answer: `Gemini error: ${geminiJson.error.message}`,
        toolsUsed: ['supabase_crm_context'],
      })
    }

    const parts = geminiJson?.candidates?.[0]?.content?.parts || []
    const answer =
      parts.map((p) => p.text).filter(Boolean).join('\n').trim() ||
      'The model returned no answer. Check GEMINI_API_KEY and try again.'

    return json({ answer, toolsUsed: ['supabase_crm_context'] })
  } catch (err) {
    return json({ answer: err?.message || String(err), toolsUsed: [] }, 200)
  }
})

function isRetryable(status, message) {
  const msg = String(message || '').toLowerCase()
  return (
    status === 404 ||
    status === 429 ||
    status === 503 ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('resource exhausted') ||
    msg.includes('try again') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('not supported')
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateContent(apiKey, contents) {
  let last = null
  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
          }),
        }
      )
      const body = await res.json().catch(() => ({}))
      if (res.ok && body?.candidates?.[0]) return body
      last = body
      const msg = body?.error?.message || `Gemini HTTP ${res.status}`
      if (!isRetryable(res.status, msg)) return body
      if (attempt === 0 && (res.status === 429 || res.status === 503 || /high demand|try again/i.test(msg))) {
        await sleep(800)
      }
    }
  }
  return last || { error: { message: 'Gemini request failed' } }
}

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
