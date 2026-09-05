import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, NativePickerInput } from '../../components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { db } from '../../shared/services/firebaseService'
import {
  getEmployees,
  setEmployeeAttendanceStatus,
  subscribeToOfficeLocation,
  saveOfficeLocation,
} from './services/teamService'
import { OfficeLocationPickerMap } from './components/OfficeLocationPickerMap'
import { TeamSubNav } from './components/TeamSubNav'
import { computeRealAttendanceStats, timeStrToMinutes, resolveEmployeeDisplayName } from './services/attendanceStatsUtils'
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore'
import {
  Users,
  CheckCircle2,
  Clock,
  LogIn,
  LogOut,
  Zap,
  Coffee,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Edit,
  Save,
  X,
  UserCheck,
  UserX,
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation,
  Loader2,
} from 'lucide-react'

// #region agent log
const agentDbg = (hypothesisId, location, message, data) => {
  const payload = JSON.stringify({ sessionId: '98b944', runId: 'pre-fix', hypothesisId, location, message, data, timestamp: Date.now() })
  fetch('http://127.0.0.1:7493/ingest/c3ff692f-1cdd-437c-bb23-67bdbbc19c12', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '98b944' }, body: payload }).catch(() => {})
  fetch('/__agent_debug_log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }).catch(() => {})
}
// #endregion

// Today's date in YYYY-MM-DD
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTimeStr(timeStr) {
  if (!timeStr || timeStr === '—' || timeStr === 'In office') return timeStr
  const mins = timeStrToMinutes(timeStr)
  if (mins === null) return timeStr
  const hrs = Math.floor(mins / 60) % 24
  const m = Math.round(mins % 60)
  const ampm = hrs >= 12 ? 'PM' : 'AM'
  const h12 = hrs % 12 === 0 ? 12 : hrs % 12
  const hStr = h12.toString().padStart(2, '0')
  const mStr = m.toString().padStart(2, '0')
  return `${hStr}:${mStr} ${ampm}`
}

function secToHrsStr(totalSec) {
  if (!totalSec || totalSec <= 0) return '0h 0m'
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  return `${hrs}h ${mins}m`
}

/**
 * Logged-in seconds from clock-in → clock-out (uncapped).
 * If still "In office" on today, uses now. Past days without clock-out return 0
 * so the caller can fall back to stored seconds.
 */
function computeRegularSecondsFromTimes(clockInStr, clockOutStr, dateStr, breakSec = 0, clockInTimestamp = null) {
  let inMins = timeStrToMinutes(clockInStr)
  if (inMins === null && clockInTimestamp) {
    const d = new Date(Number(clockInTimestamp))
    if (!Number.isNaN(d.getTime())) {
      inMins = d.getHours() * 60 + d.getMinutes()
    }
  }
  if (inMins === null) return 0

  let outMins = null
  if (clockOutStr && clockOutStr !== 'In office' && clockOutStr !== '—') {
    outMins = timeStrToMinutes(clockOutStr)
  } else {
    const today = todayStr()
    if (dateStr && dateStr < today) {
      return 0
    } else if (!dateStr || dateStr === today) {
      const now = new Date()
      outMins = now.getHours() * 60 + now.getMinutes()
    } else {
      return 0
    }
  }

  if (outMins === null || outMins <= inMins) return 0
  return Math.max(0, (outMins - inMins) * 60 - (breakSec || 0))
}

/** Build a Date timestamp for YYYY-MM-DD + time string like "09:30 AM" */
function timestampFromDateAndTime(dateStr, timeStr) {
  const inMins = timeStrToMinutes(timeStr)
  if (!dateStr || inMins === null) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return null
  const hrs = Math.floor(inMins / 60)
  const mins = inMins % 60
  return new Date(y, m - 1, d, hrs, mins, 0, 0).getTime()
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function timePartsFromStr(timeStr, fallback = { hour: 9, minute: 0, ampm: 'AM' }) {
  const mins = timeStrToMinutes(timeStr)
  if (mins === null) return fallback
  const hrs24 = Math.floor(mins / 60) % 24
  const minute = Math.round(mins % 60)
  const ampm = hrs24 >= 12 ? 'PM' : 'AM'
  const hour = hrs24 % 12 === 0 ? 12 : hrs24 % 12
  return { hour, minute, ampm }
}

function timePartsToStr({ hour, minute, ampm }) {
  return `${pad2(hour)}:${pad2(minute)} ${ampm}`
}

function canonicalTimeOrDefault(timeStr, fallback = '09:00 AM') {
  const mins = timeStrToMinutes(timeStr)
  if (mins === null) return fallback
  return formatTimeStr(timeStr)
}

function TimerWheel({ label, value, onUp, onDown }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={onUp}
        className="p-1 rounded-lg text-muted hover:text-accent hover:bg-accent-soft transition-colors"
        aria-label={`Increase ${label}`}
      >
        <ChevronUp className="w-5 h-5" />
      </button>
      <div className="w-16 h-14 rounded-xl bg-canvas border border-border flex items-center justify-center font-mono text-2xl font-black text-fg tabular-nums">
        {value}
      </div>
      <button
        type="button"
        onClick={onDown}
        className="p-1 rounded-lg text-muted hover:text-accent hover:bg-accent-soft transition-colors"
        aria-label={`Decrease ${label}`}
      >
        <ChevronDown className="w-5 h-5" />
      </button>
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted">{label}</span>
    </div>
  )
}

function isTeamEmployee(emp) {
  if (!emp?.uid) return false
  const role = String(emp.role || '').toLowerCase()
  if (role === 'admin' || role === 'owner') return false
  if (emp.accountType === 'admin') return false
  return true
}

function AttendanceTimer({ value, onChange, disabled = false }) {
  const parts = timePartsFromStr(value)
  const commit = (next) => onChange(timePartsToStr({ ...parts, ...next }))

  const bumpHour = (dir) => {
    let hour = parts.hour + dir
    if (hour > 12) hour = 1
    if (hour < 1) hour = 12
    commit({ hour })
  }

  const bumpMinute = (dir) => {
    let minute = parts.minute + dir
    if (minute > 59) minute = 0
    if (minute < 0) minute = 59
    commit({ minute })
  }

  return (
    <div className={`flex items-end justify-center gap-2 select-none ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <TimerWheel label="Hour" value={pad2(parts.hour)} onUp={() => bumpHour(1)} onDown={() => bumpHour(-1)} />
      <span className="text-2xl font-black text-muted pb-8">:</span>
      <TimerWheel label="Min" value={pad2(parts.minute)} onUp={() => bumpMinute(1)} onDown={() => bumpMinute(-1)} />
      <div className="flex flex-col gap-1.5 pb-6 ml-1">
        {['AM', 'PM'].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => commit({ ampm: period })}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              parts.ampm === period
                ? 'bg-accent text-white border-accent'
                : 'bg-canvas text-muted border-border hover:border-accent/50'
            }`}
          >
            {period}
          </button>
        ))}
      </div>
    </div>
  )
}

export const AttendancePage = () => {
  const { employees, setEmployees } = useTeamStore()
  const { user } = useUserStore()
  const adminName = user?.displayName || user?.email || 'Admin'

  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [allLogs, setAllLogs] = useState([])

  // Admin edit attendance log state
  const [editingRow, setEditingRow] = useState(null)
  const [editClockIn, setEditClockIn] = useState('')
  const [editClockOut, setEditClockOut] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [togglingAttendanceUid, setTogglingAttendanceUid] = useState(null)

  // Office location geofence
  const [showOfficePanel, setShowOfficePanel] = useState(false)
  const [officeLat, setOfficeLat] = useState('')
  const [officeLng, setOfficeLng] = useState('')
  const [officeRadius, setOfficeRadius] = useState(200)
  const [officeLoaded, setOfficeLoaded] = useState(false)
  const [savingOffice, setSavingOffice] = useState(false)
  const [officeSaved, setOfficeSaved] = useState(false)
  const [officeError, setOfficeError] = useState('')
  const [locatingDevice, setLocatingDevice] = useState(false)

  useEffect(() => {
    getEmployees().then((emps) => {
      if (emps?.length) setEmployees(emps)
    }).catch(() => {})
  }, [setEmployees])

  useEffect(() => {
    const unsub = subscribeToOfficeLocation((loc) => {
      setOfficeLat(loc.lat != null ? String(loc.lat) : '')
      setOfficeLng(loc.lng != null ? String(loc.lng) : '')
      setOfficeRadius(loc.radiusMeters || 200)
      setOfficeLoaded(true)
    })
    return () => unsub()
  }, [])

  const persistOfficeLocation = async (lat, lng, radiusMeters = officeRadius, extra = {}) => {
    const radius = Math.max(50, Math.min(50000, Number(radiusMeters) || 200))
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setOfficeError('Enter valid latitude and longitude.')
      return false
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setOfficeError('Latitude must be -90–90 and longitude -180–180.')
      return false
    }
    setSavingOffice(true)
    setOfficeError('')
    // #region agent log
    agentDbg('B', 'admin AttendancePage.jsx:persistOfficeLocation', 'admin saving office location', { runId: 'post-fix', lat, lng, radius, networkLat: extra.networkLat, networkLng: extra.networkLng, latType: typeof lat, lngType: typeof lng })
    // #endregion
    await saveOfficeLocation({ lat, lng, radiusMeters: radius, label: 'Office', ...extra }, adminName)
    setOfficeLat(String(Number(lat.toFixed(6))))
    setOfficeLng(String(Number(lng.toFixed(6))))
    setOfficeRadius(radius)
    setSavingOffice(false)
    setOfficeSaved(true)
    setTimeout(() => setOfficeSaved(false), 2000)
    return true
  }

  const handleSaveOfficeLocation = async (e) => {
    e.preventDefault()
    await persistOfficeLocation(Number(officeLat), Number(officeLng), officeRadius)
  }

  const handleUseDeviceLocation = async () => {
    setOfficeError('')
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setOfficeError('Geolocation is not supported on this device.')
      return
    }

    const readPosition = (options) =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          reject,
          options
        )
      })

    const distMeters = (lat1, lng1, lat2, lng2) => {
      const toRad = (deg) => (deg * Math.PI) / 180
      const R = 6371000
      const dLat = toRad(lat2 - lat1)
      const dLng = toRad(lng2 - lng1)
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
      return 2 * R * Math.asin(Math.sqrt(a))
    }

    setLocatingDevice(true)
    try {
      let high
      try {
        high = await readPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
      } catch {
        high = await readPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
      }

      let low = null
      try {
        low = await readPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 })
      } catch {
        low = null
      }

      const existingLat = Number(officeLat)
      const existingLng = Number(officeLng)
      const hasExisting = Number.isFinite(existingLat) && Number.isFinite(existingLng)
      const radius = Math.max(50, Number(officeRadius) || 200)
      const distFromExisting = hasExisting
        ? distMeters(high.lat, high.lng, existingLat, existingLng)
        : 0

      let pinLat = high.lat
      let pinLng = high.lng
      let networkLat = null
      let networkLng = null

      // Office PCs often report a Wi-Fi location kilometres from GPS.
      // Keep the existing GPS pin and store this reading as a second allowed point.
      if (hasExisting && distFromExisting > radius) {
        pinLat = existingLat
        pinLng = existingLng
        networkLat = high.lat
        networkLng = high.lng
      } else if (
        low &&
        distMeters(low.lat, low.lng, high.lat, high.lng) > radius
      ) {
        networkLat = low.lat
        networkLng = low.lng
      }

      // #region agent log
      agentDbg('C', 'admin AttendancePage.jsx:handleUseDeviceLocation', 'admin use current location GPS', {
        runId: 'post-fix',
        lat: pinLat,
        lng: pinLng,
        highLat: high.lat,
        highLng: high.lng,
        highAccuracy: high.accuracy,
        lowLat: low?.lat,
        lowLng: low?.lng,
        networkLat,
        networkLng,
        distFromExisting,
        radius,
      })
      // #endregion
      setOfficeLat(String(Number(pinLat.toFixed(6))))
      setOfficeLng(String(Number(pinLng.toFixed(6))))
      await persistOfficeLocation(pinLat, pinLng, officeRadius, { networkLat, networkLng })
    } catch (err) {
      if (err?.code === 1) {
        setOfficeError('Location permission denied. Allow location access for this browser.')
      } else if (err?.code === 2) {
        setOfficeError('Location unavailable. Try again near the office.')
      } else if (err?.code === 3) {
        setOfficeError('Location request timed out. Try again.')
      } else {
        setOfficeError('Unable to get your device location.')
      }
    } finally {
      setLocatingDevice(false)
    }
  }

  const isRowPresent = (row) => Boolean(row?.present)

  const handleTogglePresentAbsent = async (row) => {
    if (!row?.uid || togglingAttendanceUid) return

    const nextPresent = !isRowPresent(row)
    setTogglingAttendanceUid(row.uid)

    try {
      await setEmployeeAttendanceStatus(
        {
          uid: row.uid,
          displayName: row.displayName,
          departmentName: row.departmentName,
        },
        nextPresent,
        selectedDate
      )
    } catch (err) {
      console.error('Failed to toggle present/absent:', err)
    } finally {
      setTogglingAttendanceUid(null)
    }
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingRow) return
    setSavingEdit(true)
    try {
      const docId = `${selectedDate}_${editingRow.uid}`
      const clockInTime = canonicalTimeOrDefault(editClockIn)
      const isClockedIn = editClockOut === 'In office' || !editClockOut
      const clockOutTime = isClockedIn ? null : canonicalTimeOrDefault(editClockOut, '06:00 PM')
      const breakSec = editingRow.accumulatedBreakSeconds || 0

      // Always recompute regular hours from the edited start/end times
      const regSec = computeRegularSecondsFromTimes(
        clockInTime,
        isClockedIn ? 'In office' : clockOutTime,
        selectedDate,
        breakSec
      )

      const clockInTimestamp = timestampFromDateAndTime(selectedDate, clockInTime)

      const updatedData = {
        uid: editingRow.uid,
        displayName: editingRow.displayName,
        departmentName: editingRow.departmentName,
        date: selectedDate,
        clockInTime,
        clockInTimestamp: clockInTimestamp || null,
        clockOutTime,
        clockedIn: isClockedIn,
        present: true,
        onDuty: false,
        regularSeconds: regSec,
        accumulatedWorkSeconds: regSec,
        regularHours: secToHrsStr(regSec),
        autoClockOut: false,
        source: 'admin_edit',
      }

      await setDoc(doc(db, 'attendanceLogs', docId), updatedData, { merge: true })
      setEditingRow(null)
    } catch (err) {
      console.error('Error saving edited attendance log:', err)
    } finally {
      setSavingEdit(false)
    }
  }

  const editPreviewRegularHours = useMemo(
    () =>
      secToHrsStr(
        computeRegularSecondsFromTimes(
          editClockIn,
          editClockOut === 'In office' || !editClockOut ? 'In office' : editClockOut,
          selectedDate
        )
      ),
    [editClockIn, editClockOut, selectedDate]
  )

  useEffect(() => {
    const fetchAllLogs = async () => {
      try {
        const snap = await getDocs(collection(db, 'attendanceLogs'))
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setAllLogs(docs)
      } catch (err) {
        console.error('[AttendancePage] Error fetching all attendance logs:', err)
      }
    }
    fetchAllLogs()
  }, [])

  // Calculate real employee-wise attendance stats for all employees
  const employeeStatsList = useMemo(() => {
    const mapByUid = {}
    allLogs.forEach((log) => {
      if (log.uid) {
        if (!mapByUid[log.uid]) mapByUid[log.uid] = []
        mapByUid[log.uid].push(log)
      }
    })

    return employees.filter(isTeamEmployee).map((emp) => {
      const uId = emp.uid || emp.employeeId || emp.id
      const uLogs = mapByUid[uId] || []
      const stats = computeRealAttendanceStats(uLogs)
      return {
        uid: uId,
        displayName: resolveEmployeeDisplayName(emp),
        departmentName: emp.departmentName || emp.department || 'General',
        role: emp.role || 'Team Member',
        ...stats,
      }
    })
  }, [allLogs, employees])

  /**
   * Subscribe to today's attendance logs from Firestore.
   * Uses flat collection: attendanceLogs/{date}_{uid}
   * Simple where('date') query — no composite index needed.
   */
  useEffect(() => {
    setLoading(true)
    setError(null)

    const logsQuery = query(
      collection(db, 'attendanceLogs'),
      where('date', '==', selectedDate)
    )

    const unsub = onSnapshot(
      logsQuery,
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setAttendanceLogs(docs)
        setLoading(false)
        setLastRefresh(new Date())
        setIsLive(true)
      },
      (err) => {
        console.error('[AttendancePage] Firestore error:', err)
        setError('Unable to load live attendance data. Showing employee directory instead.')
        setLoading(false)
        setIsLive(false)
      }
    )

    return () => unsub()
  }, [selectedDate])

  // Merge: show all employees, overlay Firestore attendance data for selected date
  const rows = React.useMemo(() => {
    const today = todayStr()
    const isToday = selectedDate === today

    const logByUid = {}
    attendanceLogs.forEach((log) => {
      if (log.uid) logByUid[log.uid] = log
    })

    const buildRowFromLog = (log, emp = {}) => {
      let isCurrentlyClockedIn = Boolean(log.clockedIn)
      let resolvedClockOut = log.clockOutTime || null
      let isAutoClockOut = Boolean(log.autoClockOut)
      const breakSec = log.accumulatedBreakSeconds || 0

      if (isToday) {
        // Keep showing live clock-in; do not invent auto clock-out.
        if (isAutoClockOut && log.clockedIn !== false && log.clockInTime && log.clockInTime !== '—') {
          isAutoClockOut = false
          resolvedClockOut = null
          isCurrentlyClockedIn = true
        }
      }

      // Always derive regular hours from start/end times when available
      let calculatedRegularSec = 0
      if (log.clockInTime && log.clockInTime !== '—') {
        calculatedRegularSec = computeRegularSecondsFromTimes(
          log.clockInTime,
          resolvedClockOut || (isCurrentlyClockedIn ? 'In office' : null),
          selectedDate,
          breakSec,
          log.clockInTimestamp
        )
      }
      // Fallback to stored value only if times couldn't produce a duration
      if (calculatedRegularSec <= 0) {
        calculatedRegularSec = Math.max(
          0,
          Number(log.regularSeconds) || Number(log.accumulatedWorkSeconds) || 0
        )
      }

      const isOnDuty = log.onDuty === true || log.source === 'on_duty'
      // Explicit admin Absent must win over any leftover clock fields
      const isPresentFlag =
        log.present === false
          ? false
          : log.present === true ||
            isCurrentlyClockedIn ||
            Boolean(resolvedClockOut) ||
            isOnDuty ||
            (Boolean(log.clockInTime) && log.clockInTime !== '—')

      return {
        uid: log.uid,
        displayName: resolveEmployeeDisplayName(emp, log),
        departmentName: log.departmentName || emp.departmentName || '—',
        clockInTime: formatTimeStr(log.clockInTime) || '—',
        clockOutTime: formatTimeStr(resolvedClockOut) || null,
        clockedIn: isCurrentlyClockedIn,
        onDuty: isOnDuty,
        present: isPresentFlag,
        isOnBreak: log.isOnBreak || false,
        isInExtraTime: log.isInExtraTime || false,
        accumulatedBreakSeconds: breakSec,
        regularHours: secToHrsStr(calculatedRegularSec),
        extraHours: log.extraHours || secToHrsStr(log.extraSeconds),
        regularSeconds: calculatedRegularSec,
        extraSeconds: log.extraSeconds || 0,
        autoClockOut: isAutoClockOut,
        shiftLogs: log.shiftLogs || [],
      }
    }

    const emptyRow = (emp) => ({
      uid: emp.uid,
      displayName: resolveEmployeeDisplayName(emp),
      departmentName: emp.departmentName || '—',
      clockInTime: '—',
      clockOutTime: null,
      clockedIn: false,
      onDuty: false,
      present: false,
      isOnBreak: false,
      isInExtraTime: false,
      regularHours: '0h 0m',
      extraHours: '0h 0m',
      regularSeconds: 0,
      extraSeconds: 0,
      autoClockOut: false,
      shiftLogs: [],
    })

    // Only team directory employees — skip admin / non-employee attendance logs
    return employees.filter(isTeamEmployee).map((emp) => {
      const log = logByUid[emp.uid]
      return log ? buildRowFromLog(log, emp) : emptyRow(emp)
    })
  }, [attendanceLogs, employees, selectedDate])

  const presentCount = rows.filter((r) => isRowPresent(r)).length
  const activeNow = rows.filter((r) => r.clockedIn && !r.isOnBreak).length
  const onBreakCount = rows.filter((r) => r.isOnBreak).length
  const extraTimeCount = rows.filter((r) => r.isInExtraTime).length

  const getStatusBadge = (row) => {
    if (false && row.isInExtraTime) {
      return (
        <Badge variant="brand" className="flex items-center gap-1 animate-pulse">
          <Zap className="w-3 h-3" /> Extra Time
        </Badge>
      )
    }
    if (row.isOnBreak) {
      return <Badge variant="warning">On Break</Badge>
    }
    if (row.clockedIn) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          Present
        </Badge>
      )
    }
    if (row.onDuty) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          On Duty
        </Badge>
      )
    }
    if (row.clockOutTime) {
      return <Badge variant="secondary">Clocked Out</Badge>
    }
    if (row.present) {
      return (
        <Badge variant="success" className="flex items-center gap-1">
          Present
        </Badge>
      )
    }
    return <Badge variant="danger">Absent</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Attendance & Daily Presence Tracker"
          description="Real-time employee clock-in/out tracking, shift logs, and presence status"
        />

        <TeamSubNav />
      </div>

      {/* Office Location geofence */}
      <Card className="border-border bg-surface p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowOfficePanel((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-fg">Office Location</h3>
              <p className="text-[11px] text-muted mt-0.5">
                Employees must be inside this radius to clock in (unless Full WFH or approved WFH today).
              </p>
            </div>
          </div>
          {showOfficePanel ? (
            <ChevronUp className="w-4 h-4 text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted" />
          )}
        </button>

        {officeLoaded && !showOfficePanel && (
          <p className="text-[11px] text-muted pl-6">
            {officeLat && officeLng
              ? `Configured: ${officeLat}, ${officeLng} · ${officeRadius}m radius`
              : 'Not configured — office clock-in will be blocked until you set coordinates.'}
          </p>
        )}

        {showOfficePanel && (
          <form onSubmit={handleSaveOfficeLocation} className="space-y-3 pt-1 border-t border-border">
            {officeError && (
              <p className="text-xs text-rose-400">{officeError}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={locatingDevice ? Loader2 : Navigation}
                disabled={locatingDevice || savingOffice}
                onClick={handleUseDeviceLocation}
                className={locatingDevice ? '[&_svg]:animate-spin' : ''}
              >
                {locatingDevice
                  ? 'Getting your location…'
                  : officeSaved
                    ? 'Office location saved'
                    : 'Use my device location'}
              </Button>
              <p className="text-[11px] text-muted">
                Stand at the office and tap this to set the GPS pin. On an office computer, tap it again to also save the Wi-Fi location employees use (it will not replace the GPS pin).
              </p>
            </div>

            <OfficeLocationPickerMap
              lat={officeLat}
              lng={officeLng}
              radiusMeters={officeRadius}
              onPick={(lat, lng) => {
                setOfficeLat(String(Number(lat.toFixed(6))))
                setOfficeLng(String(Number(lng.toFixed(6))))
                setOfficeError('')
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Latitude"
                type="number"
                step="any"
                value={officeLat}
                onChange={(e) => setOfficeLat(e.target.value)}
                placeholder="Device GPS or map click"
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                value={officeLng}
                onChange={(e) => setOfficeLng(e.target.value)}
                placeholder="Device GPS or map click"
                required
              />
              <Input
                label="Radius (meters)"
                type="number"
                min={50}
                max={50000}
                value={officeRadius}
                onChange={(e) => setOfficeRadius(Math.max(50, Math.min(50000, Number(e.target.value) || 200)))}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" icon={Save} disabled={savingOffice || !officeLoaded || locatingDevice}>
                {savingOffice ? 'Saving…' : officeSaved ? 'Saved' : 'Save Office Location'}
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Live status bar + date picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border ${
            isLive
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-canvas border-border text-muted'
          }`}>
            {isLive ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping ml-0.5" />
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>

          {lastRefresh && (
            <span className="text-[11px] text-muted">
              Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          )}
        </div>

        {/* Date picker */}
        <div className="flex items-center gap-2">
          <NativePickerInput
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-canvas border border-border text-fg text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr())}
            className="text-xs px-3 py-1.5 bg-accent-soft border border-accent/30 text-accent rounded-xl hover:bg-accent-soft transition-colors font-medium flex items-center gap-1"
          >
            Today
          </button>
        </div>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-black text-fg">{presentCount}</div>
            <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Present Today</div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center">
            <LogIn className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-xl font-black text-fg">{activeNow}</div>
            <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Active Now</div>
          </div>
        </Card>

        <Card className="p-4 border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Coffee className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-xl font-black text-fg">{onBreakCount}</div>
            <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">On Break</div>
          </div>
        </Card>

        {false && (
        <Card className="p-4 border-border bg-surface flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="text-xl font-black text-fg">{extraTimeCount}</div>
            <div className="text-[10px] text-muted uppercase tracking-wider font-semibold">Extra Time</div>
          </div>
        </Card>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Attendance Table */}
      <Card className="overflow-x-auto p-0 border-border">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted text-sm">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading attendance data…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p>No employees found for {formatDate(selectedDate)}</p>
            <p className="text-xs text-muted">Add employees in the directory, then mark them Present or Absent here.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-border text-muted font-semibold">
                <th className="p-4 font-semibold">Employee</th>
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold">Clock In</th>
                <th className="p-4 font-semibold">Clock Out</th>
                <th className="p-4 font-semibold">Hours</th>
                {false && <th className="p-4 font-semibold">Extra / OT Hours</th>}
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rows.map((row) => (
                <tr
                  key={row.uid}
                  className="hover:bg-canvas transition-colors text-fg"
                >
                  {/* Employee name + avatar */}
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent-soft border border-accent/20 text-accent flex items-center justify-center font-bold text-[11px] shrink-0">
                        {row.displayName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <span className="font-semibold text-fg">{row.displayName}</span>
                    </div>
                  </td>

                  <td className="p-4 text-muted">{row.departmentName || '—'}</td>

                  {/* Clock In */}
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span className={row.clockInTime === '—' ? 'text-muted' : 'text-slate-200 font-mono'}>
                        {row.clockInTime}
                      </span>
                    </div>
                  </td>

                  {/* Clock Out */}
                  <td className="p-4">
                    <div className="flex items-center gap-1.5">
                      <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className={!row.clockOutTime ? 'text-muted italic' : 'text-slate-200 font-mono'}>
                        {row.clockOutTime || (row.clockedIn ? 'In office' : row.onDuty ? 'On Duty' : '—')}
                      </span>
                      {false && row.autoClockOut && (
                        <span className="ml-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded-md">
                          Auto
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Regular Hours */}
                  <td className="p-4">
                    <span className={`font-semibold font-mono ${row.regularSeconds > 0 ? 'text-accent' : 'text-muted'}`}>
                      {row.regularHours}
                    </span>
                  </td>

                  {false && (
                  <td className="p-4">
                    {row.extraSeconds > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="font-semibold font-mono text-violet-400">{row.extraHours}</span>
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  )}

                  {/* Status */}
                  <td className="p-4">{getStatusBadge(row)}</td>

                  {/* Admin Edit Actions */}
                  <td className="p-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePresentAbsent(row)}
                        disabled={togglingAttendanceUid === row.uid}
                        title={isRowPresent(row) ? 'Mark as Absent' : 'Mark as Present'}
                        className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 text-[11px] font-medium disabled:opacity-60 disabled:cursor-wait ${
                          isRowPresent(row)
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {togglingAttendanceUid === row.uid ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isRowPresent(row) ? (
                          <UserX className="w-3.5 h-3.5" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        {isRowPresent(row) ? 'Mark Absent' : 'Mark Present'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRow(row)
                          setEditClockIn(canonicalTimeOrDefault(row.clockInTime))
                          setEditClockOut(
                            timeStrToMinutes(row.clockOutTime)
                              ? canonicalTimeOrDefault(row.clockOutTime)
                              : 'In office'
                          )
                        }}
                        className="p-1.5 bg-canvas hover:bg-surface text-accent rounded-lg border border-border transition-colors inline-flex items-center gap-1 text-[11px] font-medium"
                        title="Edit Employee Time"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit Time
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Shift Log detail cards (shown when Firestore data available) */}
      {attendanceLogs.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
            Today's Shift Events
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {rows
              .filter((r) => r.shiftLogs && r.shiftLogs.length > 0)
              .map((row) => (
                <Card key={row.uid} className="p-4 border-border bg-surface space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-[11px]">
                      {row.displayName?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-slate-200">{row.displayName}</span>
                    {getStatusBadge(row)}
                  </div>

                  <div className="space-y-1.5">
                    {[...row.shiftLogs]
                      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
                      .map((log, i) => (
                        <div
                          key={log.id || i}
                          className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg bg-canvas border border-border"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                log.type === 'clock_in'
                                  ? 'bg-emerald-400'
                                  : log.type === 'clock_out' || log.type === 'auto_clock_out'
                                  ? 'bg-rose-400'
                                  : log.type === 'extra_start' || log.type === 'extra_end'
                                  ? 'bg-violet-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <span className="text-fg">{log.label}</span>
                          </div>
                          <span className="font-mono text-muted">{formatTimeStr(log.time)}</span>
                        </div>
                      ))}
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Employee-Wise Attendance Metrics Section */}
      <div className="space-y-3 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" /> Employee-Wise Attendance Averages & Metrics
          </h3>
          <span className="text-xs text-muted font-mono">
            Real calculated averages across all logged shifts
          </span>
        </div>

        <Card className="overflow-x-auto p-0 border-border">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-canvas border-b border-border text-muted font-semibold">
                <th className="p-4 font-semibold">Employee</th>
                <th className="p-4 font-semibold">Department</th>
                <th className="p-4 font-semibold">Avg Hours / Day</th>
                <th className="p-4 font-semibold">Avg Check-In</th>
                <th className="p-4 font-semibold">Earliest Clock-In</th>
                <th className="p-4 font-semibold">Avg Check-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {employeeStatsList.map((emp) => (
                <tr key={emp.uid} className="hover:bg-canvas transition-colors text-fg">
                  <td className="p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-accent-soft border border-accent/20 text-accent flex items-center justify-center font-bold text-[11px] shrink-0">
                        {emp.displayName?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-semibold text-fg">{emp.displayName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-muted">{emp.departmentName}</td>
                  <td className="p-4 font-semibold font-mono text-sky-400">{emp.avgHours}</td>
                  <td className="p-4 font-semibold font-mono text-emerald-400">{emp.avgCheckIn}</td>
                  <td className="p-4 font-semibold font-mono text-teal-400">{emp.avgArrival}</td>
                  <td className="p-4 font-semibold font-mono text-accent">{emp.avgCheckOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Edit Attendance Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative rounded-2xl bg-surface text-fg">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">Edit Attendance Record</h3>
                <p className="text-xs text-muted">
                  {editingRow.displayName} ({formatDate(selectedDate)})
                </p>
              </div>
              <button
                onClick={() => setEditingRow(null)}
                className="text-muted hover:text-fg p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="block text-xs font-medium text-fg">
                  Clock In
                </label>
                <AttendanceTimer value={editClockIn} onChange={setEditClockIn} />
              </div>

              <div className="space-y-2 text-left">
                <label className="block text-xs font-medium text-fg">
                  Clock Out
                </label>
                <div className="flex rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEditClockOut('In office')}
                    className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                      editClockOut === 'In office'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-transparent text-muted hover:text-fg'
                    }`}
                  >
                    In office
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editClockOut === 'In office') {
                        setEditClockOut(canonicalTimeOrDefault(null, '06:00 PM'))
                      }
                    }}
                    className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
                      editClockOut !== 'In office'
                        ? 'bg-accent text-white'
                        : 'bg-transparent text-muted hover:text-fg'
                    }`}
                  >
                    Clock out time
                  </button>
                </div>
                {editClockOut === 'In office' ? (
                  <p className="text-[11px] text-muted text-center py-3 rounded-xl border border-dashed border-border">
                    Still in office — hours count up to now
                  </p>
                ) : (
                  <AttendanceTimer value={editClockOut} onChange={setEditClockOut} />
                )}
              </div>

              <div className="rounded-xl border border-accent/20 bg-accent-soft px-3 py-2.5 flex items-center justify-between gap-3">
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-accent">
                    Regular Hours (auto)
                  </div>
                  <p className="text-[11px] text-muted mt-0.5">
                    Recalculated from clock-in → clock-out (max 8h)
                  </p>
                </div>
                <div className="font-mono text-sm font-bold text-accent shrink-0">
                  {editPreviewRegularHours}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRow(null)}
                  className="w-1/3 py-2 px-3 bg-canvas hover:bg-surface text-fg font-semibold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-2/3 py-2 px-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 text-white"
                >
                  {savingEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
