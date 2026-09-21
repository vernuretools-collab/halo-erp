import React, { useEffect } from 'react'
import { useTeamStore } from '../team/stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import { auth } from '../../shared/services/firebaseService'
import { fetchCustomClaims } from '../../shared/services/authService'
import { useLiveAuthSession } from '../../../../shared/supabase/useLiveAuthSession.js'
import { useAutoClockOutAfterWorkday } from '../team/hooks/useAutoClockOutAfterWorkday'
import { useAttendanceLinkedTaskTimers } from '../projects/hooks/useAttendanceLinkedTaskTimers'
import { notifyDesktopSession } from '../team/services/desktopAttendanceSync'
import { DesktopTimingPage } from './DesktopTimingPage'
import { Button } from '../../components/ui/Button'
import { useUIStore } from '../../stores/uiStore'
import { Moon, Sun } from 'lucide-react'
import { useTimingWindowDrag } from './useTimingWindowDrag'

export const DesktopTimingLayout = () => {
  const { theme, toggleTheme } = useUIStore()
  const windowDrag = useTimingWindowDrag()
  const { user, sessionReady } = useLiveAuthSession({
    auth,
    useUserStore,
    fetchCustomClaims,
  })
  useAutoClockOutAfterWorkday()
  useAttendanceLinkedTaskTimers()

  const clockedIn = useTeamStore((s) => s.clockedIn)
  const isOnBreak = useTeamStore((s) => s.isOnBreak)

  useEffect(() => {
    if (!sessionReady) return
    notifyDesktopSession({
      signedIn: Boolean(user),
      clockedIn,
      isOnBreak,
    })
  }, [sessionReady, user, clockedIn, isOnBreak])

  if (!sessionReady) {
    return (
      <div className="h-screen w-screen bg-canvas text-fg flex items-center justify-center">
        <p className="text-xs text-muted">Checking session…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="h-screen w-screen bg-canvas text-fg flex flex-col">
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border cursor-move"
          style={{ WebkitAppRegion: 'no-drag' }}
          title="Drag to move"
          {...windowDrag}
        >
          <span className="text-sm font-extrabold">My Timing</span>
          <div className="flex items-center gap-1 cursor-auto" data-no-drag="true">
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-7 h-7 rounded-lg bg-chrome hover:bg-border text-muted hover:text-fg flex items-center justify-center border border-border"
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>
            <button
              type="button"
              onClick={() => window.desktop?.hideMyTiming?.()}
              className="w-6 h-6 rounded-md text-muted hover:bg-chrome"
            >
              –
            </button>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-xs text-muted">Sign in to the Employee Portal to use My Timing.</p>
          <Button
            size="sm"
            className="font-extrabold"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={() => window.desktop?.openEmployeePortal?.()}
          >
            Sign in
          </Button>
        </div>
      </div>
    )
  }

  return <DesktopTimingPage />
}
