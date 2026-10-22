import { httpsCallable } from 'firebase/functions'
import { functions } from '../../../shared/services/firebaseService'
import { buildAssistantSnapshot, focusSnapshot } from './snapshotBuilder'
import { answerOperationalQuestion } from './operationalReports'

const askFn = httpsCallable(functions, 'askAdminAssistant', { timeout: 45000 })
const SNAPSHOT_TTL_MS = 60_000
let snapshotCache = { at: 0, snapshot: null }

export async function askAdminAssistant(message, history = []) {
  const compactHistory = (history || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-4)
    .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 800) }))

  if (!snapshotCache.snapshot || Date.now() - snapshotCache.at > SNAPSHOT_TTL_MS) {
    snapshotCache = { at: Date.now(), snapshot: await buildAssistantSnapshot() }
  }
  const local = answerOperationalQuestion(snapshotCache.snapshot, message, compactHistory)
  if (local) return local
  const snapshot = focusSnapshot(snapshotCache.snapshot, message)
  const result = await askFn({ message, history: compactHistory, snapshot })
  const data = result.data || { answer: '', toolsUsed: [] }
  if (/busy right now|which employee should i check/i.test(data.answer || '')) {
    return (
      answerOperationalQuestion(snapshotCache.snapshot, `${message} working today`, compactHistory) || {
        answer: 'I could not match that to attendance, projects, or timesheets. Try “who is working today”, “who is absent today”, or “what projects are going on”.',
        toolsUsed: ['attendance'],
      }
    )
  }
  return data
}
