import { useEffect, useRef } from 'react'
import { useTeamStore } from '../../team/stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import { useProjectStore } from '../stores/projectStore'
import { isEmployeeActivelyWorking } from '../services/projectService'

export const useAttendanceLinkedTaskTimers = () => {
  const clockedIn = useTeamStore((s) => s.clockedIn)
  const isOnBreak = useTeamStore((s) => s.isOnBreak)
  const isOnLunch = useTeamStore((s) => s.isOnLunch)
  const { user, userDoc } = useUserStore()
  const lastFetchedAt = useProjectStore((s) => s.lastFetchedAt)
  const syncTaskTimersWithAttendance = useProjectStore((s) => s.syncTaskTimersWithAttendance)
  const prevActiveRef = useRef(null)

  useEffect(() => {
    if (!user?.uid && !userDoc?.uid) return

    const attendance = { clockedIn, isOnBreak, isOnLunch }
    const active = isEmployeeActivelyWorking(attendance)
    const prevActive = prevActiveRef.current
    const freezeElapsed = !active && prevActive !== true
    prevActiveRef.current = active

    syncTaskTimersWithAttendance({
      clockedIn,
      isOnBreak,
      isOnLunch,
      user,
      userDoc,
      freezeElapsed,
    })
  }, [clockedIn, isOnBreak, isOnLunch, user, userDoc, lastFetchedAt, syncTaskTimersWithAttendance])
}
