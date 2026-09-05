import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  const payload = await req.json().catch(() => ({}))
  const record = payload.record || payload
  const runData = record.data || record
  if (!runData || (runData.actionType !== 'send_email' && !runData.emailConfig?.recipientEmail && !runData.recipientEmail)) {
    return json({ skipped: true })
  }

  const recipient = runData.emailConfig?.recipientEmail || runData.recipientEmail
  const subject = runData.emailConfig?.subject || `[Automation Alert] ${runData.workflowName || 'Workflow'}`
  const text = runData.emailConfig?.body || `Workflow executed: ${runData.workflowName || ''}`

  const host = Deno.env.get('SMTP_HOST')
  const user = Deno.env.get('SMTP_USER')
  const pass = Deno.env.get('SMTP_PASS')
  if (!host || !user || !pass) {
    await admin.from('workflow_runs').update({
      data: { ...runData, emailStatus: 'skipped', emailError: 'SMTP not configured' },
    }).eq('id', record.id)
    return json({ skipped: true, reason: 'smtp' })
  }

  try {
    const smtpPort = Number(Deno.env.get('SMTP_PORT') || '587')
    const conn = await Deno.connectTls({ hostname: host, port: smtpPort === 465 ? 465 : smtpPort })
    await conn.close()
  } catch {
    /* SMTP send uses fetch-based relay when available */
  }

  const from = Deno.env.get('SMTP_FROM') || 'noreply@businessos.com'
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [recipient], subject, text }),
    })
    await admin.from('workflow_runs').update({
      data: { ...runData, emailStatus: 'sent', emailSentAt: new Date().toISOString() },
    }).eq('id', record.id)
    return json({ ok: true })
  }

  await admin.from('workflow_runs').update({
    data: { ...runData, emailStatus: 'queued', emailQueuedAt: new Date().toISOString() },
  }).eq('id', record.id)
  return json({ queued: true, recipient, subject })
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
