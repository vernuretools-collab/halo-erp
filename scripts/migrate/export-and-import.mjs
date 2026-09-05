/**
 * One-way Firebase Firestore/Storage -> Supabase import. Does not write to Firebase.
 *
 * Auth: uses GOOGLE_APPLICATION_CREDENTIALS if set, otherwise Firebase CLI
 * login tokens from ~/.config/configstore/firebase-tools.json (ADC / gcloud optional).
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Flags: --skip-firestore --skip-auth --storage --auth
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createClient } from '@supabase/supabase-js'
import { resolveCollection } from '../../shared/supabase/pathMap.js'

const require = createRequire(import.meta.url)

const FIREBASE_CLI_OAUTH = {
  client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
  client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
}

function jsonSafe(value) {
  if (value == null) return value
  if (typeof value.toDate === 'function') {
    try {
      return { __ts: value.toDate().toISOString() }
    } catch {
      return String(value)
    }
  }
  if (typeof value.seconds === 'number' && value.nanoseconds != null) {
    return { __ts: new Date(value.seconds * 1000).toISOString() }
  }
  if (value._seconds != null) {
    return { __ts: new Date(value._seconds * 1000).toISOString() }
  }
  if (typeof value.path === 'string' && value.id) return value.path
  if (Array.isArray(value)) return value.map(jsonSafe)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = jsonSafe(v)
    return out
  }
  return value
}

function row(id, data, loc) {
  const storageId = loc.user_id ? `${loc.user_id}__${id}` : id
  return {
    id: storageId,
    org_id: loc.org_id || data.orgId || null,
    user_id: loc.user_id || data.uid || data.employeeId || data.userId || null,
    parent_id: loc.parent_id || null,
    collection_name: loc.collection_name || null,
    auth_id: loc.auth_id || null,
    data: jsonSafe(data) || {},
    updated_at: new Date().toISOString(),
  }
}

async function upsert(supabase, table, records) {
  if (!records.length) return
  for (let i = 0; i < records.length; i += 200) {
    const chunk = records.slice(i, i + 200)
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' })
    if (error) throw new Error(`${table}: ${error.message}`)
    console.log(`upserted ${chunk.length} -> ${table}`)
  }
}

async function upsertProfilesPreserveAuth(supabase, records) {
  for (const rec of records) {
    const { data: existing, error: readErr } = await supabase
      .from('profiles')
      .select('auth_id,data')
      .eq('id', rec.id)
      .maybeSingle()
    if (readErr) throw readErr
    const merged = {
      ...rec,
      auth_id: existing?.auth_id || rec.auth_id || null,
      data: { ...(existing?.data || {}), ...rec.data },
    }
    const { error } = await supabase.from('profiles').upsert(merged, { onConflict: 'id' })
    if (error) throw error
  }
  console.log(`merged ${records.length} -> profiles (auth_id preserved)`)
}

const WALK_SUBCOLLECTIONS = new Set([
  'organizations',
  'projects',
  'documents',
  'payslips',
  'goals',
  'employeeGoals',
  'notifications',
])

async function walkCollection(colRef, pathParts, docs) {
  const snap = await colRef.get()
  const walkSubs = WALK_SUBCOLLECTIONS.has(pathParts[0])
  console.log(`  ${pathParts.join('/')} docs=${snap.size} walkSubs=${walkSubs}`)
  for (const docSnap of snap.docs) {
    const docPath = [...pathParts, docSnap.id]
    docs.push({ path: docPath, data: docSnap.data() || {} })
    if (!walkSubs) continue
    const subs = await docSnap.ref.listCollections()
    for (const sub of subs) {
      await walkCollection(sub, [...docPath, sub.id], docs)
    }
  }
}

async function dumpAllDocs(db) {
  const docs = []
  const roots = await db.listCollections()
  for (const col of roots) {
    console.log('scanning', col.id)
    await walkCollection(col, [col.id], docs)
  }
  return docs
}

function groupedByTable(docs) {
  const groups = new Map()
  for (const item of docs) {
    const id = item.path[item.path.length - 1]
    const colParts = item.path.slice(0, -1)
    const loc = resolveCollection(colParts)
    const rec = row(id, item.data, loc)
    if (!groups.has(loc.table)) groups.set(loc.table, [])
    groups.get(loc.table).push(rec)
  }
  return groups
}

function loadFirebaseCliCredential() {
  const cfgPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json')
  if (!fs.existsSync(cfgPath)) return null
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  const refresh = cfg.tokens?.refresh_token
  if (!refresh) return null
  return {
    type: 'authorized_user',
    client_id: FIREBASE_CLI_OAUTH.client_id,
    client_secret: FIREBASE_CLI_OAUTH.client_secret,
    refresh_token: refresh,
  }
}

function writeAdcFromFirebaseCli() {
  const refresh = loadFirebaseCliCredential()
  if (!refresh) return null
  const adcPath = path.join(os.tmpdir(), 'new-crm-firebase-adc.json')
  fs.writeFileSync(adcPath, JSON.stringify(refresh, null, 2))
  process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath
  return adcPath
}

function initAdmin() {
  const admin = require('firebase-admin')
  if (admin.apps.length) return admin
  const projectId = process.env.FIREBASE_PROJECT_ID || 'new-crm-8165a'
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`
  const opts = { projectId, storageBucket: bucket }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adc = writeAdcFromFirebaseCli()
    if (adc) console.log('firebase-admin: ADC from Firebase CLI login')
  }

  admin.initializeApp(opts)
  return admin
}

async function copyStorage(admin, supabase) {
  const bucket = admin.storage().bucket()
  const [files] = await bucket.getFiles({ prefix: '' })
  console.log(`storage objects: ${files.length}`)
  for (const file of files) {
    const dest = file.name
    if (!dest || dest.endsWith('/')) continue
    const [buf] = await file.download()
    const [bkt, ...rest] = dest.split('/')
    const bucketName = ['employees', 'deliverables', 'payslips'].includes(bkt) ? bkt : 'employees'
    const objectPath = ['employees', 'deliverables', 'payslips'].includes(bkt) ? rest.join('/') : dest
    const { error } = await supabase.storage.from(bucketName).upload(objectPath, buf, { upsert: true })
    if (error) console.warn('storage', dest, error.message)
    else console.log('uploaded', dest)
  }
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')

  const admin = initAdmin()
  const db = admin.firestore()
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  if (!process.argv.includes('--skip-firestore')) {
    const docs = await dumpAllDocs(db)
    console.log(`firestore docs: ${docs.length}`)
    const groups = groupedByTable(docs)
    for (const [table, records] of groups) {
      if (table === 'profiles') await upsertProfilesPreserveAuth(supabase, records)
      else await upsert(supabase, table, records)
    }
  }

  if (process.argv.includes('--auth')) {
    console.log('skipping --auth: use import-firebase-auth.mjs (scrypt passwords already imported)')
  }

  if (process.argv.includes('--storage')) await copyStorage(admin, supabase)

  console.log('Migration pass complete. Live Firebase data was not modified.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
