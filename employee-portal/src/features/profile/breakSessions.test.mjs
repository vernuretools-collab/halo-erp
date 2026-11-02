import assert from 'node:assert/strict'
import {
  formatDuration,
  formatSessionRange,
  kindLabel,
  pauseSessions,
  sessionMinutes,
} from './breakSessions.js'

const at = (h, min, day = 2) => new Date(2026, 10, day, h, min, 0).getTime()

const tea = [
  { type: 'break_start', timestamp: at(13, 0) },
  { type: 'break_end', timestamp: at(13, 35) },
]

const sessions = pauseSessions(tea)
assert.equal(sessions.length, 1)
assert.equal(sessions[0].kind, 'tea')
assert.equal(sessionMinutes(sessions[0]), 35)
assert.equal(kindLabel('tea'), 'Tea break')
assert.equal(kindLabel('lunch'), 'Lunch')
assert.match(formatSessionRange(sessions[0]), /1:00\sPM\s–\s1:35\sPM/)
assert.equal(formatDuration(35), '35 min')

const ignoredEnd = pauseSessions([
  { type: 'break_end', timestamp: at(9, 0) },
  { type: 'lunch_start', timestamp: at(12, 30) },
  { type: 'lunch_end', timestamp: at(13, 0) },
  { type: 'break_start', timestamp: at(16, 0) },
])
assert.equal(ignoredEnd.length, 2)
assert.equal(ignoredEnd[0].kind, 'lunch')
assert.equal(sessionMinutes(ignoredEnd[0]), 30)
assert.equal(ignoredEnd[1].kind, 'tea')
assert.equal(ignoredEnd[1].endMs, null)
assert.equal(sessionMinutes(ignoredEnd[1], at(16, 12)), 12)
assert.match(formatSessionRange(ignoredEnd[1]), /4:00\sPM\s–\snow/)

const twoTeas = pauseSessions([
  { type: 'break_start', timestamp: at(10, 0) },
  { type: 'break_end', timestamp: at(10, 15) },
  { type: 'break_start', timestamp: at(15, 5) },
  { type: 'break_end', timestamp: at(15, 20) },
])
assert.equal(twoTeas.length, 2)
assert.equal(sessionMinutes(twoTeas[0]), 15)
assert.equal(sessionMinutes(twoTeas[1]), 15)

console.log('breakSessions tests passed')
