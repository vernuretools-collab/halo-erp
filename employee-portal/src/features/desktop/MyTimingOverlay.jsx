import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Timer } from 'lucide-react'
import { MyTimingCard } from './MyTimingCard'
import { useTeamStore } from '../team/stores/teamStore'

const HIDDEN_KEY = 'crm_my_timing_overlay_hidden'
const POS_KEY = 'crm_my_timing_overlay_pos'

export const MyTimingOverlay = () => {
  const isElectronDesktop = typeof window !== 'undefined' && Boolean(window.desktop?.hideMyTiming)
  const clockedIn = useTeamStore((s) => s.clockedIn)
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDDEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const [pos, setPos] = useState(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(POS_KEY) || 'null')
      if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) return parsed
    } catch {
      /* ignore */
    }
    return { x: null, y: null }
  })
  const drag = useRef(null)

  useEffect(() => {
    if (clockedIn && hidden) {
      setHidden(false)
      try {
        sessionStorage.removeItem(HIDDEN_KEY)
      } catch {
        /* ignore */
      }
    }
  }, [clockedIn, hidden])

  const hide = () => {
    setHidden(true)
    try {
      sessionStorage.setItem(HIDDEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  const onPointerDown = (event) => {
    if (!event.target?.closest?.('[data-timing-drag="true"]')) return
    event.preventDefault()
    const card = event.currentTarget
    const rect = card.getBoundingClientRect()
    drag.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    }
    card.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (!drag.current) return
    const x = Math.max(12, Math.min(window.innerWidth - 392, event.clientX - drag.current.dx))
    const y = Math.max(12, Math.min(window.innerHeight - 80, event.clientY - drag.current.dy))
    setPos({ x, y })
  }

  const onPointerUp = (event) => {
    if (!drag.current) return
    drag.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
      sessionStorage.setItem(POS_KEY, JSON.stringify(pos))
    } catch {
      /* ignore */
    }
  }

  const style =
    pos.x == null
      ? { right: 24, bottom: 24 }
      : { left: pos.x, top: pos.y }

  const node = hidden ? (
    <button
      type="button"
      onClick={() => {
        setHidden(false)
        try {
          sessionStorage.removeItem(HIDDEN_KEY)
        } catch {
          /* ignore */
        }
      }}
      className="fixed z-[2147483646] bottom-6 right-6 rounded-full bg-accent text-white shadow-lg px-3 py-2 text-xs font-extrabold flex items-center gap-1.5 hover:opacity-90"
      title="Show My Timing"
    >
      <Timer className="w-3.5 h-3.5" />
      My Timing
    </button>
  ) : (
    <div
      className="fixed z-[2147483646] w-[380px]"
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <MyTimingCard onHide={hide} />
    </div>
  )

  if (isElectronDesktop) return null

  return createPortal(node, document.body)
}
