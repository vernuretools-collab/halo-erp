/**
 * Read-only Firebase vs Supabase counts. Does not write to either side.
 * Usage: node inventory.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMigrateEnv } from './loadEnv.mjs'
import {
  dumpAllDocs,
  initAdmin,
  printInventory,
  findMissedSubcollections,
} from './export-and-import.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
loadMigrateEnv(root)

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')

const admin = initAdmin()
const db = admin.firestore()
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

console.log(`Supabase: ${url}`)
console.log(`Firebase: ${process.env.FIREBASE_PROJECT_ID || 'new-crm-8165a'}`)

const extra = {}
try {
  extra.firebaseStorageCount = (await admin.storage().bucket().getFiles({ prefix: '' }))[0].length
} catch (err) {
  extra.firebaseStorageCount = `err: ${err.message}`
}

const missed = await findMissedSubcollections(db)
extra.missedSubs = missed.missed
extra.roots = missed.roots

const docs = await dumpAllDocs(db)
console.log(`firestore docs: ${docs.length}`)
await printInventory(docs, supabase, extra)

const rpcs = [
  ['company_org_id', {}],
  ['same_company_org', { row_org: 'org_demo' }],
  ['can_access_row', { org_id: 'org_demo', user_id: 'x' }],
  ['self_role', {}],
  ['can_access_project_id', { p_project_id: 'x' }],
]
console.log('\n=== SQL migration probes (00003+) ===')
for (const [name, args] of rpcs) {
  const { error } = await supabase.rpc(name, args)
  if (!error) console.log(`  ${name}: present`)
  else if (/could not find/i.test(error.message) || error.code === 'PGRST202') console.log(`  ${name}: MISSING (${error.message})`)
  else console.log(`  ${name}: ${error.message}`)
}

console.log('\nInventory complete. No data was written.')
