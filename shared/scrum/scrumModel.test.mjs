import assert from 'node:assert/strict'
import {
  applyAbsentScrum,
  attendanceLogIsPresent,
  calendarCells,
  formatLongDate,
  hasScrumNotes,
  isActiveEmployee,
  isFutureDay,
  conductorList,
  isCurrentConductor,
  matchesEmployeeSearch,
  scrumExportRows,
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

assert.equal(attendanceLogIsPresent(null), false)
assert.equal(attendanceLogIsPresent({ present: false, clockInTime: '09:40' }), false)
assert.equal(attendanceLogIsPresent({ clockInTime: '—' }), false)
assert.equal(attendanceLogIsPresent({ clockedIn: true }), true)
assert.equal(attendanceLogIsPresent({ regularSeconds: 120 }), true)

const asha = { id: 'emp_asha', uid: 'uid_asha', identityIds: ['emp_asha', 'uid_asha'] }
const jaiEmployee = { id: 'emp_jai', uid: 'uid_jai', identityIds: ['emp_jai', 'uid_jai'] }
const emptyDay = {
  emp_asha: { morningScrum: '', eodUpdate: '', dirty: false, exists: false, error: '' },
  emp_jai: { morningScrum: 'Ship the review', eodUpdate: '', dirty: false, exists: true, error: '' },
}
const filled = applyAbsentScrum([asha, jaiEmployee], emptyDay, {
  dateISO: '2026-10-02',
  today: '2026-10-03',
  logs: [{ uid: 'uid_jai', clockedIn: true }],
})
assert.equal(filled.emp_asha.morningScrum, 'absent')
assert.equal(filled.emp_asha.eodUpdate, 'absent')
assert.equal(filled.emp_asha.dirty, true)
assert.equal(filled.emp_jai.morningScrum, 'Ship the review')
assert.equal(filled.emp_jai.dirty, false)

const presentKept = applyAbsentScrum([asha], emptyDay, {
  dateISO: '2026-10-02',
  today: '2026-10-03',
  logs: [{ employeeId: 'emp_asha', present: true }],
})
assert.equal(presentKept.emp_asha.morningScrum, '')
assert.equal(presentKept.emp_asha.dirty, false)

const todayKept = applyAbsentScrum([asha], emptyDay, {
  dateISO: '2026-10-03',
  today: '2026-10-03',
  logs: [],
})
assert.equal(todayKept.emp_asha.morningScrum, '')

const unreadKept = applyAbsentScrum([asha], emptyDay, {
  dateISO: '2026-10-02',
  today: '2026-10-03',
  logs: null,
})
assert.equal(unreadKept, emptyDay)

const alreadyAbsent = {
  emp_asha: { morningScrum: 'absent', eodUpdate: 'absent', dirty: false, exists: true, error: '' },
}
const keptAbsent = applyAbsentScrum([asha], alreadyAbsent, {
  dateISO: '2026-10-02',
  today: '2026-10-03',
  logs: [],
})
assert.equal(keptAbsent.emp_asha.dirty, false)

assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'asha'), true)
assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'example.com'), true)
assert.equal(matchesEmployeeSearch({ name: 'Asha Rao', email: 'asha@example.com' }, 'priya'), false)

const exportRows = scrumExportRows(
  [
    { id: 'emp_asha', name: 'Asha Rao', email: 'asha@example.com' },
    { id: 'emp_jai', name: 'Jai', email: '' },
  ],
  {
    emp_asha: { morningScrum: 'Ship the review', eodUpdate: 'Review sent' },
  },
  '2026-10-03',
)
assert.equal(exportRows.length, 2)
assert.deepEqual(exportRows[0], {
  employee: 'Asha Rao',
  email: 'asha@example.com',
  date: '2026-10-03',
  morningScrum: 'Ship the review',
  eodUpdate: 'Review sent',
})
assert.deepEqual(exportRows[1], {
  employee: 'Jai',
  email: '',
  date: '2026-10-03',
  morningScrum: '',
  eodUpdate: '',
})

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

const jai = {
  employeeId: 'emp_jai',
  employeeName: 'Jai',
  employeeEmail: 'jai@example.com',
  identityIds: ['emp_jai', 'uid_jai'],
}
const team = { employees: [deepan, jai] }
assert.equal(conductorList(team).length, 2)
assert.equal(conductorList({ employees: [] }).length, 0)
assert.equal(
  isCurrentConductor(team, { user: { uid: 'uid_jai', email: 'someone@example.com' }, userDoc: {} }),
  true,
)
assert.equal(
  isCurrentConductor(team, { user: { uid: 'uid_other', email: 'jai@example.com' }, userDoc: {} }),
  true,
)
assert.equal(
  isCurrentConductor(team, { user: { uid: 'uid_other', email: 'other@example.com' }, userDoc: { employeeId: 'emp_other' } }),
  false,
)

console.log('scrumModel tests passed')
