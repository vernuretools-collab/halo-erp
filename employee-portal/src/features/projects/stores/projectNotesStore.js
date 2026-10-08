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
  notesByProject: {},

  fetchNotes: async (projectId, projectName = '') => {
    if (!projectId && !projectName) {
      set({ notes: [], loading: false, currentProjectId: null })
      return
    }
    const cached = projectId ? get().notesByProject[projectId] : null
    set({
      loading: !cached,
      error: null,
      currentProjectId: projectId,
      notes: cached || [],
    })
    try {
      const notes = await getNotesByProject(projectId, projectName)
      if (get().currentProjectId !== projectId) return notes
      set((state) => ({
        notes,
        loading: false,
        notesByProject: projectId ? { ...state.notesByProject, [projectId]: notes } : state.notesByProject,
      }))
      return notes
    } catch (err) {
      console.error('[projectNotesStore] fetchNotes error:', err)
      if (get().currentProjectId === projectId) set({ loading: false, error: 'Failed to load notes' })
      return []
    }
  },

  addNote: async (noteData) => {
    const noteId = noteData.noteId || `note_${Date.now()}`
    const now = new Date().toISOString()
    const optimistic = {
      noteId,
      id: noteId,
      projectId: noteData.projectId || '',
      projectName: noteData.projectName || '',
      title: noteData.title || '',
      description: noteData.description || '',
      status: noteData.status || 'red',
      priority: noteData.priority || 'medium',
      createdBy: noteData.createdBy || null,
      createdByName: noteData.createdByName || '',
      createdByEmail: noteData.createdByEmail || '',
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({ notes: [...state.notes, optimistic] }))
    try {
      const created = await createNoteInDb({ ...noteData, noteId })
      set((state) => {
        const notes = state.notes.map((n) => (n.noteId === noteId ? created : n))
        const projectId = created.projectId
        return {
          notes,
          notesByProject: projectId
            ? { ...state.notesByProject, [projectId]: notes.filter((n) => n.projectId === projectId) }
            : state.notesByProject,
        }
      })
      return created
    } catch (err) {
      console.error('[projectNotesStore] addNote error:', err)
      set((state) => ({ notes: state.notes.filter((n) => n.noteId !== noteId) }))
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
      set((state) => {
        const notes = state.notes.filter((n) => n.noteId !== noteId)
        const projectId = state.currentProjectId
        return {
          notes,
          notesByProject: projectId ? { ...state.notesByProject, [projectId]: notes } : state.notesByProject,
        }
      })
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
