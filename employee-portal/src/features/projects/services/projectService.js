import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore'
import { db, supabase } from '../../../shared/services/firebaseService'
import { useUserStore } from '../../../stores/userStore'
import { mergeActivity } from './taskActivity'

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

function scalarId(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') return String(value.uid || value.id || value.employeeId || '')
  return String(value)
}

function currentIdentityIds(user, userDoc) {
  const ids = new Set()
  const add = (value) => {
    const id = scalarId(value)
    if (id) ids.add(id)
  }
  add(userDoc?.uid)
  add(user?.uid)
  add(userDoc?.id)
  add(userDoc?.employeeId)
  add(userDoc?.employeeDocId)
  add(userDoc?.auth_id)
  add(userDoc?.authId)
  add(user?.auth_id)
  if (Array.isArray(userDoc?.identityIds)) {
    userDoc.identityIds.forEach(add)
  }
  return ids
}

export const collectUserIdentityIds = (user, userDoc) => [...currentIdentityIds(user, userDoc)]

function statusActorPatch() {
  const { user, userDoc } = useUserStore.getState()
  const ids = collectUserIdentityIds(user, userDoc)
  return {
    statusChangedBy: user?.uid || userDoc?.uid || userDoc?.id || ids[0] || null,
    statusChangedByUid: user?.uid || userDoc?.uid || null,
    statusChangedByName:
      userDoc?.displayName || user?.displayName || userDoc?.name || 'Employee',
    statusChangedByRole: 'employee',
    statusChangedByIds: ids,
  }
}

function currentIdentityEmails(user, userDoc) {
  const emails = new Set()
  for (const value of [userDoc?.email, user?.email]) {
    if (!value) continue
    emails.add(String(value).trim().toLowerCase())
  }
  return emails
}

/**
 * Check whether a target identity matches the current logged-in user.
 * ID and email are OR'd so a mismatched assigneeId still matches on email.
 * Display names are deliberately not matched: they collide across employees and
 * default to placeholders like "Team Member", which leaked projects between
 * unrelated accounts. targetName is kept in the signature for call-site clarity.
 */
export const matchesUserIdentity = (targetId, targetEmail, targetName, user, userDoc) => {
  const ids = currentIdentityIds(user, userDoc)
  const emails = currentIdentityEmails(user, userDoc)

  const targetIds = []
  if (Array.isArray(targetId)) {
    targetId.forEach((value) => {
      const id = scalarId(value)
      if (id) targetIds.push(id)
    })
  } else {
    const id = scalarId(targetId)
    if (id) targetIds.push(id)
  }
  if (targetIds.some((id) => ids.has(id))) return true

  const email = String(targetEmail || '').trim().toLowerCase()
  if (email && emails.has(email)) return true

  return false
}

function assignedToIdentity(value) {
  if (value == null || value === '') return { id: null, email: null, name: null }
  if (typeof value !== 'object') return { id: value, email: value, name: value }
  return {
    id: value.uid || value.id || value.employeeId || null,
    email: value.email || null,
    name: value.name || value.displayName || null,
  }
}

/**
 * Check if the user is creator or assignee of a specific task
 */
export const isUserAssignedToTask = (t, user, userDoc) => {
  if (!t) return false
  const isCreator = matchesUserIdentity(t.createdBy, t.createdByEmail, t.createdByName, user, userDoc)
  const isAssignee = matchesUserIdentity(t.assigneeId, t.assigneeEmail, t.assigneeName, user, userDoc)
  const isEmployeeId = matchesUserIdentity(t.employeeId, t.employeeEmail || t.assigneeEmail, t.employeeName, user, userDoc)
  const assigned = assignedToIdentity(t.assignedTo)
  const isAssignedTo = matchesUserIdentity(assigned.id, assigned.email, assigned.name, user, userDoc)
  return Boolean(isCreator || isAssignee || isEmployeeId || isAssignedTo)
}

/** Tasks whose timer the current employee owns (assignee), not merely created. */
export const isTaskTimerOwnedByUser = (t, user, userDoc) => {
  if (!t) return false
  const isAssignee = matchesUserIdentity(t.assigneeId, t.assigneeEmail, t.assigneeName, user, userDoc)
  const isEmployeeId = matchesUserIdentity(t.employeeId, t.employeeEmail || t.assigneeEmail, t.employeeName, user, userDoc)
  const assigned = assignedToIdentity(t.assignedTo)
  const isAssignedTo = matchesUserIdentity(assigned.id, assigned.email, assigned.name, user, userDoc)
  return Boolean(isAssignee || isEmployeeId || isAssignedTo)
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

  // 2. Check if user is the assigned employee via employeeId / assignedTo
  if (
    project.employeeId &&
    matchesUserIdentity(project.employeeId, null, null, user, userDoc)
  ) {
    return true
  }
  if (project.assignedTo) {
    const assigned = assignedToIdentity(project.assignedTo)
    if (matchesUserIdentity(assigned.id, assigned.email, assigned.name, user, userDoc)) {
      return true
    }
  }
  const assignedEmployeeIds = Array.isArray(project.assignedEmployeeIds)
    ? project.assignedEmployeeIds
    : []
  if (assignedEmployeeIds.some((id) => matchesUserIdentity(id, null, null, user, userDoc))) {
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

  // 4. Check if user is creator or assignee of any task in this project.
  // Matched on projectId only - project names are not unique, so falling back
  // to them linked unrelated employees' projects together.
  if (Array.isArray(tasks) && tasks.length > 0) {
    const pId = String(project.projectId || project.id || '')
    const hasTaskInProject =
      pId !== '' &&
      tasks.some(
        (t) => String(t.projectId || '') === pId && isUserAssignedToTask(t, user, userDoc)
      )
    if (hasTaskInProject) return true
  }

  return false
}

export const buildTaskVisibilityIndex = (projects = [], tasks = [], user, userDoc, claims) => {
  const rawRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    rawRole === 'admin' ||
    rawRole === 'owner' ||
    rawRole === 'superadmin'

  const projectById = new Map()
  for (const p of projects || []) {
    const a = String(p.projectId || '')
    const b = String(p.id || '')
    if (a) projectById.set(a, p)
    if (b) projectById.set(b, p)
  }

  const assignedProjectIds = new Set()
  for (const t of tasks || []) {
    if (t?.projectId && isUserAssignedToTask(t, user, userDoc)) {
      assignedProjectIds.add(String(t.projectId))
    }
  }

  const visibleProjectIds = new Set(assignedProjectIds)
  if (!isAdmin) {
    for (const p of projects || []) {
      if (!isUserOnProject(p, user, userDoc, [])) continue
      const a = String(p.projectId || '')
      const b = String(p.id || '')
      if (a) visibleProjectIds.add(a)
      if (b) visibleProjectIds.add(b)
    }
  }

  return { isAdmin, projectById, visibleProjectIds }
}

/**
 * Helper to check if a task should be visible to the current user.
 * Includes tasks directly assigned to/created by the user, OR tasks on projects where the user is a member/participant.
 */
export const isTaskVisibleToUser = (t, user, userDoc, claims, projects = [], tasks = [], index = null) => {
  if (!t) return false
  const vis = index || null
  const rawRole = claims?.role || userDoc?.role || 'employee'
  const isAdmin =
    vis?.isAdmin ??
    (rawRole === 'admin' ||
      rawRole === 'owner' ||
      rawRole === 'superadmin')

  if (isAdmin) return true

  if (isUserAssignedToTask(t, user, userDoc)) {
    return true
  }

  const taskProjectId = String(t.projectId || '')
  if (taskProjectId === '') return false

  if (vis) {
    return vis.visibleProjectIds.has(taskProjectId)
  }

  if (Array.isArray(projects) && projects.length > 0) {
    const project = projects.find(
      (p) => String(p.projectId || '') === taskProjectId || String(p.id || '') === taskProjectId
    )
    if (project && isUserOnProject(project, user, userDoc, tasks)) {
      return true
    }
  }

  return false
}

/**
 * Derive project card metrics from the live task list
 */
export const computeProjectMetrics = (projectId, tasks = [], attendance = null) => {
  const projTasks = (tasks || []).filter(
    (t) => t.projectId === projectId || t.projectId === String(projectId)
  )
  const totalTaskCount = projTasks.length
  const completedTaskCount = projTasks.filter((t) => t.status === 'done').length
  const totalHoursLogged = projTasks.reduce((sum, t) => {
    const elapsedMs = getAttendanceGatedElapsedMs(t, attendance)
    return sum + msToLoggedHours(elapsedMs)
  }, 0)
  const completionPercent =
    totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0

  return {
    totalTaskCount,
    completedTaskCount,
    totalHoursLogged,
    completionPercent,
  }
}

export const deriveProjectStatusFromMetrics = (project, metrics = {}) => {
  const stored = String(project?.status || 'active').toLowerCase()
  if (stored === 'on_hold') return 'on_hold'
  const total = Number(metrics.totalTaskCount ?? project?.totalTaskCount) || 0
  const done = Number(metrics.completedTaskCount ?? project?.completedTaskCount) || 0
  const pct = Number(metrics.completionPercent ?? project?.completionPercent) || 0
  if (total > 0 && (done >= total || pct >= 100)) return 'completed'
  if (stored === 'completed') return 'active'
  return stored || 'active'
}

export const applyProjectTaskMetrics = (project, metrics) => ({
  ...project,
  ...metrics,
  status: deriveProjectStatusFromMetrics(project, metrics),
})

export const getProjectDisplayStatus = (project) => deriveProjectStatusFromMetrics(project, project)

export const getProjectStartDate = (project) =>
  project?.startDate || project?.estimatedDate || project?.dueDate || ''

// ─── Fetch Task Statuses ───────────────────────────────────────────────────────
export const getTaskStatusesFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'taskStatuses'))
    const customStatuses = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

    // Merge default statuses with custom statuses from Firestore
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

// ─── Create Custom Task Status ─────────────────────────────────────────────────
export const createTaskStatusInDb = async (statusData) => {
  try {
    const id = statusData.id || `status_${Date.now()}`
    const payload = {
      id,
      name: statusData.name,
      color: statusData.color || 'purple',
      createdBy: statusData.createdBy || null,
      createdByEmail: statusData.createdByEmail || null,
      createdByName: statusData.createdByName || null,
      createdByRole: statusData.createdByRole || null,
      isAdminCreated: Boolean(statusData.isAdminCreated),
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'taskStatuses', id), payload)
    return { ...payload, createdAt: new Date().toISOString() }
  } catch (err) {
    console.error('Error saving custom status to Firestore:', err)
    return statusData
  }
}


// ─── Delete Custom Task Status ─────────────────────────────────────────────────
export const deleteTaskStatusFromDb = async (statusId) => {
  try {
    if (!statusId) return
    await deleteDoc(doc(db, 'taskStatuses', statusId))
  } catch (err) {
    console.error('Error deleting task status from Firestore:', err)
  }
}

// ─── Fetch All Projects ────────────────────────────────────────────────────────
export const getProjectsFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'projects'))
    return snap.docs
      .map((d) => ({ projectId: d.id, id: d.id, ...d.data() }))
      .filter((p) => !p.deletedAt)
  } catch (err) {
    console.error('Error fetching projects from Firestore:', err)
    return []
  }
}

// ─── Fetch All Tasks ───────────────────────────────────────────────────────────
export const getTasksFromDb = async () => {
  try {
    const snap = await getDocs(collection(db, 'tasks'))
    return snap.docs
      .map((d) => ({ taskId: d.id, id: d.id, ...d.data() }))
      .filter((t) => !t.deletedAt)
  } catch (err) {
    console.error('Error fetching tasks from Firestore:', err)
    return []
  }
}

// ─── Create Project ────────────────────────────────────────────────────────────
export const createProjectInDb = async (projData) => {
  try {
    const projectId = projData.projectId || `proj_${Date.now()}`
    const payload = {
      ...projData,
      projectId,
      id: projectId,
      status: projData.status || 'active',
      completionPercent: projData.completionPercent || 0,
      totalTaskCount: projData.totalTaskCount || 0,
      completedTaskCount: projData.completedTaskCount || 0,
      totalHoursLogged: projData.totalHoursLogged || 0,
      estimatedDate: projData.estimatedDate || projData.startDate || null,
      startDate: projData.startDate || projData.estimatedDate || null,
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'projects', projectId), payload)
    return { ...payload, createdAt: new Date().toISOString() }
  } catch (err) {
    console.error('Error creating project in Firestore:', err)
    const projectId = `proj_${Date.now()}`
    return { projectId, id: projectId, ...projData }
  }
}

// ─── Update Project ───────────────────────────────────────────────────────────
export const updateProjectInDb = async (projectId, updates) => {
  try {
    if (!projectId || !updates) return
    const payload = {
      ...updates,
      updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
        })
      )
      await Promise.all(promises)
    }
  } catch (err) {
    console.error('Error updating project in Firestore:', err)
  }
}

// ─── Update Project Members ───────────────────────────────────────────────────
export const updateProjectMembersInDb = async (projectId, members) => {
  try {
    if (!projectId) return
    await updateDoc(doc(db, 'projects', projectId), {
      members,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error updating project members in Firestore:', err)
  }
}

// ─── Update Project Stats ─────────────────────────────────────────────────────
export const updateProjectStatsInDb = async (projectId, stats) => {
  try {
    if (!projectId || !stats) return
    const totalTaskCount = Number(stats.totalTaskCount) || 0
    const completedTaskCount = Number(stats.completedTaskCount) || 0
    const completionPercent = Number(stats.completionPercent) || 0
    const payload = {
      totalTaskCount,
      completedTaskCount,
      completionPercent,
      totalHoursLogged: Number(stats.totalHoursLogged) || 0,
      updatedAt: serverTimestamp(),
    }
    let currentStatus = String(stats.currentStatus || '').toLowerCase()
    if (!currentStatus) {
      try {
        const snap = await getDoc(doc(db, 'projects', projectId))
        currentStatus = String(snap.data()?.status || 'active').toLowerCase()
      } catch (_) {
        currentStatus = 'active'
      }
    }
    payload.status = deriveProjectStatusFromMetrics(
      { status: currentStatus },
      { totalTaskCount, completedTaskCount, completionPercent }
    )
    await updateDoc(doc(db, 'projects', projectId), payload)
  } catch (err) {
    console.error('Error updating project stats in Firestore:', err)
  }
}

function trashActorPatch() {
  const { user, userDoc } = useUserStore.getState()
  return {
    deletedAt: new Date().toISOString(),
    deletedBy: user?.uid || userDoc?.uid || userDoc?.id || null,
    deletedByName:
      userDoc?.displayName || user?.displayName || userDoc?.name || 'Employee',
  }
}

const clearedTrashFields = {
  deletedAt: deleteField(),
  deletedBy: deleteField(),
  deletedByName: deleteField(),
  deletedWithProject: deleteField(),
}

const ROW_COLS = 'id, org_id, user_id, parent_id, collection_name, auth_id, data, created_at'

function applyTrashPatch(data, updates) {
  const next = { ...(data || {}) }
  for (const [key, val] of Object.entries(updates || {})) {
    if (val && val._method === 'deleteField') delete next[key]
    else next[key] = val
  }
  return next
}

async function projectRow(projectId) {
  const { data, error } = await supabase
    .from('projects')
    .select(ROW_COLS)
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function taskRowsForProject(projectId) {
  const { data, error } = await supabase
    .from('tasks')
    .select(ROW_COLS)
    .eq('data->>projectId', String(projectId))
  if (error) throw error
  return data || []
}

async function upsertRows(table, rows) {
  if (!rows.length) return
  const updated_at = new Date().toISOString()
  const CHUNK = 80
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK).map((row) => ({
      id: row.id,
      org_id: row.org_id ?? null,
      user_id: row.user_id ?? null,
      parent_id: row.parent_id ?? null,
      collection_name: row.collection_name ?? null,
      auth_id: row.auth_id ?? null,
      data: row.data,
      created_at: row.created_at,
      updated_at,
    }))
    const { error } = await supabase.from(table).upsert(slice, { onConflict: 'id' })
    if (error) throw error
  }
}

async function tryRpc(name, args) {
  const { error } = await supabase.rpc(name, args)
  if (!error) return true
  const missing =
    error.code === 'PGRST202' ||
    /could not find the function/i.test(error.message || '') ||
    /schema cache/i.test(error.message || '')
  if (missing) return false
  throw error
}

async function saveProjectTrash(projectId, projectPatch, mapTasks) {
  const [project, tasks] = await Promise.all([
    projectRow(projectId),
    taskRowsForProject(projectId),
  ])
  if (!project) throw new Error('Project not found')
  await Promise.all([
    upsertRows('projects', [{ ...project, data: applyTrashPatch(project.data, projectPatch) }]),
    upsertRows('tasks', mapTasks(tasks)),
  ])
}

// ─── Delete Project (move to Trash) ───────────────────────────────────────────
export const deleteProjectFromDb = async (projectId) => {
  try {
    if (!projectId) return
    const actor = trashActorPatch()
    if (await tryRpc('trash_project', { p_project_id: projectId, p_actor: actor })) return
    await saveProjectTrash(projectId, actor, (tasks) =>
      tasks
        .filter((row) => !row.data?.deletedAt)
        .map((row) => ({
          ...row,
          data: applyTrashPatch(row.data, { ...actor, deletedWithProject: projectId }),
        }))
    )
  } catch (err) {
    console.error('Error moving project to trash:', err)
    throw err
  }
}

export const restoreProjectFromDb = async (projectId) => {
  try {
    if (!projectId) return
    if (await tryRpc('restore_project', { p_project_id: projectId })) return
    await saveProjectTrash(projectId, clearedTrashFields, (tasks) =>
      tasks
        .filter((row) => row.data?.deletedWithProject === projectId)
        .map((row) => ({
          ...row,
          data: applyTrashPatch(row.data, clearedTrashFields),
        }))
    )
  } catch (err) {
    console.error('Error restoring project from trash:', err)
    throw err
  }
}

export const permanentlyDeleteProjectFromDb = async (projectId) => {
  try {
    if (!projectId) return
    if (await tryRpc('purge_project', { p_project_id: projectId })) return
    const [tasksRes, projectRes] = await Promise.all([
      supabase.from('tasks').delete().eq('data->>projectId', String(projectId)),
      supabase.from('projects').delete().eq('id', projectId),
    ])
    if (tasksRes.error) throw tasksRes.error
    if (projectRes.error) throw projectRes.error
  } catch (err) {
    console.error('Error permanently deleting project:', err)
    throw err
  }
}

function trashedDoc(row, idKey) {
  return { [idKey]: row.id, id: row.id, ...(row.data || {}) }
}

export const getTrashedProjectsFromDb = async () => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('id, data')
      .not('data->>deletedAt', 'is', null)
    if (error) throw error
    return (data || []).filter((row) => row.data?.deletedAt).map((row) => trashedDoc(row, 'projectId'))
  } catch (err) {
    console.error('Error fetching trashed projects:', err)
    return []
  }
}

export const getTrashedTasksFromDb = async () => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, data')
      .not('data->>deletedAt', 'is', null)
    if (error) throw error
    return (data || [])
      .filter((row) => row.data?.deletedAt && !row.data?.deletedWithProject)
      .map((row) => trashedDoc(row, 'taskId'))
  } catch (err) {
    console.error('Error fetching trashed tasks:', err)
    return []
  }
}

export const getProjectById = async (projectId) => {
  try {
    if (!projectId) return null
    const docSnap = await getDoc(doc(db, 'projects', projectId))
    if (docSnap.exists()) {
      const data = docSnap.data()
      if (data?.deletedAt) return null
      return { projectId: docSnap.id, id: docSnap.id, ...data }
    }
    return null
  } catch (err) {
    console.error('Error fetching project by ID:', err)
    return null
  }
}

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

export const syncProjectProcessProgress = async (projectId) => {
  try {
    if (!projectId) return
    const steps = await getProjectProcessSteps(projectId)
    if (steps.length === 0) return

    const completedCount = steps.filter((s) => s.status === 'completed').length
    const completionPercent = Math.round((completedCount / steps.length) * 100)
    const activeStep = steps.find((s) => s.status === 'in_progress') || steps.find((s) => s.status === 'pending')

    await updateDoc(doc(db, 'projects', projectId), {
      completionPercent,
      nextMilestone: activeStep ? activeStep.title : 'All Stages Completed',
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
    const now = new Date().toISOString()
    const createdByRole = stepData.createdByRole || 'employee'
    const clientVisibility =
      stepData.clientVisibility || (createdByRole === 'admin' ? 'approved' : 'pending')

    const payload = {
      projectId,
      stepNumber: stepData.stepNumber || nextStepNum,
      title: stepData.title || 'Process Stage',
      message: stepData.message || stepData.description || '',
      status: stepData.status || 'pending',
      type: stepData.type || 'message',
      author: stepData.author || 'From Team',
      meta: stepData.meta || '',
      clientVisibility,
      createdByRole,
      createdByUid: stepData.createdByUid || null,
      createdByName: stepData.createdByName || '',
      clientApprovedAt: clientVisibility === 'approved' ? now : null,
      clientApprovedBy: clientVisibility === 'approved' ? stepData.createdByUid || stepData.createdByName || null : null,
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
    await syncProjectProcessProgress(projectId)
  } catch (err) {
    console.error('Error deleting process step:', err)
  }
}


// ─── Timer helpers ─────────────────────────────────────────────────────────────
export const isEmployeeActivelyWorking = (attendance) =>
  Boolean(attendance?.clockedIn) && !attendance?.isOnBreak && !attendance?.isOnLunch

export const idleTimerFields = () => ({
  timerStatus: 'paused',
  timerAccumulatedMs: 0,
  timerStartedAt: null,
  timerStoppedAt: null,
  timerPausedByAttendance: false,
  loggedHours: 0,
})

export const timerPatchForStatusMove = (
  task,
  newStatus,
  attendance,
  now = new Date().toISOString()
) => {
  if (!task || !newStatus || task.status === newStatus) return null

  if (newStatus === 'done') {
    if (task.timerStatus === 'stopped') return null
    return stopTimerFields(task, now)
  }

  if (newStatus === 'todo') {
    if (task.timerStatus === 'running') {
      return pauseTimerFields(task, now, { byAttendance: false })
    }
    if (task.timerStatus === 'paused' && task.timerPausedByAttendance) {
      return pauseTimerFields(task, now, { byAttendance: false, freezeElapsed: true })
    }
    return null
  }

  if (task.status !== 'todo') return null

  if (isEmployeeActivelyWorking(attendance)) {
    if (task.timerStatus === 'running') return null
    const resumable =
      task.timerStatus === 'stopped'
        ? { ...task, timerStatus: 'paused', timerAccumulatedMs: Number(task.timerAccumulatedMs) || 0 }
        : task
    return resumeTimerFields(resumable, now)
  }

  if (task.timerStatus === 'paused' && task.timerPausedByAttendance) return null
  return pauseTimerFields(task, now, {
    byAttendance: true,
    freezeElapsed: task.timerStatus !== 'running',
  })
}

export const startTimerFields = (now = new Date().toISOString(), options = {}) => {
  const activelyWorking = options.activelyWorking !== false
  if (!activelyWorking) {
    return {
      timerStatus: 'paused',
      timerAccumulatedMs: 0,
      timerStartedAt: null,
      timerStoppedAt: null,
      timerPausedByAttendance: true,
      loggedHours: 0,
    }
  }
  return {
    timerStatus: 'running',
    timerAccumulatedMs: 0,
    timerStartedAt: now,
    timerStoppedAt: null,
    timerPausedByAttendance: false,
  }
}

export const getTimerElapsedMs = (entity, nowMs = Date.now()) => {
  if (!entity) return 0
  const accumulated = Number(entity.timerAccumulatedMs) || 0
  if (entity.timerStatus === 'running' && entity.timerStartedAt) {
    const started = new Date(entity.timerStartedAt).getTime()
    if (!Number.isNaN(started)) {
      return Math.max(0, accumulated + (nowMs - started))
    }
  }
  return Math.max(0, accumulated)
}

export const getAttendanceGatedElapsedMs = (entity, attendance, nowMs = Date.now()) => {
  if (!entity) return 0
  if (entity.timerStatus === 'running' && attendance && !isEmployeeActivelyWorking(attendance)) {
    return Math.max(0, Number(entity.timerAccumulatedMs) || 0)
  }
  return getTimerElapsedMs(entity, nowMs)
}

export const formatElapsed = (ms) => {
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  }
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export const msToLoggedHours = (ms) => Math.round((Math.max(0, Number(ms) || 0) / 3600000) * 100) / 100

export const pauseTimerFields = (entity, now = new Date().toISOString(), options = {}) => {
  const elapsed = options.freezeElapsed
    ? Math.max(0, Number(entity?.timerAccumulatedMs) || 0)
    : getTimerElapsedMs(entity, new Date(now).getTime())
  return {
    timerStatus: 'paused',
    timerAccumulatedMs: elapsed,
    timerStartedAt: null,
    timerStoppedAt: null,
    loggedHours: msToLoggedHours(elapsed),
    timerPausedByAttendance: options.byAttendance === true,
  }
}

export const resumeTimerFields = (entity, now = new Date().toISOString()) => {
  if (entity?.timerStatus === 'stopped') return entity
  return {
    timerStatus: 'running',
    timerAccumulatedMs: Number(entity?.timerAccumulatedMs) || 0,
    timerStartedAt: now,
    timerStoppedAt: null,
    timerPausedByAttendance: false,
  }
}

export const stopTimerFields = (entity, now = new Date().toISOString()) => {
  if (entity?.timerStatus === 'stopped') {
    const elapsed = getTimerElapsedMs(entity)
    return {
      timerStatus: 'stopped',
      timerAccumulatedMs: elapsed,
      timerStartedAt: null,
      timerStoppedAt: entity.timerStoppedAt || now,
      loggedHours: msToLoggedHours(elapsed),
      timerPausedByAttendance: false,
    }
  }
  const elapsed = getTimerElapsedMs(entity, new Date(now).getTime())
  return {
    timerStatus: 'stopped',
    timerAccumulatedMs: elapsed,
    timerStartedAt: null,
    timerStoppedAt: now,
    loggedHours: msToLoggedHours(elapsed),
    timerPausedByAttendance: false,
  }
}

// ─── Create Task ───────────────────────────────────────────────────────────────
export const createTaskInDb = async (taskData) => {
  try {
    const taskId = taskData.taskId || `task_${Date.now()}`
    const timerDefaults = startTimerFields()
    const payload = {
      ...timerDefaults,
      ...taskData,
      taskId,
      id: taskId,
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      loggedHours: Number(taskData.loggedHours) || 0,
      timerStatus: taskData.timerStatus || timerDefaults.timerStatus,
      timerAccumulatedMs: Number(taskData.timerAccumulatedMs) || 0,
      timerStartedAt:
        (taskData.timerStatus || timerDefaults.timerStatus) === 'running'
          ? taskData.timerStartedAt || timerDefaults.timerStartedAt
          : taskData.timerStartedAt || null,
      timerStoppedAt: taskData.timerStoppedAt || null,
      timerPausedByAttendance: Boolean(taskData.timerPausedByAttendance),
      createdAt: serverTimestamp(),
    }
    await setDoc(doc(db, 'tasks', taskId), payload)
    return { ...payload, createdAt: new Date().toISOString() }
  } catch (err) {
    console.error('Error creating task in Firestore:', err)
    const taskId = `task_${Date.now()}`
    return { taskId, id: taskId, ...taskData }
  }
}

// ─── Update Task Status ────────────────────────────────────────────────────────
export const appendTaskActivityInDb = async (taskId, entries) => {
  const incoming = (entries || []).filter(Boolean)
  if (!taskId || !incoming.length) return
  try {
    const ref = doc(db, 'tasks', taskId)
    const snap = await getDoc(ref)
    const current = snap.exists() ? snap.data() : {}
    await updateDoc(ref, {
      activity: mergeActivity(current.activity, incoming),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error saving task activity:', err)
  }
}

export const updateTaskStatusInDb = async (taskId, newStatus, timerPatch = null) => {
  try {
    if (!taskId) return
    const payload = {
      status: newStatus,
      updatedAt: serverTimestamp(),
      ...statusActorPatch(),
    }
    if (timerPatch) Object.assign(payload, timerPatch)
    await updateDoc(doc(db, 'tasks', taskId), payload)
  } catch (err) {
    console.error('Error updating task status in Firestore:', err)
  }
}

// ─── Log Hours To Task ─────────────────────────────────────────────────────────
export const logHoursToTaskInDb = async (taskId, additionalHours, currentHours = 0) => {
  try {
    if (!taskId) return
    const newTotal = (Number(currentHours) || 0) + Number(additionalHours)
    await updateDoc(doc(db, 'tasks', taskId), {
      loggedHours: newTotal,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('Error logging hours in Firestore:', err)
  }
}

// ─── Update Task Timer Fields ──────────────────────────────────────────────────
export const updateTaskTimerInDb = async (taskId, timerFields) => {
  try {
    if (!taskId || !timerFields) return
    await updateDoc(doc(db, 'tasks', taskId), {
      ...timerFields,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    if (err?.code === 'not-found') return
    console.error('Error updating task timer:', err?.message || err)
  }
}

// ─── Update Task Subtasks & Status ─────────────────────────────────────────────
export const updateTaskSubtasksInDb = async (taskId, subtasks, status = null) => {
  try {
    if (!taskId) return
    const payload = { subtasks }
    if (status) Object.assign(payload, { status, ...statusActorPatch() })
    payload.updatedAt = serverTimestamp()

    await setDoc(doc(db, 'tasks', taskId), payload, { merge: true })
  } catch (err) {
    console.error('Error updating task subtasks in Firestore:', err)
  }
}

// ─── Delete Task (move to Trash) ───────────────────────────────────────────────
export const deleteTaskFromDb = async (taskId) => {
  try {
    if (!taskId) return
    await updateDoc(doc(db, 'tasks', taskId), {
      ...trashActorPatch(),
      deletedWithProject: deleteField(),
    })
  } catch (err) {
    console.error('Error moving task to trash:', err)
    throw err
  }
}

export const restoreTaskFromDb = async (taskId) => {
  try {
    if (!taskId) return
    await updateDoc(doc(db, 'tasks', taskId), clearedTrashFields)
  } catch (err) {
    console.error('Error restoring task from trash:', err)
    throw err
  }
}

export const permanentlyDeleteTaskFromDb = async (taskId) => {
  try {
    if (!taskId) return
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error) throw error
  } catch (err) {
    console.error('Error permanently deleting task:', err)
    throw err
  }
}

