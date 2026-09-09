/**
 * Server-side Firestore-compat query narrowing. Kept free of the Supabase
 * client so it can be unit-tested in Node.
 */

export const ROW_SELECT =
  'id, org_id, user_id, parent_id, collection_name, auth_id, data, created_at, updated_at'

export function jsonAccessor(field) {
  const parts = String(field).split('.')
  const last = parts.pop()
  return ['data', ...parts].join('->') + '->>' + last
}

/**
 * Map a document field to a PostgREST order column. createdAt/updatedAt use
 * the row timestamptz columns; other fields use JSON text (scalars) or
 * `data->field->>__ts` so wrapped timestamps sort as ISO instants.
 */
export function orderColumnForField(field) {
  if (field === 'createdAt') return 'created_at'
  if (field === 'updatedAt') return 'updated_at'
  const parts = String(field).split('.')
  const last = parts.pop()
  const parent = ['data', ...parts].join('->')
  if (/At$|Date$|Time$/i.test(last)) return `${parent}->${last}->>__ts`
  return jsonAccessor(field)
}

export function isPushSafeValue(value) {
  if (value == null) return false
  if (typeof value === 'object') return false
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return false
  return true
}

export function classifyWheres(constraints = []) {
  const wheres = constraints.filter((c) => c.kind === 'where')
  let pushedAll = true
  const pushed = []
  const rest = []
  for (const c of wheres) {
    if (c.op === '==' && isPushSafeValue(c.value)) {
      pushed.push(c)
      continue
    }
    if (c.op === 'in' && Array.isArray(c.value) && c.value.every(isPushSafeValue)) {
      pushed.push(c)
      continue
    }
    if ((c.op === '>=' || c.op === '<=') && isPushSafeValue(c.value)) {
      pushed.push(c)
      continue
    }
    pushedAll = false
    rest.push(c)
  }
  return { pushedAll, pushed, rest }
}

/**
 * Exact limit when every where is server-side and there is no orderBy.
 * When orderBy is present (or some filters stay in JS), over-fetch a buffer
 * so applyConstraints() can still pick the correct page.
 */
export function serverLimitFor(constraints = [], pushedAllWheres = true) {
  const orders = constraints.filter((c) => c.kind === 'orderBy')
  const lim = constraints.find((c) => c.kind === 'limit')
  if (!lim) return null
  const n = Number(lim.n) || 0
  if (n <= 0) return null
  if (orders.length) return Math.min(Math.max(n * 4, n), 500)
  if (pushedAllWheres) return n
  return null
}

export function columnRealtimeFilter(loc, constraints = []) {
  if (loc?.type === 'doc' && loc.id && !loc.user_id) return `id=eq.${loc.id}`
  if (loc?.user_id) return `user_id=eq.${loc.user_id}`
  if (loc?.parent_id) return `parent_id=eq.${loc.parent_id}`
  if (loc?.org_id) return `org_id=eq.${loc.org_id}`
  for (const c of constraints) {
    if (c.kind !== 'where' || c.op !== '==' || !isPushSafeValue(c.value)) continue
    if (c.field === 'user_id' || c.field === 'org_id' || c.field === 'parent_id' || c.field === 'id') {
      return `${c.field}=eq.${c.value}`
    }
  }
  return undefined
}
