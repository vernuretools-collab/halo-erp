import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useUserStore } from '../../stores/userStore'
import {
  addWorkReminder,
  deleteWorkReminder,
  getMyWorkReminders,
  updateWorkReminder,
} from './workRemindersService'

const fieldClass =
  'min-w-0 flex-1 bg-chrome border border-border text-xs text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-accent placeholder:text-slate-500'

export const WorkRemindersPanel = () => {
  const user = useUserStore((s) => s.user)
  const uid = user?.uid
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const removedIds = useRef(new Set())

  useEffect(() => {
    if (!uid) {
      setNotes([])
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    getMyWorkReminders(uid)
      .then((rows) => {
        if (cancelled) return
        setNotes((current) => {
          const saved = rows.filter((row) => !removedIds.current.has(row.id))
          const pending = current.filter((row) => String(row.id).startsWith('local_'))
          const pendingLeft = pending.filter((row) => !saved.some((item) => item.title === row.title && item.body === row.body))
          return [...pendingLeft, ...saved]
        })
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load work reminders', err)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  const openCount = useMemo(() => notes.filter((note) => !note.done).length, [notes])

  const handleAdd = async () => {
    const nextTitle = title.trim()
    const nextBody = body.trim()
    if (!uid || !nextTitle) return
    const tempId = `local_${Date.now()}`
    setSaving(true)
    setAddError('')
    setTitle('')
    setBody('')
    setNotes((current) => [
      { id: tempId, title: nextTitle, body: nextBody, remindOn: '', done: false },
      ...current,
    ])
    try {
      const created = await addWorkReminder(uid, { title: nextTitle, body: nextBody, remindOn: '' })
      setNotes((current) =>
        current.map((note) => (note.id === tempId ? { ...note, id: created?.id || tempId } : note))
      )
    } catch (err) {
      console.error('Failed to add work reminder', err)
      setNotes((current) => current.filter((note) => note.id !== tempId))
      setTitle(nextTitle)
      setBody(nextBody)
      setAddError('Could not save this reminder. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!uid || !pendingDelete || deleting) return
    const note = pendingDelete
    const id = note.id
    setDeleting(true)
    setDeleteError('')
    removedIds.current.add(id)
    setNotes((current) => current.filter((item) => item.id !== id))
    try {
      await deleteWorkReminder(uid, id)
      setPendingDelete(null)
    } catch (err) {
      console.error('Failed to delete work reminder', err)
      removedIds.current.delete(id)
      setNotes((current) => (current.some((item) => item.id === id) ? current : [note, ...current]))
      setDeleteError('Could not delete this reminder. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="p-0 overflow-hidden min-w-0 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 className="text-sm font-bold text-fg">My reminders</h2>
        <span className="text-xs font-medium text-muted">{openCount} open</span>
      </div>

      <form
        className="flex items-center gap-2 px-4 pb-3"
        onSubmit={(e) => {
          e.preventDefault()
          handleAdd()
        }}
      >
        <input
          className={fieldClass}
          value={title}
          placeholder="Title"
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={fieldClass}
          value={body}
          placeholder="What to do next"
          onChange={(e) => setBody(e.target.value)}
        />
        <Button icon={Plus} size="sm" type="submit" disabled={saving || !title.trim()}>
          Add
        </Button>
      </form>
      {addError ? <p className="px-4 pb-2 text-xs text-rose-400">{addError}</p> : null}

      {loading ? (
        <div className="py-10 text-center text-slate-500 border-t border-border flex-1">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent" />
        </div>
      ) : notes.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-slate-400 border-t border-border flex-1">
          No reminders yet. Add what you need to pick up next.
        </p>
      ) : (
        <ul className="border-t border-border flex-1">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 ${
                note.done ? 'opacity-60' : ''
              }`}
            >
              <button
                type="button"
                title={note.done ? 'Mark as open' : 'Mark as done'}
                onClick={() => updateWorkReminder(uid, note.id, { done: !note.done })}
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 cursor-pointer border ${
                  note.done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-500 text-transparent hover:border-slate-300'
                }`}
              >
                <Check className="w-3 h-3" strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold text-fg ${note.done ? 'line-through' : ''}`}>
                  {note.title}
                </p>
                {note.body ? <p className="text-xs text-muted mt-0.5">{note.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDeleteError('')
                  setPendingDelete(note)
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                title="Delete reminder"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this note?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" type="button" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" type="button" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {pendingDelete?.title?.trim()
            ? `"${pendingDelete.title.trim()}" will be removed from your reminders.`
            : 'This reminder will be removed.'}
        </p>
        {deleteError ? <p className="text-xs text-rose-400 mt-2">{deleteError}</p> : null}
      </Modal>
    </Card>
  )
}
