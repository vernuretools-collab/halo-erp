import assert from 'node:assert/strict'
import {
  calendarCells,
  formatLongDate,
  hasScrumNotes,
  isActiveEmployee,
  isFutureDay,
  isCurrentConductor,
  matchesEmployeeSearch,
  scrumDocId,
  scrumHasStarted,
  shiftISODate,
  todayISO,
  yesterdayISO,
} from './scrumModel.js'

const midnight = new Date(2026, 9, 3, 0, 0, 0)
assert.equal(todayISO(midnight), '2026-10-03')
assert.equal(yesterdayISO(midnight), '2026-10-02')
assert.equal(isFutureDay('2026-10-04', midnight), true)
assert.equal(isFutureDay('2026-10-03', midnight), false)
assert.equal(isFutureDay('2026-10-02', midnight), false)

const beforeScrum = new Date(2026, 9, 3, 10, 29, 0)
const atScrum = new Date(2026, 9, 3, 10, 30, 0)
assert.equal(scrumHasStarted(beforeScrum), false)
assert.equal(scrumHasStarted(atScrum), true)
assert.equal(scrumHasStarted(midnight), false)

const dayA = scrumDocId('emp_1', '2026-10-02')
const dayB = scrumDocId('emp_1', '2026-10-03')
assert.notEqual(dayA, dayB)
assert.equal(scrumDocId('emp_1', '2026-10-03'), dayB)
assert.equal(shiftISODate('2026-10-01', -1), '2026-09-30')

assert.equal(isActiveEmployee({ status: 'active' }), true)
assert.equal(isActiveEmployee({}), true)
assert.equal(isActiveEmployee({ status: 'Inactive' }), false)

assert.equal(hasScrumNotes({ morningScrum: '  ', eodUpdate: '' }), false)
assert.equal(hasScrumNotes({ morningScrum: 'Ship the review' }), true)

assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'asha'), true)
assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'example.com'), true)
assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'priya'), false)

const october2026 = calendarCells(2026, 9)
assert.equal(october2026[0], null)
assert.equal(october2026[4].iso, '2026-10-01')
assert.equal(formatLongDate('2026-10-03').includes('2026'), true)

const deepan = {
  employeeId: 'emp_deepan',
  employeeName: 'Deepan',
  employeeEmail: 'deepan@example.com',
  identityIds: ['emp_deepan', 'uid_deepan'],
}
assert.equal(
  isCurrentConductor(deepan, { user: { uid: 'uid_deepan', email: 'other@example.com' }, userDoc: {} }),
  true,
)
assert.equal(
  isCurrentConductor(deepan, { user: { uid: 'uid_jai', email: 'deepan@example.com' }, userDoc: {} }),
  true,
)
assert.equal(
  isCurrentConductor(deepan, { user: { uid: 'uid_jai', email: 'jai@example.com' }, userDoc: { employeeId: 'emp_jai' } }),
  false,
)
assert.equal(isCurrentConductor(null, { user: { uid: 'uid_deepan' } }), false)
assert.equal(isCurrentConductor({ employeeId: '' }, { user: { email: 'deepan@example.com' } }), false)

console.log('scrumModel tests passed')
