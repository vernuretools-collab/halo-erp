import { create } from 'zustand'
import {
  fetchTimelineEntries,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  getWeekDates,
  toDateStr,
} from '../services/timelineService'
import {
  TIMELINE_OUTBOX_KEY,
  completeTimelineCreate,
  completeTimelineDelete,
  completeTimelineUpdate,
  createLocalTimelineEntry,
  emptyTimelineOutbox,
  mergeTimelineView,
  rememberTimelineCreate,
  rememberTimelineDelete,
  rememberTimelineUpdate,
} from '../../../../../shared/offlineQueue.js'

function readTimelineOutbox() {
  try {
    if (typeof localStorage === 'undefined') return emptyTimelineOutbox()
    const raw = localStorage.getItem(TIMELINE_OUTBOX_KEY)
    return raw ? JSON.parse(raw) : emptyTimelineOutbox()
  } catch {
    return emptyTimelineOutbox()
  }
}

function writeTimelineOutbox(queue) {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(TIMELINE_OUTBOX_KEY, JSON.stringify(queue))
  } catch {
    /* private mode */
  }
}

function sortTimelineEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.date !== b.date) return String(a.date).localeCompare(String(b.date))
    return String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
  })
}

function applyEntryPatch(entry, updates, pendingSync) {
  return {
    ...entry,
    ...updates,
    hours: updates.hours !== undefined ? Number(updates.hours) || 0 : entry.hours,
    entryType:
      updates.entryType !== undefined
        ? updates.entryType === 'upskilling'
          ? 'upskilling'
          : 'work'
        : entry.entryType || 'work',
    pendingSync,
  }
}

let flushingTimeline = false

export const useTimelineStore = create((set, get) => {
  async function flushTimelineOutbox() {
    if (flushingTimeline) return
    flushingTimeline = true
    try {
      for (const entry of [...readTimelineOutbox().creates]) {
        const created = await createTimelineEntry(entry)
        if (!created) continue
        writeTimelineOutbox(completeTimelineCreate(readTimelineOutbox(), entry.entryId))
        set((state) => ({
          entries: state.entries.map((row) =>
            row.entryId === entry.entryId ? { ...created, pendingSync: false } : row
          ),
        }))
      }
      for (const row of [...readTimelineOutbox().updates]) {
        const ok = await updateTimelineEntry(row.entryId, row.updates)
        if (!ok) continue
        writeTimelineOutbox(completeTimelineUpdate(readTimelineOutbox(), row.entryId))
        set((state) => ({
          entries: state.entries.map((entry) =>
            entry.entryId === row.entryId ? { ...entry, pendingSync: false } : entry
          ),
        }))
      }
      for (const entryId of [...readTimelineOutbox().deletes]) {
        const ok = await deleteTimelineEntry(entryId)
        if (!ok) continue
        writeTimelineOutbox(completeTimelineDelete(readTimelineOutbox(), entryId))
      }
    } finally {
      flushingTimeline = false
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      flushTimelineOutbox()
    })
  }

  return {
  weekAnchor: new Date(),
  entries: [],
  loading: false,
  error: null,

  setWeekAnchor: (date) => set({ weekAnchor: new Date(date) }),

  shiftWeek: (deltaWeeks) => {
    const current = new Date(get().weekAnchor)
    current.setDate(current.getDate() + deltaWeeks * 7)
    set({ weekAnchor: current })
  },

  getWeekDays: () => getWeekDates(get().weekAnchor),

  loadWeekEntries: async (uidOrIds) => {
    const ids = Array.isArray(uidOrIds) ? uidOrIds.filter(Boolean) : uidOrIds ? [uidOrIds] : []
    if (!ids.length) {
      set({ entries: [], loading: false })
      return
    }

    const days = getWeekDates(get().weekAnchor)
    const startDate = toDateStr(days[0])
    const endDate = toDateStr(days[days.length - 1])

    set({ loading: true, error: null })
    try {
      const fetched = await fetchTimelineEntries(ids, startDate, endDate)
      const entries = sortTimelineEntries(
        mergeTimelineView(fetched, readTimelineOutbox()).filter(
          (entry) => entry.date >= startDate && entry.date <= endDate
        )
      )
      set({ entries, loading: false })
      flushTimelineOutbox()
    } catch (err) {
      console.error('[timelineStore] loadWeekEntries error:', err)
      set({ loading: false, error: 'Failed to load timeline entries' })
    }
  },

  addEntry: async ({ uid, employeeName, date, description, hours, entryType }) => {
    const created = await createTimelineEntry({
      uid,
      employeeName,
      date,
      description,
      hours,
      entryType,
    })
    if (created) {
      set((state) => ({ entries: [...state.entries, created] }))
      return created
    }

    const local = createLocalTimelineEntry({
      uid,
      employeeName,
      date,
      description,
      hours,
      entryType,
    })
    writeTimelineOutbox(rememberTimelineCreate(readTimelineOutbox(), local))
    set((state) => ({ entries: [...state.entries, local] }))
    return local
  },

  editEntry: async (entryId, updates) => {
    const box = readTimelineOutbox()
    const isLocal = box.creates.some((row) => row.entryId === entryId)
    if (isLocal) {
      const current = get().entries.find((entry) => entry.entryId === entryId)
      writeTimelineOutbox(rememberTimelineUpdate(box, entryId, updates, current))
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.entryId === entryId ? applyEntryPatch(entry, updates, true) : entry
        ),
      }))
      return true
    }

    const ok = await updateTimelineEntry(entryId, updates)
    if (ok) {
      writeTimelineOutbox(completeTimelineUpdate(readTimelineOutbox(), entryId))
      set((state) => ({
        entries: state.entries.map((entry) =>
          entry.entryId === entryId ? applyEntryPatch(entry, updates, false) : entry
        ),
      }))
      return true
    }

    const current = get().entries.find((entry) => entry.entryId === entryId)
    writeTimelineOutbox(rememberTimelineUpdate(readTimelineOutbox(), entryId, updates, current))
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.entryId === entryId ? applyEntryPatch(entry, updates, true) : entry
      ),
    }))
    return true
  },

  removeEntry: async (entryId) => {
    const box = readTimelineOutbox()
    const isLocal = box.creates.some((row) => row.entryId === entryId)
    if (isLocal) {
      writeTimelineOutbox(rememberTimelineDelete(box, entryId))
      set((state) => ({
        entries: state.entries.filter((entry) => entry.entryId !== entryId),
      }))
      return true
    }

    const ok = await deleteTimelineEntry(entryId)
    if (!ok) {
      writeTimelineOutbox(rememberTimelineDelete(readTimelineOutbox(), entryId))
    } else {
      writeTimelineOutbox(completeTimelineDelete(readTimelineOutbox(), entryId))
    }
    set((state) => ({
      entries: state.entries.filter((entry) => entry.entryId !== entryId),
    }))
    return true
  },
  }
})
