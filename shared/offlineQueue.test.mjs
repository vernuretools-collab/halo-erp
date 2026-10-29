import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeShiftLogs } from './shiftLogs.js'
import {
  completeTimelineCreate,
  createLocalTimelineEntry,
  dropAttendanceSave,
  emptyTimelineOutbox,
  mergeLoadedShiftLogs,
  mergeTimelineView,
  rememberAttendanceSave,
  rememberTimelineCreate,
} from './offlineQueue.js'

test('a failed attendance save is retained and a later flush unions break and lunch', () => {
  let queue = {}
  queue = rememberAttendanceSave(queue, 'emp', '2026-10-28', {
    isOnBreak: true,
    shiftLogs: [
      { id: 'in', type: 'clock_in', timestamp: 1 },
      { id: 'bs', type: 'break_start', timestamp: 2 },
    ],
  })
  assert.equal(queue['2026-10-28_emp'].payload.isOnBreak, true)

  queue = rememberAttendanceSave(queue, 'emp', '2026-10-28', {
    isOnBreak: false,
    isOnLunch: true,
    shiftLogs: [
      { id: 'in', type: 'clock_in', timestamp: 1 },
      { id: 'ls', type: 'lunch_start', timestamp: 4 },
    ],
  })

  const retained = queue['2026-10-28_emp'].payload
  assert.equal(retained.isOnLunch, true)
  assert.equal(retained.isOnBreak, false)
  const flushed = mergeShiftLogs(
    [{ id: 'in', type: 'clock_in', timestamp: 1 }],
    retained.shiftLogs
  )
  assert.deepEqual(flushed.map((entry) => entry.id), ['ls', 'bs', 'in'])

  queue = dropAttendanceSave(queue, 'emp', '2026-10-28')
  assert.equal(queue['2026-10-28_emp'], undefined)
})

test('an admin edit replaces the shift log', () => {
  const local = [
    { id: 'bs', type: 'break_start', timestamp: 2 },
    { id: 'in', type: 'clock_in', timestamp: 1 },
  ]
  const server = [{ id: 'in', type: 'clock_in', timestamp: 5, label: 'Edited' }]
  assert.deepEqual(mergeLoadedShiftLogs(local, server, 'admin_edit'), server)
  assert.deepEqual(
    mergeLoadedShiftLogs(local, server).map((entry) => entry.id),
    ['bs', 'in']
  )
})

test('a failed timeline create stays pending and leaves after a successful retry', () => {
  let queue = emptyTimelineOutbox()
  const entry = createLocalTimelineEntry(
    { uid: 'u1', date: '2026-10-28', description: 'Client follow-ups', hours: 2 },
    1000
  )
  queue = rememberTimelineCreate(queue, entry)
  const visible = mergeTimelineView([], queue)
  assert.equal(visible.length, 1)
  assert.equal(visible[0].pendingSync, true)
  assert.equal(visible[0].description, 'Client follow-ups')
  assert.equal(visible[0].entryId, 'local_1000')

  queue = completeTimelineCreate(queue, entry.entryId)
  assert.deepEqual(mergeTimelineView([], queue), [])
})
