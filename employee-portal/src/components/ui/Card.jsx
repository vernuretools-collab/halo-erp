import React from 'react'

export const Card = ({ children, className = '', hover = false, ...props }) => {
  return (
    <div
      className={`bg-surface border border-border rounded-2xl p-5 text-fg shadow-sm transition-colors ${
        hover ? 'transition-all duration-200 hover:border-accent/40 hover:shadow-sm' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
