import { httpsCallable } from 'firebase/functions'
import { functions } from '../../../shared/services/firebaseService'
import { buildAssistantSnapshot, focusSnapshot } from './snapshotBuilder'

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
  const snapshot = focusSnapshot(snapshotCache.snapshot, message)
  const result = await askFn({ message, history: compactHistory, snapshot })
  return result.data || { answer: '', toolsUsed: [] }
}
