import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../../../shared/services/firebaseService'
import {
  localDateKey,
  notifyBeforeMinutes,
} from './socialPostReminderSchedule'

export {
  CONTENT_TYPES,
  EARLY_MINUTES,
  NOTIFY_BEFORE_OPTIONS,
  PLATFORMS,
  REPEAT_OPTIONS,
  STATUS_LABEL,
  WEEKDAY_FULL,
  WEEKDAY_LABELS,
  contentLabel,
  formatTimeLabel,
  isAssignee,
  isPostedOn,
  joinTime12,
  localDateKey,
  notifyBeforeLabel,
  notifyBeforeMinutes,
  occurrenceStatus,
  occursOn,
  repeatSummary,
  resolveSocialPostPing,
  socialPostPingCopy,
  splitTime12,
  trailText,
} from './socialPostReminderSchedule'

const remindersRef = () => collection(db, 'socialPostReminders')

const mapDoc = (docSnap) => ({ id: docSnap.id, ...docSnap.data() })

export const subscribeMySocialPostReminders = (identityIds, callback, onError) => {
  const ids = [...new Set((identityIds || []).map(String).filter(Boolean))]
  if (!ids.length) {
    callback([])
    return () => {}
  }

  const buckets = { created: null, assigned: null }
  const emit = () => {
    if (buckets.created == null || buckets.assigned == null) return
    const merged = new Map()
    for (const row of [...buckets.created, ...buckets.assigned]) merged.set(row.id, row)
    callback([...merged.values()])
  }

  const listen = (field, bucket) =>
    onSnapshot(
      query(remindersRef(), where(field, 'in', ids)),
      (snapshot) => {
        buckets[bucket] = snapshot.docs.map(mapDoc)
        emit()
      },
      (err) => {
        console.error('Failed to load post reminders', err)
        buckets[bucket] = []
        emit()
        onError?.(err)
      }
    )

  const unsubs = [listen('createdBy', 'created'), listen('assigneeId', 'assigned')]
  return () => unsubs.forEach((unsub) => unsub())
}

export const addSocialPostReminder = async (data) => {
  return addDoc(remindersRef(), {
    clientId: String(data.clientId || ''),
    clientName: String(data.clientName || '').trim(),
    platform: data.platform,
    contentType: data.contentType,
    topic: String(data.topic || '').trim(),
    caption: String(data.caption || '').trim(),
    startDate: data.startDate,
    time: data.time,
    repeat: data.repeat || 'none',
    days: data.repeat === 'custom' && Array.isArray(data.days) ? data.days.map(Number) : [],
    endDate: data.repeat && data.repeat !== 'none' ? String(data.endDate || '') : '',
    notifyBeforeMinutes: notifyBeforeMinutes(data),
    assigneeId: String(data.assigneeId || ''),
    assigneeName: String(data.assigneeName || '').trim(),
    createdBy: String(data.createdBy || ''),
    enabled: data.enabled !== false,
    postedDates: [],
    lastEarlyAt: '',
    lastDueAt: '',
    createdAt: serverTimestamp(),
  })
}

export const updateSocialPostReminder = async (reminderId, updates) => {
  if (!reminderId) throw new Error('Reminder ID is required')
  return updateDoc(doc(db, 'socialPostReminders', reminderId), updates)
}

export const deleteSocialPostReminder = async (reminderId) => {
  if (!reminderId) throw new Error('Reminder ID is required')
  return deleteDoc(doc(db, 'socialPostReminders', reminderId))
}

export const markSocialPostPosted = async (reminderId, dateKey = localDateKey()) => {
  return updateSocialPostReminder(reminderId, {
    postedDates: arrayUnion(dateKey),
  })
}

export const unmarkSocialPostPosted = async (reminder, dateKey = localDateKey()) => {
  const dates = (Array.isArray(reminder?.postedDates) ? reminder.postedDates : []).filter((d) => d !== dateKey)
  return updateSocialPostReminder(reminder.id, { postedDates: dates })
}
