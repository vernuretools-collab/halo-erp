import React from 'react'

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  }

  return (
    <div
      className={`animate-spin rounded-full border-slate-700 border-t-accent ${sizes[size]} ${className}`}
    />
  )
}
