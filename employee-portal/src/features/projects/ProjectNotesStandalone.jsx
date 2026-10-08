import React, { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, StickyNote } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { useProjectStore } from './stores/projectStore'
import { useUserStore } from '../../stores/userStore'
import { isUserOnProject } from './services/projectService'
import { ProjectNotesPage } from './ProjectNotesPage'
import { WorkRemindersPanel } from '../work-reminders/WorkRemindersPanel'

export const ProjectNotesStandalone = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlProjectId = searchParams.get('projectId')
  const { projects, tasks, selectedProjectId, setSelectedProjectId, fetchProjectsAndTasks } =
    useProjectStore()
  const { user, userDoc, claims } = useUserStore()

  const userRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    userRole === 'admin' ||
    userRole === 'owner' ||
    userRole === 'superadmin' ||
    claims?.role === 'admin' ||
    claims?.role === 'owner' ||
    claims?.role === 'superadmin'

  useEffect(() => {
    fetchProjectsAndTasks()
  }, [fetchProjectsAndTasks])

  useEffect(() => {
    if (urlProjectId) setSelectedProjectId(urlProjectId)
  }, [urlProjectId, setSelectedProjectId])

  const visibleProjects = useMemo(
    () =>
      isAdmin ? projects : projects.filter((p) => isUserOnProject(p, user, userDoc, tasks)),
    [isAdmin, projects, user, userDoc, tasks]
  )

  const projectId =
    selectedProjectId && selectedProjectId !== 'all'
      ? selectedProjectId
      : visibleProjects[0]?.projectId || visibleProjects[0]?.id || ''

  const project = visibleProjects.find((p) => p.projectId === projectId || p.id === projectId)

  const handleProjectChange = (pId) => {
    setSelectedProjectId(pId)
    setSearchParams(pId ? { projectId: pId } : {})
  }

  useEffect(() => {
    if (!selectedProjectId && visibleProjects[0]) {
      const firstId = visibleProjects[0].projectId || visibleProjects[0].id
      setSelectedProjectId(firstId)
    }
  }, [selectedProjectId, visibleProjects, setSelectedProjectId])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Notes"
        description="Project tasks on the left. Personal reminders on the right."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch lg:min-h-[calc(100vh-9.5rem)]">
        {projectId ? (
          <ProjectNotesPage
            projectId={projectId}
            project={project}
            panel
            toolbar={
              <span className="text-xs font-medium text-muted flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-accent" /> Project:
                <select
                  value={projectId || ''}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="bg-chrome border border-border text-xs text-fg font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:border-accent cursor-pointer"
                >
                  {visibleProjects.length === 0 ? (
                    <option value="">No projects available</option>
                  ) : (
                    visibleProjects.map((p) => (
                      <option key={p.projectId || p.id} value={p.projectId || p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </span>
            }
          />
        ) : (
          <Card className="p-12 text-center space-y-2 border-dashed">
            <StickyNote className="w-10 h-10 mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-fg">Select a project</p>
            <p className="text-xs text-slate-400">Notes are stored per project.</p>
          </Card>
        )}

        <WorkRemindersPanel />
      </div>
    </div>
  )
}
