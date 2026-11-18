import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { isDirectoryVisible } from '../../../../shared/employees/employmentStatus.js'
import { getProjectsFromDb } from '../projects/services/projectService'
import { listQuotas, listReels } from '../../../../shared/reels/reelService.js'
import { personName } from './reelsUi'

export function useReelDirectory() {
  const [reels, setReels] = useState([])
  const [quotas, setQuotas] = useState([])
  const [projects, setProjects] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = async () => {
    const [rows, quotaRows] = await Promise.all([listReels(), listQuotas()])
    setReels(rows)
    setQuotas(quotaRows)
  }

  useEffect(() => {
    let cancelled = false
    reload()
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load reels.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    getProjectsFromDb().then((rows) => {
      if (!cancelled) setProjects(rows || [])
    })
    getDocs(collection(db, 'employees'))
      .then((snap) => {
        if (cancelled) return
        setEmployees(
          snap.docs
            .map((docSnap) => ({ ...(docSnap.data() || {}), docId: docSnap.id }))
            .filter(isDirectoryVisible)
            .sort((a, b) => personName(a).localeCompare(personName(b)))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return { reels, quotas, projects, employees, loading, error, setError, reload }
}
