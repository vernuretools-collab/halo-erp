import { useCallback, useEffect, useState } from 'react'
import { askAdminAssistant } from '../services/assistantService'

const STORAGE_KEY = 'admin-assistant-v1'

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const SUGGESTED_QUESTIONS = [
  'How many employees are present today?',
  'How many days was this employee absent this month?',
  'How many WFH days did this employee take this month?',
  'Show timeline hours for this employee this month',
  'Which projects is this employee assigned to?',
  'How many open leads are in the pipeline?',
  'Which invoices are unpaid?',
]

export function useAdminAssistant() {
  const [messages, setMessages] = useState(loadMessages)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      /* ignore quota */
    }
  }, [messages])

  const send = useCallback(async (text) => {
    const message = String(text || '').trim()
    if (!message || loading) return
    setError('')
    const userMsg = { id: `u_${Date.now()}`, role: 'user', content: message }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)
    try {
      const history = [...messages, userMsg]
      const data = await askAdminAssistant(message, history)
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.answer || 'No answer returned.',
          toolsUsed: data.toolsUsed || [],
        },
      ])
    } catch (err) {
      const code = err?.code || ''
      let msg = err?.message || 'Assistant request failed.'
      if (code === 'functions/failed-precondition' || /GEMINI_API_KEY/i.test(msg)) {
        msg = 'Gemini is not configured. Set GEMINI_API_KEY with firebase functions:secrets:set and deploy functions.'
      } else if (code === 'functions/unauthenticated') {
        msg = 'Sign in again to use the assistant.'
      } else if (code === 'functions/not-found' || /NOT_FOUND/i.test(msg)) {
        msg = 'Assistant Cloud Function is not deployed yet. Deploy functions, then try again.'
      }
      setError(msg)
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content: msg,
          error: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading, messages])

  const clear = useCallback(() => {
    setMessages([])
    setError('')
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [])

  return { messages, loading, error, send, clear }
}
