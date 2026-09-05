import React from 'react'

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

  const variants = {
    primary:
      'bg-accent hover:opacity-90 text-white focus:ring-accent active:scale-[0.98]',
    secondary:
      'bg-chrome hover:bg-border text-fg border border-border focus:ring-accent/40 active:scale-[0.98]',
    outline:
      'border border-border bg-transparent hover:bg-chrome text-fg focus:ring-accent/40',
    ghost:
      'bg-transparent hover:bg-chrome text-muted hover:text-fg focus:ring-accent/40',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white focus:ring-rose-500 active:scale-[0.98]',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2.5 text-sm gap-2',
    lg: 'px-5 py-3 text-base gap-2.5',
  }

  return (
    <button
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  )
}
