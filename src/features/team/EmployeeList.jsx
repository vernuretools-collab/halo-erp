import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useTeamStore } from './stores/teamStore'
import { createEmployeeAccount } from '../../shared/services/authService'
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
  Award
} from 'lucide-react'

export const EmployeeList = () => {
  const { employees, departments, addEmployee, deleteEmployee } = useTeamStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)

  // New member form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [roleName, setRoleName] = useState('')
  const [departmentName, setDepartmentName] = useState('Engineering & Product')
  const [phone, setPhone] = useState('')
  const [skillsInput, setSkillsInput] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const filtered = employees.filter((emp) => {
    const matchesSearch =
      !searchQuery ||
      (emp.displayName && emp.displayName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.roleName && emp.roleName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesDept = selectedDept === 'all' || emp.departmentName === selectedDept
    return matchesSearch && matchesDept
  })

  // Team Metrics
  const totalHeadcount = employees.length
  const activeCount = employees.filter((e) => e.status === 'active').length
  const avgUtilization =
    employees.length > 0
      ? Math.round(
        employees.reduce((sum, e) => sum + (e.utilizationRate || 0), 0) /
        employees.length
      )
      : 0

  const handleInviteMember = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const created = await createEmployeeAccount(
        email,
        password,
        name,
        roleName,
        departmentName,
        phone
      )
      addEmployee(created)
      setSuccess(`Employee account created successfully for ${email}!`)

      setName('')
      setEmail('')
      setRoleName('')
      setPhone('')
      setPassword('')
      setSkillsInput('')

      setTimeout(() => {
        setShowAddModal(false)
        setSuccess('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to create employee account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Team & Personnel Management"
          description="Manage employees, organizational chart, attendance, utilization rates, and leave workflows"
          actions={
            <Button icon={UserPlus} variant="primary" onClick={() => setShowAddModal(true)}>
              Invite Member
            </Button>
          }
        />

        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/team/employees"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <Users className="w-3.5 h-3.5" /> Employee Directory
            </NavLink>
            <NavLink
              to="/team/attendance"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Attendance Tracker
            </NavLink>
            <NavLink
              to="/team/leave"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
              className="bg-canvas border border-border text-xs text-fg rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.deptId} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search member, role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-canvas border border-border text-xs text-fg placeholder:text-muted rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Headcount
            </span>
            <p className="text-xl font-bold text-fg mt-1">{totalHeadcount} Members</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Active Presence
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{activeCount} / {totalHeadcount}</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Avg Utilization Rate
            </span>
            <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{avgUtilization}%</p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((emp) => (
          <Card key={emp.uid} hover className="space-y-3.5 border-border relative group">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-accent to-accent-hover text-white font-bold flex items-center justify-center text-sm shadow-md shadow-accent/20">
                  {String(emp.displayName || emp.email || 'U').replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h4 className="font-bold text-fg text-sm group-hover:text-accent dark:group-hover:text-accent transition-colors">
                    {emp.displayName}
                  </h4>
                  <p className="text-xs text-muted">{emp.roleName}</p>
                </div>
              </div>
              <Badge variant={emp.status === 'active' ? 'success' : 'warning'}>
                {emp.status}
              </Badge>
            </div>

            <div className="space-y-1 text-xs text-muted pt-1">
              <div className="flex items-center gap-2">
                <Building className="w-3.5 h-3.5 text-muted" />
                <span className="text-fg">{emp.departmentName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-muted" />
                <span className="truncate text-muted">{emp.email}</span>
              </div>
            </div>

            {/* Skills Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {emp.skills?.map((skill, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-canvas border border-border text-[10px] text-fg font-medium"
                >
                  {skill}
                </span>
              ))}
            </div>

            {/* Utilization Bar & Delete Action */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div className="flex-1 mr-4 space-y-1">
                <div className="flex justify-between text-[10px] text-muted">
                  <span>Utilization</span>
                  <span className="font-bold text-fg">{emp.utilizationRate}%</span>
                </div>
                <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-slate-200/60 dark:border-none">
                  <div
                    className="bg-purple-600 dark:bg-purple-500 h-full"
                    style={{ width: `${emp.utilizationRate}%` }}
                  />
                </div>
              </div>
              <button
                onClick={() => deleteEmployee(emp.uid)}
                className="p-1.5 text-muted hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Remove Member"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Invite Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Invite Team Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 text-xs bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-xs bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                {success}
              </div>
            )}

            <form onSubmit={handleInviteMember} className="space-y-4">
              <Input
                label="Full Name *"
                placeholder="e.g. Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Work Email *"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Account Password *"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none"
                  >
                    {departments.map((d) => (
                      <option key={d.deptId} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  placeholder=" "
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Input
                  label="Skills (comma separated)"
                  placeholder="e.g. React, Node.js, Design Systems"
                  value={skillsInput}
                  onChange={(e) => setSkillsInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3" disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={UserPlus} disabled={loading}>
                  {loading ? 'Creating Account...' : 'Create Employee Account'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
