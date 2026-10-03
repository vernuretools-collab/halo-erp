import { useEffect, useState } from 'react'
import { isCurrentConductor } from './scrumModel.js'
import { getScrumConductor } from './scrumService.js'

export function useIsScrumConductor(user, userDoc) {
  const [isConductor, setIsConductor] = useState(false)
  const [ready, setReady] = useState(false)
  const userId = user?.uid || user?.id || ''
  const userEmail = user?.email || userDoc?.email || ''
  const docEmployeeId = userDoc?.employeeId || userDoc?.uid || ''

  useEffect(() => {
    let cancelled = false
    const load = () => {
      getScrumConductor()
        .then((conductor) => {
          if (cancelled) return
          setIsConductor(isCurrentConductor(conductor, { user, userDoc }))
          setReady(true)
        })
        .catch(() => {
          if (cancelled) return
          setIsConductor(false)
          setReady(true)
        })
    }
    load()
    const timer = setInterval(load, 20000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [user, userDoc, userId, userEmail, docEmployeeId])

  return { isConductor, ready }
}
