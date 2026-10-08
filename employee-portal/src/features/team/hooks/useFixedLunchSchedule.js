import { useEffect } from 'react'
import { useTeamStore } from '../stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import {
  fixedLunchEndMs,
  isWithinFixedLunch,
  subscribeEmployeeControls,
} from '../../../../../shared/employeeControls.js'

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function alreadyHadLunchToday(state) {
  if ((state?.accumulatedLunchSeconds || 0) > 0) return true
  return (state?.todayShiftLogs || []).some((log) => log?.type === 'lunch_start' || log?.type === 'lunch_end')
}

export function useFixedLunchSchedule() {
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)

  useEffect(() => {
    let controls = null
    const tick = () => {
      if (!controls || !isWithinFixedLunch(controls)) return
      const state = useTeamStore.getState()
      if (!state.clockedIn || state.isOnLunch || alreadyHadLunchToday(state)) return
      const meta = {
        uid: userDoc?.uid || user?.uid,
        displayName: userDoc?.displayName || user?.displayName || 'Employee',
        departmentName: userDoc?.departmentName || '',
      }
      if (!meta.uid) return
      const endsAt = fixedLunchEndMs(controls)
      if (!endsAt || endsAt <= Date.now()) return
      const lockKey = `crm_fixed_lunch_${localDateKey()}`
      try {
        if (localStorage.getItem(lockKey)) return
        localStorage.setItem(lockKey, '1')
      } catch {
        /* private mode */
      }
      if (useTeamStore.getState().isOnBreak) useTeamStore.getState().toggleBreak(meta)
      useTeamStore.getState().startLunch(meta, { endsAt })
      if (!useTeamStore.getState().isOnLunch) {
        try {
          localStorage.removeItem(lockKey)
        } catch {
          /* private mode */
        }
      }
    }

    const unsubscribe = subscribeEmployeeControls((next) => {
      controls = next
      tick()
    })
    const timer = setInterval(tick, 15000)
    return () => {
      clearInterval(timer)
      unsubscribe?.()
    }
  }, [user, userDoc])
}
