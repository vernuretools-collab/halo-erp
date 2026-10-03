const CHANNEL_NAME = 'crm-employee-attendance'
export const TEAM_STORE_KEY = 'crm_employee_team_store'

export const ATTENDANCE_SYNC_KEYS = [
  'currentUserId',
  'clockedIn',
  'clockInTime',
  'clockInTimestamp',
  'clockOutTime',
  'isOnBreak',
  'breakStartTime',
  'accumulatedBreakSeconds',
  'isOnLunch',
  'lunchStartTime',
  'accumulatedLunchSeconds',
  'accumulatedWorkSeconds',
  'todayShiftLogs',
  'isInExtraTime',
  'extraTimeStart',
  'accumulatedExtraSeconds',
  'extraTimeLogs',
  'overtimeRecords',
  'lastWorkDate',
]

export function snapshotAttendance(state) {
  const snap = {}
  for (const key of ATTENDANCE_SYNC_KEYS) {
    snap[key] = state?.[key]
  }
  return snap
}

export function inferAttendanceAction(prev = {}, next = {}) {
  if (!prev.clockedIn && next.clockedIn) return 'clockIn'
  if (prev.clockedIn && !next.clockedIn) return 'clockOut'
  if (!prev.isOnBreak && next.isOnBreak) return 'break'
  if (prev.isOnBreak && !next.isOnBreak) return 'resume'
  if (!prev.isOnLunch && next.isOnLunch) return 'lunch'
  if (prev.isOnLunch && !next.isOnLunch) return 'lunchEnd'
  return null
}

export function notifyDesktopAttendance(state, action = null) {
  try {
    const desktop = typeof window !== 'undefined' ? window.desktop : null
    if (!desktop?.attendanceChanged) return
    desktop.attendanceChanged({
      signedIn: true,
      clockedIn: Boolean(state?.clockedIn),
      isOnBreak: Boolean(state?.isOnBreak),
      isOnLunch: Boolean(state?.isOnLunch),
      action,
    })
  } catch {
    /* not running inside Electron */
  }
}

export function notifyDesktopSession({ signedIn, clockedIn = false, isOnBreak = false, isOnLunch = false } = {}) {
  try {
    const desktop = typeof window !== 'undefined' ? window.desktop : null
    if (!desktop?.attendanceChanged) return
    desktop.attendanceChanged({
      signedIn: Boolean(signedIn),
      clockedIn: Boolean(clockedIn),
      isOnBreak: Boolean(isOnBreak),
      isOnLunch: Boolean(isOnLunch),
    })
  } catch {
    /* not running inside Electron */
  }
}

let applyingRemote = false
let channel = null

export function isApplyingRemoteAttendance() {
  return applyingRemote
}

export function attachTeamStoreCrossWindowSync(useTeamStore) {
  if (typeof window === 'undefined' || channel) return

  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
  } catch {
    channel = null
  }

  useTeamStore.subscribe((state, prev) => {
    if (applyingRemote) return
    const nextSnap = snapshotAttendance(state)
    const prevSnap = snapshotAttendance(prev)
    if (JSON.stringify(nextSnap) === JSON.stringify(prevSnap)) return
    const action = inferAttendanceAction(prevSnap, nextSnap)
    try {
      channel?.postMessage(nextSnap)
    } catch {
      /* ignore */
    }
    notifyDesktopAttendance(state, action)
  })

  if (channel) {
    channel.onmessage = (event) => {
      if (!event?.data || typeof event.data !== 'object') return
      applyingRemote = true
      try {
        useTeamStore.setState(event.data)
      } finally {
        applyingRemote = false
      }
    }
  }

  window.addEventListener('storage', (event) => {
    if (event.key !== TEAM_STORE_KEY || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue)
      const remote = parsed.state || parsed
      if (!remote || typeof remote !== 'object') return
      applyingRemote = true
      useTeamStore.setState(snapshotAttendance(remote))
    } catch {
      /* ignore malformed persist payloads */
    } finally {
      applyingRemote = false
    }
  })
}
