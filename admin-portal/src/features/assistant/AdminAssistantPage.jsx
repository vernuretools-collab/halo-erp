import React from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { AssistantChat } from './AssistantChat'
import { useAdminAssistant } from './hooks/useAdminAssistant'

export function AdminAssistantPage() {
  const { messages, loading, error, send, clear } = useAdminAssistant()

  return (
    <div>
      <PageHeader
        title="Admin Assistant"
        description="Ask questions about team attendance, timelines, projects, CRM, and finance. Answers are grounded in live records."
      />
      <Card className="p-4 md:p-6">
        <AssistantChat
          messages={messages}
          loading={loading}
          error={error}
          onSend={send}
          onClear={clear}
        />
      </Card>
    </div>
  )
}
