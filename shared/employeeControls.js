import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './supabase/client.js'

export const DEFAULT_EMPLOYEE_CONTROLS = {
  fixedLunchEnabled: false,
  lunchStart: '13:00',
  lunchEnd: '14:00',
  showLunchButton: true,
}

const controlsRef = () => doc(db, 'companySettings', 'employeeControls')

function clockMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function normalizeEmployeeControls(raw = {}) {
  const lunchStart = clockMinutes(raw.lunchStart) == null ? DEFAULT_EMPLOYEE_CONTROLS.lunchStart : raw.lunchStart
  const lunchEnd = clockMinutes(raw.lunchEnd) == null ? DEFAULT_EMPLOYEE_CONTROLS.lunchEnd : raw.lunchEnd
  return {
    fixedLunchEnabled: Boolean(raw.fixedLunchEnabled),
    lunchStart,
    lunchEnd,
    showLunchButton: raw.showLunchButton !== false,
  }
}

let cached = normalizeEmployeeControls(DEFAULT_EMPLOYEE_CONTROLS)
let liveUnsub = null
const listeners = new Set()

function publish(next) {
  cached = next
  listeners.forEach((listener) => listener(cached))
}

function ensureLive() {
  if (liveUnsub || !db) return
  liveUnsub = onSnapshot(
    controlsRef(),
    (snap) => publish(normalizeEmployeeControls(snap.exists() ? snap.data() : {})),
    () => publish(cached),
  )
}

export function getCachedEmployeeControls() {
  return cached
}

export function subscribeEmployeeControls(onChange) {
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

export async function getEmployeeControls() {
  if (!db) return { ...cached }
  const snap = await getDoc(controlsRef())
  const next = normalizeEmployeeControls(snap.exists() ? snap.data() : {})
  publish(next)
  return next
}

export async function saveEmployeeControls(payload = {}) {
  if (!db) throw new Error('Supabase is not configured')
  const next = normalizeEmployeeControls(payload)
  await setDoc(controlsRef(), { ...next, updatedAt: new Date().toISOString() }, { merge: true })
  publish(next)
  return next
}

export function isWithinFixedLunch(controls, now = new Date()) {
  if (!controls?.fixedLunchEnabled) return false
  const start = clockMinutes(controls.lunchStart)
  const end = clockMinutes(controls.lunchEnd)
  if (start == null || end == null || end <= start) return false
  const current = now.getHours() * 60 + now.getMinutes()
  return current >= start && current < end
}

export function fixedLunchEndMs(controls, now = new Date()) {
  const end = clockMinutes(controls?.lunchEnd)
  if (end == null) return null
  const ends = new Date(now)
  ends.setHours(Math.floor(end / 60), end % 60, 0, 0)
  return ends.getTime()
}

export function lunchDurationMs(controls) {
  const start = clockMinutes(controls?.lunchStart)
  const end = clockMinutes(controls?.lunchEnd)
  if (start == null || end == null || end <= start) return 60 * 60 * 1000
  return (end - start) * 60 * 1000
}
