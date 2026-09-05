import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useProjectStore } from './stores/projectStore'
import { getProjects, createProject, deleteProjectFromDb, updateProjectMembersInDb, updateProjectInDb, getProjectDisplayStatus, getProjectStartDate } from './services/projectService'
import {
  Plus,
  Search,
  Briefcase,
  CheckCircle2,
  Clock,
  User,
  Users,
  UserPlus,
  Building,
  Kanban,
  FolderKanban,
  X,
  TrendingUp,
  Trash2,
  Pencil,
  Loader2,
  ShieldCheck,
  Calendar,
} from 'lucide-react'

export const ProjectList = () => {
  const navigate = useNavigate()
  const {
    projects,
    setProjects,
    addProject,
    updateProject,
    deleteProject,
    updateProjectMembers,
    setSelectedProjectId,
  } = useProjectStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // Form fields for new project
  const [projName, setProjName] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedDate, setEstimatedDate] = useState('')

  // Dropdown data from Firestore
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [dropdownLoading, setDropdownLoading] = useState(false)
  const [deleteConfirmProj, setDeleteConfirmProj] = useState(null)

  // Edit Project Modal state
  const [editModalProj, setEditModalProj] = useState(null)
  const [editProjName, setEditProjName] = useState('')
  const [editClientName, setEditClientName] = useState('')
  const [editSelectedClientId, setEditSelectedClientId] = useState('')
  const [editBudget, setEditBudget] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editEstimatedDate, setEditEstimatedDate] = useState('')
  const [editStatus, setEditStatus] = useState('active')
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Manage Project Members Modal state
  const [memberModalProj, setMemberModalProj] = useState(null)
  const [allEmployees, setAllEmployees] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())

  useEffect(() => {
    const fetchRealProjects = async () => {
      setLoading(true)
      const data = await getProjects()
      setProjects(data || [])
      setLoading(false)
    }
    fetchRealProjects()
  }, [setProjects])

  // Fetch clients & employees when modal opens
  useEffect(() => {
    if (!showAddModal && !editModalProj) return
    const fetchDropdowns = async () => {
      setDropdownLoading(true)
      try {
        const [usersSnap, empSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('role', '==', 'client'))),
          getDocs(collection(db, 'employees')),
        ])

        const clientCompaniesMap = new Map()

        usersSnap.docs.forEach((d) => {
          const data = d.data()
          if (data.companyName) {
            clientCompaniesMap.set(data.companyName.trim().toLowerCase(), {
              id: d.id,
              name: data.companyName,
            })
          }
        })

        const clientList = Array.from(clientCompaniesMap.values())

        const empList = empSnap.docs.map((d) => ({
          id: d.id,
          name: d.data().name || d.data().fullName || d.data().displayName || 'Unknown',
          role: d.data().role || d.data().roleName || d.data().jobTitle || d.data().department || '',
        }))

        setClients(clientList)
        setEmployees(empList)
        if (clientList.length > 0 && showAddModal && !selectedClientId) {
          setSelectedClientId(clientList[0].id)
        }
        if (empList.length > 0 && showAddModal && !selectedEmployeeId) {
          setSelectedEmployeeId(empList[0].id)
        }
      } catch (err) {
        console.error('Error fetching dropdown data:', err)
      } finally {
        setDropdownLoading(false)
      }
    }
    fetchDropdowns()
  }, [showAddModal, editModalProj])

  // Fetch available employees when Member Modal opens
  useEffect(() => {
    if (!memberModalProj) return
    const fetchTeamEmployees = async () => {
      setMembersLoading(true)
      try {
        const empSnap = await getDocs(collection(db, 'employees'))

        const empList = empSnap.docs.map((d) => {
          const data = d.data()
          const id = d.id
          const name = data.name || data.fullName || data.displayName || 'Employee'
          const email = data.email || ''
          const role = data.role || 'employee'
          return { id, uid: id, name, email, role }
        })

        setAllEmployees(empList)


        // Initialize selected members set based on current project members
        const currentMembers = memberModalProj.members || []
        const initialSelected = new Set()

        currentMembers.forEach((m) => {
          const mId = typeof m === 'object' ? (m.uid || m.id) : m
          if (mId) initialSelected.add(String(mId))
        })

        if (memberModalProj.employeeId) {
          initialSelected.add(String(memberModalProj.employeeId))
        }

        setSelectedMemberIds(initialSelected)
      } catch (err) {
        console.error('Error fetching employees for member assignment:', err)
      } finally {
        setMembersLoading(false)
      }
    }
    fetchTeamEmployees()
  }, [memberModalProj])

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || getProjectDisplayStatus(p) === statusFilter
    return matchesSearch && matchesStatus
  })

  // Summary Metrics
  const activeCount = projects.filter((p) => getProjectDisplayStatus(p) === 'active').length
  const avgCompletion =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (p.completionPercent || 0), 0) / projects.length
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
    const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId)

    const initialMembers = selectedEmployee
      ? [{ id: selectedEmployee.id, uid: selectedEmployee.id, name: selectedEmployee.name, role: selectedEmployee.role }]
      : []

    const payload = {
      name: projName,
      clientId: selectedClientId || '',
      clientName: selectedClient?.name || '',
      employeeId: selectedEmployeeId || '',
      ownerName: selectedEmployee?.name || '',
      ownerRole: selectedEmployee?.role || '',
      budget: 0,
      description,
      estimatedDate: estimatedDate || null,
      startDate: estimatedDate || null,
      status: 'active',
      completionPercent: 0,
      totalTaskCount: 0,
      completedTaskCount: 0,
      totalHoursLogged: 0,
      members: initialMembers,
    }

    const created = await createProject(payload)
    addProject(created)

    setProjName('')
    setSelectedClientId('')
    setSelectedEmployeeId('')
    setDescription('')
    setEstimatedDate('')
    setShowAddModal(false)
  }

  const handleProjectClick = (proj) => {
    const pId = proj.projectId || proj.id
    setSelectedProjectId(pId)
    navigate(`/projects/${pId}`)
  }

  const handleOpenEditModal = (proj) => {
    setEditModalProj(proj)
    setEditProjName(proj.name || '')
    setEditClientName(proj.clientName || '')
    setEditSelectedClientId(proj.clientId || '')
    setEditBudget(proj.budget !== undefined && proj.budget !== null ? String(proj.budget) : '')
    setEditDescription(proj.description || '')
    setEditEstimatedDate(proj.startDate || proj.estimatedDate || '')
    setEditStatus(proj.status || 'active')
  }

  const handleUpdateProject = async (e) => {
    e.preventDefault()
    if (!editModalProj || !editProjName.trim()) return

    const pId = editModalProj.projectId || editModalProj.id
    setEditSubmitting(true)
    try {
      const selectedClient = clients.find((c) => c.id === editSelectedClientId)
      const finalClientName = editClientName || selectedClient?.name || editModalProj.clientName || 'Independent'

      const updates = {
        name: editProjName.trim(),
        clientName: finalClientName,
        clientId: editSelectedClientId || '',
        budget: editBudget ? Number(editBudget) : 0,
        description: editDescription,
        estimatedDate: editEstimatedDate || null,
        startDate: editEstimatedDate || null,
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

  const handleToggleMemberSelection = (empId) => {
    const next = new Set(selectedMemberIds)
    if (next.has(empId)) {
      next.delete(empId)
    } else {
      next.add(empId)
    }
    setSelectedMemberIds(next)
  }

  const handleSaveMembers = async (e) => {
    e.preventDefault()
    if (!memberModalProj) return

    const pId = memberModalProj.projectId || memberModalProj.id
    const updatedMembersList = allEmployees
      .filter((emp) => selectedMemberIds.has(String(emp.id)) || selectedMemberIds.has(String(emp.uid)))
      .map((emp) => ({
        uid: emp.uid || emp.id,
        id: emp.id || emp.uid,
        name: emp.name,
        email: emp.email,
        role: emp.role,
      }))

    updateProjectMembers(pId, updatedMembersList)
    await updateProjectMembersInDb(pId, updatedMembersList)
    setMemberModalProj(null)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Project Management"
          description="Manage active client deliverables, sprint velocity, task boards, and team access"
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
              <FolderKanban className="w-3.5 h-3.5" /> All Projects ({projects.length})
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
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading projects...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-surface/50">
          <FolderKanban className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-3" />
          <h4 className="text-sm font-semibold text-fg">No Projects Found</h4>
          <p className="text-xs text-muted max-w-sm mt-1 mb-4">
            No projects have been added yet or match your search filter. Click "New Project" to create your first project.
          </p>
          <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
            Create New Project
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((proj) => {
            const pId = proj.projectId || proj.id
            const membersList = proj.members || []
            const displayStatus = getProjectDisplayStatus(proj)
            const startDate = getProjectStartDate(proj)

            return (
              <Card
                key={pId}
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
                        displayStatus === 'active'
                          ? 'success'
                          : displayStatus === 'completed'
                          ? 'brand'
                          : 'warning'
                      }
                    >
                      {displayStatus === 'on_hold' ? 'on hold' : displayStatus}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteConfirmProj(proj)
                      }}
                      title="Delete project"
                      className="text-muted hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-muted line-clamp-2">{proj.description}</p>

                {/* Progress Bar */}
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

                {/* Assigned Employees / Members on Project Card */}
                <div
                  className="pt-2 border-t border-border/60 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      <Users className="w-3 h-3 text-accent" /> Team:
                    </span>
                    {membersList.length === 0 ? (
                      <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                    ) : (
                      membersList.slice(0, 3).map((m, idx) => {
                        const name = typeof m === 'object' ? m.name || m.email : m
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-[10px] bg-canvas text-fg px-2 py-0.5 rounded-md font-medium border border-slate-200 dark:border-slate-700"
                          >
                            <User className="w-2.5 h-2.5 text-accent" />
                            {name}
                          </span>
                        )
                      })
                    )}
                    {membersList.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-semibold">
                        +{membersList.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Add Employee Button on Project Card */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMemberModalProj(proj)
                    }}
                    title="Add or manage employees in this project"
                    className="flex items-center gap-1 px-2 py-1 bg-accent-soft hover:bg-accent-soft text-accent border border-accent/30 text-[10px] font-bold rounded-lg transition-colors"
                  >
                    <UserPlus className="w-3 h-3" /> Add Employee
                  </button>
                </div>

                {/* Card Footer Info & Quick Actions */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-fg">Client: </span>
                      <span className="truncate max-w-[100px] font-semibold text-fg">
                        {proj.clientName || 'Independent'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <Calendar className="w-3 h-3" /> Start: {startDate || '—'}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-fg">Lead: </span>
                        <span className="truncate max-w-[100px]">{proj.ownerName || 'Unassigned'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/projects/${pId}`)
                      }}
                      className="flex-1 text-center py-1.5 px-2 bg-accent-soft hover:bg-accent-soft text-accent text-[11px] font-bold rounded-lg transition-colors border border-accent/30 flex items-center justify-center gap-1"
                    >
                      <Clock className="w-3 h-3" /> Timeline & Manage
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedProjectId(pId)
                        navigate(`/projects/tasks?projectId=${pId}`)
                      }}
                      className="py-1.5 px-3 bg-canvas hover:bg-surface text-fg text-[11px] font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1"
                    >
                      <Kanban className="w-3 h-3" /> Tasks
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Member Management Modal ("Add Employee in Project Card") */}
      {memberModalProj && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-accent" /> Manage Project Employees
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Project: <strong className="text-accent">{memberModalProj.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setMemberModalProj(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted">
              Select team members to assign them to this project card:
            </p>

            <form onSubmit={handleSaveMembers} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {membersLoading ? (
                <div className="flex items-center justify-center py-8 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading team directory...
                </div>
              ) : allEmployees.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No registered employees found.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allEmployees.map((emp) => {
                    const empIdStr = String(emp.id || emp.uid)
                    const isChecked = selectedMemberIds.has(empIdStr)

                    return (
                      <div
                        key={empIdStr}
                        onClick={() => handleToggleMemberSelection(empIdStr)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-accent-soft border-accent/40'
                            : 'bg-canvas/40 border-border hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleMemberSelection(empIdStr)}
                            className="rounded border-slate-300 text-accent focus:ring-accent cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-semibold text-fg block">
                              {emp.name}
                            </span>
                            <span className="text-[10px] text-muted">
                              {emp.email || emp.role || 'Employee'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setMemberModalProj(null)}
                  className="w-1/3"
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={ShieldCheck}>
                  Save Project Members
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Create New Project</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <Input
                label="Project Title *"
                placeholder="e.g. ERP Mobile App Redesign"
                value={projName}
                onChange={(e) => setProjName(e.target.value)}
                required
              />

              <Input
                label="Project Description"
                placeholder="Brief summary of deliverables & tech stack..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              {/* Real Client Dropdown */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Client Name</label>
                {dropdownLoading ? (
                  <div className="text-xs text-slate-400">Loading clients...</div>
                ) : (
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    <option value="">Independent / Internal</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id} className="bg-surface text-fg">
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Assign Lead Dropdown */}
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Project Lead</label>
                {dropdownLoading ? (
                  <div className="text-xs text-slate-400">Loading team members...</div>
                ) : (
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-surface text-fg">
                        {emp.name}{emp.role && emp.role.toLowerCase() !== 'employee' ? ` (${emp.role})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <Input
                label="Start Date"
                type="date"
                value={estimatedDate}
                onChange={(e) => setEstimatedDate(e.target.value)}
                required
              />

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
                {/* Client Dropdown */}
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg">Client Name</label>
                  <select
                    value={editSelectedClientId}
                    onChange={(e) => {
                      setEditSelectedClientId(e.target.value)
                      const found = clients.find((c) => c.id === e.target.value)
                      if (found) setEditClientName(found.name)
                    }}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    <option value="">{editClientName || 'Independent / Internal'}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id} className="bg-surface text-fg">
                        {client.name}
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
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Total Budget (₹)"
                  type="number"
                  placeholder="e.g. 500000"
                  value={editBudget}
                  onChange={(e) => setEditBudget(e.target.value)}
                />

                <Input
                  label="Start Date"
                  type="date"
                  value={editEstimatedDate}
                  onChange={(e) => setEditEstimatedDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Project Description</label>
                <textarea
                  placeholder="Brief summary of deliverables & tech stack..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg placeholder:text-muted text-xs rounded-xl p-3 h-20 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
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

      {/* Confirm Delete Project Modal */}
      {deleteConfirmProj && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Project
              </h3>
              <button
                onClick={() => setDeleteConfirmProj(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete project <strong className="text-slate-900 dark:text-white">{deleteConfirmProj.name}</strong>? All associated sprint data and tasks will be affected. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmProj(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const targetId = deleteConfirmProj.projectId || deleteConfirmProj.id
                  if (targetId) {
                    await deleteProjectFromDb(targetId)
                    deleteProject(targetId)
                  }
                  setDeleteConfirmProj(null)
                }}
              >
                Yes, Delete Project
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
