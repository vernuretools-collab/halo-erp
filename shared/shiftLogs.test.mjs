import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeAttendanceSnapshot, mergeShiftLogs, openPause, pairedShiftLogs } from './shiftLogs.js'

test('drops an ended lunch that has no start', () => {
  const logs = pairedShiftLogs([
    { id: 'in', type: 'clock_in', label: 'Clocked In', timestamp: 1 },
    { id: 'end', type: 'lunch_end', label: 'Ended Lunch', timestamp: 2 },
  ])
  assert.deepEqual(logs.map((entry) => entry.type), ['clock_in'])
})

test('keeps a real lunch pair and a real break pair', () => {
  const logs = pairedShiftLogs([
    { id: 'ls', type: 'lunch_start', timestamp: 2 },
    { id: 'le', type: 'lunch_end', timestamp: 4 },
    { id: 'bs', type: 'break_start', timestamp: 1 },
    { id: 'be', type: 'break_end', timestamp: 3 },
  ])
  assert.deepEqual(
    logs.map((entry) => entry.type),
    ['lunch_end', 'break_end', 'lunch_start', 'break_start']
  )
  assert.equal(openPause(logs, 'lunch_start', 'lunch_end'), null)
  assert.equal(openPause(logs, 'break_start', 'break_end'), null)
})

test('website and electron logs are unioned so a stale write cannot drop a break', () => {
  const merged = mergeShiftLogs(
    [
      { id: 'in', type: 'clock_in', timestamp: 1 },
      { id: 'bs', type: 'break_start', timestamp: 2 },
    ],
    [
      { id: 'in', type: 'clock_in', timestamp: 1 },
      { id: 'be', type: 'break_end', timestamp: 3 },
    ]
  )
  assert.deepEqual(merged.map((entry) => entry.id), ['be', 'bs', 'in'])
})

test('a stale electron snapshot cannot clear a lunch that the website already started', () => {
  const next = mergeAttendanceSnapshot(
    {
      lastWorkDate: '2026-10-27',
      isOnLunch: true,
      lunchStartTime: 20,
      todayShiftLogs: [
        { id: 'ls', type: 'lunch_start', timestamp: 20 },
        { id: 'in', type: 'clock_in', timestamp: 10 },
      ],
    },
    {
      lastWorkDate: '2026-10-27',
      isOnLunch: false,
      lunchStartTime: null,
      isOnBreak: true,
      breakStartTime: 30,
      todayShiftLogs: [
        { id: 'bs', type: 'break_start', timestamp: 30 },
        { id: 'in', type: 'clock_in', timestamp: 10 },
      ],
    }
  )
  assert.equal(next.isOnLunch, true)
  assert.equal(next.isOnBreak, true)
  assert.equal(openPause(next.todayShiftLogs, 'lunch_start', 'lunch_end')?.id, 'ls')
})
