import React, { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, useParams } from 'react-router-dom'
import { ArrowLeft, FolderKanban, Loader2, ShieldAlert } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useProjectStore } from './stores/projectStore'
import { useUserStore } from '../../stores/userStore'
import { isUserOnProject } from './services/projectService'
import { ProjectSessionTabs } from './components/ProjectSessionTabs'
import { TaskBoard } from './TaskBoard'
import { WorkTimelinePage } from '../timeline/WorkTimelinePage'
import { ClientDocumentsPage } from '../documents/ClientDocumentsPage'
import { ProjectNotesPage } from './ProjectNotesPage'

export const ProjectSessionPage = () => {
  const { projectId } = useParams()
  const { projects, tasks, fetchProjectsAndTasks, loading } = useProjectStore()
  const { user, userDoc, claims } = useUserStore()
  const [fetched, setFetched] = useState(false)

  const userRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'owner' ||
    userRole === 'superadmin' ||
    claims?.role === 'admin' ||
    claims?.role === 'owner' ||
    claims?.role === 'superadmin'

  useEffect(() => {
    let cancelled = false
    fetchProjectsAndTasks().finally(() => {
      if (!cancelled) setFetched(true)
    })
    return () => {
      cancelled = true
    }
  }, [fetchProjectsAndTasks])

  const project = useMemo(
    () =>
      projects.find((p) => p.projectId === projectId || p.id === projectId) || null,
    [projects, projectId]
  )

  const canAccess = useMemo(() => {
    if (!project) return false
    if (isAdmin) return true
    return isUserOnProject(project, user, userDoc, tasks)
  }, [project, isAdmin, user, userDoc, tasks])

  if ((!fetched || loading) && !project) {
    return (
      <div className="py-20 text-center text-muted">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-accent" />
        <p className="text-sm">Loading project session...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <Card className="p-12 text-center space-y-3">
        <FolderKanban className="w-10 h-10 mx-auto text-slate-400" />
        <h2 className="text-lg font-bold text-fg">Project not found</h2>
        <p className="text-sm text-muted">
          This project session does not exist or is no longer available.
        </p>
        <Link
          to="/projects/list"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to All Projects
        </Link>
      </Card>
    )
  }

  if (!canAccess) {
    return (
      <Card className="p-12 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 mx-auto text-rose-400" />
        <h2 className="text-lg font-bold text-fg">Access denied</h2>
        <p className="text-sm text-muted">
          You are not a member of this project session.
        </p>
        <Link
          to="/projects/list"
          className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to All Projects
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name || 'Project Session'}
        description={
          project.clientName
            ? `${project.clientName}${project.description ? ` · ${project.description}` : ''}`
            : project.description || 'Project session workspace'
        }
        actions={
          <div className="flex items-center gap-3">
            <Badge variant="brand">{project.status || 'active'}</Badge>
            <Link
              to="/projects/list"
              className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-accent"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Projects
            </Link>
          </div>
        }
      />

      <ProjectSessionTabs />

      <Outlet context={{ project, projectId }} />
    </div>
  )
}

export const SessionTaskBoard = () => {
  const { projectId } = useParams()
  return <TaskBoard embedded lockedProjectId={projectId} />
}

export const SessionTimelinePage = () => <WorkTimelinePage embedded />

export const SessionDocumentsPage = () => {
  const { projectId } = useParams()
  return <ClientDocumentsPage embedded lockedProjectId={projectId} />
}

export const SessionNotesPage = () => <ProjectNotesPage />

export const SessionIndexRedirect = () => <Navigate to="tasks" replace />
