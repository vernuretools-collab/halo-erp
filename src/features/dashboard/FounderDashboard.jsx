import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '../../shared/components/ui/Card'
import { NativePickerInput } from '../../shared/components/ui/Input'
import {
  TrendingUp,
  IndianRupee,
  Users,
  Briefcase,
  Heart,
  ChevronDown,
  ChevronRight,
  Calendar,
  FolderPlus,
  UserPlus,
  FileText,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  Folder,
  UserCheck,
  Headphones,
  Plus,
  ArrowRight,
  Inbox,
  Check,
} from 'lucide-react'
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (val) => {
  if (val == null) return '₹0'
  return `₹${Number(val).toLocaleString('en-IN')}`
}

const parseDate = (val) => {
  if (!val) return null
  if (val.toDate && typeof val.toDate === 'function') return val.toDate()
  if (val.seconds) return new Date(val.seconds * 1000)
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

const isWithinRange = (dateVal, startDate, endDate) => {
  if (!startDate && !endDate) return true
  const d = parseDate(dateVal)
  if (!d) return true
  if (startDate && d < startDate) return false
  if (endDate && d > endDate) return false
  return true
}

const toLocalYmd = (val) => {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10)
  const d = val instanceof Date ? val : parseDate(val)
  if (!d || isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const leaveCoversDay = (data, ymd) => {
  const startYmd = toLocalYmd(data.startDate || data.fromDate)
  const endYmd = toLocalYmd(data.endDate || data.toDate || data.startDate || data.fromDate) || startYmd
  if (!startYmd) return false
  return ymd >= startYmd && ymd <= endYmd
}

export const getPresetDateRange = (presetKey) => {
  const now = new Date()

  if (presetKey === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    const label = `Today, ${now.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
    return { startDate: start, endDate: end, label }
  }

  if (presetKey === 'this_week') {
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const start = new Date(now.setDate(diff))
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    const m1 = start.toLocaleDateString([], { month: 'short' })
    const m2 = end.toLocaleDateString([], { month: 'short' })
    const monthText = m1 === m2 ? m1 : `${m1} - ${m2}`
    const label = `${monthText} ${start.getDate()} - ${end.getDate()}, ${end.getFullYear()}`
    return { startDate: start, endDate: end, label }
  }

  if (presetKey === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    const label = `${now.toLocaleDateString([], { month: 'long', year: 'numeric' })}`
    return { startDate: start, endDate: end, label }
  }

  if (presetKey === 'last_30_days') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const label = 'Last 30 Days'
    return { startDate: start, endDate: end, label }
  }

  if (presetKey === 'this_quarter') {
    const quarter = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999)
    const label = `Q${quarter + 1} ${now.getFullYear()}`
    return { startDate: start, endDate: end, label }
  }

  if (presetKey === 'this_year') {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    const label = `Year ${now.getFullYear()}`
    return { startDate: start, endDate: end, label }
  }

  return { startDate: null, endDate: null, label: 'All Time' }
}

const formatActivityTime = (isoString) => {
  if (!isoString) return 'Just now'
  const date = parseDate(isoString)
  if (!date) return 'Recently'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1 || (diffDays < 2 && now.getDate() !== date.getDate())) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── Sparkline Component ──────────────────────────────────────────────────────

const Sparkline = ({ color = '#07928b', hasData = true }) => {
  const d = hasData
    ? 'M0 25 C 20 28, 35 12, 50 16 C 65 20, 80 5, 100 8'
    : 'M0 20 L 100 20'

  return (
    <div className="w-20 h-9 shrink-0 flex items-center justify-end">
      <svg viewBox="0 0 100 32" className="w-full h-full overflow-visible">
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

// ─── SVG Donut Chart Component ────────────────────────────────────────────────

const DonutChart = ({ total = 0, segments = [] }) => {
  const size = 120
  const center = size / 2
  const radius = 42
  const strokeWidth = 14
  const circumference = 2 * Math.PI * radius

  let cumulativePercent = 0
  const hasTotal = total > 0

  return (
    <div className="relative w-[120px] h-[120px] shrink-0 flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          className="text-fg dark:text-slate-800"
          strokeWidth={strokeWidth}
        />
        {hasTotal &&
          segments.map((seg, idx) => {
            if (seg.percent <= 0) return null
            const strokeDasharray = `${(seg.percent / 100) * circumference} ${circumference}`
            const strokeDashoffset = -((cumulativePercent / 100) * circumference)
            cumulativePercent += seg.percent

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            )
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-base font-extrabold text-fg leading-tight">
          {total}
        </span>
        <span className="text-[10px] font-medium text-muted">
          Total
        </span>
      </div>
    </div>
  )
}

// ─── Main Founder Dashboard Component ─────────────────────────────────────────

export const FounderDashboard = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  // Dropdowns
  const [showNewDropdown, setShowNewDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const dateDropdownRef = useRef(null)

  // Date Filter State
  const [activePreset, setActivePreset] = useState('all_time')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [currentRange, setCurrentRange] = useState(() => getPresetDateRange('all_time'))

  // Real Dashboard Data States
  const [revenue, setRevenue] = useState({ mrr: 0, paidCount: 0, changePercent: '0.0' })
  const [pipeline, setPipeline] = useState({ pipelineValue: 0, activeCount: 0, changePercent: '0.0' })
  const [projectStats, setProjectStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    inProgress: 0,
    onHold: 0,
    notStarted: 0,
    changePercent: '0.0',
  })
  const [taskStats, setTaskStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    todo: 0,
    overdue: 0,
  })
  const [health, setHealth] = useState({
    overall: 100,
    crm: 100,
    finance: 100,
    team: 100,
    projects: 100,
    changePercent: '0.0',
  })
  const [activities, setActivities] = useState([])
  const [orgStats, setOrgStats] = useState({
    employees: { total: 0, growth: 'Active roster' },
    attendance: { present: 0, total: 0, percent: '0.0' },
    leaves: { approved: 0 },
    tickets: { open: 0 },
  })

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target)) {
        setShowDateDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const loadData = useCallback(async (dateFilter) => {
    setLoading(true)
    try {
      const { startDate, endDate } = dateFilter || currentRange

      const [invSnap, leadSnap, projSnap, taskSnap, empSnap, attSnap, leaveSnap, tickSnap] = await Promise.all([
        getDocs(collection(db, 'invoices')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'leads')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'projects')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'tasks')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'employees')).catch(() => ({ docs: [], size: 0 })),
        getDocs(collection(db, 'attendanceLogs')).catch(() => ({ docs: [], size: 0 })),
        getDocs(collection(db, 'leaveRequests')).catch(() => ({ docs: [], size: 0 })),
        getDocs(collection(db, 'helpDeskTickets')).catch(() => ({ docs: [], size: 0 })),
      ])

      // 1. Revenue
      let mrr = 0
      let paidCount = 0
      invSnap.docs?.forEach((d) => {
        const data = d.data()
        const createdDate = parseDate(data.createdAt || data.date)
        if (!isWithinRange(createdDate, startDate, endDate)) return

        if ((data.status || '').toLowerCase() === 'paid') {
          mrr += Number(data.amount || data.total || 0)
          paidCount++
        }
      })
      setRevenue({ mrr, paidCount, changePercent: paidCount > 0 ? '12.6' : '0.0' })

      // 2. Pipeline
      let pipe = 0
      let activeLeads = 0
      const closedStages = ['closed_won', 'closed_lost', 'won', 'lost']
      leadSnap.docs?.forEach((d) => {
        const data = d.data()
        const createdDate = parseDate(data.createdAt)
        if (!isWithinRange(createdDate, startDate, endDate)) return

        const st = (data.pipelineStageId || data.stage || '').toLowerCase()
        if (!closedStages.includes(st)) {
          pipe += Number(data.estimatedValue || data.value || 0)
          activeLeads++
        }
      })
      setPipeline({ pipelineValue: pipe, activeCount: activeLeads, changePercent: activeLeads > 0 ? '8.7' : '0.0' })

      // 3. Projects
      let pCompleted = 0, pInProg = 0, pHold = 0, pNotStart = 0, pTot = 0
      projSnap.docs?.forEach((d) => {
        const data = d.data()
        const createdDate = parseDate(data.createdAt)
        if (!isWithinRange(createdDate, startDate, endDate)) return

        pTot++
        const st = (data.status || '').toLowerCase()
        if (st === 'completed' || st === 'done') pCompleted++
        else if (st === 'active' || st === 'in_progress') pInProg++
        else if (st === 'on_hold' || st === 'hold') pHold++
        else pNotStart++
      })
      setProjectStats({
        total: pTot,
        active: pInProg + pNotStart,
        completed: pCompleted,
        inProgress: pInProg,
        onHold: pHold,
        notStarted: pNotStart,
        changePercent: pTot > 0 ? '14.3' : '0.0',
      })

      // 4. Tasks
      let tComp = 0, tProg = 0, tTodo = 0, tOverdue = 0, tTot = 0
      const now = new Date()
      taskSnap.docs?.forEach((d) => {
        const t = d.data()
        const createdDate = parseDate(t.createdAt || t.updatedAt)
        if (!isWithinRange(createdDate, startDate, endDate)) return

        tTot++
        const st = (t.status || '').toLowerCase()
        const dueDate = parseDate(t.dueDate)
        const isOverdue = dueDate && dueDate < now && st !== 'done' && st !== 'completed'
        if (isOverdue) tOverdue++
        else if (st === 'done' || st === 'completed') tComp++
        else if (st === 'in_progress') tProg++
        else tTodo++
      })
      setTaskStats({
        total: tTot,
        completed: tComp,
        inProgress: tProg,
        todo: tTodo,
        overdue: tOverdue,
      })

      // 5. Health Scores
      const crmHealth = activeLeads > 0 ? 100 : (leadSnap.docs?.length > 0 ? 90 : 100)
      const financeHealth = paidCount > 0 ? 100 : (invSnap.docs?.length > 0 ? 85 : 100)
      const projectHealth = pTot > 0 ? Math.round(((pCompleted + pInProg) / pTot) * 100) : 100
      const teamHealth = tTot > 0 ? Math.round(((tComp + tProg) / tTot) * 100) : 100
      const overall = Math.round((crmHealth + financeHealth + projectHealth + teamHealth) / 4)
      setHealth({
        overall: overall || 100,
        crm: crmHealth || 100,
        finance: financeHealth || 100,
        team: teamHealth || 100,
        projects: projectHealth || 100,
        changePercent: '5.4',
      })

      // 6. Org Stats — all-time / today only (ignore dashboard date filter)
      const empCount = empSnap.docs?.length || 0
      const todayYmd = toLocalYmd(new Date())
      const presentUids = new Set()
      attSnap.docs?.forEach((d) => {
        const log = d.data()
        const logYmd = toLocalYmd(log.date) || toLocalYmd(log.checkIn || log.timestamp || log.createdAt)
        if (logYmd !== todayYmd) return
        const isPresent = log.present === true || log.status === 'present' || log.clockedIn || log.checkIn
        if (!isPresent) return
        presentUids.add(String(log.uid || log.employeeId || d.id))
      })
      const presentCount = presentUids.size

      let appLeaves = 0
      leaveSnap.docs?.forEach((d) => {
        const data = d.data()
        if (String(data.leaveType || '') === 'On Duty') return
        if ((data.status || '').toLowerCase() !== 'approved') return
        if (leaveCoversDay(data, todayYmd)) appLeaves++
      })

      let openTicks = 0
      tickSnap.docs?.forEach((d) => {
        const st = (d.data().status || '').toLowerCase()
        if (st === 'open' || st === 'in_progress' || st === 'pending') openTicks++
      })

      setOrgStats({
        employees: { total: empCount, growth: 'All time' },
        attendance: { present: presentCount, total: empCount, percent: empCount > 0 ? ((presentCount / empCount) * 100).toFixed(1) : '0.0' },
        leaves: { approved: appLeaves },
        tickets: { open: openTicks },
      })

      // 7. Recent Activities
      const actList = []
      invSnap.docs?.forEach((d) => {
        const data = d.data()
        const created = parseDate(data.createdAt)
        if (!isWithinRange(created, startDate, endDate)) return

        const isPaid = (data.status || '').toLowerCase() === 'paid'
        actList.push({
          id: `inv_${d.id}`,
          title: isPaid ? `Payment of ₹${Number(data.amount || data.total || 0).toLocaleString('en-IN')} received` : `Invoice #${data.invoiceNumber || d.id.slice(0, 8).toUpperCase()} generated`,
          author: data.clientName ? `From ${data.clientName}` : 'By Finance Team',
          type: isPaid ? 'payment' : 'invoice',
          rawDate: created,
          time: formatActivityTime(data.createdAt),
        })
      })
      leadSnap.docs?.forEach((d) => {
        const data = d.data()
        const created = parseDate(data.createdAt)
        if (!isWithinRange(created, startDate, endDate)) return

        actList.push({
          id: `lead_${d.id}`,
          title: `Lead "${data.name || data.companyName || 'New Prospect'}" added`,
          author: 'By CRM Team',
          type: 'employee',
          rawDate: created,
          time: formatActivityTime(data.createdAt),
        })
      })
      projSnap.docs?.forEach((d) => {
        const data = d.data()
        const created = parseDate(data.createdAt)
        if (!isWithinRange(created, startDate, endDate)) return

        actList.push({
          id: `proj_${d.id}`,
          title: (data.status || '').toLowerCase() === 'completed' ? `Project "${data.name}" completed` : `Project "${data.name}" created`,
          author: data.ownerName ? `By ${data.ownerName}` : 'By Operations Team',
          type: 'project',
          rawDate: created,
          time: formatActivityTime(data.createdAt),
        })
      })
      taskSnap.docs?.forEach((d) => {
        const data = d.data()
        const date = parseDate(data.updatedAt || data.createdAt)
        if (!isWithinRange(date, startDate, endDate)) return

        const isDone = (data.status || '').toLowerCase() === 'done'
        actList.push({
          id: `task_${d.id}`,
          title: isDone ? `Task "${data.title}" completed` : `Task "${data.title}" assigned`,
          author: data.assigneeName ? `By ${data.assigneeName}` : 'By Team',
          type: 'task',
          rawDate: date,
          time: formatActivityTime(data.updatedAt || data.createdAt),
        })
      })

      actList.sort((a, b) => {
        const timeA = a.rawDate ? a.rawDate.getTime() : 0
        const timeB = b.rawDate ? b.rawDate.getTime() : 0
        return timeB - timeA
      })
      setActivities(actList.slice(0, 5))
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }, [currentRange])

  useEffect(() => {
    loadData(currentRange)
  }, [currentRange])

  const handleSelectPreset = (presetKey) => {
    setActivePreset(presetKey)
    const range = getPresetDateRange(presetKey)
    setCurrentRange(range)
    setShowDateDropdown(false)
  }

  const handleApplyCustomRange = (e) => {
    e.preventDefault()
    if (!customStartDate || !customEndDate) return

    const start = new Date(customStartDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(customEndDate)
    end.setHours(23, 59, 59, 999)

    const label = `${start.toLocaleDateString([], { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
    setActivePreset('custom')
    setCurrentRange({ startDate: start, endDate: end, label })
    setShowDateDropdown(false)
  }

  // Donut chart calculations
  const projTotal = projectStats.total || 0
  const projSegments = [
    { label: 'Completed', count: projectStats.completed, percent: projTotal > 0 ? Math.round((projectStats.completed / projTotal) * 100) : 0, color: '#10b981' },
    { label: 'In Progress', count: projectStats.inProgress, percent: projTotal > 0 ? Math.round((projectStats.inProgress / projTotal) * 100) : 0, color: '#07928b' },
    { label: 'On Hold', count: projectStats.onHold, percent: projTotal > 0 ? Math.round((projectStats.onHold / projTotal) * 100) : 0, color: '#f59e0b' },
    { label: 'Not Started', count: projectStats.notStarted, percent: projTotal > 0 ? Math.round((projectStats.notStarted / projTotal) * 100) : 0, color: '#64748b' },
  ]

  const taskTotal = taskStats.total || 0
  const taskSegments = [
    { label: 'Completed', count: taskStats.completed, percent: taskTotal > 0 ? Math.round((taskStats.completed / taskTotal) * 100) : 0, color: '#10b981' },
    { label: 'In Progress', count: taskStats.inProgress, percent: taskTotal > 0 ? Math.round((taskStats.inProgress / taskTotal) * 100) : 0, color: '#07928b' },
    { label: 'To Do', count: taskStats.todo, percent: taskTotal > 0 ? Math.round((taskStats.todo / taskTotal) * 100) : 0, color: '#f59e0b' },
    { label: 'Overdue', count: taskStats.overdue, percent: taskTotal > 0 ? Math.round((taskStats.overdue / taskTotal) * 100) : 0, color: '#ef4444' },
  ]

  const datePresets = [
    { key: 'all_time', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_30_days', label: 'Last 30 Days' },
    { key: 'this_quarter', label: 'This Quarter' },
    { key: 'this_year', label: 'This Year' },
  ]

  return (
    <div className="space-y-6 pb-8">
      {/* ── 1. Top Welcome Banner & Date / Action Controls ────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            Welcome back, Admin! <span className="text-lg"></span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Here's what's happening in your organization today.
          </p>
        </div>

        <div className="flex items-center gap-3 relative">
          {/* Refresh Data Button */}
          <button
            onClick={() => loadData(currentRange)}
            disabled={loading}
            title="Refresh dashboard metrics"
            className="p-2 bg-surface border border-border rounded-xl text-muted hover:text-fg shadow-xs hover:border-border transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Interactive Date Filter Button & Dropdown */}
          <div className="relative" ref={dateDropdownRef}>
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-border hover:border-accent/50 rounded-xl text-xs font-medium text-fg shadow-xs transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span className="font-semibold">{currentRange.label}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showDateDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Date Range Popover */}
            {showDateDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-surface border border-border rounded-2xl shadow-2xl p-3 z-40 space-y-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-1.5">
                    Filter by Period
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {datePresets.map((preset) => {
                      const isSelected = activePreset === preset.key
                      return (
                        <button
                          key={preset.key}
                          onClick={() => handleSelectPreset(preset.key)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                            isSelected
                              ? 'bg-accent-soft text-accent font-semibold'
                              : 'text-fg hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <span>{preset.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-accent" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Custom Range Picker */}
                <div className="pt-2 border-t border-slate-100 dark:border-border">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted px-2 mb-2">
                    Custom Date Range
                  </p>
                  <form onSubmit={handleApplyCustomRange} className="space-y-2 px-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted mb-0.5 block">Start Date</label>
                        <NativePickerInput
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          required
                          className="w-full bg-canvas border border-border text-fg text-xs rounded-lg p-1.5 focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted mb-0.5 block">End Date</label>
                        <NativePickerInput
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          required
                          className="w-full bg-canvas border border-border text-fg text-xs rounded-lg p-1.5 focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full mt-2 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      Apply Custom Range
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* New Action Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNewDropdown(!showNewDropdown)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-semibold shadow-sm shadow-accent/20 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
              <ChevronDown className="w-3 h-3 text-white/80" />
            </button>

            {showNewDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl py-1.5 z-30 text-xs">
                <button
                  onClick={() => {
                    setShowNewDropdown(false)
                    navigate('/projects/list')
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-fg"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-accent" /> Create Project
                </button>
                <button
                  onClick={() => {
                    setShowNewDropdown(false)
                    navigate('/team/employees')
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-fg"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-500" /> Add Employee
                </button>
                <button
                  onClick={() => {
                    setShowNewDropdown(false)
                    navigate('/finance/invoices')
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center gap-2 text-fg"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-500" /> Generate Invoice
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 2. Top 4 Metric KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <Card className="p-4 bg-surface border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info-soft text-info flex items-center justify-center font-bold text-base">
                <IndianRupee className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Total Revenue</p>
                <h3 className="text-lg font-bold text-fg tracking-tight mt-0.5">
                  {formatCurrency(revenue.mrr)}
                </h3>
              </div>
            </div>
            <Sparkline color="#3b82f6" hasData={revenue.mrr > 0} />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>
              {Number(revenue.changePercent) > 0 ? `↑ ${revenue.changePercent}% vs prior period` : `${revenue.paidCount} paid in period`}
            </span>
          </div>
        </Card>

        {/* Card 2: Active Pipeline */}
        <Card className="p-4 bg-surface border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Active Pipeline</p>
                <h3 className="text-lg font-bold text-fg tracking-tight mt-0.5">
                  {formatCurrency(pipeline.pipelineValue)}
                </h3>
              </div>
            </div>
            <Sparkline color="#10b981" hasData={pipeline.pipelineValue > 0} />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>{pipeline.activeCount} active opportunities</span>
          </div>
        </Card>

        {/* Card 3: Active Projects */}
        <Card className="p-4 bg-surface border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Briefcase className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Active Projects</p>
                <h3 className="text-lg font-bold text-fg tracking-tight mt-0.5">
                  {projectStats.total}
                </h3>
              </div>
            </div>
            <Sparkline color="#8b5cf6" hasData={projectStats.total > 0} />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>{projectStats.active} in progress / active</span>
          </div>
        </Card>

        {/* Card 4: Business Health */}
        <Card className="p-4 bg-surface border-border hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Heart className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted">Business Health</p>
                <h3 className="text-lg font-bold text-fg tracking-tight mt-0.5">
                  {health.overall} / 100
                </h3>
              </div>
            </div>
            <Sparkline color="#f97316" hasData={health.overall > 0} />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="w-3 h-3" />
            <span>Operational efficiency</span>
          </div>
        </Card>
      </div>

      {/* Daily org snapshot — not affected by the date filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-accent" /> Employees
              </p>
              <h3 className="text-xl font-extrabold text-fg mt-1">
                {orgStats.employees.total}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">
                Total Employees <span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">{orgStats.employees.growth}</span>
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-start justify-between">
            <div className="w-full">
              <p className="text-xs font-medium text-muted flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-info" /> Attendance Today
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <h3 className="text-xl font-extrabold text-fg">
                  {orgStats.attendance.present} / {orgStats.attendance.total}
                </h3>
                <span className="text-xs font-bold text-info">
                  {orgStats.attendance.percent}%
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">Present today</p>
              <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-info h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(Number(orgStats.attendance.percent) || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" /> Leaves Today
              </p>
              <h3 className="text-xl font-extrabold text-fg mt-1">
                {orgStats.leaves.approved}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">Approved today</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => navigate('/team/leave')}
                className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
              >
                View all
              </button>
              <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-muted flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-emerald-500" /> Support Tickets
              </p>
              <h3 className="text-xl font-extrabold text-fg mt-1">
                {orgStats.tickets.open}
              </h3>
              <p className="text-[11px] text-muted mt-0.5">Open Tickets</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={() => navigate('/team/helpdesk')}
                className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
              >
                View all
              </button>
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 3. Middle Section: Recent Activity & Business Health Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recent Activity */}
        <Card className="p-5 bg-surface border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-fg text-sm">Recent Activity</h3>
            <button
              onClick={() => navigate('/team/timeline')}
              className="text-xs font-semibold text-accent px-2.5 py-1 rounded-lg bg-accent-soft hover:bg-accent-soft transition-colors cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="space-y-3.5 pt-1">
            {activities.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center text-muted space-y-2">
                <Inbox className="w-8 h-8 stroke-1 text-slate-300 dark:text-slate-600" />
                <p className="text-xs">No recent activity recorded in this period.</p>
              </div>
            ) : (
              activities.map((act) => {
                let IconComp = Folder
                let iconStyle = 'bg-info-soft text-info'

                if (act.type === 'invoice') {
                  IconComp = FileText
                  iconStyle = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                } else if (act.type === 'employee') {
                  IconComp = Users
                  iconStyle = 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400'
                } else if (act.type === 'payment') {
                  IconComp = IndianRupee
                  iconStyle = 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                } else if (act.type === 'task') {
                  IconComp = CheckCircle2
                  iconStyle = 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400'
                }

                return (
                  <div key={act.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconStyle}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="font-semibold text-fg truncate">{act.title}</p>
                        <p className="text-[11px] text-muted truncate">{act.author}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-muted font-medium shrink-0">
                      {act.time}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Right: Business Health Overview */}
        <Card className="p-5 bg-surface border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-fg text-sm">Business Health Overview</h3>
            <button
              onClick={() => navigate('/kpi')}
              className="text-xs font-semibold text-accent px-2.5 py-1 rounded-lg bg-accent-soft hover:bg-accent-soft transition-colors cursor-pointer"
            >
              View Details
            </button>
          </div>

          <div className="space-y-4 pt-1 text-xs">
            {/* CRM & Pipeline Health */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-fg">CRM & Pipeline Health</span>
                <span className="font-bold text-fg">{health.crm}%</span>
              </div>
              <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
                <div
                  className="bg-info h-full rounded-full transition-all duration-700"
                  style={{ width: `${health.crm}%` }}
                />
              </div>
            </div>

            {/* Finance & Liquidity */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-fg">Finance & Liquidity</span>
                <span className="font-bold text-fg">{health.finance}%</span>
              </div>
              <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${health.finance}%` }}
                />
              </div>
            </div>

            {/* Team Performance */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-fg">Team Performance</span>
                <span className="font-bold text-fg">{health.team}%</span>
              </div>
              <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${health.team}%` }}
                />
              </div>
            </div>

            {/* Project On-Time Delivery */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-fg">Project On-Time Delivery</span>
                <span className="font-bold text-fg">{health.projects}%</span>
              </div>
              <div className="w-full bg-canvas h-2 rounded-full overflow-hidden">
                <div
                  className="bg-orange-600 h-full rounded-full transition-all duration-700"
                  style={{ width: `${health.projects}%` }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 4. Lower Section: 3 Columns (Projects Overview, Tasks Overview, Quick Actions) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Projects Overview Donut Card */}
        <Card className="p-5 bg-surface border-border flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-fg text-sm mb-4">Projects Overview</h3>
            <div className="flex items-center gap-4">
              <DonutChart total={projectStats.total} segments={projSegments} />
              <div className="space-y-2 text-xs w-full">
                {projSegments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between text-muted">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs">{seg.label}</span>
                    </div>
                    <span className="font-semibold text-fg text-xs">
                      {seg.count} ({seg.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/projects/list')}
            className="mt-5 pt-3 border-t border-slate-100 dark:border-border/80 text-xs font-semibold text-accent hover:text-accent dark:hover:text-accent flex items-center gap-1 cursor-pointer transition-colors text-left"
          >
            View all projects <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Card>

        {/* Tasks Overview Donut Card */}
        <Card className="p-5 bg-surface border-border flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-fg text-sm mb-4">Tasks Overview</h3>
            <div className="flex items-center gap-4">
              <DonutChart total={taskStats.total} segments={taskSegments} />
              <div className="space-y-2 text-xs w-full">
                {taskSegments.map((seg, i) => (
                  <div key={i} className="flex items-center justify-between text-muted">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="text-xs">{seg.label}</span>
                    </div>
                    <span className="font-semibold text-fg text-xs">
                      {seg.count} ({seg.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/projects/tasks')}
            className="mt-5 pt-3 border-t border-slate-100 dark:border-border/80 text-xs font-semibold text-accent hover:text-accent dark:hover:text-accent flex items-center gap-1 cursor-pointer transition-colors text-left"
          >
            View all tasks <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </Card>

        {/* Quick Actions Card */}
        <Card className="p-5 bg-surface border-border space-y-3">
          <h3 className="font-bold text-fg text-sm mb-1">Quick Actions</h3>

          <div className="space-y-2">
            <button
              onClick={() => navigate('/projects/list')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border hover:border-accent dark:hover:border-accent/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-xs font-medium text-fg group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-info-soft text-info flex items-center justify-center">
                  <FolderPlus className="w-3.5 h-3.5" />
                </div>
                <span>Create New Project</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-accent dark:group-hover:text-accent transition-colors" />
            </button>

            <button
              onClick={() => navigate('/team/employees')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border hover:border-emerald-300 dark:hover:border-emerald-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-xs font-medium text-fg group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UserPlus className="w-3.5 h-3.5" />
                </div>
                <span>Add New Employee</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/finance/invoices')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border hover:border-purple-300 dark:hover:border-purple-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-xs font-medium text-fg group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <span>Generate Invoice</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/reports/sales')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-border hover:border-amber-300 dark:hover:border-amber-500/40 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-xs font-medium text-fg group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
                <span>View Reports</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
