import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './supabase/client.js'

export const DEFAULT_WORKING_HOURS = {
  workStart: '10:30',
  workEnd: '19:00',
  graceMinutes: 10,
}

const MIN_GRACE = 0
const MAX_GRACE = 120
const DAY_MINUTES = 24 * 60

const hoursRef = () => doc(db, 'companySettings', 'workingHours')

export function clockMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || '').trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function hmString(value, fallback) {
  const minutes = clockMinutes(value)
  if (minutes == null) return fallback
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function graceNumber(value, fallback = DEFAULT_WORKING_HOURS.graceMinutes) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(MAX_GRACE, Math.max(MIN_GRACE, Math.round(parsed)))
}

export function normalizeWorkingHours(raw = {}) {
  return {
    workStart: hmString(raw.workStart, DEFAULT_WORKING_HOURS.workStart),
    workEnd: hmString(raw.workEnd, DEFAULT_WORKING_HOURS.workEnd),
    graceMinutes: graceNumber(raw.graceMinutes),
  }
}

export function formatMinutes12(totalMinutes) {
  const minutes = ((Number(totalMinutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  let hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  const suffix = hours >= 12 ? 'PM' : 'AM'
  hours %= 12
  if (hours === 0) hours = 12
  return `${hours}:${String(mins).padStart(2, '0')} ${suffix}`
}

/** Label for a late stat, e.g. "after 10:40 AM (10 min grace)". */
export function lateAfterLabel(raw) {
  const hours = normalizeWorkingHours(raw || {})
  const start = clockMinutes(hours.workStart)
  const cutoff = start + hours.graceMinutes
  return `after ${formatMinutes12(cutoff)} (${hours.graceMinutes} min grace)`
}

let cached = normalizeWorkingHours(DEFAULT_WORKING_HOURS)
let liveUnsub = null
const listeners = new Set()

function publish(next) {
  cached = next
  listeners.forEach((listener) => listener(cached))
}

function ensureLive() {
  if (liveUnsub || !db) return
  liveUnsub = onSnapshot(
    hoursRef(),
    (snap) => publish(normalizeWorkingHours(snap.exists() ? snap.data() : {})),
    () => publish(cached),
  )
}

export function getCachedWorkingHours() {
  return cached
}

export function subscribeWorkingHours(onChange) {
  listeners.add(onChange)
  onChange(cached)
  ensureLive()
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && liveUnsub) {
      liveUnsub()
      liveUnsub = null
    }
  }
}

export async function getWorkingHours() {
  if (!db) return { ...cached }
  const snap = await getDoc(hoursRef())
  const next = normalizeWorkingHours(snap.exists() ? snap.data() : {})
  publish(next)
  return next
}

export async function saveWorkingHours(payload = {}) {
  if (!db) throw new Error('Supabase is not configured')
  const next = normalizeWorkingHours(payload)
  const start = clockMinutes(next.workStart)
  const end = clockMinutes(next.workEnd)
  if (start == null || end == null || end <= start) {
    throw new Error('Office end must be later than office start on the same day.')
  }
  await setDoc(hoursRef(), { ...next, updatedAt: new Date().toISOString() }, { merge: true })
  publish(next)
  return next
}
