import React, { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { getProjects } from '../projects/services/projectService'
import { QcReviewPage } from '../../../../shared/qc/QcReviewPage.jsx'
import { employeeCanSeeQc } from '../../../../shared/qc/qcAccess.js'

export const QcPage = () => {
  const { user, userDoc, claims } = useUserStore()
  const [projects, setProjects] = useState([])
  const role = claims?.role || userDoc?.role || 'admin'
  const blocked = role === 'employee' && !employeeCanSeeQc(userDoc)
  const actor = useMemo(
    () => ({
      id: user?.uid || userDoc?.uid || userDoc?.id || '',
      name: userDoc?.displayName || userDoc?.name || user?.displayName || user?.email || 'Head',
    }),
    [user, userDoc]
  )

  useEffect(() => {
    if (blocked) return
    getProjects().then((rows) => setProjects(rows || []))
  }, [blocked])

  if (blocked) return <Navigate to="/dashboard" replace />

  return <QcReviewPage mode="admin" projects={projects} actor={actor} />
}
