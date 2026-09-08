import { collection, getDocs, onSnapshot } from './firestoreCompat.js'

const GENERIC_NAMES = new Set(['employee', 'team member', 'unassigned', 'creator', 'user', 'admin', ''])

const scalarId = (value) => {
  if (value == null || value === '') return ''
  if (typeof value === 'object') return String(value.uid || value.id || value.employeeId || '')
  return String(value)
}

const addKey = (set, value) => {
  const id = scalarId(value)
  if (id) set.add(id.toLowerCase())
}

const addText = (set, value) => {
  if (value == null || value === '') return
  const text = String(value).trim().toLowerCase()
  if (text) set.add(text)
}

export const profileIdentityKeys = (user, userDoc, extraIds = []) => {
  const keys = new Set()
  extraIds.forEach((id) => addKey(keys, id))
  addKey(keys, user?.uid)
  addKey(keys, userDoc?.uid)
  addKey(keys, userDoc?.id)
  addKey(keys, userDoc?.employeeId)
  addKey(keys, userDoc?.employeeDocId)
  addKey(keys, userDoc?.auth_id)
  addKey(keys, userDoc?.authId)
  addKey(keys, user?.auth_id)
  if (Array.isArray(userDoc?.identityIds)) userDoc.identityIds.forEach((id) => addKey(keys, id))
  addText(keys, user?.email)
  addText(keys, userDoc?.email)
  for (const name of [userDoc?.displayName, user?.displayName, userDoc?.name, userDoc?.fullName]) {
    if (!name || GENERIC_NAMES.has(String(name).trim().toLowerCase())) continue
    addText(keys, name)
  }
  return keys
}

const keysOverlap = (left, right) => {
  for (const key of left) {
    if (right.has(key)) return true
  }
  return false
}

export const collectProjectPersonKeys = (project = {}) => {
  const keys = new Set()
  addKey(keys, project.createdBy)
  addKey(keys, project.createdByUid)
  addKey(keys, project.employeeId)
  addText(keys, project.createdByEmail)
  addText(keys, project.createdByName)
  addText(keys, project.ownerName)

  const assigned = project.assignedTo
  if (assigned && typeof assigned === 'object') {
    addKey(keys, assigned.uid || assigned.id || assigned.employeeId)
    addText(keys, assigned.email)
    addText(keys, assigned.name || assigned.displayName)
  } else {
    addKey(keys, assigned)
  }

  const assignedIds = Array.isArray(project.assignedEmployeeIds) ? project.assignedEmployeeIds : []
  assignedIds.forEach((id) => addKey(keys, id))

  const members = Array.isArray(project.members) ? project.members : []
  members.forEach((member) => {
    if (member == null) return
    if (typeof member !== 'object') {
      addKey(keys, member)
      addText(keys, member)
      return
    }
    addKey(keys, member.uid || member.id || member.employeeId)
    addText(keys, member.email)
    addText(keys, member.name || member.displayName)
  })
  return keys
}

export const collectTaskPersonKeys = (task = {}) => {
  const keys = new Set()
  addKey(keys, task.assigneeId)
  addKey(keys, task.employeeId)
  addKey(keys, task.createdBy)
  addText(keys, task.assigneeEmail)
  addText(keys, task.createdByEmail)
  addText(keys, task.assigneeName)
  addText(keys, task.createdByName)
  const assigned = task.assignedTo
  if (assigned && typeof assigned === 'object') {
    addKey(keys, assigned.uid || assigned.id || assigned.employeeId)
    addText(keys, assigned.email)
    addText(keys, assigned.name || assigned.displayName)
  } else {
    addKey(keys, assigned)
  }
  return keys
}

const collectActorKeys = (data = {}) => {
  const keys = new Set()
  addKey(keys, data.statusChangedBy)
  addKey(keys, data.statusChangedByUid)
  addKey(keys, data.createdBy)
  addKey(keys, data.createdByUid)
  addText(keys, data.statusChangedByName)
  addText(keys, data.createdByEmail)
  addText(keys, data.createdByName)
  if (Array.isArray(data.statusChangedByIds)) {
    data.statusChangedByIds.forEach((id) => addKey(keys, id))
  }
  return keys
}

const humanizeStatus = (status) => {
  const raw = String(status || '').trim()
  if (!raw) return 'Unknown'
  const known = {
    todo: 'To Do',
    in_progress: 'In Progress',
    in_review: 'In Review',
    done: 'Done',
  }
  if (known[raw]) return known[raw]
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Live browser alerts from projects/tasks so they work even when inbox SQL is not applied.
 */
export const subscribeProjectTaskAlerts = ({ mode, identityIds = [], user, userDoc, onAlert }) => {
  const me = profileIdentityKeys(user, userDoc, identityIds)
  if (!me.size) return () => {}

  const isAdmin = mode === 'admin'
  const taskStatusById = new Map()
  const projectKeysById = new Map()
  let tasksPrimed = false
  let projectsPrimed = false

  const emit = (payload) => {
    if (typeof onAlert === 'function') onAlert(payload)
  }

  const applyTaskDocs = (docs) => {
    if (!tasksPrimed) {
      docs.forEach((docSnap) => {
        const data = docSnap.data() || {}
        taskStatusById.set(docSnap.id, data.status || '')
      })
      tasksPrimed = true
      return
    }

    docs.forEach((docSnap) => {
      const data = { id: docSnap.id, ...(docSnap.data() || {}) }
      const prevStatus = taskStatusById.get(docSnap.id)
      taskStatusById.set(docSnap.id, data.status || '')
      if (prevStatus == null) return
      if (String(prevStatus) === String(data.status || '')) return
      if (String(data.statusChangedByRole || '').toLowerCase() !== 'employee') return
      if (keysOverlap(me, collectActorKeys(data))) return

      if (!isAdmin) {
        const involved = collectTaskPersonKeys(data)
        const projectId = data.projectId
        if (projectId && projectKeysById.has(String(projectId))) {
          projectKeysById.get(String(projectId)).forEach((key) => involved.add(key))
        }
        if (!keysOverlap(me, involved)) return
      }

      const projectName = data.projectName || 'a project'
      const taskName = data.title || data.name || 'a task'
      const actorName = data.statusChangedByName || 'An employee'
      emit({
        notification: {
          title: 'Task status updated',
          body: `${actorName} moved "${taskName}" from ${humanizeStatus(prevStatus)} to ${humanizeStatus(data.status)} on "${projectName}"`,
        },
        data: {
          type: 'task',
          link: '/projects/tasks',
          tag: `task-status-${docSnap.id}-${data.status || ''}`,
          projectId: data.projectId,
          taskId: docSnap.id,
        },
      })
    })
  }

  const applyProjectDocs = (docs) => {
    if (!projectsPrimed) {
      docs.forEach((docSnap) => {
        projectKeysById.set(docSnap.id, collectProjectPersonKeys(docSnap.data() || {}))
      })
      projectsPrimed = true
      return
    }

    docs.forEach((docSnap) => {
      const data = { id: docSnap.id, ...(docSnap.data() || {}) }
      const nextKeys = collectProjectPersonKeys(data)
      const hadProject = projectKeysById.has(docSnap.id)
      const prevKeys = projectKeysById.get(docSnap.id) || new Set()
      projectKeysById.set(docSnap.id, nextKeys)

      const createdByEmployee = String(data.createdByRole || '').toLowerCase() === 'employee'
      const isCreator = keysOverlap(me, collectActorKeys(data))
      const projectName = data.name || 'a project'
      const creatorName = data.createdByName || data.ownerName || 'An employee'

      if (!hadProject) {
        if (isAdmin && createdByEmployee && !isCreator) {
          emit({
            notification: {
              title: 'New project created',
              body: `${creatorName} created "${projectName}"`,
            },
            data: {
              type: 'project',
              link: '/projects/list',
              tag: `project-created-${docSnap.id}`,
              projectId: docSnap.id,
            },
          })
        }
        if (!isAdmin && !isCreator && keysOverlap(me, nextKeys)) {
          emit({
            notification: {
              title: 'Assigned to a project',
              body: `You were assigned to "${projectName}"`,
            },
            data: {
              type: 'project',
              link: `/projects/${docSnap.id}/tasks`,
              tag: `project-assigned-${docSnap.id}`,
              projectId: docSnap.id,
            },
          })
        }
        return
      }

      const addedKeys = new Set()
      nextKeys.forEach((key) => {
        if (!prevKeys.has(key)) addedKeys.add(key)
      })
      if (!addedKeys.size) return
      if (isCreator) return
      if (!keysOverlap(me, addedKeys)) return

      emit({
        notification: {
          title: 'Assigned to a project',
          body: `You were assigned to "${projectName}"`,
        },
        data: {
          type: 'project',
          link: isAdmin ? '/projects/list' : `/projects/${docSnap.id}/tasks`,
          tag: `project-assigned-${docSnap.id}`,
          projectId: docSnap.id,
        },
      })
    })
  }

  const unsubTasks = onSnapshot(collection(null, 'tasks'), (snapshot) => {
    applyTaskDocs(snapshot.docs)
  })
  const unsubProjects = onSnapshot(collection(null, 'projects'), (snapshot) => {
    applyProjectDocs(snapshot.docs)
  })

  const poll = async () => {
    try {
      const [taskSnap, projectSnap] = await Promise.all([
        getDocs(collection(null, 'tasks')),
        getDocs(collection(null, 'projects')),
      ])
      applyTaskDocs(taskSnap.docs)
      applyProjectDocs(projectSnap.docs)
    } catch {
      // ignore poll errors; live snapshot may still work
    }
  }
  const pollId = setInterval(poll, 6000)

  return () => {
    clearInterval(pollId)
    unsubTasks()
    unsubProjects()
  }
}
