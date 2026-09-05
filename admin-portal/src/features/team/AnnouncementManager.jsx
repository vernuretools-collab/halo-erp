import React, { useState, useEffect, useMemo } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useUserStore } from '../../stores/userStore'
import { TeamSubNav } from './components/TeamSubNav'
import {
  subscribeToAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
} from './services/announcementService'
import { alertLocalAnnouncement } from '../../shared/services/announcementBrowserAlert'
import {
  Megaphone,
  Pin,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Calendar,
  Info,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Eye,
  Bell,
} from 'lucide-react'

// ─── Priority Badges & Styles ────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  urgent: {
    label: 'Urgent',
    icon: Flame,
    badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
    cardBorder: 'border-rose-200 dark:border-rose-900/40',
    accentBg: 'bg-rose-50 dark:bg-rose-950/20',
  },
  info: {
    label: 'Info',
    icon: Info,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
    cardBorder: 'border-blue-200 dark:border-blue-900/40',
    accentBg: 'bg-blue-50 dark:bg-blue-950/20',
  },
  event: {
    label: 'Event',
    icon: Calendar,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    cardBorder: 'border-emerald-200 dark:border-emerald-900/40',
    accentBg: 'bg-emerald-50 dark:bg-emerald-950/20',
  },
}

const formatDate = (rawDate) => {
  if (!rawDate) return 'Just now'
  if (typeof rawDate?.toDate === 'function') {
    return rawDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (rawDate?.seconds) {
    return new Date(rawDate.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  const d = new Date(rawDate)
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const AnnouncementManager = () => {
  const { user } = useUserStore()
  const currentAuthorName = user?.displayName || user?.email || 'Admin'

  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  // Modal State (Create / Edit)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    priority: 'info',
    pinned: false,
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Delete Confirm State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Real-time listener
  useEffect(() => {
    const unsubscribe = subscribeToAnnouncements((data) => {
      setAnnouncements(data)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Metrics calculation
  const stats = useMemo(() => {
    const total = announcements.length
    const pinned = announcements.filter((a) => a.pinned).length
    const urgent = announcements.filter((a) => (a.priority || '').toLowerCase() === 'urgent').length
    const events = announcements.filter((a) => (a.priority || '').toLowerCase() === 'event').length
    return { total, pinned, urgent, events }
  }, [announcements])

  // Filtered & searched items
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const priority = (item.priority || 'info').toLowerCase()
      const title = (item.title || '').toLowerCase()
      const body = (item.body || '').toLowerCase()
      const author = (item.author || '').toLowerCase()
      const q = searchQuery.toLowerCase().trim()

      const matchesSearch = !q || title.includes(q) || body.includes(q) || author.includes(q)

      let matchesFilter = true
      if (selectedFilter === 'pinned') {
        matchesFilter = Boolean(item.pinned)
      } else if (selectedFilter !== 'all') {
        matchesFilter = priority === selectedFilter
      }

      return matchesSearch && matchesFilter
    })
  }, [announcements, searchQuery, selectedFilter])

  // Split into pinned and unpinned
  const displayItems = useMemo(() => {
    const pinned = filteredAnnouncements.filter((a) => a.pinned)
    const normal = filteredAnnouncements.filter((a) => !a.pinned)
    return [...pinned, ...normal]
  }, [filteredAnnouncements])

  // Open modal for new announcement
  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormData({
      title: '',
      body: '',
      priority: 'info',
      pinned: false,
    })
    setFormError('')
    setIsModalOpen(true)
  }

  // Open modal for editing existing announcement
  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormData({
      title: item.title || '',
      body: item.body || '',
      priority: item.priority || 'info',
      pinned: Boolean(item.pinned),
    })
    setFormError('')
    setIsModalOpen(true)
  }

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      setFormError('Please enter a title for the announcement.')
      return
    }
    if (!formData.body.trim()) {
      setFormError('Please write the announcement message.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingItem) {
        await updateAnnouncement(editingItem.id, {
          title: formData.title,
          body: formData.body,
          priority: formData.priority,
          pinned: formData.pinned,
        })
      } else {
        await createAnnouncement({
          title: formData.title,
          body: formData.body,
          priority: formData.priority,
          pinned: formData.pinned,
          author: currentAuthorName,
          authorId: user?.uid || null,
        })
        const preview = formData.body.length > 120 ? `${formData.body.slice(0, 120)}...` : formData.body
        await alertLocalAnnouncement({
          title: formData.title,
          body: preview,
          announcementId: `local-${Date.now()}`,
        })
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Failed to save announcement:', err)
      setFormError('An error occurred while saving. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Pin Toggle
  const handleTogglePin = async (item) => {
    try {
      await togglePinAnnouncement(item.id, Boolean(item.pinned))
    } catch (err) {
      console.error('Failed to toggle pin:', err)
    }
  }

  // Delete
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmItem) return
    setDeleting(true)
    try {
      await deleteAnnouncement(deleteConfirmItem.id)
      setDeleteConfirmItem(null)
    } catch (err) {
      console.error('Failed to delete announcement:', err)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Announcements"
        description="Broadcast official announcements, policy updates, and events directly to all employee dashboards."
        actions={
          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        }
      />

      {/* Team Module SubNav */}
      <TeamSubNav />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Total Broadcasts</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
              <Megaphone className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Pinned to Top</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pinned}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Pin className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Urgent Notices</p>
              <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{stats.urgent}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Flame className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-surface border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted">Company Events</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.events}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'All', count: stats.total },
            { key: 'pinned', label: 'Pinned', count: stats.pinned },
            { key: 'urgent', label: 'Urgent', count: stats.urgent },
            { key: 'info', label: 'Info', count: stats.total - stats.urgent - stats.events },
            { key: 'event', label: 'Events', count: stats.events },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                selectedFilter === tab.key
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-chrome text-fg border border-border hover:bg-surface'
              }`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedFilter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & New Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements..."
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
          <Button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs px-3 py-1.5 rounded-xl whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Main Feed Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 bg-surface border-border animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-16" />
                <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" />
              </div>
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full mb-2" />
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
            </Card>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <Card className="p-12 text-center bg-surface border-border">
          <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center text-accent mx-auto mb-4">
            <Megaphone className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {searchQuery || selectedFilter !== 'all' ? 'No matching announcements found' : 'No announcements published yet'}
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1.5">
            {searchQuery || selectedFilter !== 'all'
              ? 'Try changing your search term or filter options.'
              : 'Create your first announcement to keep your team informed about company updates, policies, and events.'}
          </p>
          {!searchQuery && selectedFilter === 'all' && (
            <Button
              onClick={handleOpenCreate}
              className="mt-5 bg-accent hover:bg-accent-hover text-white text-xs px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Create Announcement
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {displayItems.map((item) => {
            const priorityKey = (item.priority || 'info').toLowerCase()
            const config = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.info
            const Icon = config.icon

            return (
              <Card
                key={item.id}
                className={`p-6 transition-all duration-200 relative bg-surface hover:shadow-md border ${
                  item.pinned
                    ? 'border-amber-300 dark:border-amber-500/40 bg-gradient-to-r from-amber-500/[0.02] to-transparent'
                    : 'border-border'
                }`}
              >
                {/* Pinned Ribbon Badge */}
                {item.pinned && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[11px] font-semibold">
                    <Pin className="w-3 h-3 fill-amber-500" /> Pinned
                  </div>
                )}

                {/* Meta Header */}
                <div className="flex flex-wrap items-center gap-2.5 mb-3 pr-24">
                  <Badge className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 border ${config.badgeClass}`}>
                    <Icon className="w-3 h-3" />
                    {config.label.toUpperCase()}
                  </Badge>

                  <span className="text-xs text-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDate(item.createdAt)}
                  </span>

                  {item.author && (
                    <span className="text-xs text-muted font-medium">
                      by <span className="text-fg font-semibold">{item.author}</span>
                    </span>
                  )}
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 leading-snug">
                  {item.title}
                </h3>
                <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
                  {item.body}
                </p>

                {/* Actions Footer */}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-border/60">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTogglePin(item)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                        item.pinned
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={item.pinned ? 'Unpin from top' : 'Pin to top of employee feed'}
                    >
                      <Pin className={`w-3.5 h-3.5 ${item.pinned ? 'fill-amber-500' : ''}`} />
                      {item.pinned ? 'Unpin' : 'Pin to top'}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-muted hover:text-accent hover:bg-accent-soft rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteConfirmItem(item)}
                      className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ─── Create / Edit Modal ────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingItem ? 'Edit Announcement' : 'New Announcement'}
                  </h3>
                  <p className="text-xs text-muted">
                    Publish updates visible to all team members in the Employee Portal.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
                  Announcement Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Town Hall Meeting on Friday"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-canvas border border-border text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>

              {/* Priority Selector */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { key: 'info', label: 'Info', desc: 'General Updates', icon: Info, color: 'text-info', border: 'border-blue-500' },
                    { key: 'urgent', label: 'Urgent', desc: 'Critical Action', icon: Flame, color: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500' },
                    { key: 'event', label: 'Event', desc: 'Company Events', icon: Calendar, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500' },
                  ].map((p) => {
                    const Icon = p.icon
                    const isSelected = formData.priority === p.key
                    return (
                      <button
                        type="button"
                        key={p.key}
                        onClick={() => setFormData({ ...formData, priority: p.key })}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col items-start ${
                          isSelected
                            ? `bg-accent-soft ${p.border} ring-2 ring-accent/20`
                            : 'bg-canvas/60 border-border hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className={`w-3.5 h-3.5 ${p.color}`} />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{p.label}</span>
                        </div>
                        <span className="text-[10px] text-muted">{p.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Pin Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-canvas/50 border border-border">
                <div className="flex items-center gap-2">
                  <Pin className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-xs font-semibold text-fg">Pin to Top</p>
                    <p className="text-[10px] text-muted">Keep this announcement highlighted at the top of the employee portal</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.pinned}
                  onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                  className="w-4 h-4 text-accent rounded focus:ring-accent cursor-pointer"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-xs font-semibold text-fg mb-1.5">
                  Message Content <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Provide all details about the announcement, timings, guidelines, or links..."
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-canvas border border-border text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none leading-relaxed"
                />
              </div>

              {/* Live Preview */}
              {(formData.title || formData.body) && (
                <div className="p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/80 border border-border space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted uppercase tracking-wider">
                    <Eye className="w-3.5 h-3.5" /> Employee Preview
                  </div>
                  <div className="p-3 rounded-lg bg-surface border border-border shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge className={`text-[10px] font-bold px-2 py-0.2 border ${PRIORITY_CONFIG[formData.priority]?.badgeClass}`}>
                        {formData.priority.toUpperCase()}
                      </Badge>
                      {formData.pinned && (
                        <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5">
                          <Pin className="w-2.5 h-2.5 fill-amber-500" /> Pinned
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">Today • by {currentAuthorName}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1">{formData.title || 'Untitled'}</h4>
                    <p className="text-[11px] text-muted line-clamp-3 whitespace-pre-wrap">{formData.body}</p>
                  </div>
                </div>
              )}

              {/* Notification Notice */}
              {!editingItem && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-soft border border-accent/30 text-[11px] text-accent">
                  <Bell className="w-4 h-4 shrink-0 text-accent" />
                  <span>Publishing this announcement will instantly send a notification to all active employees.</span>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="text-xs px-4 py-2"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-accent hover:bg-accent-hover text-white text-xs px-5 py-2 flex items-center gap-1.5"
                >
                  {saving ? (
                    'Saving...'
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      {editingItem ? 'Update Announcement' : 'Publish Announcement'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ──────────────────────────────────────── */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-md p-5 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Announcement?</h3>
              <p className="text-xs text-muted">
                Are you sure you want to delete <span className="font-semibold text-fg">"{deleteConfirmItem.title}"</span>? This will immediately remove it from all employee portals.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmItem(null)}
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
export default AnnouncementManager
