import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { useProjectStore } from './stores/projectStore'
import {
  getProjectById,
  isUserOnProject,
  subscribeProjectProcessSteps,
  addProcessStep,
  updateProcessStep,
  toggleProcessStepStatus,
  deleteProcessStep,
  getClientVisibility,
  getProjectDisplayStatus,
  getProjectStartDate,
} from './services/projectService'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Filter,
  MessageSquare,
  Check,
  FileText,
  UserCheck,
  LifeBuoy,
  FolderKanban,
  CheckCircle2,
  Clock,
  Building,
  User,
  Calendar,
  ChevronDown,
  X,
  Send,
  Sparkles,
  Loader2,
  PlayCircle,
  CheckCircle,
  CircleDot,
  Eye,
  EyeOff,
} from 'lucide-react'

const formatTimelineDate = (ts) => {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return String(ts)
    const day = d.getDate()
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const month = months[d.getMonth()]
    const year = d.getFullYear()
    let hours = d.getHours()
    const minutes = d.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12
    hours = hours ? hours : 12
    return `${day} ${month}, ${year} • ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`
  } catch {
    return String(ts)
  }
}

const getProcessIconConfig = (type, status) => {
  if (status === 'completed') {
    return { bg: 'bg-emerald-600', icon: Check }
  }
  switch (type?.toLowerCase()) {
    case 'message':
      return { bg: status === 'in_progress' ? 'bg-info ring-4 ring-blue-500/30' : 'bg-blue-600/80', icon: MessageSquare }
    case 'invoice':
      return { bg: 'bg-emerald-600', icon: Check }
    case 'document':
      return { bg: 'bg-purple-600', icon: FileText }
    case 'approval':
      return { bg: 'bg-amber-500', icon: UserCheck }
    case 'ticket':
    case 'support':
      return { bg: 'bg-blue-500', icon: LifeBuoy }
    default:
      return { bg: status === 'in_progress' ? 'bg-accent ring-4 ring-accent/30' : 'bg-emerald-600', icon: FolderKanban }
  }
}

export const ProjectManagePage = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user, userDoc, claims } = useUserStore()
  const { projects, tasks, fetchProjectsAndTasks } = useProjectStore()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  const [showStepModal, setShowStepModal] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [stepTitle, setStepTitle] = useState('')
  const [stepMessage, setStepMessage] = useState('')
  const [stepType, setStepType] = useState('message')
  const [stepStatus, setStepStatus] = useState('pending')
  const [stepAuthor, setStepAuthor] = useState('')
  const [stepMeta, setStepMeta] = useState('')
  const [submittingStep, setSubmittingStep] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(null)

  const empUid = userDoc?.uid || user?.uid || null
  const empName = userDoc?.displayName || user?.displayName || userDoc?.name || 'Team'
  const userRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    userRole === 'admin' || userRole === 'owner' || userRole === 'superadmin'

  useEffect(() => {
    fetchProjectsAndTasks?.()
  }, [fetchProjectsAndTasks])

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return
      setLoading(true)
      const fromStore = projects.find((p) => p.projectId === projectId || p.id === projectId)
      const data = fromStore || (await getProjectById(projectId))
      setProject(data)
      setLoading(false)
    }
    loadProject()
  }, [projectId, projects])

  useEffect(() => {
    if (!projectId) return
    const unsub = subscribeProjectProcessSteps(projectId, (list) => setSteps(list))
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [projectId])

  const canAccess = useMemo(() => {
    if (!project) return false
    if (isAdmin) return true
    return isUserOnProject(project, user, userDoc, tasks)
  }, [project, isAdmin, user, userDoc, tasks])

  const handleOpenAddStepModal = (initialType = 'message') => {
    setEditingStep(null)
    setStepType(initialType)
    setStepTitle('')
    setStepMessage('')
    setStepAuthor(empName)
    setStepMeta('')
    setStepStatus(steps.length === 0 ? 'in_progress' : 'pending')
    setShowStepModal(true)
  }

  const handleOpenEditStepModal = (step) => {
    setEditingStep(step)
    setStepType(step.type || 'message')
    setStepTitle(step.title || '')
    setStepMessage(step.message || step.description || '')
    setStepAuthor(step.author || empName)
    setStepMeta(step.meta || '')
    setStepStatus(step.status || 'pending')
    setShowStepModal(true)
  }

  const handleSaveProcessStep = async (e) => {
    e.preventDefault()
    if (!stepTitle.trim()) return
    setSubmittingStep(true)
    try {
      const payload = {
        title: stepTitle.trim(),
        message: stepMessage.trim(),
        type: stepType,
        status: stepStatus,
        author: stepAuthor.trim() || empName,
        meta: stepMeta.trim(),
      }
      if (editingStep) {
        await updateProcessStep(projectId, editingStep.id, payload)
      } else {
        await addProcessStep(projectId, {
          ...payload,
          createdByRole: 'employee',
          createdByUid: empUid,
          createdByName: empName,
          clientVisibility: 'pending',
        })
      }
      setShowStepModal(false)
    } catch (err) {
      console.error('Failed to save process step:', err)
    } finally {
      setSubmittingStep(false)
    }
  }

  const handleToggleStatus = async (step) => {
    try {
      await toggleProcessStepStatus(projectId, step.id, step.status)
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  const handleSetStepStatus = async (stepId, targetStatus) => {
    try {
      await updateProcessStep(projectId, stepId, { status: targetStatus })
    } catch (err) {
      console.error('Failed to update step status:', err)
    }
  }

  const handleDeleteStep = async (stepId) => {
    try {
      await deleteProcessStep(projectId, stepId)
      setDeleteConfirmStep(null)
    } catch (err) {
      console.error('Failed to delete step:', err)
    }
  }

  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const calculatedPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const activeStep = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'pending')
  const filteredSteps = steps.filter((s) => (statusFilter === 'all' ? true : s.status === statusFilter))

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm font-medium">Loading project process...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-fg">Project Not Found</h3>
        <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/projects/list')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <h3 className="text-lg font-bold text-fg">You are not assigned to this project</h3>
        <p className="text-xs text-muted">Only employees on the project can manage its client timeline stages.</p>
        <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/projects/list')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  const displayStatus = getProjectDisplayStatus(project)

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/projects/list"
              className="text-xs font-semibold text-muted hover:text-accent flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Projects
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <span className="text-xs font-medium text-fg truncate max-w-[200px]">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-fg tracking-tight flex items-center gap-3">
            {project.name}
            <Badge variant={displayStatus === 'active' ? 'success' : displayStatus === 'completed' ? 'brand' : 'warning'}>
              {displayStatus === 'on_hold' ? 'on hold' : displayStatus}
            </Badge>
          </h1>
          <p className="text-xs text-muted">Stages you add stay hidden from the client until an admin approves them.</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => handleOpenAddStepModal('message')}>
          Add Process Stage / Message
        </Button>
      </div>

      <Card className="p-6 bg-surface border-border rounded-2xl shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Project Description</span>
            <p className="text-xs text-fg line-clamp-3">
              {project.description || 'No description provided for this project.'}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Client</span>
            <p className="text-xs text-fg font-semibold flex items-center gap-1">
              <Building className="w-3 h-3 text-accent" /> {project.clientName || 'Independent'}
            </p>
            <p className="text-xs text-muted flex items-center gap-1">
              <User className="w-3 h-3" /> Lead: {project.ownerName || 'Unassigned'}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Start: {getProjectStartDate(project) || '—'}
            </p>
          </div>
        </div>
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
              Current Process Stage:{' '}
              <strong className="text-fg">{activeStep ? activeStep.title : 'All Stages Completed'}</strong>
            </span>
            <span className="font-semibold text-fg">
              {completedSteps} of {totalSteps} Completed ({calculatedPercent}%)
            </span>
          </div>
          <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, calculatedPercent))}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-muted flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-accent" /> Quick Add Stage:
        </span>
        <button
          onClick={() => handleOpenAddStepModal('message')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-info text-xs font-semibold shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" /> + Process Message
        </button>
        <button
          onClick={() => handleOpenAddStepModal('document')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 text-xs font-semibold shrink-0"
        >
          <FileText className="w-3.5 h-3.5" /> + Document Stage
        </button>
        <button
          onClick={() => handleOpenAddStepModal('approval')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0"
        >
          <UserCheck className="w-3.5 h-3.5" /> + Client Approval Stage
        </button>
      </div>

      <div className="bg-[#0B111E] dark:bg-[#080D1A] border border-slate-800/90 rounded-2xl p-6 text-white shadow-xl relative">
        <div className="flex items-center justify-between pb-6 border-b border-border/80">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Project Process & Workflow</h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
              {completedSteps}/{totalSteps} stages completed
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-xs font-semibold text-slate-200"
              >
                <Filter className="w-3.5 h-3.5" />
                Filter
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              {showFilterMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowFilterMenu(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden">
                    {[
                      { key: 'all', label: 'All Stages' },
                      { key: 'in_progress', label: 'In Progress' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'pending', label: 'Pending' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.key)
                          setShowFilterMenu(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs ${
                          statusFilter === opt.key ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => handleOpenAddStepModal('message')}>
              Add Stage / Message
            </Button>
          </div>
        </div>

        <div className="mt-6">
          {steps.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-border rounded-xl space-y-3">
              <Clock className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <p className="font-semibold text-slate-300 text-sm">No process stages yet</p>
              <p className="text-muted max-w-sm mx-auto">
                Add the project stages. An admin will review and approve what the client can see.
              </p>
              <Button variant="primary" size="sm" icon={Plus} onClick={() => handleOpenAddStepModal('message')}>
                Create First Process Stage
              </Button>
            </div>
          ) : filteredSteps.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-border rounded-xl">
              No stages match the selected status filter.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 sm:space-y-7 before:absolute before:left-[17px] before:top-3 before:bottom-3 before:w-[2px] before:bg-slate-700/80">
              {filteredSteps.map((step, idx) => {
                const isCompleted = step.status === 'completed'
                const isInProgress = step.status === 'in_progress'
                const isPending = step.status === 'pending'
                const clientVis = getClientVisibility(step)
                const iconConfig = getProcessIconConfig(step.type, step.status)
                const IconComp = iconConfig.icon
                const formattedDate = formatTimelineDate(step.completedAt || step.updatedAt || step.createdAt)
                const metaParts = [step.author, step.meta, formattedDate].filter(Boolean)

                return (
                  <div
                    key={step.id || idx}
                    className={`relative flex items-start justify-between gap-4 p-3.5 rounded-xl border ${
                      isInProgress
                        ? 'bg-blue-950/20 border-blue-800/60'
                        : isCompleted
                        ? 'bg-slate-900/30 border-border/60'
                        : 'bg-slate-900/10 border-border/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div
                        onClick={() => handleToggleStatus(step)}
                        className={`relative -ml-[29px] z-10 w-[34px] h-[34px] rounded-full ${iconConfig.bg} text-white flex items-center justify-center shadow-md shrink-0 ring-4 ring-[#0B111E] cursor-pointer`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="pt-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-white leading-snug break-words">{step.title}</h4>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> Completed
                            </span>
                          )}
                          {isInProgress && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              <CircleDot className="w-3 h-3" /> In Progress
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Pending
                            </span>
                          )}
                          {clientVis === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Awaiting admin approval
                            </span>
                          )}
                          {clientVis === 'approved' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                              <Eye className="w-3 h-3" /> Visible to client
                            </span>
                          )}
                          {clientVis === 'hidden' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              <EyeOff className="w-3 h-3" /> Hidden from client
                            </span>
                          )}
                        </div>
                        {metaParts.length > 0 && (
                          <p className="text-xs text-slate-400 mt-1">{metaParts.join(' • ')}</p>
                        )}
                        {step.message && (
                          <div className="mt-2 text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-border/90">
                            {step.message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'completed')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                            isCompleted ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-400'
                          }`}
                        >
                          <Check className="w-3 h-3" /> Done
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'in_progress')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 ${
                            isInProgress ? 'bg-info text-white' : 'text-slate-400 hover:text-blue-400'
                          }`}
                        >
                          <PlayCircle className="w-3 h-3" /> Active
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'pending')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                            isPending ? 'bg-slate-700 text-white' : 'text-slate-400'
                          }`}
                        >
                          Pending
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditStepModal(step)}
                          className="text-slate-400 hover:text-accent p-1.5 rounded-lg hover:bg-slate-800"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmStep(step)}
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showStepModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">
                {editingStep ? 'Edit Process Stage' : 'Create Process Stage'}
              </h3>
              <button onClick={() => setShowStepModal(false)} className="text-slate-400 p-1 rounded-lg hover:bg-chrome">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveProcessStep} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">Process Stage Category</label>
                <select
                  value={stepType}
                  onChange={(e) => setStepType(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2 px-3"
                >
                  <option value="message">Process Message</option>
                  <option value="document">Document Stage</option>
                  <option value="approval">Approval Stage</option>
                  <option value="invoice">Invoice & Payment Stage</option>
                  <option value="ticket">Support & QA Stage</option>
                  <option value="project_created">Project Kickoff</option>
                </select>
              </div>
              <Input
                label="Process Title / Headline *"
                placeholder="Process title"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                required
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">Detailed Process Message for Client</label>
                <textarea
                  rows={3}
                  value={stepMessage}
                  onChange={(e) => setStepMessage(e.target.value)}
                  placeholder="Message for the client (visible only after admin approval)"
                  className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-3"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">Initial Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {['pending', 'in_progress', 'completed'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStepStatus(st)}
                      className={`py-2 rounded-xl text-xs font-semibold border text-center ${
                        stepStatus === st ? 'bg-chrome text-fg border-border' : 'bg-canvas text-muted border-border'
                      }`}
                    >
                      {st === 'in_progress' ? 'In Progress' : st === 'completed' ? 'Completed' : 'Pending'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Author / Actor" value={stepAuthor} onChange={(e) => setStepAuthor(e.target.value)} />
                <Input label="Meta Info" placeholder="Optional" value={stepMeta} onChange={(e) => setStepMeta(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-3 border-t border-border">
                <Button type="button" variant="secondary" onClick={() => setShowStepModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Send} disabled={submittingStep}>
                  {submittingStep ? 'Saving...' : editingStep ? 'Update Stage' : 'Add Process Stage'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {deleteConfirmStep && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4 border-border shadow-2xl bg-surface text-center">
            <h4 className="font-bold text-fg text-sm">Delete Process Stage?</h4>
            <p className="text-xs text-muted">
              Delete <strong className="text-fg">"{deleteConfirmStep.title}"</strong>?
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="w-1/2" onClick={() => setDeleteConfirmStep(null)}>
                Cancel
              </Button>
              <Button variant="danger" className="w-1/2" onClick={() => handleDeleteStep(deleteConfirmStep.id)}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
