import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Bot, X } from 'lucide-react'
import { AssistantChat } from './AssistantChat'
import { useAdminAssistant } from './hooks/useAdminAssistant'

export function AdminAssistantWidget() {
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const { messages, loading, error, send, clear } = useAdminAssistant()

  if (location.pathname === '/assistant') return null

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[min(100vw-2rem,380px)] h-[min(72vh,560px)] bg-surface border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-chrome/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg">
              <Bot className="w-4 h-4 text-accent" />
              Admin Assistant
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg text-muted hover:text-fg hover:bg-border flex items-center justify-center"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-3">
            <AssistantChat
              compact
              messages={messages}
              loading={loading}
              error={error}
              onSend={send}
              onClear={clear}
            />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-2xl bg-accent text-white shadow-lg hover:opacity-90 flex items-center justify-center"
        aria-label="Open admin assistant"
      >
        {open ? <X className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
      </button>
    </>
  )
}
