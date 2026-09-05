/**
 * Backfill employees from profiles and normalize org_id.
 * Env: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(resolve(root, '.env'))
loadEnvFile(resolve(root, 'admin-portal/.env'))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key || url === 'mock') {
  console.log('Skip repair: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(0)
}

const admin = createClient(url, key)
const skipRoles = new Set(['admin', 'owner', 'superadmin', 'client'])

const { data: profiles, error: pErr } = await admin.from('profiles').select('*')
if (pErr) throw pErr

let inserted = 0
let updatedOrg = 0
for (const p of profiles || []) {
  const role = String(p.data?.role || 'employee').toLowerCase()
  const orgId = p.org_id || p.data?.orgId || 'org_demo'
  if (p.org_id !== orgId || p.data?.orgId !== orgId) {
    const { error } = await admin.from('profiles').update({
      org_id: orgId,
      data: { ...(p.data || {}), orgId },
    }).eq('id', p.id)
    if (error) console.warn('profile org update failed', p.id, error.message)
    else updatedOrg += 1
  }
  if (skipRoles.has(role)) continue
  const { data: existing } = await admin.from('employees').select('id').eq('id', p.id).maybeSingle()
  if (existing) continue
  const { error } = await admin.from('employees').upsert({
    id: p.id,
    org_id: orgId,
    user_id: p.id,
    auth_id: p.auth_id,
    data: { ...(p.data || {}), orgId },
    updated_at: new Date().toISOString(),
  })
  if (error) console.warn('employee insert failed', p.id, error.message)
  else inserted += 1
}

const { data: employees } = await admin.from('employees').select('id,org_id,data')
for (const e of employees || []) {
  const orgId = e.org_id || e.data?.orgId || 'org_demo'
  if (!e.org_id || !e.data?.orgId) {
    await admin.from('employees').update({
      org_id: orgId,
      data: { ...(e.data || {}), orgId },
    }).eq('id', e.id)
  }
}

console.log(`Employee directory repair: inserted ${inserted} employee rows, updated ${updatedOrg} profile orgs.`)
