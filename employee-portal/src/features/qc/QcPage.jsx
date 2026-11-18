import React, { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { getProjectsFromDb } from '../projects/services/projectService'
import { QcReviewPage } from '../../../../shared/qc/QcReviewPage.jsx'
import { employeeCanSeeQc } from '../../../../shared/qc/qcAccess.js'

export const QcPage = () => {
  const { user, userDoc } = useUserStore()
  const [projects, setProjects] = useState([])
  const actor = useMemo(
    () => ({
      id: user?.uid || userDoc?.uid || userDoc?.id || '',
      name: userDoc?.displayName || userDoc?.name || user?.displayName || user?.email || 'Editor',
    }),
    [user, userDoc]
  )

  useEffect(() => {
    if (!employeeCanSeeQc(userDoc)) return
    getProjectsFromDb().then((rows) => setProjects(rows || []))
  }, [userDoc])

  if (!employeeCanSeeQc(userDoc)) return <Navigate to="/dashboard" replace />

  return <QcReviewPage mode="employee" projects={projects} actor={actor} />
}
