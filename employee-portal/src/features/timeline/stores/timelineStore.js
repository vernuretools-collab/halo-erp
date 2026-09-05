import { create } from 'zustand'
import {
  fetchTimelineEntries,
  createTimelineEntry,
  updateTimelineEntry,
  deleteTimelineEntry,
  getWeekDates,
  toDateStr,
} from '../services/timelineService'

export const useTimelineStore = create((set, get) => ({
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
      const entries = await fetchTimelineEntries(ids, startDate, endDate)
      set({ entries, loading: false })
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
    if (!created) return null

    set((state) => ({ entries: [...state.entries, created] }))
    return created
  },

  editEntry: async (entryId, updates) => {
    const ok = await updateTimelineEntry(entryId, updates)
    if (!ok) return false

    set((state) => ({
      entries: state.entries.map((e) =>
        e.entryId === entryId
          ? {
              ...e,
              ...updates,
              hours: updates.hours !== undefined ? Number(updates.hours) || 0 : e.hours,
              entryType:
                updates.entryType !== undefined
                  ? updates.entryType === 'upskilling'
                    ? 'upskilling'
                    : 'work'
                  : e.entryType || 'work',
            }
          : e
      ),
    }))
    return true
  },

  removeEntry: async (entryId) => {
    const ok = await deleteTimelineEntry(entryId)
    if (!ok) return false

    set((state) => ({
      entries: state.entries.filter((e) => e.entryId !== entryId),
    }))
    return true
  },
}))
