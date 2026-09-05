import React, { useEffect, useRef, useState } from 'react'
import { Bot, Send, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { SUGGESTED_QUESTIONS } from './hooks/useAdminAssistant'

export function AssistantChat({ messages, loading, error, onSend, onClear, compact = false }) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const submit = (e) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    onSend(text)
  }

  const showChips = messages.length === 0 && !loading

  return (
    <div className={`flex flex-col ${compact ? 'h-full min-h-0' : 'h-[min(70vh,640px)]'}`}>
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {showChips && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-sm text-muted">
              <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <p>
                Ask about attendance, WFH, leave, timelines, projects, leads, or invoices. Answers
                come from live CRM data.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSend(q)}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-border bg-chrome hover:border-accent/40 hover:text-fg text-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-accent text-white'
                  : m.error
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                    : 'bg-chrome border border-border text-fg'
              }`}
            >
              {m.role !== 'user' && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted mb-1">
                  <Bot className="w-3.5 h-3.5" /> Assistant
                </div>
              )}
              {m.content}
              {m.toolsUsed?.length > 0 && (
                <div className="mt-2 text-[10px] text-muted">Looked up: {m.toolsUsed.join(', ')}</div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-chrome border border-border rounded-2xl px-3.5 py-2.5 text-sm text-muted">
              Checking CRM records…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && messages[messages.length - 1]?.error !== true && (
        <p className="text-xs text-rose-500 mt-2">{error}</p>
      )}

      <form onSubmit={submit} className="mt-3 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={compact ? 2 : 3}
          placeholder="Ask about an employee, project, lead, or invoice…"
          className="flex-1 resize-none bg-surface border border-border rounded-xl px-3 py-2 text-sm text-fg placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
        />
        <div className="flex flex-col gap-2">
          <Button type="submit" size="sm" disabled={loading || !draft.trim()} icon={Send}>
            Send
          </Button>
          {messages.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={onClear} icon={Trash2}>
              Clear
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
