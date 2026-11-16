import React, { useEffect, useMemo, useState } from 'react'
import { useUserStore } from '../../stores/userStore'
import { getProjects } from '../projects/services/projectService'
import { QcReviewPage } from '../../../../shared/qc/QcReviewPage.jsx'

export const QcPage = () => {
  const { user, userDoc } = useUserStore()
  const [projects, setProjects] = useState([])

  const actor = useMemo(
    () => ({
      id: user?.uid || userDoc?.uid || userDoc?.id || '',
      name: userDoc?.displayName || userDoc?.name || user?.displayName || user?.email || 'Head',
    }),
    [user, userDoc]
  )

  useEffect(() => {
    getProjects().then((rows) => setProjects(rows || []))
  }, [])

  return <QcReviewPage mode="admin" projects={projects} actor={actor} />
}
