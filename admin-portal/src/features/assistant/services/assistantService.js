import { httpsCallable } from 'firebase/functions'
import { functions } from '../../../shared/services/firebaseService'
import { buildAssistantSnapshot } from './snapshotBuilder'

const askFn = httpsCallable(functions, 'askAdminAssistant', { timeout: 120000 })

export async function askAdminAssistant(message, history = []) {
  const compactHistory = (history || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }))
  const snapshot = await buildAssistantSnapshot()
  const result = await askFn({ message, history: compactHistory, snapshot })
  return result.data || { answer: '', toolsUsed: [] }
}
