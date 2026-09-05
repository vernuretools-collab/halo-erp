import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { usePortalStore } from './stores/portalStore'
import { useUserStore } from '../../stores/userStore'
import { getClientProjects, getProjectById, subscribeProjectProcessSteps } from './services/portalService'
import {
  Folder,
  Calendar,
  CheckCircle2,
  Flag,
  Loader2,
  ArrowLeft,
  Clock,
  Sparkles,
  TrendingUp,
  Briefcase,
  Layers,
} from 'lucide-react'
import { ClientProjectTimeline } from './components/ClientProjectTimeline'

export const ClientProjects = () => {
  const { projectId: routeProjectId } = useParams()
  const navigate = useNavigate()
  const { user } = useUserStore()
  const { projects, setProjects } = usePortalStore()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(routeProjectId || null)
  const [selectedProjectDetail, setSelectedProjectDetail] = useState(null)
  const [liveSteps, setLiveSteps] = useState([])

  useEffect(() => {
    const fetchProjects = async () => {
      if (user?.uid && projects.length === 0) {
        setIsLoading(true)
        try {
          const projs = await getClientProjects(user.uid)
          setProjects(projs)
        } catch (err) {
          console.warn('Failed to load client projects:', err)
        } finally {
          setIsLoading(false)
        }
      }
    }
    fetchProjects()
  }, [user, projects.length, setProjects])

  // Sync route param with state
  useEffect(() => {
    if (routeProjectId) {
      setSelectedProjectId(routeProjectId)
    }
  }, [routeProjectId])

  // Load selected project details if needed
  useEffect(() => {
    const loadSelected = async () => {
      if (!selectedProjectId) {
        setSelectedProjectDetail(null)
        return
      }
      const existing = projects.find(
        (p) => (p.projectId || p.id) === selectedProjectId
      )
      if (existing) {
        setSelectedProjectDetail(existing)
      } else {
        const fetched = await getProjectById(selectedProjectId)
        if (fetched) setSelectedProjectDetail(fetched)
      }
    }
    loadSelected()
  }, [selectedProjectId, projects])

  // Subscribe to live process steps for the selected project to derive live progress
  useEffect(() => {
    if (!selectedProjectId) {
      setLiveSteps([])
      return
    }

    const unsub = subscribeProjectProcessSteps(selectedProjectId, (steps) => {
      setLiveSteps(steps || [])
    })

    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [selectedProjectId])

  const handleSelectProject = (pId) => {
    setSelectedProjectId(pId)
    // Update URL without full reload if supported
    navigate(`/portal/projects/${pId}`, { replace: false })
  }

  const handleBackToList = () => {
    setSelectedProjectId(null)
    setSelectedProjectDetail(null)
    setLiveSteps([])
    navigate('/portal/projects')
  }

  // Selected Project Detail & Timeline View
  if (selectedProjectId) {
    const p =
      selectedProjectDetail ||
      projects.find((item) => (item.projectId || item.id) === selectedProjectId) ||
      {}

    // Derive live progress from process steps
    const totalSteps = liveSteps.length
    const completedSteps = liveSteps.filter((s) => s.status === 'completed').length
    const liveCompletion = totalSteps > 0
      ? Math.round((completedSteps / totalSteps) * 100)
      : Number(p.completionPercent || p.progress || 0)

    const activeStage = liveSteps.find((s) => s.status === 'in_progress') || liveSteps.find((s) => s.status === 'pending')
    const liveMilestone = totalSteps > 0
      ? (activeStage ? activeStage.title : (completedSteps === totalSteps ? 'All Stages Completed' : 'In Progress'))
      : (p.nextMilestone || p.milestone || 'In Progress')

    const status = p.status || (liveCompletion >= 100 ? 'Completed' : 'Active')
    const isCompleted = liveCompletion >= 100 || status.toLowerCase() === 'completed'

    return (
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-accent transition-colors py-1.5 px-3 rounded-lg hover:bg-chrome"
          >
            <ArrowLeft className="w-4 h-4" /> Back to My Projects
          </button>

          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              isCompleted
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-accent-soft text-accent border border-accent/20'
            }`}
          >
            {status}
          </span>
        </div>

        {/* Project Header Overview Card */}
        <Card className="p-6 bg-surface border-border rounded-2xl shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Folder className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-fg tracking-tight">
                  {p.name || p.title || 'Website Redesign'}
                </h1>
                <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl">
                  {p.description || 'Custom client project deliverables and roadmap.'}
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6">
              <div>
                <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                  Progress
                </span>
                <span className="text-lg font-bold text-accent">
                  {liveCompletion}%
                </span>
              </div>
              {p.startDate || p.estimatedDate || p.dueDate ? (
                <div>
                  <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                    Start Date
                  </span>
                  <span className="text-xs font-semibold text-fg flex items-center gap-1 mt-1">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    {p.startDate || p.estimatedDate || p.dueDate}
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Progress Bar & Milestone Status (Derived directly from Admin Process Messages) */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted">
              <span className="flex items-center gap-1.5 truncate max-w-[70%]">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                Current Milestone:{' '}
                <strong className="text-fg truncate">
                  {liveMilestone}
                </strong>
              </span>
              <span className="font-semibold text-fg shrink-0">
                {totalSteps > 0 ? `${completedSteps} of ${totalSteps} (${liveCompletion}%)` : `${liveCompletion}% Completed`}
              </span>
            </div>
            <div className="w-full bg-chrome h-2 rounded-full overflow-hidden">
              <div
                className="bg-accent h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, liveCompletion))}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Timeline Section (Matching the provided UI) */}
        <div>
          <ClientProjectTimeline projectId={selectedProjectId} project={p} />
        </div>
      </div>
    )
  }

  // All Projects Grid View
  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold text-fg tracking-tight">
          My Projects
        </h2>
        <p className="text-sm text-muted mt-1">
          Click on any project to view its real-time activity timeline, milestones, and deliverables.
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
          <span className="text-xs">Loading projects...</span>
        </div>
      ) : projects.length === 0 ? (
        <Card className="p-12 text-center text-xs text-muted border-dashed">
          No active projects assigned to your portal yet.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const pId = p.projectId || p.id || p.name
            const completion = Number(p.completionPercent || p.progress || 0)
            const status = p.status || 'Active'
            const isCompleted = completion >= 100 || status.toLowerCase() === 'completed'

            return (
              <Card
                key={pId}
                onClick={() => handleSelectProject(pId)}
                className="p-5 bg-surface border-border rounded-2xl shadow-2xs hover:shadow-md hover:border-accent/40 transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div className="space-y-3">
                  {/* Top: Icon & Status Badge */}
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Folder className="w-5 h-5" />
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'bg-accent-soft text-accent'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-fg text-sm truncate group-hover:text-accent transition-colors">
                      {p.name || p.title || 'Untitled Project'}
                    </h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2 min-h-[32px]">
                      {p.description || 'Custom client project deliverables and roadmap.'}
                    </p>
                  </div>
                </div>

                {/* Progress & Milestone Section */}
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium text-muted">
                      <span>Progress</span>
                      <span className="font-bold text-fg">
                        {completion}%
                      </span>
                    </div>
                    <div className="w-full bg-chrome h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-accent h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestone & Target Date */}
                  <div className="space-y-1.5 text-[11px] text-muted pt-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span className="truncate">
                        Milestone:{' '}
                        <strong className="text-fg font-semibold">
                          {p.nextMilestone || p.milestone || 'In Progress'}
                        </strong>
                      </span>
                    </div>
                    {p.dueDate && (
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Due: {p.dueDate}</span>
                      </div>
                    )}
                  </div>

                  {/* View Timeline Action Indicator */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-accent font-semibold group-hover:underline">
                    <span>View Project Timeline</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}



