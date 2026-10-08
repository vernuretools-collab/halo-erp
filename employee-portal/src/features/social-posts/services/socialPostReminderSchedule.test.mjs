import assert from 'node:assert/strict'
import {
  joinTime12,
  localDateKey,
  occursOn,
  occurrenceStatus,
  repeatSummary,
  resolveSocialPostPing,
  socialPostPingCopy,
  splitTime12,
  trailText,
} from './socialPostReminderSchedule.js'

const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min, 0)
const mondayNoon = at(2026, 10, 5, 12, 0)

const reminder = (overrides = {}) => ({
  id: 'r1',
  clientName: 'ABC Traders',
  platform: 'Instagram',
  contentType: 'Story',
  topic: 'Client Spotlight',
  startDate: '2026-10-05',
  time: '12:00',
  repeat: 'none',
  days: [],
  endDate: '',
  assigneeId: 'emp_john',
  assigneeName: 'John',
  enabled: true,
  postedDates: [],
  lastEarlyAt: '',
  lastDueAt: '',
  ...overrides,
})

assert.equal(localDateKey(mondayNoon), '2026-10-05')
assert.equal(joinTime12(12, 0, 'PM'), '12:00')
assert.equal(joinTime12(12, 0, 'AM'), '00:00')
assert.equal(joinTime12(1, 5, 'PM'), '13:05')
assert.equal(joinTime12(13, 0, 'PM'), null)
assert.deepEqual(splitTime12('00:15'), { hour: '12', minute: '15', meridiem: 'AM' })
assert.deepEqual(splitTime12('13:05'), { hour: '1', minute: '05', meridiem: 'PM' })

const once = reminder()
assert.equal(occursOn(once, '2026-10-05'), true)
assert.equal(occursOn(once, '2026-10-06'), false)
assert.equal(repeatSummary(once), 'Once')

const daily = reminder({ repeat: 'daily', endDate: '2026-10-07' })
assert.equal(occursOn(daily, '2026-10-04'), false)
assert.equal(occursOn(daily, '2026-10-06'), true)
assert.equal(occursOn(daily, '2026-10-08'), false)
assert.equal(repeatSummary(daily), 'Daily')

const weekly = reminder({ repeat: 'weekly', startDate: '2026-10-05' })
assert.equal(occursOn(weekly, '2026-10-05'), true)
assert.equal(occursOn(weekly, '2026-10-06'), false)
assert.equal(occursOn(weekly, '2026-10-12'), true)
assert.equal(repeatSummary(weekly), 'Weekly on Monday')

const custom = reminder({ repeat: 'custom', days: [1, 3], startDate: '2026-10-05' })
assert.equal(occursOn(custom, '2026-10-05'), true)
assert.equal(occursOn(custom, '2026-10-06'), false)
assert.equal(occursOn(custom, '2026-10-07'), true)
assert.equal(repeatSummary(custom), 'Mon, Wed')

assert.equal(occurrenceStatus(once, '2026-10-05', at(2026, 10, 5, 11, 59)), 'pending')
assert.equal(occurrenceStatus(once, '2026-10-05', mondayNoon), 'pending')
assert.equal(occurrenceStatus(once, '2026-10-05', new Date(2026, 9, 5, 12, 0, 1)), 'missed')
assert.equal(occurrenceStatus(once, '2026-10-06', at(2026, 10, 6, 10, 0)), 'pending')
assert.equal(
  occurrenceStatus(reminder({ postedDates: ['2026-10-05'] }), '2026-10-05', at(2026, 10, 5, 18, 0)),
  'posted'
)

assert.equal(
  trailText(once, 'pending'),
  'ABC Traders → Instagram Story → “Client Spotlight” → 12:00 PM → Assigned to John → Pending'
)

const ids = ['emp_john']
assert.equal(resolveSocialPostPing(once, at(2026, 10, 5, 11, 44), ids), null)
assert.equal(resolveSocialPostPing(once, at(2026, 10, 5, 11, 45), ids).kind, 'early')
assert.equal(resolveSocialPostPing(reminder({ lastEarlyAt: '2026-10-05' }), at(2026, 10, 5, 11, 50), ids), null)
assert.equal(resolveSocialPostPing(once, mondayNoon, ids).kind, 'due')
assert.equal(resolveSocialPostPing(reminder({ lastDueAt: '2026-10-05' }), at(2026, 10, 5, 15, 0), ids), null)
assert.equal(resolveSocialPostPing(once, at(2026, 10, 5, 18, 0), ids).kind, 'due')
assert.equal(resolveSocialPostPing(once, at(2026, 10, 6, 12, 0), ids), null)
assert.equal(resolveSocialPostPing(reminder({ postedDates: ['2026-10-05'] }), mondayNoon, ids), null)
assert.equal(resolveSocialPostPing(reminder({ enabled: false }), mondayNoon, ids), null)
assert.equal(resolveSocialPostPing(once, mondayNoon, ['someone-else']), null)
assert.equal(resolveSocialPostPing(once, mondayNoon, []), null)

const midnight = reminder({ time: '00:10', startDate: '2026-10-06' })
assert.equal(resolveSocialPostPing(midnight, at(2026, 10, 5, 23, 55), ids).kind, 'early')
assert.equal(resolveSocialPostPing(midnight, at(2026, 10, 5, 23, 55), ids).updates.lastEarlyAt, '2026-10-06')

const five = reminder({ notifyBeforeMinutes: 5 })
assert.equal(resolveSocialPostPing(five, at(2026, 10, 5, 11, 54), ids), null)
assert.equal(resolveSocialPostPing(five, at(2026, 10, 5, 11, 55), ids).kind, 'early')
assert.equal(socialPostPingCopy(five, 'early').title, 'Post in 5 minutes')

const ten = reminder({ notifyBeforeMinutes: 10 })
assert.equal(resolveSocialPostPing(ten, at(2026, 10, 5, 11, 49), ids), null)
assert.equal(resolveSocialPostPing(ten, at(2026, 10, 5, 11, 50), ids).kind, 'early')
assert.equal(socialPostPingCopy(ten, 'early').message.includes('10 minutes'), true)

const none = reminder({ notifyBeforeMinutes: 0 })
assert.equal(resolveSocialPostPing(none, at(2026, 10, 5, 11, 45), ids), null)
assert.equal(resolveSocialPostPing(none, mondayNoon, ids).kind, 'due')

console.log('socialPostReminderSchedule tests passed')
