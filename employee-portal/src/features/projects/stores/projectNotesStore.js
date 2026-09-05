import { create } from 'zustand'
import {
  createNoteInDb,
  deleteNoteFromDb,
  getNotesByProject,
  updateNoteInDb,
} from '../services/projectNotesService'

export const useProjectNotesStore = create((set, get) => ({
  notes: [],
  loading: false,
  error: null,
  currentProjectId: null,

  fetchNotes: async (projectId, projectName = '') => {
    if (!projectId && !projectName) {
      set({ notes: [], loading: false, currentProjectId: null })
      return
    }
    set({ loading: true, error: null, currentProjectId: projectId })
    try {
      const notes = await getNotesByProject(projectId, projectName)
      set({ notes, loading: false })
    } catch (err) {
      console.error('[projectNotesStore] fetchNotes error:', err)
      set({ loading: false, error: 'Failed to load notes' })
    }
  },

  addNote: async (noteData) => {
    try {
      const created = await createNoteInDb(noteData)
      set((state) => ({ notes: [...state.notes, created] }))
      return created
    } catch (err) {
      console.error('[projectNotesStore] addNote error:', err)
      return null
    }
  },

  updateNote: async (noteId, updates) => {
    const previous = get().notes.find((n) => n.noteId === noteId)
    set((state) => ({
      notes: state.notes.map((n) =>
        n.noteId === noteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
      ),
    }))
    try {
      const ok = await updateNoteInDb(noteId, updates)
      if (!ok && previous) {
        set((state) => ({
          notes: state.notes.map((n) => (n.noteId === noteId ? previous : n)),
        }))
      }
      return ok
    } catch (err) {
      console.error('[projectNotesStore] updateNote error:', err)
      if (previous) {
        set((state) => ({
          notes: state.notes.map((n) => (n.noteId === noteId ? previous : n)),
        }))
      }
      return false
    }
  },

  removeNote: async (noteId) => {
    try {
      await deleteNoteFromDb(noteId)
      set((state) => ({ notes: state.notes.filter((n) => n.noteId !== noteId) }))
      return true
    } catch (err) {
      console.error('[projectNotesStore] removeNote error:', err)
      return false
    }
  },

  cycleStatus: async (noteId) => {
    const note = get().notes.find((n) => n.noteId === noteId)
    if (!note) return false
    const order = ['red', 'yellow', 'green']
    const current = order.includes(note.status) ? note.status : 'red'
    const next = order[(order.indexOf(current) + 1) % order.length]
    return get().updateNote(noteId, { status: next })
  },
}))
