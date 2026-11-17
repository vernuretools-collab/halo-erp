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

function StageMedia({ url, kind, mediaRef, muted = false, onReady }) {
  if (!url) return <p className="p-6 text-sm text-white/70">Opening file…</p>
  if (kind === 'image') {
    return <img ref={mediaRef} src={url} alt="" className="h-full w-full object-contain" onLoad={onReady} />
  }
  return (
    <video
      ref={mediaRef}
      key={url}
      src={url}
      className="h-full w-full object-contain"
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
  compareOptions = [],
}) {
  const mediaRef = useRef(null)
  const compareRef = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const safeRef = useRef(null)
  const dragRef = useRef(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [readout, setReadout] = useState('0:00.00 · F0')
  const [paintKey, setPaintKey] = useState(0)
  const [safeZone, setSafeZone] = useState(readSafeZone)
  const [compareId, setCompareId] = useState('')
  const [wipe, setWipe] = useState(0.5)

  const compare = !drawing && compareOptions.find((option) => option.id === compareId && option.url)

  useEffect(() => {
    if (!compareOptions.some((option) => option.id === compareId)) setCompareId('')
  }, [compareOptions, compareId])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video') return undefined
    const report = () => {
      const time = media.currentTime || 0
      const frame = frameAt(time)
      const label = `${formatTimecode(time)} · F${frame}`
      setReadout(label)
      onTimeRef.current?.({ timeSeconds: time, timecode: label, frameNumber: frame })
      const other = compareRef.current
      if (other && typeof other.currentTime === 'number' && Math.abs(other.currentTime - time) > 0.12) {
        other.currentTime = time
      }
    }
    media.addEventListener('timeupdate', report)
    media.addEventListener('seeked', report)
    media.addEventListener('loadedmetadata', report)
    return () => {
      media.removeEventListener('timeupdate', report)
      media.removeEventListener('seeked', report)
      media.removeEventListener('loadedmetadata', report)
    }
  }, [url, kind, compare?.id])

  useEffect(() => {
    if (drawing) {
      mediaRef.current?.pause()
      compareRef.current?.pause?.()
    }
  }, [drawing])

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

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video' || seekTime == null) return
    media.pause()
    media.currentTime = seekTime
    const other = compareRef.current
    if (other) {
      other.pause()
      other.currentTime = seekTime
    }
  }, [seekToken, seekTime, kind, compare?.id])

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
      const focused = notes.find((note) => note.id === focusId)
      const visible = drawing ? [...shapes, dragRef.current].filter(Boolean) : focused?.shapes || []
      visible.forEach((shape) => drawShape(canvas.getContext('2d'), shape, rect))
      drawSafeLayer(safeCanvas.getContext('2d'), safeCanvas, media, safeZone)
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
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
    if (!media || kind !== 'video') return
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

  function chooseSafe(next) {
    setSafeZone(next)
    try {
      localStorage.setItem('qc-safe', next)
    } catch {
      /* the overlay still works for this visit */
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black">
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
        {compareOptions.length > 0 && (
          <select
            aria-label="Compare"
            value={drawing ? '' : compareId}
            disabled={drawing}
            onChange={(event) => {
              setCompareId(event.target.value)
              setWipe(0.5)
            }}
            className="ml-auto rounded-lg bg-white/10 px-2 py-1 text-xs text-white disabled:opacity-40"
          >
            <option value="">Compare: off</option>
            {compareOptions.map((option) => (
              <option key={option.id} value={option.id}>
                Compare with {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div ref={stageRef} className="relative aspect-video max-h-[480px] w-full">
        <StageMedia url={url} kind={kind} mediaRef={mediaRef} onReady={() => setPaintKey((value) => value + 1)} />
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
        <canvas ref={safeRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full ${drawing ? 'z-20 cursor-crosshair' : 'pointer-events-none'}`}
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
      {kind === 'video' && url && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-950 px-3 py-2 text-xs text-white">
          <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={togglePlay}>
            Play / pause
          </button>
          <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => step(-1)}>
            Back one frame
          </button>
          <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => step(1)}>
            Forward one frame
          </button>
          <span className="font-medium">{readout}</span>
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
