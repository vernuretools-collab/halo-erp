import React, { useEffect, useMemo, useState } from 'react'
import { Bell, Building2, Check, Clock, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import {
  WEEKDAY_LABELS,
  addSocialPostReminder,
  deleteSocialPostReminder,
  formatTimeLabel,
  isPostedOn,
  isScheduledToday,
  localDateKey,
  markSocialPostUploaded,
  subscribeMySocialPostReminders,
  unmarkSocialPostUploaded,
  updateSocialPostReminder,
} from './services/socialPostRemindersService'

const EMPTY_FORM = {
  title: '',
  company: '',
  days: [1, 2, 3, 4, 5],
  time: '10:00',
  enabled: true,
}

const toggleDay = (days, day) => {
  const set = new Set(days.map(Number))
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set].sort((a, b) => a - b)
}

export const SocialPostRemindersPage = () => {
  const user = useUserStore((s) => s.user)
  const uid = user?.uid
  const todayKey = localDateKey()
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const unsub = subscribeMySocialPostReminders(
      uid,
      (rows) => {
        setReminders(rows)
        setLoading(false)
      },
      () => {
        setReminders([])
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  const todays = useMemo(
    () => reminders.filter((r) => r.enabled !== false && isScheduledToday(r)),
    [reminders]
  )
  const pendingToday = todays.filter((r) => !isPostedOn(r, todayKey))
  const uploadedToday = todays.filter((r) => isPostedOn(r, todayKey))

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (reminder) => {
    setEditingId(reminder.id)
    setForm({
      title: reminder.title || '',
      company: reminder.company || '',
      days: Array.isArray(reminder.days) ? reminder.days.map(Number) : [],
      time: reminder.time || '10:00',
      enabled: reminder.enabled !== false,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!uid || !form.title.trim() || !form.days.length || !form.time) return
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        company: form.company.trim(),
        days: form.days,
        time: form.time,
        enabled: form.enabled,
      }
      if (editingId) {
        await updateSocialPostReminder(uid, editingId, payload)
      } else {
        await addSocialPostReminder(uid, payload)
      }
      setFormOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      console.error('Failed to save post reminder', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reminderId) => {
    if (!uid || !window.confirm('Delete this post reminder?')) return
    await deleteSocialPostReminder(uid, reminderId)
  }

  const handleToggleEnabled = async (reminder) => {
    if (!uid) return
    await updateSocialPostReminder(uid, reminder.id, { enabled: reminder.enabled === false })
  }

  const handleToggleUploaded = async (reminder) => {
    if (!uid) return
    if (isPostedOn(reminder, todayKey)) {
      await unmarkSocialPostUploaded(uid, reminder, todayKey)
    } else {
      await markSocialPostUploaded(uid, reminder.id, todayKey)
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 relative">
      <PageHeader
        title="Post Reminders"
        description="Schedule social post times. You’ll get a ping 15 minutes before and again at the set time."
        actions={
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Add reminder
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-muted">Today pending</p>
          <p className="text-2xl font-bold text-fg mt-1">{pendingToday.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Uploaded today</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{uploadedToday.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">All reminders</p>
          <p className="text-2xl font-bold text-fg mt-1">{reminders.length}</p>
        </Card>
      </div>

      <h2 className="text-sm font-semibold text-fg mb-3">Today</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : todays.length === 0 ? (
        <Card className="p-8 text-center mb-8">
          <Upload className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Nothing scheduled for today. Add a reminder for this weekday.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          {todays
            .slice()
            .sort((a, b) => String(a.time).localeCompare(String(b.time)))
            .map((reminder) => {
              const posted = isPostedOn(reminder, todayKey)
              return (
                <Card key={reminder.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-fg truncate">{reminder.title}</h3>
                      {posted ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none">
                          Uploaded
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted mt-1 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTimeLabel(reminder.time)}
                      </span>
                      {reminder.company ? (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {reminder.company}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    variant={posted ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => handleToggleUploaded(reminder)}
                  >
                    {posted ? (
                      <>
                        <X className="w-3.5 h-3.5" /> Undo
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" /> Mark uploaded
                      </>
                    )}
                  </Button>
                </Card>
              )
            })}
        </div>
      )}

      <h2 className="text-sm font-semibold text-fg mb-3">All schedules</h2>
      {loading ? null : reminders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Bell className="w-8 h-8 text-muted mb-3" />
          <h3 className="text-lg font-medium text-fg mb-1">No post reminders yet</h3>
          <p className="text-sm text-muted mb-4">Set a title, days, and time so you don’t miss an upload.</p>
          <Button onClick={openCreate} size="sm">
            <Plus className="w-3.5 h-3.5" /> Add reminder
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reminders.map((reminder) => (
            <Card key={reminder.id} className="p-5 relative group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-fg truncate pr-8">{reminder.title}</h3>
                  {reminder.company ? <p className="text-sm text-muted mt-0.5">{reminder.company}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleEnabled(reminder)}
                  className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full ${
                    reminder.enabled === false
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-accent-soft text-accent'
                  }`}
                >
                  {reminder.enabled === false ? 'Off' : 'On'}
                </button>
              </div>
              <p className="text-sm text-fg flex items-center gap-1.5 mb-3">
                <Clock className="w-4 h-4 text-muted" />
                {formatTimeLabel(reminder.time)}
                <span className="text-muted">· 15 min early + at time</span>
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {WEEKDAY_LABELS.map((label, day) => {
                  const active = (reminder.days || []).map(Number).includes(day)
                  return (
                    <span
                      key={label}
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        active ? 'bg-accent text-white' : 'bg-chrome text-muted'
                      }`}
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(reminder)}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(reminder.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 dark:bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-border">
            <div className="p-6 flex justify-between items-center border-b border-border">
              <h2 className="text-lg font-semibold text-fg">{editingId ? 'Edit reminder' : 'Add reminder'}</h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
              <Input
                label="Title"
                required
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="e.g. Instagram reel"
              />
              <Input
                label="Company (optional)"
                value={form.company}
                onChange={(e) => setForm((s) => ({ ...s, company: e.target.value }))}
                placeholder="Client or brand name"
              />
              <Input
                label="Time"
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm((s) => ({ ...s, time: e.target.value }))}
              />
              <div>
                <p className="block text-xs font-medium text-fg mb-2">Days</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const active = form.days.includes(day)
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setForm((s) => ({ ...s, days: toggleDay(s.days, day) }))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-surface text-fg border-border hover:bg-chrome'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))}
                />
                Reminder enabled
              </label>
              <div className="mt-auto pt-6 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving || !form.title.trim() || !form.days.length}>
                  {saving ? 'Saving…' : editingId ? 'Save' : 'Add reminder'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
