import React, { useEffect, useRef, useState } from 'react'
import { formatTimecode, frameAt } from './qcService.js'

const COLORS = ['#ff3b30', '#ffd60a', '#30d158', '#0a84ff']

const SAFE_ZONES = {
  reels: { name: 'Reels', t: 0.11, b: 0.22, l: 0.05, r: 0.13 },
  shorts: { name: 'Shorts', t: 0.09, b: 0.24, l: 0.05, r: 0.14 },
  tiktok: { name: 'TikTok', t: 0.08, b: 0.25, l: 0.05, r: 0.14 },
}

function readSafeZone() {
  try {
    const value = localStorage.getItem('qc-safe') || ''
    return SAFE_ZONES[value] ? value : ''
  } catch {
    return ''
  }
}

function mediaRect(media, canvas) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const naturalWidth = media?.videoWidth || media?.naturalWidth || 16
  const naturalHeight = media?.videoHeight || media?.naturalHeight || 9
  const scale = Math.min(width / naturalWidth, height / naturalHeight)
  const boxWidth = naturalWidth * scale
  const boxHeight = naturalHeight * scale
  return { x: (width - boxWidth) / 2, y: (height - boxHeight) / 2, w: boxWidth, h: boxHeight }
}

function drawShape(ctx, shape, rect) {
  const point = (p) => [rect.x + p.x * rect.w, rect.y + p.y * rect.h]
  const width = Math.max(3, rect.w / 180)
  ctx.strokeStyle = shape.color
  ctx.fillStyle = shape.color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (shape.tool === 'pen' && shape.pts?.length) {
    ctx.beginPath()
    shape.pts.forEach((p, index) => {
      const [x, y] = point(p)
      if (index) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
    return
  }
  if (!shape.a || !shape.b) return
  const [x1, y1] = point(shape.a)
  const [x2, y2] = point(shape.b)
  if (shape.tool === 'box') {
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    return
  }
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = width * 4.5
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45))
  ctx.lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45))
  ctx.closePath()
  ctx.fill()
}

function drawSafeLayer(ctx, canvas, media, zoneId) {
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  const zone = SAFE_ZONES[zoneId]
  if (!zone || !media) return
  const rect = mediaRect(media, canvas)
  const top = rect.h * zone.t
  const bottom = rect.h * zone.b
  const left = rect.w * zone.l
  const right = rect.w * zone.r
  ctx.save()
  ctx.fillStyle = 'rgba(255,69,58,.24)'
  ctx.fillRect(rect.x, rect.y, rect.w, top)
  ctx.fillRect(rect.x, rect.y + rect.h - bottom, rect.w, bottom)
  ctx.fillRect(rect.x, rect.y + top, left, rect.h - top - bottom)
  ctx.fillRect(rect.x + rect.w - right, rect.y + top, right, rect.h - top - bottom)
  ctx.setLineDash([6, 5])
  ctx.strokeStyle = 'rgba(255,255,255,.85)'
  ctx.lineWidth = 1.5
  ctx.strokeRect(rect.x + left, rect.y + top, rect.w - left - right, rect.h - top - bottom)
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.font = `600 ${Math.max(10, Math.min(13, rect.w / 32))}px system-ui`
  ctx.textAlign = 'center'
  ctx.fillText('Top bar · keep clear', rect.x + rect.w / 2, rect.y + top / 2 + 4)
  ctx.fillText('Caption · name · audio', rect.x + rect.w / 2, rect.y + rect.h - bottom / 2 + 4)
  ctx.save()
  ctx.translate(rect.x + rect.w - right / 2, rect.y + rect.h / 2)
  ctx.rotate(Math.PI / 2)
  ctx.fillText('Like · comment · share', 0, 4)
  ctx.restore()
  ctx.fillText(`${zone.name} safe zone`, rect.x + rect.w / 2, rect.y + top + 18)
  ctx.restore()
}

const FPS = 30

function pad2(value) {
  return String(value).padStart(2, '0')
}

function smpte(seconds) {
  const frames = Math.max(0, Math.floor((Number(seconds) || 0) * FPS + 1e-4))
  const frame = frames % FPS
  const whole = Math.floor(frames / FPS)
  return `${pad2(Math.floor(whole / 3600))}:${pad2(Math.floor(whole / 60) % 60)}:${pad2(whole % 60)}:${pad2(frame)}`
}

function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4v16l13-8z" />
    </svg>
  )
}

function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="2.5" height="14" rx="1" />
      <path d="M19 5v14L9 12z" />
    </svg>
  )
}

function IconForward() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="16.5" y="5" width="2.5" height="14" rx="1" />
      <path d="M5 5v14l10-7z" />
    </svg>
  )
}

function IconSound({ muted }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
      {muted ? <path d="m16 9 6 6M22 9l-6 6" /> : <path d="M16 9a4 4 0 0 1 0 6" />}
    </svg>
  )
}

function IconFull() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  )
}

function StageMedia({ url, kind, mediaRef, muted = false, onReady }) {
  if (!url) return <p className="p-6 text-sm text-white/70">Opening file…</p>
  if (kind === 'image') {
    return <img ref={mediaRef} src={url} alt="" className="absolute inset-0 h-full w-full object-contain" onLoad={onReady} />
  }
  return (
    <video
      ref={mediaRef}
      key={url}
      src={url}
      className="absolute inset-0 h-full w-full object-contain"
      playsInline
      muted={muted}
      onLoadedMetadata={onReady}
    />
  )
}

export function QcStage({
  url,
  kind,
  notes = [],
  focusId,
  seekToken,
  seekTime,
  drawing,
  shapes,
  onShapes,
  onTime,
  onPickNote,
  freezeToken = 0,
  compareOptions = [],
}) {
  const mediaRef = useRef(null)
  const compareRef = useRef(null)
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const safeRef = useRef(null)
  const dragRef = useRef(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [paintKey, setPaintKey] = useState(0)
  const [safeZone, setSafeZone] = useState(readSafeZone)
  const [compareId, setCompareId] = useState('')
  const [wipe, setWipe] = useState(0.5)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [inPoint, setInPoint] = useState(null)
  const [outPoint, setOutPoint] = useState(null)
  const [loopOn, setLoopOn] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDrag = useRef(null)
  const loopRef = useRef({ on: false, start: null, end: null })
  loopRef.current = { on: loopOn, start: inPoint, end: outPoint }

  const compare = !drawing && compareOptions.find((option) => option.id === compareId && option.url)

  useEffect(() => {
    if (!compareOptions.some((option) => option.id === compareId)) setCompareId('')
  }, [compareOptions, compareId])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video') return
    media.muted = muted
    media.volume = muted ? 0 : 1
  }, [muted, url, kind])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video') return undefined
    const report = () => {
      const time = media.currentTime || 0
      const frame = frameAt(time)
      const label = `${formatTimecode(time)} · F${frame}`
      setCurrent(time)
      setDuration(Number.isFinite(media.duration) ? media.duration : 0)
      const loop = loopRef.current
      const length = Number.isFinite(media.duration) ? media.duration : 0
      if (loop.on && loop.start != null && length) {
        const end = loop.end ?? length
        if (time >= end - 0.5 / FPS) seekBoth(loop.start)
      }
      onTimeRef.current?.({ timeSeconds: time, timecode: label, frameNumber: frame })
      const other = compareRef.current
      if (other && typeof other.currentTime === 'number' && Math.abs(other.currentTime - time) > 0.12) {
        other.currentTime = time
      }
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    media.addEventListener('timeupdate', report)
    media.addEventListener('seeked', report)
    media.addEventListener('loadedmetadata', report)
    media.addEventListener('play', onPlay)
    media.addEventListener('pause', onPause)
    return () => {
      media.removeEventListener('timeupdate', report)
      media.removeEventListener('seeked', report)
      media.removeEventListener('loadedmetadata', report)
      media.removeEventListener('play', onPlay)
      media.removeEventListener('pause', onPause)
    }
  }, [url, kind, compare?.id])

  const drawAtRef = useRef(null)

  useEffect(() => {
    if (drawing) {
      drawAtRef.current = mediaRef.current?.currentTime ?? 0
      mediaRef.current?.pause()
      compareRef.current?.pause?.()
    }
  }, [drawing])

  useEffect(() => {
    if (!freezeToken) return
    mediaRef.current?.pause()
    compareRef.current?.pause?.()
  }, [freezeToken])

  useEffect(() => {
    const other = compareRef.current
    const media = mediaRef.current
    if (!other || !media || typeof other.currentTime !== 'number') return undefined
    const sync = () => {
      other.currentTime = media.currentTime || 0
    }
    other.addEventListener('loadedmetadata', sync)
    sync()
    return () => other.removeEventListener('loadedmetadata', sync)
  }, [compare?.id, compare?.url])

  const seekRef = useRef({ token: 0, time: null })
  seekRef.current = { token: seekToken, time: seekTime }

  function applySeek() {
    const media = mediaRef.current
    const time = seekRef.current.time
    if (!media || kind !== 'video' || time == null || !seekRef.current.token) return
    const go = () => {
      media.pause()
      media.currentTime = time
      const other = compareRef.current
      if (other) {
        other.pause()
        other.currentTime = time
      }
    }
    if (media.readyState >= 1) go()
    else media.addEventListener('loadedmetadata', go, { once: true })
  }

  useEffect(() => {
    applySeek()
  }, [seekToken, seekTime, kind, url, compare?.id])

  useEffect(() => {
    const canvas = canvasRef.current
    const safeCanvas = safeRef.current
    const media = mediaRef.current
    if (!canvas || !safeCanvas) return undefined
    const paint = () => {
      const ratio = window.devicePixelRatio || 1
      for (const node of [canvas, safeCanvas]) {
        const ctx = node.getContext('2d')
        node.width = node.clientWidth * ratio
        node.height = node.clientHeight * ratio
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, node.clientWidth, node.clientHeight)
      }
      const rect = mediaRect(media, canvas)
      const time = media?.currentTime || 0
      let visible = []
      if (kind !== 'video') {
        const focused = notes.find((note) => note.id === focusId)
        visible = drawing ? [...shapes, dragRef.current].filter(Boolean) : focused?.shapes || []
      } else if (drawing && frameAt(time) === frameAt(drawAtRef.current)) {
        visible = [...shapes, dragRef.current].filter(Boolean)
      } else if (!drawing) {
        visible = notes
          .filter((note) => note.shapes?.length && frameAt(note.time_seconds) === frameAt(time))
          .flatMap((note) => note.shapes)
      }
      visible.forEach((shape) => drawShape(canvas.getContext('2d'), shape, rect))
      drawSafeLayer(safeCanvas.getContext('2d'), safeCanvas, media, safeZone)
    }
    paint()
    media?.addEventListener('timeupdate', paint)
    media?.addEventListener('seeked', paint)
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      media?.removeEventListener('timeupdate', paint)
      media?.removeEventListener('seeked', paint)
    }
  }, [url, kind, notes, focusId, drawing, shapes, paintKey, safeZone, compare?.id])

  function pointerPoint(event) {
    const canvas = canvasRef.current
    const rect = mediaRect(mediaRef.current, canvas)
    const bounds = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left - rect.x) / rect.w)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top - rect.y) / rect.h)),
    }
  }

  function seekBoth(time) {
    const next = Math.max(0, time)
    const media = mediaRef.current
    const other = compareRef.current
    if (media && typeof media.currentTime === 'number') media.currentTime = next
    if (other && typeof other.currentTime === 'number') other.currentTime = next
  }

  function step(frames) {
    const media = mediaRef.current
    if (!media || kind !== 'video') return
    const next = frameAt(media.currentTime) + frames
    media.pause()
    compareRef.current?.pause()
    seekBoth((next + 0.5) / 30)
  }

  function togglePlay() {
    const media = mediaRef.current
    if (!media || kind !== 'video' || drawing) return
    const other = compareRef.current
    if (media.paused) {
      if (other) other.currentTime = media.currentTime
      media.play()
      other?.play?.()
    } else {
      media.pause()
      other?.pause?.()
    }
  }

  function markIn() {
    const time = mediaRef.current?.currentTime || 0
    setInPoint(time)
    setOutPoint((end) => (end != null && end <= time ? null : end))
    setLoopOn(true)
  }

  function markOut() {
    const time = mediaRef.current?.currentTime || 0
    setOutPoint(time)
    setInPoint((start) => (start == null || start >= time ? 0 : start))
    setLoopOn(true)
  }

  function toggleLoop() {
    setLoopOn((on) => {
      if (!on && inPoint == null) setInPoint(0)
      return !on
    })
  }

  function toggleMute() {
    setMuted((value) => !value)
  }

  function toggleFull() {
    const node = rootRef.current
    if (!node) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else node.requestFullscreen?.()
  }

  function toggleZoom() {
    if (zoomScale > 1) {
      setZoomScale(1)
      setPan({ x: 0, y: 0 })
      return
    }
    const view = stageRef.current
    const media = mediaRef.current
    const width = media?.videoWidth || media?.naturalWidth || 0
    const height = media?.videoHeight || media?.naturalHeight || 0
    const fit = view && width && height ? Math.min(view.clientWidth / width, view.clientHeight / height) : 0.5
    setZoomScale(Math.max(1.01, 1 / fit) <= 1.01 ? 2 : Math.max(1.01, 1 / fit))
  }

  function chooseSafe(next) {
    setSafeZone(next)
    try {
      localStorage.setItem('qc-safe', next)
    } catch {
      /* the overlay still works for this visit */
    }
  }

  return (
    <div ref={rootRef} className="overflow-hidden rounded-xl bg-black">
      <div className="flex flex-wrap items-center gap-2 bg-zinc-900 px-3 py-2">
        <span className="text-xs text-white/70">Safe zone</span>
        {[
          ['', 'Off'],
          ['reels', 'Reels'],
          ['shorts', 'Shorts'],
          ['tiktok', 'TikTok'],
        ].map(([id, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={safeZone === id}
            onClick={() => chooseSafe(id)}
            className={`rounded-lg px-2 py-1 text-xs ${
              safeZone === id ? 'bg-white text-black' : 'bg-white/10 text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div
        ref={stageRef}
        style={{ height: 420 }}
        className={`relative w-full overflow-hidden bg-black ${
          kind === 'video' && !drawing && zoomScale === 1 ? 'cursor-pointer' : ''
        } ${zoomScale > 1 ? 'cursor-grab' : ''}`}
        onClick={(event) => {
          if (kind !== 'video' || drawing || zoomScale > 1) return
          if (event.target.closest('[role="slider"]')) return
          togglePlay()
        }}
        onPointerDown={(event) => {
          if (zoomScale === 1 || drawing || event.target.closest('[role="slider"]')) return
          panDrag.current = { x: event.clientX - pan.x, y: event.clientY - pan.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!panDrag.current) return
          setPan({ x: event.clientX - panDrag.current.x, y: event.clientY - panDrag.current.y })
        }}
        onPointerUp={() => {
          panDrag.current = null
        }}
      >
        <div
          className="absolute inset-0 h-full w-full"
          style={
            zoomScale > 1
              ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`, transformOrigin: '0 0' }
              : undefined
          }
        >
        <StageMedia
          url={url}
          kind={kind}
          mediaRef={mediaRef}
          muted={muted}
          onReady={() => {
            setPaintKey((value) => value + 1)
            applySeek()
          }}
        />
        {compare && (
          <div className="pointer-events-none absolute inset-0" style={{ clipPath: `inset(0 0 0 ${wipe * 100}%)` }}>
            <StageMedia url={compare.url} kind={compare.kind} mediaRef={compareRef} muted />
          </div>
        )}
        {compare && (
          <>
            <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
              This version
            </span>
            <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">
              {compare.label}
            </span>
            <div
              role="slider"
              aria-label="Compare wipe"
              aria-valuemin={2}
              aria-valuemax={98}
              aria-valuenow={Math.round(wipe * 100)}
              className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize"
              style={{ left: `${wipe * 100}%` }}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                const bounds = stageRef.current?.getBoundingClientRect()
                if (!bounds?.width) return
                const next = (event.clientX - bounds.left) / bounds.width
                setWipe(Math.min(0.98, Math.max(0.02, next)))
              }}
            >
              <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white" />
            </div>
          </>
        )}
        <canvas ref={safeRef} className="pointer-events-none absolute inset-0 h-full w-full bg-transparent" />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full bg-transparent ${drawing ? 'z-20 cursor-crosshair' : 'pointer-events-none'}`}
          onPointerDown={(event) => {
            if (!drawing) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            const point = pointerPoint(event)
            dragRef.current = tool === 'pen' ? { tool, color, pts: [point] } : { tool, color, a: point, b: point }
            setPaintKey((value) => value + 1)
          }}
          onPointerMove={(event) => {
            if (!dragRef.current) return
            const point = pointerPoint(event)
            if (dragRef.current.tool === 'pen') dragRef.current.pts.push(point)
            else dragRef.current.b = point
            setPaintKey((value) => value + 1)
          }}
          onPointerUp={() => {
            const current = dragRef.current
            dragRef.current = null
            if (!current) return
            const keep =
              current.tool === 'pen'
                ? current.pts.length > 1
                : Math.hypot(current.b.x - current.a.x, current.b.y - current.a.y) > 0.01
            if (keep) {
              if (current.tool === 'pen' && current.pts.length > 300) {
                current.pts = current.pts.filter((_, index) => index % 2 === 0)
              }
              onShapes?.([...shapes, current])
            } else {
              setPaintKey((value) => value + 1)
            }
          }}
        />
        </div>
      </div>
      {kind === 'video' && url && (
        <div className="space-y-2 bg-zinc-950 px-3 py-2 text-xs text-white">
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" aria-label={playing ? 'Pause' : 'Play'} title="Play / pause" className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white" onClick={togglePlay}>
              {playing ? <IconPause /> : <IconPlay />}
            </button>
            <button type="button" aria-label="Back one frame" title="Back one frame" className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white" onClick={() => step(-1)}>
              <IconBack />
            </button>
            <button type="button" aria-label="Forward one frame" title="Forward one frame" className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white" onClick={() => step(1)}>
              <IconForward />
            </button>
            <span className="px-2 font-medium tabular-nums text-white/80">
              <b className="text-white">F {frameAt(current).toLocaleString('en-US')}</b>
              {` · ${smpte(current)} · ${FPS} fps`}
            </span>
            <div
              className="relative h-7 min-w-[8rem] flex-1 cursor-pointer"
              onPointerDown={(event) => {
                if (event.target.closest('[data-mark]')) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (!bounds.width || !duration) return
                const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width))
                mediaRef.current?.pause()
                seekBoth(ratio * duration)
              }}
            >
              <span className="absolute left-0 right-0 top-3 h-1 rounded-full bg-white/20" />
              <span
                className="absolute left-0 top-3 h-1 rounded-full bg-white"
                style={{ width: `${duration ? (current / duration) * 100 : 0}%` }}
              />
              {inPoint != null && duration > 0 && (
                <span
                  className="absolute top-2 h-3 bg-white/30"
                  style={{
                    left: `${(inPoint / duration) * 100}%`,
                    width: `${Math.max(0.4, (((outPoint ?? duration) - inPoint) / duration) * 100)}%`,
                  }}
                />
              )}
              {duration > 0 &&
                notes
                  .filter((note) => note.time_seconds != null)
                  .map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      data-mark="1"
                      title={note.body || note.timecode}
                      aria-label={note.body || `Mark at ${note.timecode}`}
                      className={`absolute top-1 h-4 w-1.5 -translate-x-1/2 rounded-sm ${
                        note.id === focusId ? 'bg-amber-300' : 'bg-amber-400'
                      }`}
                      style={{ left: `${(Number(note.time_seconds) / duration) * 100}%` }}
                      onClick={() => onPickNote?.(note)}
                    />
                  ))}
            </div>
            <button type="button" aria-pressed={inPoint != null} className={`h-8 rounded-lg px-2 ${inPoint != null ? 'bg-white text-black' : 'bg-white/10 text-white'}`} onClick={markIn}>
              In
            </button>
            <button type="button" aria-pressed={outPoint != null} className={`h-8 rounded-lg px-2 ${outPoint != null ? 'bg-white text-black' : 'bg-white/10 text-white'}`} onClick={markOut}>
              Out
            </button>
            <button type="button" aria-pressed={loopOn} className={`h-8 rounded-lg px-2 ${loopOn ? 'bg-white text-black' : 'bg-white/10 text-white'}`} onClick={toggleLoop}>
              Loop
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" aria-pressed={zoomScale > 1} title="Zoom to real pixels" className={`h-8 rounded-lg px-2 ${zoomScale > 1 ? 'bg-white text-black' : 'bg-white/10 text-white'}`} onClick={toggleZoom}>
              100%
            </button>
            <select
              aria-label="Compare"
              value={drawing ? '' : compareId}
              disabled={drawing || compareOptions.length === 0}
              onChange={(event) => {
                setCompareId(event.target.value)
                setWipe(0.5)
              }}
              className="h-8 rounded-lg bg-white/10 px-2 text-xs text-white disabled:opacity-40"
            >
              <option value="">Compare: off</option>
              {compareOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  Compare with {option.label}
                </option>
              ))}
            </select>
            <span className="flex-1" />
            <button type="button" aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} className={`inline-grid h-8 w-8 place-items-center rounded-lg ${muted ? 'bg-white' : 'bg-white/10 text-white'}`} onClick={toggleMute}>
              <IconSound muted={muted} />
            </button>
            <button type="button" aria-label="Full screen" title="Full screen" className="inline-grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white" onClick={toggleFull}>
              <IconFull />
            </button>
          </div>
        </div>
      )}
      {drawing && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900 px-3 py-2">
          {[
            ['pen', 'Pen'],
            ['box', 'Box'],
            ['arrow', 'Arrow'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
              className={`rounded-lg px-2 py-1 text-xs ${tool === id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
            >
              {label}
            </button>
          ))}
          {COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => setColor(swatch)}
              className={`h-5 w-5 rounded-full ${color === swatch ? 'ring-2 ring-white' : ''}`}
              style={{ background: swatch }}
            />
          ))}
          <button
            type="button"
            className="rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            onClick={() => onShapes?.(shapes.slice(0, -1))}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}
