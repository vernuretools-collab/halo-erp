import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useProjectStore } from './stores/projectStore'
import { useUserStore } from '../../shared/stores/userStore'
import { getProjects, createProject, deleteProjectFromDb, updateProjectInDb } from './services/projectService'
import {
  Plus,
  Search,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  User,
  Building,
  Kanban,
  FolderKanban,
  X,
  TrendingUp,
  Trash2,
  Pencil,
  ArrowRight,
  Loader2
} from 'lucide-react'

export const ProjectList = () => {
  const navigate = useNavigate()
  const { projects, setProjects, addProject, updateProject, deleteProject, setSelectedProjectId } = useProjectStore()
  const { user, userDoc } = useUserStore()


  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form fields for new project
  const [projName, setProjName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [budget, setBudget] = useState('')
  const [description, setDescription] = useState('')

  // Edit Project Modal state
  const [editModalProj, setEditModalProj] = useState(null)
  const [editProjName, setEditProjName] = useState('')
  const [editClientName, setEditClientName] = useState('')
  const [editSelectedClientId, setEditSelectedClientId] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Dropdown data from Firestore
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch all projects from Firestore
        const projectsData = await getProjects()
        setProjects(projectsData)

        // Check if user is a client
        if (user && user.email) {
          const userDocQuery = query(collection(db, 'users'), where('email', '==', user.email))
          const userDocSnap = await getDocs(userDocQuery)
          if (!userDocSnap.empty) {
            const userData = userDocSnap.docs[0].data()
            setIsClient(userData.role === 'client')
          }
        }

        // Fetch clients
        const clientsQuery = query(collection(db, 'users'), where('role', '==', 'client'))
        const clientsSnap = await getDocs(clientsQuery)
        setClients(clientsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

        // Fetch employees
        const empSnap = await getDocs(collection(db, 'employees'))
        setEmployees(empSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Error loading projects data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [setProjects, user])

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  // Summary Metrics
  const activeCount = projects.filter((p) => p.status === 'active').length
  const avgCompletion =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + p.completionPercent, 0) / projects.length
        )
      : 0
  const totalLoggedHours = projects.reduce(
    (sum, p) => sum + (p.totalHoursLogged || 0),
    0
  )

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!projName.trim()) return

    const selectedClient = clients.find((c) => c.id === selectedClientId)
    const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId || emp.uid === selectedEmployeeId)

    const members = []
    if (selectedEmployee) {
      members.push({
        uid: selectedEmployee.uid || selectedEmployee.authUid || selectedEmployee.id,
        id: selectedEmployee.uid || selectedEmployee.authUid || selectedEmployee.id,
        email: selectedEmployee.email || '',
        name: selectedEmployee.name || selectedEmployee.fullName || selectedEmployee.displayName || '',
        role: selectedEmployee.role || 'employee',
      })
    }

    const currentUserId = userDoc?.uid || user?.uid || null
    const currentUserEmail = userDoc?.email || user?.email || null
    const currentUserName = userDoc?.displayName || user?.displayName || userDoc?.name || 'Admin'

    const payload = {
      name: projName,
      clientId: selectedClientId || '',
      clientName: selectedClient?.name || '',
      employeeId: selectedEmployee ? (selectedEmployee.uid || selectedEmployee.authUid || selectedEmployee.id) : (selectedEmployeeId || ''),
      ownerName: selectedEmployee?.name || selectedEmployee?.fullName || selectedEmployee?.displayName || '',
      ownerRole: selectedEmployee?.role || '',
      budget: Number(budget) || 0,
      description,
      status: 'active',
      completionPercent: 0,
      totalTaskCount: 0,
      completedTaskCount: 0,
      totalHoursLogged: 0,
      createdBy: currentUserId,
      createdByEmail: currentUserEmail,
      createdByName: currentUserName,
      createdByRole: userDoc?.role || 'admin',
      members,
    }

    const created = await createProject(payload)
    addProject(created)

    setProjName('')
    setSelectedClientId('')
    setSelectedEmployeeId('')
    setBudget('')
    setDescription('')
    setShowAddModal(false)
  }

  const handleProjectClick = (proj) => {
    const pId = proj.projectId || proj.id
    setSelectedProjectId(pId)
    navigate(`/projects/tasks?projectId=${pId}`)
  }

  const handleOpenEditModal = (proj) => {
    setEditModalProj(proj)
    setEditProjName(proj.name || '')
    setEditClientName(proj.clientName || '')
    setEditSelectedClientId(proj.clientId || '')
    setEditBudget(proj.budget !== undefined && proj.budget !== null ? String(proj.budget) : '')
    setEditDescription(proj.description || '')
    setEditStatus(proj.status || 'active')
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    if (!editModalProj || !editProjName.trim()) return

    const pId = editModalProj.projectId || editModalProj.id
    setEditSubmitting(true)
    try {
      const selectedClient = clients.find((c) => c.id === editSelectedClientId)
      const finalClientName = editClientName || selectedClient?.name || editModalProj.clientName || ''

      const updates = {
        name: editProjName.trim(),
        clientName: finalClientName,
        clientId: editSelectedClientId || '',
        budget: editBudget ? Number(editBudget) : 0,
        description: editDescription,
        status: editStatus || 'active',
      }

      updateProject(pId, updates)
      await updateProjectInDb(pId, updates)

      setEditModalProj(null)
    } catch (err) {
      console.error('Failed to update project:', err)
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation()
    const targetId = id || ''
    if (!targetId) return
    await deleteProjectFromDb(targetId)
    deleteProject(targetId)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Project Management"
          description="Manage active client deliverables, sprint velocity, task boards, and time tracking"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              New Project
            </Button>
          }
        />

        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/projects/list"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <FolderKanban className="w-3.5 h-3.5" /> All Projects
            </NavLink>
            <NavLink
              to="/projects/tasks"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Kanban className="w-3.5 h-3.5" /> Task Board
            </NavLink>
            <NavLink
              to="/projects/time"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Clock className="w-3.5 h-3.5" /> Time Tracking
            </NavLink>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-canvas border border-border text-xs text-fg rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-canvas border border-border text-xs text-fg placeholder:text-muted rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Active Projects
            </span>
            <p className="text-xl font-bold text-fg mt-1">{activeCount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Briefcase className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Avg Completion Rate
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{avgCompletion}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Logged Hours
            </span>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{totalLoggedHours} hrs</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((proj) => (
          <Card
            key={proj.projectId || proj.id}
            hover
            className="space-y-4 border-border cursor-pointer group"
            onClick={() => handleProjectClick(proj)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-fg text-sm group-hover:text-accent dark:group-hover:text-accent transition-colors flex items-center gap-1.5">
                  {proj.name}
                </h3>
                <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                  <Building className="w-3 h-3 text-muted" /> {proj.clientName}
                </p>
              </div>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Badge
                  variant={
                    proj.status === 'active'
                      ? 'success'
                      : proj.status === 'completed'
                      ? 'brand'
                      : 'warning'
                  }
                >
                  {proj.status}
                </Badge>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenEditModal(proj)
                  }}
                  title="Edit project name & details"
                  className="text-muted hover:text-accent dark:hover:text-accent p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => handleDeleteProject(proj.projectId || proj.id, e)}
                  title="Delete project"
                  className="text-muted hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-muted line-clamp-2">{proj.description}</p>

            {/* Progress Bar - Emerald Green Progress Fill */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-muted">
                <span>Completion Velocity</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{proj.completionPercent}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-300/40 dark:border-slate-700/50">
                <div
                  className="bg-emerald-500 dark:bg-emerald-400 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${proj.completionPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted pt-3 border-t border-border/60">
              <span className="flex items-center gap-1 text-fg font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> {proj.completedTaskCount} / {proj.totalTaskCount} tasks
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleProjectClick(proj)
                }}
                className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View Tasks <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Create Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Initialize New Project</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <Input
                label="Project Title"
                placeholder="e.g. SaaS Refactor & API Redesign"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                {/* Client dropdown from Firestore leads */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3 h-3" /> Client
                  </label>
                  {dropdownLoading ? (
                    <div className="flex items-center gap-2 py-2.5 px-3.5 text-xs text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading clients...
                    </div>
                  ) : clients.length === 0 ? (
                    <p className="text-xs text-muted py-2.5 px-3.5 border border-border rounded-xl">
                      No clients in Firestore yet
                    </p>
                  ) : (
                    <select
                      value={selectedClientId}
                      onChange={(e) => setSelectedClientId(e.target.value)}
                      className="w-full bg-canvas border border-border text-fg text-xs rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <Input
                  label="Project Budget ($ USD)"
                  type="number"
                  placeholder="45000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-300">Description</label>
                <textarea
                  placeholder="Outline project deliverables and scope..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-3 h-20 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Employee dropdown from Firestore employees */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <User className="w-3 h-3" /> Employee
                </label>
                {dropdownLoading ? (
                  <div className="flex items-center gap-2 py-2.5 px-3.5 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading employees...
                  </div>
                ) : employees.length === 0 ? (
                  <p className="text-xs text-muted py-2.5 px-3.5 border border-border rounded-xl">
                    No employees in Firestore yet
                  </p>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}{emp.role ? ` (${emp.role})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Create Project
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalProj && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-fg text-sm">Edit Project</h3>
              </div>
              <button
                onClick={() => setEditModalProj(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <Input
                label="Project Title *"
                placeholder="e.g. SaaS Refactor & API Redesign"
                value={editProjName}
                onChange={(e) => setEditProjName(e.target.value)}
                required
                autoFocus
              />

              <div className="grid grid-cols-2 gap-3">
                {/* Client dropdown */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg flex items-center gap-1.5">
                    <Building className="w-3 h-3 text-accent" /> Client
                  </label>
                  <select
                    value={editSelectedClientId}
                    onChange={(e) => {
                      setEditSelectedClientId(e.target.value)
                      const found = clients.find((c) => c.id === e.target.value)
                      if (found) setEditClientName(found.name)
                    }}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                  >
                    <option value="">{editClientName || 'Select Client'}</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Dropdown */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg">
                    Project Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <Input
                label="Project Budget ($ USD)"
                type="number"
                placeholder="45000"
                value={editBudget}
                onChange={(e) => setEditBudget(e.target.value)}
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Description</label>
                <textarea
                  placeholder="Outline project deliverables and scope..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg placeholder:text-muted text-xs rounded-xl p-3 h-20 focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditModalProj(null)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" disabled={editSubmitting}>
                  {editSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
