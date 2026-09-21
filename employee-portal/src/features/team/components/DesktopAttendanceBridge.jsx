import { useEffect } from 'react'
import { useAttendanceClockActions } from '../hooks/useAttendanceClockActions'
import { notifyDesktopSession } from '../services/desktopAttendanceSync'
import { useUserStore } from '../../../stores/userStore'

export const DesktopAttendanceBridge = () => {
  const user = useUserStore((s) => s.user)
  const { clockedIn, isOnBreak } = useAttendanceClockActions({ listenForDesktopEvents: true })

  useEffect(() => {
    notifyDesktopSession({
      signedIn: Boolean(user),
      clockedIn,
      isOnBreak,
    })
  }, [user, clockedIn, isOnBreak])

  return null
}
