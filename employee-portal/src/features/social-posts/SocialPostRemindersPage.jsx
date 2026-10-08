import React, { useEffect, useMemo, useState } from 'react'
import { Bell, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { collectUserIdentityIds } from '../projects/services/projectService'
import {
  CONTENT_TYPES,
  NOTIFY_BEFORE_OPTIONS,
  PLATFORMS,
  REPEAT_OPTIONS,
  STATUS_LABEL,
  WEEKDAY_LABELS,
  addSocialPostReminder,
  deleteSocialPostReminder,
  formatTimeLabel,
  isPostedOn,
  joinTime12,
  localDateKey,
  notifyBeforeLabel,
  notifyBeforeMinutes,
  occurrenceStatus,
  occursOn,
  repeatSummary,
  splitTime12,
  subscribeMySocialPostReminders,
  trailText,
  unmarkSocialPostPosted,
  updateSocialPostReminder,
  markSocialPostPosted,
} from './services/socialPostRemindersService'

const FIELD =
  'w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40'
const FILTER_FIELD =
  'shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/40'

const STATUS_CLASS = {
  pending: 'text-amber-700 dark:text-amber-400',
  missed: 'text-rose-600 dark:text-rose-400',
  posted: 'text-emerald-600 dark:text-emerald-400',
}

const emptyForm = (assigneeId = '') => ({
  clientId: '',
  platform: 'Instagram',
  contentType: 'Story',
  topic: '',
  startDate: localDateKey(),
  hour: '12',
  minute: '00',
  meridiem: 'PM',
  notifyBeforeMinutes: 15,
  repeat: 'none',
  days: [],
  endDate: '',
  caption: '',
  assigneeId,
  enabled: true,
})

const employeeName = (emp) => emp?.name || emp?.displayName || emp?.fullName || emp?.email || 'Employee'

const employeeIds = (emp) =>
  [emp?.docId, emp?.uid, emp?.id, emp?.employeeId, emp?.auth_id, emp?.authId].filter(Boolean).map(String)

const employeeMatches = (emp, identityIds) => {
  const ids = new Set(identityIds.map(String))
  return employeeIds(emp).some((value) => ids.has(value))
}

const findEmployee = (employees, id) => employees.find((emp) => employeeIds(emp).includes(String(id || ''))) || null

const clientLabel = (client, clients) => {
  const duplicates = clients.filter((item) => item.name === client.name).length > 1
  return duplicates && client.email ? `${client.name} (${client.email})` : client.name
}

const toggleDay = (days, day) => {
  const set = new Set(days.map(Number))
  if (set.has(day)) set.delete(day)
  else set.add(day)
  return [...set].sort((a, b) => a - b)
}

const Trail = ({ reminder, dateKey, now }) => {
  const status = dateKey ? occurrenceStatus(reminder, dateKey, now) : null
  const text = trailText(reminder, status)
  if (!status) return <p className="text-sm text-fg leading-relaxed">{text}</p>
  const label = STATUS_LABEL[status]
  const head = text.slice(0, text.length - label.length)
  return (
    <p className="text-sm text-fg leading-relaxed">
      {head}
      <span className={`font-semibold ${STATUS_CLASS[status]}`}>{label}</span>
    </p>
  )
}

export const SocialPostRemindersPage = () => {
  const user = useUserStore((s) => s.user)
  const userDoc = useUserStore((s) => s.userDoc)
  const identityIds = useMemo(() => collectUserIdentityIds(user, userDoc), [user, userDoc])
  const identityKey = identityIds.join('|')
  const [now, setNow] = useState(() => new Date())
  const todayKey = localDateKey(now)
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(() => emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [filterDate, setFilterDate] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('')

  const selfEmployee = useMemo(
    () => employees.find((emp) => employeeMatches(emp, identityIds)) || null,
    [employees, identityIds]
  )

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!identityKey) {
      setReminders([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    return subscribeMySocialPostReminders(
      identityIds,
      (rows) => {
        setReminders(rows)
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [identityKey])

  useEffect(() => {
    const fallbackId = selfEmployee?.docId || (!editingId ? user?.uid : '')
    if (!formOpen || editingId || form.assigneeId || !fallbackId) return
    setForm((current) => (current.assigneeId ? current : { ...current, assigneeId: fallbackId }))
  }, [formOpen, editingId, form.assigneeId, selfEmployee, user?.uid])

  useEffect(() => {
    if (!formOpen || !form.assigneeId || !employees.length) return
    const match = findEmployee(employees, form.assigneeId)
    if (match?.docId && match.docId !== form.assigneeId) {
      setForm((current) => ({ ...current, assigneeId: match.docId }))
    }
  }, [formOpen, form.assigneeId, employees])

  useEffect(() => {
    let cancelled = false
    getDocs(collection(db, 'employees'))
      .then((snap) => {
        if (cancelled) return
        const rows = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() || {}
            return {
              ...data,
              docId: docSnap.id,
              uid: data.uid || docSnap.id,
              employeeId: data.employeeId || docSnap.id,
            }
          })
          .sort((a, b) => employeeName(a).localeCompare(employeeName(b)))
        setEmployees(rows)
      })
      .catch((err) => console.error('Failed to load employees', err))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getDocs(query(collection(db, 'users'), where('role', '==', 'client')))
      .then((snap) => {
        if (cancelled) return
        const rows = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() || {}
            const name = String(data.companyName || data.displayName || data.name || data.email || '').trim()
            if (!name) return null
            return { id: docSnap.id, name, email: String(data.email || '').trim() }
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name))
        setClients(rows)
      })
      .catch((err) => console.error('Failed to load clients', err))
    return () => {
      cancelled = true
    }
  }, [])

  const todays = useMemo(
    () =>
      reminders
        .filter((reminder) => reminder.enabled !== false && occursOn(reminder, todayKey))
        .sort((a, b) => String(a.time).localeCompare(String(b.time))),
    [reminders, todayKey]
  )
  const pendingToday = todays.filter((reminder) => occurrenceStatus(reminder, todayKey, now) === 'pending')
  const postedToday = todays.filter((reminder) => occurrenceStatus(reminder, todayKey, now) === 'posted')
  const missedToday = todays.filter((reminder) => occurrenceStatus(reminder, todayKey, now) === 'missed')

  const clientOptions = useMemo(() => {
    const map = new Map()
    reminders.forEach((reminder) => {
      if (reminder.clientId) map.set(reminder.clientId, reminder.clientName || reminder.clientId)
    })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [reminders])

  const filteredSchedules = useMemo(() => {
    return reminders
      .filter((reminder) => {
        if (filterClient && reminder.clientId !== filterClient) return false
        if (filterPlatform && reminder.platform !== filterPlatform) return false
        if (filterDate && !occursOn(reminder, filterDate)) return false
        return true
      })
      .sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)) || String(a.time).localeCompare(String(b.time)))
  }, [reminders, filterClient, filterPlatform, filterDate])

  const openCreate = () => {
    setEditingId(null)
    setFormError('')
    setForm(emptyForm(selfEmployee?.docId || user?.uid || ''))
    setFormOpen(true)
  }

  const openEdit = (reminder) => {
    const clock = splitTime12(reminder.time)
    setEditingId(reminder.id)
    setFormError('')
    setForm({
      clientId: reminder.clientId || '',
      platform: reminder.platform || 'Instagram',
      contentType: reminder.contentType || 'Story',
      topic: reminder.topic || '',
      startDate: reminder.startDate || localDateKey(),
      hour: clock.hour,
      minute: clock.minute,
      meridiem: clock.meridiem,
      notifyBeforeMinutes: notifyBeforeMinutes(reminder),
      repeat: reminder.repeat || 'none',
      days: Array.isArray(reminder.days) ? reminder.days.map(Number) : [],
      endDate: reminder.endDate || '',
      caption: reminder.caption || '',
      assigneeId: findEmployee(employees, reminder.assigneeId)?.docId || reminder.assigneeId || '',
      enabled: reminder.enabled !== false,
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const time = joinTime12(form.hour, form.minute, form.meridiem)
    const client = clients.find((item) => item.id === form.clientId)
    const assignee = findEmployee(employees, form.assigneeId)
    const assigneeId = assignee?.docId || form.assigneeId
    const assigneeName = assignee
      ? employeeName(assignee)
      : form.assigneeId === user?.uid
        ? userDoc?.displayName || user?.displayName || 'Me'
        : ''
    if (!client || !form.topic.trim() || !form.startDate || !time || !assigneeId || !assigneeName) {
      setFormError('Client, topic, date, time, and assignee are required.')
      return
    }
    if (form.repeat === 'custom' && form.days.length === 0) {
      setFormError('Pick at least one day for a custom repeat.')
      return
    }
    if (form.repeat !== 'none' && form.endDate && form.endDate < form.startDate) {
      setFormError('End date must be on or after the start date.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        clientId: client.id,
        clientName: client.name,
        platform: form.platform,
        contentType: form.contentType,
        topic: form.topic.trim(),
        caption: form.caption.trim(),
        startDate: form.startDate,
        time,
        notifyBeforeMinutes: notifyBeforeMinutes(form),
        repeat: form.repeat,
        days: form.repeat === 'custom' ? form.days : [],
        endDate: form.repeat === 'none' ? '' : form.endDate,
        assigneeId,
        assigneeName,
        enabled: form.enabled,
      }
      if (editingId) {
        const previous = reminders.find((reminder) => reminder.id === editingId)
        const previousDays = [...(previous?.days || [])].map(Number).sort().join(',')
        const nextDays = [...payload.days].map(Number).sort().join(',')
        const sameAssignee =
          previous?.assigneeId === payload.assigneeId ||
          findEmployee(employees, previous?.assigneeId)?.docId === payload.assigneeId
        const scheduleChanged =
          !previous ||
          previous.time !== payload.time ||
          notifyBeforeMinutes(previous) !== payload.notifyBeforeMinutes ||
          previous.startDate !== payload.startDate ||
          (previous.repeat || 'none') !== payload.repeat ||
          (previous.endDate || '') !== (payload.endDate || '') ||
          previousDays !== nextDays ||
          !sameAssignee
        if (scheduleChanged) {
          payload.lastEarlyAt = ''
          payload.lastDueAt = ''
        }
      }
      if (editingId) {
        await updateSocialPostReminder(editingId, payload)
      } else {
        await addSocialPostReminder({
          ...payload,
          createdBy: user?.uid || identityIds[0] || '',
        })
      }
      setFormOpen(false)
      setEditingId(null)
    } catch (err) {
      console.error('Failed to save post reminder', err)
      setFormError('Could not save this reminder.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (reminderId) => {
    if (!window.confirm('Delete this post reminder?')) return
    await deleteSocialPostReminder(reminderId)
  }

  const handleToggleEnabled = async (reminder) => {
    await updateSocialPostReminder(reminder.id, { enabled: reminder.enabled === false })
  }

  const handleTogglePosted = async (reminder, dateKey) => {
    if (isPostedOn(reminder, dateKey)) {
      await unmarkSocialPostPosted(reminder, dateKey)
    } else {
      await markSocialPostPosted(reminder.id, dateKey)
    }
  }

  const hours = Array.from({ length: 12 }, (_, index) => String(index + 1))
  const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

  return (
    <div className="max-w-5xl mx-auto pb-12 relative">
      <PageHeader
        title="Post Reminders"
        description="The assigned social media manager is pinged 15 minutes before the scheduled time and again at that time."
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
          <p className="text-sm text-muted">Posted today</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{postedToday.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Missed today</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{missedToday.length}</p>
        </Card>
      </div>

      <h2 className="text-sm font-semibold text-fg mb-3">Today</h2>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : todays.length === 0 ? (
        <Card className="p-8 text-center mb-8">
          <Bell className="w-8 h-8 text-muted mx-auto mb-2" />
          <p className="text-sm text-muted">Nothing scheduled for today.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-8">
          {todays.map((reminder) => {
            const posted = isPostedOn(reminder, todayKey)
            return (
              <Card key={reminder.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Trail reminder={reminder} dateKey={todayKey} now={now} />
                  {reminder.caption ? <p className="text-xs text-muted mt-1">{reminder.caption}</p> : null}
                </div>
                <Button
                  variant={posted ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => handleTogglePosted(reminder, todayKey)}
                >
                  {posted ? (
                    <>
                      <X className="w-3.5 h-3.5" /> Undo
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Mark as Posted
                    </>
                  )}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex flex-row items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-fg shrink-0">All schedules</h2>
        <div className="flex flex-row flex-nowrap items-center gap-2">
          <input
            type="date"
            aria-label="Filter by date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={`${FILTER_FIELD} w-[9.75rem]`}
          />
          {filterDate ? (
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setFilterDate('')}>
              Clear date
            </Button>
          ) : null}
          <select
            aria-label="Filter by client"
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className={`${FILTER_FIELD} w-[11rem]`}
          >
            <option value="">All clients</option>
            {clientOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by platform"
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className={`${FILTER_FIELD} w-[10.5rem]`}
          >
            <option value="">All platforms</option>
            {PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? null : filteredSchedules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Bell className="w-8 h-8 text-muted mb-3" />
          <h3 className="text-lg font-medium text-fg mb-1">
            {reminders.length === 0 ? 'No post reminders yet' : 'No schedules match these filters'}
          </h3>
          <p className="text-sm text-muted mb-4">
            {reminders.length === 0
              ? 'Add a client, platform, and time for the social media manager.'
              : 'Try another date, client, or platform.'}
          </p>
          {reminders.length === 0 ? (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-3.5 h-3.5" /> Add reminder
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSchedules.map((reminder) => {
            const posted = filterDate ? isPostedOn(reminder, filterDate) : false
            return (
              <Card key={reminder.id} className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    {filterDate ? (
                      <Trail reminder={reminder} dateKey={filterDate} now={now} />
                    ) : (
                      <p className="text-sm text-fg leading-relaxed">{trailText(reminder)}</p>
                    )}
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
                <p className="text-sm text-muted mb-1">
                  {repeatSummary(reminder)}
                  {reminder.endDate ? ` · until ${reminder.endDate}` : ''}
                  {' · '}
                  {formatTimeLabel(reminder.time)}
                  {' · '}
                  {notifyBeforeLabel(reminder)}
                </p>
                {!filterDate && reminder.repeat === 'custom' ? (
                  <div className="flex flex-wrap gap-1.5 mb-3">
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
                ) : (
                  <div className="mb-3" />
                )}
                {reminder.caption ? <p className="text-xs text-muted mb-3">{reminder.caption}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {filterDate ? (
                    <Button
                      variant={posted ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleTogglePosted(reminder, filterDate)}
                    >
                      {posted ? (
                        <>
                          <X className="w-3.5 h-3.5" /> Undo
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" /> Mark as Posted
                        </>
                      )}
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => openEdit(reminder)}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(reminder.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20 dark:bg-black/40 backdrop-blur-sm"
          onMouseDown={() => setFormOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface h-full shadow-2xl flex flex-col border-l border-border"
            onMouseDown={(event) => event.stopPropagation()}
          >
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
              <label className="block text-xs font-medium text-fg">
                Client
                <select
                  required
                  value={form.clientId}
                  onChange={(e) => setForm((s) => ({ ...s, clientId: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                >
                  <option value="">Select a client</option>
                  {form.clientId && !clients.some((client) => client.id === form.clientId) ? (
                    <option value={form.clientId}>
                      {reminders.find((reminder) => reminder.id === editingId)?.clientName || 'Current client'}
                    </option>
                  ) : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {clientLabel(client, clients)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-fg">
                Platform
                <select
                  required
                  value={form.platform}
                  onChange={(e) => setForm((s) => ({ ...s, platform: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                >
                  {PLATFORMS.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-fg">
                Content type
                <select
                  required
                  value={form.contentType}
                  onChange={(e) => setForm((s) => ({ ...s, contentType: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                >
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Content topic"
                required
                value={form.topic}
                onChange={(e) => setForm((s) => ({ ...s, topic: e.target.value }))}
                placeholder="e.g. Client Spotlight"
              />
              <Input
                label="Date"
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((s) => ({ ...s, startDate: e.target.value }))}
              />
              <div>
                <p className="block text-xs font-medium text-fg mb-1.5">Time</p>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    aria-label="Hour"
                    value={form.hour}
                    onChange={(e) => setForm((s) => ({ ...s, hour: e.target.value }))}
                    className={FIELD}
                  >
                    {hours.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Minute"
                    value={form.minute}
                    onChange={(e) => setForm((s) => ({ ...s, minute: e.target.value }))}
                    className={FIELD}
                  >
                    {minutes.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="AM or PM"
                    value={form.meridiem}
                    onChange={(e) => setForm((s) => ({ ...s, meridiem: e.target.value }))}
                    className={FIELD}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              <label className="block text-xs font-medium text-fg">
                Notify before
                <select
                  value={String(form.notifyBeforeMinutes)}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, notifyBeforeMinutes: Number(e.target.value) }))
                  }
                  className={`${FIELD} mt-1.5`}
                >
                  {NOTIFY_BEFORE_OPTIONS.map((option) => (
                    <option key={option.minutes} value={option.minutes}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-fg">
                Repeats
                <select
                  value={form.repeat}
                  onChange={(e) => setForm((s) => ({ ...s, repeat: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                >
                  {REPEAT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {form.repeat === 'weekly' ? (
                <p className="text-xs text-muted -mt-2">Weekly follows the weekday of the start date.</p>
              ) : null}
              {form.repeat === 'custom' ? (
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
              ) : null}
              {form.repeat !== 'none' ? (
                <Input
                  label="End date (optional)"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((s) => ({ ...s, endDate: e.target.value }))}
                />
              ) : null}
              <label className="block text-xs font-medium text-fg">
                Caption / notes
                <textarea
                  value={form.caption}
                  onChange={(e) => setForm((s) => ({ ...s, caption: e.target.value }))}
                  rows={3}
                  className={`${FIELD} mt-1.5`}
                  placeholder="Optional"
                />
              </label>
              <label className="block text-xs font-medium text-fg">
                Assigned social media manager
                <select
                  required
                  value={findEmployee(employees, form.assigneeId)?.docId || form.assigneeId}
                  onChange={(e) => setForm((s) => ({ ...s, assigneeId: e.target.value }))}
                  className={`${FIELD} mt-1.5`}
                >
                  <option value="">Select an employee</option>
                  {!selfEmployee && user?.uid ? (
                    <option value={user.uid}>{userDoc?.displayName || user?.displayName || 'Me'}</option>
                  ) : null}
                  {employees.map((emp) => (
                    <option key={emp.docId} value={emp.docId}>
                      {employeeName(emp)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))}
                />
                Reminder enabled
              </label>
              {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
              <div className="mt-auto pt-6 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={saving || !form.topic.trim() || !form.clientId || !form.assigneeId || !form.startDate}
                >
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
