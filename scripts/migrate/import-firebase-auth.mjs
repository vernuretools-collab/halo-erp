/**
 * Import Firebase auth:export JSON into Supabase Auth with $fbscrypt$ hashes
 * so existing passwords keep working. Does not write to Firebase.
 *
 * Env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   FIREBASE_USERS_JSON   default: %USERPROFILE%\Downloads\firebase-users.json
 *   FIREBASE_HASH_CONFIG  default: %USERPROFILE%\Downloads\firebase-hash-config.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

function toStdB64(value) {
  if (!value) return value
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const rem = padded.length % 4
  return rem ? padded + '='.repeat(4 - rem) : padded
}

function fbscryptHash(user, cfg) {
  const n = cfg.mem_cost
  const r = cfg.rounds
  const p = 1
  const ss = cfg.base64_salt_separator
  const sk = cfg.base64_signer_key
  const salt = toStdB64(user.salt)
  const hash = toStdB64(user.passwordHash)
  return `$fbscrypt$v=1,n=${n},r=${r},p=${p},ss=${ss},sk=${sk}$${salt}$${hash}`
}

async function main() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')

  const usersPath = process.env.FIREBASE_USERS_JSON
    || path.join(process.env.USERPROFILE, 'Downloads', 'firebase-users.json')
  const cfgPath = process.env.FIREBASE_HASH_CONFIG
    || path.join(process.env.USERPROFILE, 'Downloads', 'firebase-hash-config.json')

  const exported = JSON.parse(fs.readFileSync(usersPath, 'utf8'))
  const users = exported.users || exported
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const uidMap = {}
  let ok = 0
  let failed = 0

  for (const user of users) {
    const email = user.email
    if (!email) {
      console.warn('skip (no email)', user.localId)
      continue
    }
    if (!user.passwordHash || !user.salt) {
      console.warn('skip (no password hash)', email)
      continue
    }

    const payload = {
      email,
      email_confirm: true,
      password_hash: fbscryptHash(user, cfg),
      user_metadata: {
        displayName: user.displayName || email.split('@')[0],
        firebase_uid: user.localId,
      },
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        business_uid: user.localId,
      },
    }

    let authId = null
    const created = await supabase.auth.admin.createUser(payload)
    if (created.error && /already|registered|exists/i.test(created.error.message)) {
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())
      if (existing) {
        const updated = await supabase.auth.admin.updateUserById(existing.id, {
          password_hash: payload.password_hash,
          email_confirm: true,
          user_metadata: payload.user_metadata,
          app_metadata: { ...existing.app_metadata, ...payload.app_metadata },
        })
        if (updated.error) {
          console.warn('update failed', email, updated.error.message)
          failed += 1
          continue
        }
        authId = existing.id
      } else {
        console.warn('exists but not found', email, created.error.message)
        failed += 1
        continue
      }
    } else if (created.error) {
      console.warn('create failed', email, created.error.message)
      failed += 1
      continue
    } else {
      authId = created.data.user.id
    }

    uidMap[user.localId] = authId
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: user.localId,
      auth_id: authId,
      user_id: user.localId,
      data: {
        uid: user.localId,
        email,
        displayName: user.displayName || email.split('@')[0],
        status: 'active',
        role: 'employee',
        tier: 'company',
      },
      updated_at: new Date().toISOString(),
    })
    if (profileErr) console.warn('profile', email, profileErr.message)
    ok += 1
    console.log('imported', email)
  }

  const mapPath = path.join(path.dirname(usersPath), 'firebase-supabase-uid-map.json')
  fs.writeFileSync(mapPath, JSON.stringify(uidMap, null, 2))
  console.log(`done ok=${ok} failed=${failed} map=${mapPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
