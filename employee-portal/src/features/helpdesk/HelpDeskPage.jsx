import React, { useState, useEffect, useRef } from 'react'
import {
  LifeBuoy,
  X,
  Folder,
  User,
  MessageSquare,
  Send,
  Building2,
  Check,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { PageHeader } from '../../components/layout/PageHeader'
import { useUserStore } from '../../stores/userStore'
import {
  subscribeEmployeeHelpDesk,
  addTicketReply,
  updateTicketStatus,
} from './services/helpDeskService'

export const HelpDeskPage = () => {
  const { user, userDoc } = useUserStore()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedTicket, setSelectedTicket] = useState(null)

  // Reply Form State
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (!user?.uid) return
    const unsubscribe = subscribeEmployeeHelpDesk(user, userDoc, (data) => {
      setTickets(data)
      setLoading(false)

      if (selectedTicket) {
        const updated = data.find((t) => t.id === selectedTicket.id)
        if (updated) setSelectedTicket(updated)
      }
    })
    return () => unsubscribe()
  }, [user, userDoc, selectedTicket?.id])

  useEffect(() => {
    if (selectedTicket) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedTicket?.replies?.length])

  const clientTickets = tickets.filter((t) => !!(t.clientId || t.clientEmail || t.projectName))
  const activePool = clientTickets

  const filteredTickets = activePool.filter((ticket) => {
    const status = (ticket.status || 'open').toLowerCase()
    if (statusFilter === 'All') return true
    if (statusFilter === 'Open') return status === 'open'
    if (statusFilter === 'In Progress') return status === 'in_progress'
    if (statusFilter === 'Resolved') return status === 'resolved' || status === 'closed'
    return true
  })

  const handleSendReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim() || !selectedTicket || !user) return

    setSendingReply(true)
    try {
      await addTicketReply(selectedTicket.id, {
        senderId: user.uid,
        senderName: userDoc?.displayName || user.displayName || 'Project Engineer',
        senderRole: 'employee',
        message: replyText.trim(),
      })
      setReplyText('')
    } catch (err) {
      alert('Failed to post reply: ' + err.message)
    } finally {
      setSendingReply(false)
    }
  }

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateTicketStatus(ticketId, newStatus)
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket((prev) => ({ ...prev, status: newStatus }))
      }
    } catch (err) {
      console.error('Failed to change status:', err)
    }
  }

  const getPriorityColor = (prio) => {
    const p = (prio || 'medium').toLowerCase()
    switch (p) {
      case 'urgent':
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      case 'normal':
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    }
  }

  const getStatusBadge = (status = 'open') => {
    const s = status.toLowerCase()
    if (s === 'resolved' || s === 'closed') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          Resolved
        </span>
      )
    }
    if (s === 'in_progress') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent">
          In Progress
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent">
        Open
      </span>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Client Support"
        description="Support tickets from clients on your projects. Reply and update status from here."
      />

      {/* Filter Tabs */}
      <div className="flex space-x-1 bg-chrome/50 p-1 rounded-xl w-fit">
        {['All', 'Open', 'In Progress', 'Resolved'].map((tab) => {
          const count =
            tab === 'All'
              ? activePool.length
              : activePool.filter((t) => {
                  const s = (t.status || 'open').toLowerCase()
                  if (tab === 'Open') return s === 'open'
                  if (tab === 'In Progress') return s === 'in_progress'
                  if (tab === 'Resolved') return s === 'resolved' || s === 'closed'
                  return true
                }).length

          return (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                statusFilter === tab
                  ? 'bg-surface text-fg shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span>{tab}</span>
              <span className="bg-slate-200 dark:bg-slate-700 text-fg py-0.2 px-1.5 rounded-full text-[10px]">
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Ticket List */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card className="p-12 text-center text-muted border-dashed space-y-2">
          <LifeBuoy className="w-10 h-10 mx-auto text-slate-400" />
          <h4 className="text-sm font-bold text-fg">
            No client tickets yet
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Support tickets created by clients for your assigned projects will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTickets.map((ticket) => {
            const repliesCount = Array.isArray(ticket.replies) ? ticket.replies.length : 0
            const clientName = ticket.clientName || ticket.clientEmail || 'Client'

            return (
              <Card
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="p-5 flex flex-col justify-between hover:shadow-xs hover:border-accent/40 transition-all cursor-pointer bg-surface border-border rounded-2xl"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {ticket.projectName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent-soft text-accent">
                            <Folder className="w-3 h-3" />
                            {ticket.projectName}
                          </span>
                        )}
                        {ticket.clientName && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-chrome text-fg">
                            <Building2 className="w-3 h-3" />
                            {clientName}
                          </span>
                        )}
                        {getStatusBadge(ticket.status)}
                      </div>

                      <h4 className="font-bold text-sm text-fg truncate">
                        {ticket.subject}
                      </h4>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize shrink-0 ${getPriorityColor(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority || 'Medium'}
                    </span>
                  </div>

                  {ticket.description && (
                    <p className="text-xs text-muted line-clamp-2">
                      {ticket.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <span className="text-[11px] text-slate-400">
                    Category: {ticket.category || 'General'}
                  </span>

                  <div className="flex items-center gap-2">
                    {repliesCount > 0 && (
                      <span className="text-accent text-xs font-semibold flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {repliesCount}
                      </span>
                    )}
                    <button className="px-2.5 py-1 rounded-lg bg-accent-soft text-accent text-xs font-semibold hover:bg-accent-soft transition-colors">
                      Open Discussion
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Interactive Ticket Discussion Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-2xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base text-fg">
                    {selectedTicket.subject}
                  </span>
                  {getStatusBadge(selectedTicket.status)}
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize ${getPriorityColor(
                      selectedTicket.priority
                    )}`}
                  >
                    {selectedTicket.priority || 'Medium'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  {selectedTicket.projectName && (
                    <span className="font-semibold text-accent">
                      {selectedTicket.projectName}
                    </span>
                  )}
                  <span>• Client: {selectedTicket.clientName || selectedTicket.clientEmail || 'Client'}</span>
                  <span>• Category: {selectedTicket.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Status Toggle buttons */}
                {selectedTicket.status !== 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'in_progress')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-accent-soft text-accent hover:bg-accent-soft transition-colors cursor-pointer"
                  >
                    Mark In Progress
                  </button>
                )}
                {selectedTicket.status !== 'resolved' && (
                  <button
                    onClick={() => handleStatusChange(selectedTicket.id, 'resolved')}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Resolve</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-chrome cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation Stream */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Original Request Box */}
              <div className="p-4 rounded-xl bg-chrome/60 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-fg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[10px]">
                      <User className="w-3 h-3" />
                    </div>
                    <span>{selectedTicket.clientName || selectedTicket.employeeName || 'Creator'}</span>
                    <span className="text-[10px] text-accent bg-accent-soft px-1.5 py-0.5 rounded">
                      Initial Request
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedTicket.date || 'Recent'}
                  </span>
                </div>
                <p className="text-xs text-fg whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Replies */}
              {Array.isArray(selectedTicket.replies) && selectedTicket.replies.length > 0 ? (
                selectedTicket.replies.map((reply) => {
                  const isMe = reply.senderId === user.uid
                  const isAdmin = reply.senderRole === 'admin'
                  const isClient = reply.senderRole === 'client'

                  return (
                    <div
                      key={reply.id}
                      className={`flex flex-col space-y-1 ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-1">
                        <span className="font-semibold text-fg">
                          {isMe ? 'You' : reply.senderName}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isAdmin
                              ? 'bg-accent-soft text-accent'
                              : isClient
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                              : 'bg-accent-soft text-accent'
                          }`}
                        >
                          {isAdmin ? 'Admin' : isClient ? 'Client' : 'Team Member'}
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
                          isMe
                            ? 'bg-accent text-white rounded-tr-none'
                            : 'bg-surface text-fg border border-border rounded-tl-none shadow-2xs'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{reply.message}</p>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No replies in this thread yet. Type your answer below to reply directly to the client and admins.
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <form
              onSubmit={handleSendReply}
              className="p-3 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 shrink-0"
            >
              <Input
                placeholder="Type your response to the client..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 text-xs"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!replyText.trim() || sendingReply}
                icon={Send}
                className="bg-accent hover:bg-accent-hover text-white shrink-0 cursor-pointer"
              >
                {sendingReply ? 'Sending...' : 'Reply'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
