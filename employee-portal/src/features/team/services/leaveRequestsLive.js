import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'

const mapDocs = (snap) => snap.docs.map((d) => ({ ...d.data(), leaveId: d.id }))

const mergeByLeaveId = (...lists) => {
  const map = new Map()
  lists.flat().forEach((item) => {
    const key = item?.leaveId || item?.id
    if (!key) return
    map.set(String(key), item)
  })
  return [...map.values()]
}

const leaveQueryForField = (field, ids) =>
  ids.length === 1
    ? query(collection(db, 'leaveRequests'), where(field, '==', ids[0]))
    : query(collection(db, 'leaveRequests'), where(field, 'in', ids))

export const subscribeLeaveRequestsForUids = (ids, onList, onError) => {
  const unique = [...new Set((ids || []).filter(Boolean).map(String))].slice(0, 30)
  if (!unique.length) return () => {}

  let employeeIdDocs = []
  let uidDocs = []

  const publish = () => onList(mergeByLeaveId(employeeIdDocs, uidDocs))

  const unsubEmployeeId = onSnapshot(
    leaveQueryForField('employeeId', unique),
    (snap) => {
      employeeIdDocs = mapDocs(snap)
      publish()
    },
    onError
  )
  const unsubUid = onSnapshot(
    leaveQueryForField('uid', unique),
    (snap) => {
      uidDocs = mapDocs(snap)
      publish()
    },
    onError
  )

  return () => {
    unsubEmployeeId()
    unsubUid()
  }
}
