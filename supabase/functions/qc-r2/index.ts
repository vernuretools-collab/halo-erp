import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\/v[1-9][0-9]{0,5}-[A-Za-z0-9._-]{1,180}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function objectKey(raw: unknown) {
  const key = String(raw || '').replace(/^\/+/, '')
  if (!KEY_PATTERN.test(key) || key.includes('..')) return ''
  return key
}

function objectUrl(accountId: string, bucket: string, key: string) {
  const path = key.split('/').map((part) => encodeURIComponent(part)).join('/')
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}`)
  url.searchParams.set('X-Amz-Expires', '3600')
  return url
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET') || 'qc-media'
  if (!supabaseUrl || !anonKey || !accountId || !accessKeyId || !secretAccessKey) {
    return json({ error: 'File storage is not set up yet.' }, 500)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
  })
  const { data: authData, error: authErr } = await userClient.auth.getUser()
  if (authErr || !authData.user) return json({ error: 'Sign in again.' }, 401)

  const { data: staff, error: staffErr } = await userClient.rpc('is_qc_staff')
  if (staffErr || !staff) return json({ error: 'You cannot open QC files.' }, 403)

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || '')
  const key = objectKey(body.key)
  if (!key) return json({ error: 'That file name cannot be stored.' }, 400)
  if (action !== 'upload' && action !== 'read' && action !== 'delete') {
    return json({ error: 'Unknown file action.' }, 400)
  }

  const method = action === 'upload' ? 'PUT' : action === 'delete' ? 'DELETE' : 'GET'
  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })
  const signed = await r2.sign(new Request(objectUrl(accountId, bucket, key), { method }), {
    aws: { signQuery: true },
  })

  return json({ url: signed.url, key })
})
