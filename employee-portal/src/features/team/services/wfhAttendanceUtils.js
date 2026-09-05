/**
 * Location-gated clock-in helpers with per-employee WFH exceptions.
 */
import {
  resolveEmployeeWfhPolicy,
  countUsedWfhDays,
} from './wfhPolicyUtils'
import { getOfficeLocation } from './teamService'

/** Set true to require office GPS / weekly WFH clock-in choice again. */
export const LOCATION_GATE_ENABLED = true

// #region agent log
const agentDbg = (hypothesisId, location, message, data) => {
  const payload = JSON.stringify({ sessionId: '98b944', runId: 'pre-fix', hypothesisId, location, message, data, timestamp: Date.now() })
  fetch('http://127.0.0.1:7493/ingest/c3ff692f-1cdd-437c-bb23-67bdbbc19c12', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '98b944' }, body: payload }).catch(() => {})
  fetch('/__agent_debug_log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }).catch(() => {})
}
// #endregion

const toDateKey = (date = new Date()) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const matchesEmployee = (leave, filter = {}) => {
  const { employeeId, employeeEmail, employeeName, uid } = filter
  if (employeeId && (leave.employeeId === employeeId || leave.employeeId === uid)) return true
  if (uid && leave.employeeId === uid) return true
  if (employeeEmail && leave.employeeEmail?.toLowerCase() === employeeEmail.toLowerCase()) return true
  if (
    employeeName &&
    employeeName !== 'Team Staff' &&
    leave.employeeName?.toLowerCase() === employeeName.toLowerCase()
  ) {
    return true
  }
  return false
}

const dateInRange = (dateStr, startDate, endDate) => {
  if (!dateStr || !startDate) return false
  const end = endDate || startDate
  return dateStr >= startDate && dateStr <= end
}

/**
 * True if employee has an approved WFH leave covering dateStr.
 */
export const hasApprovedWfhToday = (leaveRequests, employeeFilter, dateStr) => {
  const day = dateStr || toDateKey()
  const list = Array.isArray(leaveRequests) ? leaveRequests : []
  return list.some(
    (l) =>
      l.leaveType === 'Work From Home' &&
      l.status === 'approved' &&
      matchesEmployee(l, employeeFilter) &&
      dateInRange(day, l.startDate, l.endDate)
  )
}

/**
 * Weekly employees choose WFH vs Office at clock-in (no leave form).
 * Prompt only when they still have remaining weekly days and no WFH leave today.
 */
export const getWeeklyClockInPromptState = ({
  emp,
  leaveRequests,
  dateStr,
  employeeFilter,
} = {}) => {
  const day = dateStr || toDateKey()
  const wfh = resolveEmployeeWfhPolicy(emp || {})
  const filter = employeeFilter || {
    employeeId: emp?.uid || emp?.employeeId,
    uid: emp?.uid || emp?.employeeId,
    employeeEmail: emp?.email,
    employeeName: emp?.displayName || emp?.name,
  }

  if (!wfh.clockInChoice) {
    return {
      showPrompt: false,
      remaining: 0,
      limit: wfh.limit,
      alreadyWfhToday: false,
    }
  }

  const alreadyWfhToday = hasApprovedWfhToday(leaveRequests, filter, day)
  const used = countUsedWfhDays(leaveRequests, filter, wfh, day)
  const remaining = Math.max(0, (Number(wfh.limit) || 1) - used)

  return {
    showPrompt: !alreadyWfhToday && remaining > 0,
    remaining,
    limit: wfh.limit,
    alreadyWfhToday,
  }
}

/**
 * Decide whether office GPS is required for clock-in today.
 */
export const resolveClockInLocationPolicy = ({ emp, leaveRequests, dateStr, employeeFilter } = {}) => {
  const day = dateStr || toDateKey()
  const wfh = resolveEmployeeWfhPolicy(emp || {})
  const filter = employeeFilter || {
    employeeId: emp?.uid || emp?.employeeId,
    uid: emp?.uid || emp?.employeeId,
    employeeEmail: emp?.email,
    employeeName: emp?.displayName || emp?.name,
  }

  if (wfh.mode === 'full') {
    return {
      requireOfficeLocation: false,
      wfhExempt: true,
      reason: 'Full WFH — location not required',
    }
  }

  if (
    (wfh.mode === 'weekly' || wfh.mode === 'monthly') &&
    hasApprovedWfhToday(leaveRequests, filter, day)
  ) {
    return {
      requireOfficeLocation: false,
      wfhExempt: true,
      reason:
        wfh.mode === 'monthly'
          ? 'Approved monthly WFH today — location not required'
          : 'Approved weekly WFH today — location not required',
    }
  }

  return {
    requireOfficeLocation: true,
    wfhExempt: false,
    reason: 'Must clock in from the office location',
  }
}

/** Haversine distance in meters */
export const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const isWithinOfficeRadius = (userLat, userLng, office, accuracy = 0) => {
  if (userLat == null || userLng == null) return false
  const radius = Math.max(50, Number(office?.radiusMeters) || 200)
  const acc = Math.max(0, Number(accuracy) || 0)
  const allowed = radius + acc
  const pins = [
    [office?.lat, office?.lng],
    [office?.networkLat, office?.networkLng],
  ]
  return pins.some(([lat, lng]) => {
    if (lat == null || lng == null) return false
    return distanceMeters(userLat, userLng, lat, lng) <= allowed
  })
}

const geoErrorMessage = (err) => {
  let message = 'Unable to get your location.'
  if (err?.code === 1) message = 'Location permission denied. Allow location access to clock in at the office.'
  if (err?.code === 2) message = 'Location unavailable. Try again near the office.'
  if (err?.code === 3) message = 'Location request timed out. Try again.'
  return message
}

/**
 * Browser geolocation promise
 * @returns {Promise<{ ok: true, lat: number, lng: number, accuracy?: number, source?: string } | { ok: false, error: string }>}
 */
export const getCurrentPositionCoords = (options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }) =>
  new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, error: 'Geolocation is not supported on this device.' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: options.enableHighAccuracy ? 'high' : 'low',
        })
      },
      (err) => {
        const message = geoErrorMessage(err)
        // #region agent log
        agentDbg('C', 'wfhAttendanceUtils.js:getCurrentPositionCoords', 'employee GPS error', { code: err?.code, message, highAccuracy: options.enableHighAccuracy === true })
        // #endregion
        resolve({ ok: false, error: message })
      },
      options
    )
  })

const nearestOfficeDistance = (lat, lng, office) => {
  const pins = [
    [office?.lat, office?.lng],
    [office?.networkLat, office?.networkLng],
  ]
  const distances = pins
    .filter(([pLat, pLng]) => pLat != null && pLng != null)
    .map(([pLat, pLng]) => distanceMeters(lat, lng, pLat, pLng))
  return distances.length ? Math.min(...distances) : Infinity
}

const collectClockInCoords = async (office) => {
  const high = await getCurrentPositionCoords({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  const samples = []
  if (high.ok) samples.push(high)

  const highInside = high.ok && isWithinOfficeRadius(high.lat, high.lng, office, high.accuracy)
  if (!highInside) {
    const low = await getCurrentPositionCoords({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
    if (low.ok) samples.push(low)
  }

  if (!samples.length) return high

  return samples.reduce((best, sample) => {
    const bestDist = nearestOfficeDistance(best.lat, best.lng, office)
    const sampleDist = nearestOfficeDistance(sample.lat, sample.lng, office)
    return sampleDist < bestDist ? sample : best
  })
}

/**
 * Full pre-check before clock-in.
 */
export const prepareClockInGate = async ({ emp, leaveRequests, dateStr, employeeFilter } = {}) => {
  if (!LOCATION_GATE_ENABLED) {
    return {
      ok: true,
      requireOfficeLocation: false,
      wfhExempt: false,
      locationVerified: false,
      reason: 'Location check temporarily disabled',
      coords: null,
    }
  }

  const policy = resolveClockInLocationPolicy({ emp, leaveRequests, dateStr, employeeFilter })

  if (!policy.requireOfficeLocation) {
    return {
      ok: true,
      requireOfficeLocation: false,
      wfhExempt: true,
      locationVerified: false,
      reason: policy.reason,
      coords: null,
    }
  }

  const office = await getOfficeLocation()
  if (office.lat == null || office.lng == null) {
    // #region agent log
    agentDbg('A', 'wfhAttendanceUtils.js:prepareClockInGate', 'office lat/lng missing after fetch', { officeLat: office?.lat, officeLng: office?.lng, radius: office?.radiusMeters, latType: typeof office?.lat, lngType: typeof office?.lng })
    // #endregion
    return {
      ok: false,
      requireOfficeLocation: true,
      error: 'Office location is not configured. Contact your administrator.',
    }
  }

  const coords = await collectClockInCoords(office)
  if (!coords.ok) {
    return {
      ok: false,
      requireOfficeLocation: true,
      error: coords.error,
    }
  }

  const dist = nearestOfficeDistance(coords.lat, coords.lng, office)
  const distIfSwapped = distanceMeters(coords.lng, coords.lat, office.lat, office.lng)
  const radius = Math.max(50, Number(office.radiusMeters) || 200)
  const within = isWithinOfficeRadius(coords.lat, coords.lng, office, coords.accuracy)
  const withinWithAccuracy = dist <= radius + (Number(coords.accuracy) || 0)
  // #region agent log
  agentDbg('C', 'wfhAttendanceUtils.js:prepareClockInGate', 'geofence comparison', { runId: 'post-fix', officeLat: office.lat, officeLng: office.lng, networkLat: office.networkLat, networkLng: office.networkLng, radius, userLat: coords.lat, userLng: coords.lng, accuracy: coords.accuracy, source: coords.source, dist, distIfSwapped, within, withinWithAccuracy })
  // #endregion

  if (!within) {
    return {
      ok: false,
      requireOfficeLocation: true,
      error: `You must be at the office to clock in (about ${Math.round(dist)}m away; allowed radius ${office.radiusMeters}m).`,
      coords,
    }
  }

  return {
    ok: true,
    requireOfficeLocation: true,
    wfhExempt: false,
    locationVerified: true,
    reason: 'Inside office geofence',
    coords: { lat: coords.lat, lng: coords.lng },
    office,
  }
}
