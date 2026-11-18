import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { loadSearchIndex, searchAdmin } from './adminSearchIndex'
import { useUserStore } from '../../stores/userStore'
import { employeeCanSeeQc } from '../../../../shared/qc/qcAccess.js'

const shortcutLabel = (() => {
  if (typeof navigator === 'undefined') return 'Ctrl K'
  const platform = `${navigator.platform || ''} ${navigator.userAgent || ''}`
  return /Mac|iPhone|iPad/.test(platform) ? '⌘K' : 'Ctrl K'
})()

export const AdminSearch = () => {
  const navigate = useNavigate()
  const { claims, userDoc } = useUserStore()
  const hideQc = (claims?.role || userDoc?.role) === 'employee' && !employeeCanSeeQc(userDoc)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)

  const results = useMemo(() => {
    const rows = searchAdmin(query, index)
    if (!hideQc) return rows
    return rows.filter((row) => row.href !== '/qc')
  }, [query, index, hideQc])

  useEffect(() => {
    setActive(0)
  }, [query, results.length])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open || active < 0) return undefined
    const node = rootRef.current?.querySelector(`[data-search-index="${active}"]`)
    node?.scrollIntoView({ block: 'nearest' })
    return undefined
  }, [active, open, results])

  const ensureIndex = () => {
    setLoading(true)
    loadSearchIndex()
      .then((data) => setIndex(data))
      .finally(() => setLoading(false))
  }

  const openResult = (item) => {
    if (!item?.href) return
    setOpen(false)
    setQuery('')
    navigate(item.href)
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!open) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!results.length) return
      setActive((current) => (current + 1) % results.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!results.length) return
      setActive((current) => (current - 1 + results.length) % results.length)
      return
    }
    if (event.key === 'Enter' && results[active]) {
      event.preventDefault()
      openResult(results[active])
    }
  }

  let lastGroup = ''

  return (
    <div ref={rootRef} className="relative w-full">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="admin-search-results"
        aria-activedescendant={results[active] ? `admin-search-item-${active}` : undefined}
        value={query}
        placeholder="Search employees, clients, leads, projects..."
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          ensureIndex()
        }}
        onKeyDown={onKeyDown}
        className="w-full bg-surface border border-border text-xs text-fg placeholder-muted rounded-xl pl-9 pr-16 py-2 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted bg-chrome px-1.5 py-0.5 rounded border border-border pointer-events-none">
        {shortcutLabel}
      </div>

      {open && (
        <div
          id="admin-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border border-border bg-surface shadow-lg"
        >
          {!query.trim() && (
            <p className="px-3 py-3 text-xs text-muted">
              Search employees, clients, leads, projects, and invoices.
            </p>
          )}

          {query.trim() && !index && loading && results.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted">Searching records…</p>
          )}

          {query.trim() && index?.error && (
            <p className="px-3 py-2 text-xs text-rose-500 border-b border-border">{index.error}</p>
          )}

          {query.trim() && index && results.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted">No results</p>
          )}

          {query.trim() &&
            results.map((item, indexInList) => {
              const showGroup = item.group !== lastGroup
              lastGroup = item.group
              const selected = indexInList === active
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {item.group}
                    </p>
                  )}
                  <button
                    id={`admin-search-item-${indexInList}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-search-index={indexInList}
                    onMouseEnter={() => setActive(indexInList)}
                    onClick={() => openResult(item)}
                    className={`w-full text-left px-3 py-2 cursor-pointer ${
                      selected ? 'bg-accent-soft' : 'hover:bg-chrome'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-fg truncate">{item.title}</span>
                    {item.subtitle && (
                      <span className="block text-[11px] text-muted truncate">{item.subtitle}</span>
                    )}
                  </button>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
