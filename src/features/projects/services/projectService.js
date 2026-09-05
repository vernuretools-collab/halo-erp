import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const DEFAULT_TASK_STATUSES = [
  { id: 'todo', name: 'To Do', color: 'blue' },
  { id: 'in_progress', name: 'In Progress', color: 'indigo' },
  { id: 'in_review', name: 'In Review', color: 'amber' },
  { id: 'done', name: 'Done', color: 'emerald' },
]

const GENERIC_NAMES = ['employee', 'team member', 'unassigned', 'creator', 'user', 'admin', '']

export const isGenericName = (name) => {
  if (!name || typeof name !== 'string') return true
  return GENERIC_NAMES.includes(name.trim().toLowerCase())
}

/**
 * Check whether a target identity (id, email, name) matches the current logged-in user
 */
export const matchesUserIdentity = (targetId, targetEmail, targetName, user, userDoc) => {
  const currentUserId = userDoc?.uid || user?.uid || userDoc?.id
  const currentUserEmail = userDoc?.email || user?.email
  const currentDisplayName = userDoc?.displayName || user?.displayName || userDoc?.name

  if (targetId && currentUserId) {
    return String(targetId) === String(currentUserId)
  }

  if (targetEmail && currentUserEmail) {
    return String(targetEmail).toLowerCase() === String(currentUserEmail).toLowerCase()
  }

  if (
    targetName &&
    currentDisplayName &&
    !isGenericName(targetName) &&
    !isGenericName(currentDisplayName)
  ) {
    return String(targetName).trim().toLowerCase() === String(currentDisplayName).trim().toLowerCase()
  }

  return false
}

/**
 * Check if the user is creator or assignee of a specific task
 */
export const isUserAssignedToTask = (t, user, userDoc) => {
  if (!t) return false
  const isCreator = matchesUserIdentity(t.createdBy, t.createdByEmail, t.createdByName, user, userDoc)
  const isAssignee = matchesUserIdentity(t.assigneeId, t.assigneeEmail, t.assigneeName, user, userDoc)
  return Boolean(isCreator || isAssignee)
}

/**
 * Check whether the current user is creator/owner/member of a project OR assigned to any task in that project
 */
export const isUserOnProject = (project, user, userDoc, tasks = []) => {
  if (!project) return false

  // 1. Check if user is project creator
  if (
    matchesUserIdentity(project.createdBy, project.createdByEmail, project.createdByName, user, userDoc)
  ) {
    return true
  }

  // 2. Check if user is the assigned employee via employeeId
  if (
    project.employeeId &&
    matchesUserIdentity(project.employeeId, null, null, user, userDoc)
  ) {
    return true
  }

  // 3. Check if user is in project.members array
  const members = Array.isArray(project.members) ? project.members : []
  const isMember = members.some((m) => {
    if (m == null) return false
    if (typeof m !== 'object') {
      return matchesUserIdentity(m, m, m, user, userDoc)
    }
    return matchesUserIdentity(m.uid || m.id, m.email, m.name || m.displayName, user, userDoc)
  })
  if (isMember) return true

  // 4. Only fall back to ownerName matching if no UID-based creator / employeeId is set
  if (!project.createdBy && !project.createdByEmail && !project.employeeId) {
    if (matchesUserIdentity(null, null, project.ownerName, user, userDoc)) {
      return true
    }
  }

  // 5. Check if user is creator or assignee of any task in this project
  if (Array.isArray(tasks) && tasks.length > 0) {
    const pId = project.projectId || project.id
    const hasTaskInProject = tasks.some((t) => {
      const isProjMatch =
        (t.projectId && (t.projectId === pId || String(t.projectId) === String(pId))) ||
        (t.projectName && project.name && String(t.projectName).toLowerCase() === String(project.name).toLowerCase())
      return isProjMatch && isUserAssignedToTask(t, user, userDoc)
    })
    if (hasTaskInProject) return true
  }

  return false
}

/**
 * Helper to check if a task should be visible to the current user
 */
export const isTaskVisibleToUser = (t, user, userDoc, claims, projects = [], tasks = []) => {
  if (!t) return false

  const rawRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    rawRole === 'admin' ||
    rawRole === 'owner' ||
    rawRole === 'superadmin'

  if (isAdmin) return true

  if (isUserAssignedToTask(t, user, userDoc)) {
    return true
  }

  if (Array.isArray(projects) && projects.length > 0) {
    const project = projects.find(
      (p) =>
        (t.projectId && (p.projectId === t.projectId || p.id === t.projectId || String(p.projectId) === String(t.projectId))) ||
        (t.projectName && p.name && String(p.name).toLowerCase() === String(t.projectName).toLowerCase())
    )
    if (project && isUserOnProject(project, user, userDoc, tasks)) {
      return true
    }
  }

  return false
}

/**
 * Fetch task statuses from Firestore
 */
export const getTaskStatusesFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'taskStatuses'))
    const customStatuses = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    const merged = [...DEFAULT_TASK_STATUSES]
    customStatuses.forEach((cs) => {
      if (!merged.some((m) => m.id === cs.id)) {
        merged.push(cs)
      }
    })
    return merged
  } catch (err) {
    console.error('Error fetching task statuses from Firestore:', err)
    return DEFAULT_TASK_STATUSES
  }
}

/**
 * Fetch all projects from Firestore
 */
export const getProjects = async () => {
  try {
    const snap = await getDocs(collection(db, 'projects'))
    return snap.docs.map((d) => ({ projectId: d.id, id: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching projects from Firestore:', err)
    return []
  }
}

/**
 * Create a project in Firestore
 */
export const createProject = async (projectData) => {
  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      ...projectData,
      createdAt: new Date().toISOString(),
    })
    return { projectId: docRef.id, id: docRef.id, ...projectData }
  } catch (err) {
    console.error('Error creating project in Firestore:', err)
    return { projectId: `proj_${Date.now()}`, id: `proj_${Date.now()}`, ...projectData }
  }
}

/**
 * Update project details and sync project name to tasks in Firestore
 */
export const updateProjectInDb = async (projectId, updates) => {
  try {
    if (!projectId || !updates) return
    const payload = {
      ...updates,
      updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
    }
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
    await updateDoc(doc(db, 'projects', projectId), payload)

    // Sync updated project name to associated tasks in Firestore
    if (updates.name && typeof updates.name === 'string' && updates.name.trim()) {
      const q = query(collection(db, 'tasks'), where('projectId', '==', projectId))
      const snap = await getDocs(q)
      const promises = snap.docs.map((d) =>
        updateDoc(doc(db, 'tasks', d.id), {
          projectName: updates.name.trim(),
          updatedAt: serverTimestamp ? serverTimestamp() : new Date().toISOString(),
        })
      )
      await Promise.all(promises)
    }
  } catch (err) {
    console.error('Error updating project in Firestore:', err)
  }
}

/**
 * Delete a project from Firestore
 */
export const deleteProjectFromDb = async (projectId) => {
  try {
    if (!projectId) return
    await deleteDoc(doc(db, 'projects', projectId))
  } catch (err) {
    console.error('Error deleting project from Firestore:', err)
  }
}

/**
 * Fetch all tasks from Firestore
 */
export const getTasks = async () => {
  try {
    const snap = await getDocs(collection(db, 'tasks'))
    return snap.docs.map((d) => ({ taskId: d.id, ...d.data() }))
  } catch (err) {
    console.error('Error fetching tasks from Firestore:', err)
    return []
  }
}

/**
 * Create a task in Firestore
 */
export const createTask = async (taskData) => {
  try {
    const docRef = await addDoc(collection(db, 'tasks'), {
      ...taskData,
      createdAt: new Date().toISOString(),
    })
    return { taskId: docRef.id, ...taskData }
  } catch (err) {
    console.error('Error creating task in Firestore:', err)
    return { taskId: `task_${Date.now()}`, ...taskData }
  }
}

/**
 * Update task status in Firestore
 */
export const updateTaskStatusInDb = async (taskId, newStatus) => {
  try {
    if (!taskId) return
    await updateDoc(doc(db, 'tasks', taskId), {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating task status in Firestore:', err)
  }
}

/**
 * Update task subtasks & status in Firestore
 */
export const updateTaskSubtasksInDb = async (taskId, subtasks, status = null) => {
  try {
    if (!taskId) return
    const payload = { subtasks }
    if (status) payload.status = status
    payload.updatedAt = serverTimestamp ? serverTimestamp() : new Date().toISOString()

    await setDoc(doc(db, 'tasks', taskId), payload, { merge: true })
  } catch (err) {
    console.error('Error updating task subtasks in Firestore:', err)
  }
}

/**
 * Delete a task from Firestore
 */
export const deleteTaskFromDb = async (taskId) => {
  try {
    if (!taskId) return
    await deleteDoc(doc(db, 'tasks', taskId))
  } catch (err) {
    console.error('Error deleting task from Firestore:', err)
  }
}
