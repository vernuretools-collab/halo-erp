import React from 'react'

export const Badge = ({ children, variant = 'info', className = '' }) => {
  const variants = {
    info: 'bg-info-soft text-info border-info/20',
    success: 'bg-success-soft text-success border-success/20',
    warning: 'bg-warning-soft text-warning border-warning/20',
    danger: 'bg-danger-soft text-danger border-danger/20',
    neutral: 'bg-chrome text-muted border-border',
    brand: 'bg-accent-soft text-accent border-accent/20',
    outline: 'bg-chrome text-fg border-border',
    default: 'bg-chrome text-fg border-border',
    primary: 'bg-accent-soft text-accent border-accent/20',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  )
}
