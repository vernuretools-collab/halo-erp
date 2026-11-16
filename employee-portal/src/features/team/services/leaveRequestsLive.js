import { collection, getDocs } from 'firebase/firestore'
import { supabase } from '../../../../../shared/supabase/client.js'
import { db } from '../../../shared/services/firebaseService'
import { calendarDateKey } from './leaveEntitlementUtils.js'

const SELECT = 'id, user_id, data'

const channels = new Map()

const TABLE_TOPIC = 'leave-requests'
let tableWatchStarted = false

const channelTopic = (channel) => String(channel?.topic || '')

const isLiveChannel = (channel) => {
  const state = channel?.state
  return state === 'joined' || state === 'joining' || state === 'leaving'
}

const findTableChannel = () => {
  if (!supabase || typeof supabase.getChannels !== 'function') return null
  return (
    supabase.getChannels().find((channel) => {
      const topic = channelTopic(channel)
      return topic === TABLE_TOPIC || topic === `realtime:${TABLE_TOPIC}`
    }) || null
  )
}

const duplicateWatchError = (err) => {
  const message = String(err?.message || err)
  return message.includes('cannot add') && message.includes('postgres_changes')
}

// One postgres_changes binding for the whole table. supabase.channel(topic)
// returns the channel that already called subscribe(), and .on() then throws.
const ensureTableWatch = () => {
  if (!supabase || tableWatchStarted) return
  const existing = findTableChannel()
  if (existing && isLiveChannel(existing)) {
    tableWatchStarted = true
    return
  }
  const channel = existing || supabase.channel(TABLE_TOPIC)
  tableWatchStarted = true
  if (isLiveChannel(channel)) return
  try {
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        channels.forEach((entry) => entry.refresh())
      })
      .subscribe()
  } catch (err) {
    if (duplicateWatchError(err)) return
    console.error('[leaveRequestsLive] leave watch error:', err)
  }
}

const rowToLeave = (row) => {
  const data = row?.data && typeof row.data === 'object' ? row.data : {}
  const owner = data.employeeId || data.uid || row.user_id || ''
  return {
    ...data,
    leaveId: data.leaveId || row.id,
    employeeId: owner,
    uid: data.uid || data.employeeId || row.user_id || '',
  }
}

const monthKey = (year, monthIndex) =>
  `${year}-${String(monthIndex + 1).padStart(2, '0')}`

const overlapsMonth = (leave, year, monthIndex) => {
  const key = monthKey(year, monthIndex)
  const start = calendarDateKey(leave?.startDate)
  const end = calendarDateKey(leave?.endDate || leave?.startDate)
  if (!start) return false
  return start <= `${key}-31` && end >= `${key}-01`
}

const belongsToPerson = (leave, ids, email, name) => {
  const set = new Set(ids)
  const employeeId = String(leave?.employeeId || '')
  const uid = String(leave?.uid || '')
  if (employeeId && set.has(employeeId)) return true
  if (uid && set.has(uid)) return true
  const rowEmail = String(leave?.employeeEmail || '').trim().toLowerCase()
  if (email && rowEmail && rowEmail === String(email).trim().toLowerCase()) return true
  const rowName = String(leave?.employeeName || '').trim().toLowerCase()
  const person = String(name || '').trim().toLowerCase()
  if (person && rowName && person !== 'team staff' && rowName === person) return true
  return false
}

const asIdList = (ids) => [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String))]

const addLeave = (merged, leave) => {
  const id = String(leave?.leaveId || '')
  if (!id) return
  merged.set(id, leave)
}

async function fetchPersonLeaves(ids, email, name) {
  const merged = new Map()
  const jobs = []
  if (supabase && ids.length) {
    jobs.push(supabase.from('leave_requests').select(SELECT).in('user_id', ids))
  }

  const results = await Promise.allSettled(jobs)
  for (const result of results) {
    if (result.status !== 'fulfilled' || result.value?.error) continue
    for (const row of result.value?.data || []) addLeave(merged, rowToLeave(row))
  }
  if (merged.size > 0) return [...merged.values()]

  // The indexed lookup can come back empty when the signed-in id does not
  // match the id stored on the leave. The same collection read the leave
  // page uses still has the approved rows.
  try {
    const snap = await getDocs(collection(db, 'leaveRequests'))
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {}
      const leave = {
        ...data,
        leaveId: data.leaveId || docSnap.id,
        employeeId: data.employeeId || data.uid || '',
        uid: data.uid || data.employeeId || '',
      }
      if (belongsToPerson(leave, ids, email, name)) addLeave(merged, leave)
    })
  } catch (err) {
    console.error('[leaveRequestsLive] leave fallback error:', err)
  }
  return [...merged.values()]
}

const personKey = (ids, email, name) =>
  `${ids.join('|')}|${String(email || '').trim().toLowerCase()}|${String(name || '').trim().toLowerCase()}`

const ensurePersonChannel = (ids, email, name) => {
  const key = personKey(ids, email, name)
  const existing = channels.get(key)
  if (existing) return existing

  const listeners = new Set()
  let docs = null
  let ready = false
  let closed = false

  const publish = () => {
    listeners.forEach((listener) => listener(docs || [], ready))
  }

  const reload = () => fetchPersonLeaves(ids, email, name)

  const channel = {
    listeners,
    get latest() {
      return docs == null ? null : { docs, ready }
    },
    refresh() {
      if (closed) return
      reload()
        .then((next) => {
          if (closed) return
          docs = next
          ready = true
          publish()
        })
        .catch((err) => console.error('[leaveRequestsLive] leave refresh error:', err))
    },
    close() {
      if (closed) return
      closed = true
      channels.delete(key)
    },
  }

  channel.promise = reload()
    .then((list) => {
      docs = list
      ready = true
      if (closed) return list
      publish()
      ensureTableWatch()
      return list
    })
    .catch((err) => {
      console.error('[leaveRequestsLive] leave read error:', err)
      if (docs == null) docs = []
      ready = true
      if (!closed) publish()
    })

  channels.set(key, channel)
  return channel
}

export const preloadEmployeeLeaves = (ids, email, name) => {
  const unique = asIdList(ids)
  if (!unique.length && !email && !name) return Promise.resolve([])
  const channel = ensurePersonChannel(unique, email, name)
  return channel.promise.then(() => channel.latest?.docs || [])
}

export const subscribeLeaveMonth = (ids, year, monthIndex, onList, onError, email, name) => {
  const unique = asIdList(ids)
  if ((!unique.length && !email && !name) || !Number.isFinite(year) || !Number.isFinite(monthIndex)) return () => {}

  const channel = ensurePersonChannel(unique, email, name)
  let closed = false
  const listener = (docs, ready) => {
    if (closed) return
    const merged = (docs || []).filter((leave) => overlapsMonth(leave, year, monthIndex))
    try {
      onList(merged, ready)
    } catch (err) {
      onError?.(err)
    }
  }
  channel.listeners.add(listener)
  if (channel.latest) listener(channel.latest.docs, channel.latest.ready)

  return () => {
    closed = true
    channel.listeners.delete(listener)
    if (channel.listeners.size === 0) channel.close()
  }
}

export const subscribeLeaveRequestsForUids = (ids, onList, onError, email, name) => {
  const now = new Date()
  return subscribeLeaveMonth(ids, now.getFullYear(), now.getMonth(), onList, onError, email, name)
}
