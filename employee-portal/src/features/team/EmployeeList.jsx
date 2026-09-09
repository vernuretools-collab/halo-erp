import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { useUserStore } from '../../stores/userStore'
import {
  getEmployees,
  getDepartments,
  createEmployee,
  deleteEmployeeFromDb,
} from './services/teamService'
import { EmployeeAvatar } from '../../../../shared/ui/EmployeeAvatar.jsx'
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  Trash2,
  TrendingUp,
  Award,
  Loader2,
  AlertCircle,
} from 'lucide-react'

export const EmployeeList = () => {
  const { employees, departments, setEmployees, setDepartments, setLoading, loading, addEmployee, deleteEmployee } = useTeamStore()
  const { userDoc, claims } = useUserStore()

  const isAdmin = claims?.role === 'admin' || claims?.role === 'owner' || claims?.role === 'superadmin' || userDoc?.role === 'admin' || userDoc?.role === 'owner'

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirmEmp, setDeleteConfirmEmp] = useState(null)
  const [todayAttendanceMap, setTodayAttendanceMap] = useState({})

  // New member form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleName, setRoleName] = useState('')
  const [departmentName, setDepartmentName] = useState('Engineering & Product')
  const [phone, setPhone] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
  const [listError, setListError] = useState('')

  // Fetch employees from Firestore on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setListError('')
      try {
        const [emps, depts] = await Promise.all([getEmployees(), getDepartments()])
        setEmployees(emps)
        setDepartments(depts)
      } catch (err) {
        console.error('Error loading employee directory:', err)
        setListError(err?.message || 'Could not load team members. Sign in again and retry.')
        setEmployees([])
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [setEmployees, setDepartments, setLoading])

  // Real-time subscription to today's attendance logs for live Present / Absent status
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    const q = query(
      collection(db, 'attendanceLogs'),
      where('date', '==', todayStr)
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map = {}
        snap.docs.forEach((doc) => {
          const data = doc.data()
          const isPresent =
            data.clockedIn === true ||
            (data.regularSeconds && data.regularSeconds > 0) ||
            Boolean(data.clockInTime) ||
            data.onDuty === true ||
            data.present === true ||
            data.source === 'on_duty'
          if (data.uid) {
            map[data.uid] = isPresent
          }
        })
        setTodayAttendanceMap(map)
      },
      (err) => {
        console.error('Error fetching today attendance map:', err)
      }
    )

    return () => unsub()
  }, [])

  const isEmpPresent = (emp) => {
    const empUid = emp.uid || emp.id
    if (empUid && todayAttendanceMap[empUid] !== undefined) {
      return todayAttendanceMap[empUid]
    }
    return false
  }

  const filtered = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery ||
      (emp.displayName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.roleName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDept = selectedDept === 'all' || emp.departmentName === selectedDept
    return matchesSearch && matchesDept
  })

  // Team Metrics
  const totalHeadcount = employees.length
  const presentCount = employees.filter((e) => isEmpPresent(e)).length

  const handleInviteMember = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return

    const parsedSkills = skillsInput
      ? skillsInput.split(',').map((s) => s.trim())
      : ['Full Time']

    const payload = {
      displayName: name,
      email,
      roleName: roleName || 'Software Specialist',
      departmentName,
      phoneNumber: phone || ' ',
      skills: parsedSkills,
      status: 'active',
      joinedAt: new Date().toISOString().split('T')[0],
    }

    const created = await createEmployee(payload)
    addEmployee(created)

    setName('')
    setEmail('')
    setRoleName('')
    setPhone('')
    setSkillsInput('')
    setShowAddModal(false)
  }

  const handleDeleteEmployee = async (uid, displayName) => {
    if (!isAdmin) {
      alert('Permission Denied: Regular employees cannot delete employee records.')
      return
    }
    if (window.confirm(`Are you sure you want to remove ${displayName || 'this employee'}?`)) {
      deleteEmployee(uid)
      await deleteEmployeeFromDb(uid)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="ml-3 text-slate-400 text-sm">Loading team data…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Team & Personnel Management"
          description="Manage employees, organizational chart, attendance, utilization rates, and leave workflows"
          actions={
            isAdmin ? (
              <Button icon={UserPlus} variant="primary" onClick={() => setShowAddModal(true)}>
                Invite Member
              </Button>
            ) : null
          }
        />

        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/directory"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
                }`
              }
            >
              <Users className="w-3.5 h-3.5" /> Employee Directory
            </NavLink>
            <NavLink
              to="/team/leave"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/20 dark:border-accent/30'
                  : 'text-muted hover:text-slate-900 dark:hover:text-slate-200 hover:bg-chrome'
                }`
              }
            >
              <Calendar className="w-3.5 h-3.5" /> Leave Management
            </NavLink>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-chrome border border-border text-xs text-fg rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.deptId} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search member, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-chrome border border-border text-xs text-fg placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Team Members
            </span>
            <p className="text-xl font-bold text-fg mt-1">{totalHeadcount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Today's Attendance
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {presentCount} / {totalHeadcount} Present
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {listError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{listError}</span>
        </div>
      )}

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((emp) => {
          const present = isEmpPresent(emp)

          return (
            <Card key={emp.uid || emp.id} hover className="space-y-3.5 border-border relative group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <EmployeeAvatar
                    src={emp.photoURL || emp.avatar}
                    name={emp.displayName || emp.email}
                    className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-accent-hover text-white font-bold text-sm shadow-md shadow-accent/20"
                  />
                  <div>
                    <h4 className="font-bold text-fg text-sm group-hover:text-accent transition-colors">
                      {emp.displayName}
                    </h4>
                    <p className="text-xs text-muted">{emp.roleName}</p>
                  </div>
                </div>
                <Badge variant={present ? 'success' : 'danger'}>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <span className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {present ? 'Present' : 'Absent'}
                  </span>
                </Badge>
              </div>

              <div className="space-y-1 text-xs text-muted pt-1">
                <div className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="text-fg font-medium">{emp.departmentName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="truncate">{emp.email}</span>
                </div>
              </div>

              {/* Skills Badges */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {emp.skills
                  ?.filter((skill) => skill && skill.toLowerCase() !== 'productivity')
                  .map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-chrome border border-border text-[10px] text-fg font-medium"
                    >
                      {skill}
                    </span>
                  ))}
              </div>

              {/* Clean Footer */}
              {isAdmin && (
                <div className="pt-3 border-t border-border flex items-center justify-end">
                  <button
                    onClick={() => setDeleteConfirmEmp(emp)}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-chrome transition-colors"
                    title="Remove Member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Invite Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-slate-800 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm">Invite Team Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteMember} className="space-y-4">
              <Input
                label="Full Name"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Work Email"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Role Title"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-slate-300">Department</label>
                  <select
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full bg-chrome border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.deptId} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Input
                label="Skills (comma separated)"
                placeholder="e.g. React, Node.js, Design Systems"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={UserPlus}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Employee Confirmation Modal */}
      {deleteConfirmEmp && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Member
              </h3>
              <button
                onClick={() => setDeleteConfirmEmp(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-chrome transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete <strong className="text-fg">{deleteConfirmEmp.displayName}</strong> ({deleteConfirmEmp.email})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmEmp(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  const empId = deleteConfirmEmp.uid || deleteConfirmEmp.employeeId
                  deleteEmployee(empId)
                  await deleteEmployeeFromDb(empId)
                  setDeleteConfirmEmp(null)
                }}
              >
                Yes, Delete Member
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
