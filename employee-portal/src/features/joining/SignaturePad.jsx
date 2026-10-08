import React, { useEffect, useRef } from 'react'
import { Eraser, PenLine, Upload } from 'lucide-react'

export function SignaturePad({ value, onChange, disabled }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const fileRef = useRef(null)
  const ownExport = useRef('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || value === ownExport.current) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (!value) return
    const image = new Image()
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    image.src = value
  }, [value])

  const point = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const source = event.touches ? event.touches[0] : event
    return {
      x: ((source.clientX - rect.left) / rect.width) * canvas.width,
      y: ((source.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const start = (event) => {
    if (disabled) return
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (event) => {
    if (!drawing.current || disabled) return
    event.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    const url = canvasRef.current.toDataURL('image/png')
    ownExport.current = url
    onChange(url)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ownExport.current = ''
    onChange('')
  }

  const upload = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height)
        const width = image.width * scale
        const height = image.height * scale
        ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
        const url = canvas.toDataURL('image/png')
        ownExport.current = url
        onChange(url)
      }
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm text-white">
          <PenLine className="w-4 h-4" /> Draw signature
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-700 px-3 py-2 text-sm text-teal-800 disabled:opacity-50"
        >
          <Upload className="w-4 h-4" /> Upload signature
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={clear}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-rose-500 px-3 py-2 text-sm text-rose-600 disabled:opacity-50"
        >
          <Eraser className="w-4 h-4" /> Clear
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={upload} />
      </div>
      <canvas
        ref={canvasRef}
        width={960}
        height={220}
        className="w-full h-40 rounded-xl border border-dashed border-slate-300 bg-white touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <p className="text-xs text-slate-400 text-center">Sign within this area</p>
    </div>
  )
}
