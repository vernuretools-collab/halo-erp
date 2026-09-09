import assert from 'node:assert/strict'
import {
  orderColumnForField,
  serverLimitFor,
  classifyWheres,
  isPushSafeValue,
  columnRealtimeFilter,
} from './queryPushdown.js'

assert.equal(orderColumnForField('createdAt'), 'created_at')
assert.equal(orderColumnForField('updatedAt'), 'updated_at')
assert.equal(orderColumnForField('calculatedAt'), 'data->calculatedAt->>__ts')
assert.equal(orderColumnForField('status'), 'data->>status')

assert.equal(isPushSafeValue('open'), true)
assert.equal(isPushSafeValue('2024-01-01T00:00:00.000Z'), false)
assert.equal(isPushSafeValue({ __ts: '2024-01-01T00:00:00.000Z' }), false)

const eqLimit = [
  { kind: 'where', field: 'status', op: '==', value: 'open' },
  { kind: 'limit', n: 10 },
]
assert.equal(classifyWheres(eqLimit).pushedAll, true)
assert.equal(serverLimitFor(eqLimit, true), 10)

const orderLimit = [
  { kind: 'orderBy', field: 'createdAt', dir: 'desc' },
  { kind: 'limit', n: 10 },
]
assert.equal(serverLimitFor(orderLimit, true), 40)

const mixed = [
  { kind: 'where', field: 'createdAt', op: '>=', value: { __ts: 'x' } },
  { kind: 'orderBy', field: 'createdAt', dir: 'desc' },
  { kind: 'limit', n: 10 },
]
assert.equal(classifyWheres(mixed).pushedAll, false)
assert.equal(serverLimitFor(mixed, false), 40)

assert.equal(
  columnRealtimeFilter({ user_id: 'u1' }, []),
  'user_id=eq.u1'
)
assert.equal(
  columnRealtimeFilter({}, [{ kind: 'where', field: 'org_id', op: '==', value: 'org1' }]),
  'org_id=eq.org1'
)
assert.equal(
  columnRealtimeFilter({}, [{ kind: 'where', field: 'uid', op: '==', value: 'u1' }]),
  undefined
)

console.log('queryPushdown tests passed')
