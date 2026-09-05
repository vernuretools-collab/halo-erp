import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const COLLECTION = 'projectNotes'

const toIso = (value) => {
  if (!value) return null
  if (typeof value === 'string') return value
  if (value.toDate) return value.toDate().toISOString()
  return null
}

const STATUS_VALUES = ['red', 'yellow', 'green']

export const normalizeStatus = (data = {}) => {
  if (STATUS_VALUES.includes(data.status)) return data.status
  if (data.completed === true) return 'green'
  const checklist = Array.isArray(data.checklist) ? data.checklist : []
  if (checklist.length > 0 && checklist.every((item) => item.completed)) return 'green'
  return 'red'
}

export const normalizeNote = (id, data = {}) => ({
  noteId: id,
  id,
  projectId: data.projectId || '',
  projectName: data.projectName || '',
  title: data.title || '',
  description: data.description || '',
  status: normalizeStatus(data),
  priority: data.priority === 'high' || data.priority === 'low' ? data.priority : 'medium',
  createdBy: data.createdBy || null,
  createdByName: data.createdByName || '',
  createdByEmail: data.createdByEmail || '',
  createdAt: toIso(data.createdAt) || data.createdAt || null,
  updatedAt: toIso(data.updatedAt) || data.updatedAt || null,
})

export const getNotesByProject = async (projectId, projectName = '') => {
  if (!projectId && !projectName) return []
  const snap = await getDocs(collection(db, COLLECTION))
  const notes = snap.docs
    .map((d) => normalizeNote(d.id, d.data()))
    .filter((n) => {
      const noteProjectId = String(n.projectId || '')
      const targetId = String(projectId || '')
      if (targetId && (noteProjectId === targetId || n.id === targetId)) return true
      if (
        projectName &&
        n.projectName &&
        String(n.projectName).trim().toLowerCase() === String(projectName).trim().toLowerCase()
      ) {
        return true
      }
      return false
    })
  notes.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  return notes
}

export const createNoteInDb = async (noteData) => {
  const noteId = noteData.noteId || `note_${Date.now()}`
  const now = new Date().toISOString()
  const payload = {
    noteId,
    projectId: noteData.projectId,
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
  await setDoc(doc(db, COLLECTION, noteId), payload)
  return normalizeNote(noteId, payload)
}

export const updateNoteInDb = async (noteId, updates) => {
  if (!noteId) return false
  const payload = {
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  await updateDoc(doc(db, COLLECTION, noteId), payload)
  return true
}

export const deleteNoteFromDb = async (noteId) => {
  if (!noteId) return false
  await deleteDoc(doc(db, COLLECTION, noteId))
  return true
}
