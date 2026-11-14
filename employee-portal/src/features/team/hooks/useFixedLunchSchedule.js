import { useEffect } from 'react'
import { useTeamStore } from '../stores/teamStore'
import { useUserStore } from '../../../stores/userStore'
import {
  fixedLunchEndMs,
  isWithinFixedLunch,
  subscribeEmployeeControls,
  getEmployeeControls,
} from '../../../../../shared/employeeControls.js'

/**
 * While the admin lunch window is active, a clocked-in employee is put on lunch.
 * A lunch they started themselves (no scheduled end) is left alone.
 * When the window ends, only the scheduled lunch is closed so screenshots and
 * break status return to the normal rules.
 */
export function useFixedLunchSchedule() {
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)

  useEffect(() => {
    let controls = null
    let ready = false

    const userMeta = () => ({
      uid: userDoc?.uid || user?.uid,
      displayName: userDoc?.displayName || user?.displayName || 'Employee',
      departmentName: userDoc?.departmentName || '',
    })

    const tick = () => {
      if (!ready || !controls) return
      const within = isWithinFixedLunch(controls)
      const state = useTeamStore.getState()

      if (!within) {
        if (state.isOnLunch && state.lunchEndsAt) state.finishLunch()
        return
      }

      if (!state.clockedIn || state.isOnLunch) return
      const meta = userMeta()
      if (!meta.uid) return
      const endsAt = fixedLunchEndMs(controls)
      if (!endsAt || endsAt <= Date.now()) return
      useTeamStore.getState().startLunch(meta, { endsAt })
    }

    const unsubscribe = subscribeEmployeeControls((next) => {
      controls = next
      if (ready) tick()
    })
    getEmployeeControls()
      .then((next) => {
        controls = next
        ready = true
        tick()
      })
      .catch(() => {
        ready = true
      })

    const timer = setInterval(tick, 15000)
    const unsubscribeStore = useTeamStore.subscribe((state, prev) => {
      if (state.clockedIn && !prev?.clockedIn) tick()
    })

    return () => {
      clearInterval(timer)
      unsubscribe?.()
      unsubscribeStore?.()
    }
  }, [user, userDoc])
}
