import React, { useState } from 'react'
import { Eye, EyeOff, Calendar } from 'lucide-react'

const TRAILING_ICON_BTN =
  'absolute inset-y-0 right-0 z-20 w-10 flex items-center justify-center text-muted hover:text-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-r-xl cursor-pointer'

function openNativePicker(inputEl) {
  if (!inputEl) return
  if (typeof inputEl.showPicker === 'function') {
    try {
      inputEl.showPicker()
      return
    } catch {
      /* fall through */
    }
  }
  inputEl.focus()
}

export function NativePickerInput({ type = 'date', className = '', ...props }) {
  return (
    <div className="relative">
      <input
        type={type}
        onClick={(e) => openNativePicker(e.currentTarget)}
        className={`${className} pr-10 [color-scheme:light] dark:[color-scheme:dark] cursor-pointer`}
        {...props}
      />
      <button
        type="button"
        onClick={(e) => openNativePicker(e.currentTarget.parentElement?.querySelector('input'))}
        className={TRAILING_ICON_BTN}
        tabIndex={-1}
        aria-label="Open calendar"
      >
        <Calendar className="w-4 h-4" strokeWidth={2.25} />
      </button>
    </div>
  )
}

export const Input = ({
  label,
  error,
  icon: customIcon,
  className = '',
  id,
  type,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const inputId = id || props.name || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  const isPasswordType = type === 'password'
  const isDateType = type === 'date' || type === 'datetime-local' || type === 'time' || type === 'month'
  const computedType = isPasswordType ? (showPassword ? 'text' : 'password') : type
  const Icon = customIcon

  const handleOpenPicker = (e) => {
    const container = e.currentTarget.closest('.relative')
    const inputEl = container?.querySelector('input')
    if (inputEl && typeof inputEl.showPicker === 'function') {
      try {
        inputEl.showPicker()
      } catch {
        inputEl.focus()
      }
    } else if (inputEl) {
      inputEl.focus()
    }
  }

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-fg flex items-center gap-1.5">
          {label}
        </label>
      )}
      <div className="relative rounded-xl">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted z-10">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          id={inputId}
          type={computedType}
          onClick={(e) => {
            if (isDateType && typeof e.target.showPicker === 'function') {
              try { e.target.showPicker() } catch {}
            }
            props.onClick?.(e)
          }}
          className={`w-full bg-surface border ${
            error ? 'border-rose-500/80 focus:ring-rose-500' : 'border-border focus:border-accent focus:ring-accent/20'
          } text-fg placeholder-muted text-sm rounded-xl py-2.5 ${
            Icon ? 'pl-10' : 'pl-3.5'
          } ${isPasswordType || isDateType ? 'pr-10' : 'pr-3.5'} [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer transition-all focus:outline-none focus:ring-2 ${className}`}
          {...props}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className={TRAILING_ICON_BTN}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" strokeWidth={2.25} /> : <Eye className="w-4 h-4" strokeWidth={2.25} />}
          </button>
        )}
        {isDateType && (
          <button
            type="button"
            onClick={handleOpenPicker}
            className={TRAILING_ICON_BTN}
            tabIndex={-1}
            aria-label="Open calendar"
          >
            <Calendar className="w-4 h-4" strokeWidth={2.25} />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-rose-500 dark:text-rose-400 mt-1">{error}</p>}
    </div>
  )
}
