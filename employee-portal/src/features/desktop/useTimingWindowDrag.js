import { useRef } from 'react'

export function useTimingWindowDrag() {
  const drag = useRef(null)

  const onPointerDown = (event) => {
    if (event.button !== 0) return
    if (event.target.closest('[data-no-drag="true"]')) return
    if (typeof window.desktop?.moveMyTimingBy !== 'function') return
    drag.current = { lastX: event.screenX, lastY: event.screenY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event) => {
    const state = drag.current
    if (!state) return
    const dx = Math.round(event.screenX - state.lastX)
    const dy = Math.round(event.screenY - state.lastY)
    state.lastX = event.screenX
    state.lastY = event.screenY
    if (dx || dy) window.desktop.moveMyTimingBy({ dx, dy })
  }

  const onPointerUp = (event) => {
    drag.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  }
}
