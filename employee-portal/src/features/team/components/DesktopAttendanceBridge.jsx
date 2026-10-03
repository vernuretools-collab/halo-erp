import { useEffect } from 'react'
import { useAttendanceClockActions } from '../hooks/useAttendanceClockActions'
import { notifyDesktopSession } from '../services/desktopAttendanceSync'
import { useUserStore } from '../../../stores/userStore'

export const DesktopAttendanceBridge = () => {
  const user = useUserStore((s) => s.user)
  const { clockedIn, isOnBreak, isOnLunch } = useAttendanceClockActions({ listenForDesktopEvents: true })

  useEffect(() => {
    notifyDesktopSession({
      signedIn: Boolean(user),
      clockedIn,
      isOnBreak,
      isOnLunch,
    })
  }, [user, clockedIn, isOnBreak, isOnLunch])

  return null
}
