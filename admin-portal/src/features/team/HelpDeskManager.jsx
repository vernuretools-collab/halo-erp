import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useUserStore } from '../../stores/userStore'
import { TeamSubNav } from './components/TeamSubNav'
import {
  subscribeToAllTickets,
  updateTicketStatus,
  updateTicketPriority,
  addTicketResolution,
  addTicketReply,
  deleteTicket,
} from './services/helpDeskService'
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Monitor,
  Users,
  DollarSign,
  Building,
  HelpCircle,
  X,
  MessageSquare,
  Trash2,
  Filter,
  User,
  Check,
  ChevronDown,
  Send,
  Folder,
} from 'lucide-react'


// ─── Config & Helpers ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  it: { label: 'IT & Systems', icon: Monitor, color: 'text-accent', bg: 'bg-accent-soft ' },
  hr: { label: 'Human Resources', icon: Users, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  finance: { label: 'Finance & Payroll', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  facilities: { label: 'Facilities & Office', icon: Building, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  other: { label: 'General Support', icon: HelpCircle, color: 'text-muted', bg: 'bg-canvas' },
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-info-soft text-info border-info/30' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
  resolved: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  closed: { label: 'Closed', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
}

const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  low: { label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
}

const formatDate = (rawDate) => {
  if (!rawDate) return 'Just now'
  if (typeof rawDate?.toDate === 'function') {
    return rawDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  if (rawDate?.seconds) {
    return new Date(rawDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const d = new Date(rawDate)
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const HelpDeskManager = () => {
  const { user } = useUserStore()
  const adminName = user?.displayName || user?.email || 'Admin'

  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')

  // Resolve / Reply Modal State
  const [resolveTicket, setResolveTicket] = useState(null)
  const [resolutionText, setResolutionText] = useState('')
  const [submittingResolution, setSubmittingResolution] = useState(false)

  // Delete Confirm State
  const [deleteTicketItem, setDeleteTicketItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Real-time subscription to tickets
  useEffect(() => {
    const unsub = subscribeToAllTickets((data) => {
      setTickets(data)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Summary Metrics
  const stats = useMemo(() => {
    const statusOf = (t) => (t.status || 'open').toLowerCase()
    const total = tickets.length
    const open = tickets.filter((t) => statusOf(t) === 'open').length
    const inProgress = tickets.filter((t) => statusOf(t) === 'in_progress').length
    const resolved = tickets.filter((t) => statusOf(t) === 'resolved' || statusOf(t) === 'closed').length
    const high = tickets.filter((t) => {
      const p = (t.priority || '').toLowerCase()
      return p === 'high' || p === 'urgent'
    }).length
    return { total, open, inProgress, resolved, high }
  }, [tickets])

  // Filtered & Searched Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const q = searchQuery.toLowerCase().trim()
      const subject = (ticket.subject || '').toLowerCase()
      const desc = (ticket.description || '').toLowerCase()
      const client = (ticket.clientName || ticket.clientEmail || '').toLowerCase()
      const project = (ticket.projectName || '').toLowerCase()

      const matchesSearch =
        !q || subject.includes(q) || desc.includes(q) || client.includes(q) || project.includes(q)

      const status = (ticket.status || 'open').toLowerCase()
      let matchesStatus = true
      if (statusFilter === 'Open') matchesStatus = status === 'open'
      else if (statusFilter === 'In Progress') matchesStatus = status === 'in_progress'
      else if (statusFilter === 'Resolved') matchesStatus = status === 'resolved' || status === 'closed'

      let matchesCategory = true
      if (categoryFilter !== 'All') {
        matchesCategory = (ticket.category || '').toLowerCase() === categoryFilter.toLowerCase()
      }

      let matchesPriority = true
      if (priorityFilter !== 'All') {
        const p = (ticket.priority || 'medium').toLowerCase()
        if (priorityFilter === 'high') matchesPriority = p === 'high' || p === 'urgent'
        else if (priorityFilter === 'medium') matchesPriority = p === 'medium' || p === 'normal'
        else matchesPriority = p === priorityFilter.toLowerCase()
      }

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority
    })
  }, [tickets, searchQuery, statusFilter, categoryFilter, priorityFilter])

  // Change Status handler
  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateTicketStatus(ticketId, newStatus)
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  // Change Priority handler
  const handlePriorityChange = async (ticketId, newPriority) => {
    try {
      await updateTicketPriority(ticketId, newPriority)
    } catch (err) {
      console.error('Failed to update priority:', err)
    }
  }

  // Admin Reply State
  const [adminReplyText, setAdminReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)

  // Keep resolveTicket synchronized with real-time updates
  useEffect(() => {
    if (resolveTicket) {
      const updated = tickets.find((t) => t.id === resolveTicket.id)
      if (updated) setResolveTicket(updated)
    }
  }, [tickets, resolveTicket?.id])

  // Open Resolution Dialog
  const handleOpenResolve = (ticket) => {
    setResolveTicket(ticket)
    setResolutionText(ticket.resolutionNote || '')
    setAdminReplyText('')
  }

  // Send Admin Reply into Conversation Thread
  const handleSendAdminReply = async (e) => {
    e.preventDefault()
    if (!resolveTicket || !adminReplyText.trim()) return
    setSendingReply(true)
    try {
      await addTicketReply(resolveTicket.id, {
        senderId: user?.uid || 'admin',
        senderName: adminName,
        senderRole: 'admin',
        message: adminReplyText.trim(),
      })
      setAdminReplyText('')
    } catch (err) {
      console.error('Failed to post reply:', err)
      alert('Failed to send reply: ' + err.message)
    } finally {
      setSendingReply(false)
    }
  }

  // Save Resolution Note & Mark Resolved
  const handleSaveResolution = async (e) => {
    e.preventDefault()
    if (!resolveTicket || !resolutionText.trim()) return
    setSubmittingResolution(true)
    try {
      await addTicketResolution(resolveTicket.id, resolutionText, adminName)
      setResolveTicket(null)
      setResolutionText('')
    } catch (err) {
      console.error('Failed to save resolution:', err)
    } finally {
      setSubmittingResolution(false)
    }
  }


  // Delete ticket
  const handleDeleteConfirm = async () => {
    if (!deleteTicketItem) return
    setDeleting(true)
    try {
      await deleteTicket(deleteTicketItem.id)
      setDeleteTicketItem(null)
    } catch (err) {
      console.error('Failed to delete ticket:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Client Support Tickets"
        description="Tickets submitted by clients from their portal. Assigned project employees also see these in the employee portal."
      />

      {/* Team SubNav */}
      <TeamSubNav />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Total Tickets</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
              <LifeBuoy className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Pending / Open</p>
              <h3 className="text-2xl font-bold text-accent mt-1">{stats.open}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">In Progress</p>
              <h3 className="text-2xl font-bold text-info mt-1">{stats.inProgress}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-info-soft flex items-center justify-center text-info">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Resolved</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.resolved}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {[
            { key: 'All', label: 'All', count: stats.total },
            { key: 'Open', label: 'Open', count: stats.open },
            { key: 'In Progress', label: 'In Progress', count: stats.inProgress },
            { key: 'Resolved', label: 'Resolved', count: stats.resolved },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-chrome text-fg border border-border hover:bg-surface'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-canvas border border-border text-fg outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Technical Bug">Technical Bug</option>
            <option value="Deliverable Review">Deliverable Review</option>
            <option value="Billing & Invoices">Billing & Invoices</option>
            <option value="General Inquiry">General Inquiry</option>
          </select>

          {/* Priority Dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-canvas border border-border text-fg outline-none"
          >
            <option value="All">All Priorities</option>
            <option value="high">High / Urgent</option>
            <option value="medium">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, project, or ticket..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl bg-canvas border border-border text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Ticket List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 bg-surface border-border animate-pulse">
              <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center bg-surface border-border">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center text-accent mx-auto mb-4">
            <LifeBuoy className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery || statusFilter !== 'All' ? 'No matching tickets found' : 'No client support tickets yet'}
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1.5">
            {searchQuery || statusFilter !== 'All'
              ? 'Try adjusting your filters or search keywords.'
              : 'When a client submits a support ticket, it appears here and for employees on that project.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTickets.map((ticket) => {
            const catLabel = ticket.category || 'Support'
            const catKey = (ticket.category || 'other').toLowerCase()
            const catConfig = CATEGORY_CONFIG[catKey] || CATEGORY_CONFIG.other
            const CatIcon = catConfig.icon

            const currentStatus = (ticket.status || 'open').toLowerCase()
            const statusConfig = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.open

            const rawPriority = (ticket.priority || 'medium').toLowerCase()
            const currentPriority =
              rawPriority === 'urgent' || rawPriority === 'high'
                ? 'high'
                : rawPriority === 'low'
                  ? 'low'
                  : 'medium'
            const priorityConfig = PRIORITY_CONFIG[currentPriority] || PRIORITY_CONFIG.medium

            const employeeName = ticket.clientName || ticket.employeeName || ticket.clientEmail || ticket.employeeEmail || 'User'
            const isClientTicket = !!(ticket.clientId || ticket.clientEmail || ticket.projectName)
            const repliesCount = Array.isArray(ticket.replies) ? ticket.replies.length : 0

            return (
              <Card
                key={ticket.id}
                className="p-5 bg-surface border-border hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {/* Left Content */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${catConfig.bg} ${catConfig.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <CatIcon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {isClientTicket && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                            CLIENT TICKET
                          </span>
                        )}
                        {ticket.projectName && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Project: {ticket.projectName}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-muted">
                          {catLabel}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <Badge className={`text-[10px] font-bold px-2 py-0.2 border ${priorityConfig.color}`}>
                          {priorityConfig.label.toUpperCase()} PRIORITY
                        </Badge>
                        <span className="text-slate-300 dark:text-slate-700">•</span>
                        <span className="text-xs text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(ticket.createdAt)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {ticket.subject}
                      </h3>

                      <p className="text-xs text-muted whitespace-pre-wrap leading-relaxed">
                        {ticket.description}
                      </p>

                      {/* Author Info Badge */}
                      <div className="pt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="flex items-center gap-1.5 font-medium bg-canvas/60 px-2.5 py-1 rounded-lg">
                          <User className="w-3.5 h-3.5 text-accent" />
                          <span className="font-semibold text-fg">{employeeName}</span>
                          {(ticket.clientEmail || ticket.employeeEmail) && (
                            <span className="text-[11px] text-slate-400">({ticket.clientEmail || ticket.employeeEmail})</span>
                          )}
                        </span>

                        {ticket.resolvedBy && (
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolved by {ticket.resolvedBy}
                          </span>
                        )}

                        {repliesCount > 0 && (
                          <span className="text-info font-semibold flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {repliesCount} {repliesCount === 1 ? 'Reply' : 'Replies'}
                          </span>
                        )}
                      </div>

                      {/* Admin Resolution Note if present */}
                      {ticket.resolutionNote && (
                        <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs">
                          <p className="font-semibold text-emerald-800 dark:text-emerald-300 mb-0.5 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Admin Note / Solution:
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{ticket.resolutionNote}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Actions & Status Controls */}
                  <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-start gap-2.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-border">
                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">Status:</span>
                      <select
                        value={currentStatus}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        className={`text-xs font-bold px-2.5 py-1.5 rounded-xl border outline-none cursor-pointer ${statusConfig.color}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenResolve(ticket)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-accent-soft hover:bg-accent-soft text-accent transition-colors flex items-center gap-1 cursor-pointer"
                        title="Open Discussion & Replies"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Discussion & Note</span>
                      </button>

                      <button
                        onClick={() => setDeleteTicketItem(ticket)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                        title="Delete ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}


      {/* ─── Resolution / Multi-Party Discussion Modal ────────────────────── */}
      {resolveTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-border bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {resolveTicket.subject}
                    </h3>
                    {resolveTicket.projectName && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {resolveTicket.projectName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">
                    From: {resolveTicket.clientName || resolveTicket.employeeName || resolveTicket.clientEmail || 'User'} • Category: {resolveTicket.category}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResolveTicket(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conversation Messages Stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Initial Description */}
              <div className="p-4 bg-canvas rounded-xl border border-border text-xs space-y-1.5">
                <div className="flex items-center justify-between font-semibold text-fg">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-accent" />
                    {resolveTicket.clientName || resolveTicket.employeeName || 'Creator'} (Initial Request)
                  </span>
                  <span className="text-[11px] text-slate-400">{formatDate(resolveTicket.createdAt)}</span>
                </div>
                <p className="text-fg whitespace-pre-wrap leading-relaxed">
                  {resolveTicket.description}
                </p>
              </div>

              {/* Replies */}
              {Array.isArray(resolveTicket.replies) && resolveTicket.replies.length > 0 ? (
                resolveTicket.replies.map((reply) => {
                  const isAdmin = reply.senderRole === 'admin'
                  const isClient = reply.senderRole === 'client'

                  return (
                    <div
                      key={reply.id}
                      className={`flex flex-col space-y-1 ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                        <span className="font-semibold text-fg">
                          {reply.senderName}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isAdmin
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                              : isClient
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          }`}
                        >
                          {isAdmin ? 'Admin' : isClient ? 'Client' : 'Project Engineer'}
                        </span>
                        <span>
                          {reply.createdAt
                            ? new Date(reply.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl max-w-lg text-xs leading-relaxed ${
                          isAdmin
                            ? 'bg-purple-600 text-white rounded-tr-none'
                            : 'bg-canvas text-fg border border-slate-200 dark:border-slate-700 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  No replies yet in this thread. You can post an admin reply below.
                </div>
              )}
            </div>

            {/* Admin Live Reply Form */}
            <form
              onSubmit={handleSendAdminReply}
              className="p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-border flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                placeholder="Type an admin reply (visible to client and project engineers)..."
                value={adminReplyText}
                onChange={(e) => setAdminReplyText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-xl bg-canvas border border-border text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!adminReplyText.trim() || sendingReply}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3.5 py-2 flex items-center gap-1 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingReply ? 'Sending...' : 'Reply'}</span>
              </Button>
            </form>

            {/* Official Resolution Note Accordion / Action */}
            <div className="p-3 bg-canvas/60 border-t border-slate-100 dark:border-border flex items-center justify-between gap-3 shrink-0">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Optional: Official resolution note for closing..."
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <Button
                type="button"
                onClick={handleSaveResolution}
                disabled={submittingResolution || !resolutionText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-1.5 flex items-center gap-1.5 shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{submittingResolution ? 'Saving...' : 'Mark Resolved'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* ─── Delete Confirmation Modal ──────────────────────────────────────── */}
      {deleteTicketItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Support Ticket?</h3>
              <p className="text-xs text-muted">
                Are you sure you want to delete <span className="font-semibold text-fg">"{deleteTicketItem.subject}"</span>?
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteTicketItem(null)}
                disabled={deleting}
                className="text-xs px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 flex items-center gap-1.5"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default HelpDeskManager
