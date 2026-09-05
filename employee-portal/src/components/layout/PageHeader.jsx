import React from 'react'

export const PageHeader = ({ title, description, actions, action, children }) => {
  const headerActions = actions || action || children
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 text-left">
      <div>
        <h1 className="text-2xl font-bold text-fg tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
      </div>
      {headerActions && <div className="flex items-center gap-3">{headerActions}</div>}
    </div>
  )
}

