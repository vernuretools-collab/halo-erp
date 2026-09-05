import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

export const DEFAULT_TASK_STATUSES = [
  { id: 'todo', name: 'To Do', color: 'blue' },
  { id: 'in_progress', name: 'In Progress', color: 'indigo' },
  { id: 'in_review', name: 'In Review', color: 'amber' },
  { id: 'done', name: 'Done', color: 'emerald' },
]

export const getProjectDisplayStatus = (project) => {
  const stored = String(project?.status || 'active').toLowerCase()
  if (stored === 'on_hold') return 'on_hold'
  const total = Number(project?.totalTaskCount) || 0
  const done = Number(project?.completedTaskCount) || 0
  const pct = Number(project?.completionPercent) || 0
  if ((total > 0 && done >= total) || pct >= 100) return 'completed'
  return stored || 'active'
}

export const getProjectStartDate = (project) =>
  project?.startDate || project?.estimatedDate || project?.dueDate || ''

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
 * Fetch a single project by ID
 */
export const getProjectById = async (projectId) => {
  try {
    if (!projectId) return null
    const docSnap = await getDoc(doc(db, 'projects', projectId))
    if (docSnap.exists()) {
      return { projectId: docSnap.id, id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (err) {
    console.error('Error fetching project by ID:', err)
    return null
  }
}

/**
 * Create a project in Firestore and seed initial timeline event
 */
export const createProject = async (projectData) => {
  try {
    const docRef = await addDoc(collection(db, 'projects'), {
      ...projectData,
      estimatedDate: projectData.estimatedDate || projectData.startDate || null,
      startDate: projectData.startDate || projectData.estimatedDate || null,
      createdAt: new Date().toISOString(),
    })
    const newProject = { projectId: docRef.id, id: docRef.id, ...projectData }

    // Seed initial Project Created timeline event
    try {
      await addProjectTimelineEvent(docRef.id, {
        type: 'project_created',
        title: `Project "${projectData.name}" created`,
        author: projectData.ownerName ? `By ${projectData.ownerName}` : 'By Admin',
        meta: projectData.clientName ? `Client: ${projectData.clientName}` : '',
        timestamp: new Date().toISOString(),
      })
    } catch (e) {
      console.warn('Failed to add initial timeline event:', e)
    }

    return newProject
  } catch (err) {
    console.error('Error creating project in Firestore:', err)
    return { projectId: `proj_${Date.now()}`, id: `proj_${Date.now()}`, ...projectData }
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
 * Update project members in Firestore
 */
export const updateProjectMembersInDb = async (projectId, members) => {
  try {
    if (!projectId) return
    await updateDoc(doc(db, 'projects', projectId), {
      members,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error updating project members in Firestore:', err)
  }
}

/**
 * Process Steps & Workflow Operations
 */
export const getClientVisibility = (step) => {
  if (!step?.clientVisibility) return 'approved'
  return step.clientVisibility
}

export const isClientVisible = (step) => getClientVisibility(step) === 'approved'

export const getProjectProcessSteps = async (projectId) => {
  try {
    if (!projectId) return []
    const processRef = collection(db, 'projects', projectId, 'processSteps')
    const snap = await getDocs(processRef)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
    return list
  } catch (err) {
    console.error('Error fetching project process steps:', err)
    return []
  }
}

export const subscribeProjectProcessSteps = (projectId, callback) => {
  if (!projectId) return () => {}
  try {
    const processRef = collection(db, 'projects', projectId, 'processSteps')
    return onSnapshot(
      processRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
        callback(list)
      },
      (err) => {
        console.warn('Error subscribing to process steps:', err)
      }
    )
  } catch (err) {
    console.error('Error setting up process steps subscription:', err)
    return () => {}
  }
}

// Sync overall project progress % and current milestone based on process steps
export const syncProjectProcessProgress = async (projectId) => {
  try {
    if (!projectId) return
    const steps = await getProjectProcessSteps(projectId)
    if (steps.length === 0) return

    const completedCount = steps.filter((s) => s.status === 'completed').length
    const completionPercent = Math.round((completedCount / steps.length) * 100)

    const activeStep = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'pending')
    const nextMilestone = activeStep ? activeStep.title : 'All Stages Completed'

    await updateDoc(doc(db, 'projects', projectId), {
      completionPercent,
      nextMilestone,
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('Error syncing project progress from steps:', err)
  }
}

export const addProcessStep = async (projectId, stepData) => {
  try {
    if (!projectId) throw new Error('Missing projectId')
    const existing = await getProjectProcessSteps(projectId)
    const nextStepNum = existing.length > 0 ? Math.max(...existing.map((s) => s.stepNumber || 0)) + 1 : 1

    const createdByRole = stepData.createdByRole || 'admin'
    const clientVisibility =
      stepData.clientVisibility || (createdByRole === 'employee' ? 'pending' : 'approved')
    const now = new Date().toISOString()

    const payload = {
      projectId,
      stepNumber: stepData.stepNumber || nextStepNum,
      title: stepData.title || 'Process Stage',
      message: stepData.message || stepData.description || '',
      status: stepData.status || 'pending', // 'pending' | 'in_progress' | 'completed'
      type: stepData.type || 'message',
      author: stepData.author || 'From Admin',
      meta: stepData.meta || '',
      clientVisibility,
      createdByRole,
      createdByUid: stepData.createdByUid || null,
      createdByName: stepData.createdByName || '',
      clientApprovedAt: clientVisibility === 'approved' ? now : null,
      clientApprovedBy: clientVisibility === 'approved' ? stepData.createdByUid || stepData.createdByName || 'admin' : null,
      completedAt: stepData.status === 'completed' ? now : null,
      createdAt: now,
      updatedAt: now,
    }

    const docRef = await addDoc(collection(db, 'projects', projectId, 'processSteps'), payload)
    await syncProjectProcessProgress(projectId)
    return { id: docRef.id, ...payload }
  } catch (err) {
    console.error('Error adding process step:', err)
    throw err
  }
}

export const updateProcessStep = async (projectId, stepId, updates) => {
  try {
    if (!projectId || !stepId) return
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    if (updates.status === 'completed' && !updates.completedAt) {
      payload.completedAt = new Date().toISOString()
    } else if (updates.status && updates.status !== 'completed') {
      payload.completedAt = null
    }

    await updateDoc(doc(db, 'projects', projectId, 'processSteps', stepId), payload)
    await syncProjectProcessProgress(projectId)
  } catch (err) {
    console.error('Error updating process step:', err)
    throw err
  }
}

export const setProcessStepClientVisibility = async (projectId, stepId, visibility, actor = {}) => {
  try {
    if (!projectId || !stepId) return
    const now = new Date().toISOString()
    const payload = {
      clientVisibility: visibility,
      updatedAt: now,
    }
    if (visibility === 'approved') {
      payload.clientApprovedAt = now
      payload.clientApprovedBy = actor.uid || actor.name || 'admin'
    }
    await updateDoc(doc(db, 'projects', projectId, 'processSteps', stepId), payload)
  } catch (err) {
    console.error('Error setting process step client visibility:', err)
    throw err
  }
}

export const toggleProcessStepStatus = async (projectId, stepId, currentStatus) => {
  try {
    if (!projectId || !stepId) return
    let nextStatus = 'in_progress'
    if (currentStatus === 'in_progress') nextStatus = 'completed'
    else if (currentStatus === 'completed') nextStatus = 'pending'
    else if (currentStatus === 'pending') nextStatus = 'in_progress'

    const payload = {
      status: nextStatus,
      completedAt: nextStatus === 'completed' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    }

    await updateDoc(doc(db, 'projects', projectId, 'processSteps', stepId), payload)
    await syncProjectProcessProgress(projectId)
    return nextStatus
  } catch (err) {
    console.error('Error toggling process step status:', err)
    throw err
  }
}

export const deleteProcessStep = async (projectId, stepId) => {
  try {
    if (!projectId || !stepId) return
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'processSteps', stepId))
    } catch (_) {}
    try {
      await deleteDoc(doc(db, 'projects', projectId, 'timeline', stepId))
    } catch (_) {}
    await syncProjectProcessProgress(projectId)
  } catch (err) {
    console.error('Error deleting process step:', err)
    throw err
  }
}

export const reorderProcessSteps = async (projectId, orderedSteps) => {
  try {
    if (!projectId || !orderedSteps) return
    const promises = orderedSteps.map((step, idx) =>
      updateDoc(doc(db, 'projects', projectId, 'processSteps', step.id), {
        stepNumber: idx + 1,
        updatedAt: new Date().toISOString(),
      })
    )
    await Promise.all(promises)
  } catch (err) {
    console.error('Error reordering process steps:', err)
  }
}

/**
 * Timeline Events Operations (Legacy / Activity Logs)
 */
export const getProjectTimeline = async (projectId) => {
  try {
    if (!projectId) return []
    const timelineRef = collection(db, 'projects', projectId, 'timeline')
    const snap = await getDocs(timelineRef)
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
    return list
  } catch (err) {
    console.error('Error fetching project timeline:', err)
    return []
  }
}

export const subscribeProjectTimeline = (projectId, callback) => {
  if (!projectId) return () => {}
  try {
    const timelineRef = collection(db, 'projects', projectId, 'timeline')
    return onSnapshot(
      timelineRef,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        list.sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0))
        callback(list)
      },
      (err) => {
        console.warn('Error subscribing to project timeline:', err)
      }
    )
  } catch (err) {
    console.error('Error setting up project timeline subscription:', err)
    return () => {}
  }
}

export const addProjectTimelineEvent = async (projectId, eventData) => {
  try {
    if (!projectId) throw new Error('Missing projectId')
    const payload = {
      projectId,
      type: eventData.type || 'message',
      title: eventData.title || 'Project Update',
      author: eventData.author || 'Admin',
      meta: eventData.meta || '',
      description: eventData.description || '',
      timestamp: eventData.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const docRef = await addDoc(collection(db, 'projects', projectId, 'timeline'), payload)
    return { id: docRef.id, ...payload }
  } catch (err) {
    console.error('Error adding project timeline event:', err)
    throw err
  }
}

export const updateProjectTimelineEvent = async (projectId, eventId, updates) => {
  try {
    if (!projectId || !eventId) return
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await updateDoc(doc(db, 'projects', projectId, 'timeline', eventId), payload)
  } catch (err) {
    console.error('Error updating project timeline event:', err)
    throw err
  }
}

export const deleteProjectTimelineEvent = async (projectId, eventId) => {
  try {
    if (!projectId || !eventId) return
    await deleteDoc(doc(db, 'projects', projectId, 'timeline', eventId))
  } catch (err) {
    console.error('Error deleting project timeline event:', err)
    throw err
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
