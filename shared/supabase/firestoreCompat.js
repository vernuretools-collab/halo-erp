import { supabase } from './client.js'
import { flattenPath, resolveCollection } from './pathMap.js'

const TS = '__ts'

export function serverTimestamp() {
  return { _method: 'serverTimestamp' }
}

export function arrayUnion(...elements) {
  return { _method: 'arrayUnion', elements }
}

export function deleteField() {
  return { _method: 'deleteField' }
}

function nowIso() {
  return new Date().toISOString()
}

function wrapTs(iso) {
  const d = new Date(iso)
  return {
    [TS]: iso,
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => d,
    toISOString: () => iso,
  }
}

function reviveValue(value) {
  if (value && typeof value === 'object' && value[TS]) return wrapTs(value[TS])
  if (Array.isArray(value)) return value.map(reviveValue)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = reviveValue(v)
    return out
  }
  return value
}

function unwrapValue(value) {
  if (value == null) return value
  if (value._method === 'serverTimestamp') return { [TS]: nowIso() }
  if (typeof value.toDate === 'function') return { [TS]: value.toDate().toISOString() }
  if (Array.isArray(value)) return value.map(unwrapValue)
  if (typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = unwrapValue(v)
    return out
  }
  return value
}

function setDeep(obj, keys, val) {
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (typeof cur[k] !== 'object' || cur[k] == null) cur[k] = {}
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = val
}

function deleteDeep(obj, keys) {
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]]) return
    cur = cur[keys[i]]
  }
  delete cur[keys[keys.length - 1]]
}

function applyPatch(base, updates) {
  const next = JSON.parse(JSON.stringify(unwrapValue(base) || {}))
  for (const [key, val] of Object.entries(updates || {})) {
    const path = key.split('.')
    if (val && val._method === 'deleteField') {
      if (path.length === 1) delete next[key]
      else deleteDeep(next, path)
    } else if (val && val._method === 'arrayUnion') {
      const existing = path.length === 1 ? next[key] : undefined
      const arr = Array.isArray(existing) ? existing : []
      const merged = [...arr]
      for (const el of val.elements) {
        if (!merged.includes(el)) merged.push(el)
      }
      if (path.length === 1) next[key] = merged
      else setDeep(next, path, merged)
    } else if (path.length > 1) {
      setDeep(next, path, unwrapValue(val))
    } else {
      next[key] = unwrapValue(val)
    }
  }
  return next
}

function newId() {
  return crypto.randomUUID()
}

function scopeMatch(row, loc) {
  if (loc.org_id && row.org_id !== loc.org_id) return false
  if (loc.user_id && row.user_id !== loc.user_id) return false
  if (loc.parent_id && row.parent_id !== loc.parent_id) return false
  if (loc.collection_name && row.collection_name !== loc.collection_name) return false
  return true
}

function scopedStorageId(loc, logicalId) {
  if (!loc.user_id || !logicalId) return logicalId
  const prefix = `${loc.user_id}__`
  if (String(logicalId).startsWith(prefix)) return String(logicalId)
  return `${prefix}${logicalId}`
}

function logicalDocId(row, loc) {
  const id = String(row?.id || '')
  if (loc.user_id) {
    const prefix = `${loc.user_id}__`
    if (id.startsWith(prefix)) return id.slice(prefix.length)
  }
  return id
}

function rowMatchesLogicalId(row, loc, logicalId) {
  if (!row) return false
  if (row.id === logicalId) return true
  if (loc.user_id && row.id === scopedStorageId(loc, logicalId)) return true
  return logicalDocId(row, loc) === String(logicalId)
}

function rowToSnap(row, loc) {
  const data = reviveValue(row.data || {})
  const id = logicalDocId(row, loc)
  const ref = { type: 'doc', id, ...loc }
  return {
    id,
    ref,
    exists: () => true,
    data: () => data,
    metadata: { hasPendingWrites: false, fromCache: false },
  }
}

function emptySnap(ref) {
  return {
    id: ref.id,
    ref,
    exists: () => false,
    data: () => undefined,
    metadata: { hasPendingWrites: false, fromCache: false },
  }
}

function queryValue(val) {
  if (val && val[TS]) return val[TS]
  if (val && typeof val.toDate === 'function') return val.toDate().toISOString()
  return val
}

function getField(data, field) {
  if (!field.includes('.')) return data?.[field]
  return field.split('.').reduce((acc, k) => acc?.[k], data)
}

function fieldSortValue(val) {
  if (val && val[TS]) return val[TS]
  if (val && typeof val.toDate === 'function') return val.toDate().toISOString()
  if (val && typeof val === 'object' && val.seconds) return new Date(val.seconds * 1000).toISOString()
  return val
}

function applyConstraints(rows, constraints) {
  let out = rows
  for (const c of constraints) {
    if (c.kind === 'where') {
      const { field, op, value } = c
      const cmp = queryValue(value)
      out = out.filter((row) => {
        const left = fieldSortValue(getField(row.data, field))
        if (op === '==') return left == cmp
        if (op === '!=') return left != cmp
        if (op === '>=') return left >= cmp
        if (op === '<=') return left <= cmp
        if (op === '>') return left > cmp
        if (op === '<') return left < cmp
        if (op === 'in') return Array.isArray(cmp) && cmp.includes(left)
        if (op === 'array-contains') return Array.isArray(left) && left.includes(cmp)
        return true
      })
    }
  }
  const order = constraints.filter((c) => c.kind === 'orderBy')
  if (order.length) {
    out = [...out].sort((a, b) => {
      for (const o of order) {
        const av = fieldSortValue(getField(a.data, o.field))
        const bv = fieldSortValue(getField(b.data, o.field))
        if (av == null && bv == null) continue
        if (av == null) return 1
        if (bv == null) return -1
        if (av < bv) return o.dir === 'desc' ? 1 : -1
        if (av > bv) return o.dir === 'desc' ? -1 : 1
      }
      return 0
    })
  }
  const lim = constraints.find((c) => c.kind === 'limit')
  if (lim) out = out.slice(0, lim.n)
  return out
}

async function fetchRows(loc) {
  if (!supabase) return []
  let q = supabase.from(loc.table).select('*')
  if (loc.org_id) q = q.eq('org_id', loc.org_id)
  if (loc.user_id) q = q.eq('user_id', loc.user_id)
  if (loc.parent_id) q = q.eq('parent_id', loc.parent_id)
  if (loc.collection_name) q = q.eq('collection_name', loc.collection_name)
  const { data, error } = await q
  if (error) throw error
  return (data || []).filter((row) => scopeMatch(row, loc))
}

function snapshotFromRows(rows, loc, prevDocs) {
  const docs = rows.map((row) => rowToSnap(row, loc))
  const changes = diffDocChanges(prevDocs, docs)
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (fn) => docs.forEach(fn),
    docChanges: () => changes,
  }
}

function diffDocChanges(prevDocs, nextDocs) {
  if (!prevDocs) {
    return nextDocs.map((doc, index) => ({
      type: 'added',
      doc,
      oldIndex: -1,
      newIndex: index,
    }))
  }
  const prevById = new Map(prevDocs.map((doc, index) => [doc.id, { doc, index }]))
  const nextById = new Map(nextDocs.map((doc, index) => [doc.id, { doc, index }]))
  const changes = []
  for (const [id, { doc, index }] of nextById) {
    if (!prevById.has(id)) {
      changes.push({ type: 'added', doc, oldIndex: -1, newIndex: index })
      continue
    }
    const before = prevById.get(id)
    try {
      if (JSON.stringify(before.doc.data()) !== JSON.stringify(doc.data())) {
        changes.push({ type: 'modified', doc, oldIndex: before.index, newIndex: index })
      }
    } catch {
      changes.push({ type: 'modified', doc, oldIndex: before.index, newIndex: index })
    }
  }
  for (const [id, { doc, index }] of prevById) {
    if (!nextById.has(id)) {
      changes.push({ type: 'removed', doc, oldIndex: index, newIndex: -1 })
    }
  }
  return changes
}

export function collection(db, ...path) {
  const loc = resolveCollection(flattenPath(path))
  return { type: 'col', ...loc, _constraints: [] }
}

export function doc(dbOrRef, ...path) {
  if (dbOrRef && dbOrRef.type === 'col') {
    const id = path.length ? String(path[0]) : newId()
    return { type: 'doc', id, table: dbOrRef.table, org_id: dbOrRef.org_id, user_id: dbOrRef.user_id, parent_id: dbOrRef.parent_id, collection_name: dbOrRef.collection_name }
  }
  const parts = flattenPath(path)
  const id = parts.pop()
  const loc = resolveCollection(parts)
  return { type: 'doc', id, ...loc }
}

export function query(colRef, ...constraints) {
  return { ...colRef, _constraints: [...(colRef._constraints || []), ...constraints] }
}

export function where(field, op, value) {
  return { kind: 'where', field, op, value }
}

export function orderBy(field, dir = 'asc') {
  return { kind: 'orderBy', field, dir }
}

export function limit(n) {
  return { kind: 'limit', n }
}

function scopeFields(loc, id, data) {
  const orgId = loc.org_id || data.orgId || data.organizationId || null
  const userId = loc.user_id || data.uid || data.employeeId || data.userId || null
  return {
    id,
    org_id: orgId,
    user_id: loc.table === 'profiles' ? id : userId,
    parent_id: loc.parent_id,
    collection_name: loc.collection_name,
    data,
    updated_at: nowIso(),
  }
}

async function findRow(ref) {
  if (!supabase) return null
  if (ref.user_id) {
    const { data, error } = await supabase.from(ref.table).select('*').eq('user_id', ref.user_id)
    if (error) throw error
    return (data || []).find((row) => rowMatchesLogicalId(row, ref, ref.id)) || null
  }
  const byId = await supabase.from(ref.table).select('*').eq('id', ref.id).maybeSingle()
  if (byId.error) throw byId.error
  if (byId.data && scopeMatch(byId.data, ref)) return byId.data
  return null
}

export async function getDoc(ref) {
  if (!supabase) return emptySnap(ref)
  const data = await findRow(ref)
  if (!data) return emptySnap(ref)
  return rowToSnap(data, ref)
}

export async function getDocs(q) {
  const loc = q
  const rows = applyConstraints(await fetchRows(loc), loc._constraints || [])
  return snapshotFromRows(rows, loc)
}

export async function setDoc(ref, data, options = {}) {
  if (!supabase) return
  const incoming = unwrapValue(data)
  let payload = incoming
  if (options.merge) {
    const existing = await getDoc(ref)
    payload = { ...(existing.exists() ? unwrapValue(existing.data()) : {}), ...incoming }
  }
  const existingRow = await findRow(ref)
  const storageId = existingRow?.id || scopedStorageId(ref, ref.id)
  const row = { ...scopeFields(ref, storageId, payload), created_at: existingRow?.created_at || nowIso() }
  if (ref.table === 'profiles') {
    const { data: sess } = await supabase.auth.getSession()
    if (sess?.session?.user && (payload.auth_id || sess.session.user.email === payload.email)) {
      row.auth_id = payload.auth_id || sess.session.user.id
    }
  }
  const { error } = await supabase.from(ref.table).upsert(row, { onConflict: 'id' })
  if (error) throw error
}

export async function addDoc(colRef, data) {
  const id = newId()
  const ref = doc(colRef, id)
  await setDoc(ref, data)
  return ref
}

export async function updateDoc(ref, updates) {
  if (!supabase) return
  const existingSnap = await getDoc(ref)
  const existingRow = await findRow(ref)
  const base = existingSnap.exists() ? existingSnap.data() : {}
  const payload = applyPatch(base, updates)
  const storageId = existingRow?.id || scopedStorageId(ref, ref.id)
  const row = scopeFields(ref, storageId, unwrapValue(payload))
  if (existingRow) {
    const { error } = await supabase.from(ref.table).update(row).eq('id', existingRow.id)
    if (error) throw error
  } else {
    await setDoc(ref, payload)
  }
}

export async function deleteDoc(ref) {
  if (!supabase) return
  const existingRow = await findRow(ref)
  const storageId = existingRow?.id || scopedStorageId(ref, ref.id)
  const { error } = await supabase.from(ref.table).delete().eq('id', storageId)
  if (error) throw error
}

export function onSnapshot(refOrQuery, onNext, onError) {
  let cancelled = false
  const loc = refOrQuery
  const isDoc = loc.type === 'doc'
  let prevDocs

  const emit = async () => {
    try {
      if (cancelled) return
      if (isDoc) {
        onNext(await getDoc(loc))
        return
      }
      const snap = snapshotFromRows(
        applyConstraints(await fetchRows(loc), loc._constraints || []),
        loc,
        prevDocs
      )
      prevDocs = snap.docs
      onNext(snap)
    } catch (err) {
      if (onError) onError(err)
      else console.warn(err)
    }
  }

  emit()
  if (!supabase) return () => { cancelled = true }

  const channel = supabase
    .channel(`fs:${loc.table}:${loc.id || loc.org_id || loc.user_id || loc.parent_id || 'all'}:${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: loc.table }, () => emit())
    .subscribe()

  return () => {
    cancelled = true
    supabase.removeChannel(channel)
  }
}

export function writeBatch() {
  const ops = []
  return {
    set(ref, data, options) {
      ops.push(() => setDoc(ref, data, options || {}))
      return this
    },
    update(ref, data) {
      ops.push(() => updateDoc(ref, data))
      return this
    },
    delete(ref) {
      ops.push(() => deleteDoc(ref))
      return this
    },
    async commit() {
      for (const op of ops) await op()
    },
  }
}

export const Timestamp = {
  now: () => wrapTs(nowIso()),
  fromDate: (d) => wrapTs(d.toISOString()),
}
