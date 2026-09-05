import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import {
  getProjectById,
  updateProjectInDb,
  subscribeProjectProcessSteps,
  addProcessStep,
  updateProcessStep,
  toggleProcessStepStatus,
  deleteProcessStep,
  setProcessStepClientVisibility,
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
  Calendar,
  Clock,
  Briefcase,
  Building,
  User,
  Users,
  ChevronDown,
  X,
  Send,
  Sparkles,
  Save,
  Loader2,
  Kanban,
  PlayCircle,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  CircleDot,
  Radio,
  Eye,
  EyeOff,
} from 'lucide-react'

// Helper to format timestamps to 'DD MMM, YYYY • hh:mm A'
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
    const hoursStr = hours.toString().padStart(2, '0')

    return `${day} ${month}, ${year} • ${hoursStr}:${minutes} ${ampm}`
  } catch {
    return String(ts)
  }
}

// Icon and badge color resolver for process step
const getProcessIconConfig = (type, status) => {
  if (status === 'completed') {
    return {
      bg: 'bg-emerald-600',
      textColor: 'text-emerald-400',
      icon: Check,
    }
  }

  switch (type?.toLowerCase()) {
    case 'message':
      return {
        bg: status === 'in_progress' ? 'bg-info ring-4 ring-blue-500/30' : 'bg-blue-600/80',
        textColor: 'text-blue-400',
        icon: MessageSquare,
      }
    case 'invoice':
      return {
        bg: 'bg-emerald-600',
        textColor: 'text-emerald-400',
        icon: Check,
      }
    case 'document':
      return {
        bg: 'bg-purple-600',
        textColor: 'text-purple-400',
        icon: FileText,
      }
    case 'approval':
      return {
        bg: 'bg-amber-500',
        textColor: 'text-amber-400',
        icon: UserCheck,
      }
    case 'ticket':
    case 'support':
      return {
        bg: 'bg-blue-500',
        textColor: 'text-blue-400',
        icon: LifeBuoy,
      }
    case 'project_created':
    case 'milestone':
    default:
      return {
        bg: status === 'in_progress' ? 'bg-accent ring-4 ring-accent/30' : 'bg-emerald-600',
        textColor: 'text-emerald-400',
        icon: FolderKanban,
      }
  }
}

export const ProjectDetailPage = () => {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { user, userDoc } = useUserStore()
  const adminUid = userDoc?.uid || user?.uid || null
  const adminName = userDoc?.displayName || user?.displayName || userDoc?.name || 'Admin'

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [savingProject, setSavingProject] = useState(false)

  // Process steps state
  const [steps, setSteps] = useState([])
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'completed' | 'in_progress' | 'pending'
  const [visibilityFilter, setVisibilityFilter] = useState('all') // 'all' | 'pending' | 'approved' | 'hidden'
  const [showFilterMenu, setShowFilterMenu] = useState(false)

  // Project Edit Modal State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editClientName, setEditClientName] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editLeadName, setEditLeadName] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editEstimatedDate, setEditEstimatedDate] = useState('')

  // Add / Edit Process Step Modal State
  const [showStepModal, setShowStepModal] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [stepTitle, setStepTitle] = useState('')
  const [stepMessage, setStepMessage] = useState('')
  const [stepType, setStepType] = useState('message')
  const [stepStatus, setStepStatus] = useState('pending')
  const [stepAuthor, setStepAuthor] = useState('From Admin')
  const [stepMeta, setStepMeta] = useState('')
  const [submittingStep, setSubmittingStep] = useState(false)

  const [deleteConfirmStep, setDeleteConfirmStep] = useState(null)

  // Clients & Team Members dropdown
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])

  // Load project details
  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return
      setLoading(true)
      const data = await getProjectById(projectId)
      setProject(data)
      if (data) {
        setEditName(data.name || '')
        setEditClientName(data.clientName || '')
        setEditClientId(data.clientId || '')
        setEditLeadName(data.ownerName || '')
        setEditBudget(data.budget !== undefined ? String(data.budget) : '')
        setEditDescription(data.description || '')
        setEditStatus(data.status || 'active')
        setEditEstimatedDate(data.startDate || data.estimatedDate || data.dueDate || '')
      }
      setLoading(false)
    }
    loadProject()
  }, [projectId])

  // Subscribe to Project Process Steps in Real-time
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = subscribeProjectProcessSteps(projectId, (list) => {
      setSteps(list)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [projectId])

  // Fetch clients & employees for select boxes
  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [usersSnap, empSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'client'))),
          getDocs(collection(db, 'employees')),
        ])

        const clientList = usersSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().companyName || d.data().displayName || d.data().name || 'Client',
        }))

        const empList = empSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().fullName || 'Employee',
          role: d.data().role || '',
        }))

        setClients(clientList)
        setEmployees(empList)
      } catch (err) {
        console.error('Error loading dropdown lists:', err)
      }
    }
    fetchDropdowns()
  }, [])

  const handleStepTypeChange = (newType) => {
    setStepType(newType)
  }

  // Open Add Process Step Modal
  const handleOpenAddStepModal = (initialType = 'message') => {
    setEditingStep(null)
    setStepType(initialType)
    setStepTitle('')
    setStepMessage('')
    setStepAuthor('From Admin')
    setStepMeta('')
    setStepStatus(steps.length === 0 ? 'in_progress' : 'pending')
    handleStepTypeChange(initialType)
    setShowStepModal(true)
  }

  // Open Edit Step Modal
  const handleOpenEditStepModal = (step) => {
    setEditingStep(step)
    setStepType(step.type || 'message')
    setStepTitle(step.title || '')
    setStepMessage(step.message || step.description || '')
    setStepAuthor(step.author || 'From Admin')
    setStepMeta(step.meta || '')
    setStepStatus(step.status || 'pending')
    setShowStepModal(true)
  }

  // Save Step (Create or Edit)
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
        author: stepAuthor.trim(),
        meta: stepMeta.trim(),
      }

      if (editingStep) {
        await updateProcessStep(projectId, editingStep.id, payload)
      } else {
        await addProcessStep(projectId, {
          ...payload,
          createdByRole: 'admin',
          createdByUid: adminUid,
          createdByName: adminName,
          clientVisibility: 'approved',
        })
      }

      setShowStepModal(false)
    } catch (err) {
      console.error('Failed to save process step:', err)
    } finally {
      setSubmittingStep(false)
    }
  }

  // One-Click Toggle Status (Pending -> In Progress -> Completed -> Pending)
  const handleToggleStatus = async (step) => {
    try {
      await toggleProcessStepStatus(projectId, step.id, step.status)
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  // Direct Mark Completed / In Progress / Pending Action
  const handleSetStepStatus = async (stepId, targetStatus) => {
    try {
      await updateProcessStep(projectId, stepId, { status: targetStatus })
    } catch (err) {
      console.error('Failed to update step status:', err)
    }
  }

  const handleSetClientVisibility = async (stepId, visibility) => {
    try {
      await setProcessStepClientVisibility(projectId, stepId, visibility, {
        uid: adminUid,
        name: adminName,
      })
    } catch (err) {
      console.error('Failed to update client visibility:', err)
    }
  }

  // Delete Step
  const handleDeleteStep = async (stepId) => {
    try {
      await deleteProcessStep(projectId, stepId)
      setDeleteConfirmStep(null)
    } catch (err) {
      console.error('Failed to delete step:', err)
    }
  }

  // Save Project Details Updates
  const handleUpdateProjectDetails = async (e) => {
    e.preventDefault()
    if (!editName.trim()) return

    setSavingProject(true)
    try {
      const selectedClient = clients.find((c) => c.id === editClientId)
      const finalClientName = editClientName || selectedClient?.name || project.clientName || 'Independent'

      const updates = {
        name: editName.trim(),
        clientId: editClientId || '',
        clientName: finalClientName,
        ownerName: editLeadName || project.ownerName || '',
        budget: editBudget ? Number(editBudget) : 0,
        description: editDescription,
        status: editStatus,
        estimatedDate: editEstimatedDate || null,
        startDate: editEstimatedDate || null,
      }

      await updateProjectInDb(projectId, updates)
      setProject((prev) => ({ ...prev, ...updates }))
      setShowEditProjectModal(false)
    } catch (err) {
      console.error('Failed to update project details:', err)
    } finally {
      setSavingProject(false)
    }
  }

  // Computed Progress
  const totalSteps = steps.length
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const inProgressSteps = steps.filter((s) => s.status === 'in_progress').length
  const calculatedPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
  const activeStep = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'pending')

  const pendingClientCount = steps.filter((s) => getClientVisibility(s) === 'pending').length

  const filteredSteps = steps.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false
    if (visibilityFilter !== 'all' && getClientVisibility(s) !== visibilityFilter) return false
    return true
  })

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
        <p className="text-xs text-muted">The requested project ID does not exist or was removed.</p>
        <Button variant="primary" icon={ArrowLeft} onClick={() => navigate('/projects/list')}>
          Back to Projects
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-7 max-w-6xl mx-auto pb-16">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              to="/projects/list"
              className="text-xs font-semibold text-muted hover:text-accent dark:hover:text-accent flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All Projects
            </Link>
            <span className="text-slate-400 text-xs">/</span>
            <span className="text-xs font-medium text-fg truncate max-w-[200px]">
              {project.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            {project.name}
            <Badge
              variant={
                getProjectDisplayStatus(project) === 'active'
                  ? 'success'
                  : getProjectDisplayStatus(project) === 'completed'
                  ? 'brand'
                  : 'warning'
              }
            >
              {getProjectDisplayStatus(project) === 'on_hold' ? 'on hold' : getProjectDisplayStatus(project)}
            </Badge>
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="secondary"
            icon={Kanban}
            onClick={() => navigate(`/projects/tasks?projectId=${projectId}`)}
          >
            Task Board
          </Button>
          <Button
            variant="secondary"
            icon={Pencil}
            onClick={() => setShowEditProjectModal(true)}
          >
            Edit Project
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => handleOpenAddStepModal('message')}
          >
            Add Process Stage / Message
          </Button>
        </div>
      </div>

      {/* Project Overview Card with Live Process Tracker Summary */}
      <Card className="p-6 bg-surface border-border rounded-2xl shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Project Description
            </span>
            <p className="text-xs text-fg line-clamp-3">
              {project.description || 'No description provided for this project.'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Client & Lead
            </span>
            <div className="text-xs text-fg space-y-0.5">
              <p className="flex items-center gap-1 font-semibold">
                <Building className="w-3 h-3 text-accent" /> {project.clientName || 'Independent'}
              </p>
              <p className="flex items-center gap-1 text-muted">
                <User className="w-3 h-3 text-slate-400" /> Lead: {project.ownerName || 'Unassigned'}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Budget & Start Date
            </span>
            <div className="text-xs text-fg space-y-0.5">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                {project.budget ? `₹${Number(project.budget).toLocaleString()}` : 'Not Specified'}
              </p>
              <p className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Calendar className="w-3 h-3" /> Start: {getProjectStartDate(project) || '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Process Progress Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-border space-y-2">
          <div className="flex justify-between text-xs font-medium text-muted">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
              Current Process Stage:{' '}
              <strong className="text-fg">
                {activeStep ? activeStep.title : 'All Stages Completed'}
              </strong>
            </span>
            <span className="font-semibold text-fg">
              {completedSteps} of {totalSteps} Completed ({calculatedPercent}%)
            </span>
          </div>
          <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
            <div
              className="bg-accent dark:bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, calculatedPercent))}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Quick Add Stage Starters Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-muted flex items-center gap-1 shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-accent" /> Quick Add Stage:
        </span>
        <button
          onClick={() => handleOpenAddStepModal('message')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-500/15 text-info text-xs font-semibold hover:bg-blue-100 transition-colors shrink-0"
        >
          <MessageSquare className="w-3.5 h-3.5" /> + Process Message
        </button>
        <button
          onClick={() => handleOpenAddStepModal('document')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 text-xs font-semibold hover:bg-purple-100 transition-colors shrink-0"
        >
          <FileText className="w-3.5 h-3.5" /> + Document / SRS Stage
        </button>
        <button
          onClick={() => handleOpenAddStepModal('approval')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold hover:bg-amber-100 transition-colors shrink-0"
        >
          <UserCheck className="w-3.5 h-3.5" /> + Client Approval Stage
        </button>
        <button
          onClick={() => handleOpenAddStepModal('invoice')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-100 transition-colors shrink-0"
        >
          <Check className="w-3.5 h-3.5" /> + Milestone Payment
        </button>
        <button
          onClick={() => handleOpenAddStepModal('ticket')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 text-xs font-semibold hover:bg-cyan-100 transition-colors shrink-0"
        >
          <LifeBuoy className="w-3.5 h-3.5" /> + QA & Bug Fix Stage
        </button>
      </div>

      {/* Main Project Process Stepper Card (Matches the visual design in the user screenshot) */}
      <div className="bg-[#0B111E] dark:bg-[#080D1A] border border-slate-800/90 rounded-2xl p-6 text-white shadow-xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-border/80">
          <div className="flex items-center gap-3">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Project Process & Workflow
            </h3>
            <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded-full font-medium">
              {completedSteps}/{totalSteps} stages completed
            </span>
            {pendingClientCount > 0 && (
              <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                {pendingClientCount} awaiting client approval
              </span>
            )}
          </div>

          {/* Right Filter & Add Stage Buttons */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
              >
                <Filter className="w-3.5 h-3.5 text-slate-300" />
                <span>Filter</span>
                <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
              </button>

              {showFilterMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowFilterMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-2xl z-30 py-1.5 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-border flex items-center justify-between">
                      <span>Filter By Status</span>
                      {(statusFilter !== 'all' || visibilityFilter !== 'all') && (
                        <button
                          onClick={() => {
                            setStatusFilter('all')
                            setVisibilityFilter('all')
                            setShowFilterMenu(false)
                          }}
                          className="text-blue-400 hover:underline text-[10px]"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    {[
                      { key: 'all', label: 'All Stages' },
                      { key: 'in_progress', label: 'In Progress (Current)' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'pending', label: 'Pending (Upcoming)' },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setStatusFilter(opt.key)
                          setShowFilterMenu(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                          statusFilter === opt.key
                            ? 'bg-blue-600/20 text-blue-400 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {statusFilter === opt.key && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </button>
                    ))}
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-y border-border mt-1">
                      Client View
                    </div>
                    {[
                      { key: 'all', label: 'All visibility' },
                      { key: 'pending', label: 'Awaiting approval' },
                      { key: 'approved', label: 'Visible to client' },
                      { key: 'hidden', label: 'Hidden from client' },
                    ].map((opt) => (
                      <button
                        key={`vis-${opt.key}`}
                        type="button"
                        onClick={() => {
                          setVisibilityFilter(opt.key)
                          setShowFilterMenu(false)
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                          visibilityFilter === opt.key
                            ? 'bg-blue-600/20 text-blue-400 font-semibold'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {visibilityFilter === opt.key && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => handleOpenAddStepModal('message')}
            >
              Add Stage / Message
            </Button>
          </div>
        </div>

        {/* Process Steps Feed */}
        <div className="mt-6">
          {steps.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs border border-dashed border-border rounded-xl space-y-3">
              <Clock className="w-8 h-8 mx-auto text-slate-600 opacity-60" />
              <div>
                <p className="font-semibold text-slate-300 text-sm">No process stages created yet</p>
                <p className="text-muted mt-1 max-w-sm mx-auto">
                  Create the steps of your project process so the client can follow along.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => handleOpenAddStepModal('message')}
              >
                Create First Process Stage
              </Button>
            </div>
          ) : filteredSteps.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-border rounded-xl">
              <span>No stages match the selected status filter.</span>
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

                const metaParts = []
                if (step.author) metaParts.push(step.author)
                if (step.meta) metaParts.push(step.meta)
                if (formattedDate) metaParts.push(formattedDate)

                const subtitle = metaParts.join(' • ')

                return (
                  <div
                    key={step.id || idx}
                    className={`relative flex items-start justify-between gap-4 p-3.5 rounded-xl border transition-all ${
                      isInProgress
                        ? 'bg-blue-950/20 border-blue-800/60 ring-1 ring-blue-500/20'
                        : isCompleted
                        ? 'bg-slate-900/30 border-border/60'
                        : 'bg-slate-900/10 border-border/40 opacity-75'
                    }`}
                  >
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      {/* Circle Icon Badge */}
                      <div
                        onClick={() => handleToggleStatus(step)}
                        title="Click to toggle status (Pending -> In Progress -> Completed)"
                        className={`relative -ml-[29px] z-10 w-[34px] h-[34px] rounded-full ${iconConfig.bg} text-white flex items-center justify-center shadow-md shrink-0 ring-4 ring-[#0B111E] dark:ring-[#080D1A] transition-transform duration-200 hover:scale-110 cursor-pointer`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>

                      {/* Step Content */}
                      <div className="pt-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-fg dark:text-white leading-snug break-words">
                            {step.title}
                          </h4>

                          {/* Status Badge */}
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> Completed
                            </span>
                          )}
                          {isInProgress && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse">
                              <CircleDot className="w-3 h-3" /> In Progress (Current)
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                              Pending
                            </span>
                          )}
                          {clientVis === 'pending' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              Awaiting approval
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

                        {subtitle && (
                          <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 font-normal tracking-wide">
                            {subtitle}
                          </p>
                        )}

                        {step.message && (
                          <div className="mt-2 text-xs text-slate-200 bg-slate-900/80 p-2.5 rounded-lg border border-border/90 font-medium">
                            {step.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Admin Status Toggles & Actions */}
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 pt-0.5">
                      {/* One-Click Status Buttons */}
                      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'completed')}
                          title="Mark this process message as Completed"
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/40'
                          }`}
                        >
                          <Check className="w-3 h-3" /> Done
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'in_progress')}
                          title="Mark this process message as In Progress"
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                            isInProgress
                              ? 'bg-info text-white shadow-sm'
                              : 'text-slate-400 hover:text-blue-400 hover:bg-blue-950/40'
                          }`}
                        >
                          <PlayCircle className="w-3 h-3" /> Active
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetStepStatus(step.id, 'pending')}
                          title="Mark this process message as Pending"
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            isPending
                              ? 'bg-slate-700 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          Pending
                        </button>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-border">
                        {clientVis !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleSetClientVisibility(step.id, 'approved')}
                            title="Approve this stage for client view"
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-400 hover:bg-emerald-950/40 transition-all flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> Approve
                          </button>
                        )}
                        {clientVis !== 'hidden' && (
                          <button
                            type="button"
                            onClick={() => handleSetClientVisibility(step.id, 'hidden')}
                            title="Hide this stage from the client"
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-1"
                          >
                            <EyeOff className="w-3 h-3" /> Hide
                          </button>
                        )}
                      </div>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditStepModal(step)}
                          title="Edit stage message"
                          className="text-slate-400 hover:text-accent p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmStep(step)}
                          title="Delete stage"
                          className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
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

      {/* Modal: Add / Edit Process Stage / Message */}
      {showStepModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">
                {editingStep ? 'Edit Process Stage / Message' : 'Create Process Stage / Message'}
              </h3>
              <button
                onClick={() => setShowStepModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProcessStep} className="space-y-4 text-left">
              {/* Category selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">
                  Process Stage Category
                </label>
                <select
                  value={stepType}
                  onChange={(e) => handleStepTypeChange(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2 px-3 focus:outline-none focus:border-border cursor-pointer"
                >
                  <option value="message">Process Message</option>
                  <option value="document">Document Stage</option>
                  <option value="approval">Approval Stage</option>
                  <option value="invoice">Invoice & Payment Stage</option>
                  <option value="ticket">Support & QA Stage</option>
                  <option value="project_created">Project Kickoff / Creation</option>
                </select>
              </div>

              {/* Step Title */}
              <Input
                label="Process Title / Headline *"
                placeholder="Process title"
                value={stepTitle}
                onChange={(e) => setStepTitle(e.target.value)}
                required
              />

              {/* Process Message / Details */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">
                  Detailed Process Message for Client
                </label>
                <textarea
                  rows={3}
                  value={stepMessage}
                  onChange={(e) => setStepMessage(e.target.value)}
                  placeholder="Message for the client"
                  className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-3 focus:outline-none focus:border-border"
                />
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">
                  Initial Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setStepStatus('pending')}
                    className={`py-2 rounded-xl text-xs font-semibold border text-center transition-colors ${
                      stepStatus === 'pending'
                        ? 'bg-chrome text-fg border-border'
                        : 'bg-canvas text-muted border-border'
                    }`}
                  >
                    Pending (Upcoming)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepStatus('in_progress')}
                    className={`py-2 rounded-xl text-xs font-semibold border text-center transition-colors ${
                      stepStatus === 'in_progress'
                        ? 'bg-chrome text-fg border-border'
                        : 'bg-canvas text-muted border-border'
                    }`}
                  >
                    In Progress (Current)
                  </button>
                  <button
                    type="button"
                    onClick={() => setStepStatus('completed')}
                    className={`py-2 rounded-xl text-xs font-semibold border text-center transition-colors ${
                      stepStatus === 'completed'
                        ? 'bg-chrome text-fg border-border'
                        : 'bg-canvas text-muted border-border'
                    }`}
                  >
                    Completed
                  </button>
                </div>
              </div>

              {/* Author & Meta */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Author / Actor"
                  placeholder="Author"
                  value={stepAuthor}
                  onChange={(e) => setStepAuthor(e.target.value)}
                />
                <Input
                  label="Meta Info"
                  placeholder="Optional"
                  value={stepMeta}
                  onChange={(e) => setStepMeta(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowStepModal(false)}
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-2/3"
                  icon={Send}
                  disabled={submittingStep}
                >
                  {submittingStep
                    ? 'Saving...'
                    : editingStep
                    ? 'Update Stage'
                    : 'Add Process Stage'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Edit Project Details */}
      {showEditProjectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Pencil className="w-4 h-4 text-accent" /> Edit Project Details
              </h3>
              <button
                onClick={() => setShowEditProjectModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProjectDetails} className="space-y-4 text-left">
              <Input
                label="Project Title *"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                {/* Client Select */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-fg">
                    Client Name
                  </label>
                  <select
                    value={editClientId}
                    onChange={(e) => {
                      setEditClientId(e.target.value)
                      const cl = clients.find((c) => c.id === e.target.value)
                      if (cl) setEditClientName(cl.name)
                    }}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2 px-3 focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">Independent</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lead Select */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-fg">
                    Project Lead
                  </label>
                  <select
                    value={editLeadName}
                    onChange={(e) => setEditLeadName(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2 px-3 focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.name}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Budget (₹)"
                  type="number"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-fg">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2 px-3 focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <Input
                label="Start Date"
                type="date"
                value={editEstimatedDate}
                onChange={(e) => setEditEstimatedDate(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-fg">
                  Project Description
                </label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Detailed project summary..."
                  className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-3 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowEditProjectModal(false)}
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-2/3"
                  icon={Save}
                  disabled={savingProject}
                >
                  {savingProject ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Step Confirmation Modal */}
      {deleteConfirmStep && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4 border-border shadow-2xl bg-surface text-center">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-fg text-sm">
              Delete Process Stage?
            </h4>
            <p className="text-xs text-muted">
              Are you sure you want to delete <strong className="text-fg">"{deleteConfirmStep.title}"</strong>?
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                className="w-1/2"
                onClick={() => setDeleteConfirmStep(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="w-1/2"
                onClick={() => handleDeleteStep(deleteConfirmStep.id)}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
