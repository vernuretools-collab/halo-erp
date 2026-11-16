import React, { useEffect, useRef, useState } from 'react'
import { formatTimecode, frameAt } from './qcService.js'

const COLORS = ['#ff3b30', '#ffd60a', '#30d158', '#0a84ff']

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
}) {
  const mediaRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const onTimeRef = useRef(onTime)
  onTimeRef.current = onTime
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [readout, setReadout] = useState('0:00.00 · F0')
  const [paintKey, setPaintKey] = useState(0)

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video') return undefined
    const report = () => {
      const time = media.currentTime || 0
      const frame = frameAt(time)
      const label = `${formatTimecode(time)} · F${frame}`
      setReadout(label)
      onTimeRef.current?.({ timeSeconds: time, timecode: label, frameNumber: frame })
    }
    media.addEventListener('timeupdate', report)
    media.addEventListener('seeked', report)
    media.addEventListener('loadedmetadata', report)
    return () => {
      media.removeEventListener('timeupdate', report)
      media.removeEventListener('seeked', report)
      media.removeEventListener('loadedmetadata', report)
    }
  }, [url, kind])

  useEffect(() => {
    if (drawing) mediaRef.current?.pause()
  }, [drawing])

  useEffect(() => {
    const media = mediaRef.current
    if (!media || kind !== 'video' || seekTime == null) return
    media.pause()
    media.currentTime = seekTime
  }, [seekToken, seekTime, kind])

  useEffect(() => {
    const canvas = canvasRef.current
    const media = mediaRef.current
    if (!canvas) return undefined
    const paint = () => {
      const ctx = canvas.getContext('2d')
      const ratio = window.devicePixelRatio || 1
      canvas.width = canvas.clientWidth * ratio
      canvas.height = canvas.clientHeight * ratio
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      const rect = mediaRect(media, canvas)
      const focused = notes.find((note) => note.id === focusId)
      const visible = drawing ? [...shapes, dragRef.current].filter(Boolean) : focused?.shapes || []
      visible.forEach((shape) => drawShape(ctx, shape, rect))
    }
    paint()
    const observer = new ResizeObserver(paint)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [url, kind, notes, focusId, drawing, shapes, paintKey])

  function pointerPoint(event) {
    const canvas = canvasRef.current
    const rect = mediaRect(mediaRef.current, canvas)
    const bounds = canvas.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left - rect.x) / rect.w)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top - rect.y) / rect.h)),
    }
  }

  function step(frames) {
    const media = mediaRef.current
    if (!media || kind !== 'video') return
    const next = frameAt(media.currentTime) + frames
    media.pause()
    media.currentTime = Math.max(0, (next + 0.5) / 30)
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <div className="relative aspect-video max-h-[480px] w-full">
        {url && kind === 'image' ? (
          <img ref={mediaRef} src={url} alt="" className="h-full w-full object-contain" />
        ) : url ? (
          <video ref={mediaRef} key={url} src={url} className="h-full w-full object-contain" />
        ) : (
          <p className="p-6 text-sm text-white/70">Opening file…</p>
        )}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full ${drawing ? 'cursor-crosshair' : 'pointer-events-none'}`}
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
          <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => {
            const media = mediaRef.current
            if (!media) return
            if (media.paused) media.play()
            else media.pause()
          }}>
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
