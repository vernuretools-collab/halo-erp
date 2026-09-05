import React, { useRef, useState, useEffect } from 'react'
import { PenTool, Type, RotateCcw, Check, ShieldCheck, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { useUIStore } from '../../stores/uiStore'

export const SignaturePad = ({
  agreementTitle,
  agreementSummary,
  agreementContent,
  initialData,
  onSave,
  required = true,
  showFullAgreementByDefault = true,
  allowToggle = true,
  onDownload,
}) => {
  const { theme } = useUIStore()
  const canvasRef = useRef(null)
  const [mode, setMode] = useState('draw') // 'draw' | 'type'
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signatoryName, setSignatoryName] = useState(initialData?.signatoryName || '')
  const [signatoryTitle, setSignatoryTitle] = useState(initialData?.signatoryTitle || '')
  const [typedSignature, setTypedSignature] = useState(initialData?.typedSignature || '')
  const [agreedToTerms, setAgreedToTerms] = useState(initialData?.signed || false)
  const [showFullAgreement, setShowFullAgreement] = useState(showFullAgreementByDefault)
  const [savedSignature, setSavedSignature] = useState(initialData || null)
  const [savingSignature, setSavingSignature] = useState(false)

  // Sync state when initialData changes
  useEffect(() => {
    setSavedSignature(initialData || null)
    setSignatoryName(initialData?.signatoryName || '')
    setSignatoryTitle(initialData?.signatoryTitle || '')
    setTypedSignature(initialData?.typedSignature || '')
    setAgreedToTerms(initialData?.signed || false)
  }, [initialData])

  // Initialize Canvas
  useEffect(() => {
    if (mode === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = theme === 'dark' ? '#38bdf8' : '#2563eb'
    }
  }, [mode, theme])

  // Helper to accurately map touch/mouse screen coordinates to canvas bitmap coordinates
  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    let clientX = 0
    let clientY = 0

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX
      clientY = e.changedTouches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }

    // Accurately map the screen coordinate to the canvas internal bitmap coordinate
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    }
  }

  // Canvas drawing handlers
  const startDrawing = (e) => {
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault()
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = theme === 'dark' ? '#38bdf8' : '#2563eb'
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    // Draw initial point immediately so single tap creates a mark
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    if (e.cancelable && e.type.startsWith('touch')) {
      e.preventDefault()
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasDrawn(true)
  }

  const stopDrawing = (e) => {
    if (isDrawing) {
      setIsDrawing(false)
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.closePath()
      }
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  const generateSignatureImageFromText = (text) => {
    const canvas = document.createElement('canvas')
    canvas.width = 450
    canvas.height = 150
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.font = 'italic 34px "Brush Script MT", "Caveat", "Segoe Script", cursive'
    ctx.fillStyle = theme === 'dark' ? '#38bdf8' : '#2563eb'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text || 'Signature', canvas.width / 2, canvas.height / 2)
    return canvas.toDataURL('image/png')
  }

  const handleConfirmSignature = () => {
    if (!signatoryName.trim()) {
      alert('Please enter the full legal name of the authorized signatory.')
      return
    }

    if (!agreedToTerms) {
      alert('Please review and check the agreement acknowledgment checkbox.')
      return
    }

    let signatureDataUrl = ''
    if (mode === 'draw') {
      if (!hasDrawn && !savedSignature?.signatureDataUrl) {
        alert('Please draw your signature in the designated box.')
        return
      }
      signatureDataUrl = canvasRef.current ? canvasRef.current.toDataURL('image/png') : savedSignature?.signatureDataUrl
    } else {
      if (!typedSignature.trim()) {
        alert('Please type your legal signature.')
        return
      }
      signatureDataUrl = generateSignatureImageFromText(typedSignature)
    }

    const signatureRecord = {
      signed: true,
      signatoryName: signatoryName.trim(),
      signatoryTitle: signatoryTitle.trim() || 'Authorized Representative',
      mode,
      signatureDataUrl,
      signedAt: new Date().toISOString(),
      timestampFormatted: new Date().toLocaleString(),
    }

    const commit = async () => {
      if (onSave) await onSave(signatureRecord)
      setSavedSignature(signatureRecord)
    }

    setSavingSignature(true)
    Promise.resolve(commit())
      .catch(() => {})
      .finally(() => setSavingSignature(false))
  }

  const handleResign = async () => {
    setSavingSignature(true)
    try {
      if (onSave) await onSave(null)
      setSavedSignature(null)
    } catch {
      // Parent surfaces the error; keep the previous signature visible.
    } finally {
      setSavingSignature(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm dark:shadow-lg text-slate-900 dark:text-slate-100 transition-colors">
      {/* Agreement Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg">{agreementTitle}</h3>
            {required && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                Mandatory Agreement
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{agreementSummary}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onDownload && (
            <Button type="button" size="sm" variant="secondary" icon={Download} onClick={onDownload}>
              Download PDF
            </Button>
          )}
          {allowToggle && (
            <button
              type="button"
              onClick={() => setShowFullAgreement(!showFullAgreement)}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              {showFullAgreement ? (
                <>Hide Contract Terms <ChevronUp className="w-3.5 h-3.5" /></>
              ) : (
                <>View Full Contract Terms <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Full Agreement Text Container */}
      {showFullAgreement && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="flex items-center gap-1.5 font-medium">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> Legal Contract Document
            </span>
            <span className="text-[11px]">Binding Electronic Version</span>
          </div>

          <div className="p-5 sm:p-6 rounded-xl bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner font-mono selection:bg-indigo-500/30">
            {agreementContent}
          </div>
        </div>
      )}

      {/* Signature State */}
      {savedSignature?.signed ? (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Signed & Validated</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">• {savedSignature.timestampFormatted || savedSignature.signedAt}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                Signatory: <strong className="text-slate-900 dark:text-slate-100">{savedSignature.signatoryName}</strong> ({savedSignature.signatoryTitle})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center">
            {savedSignature.signatureDataUrl && (
              <img
                src={savedSignature.signatureDataUrl}
                alt="Signature"
                className="h-10 px-2 py-1 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 object-contain"
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleResign}
              disabled={savingSignature}
            >
              {savingSignature ? 'Saving...' : 'Re-Sign'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Signatory Info Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Authorized Signatory Full Name"
              placeholder="e.g. Alexander Vance"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              required
            />
            <Input
              label="Signatory Job Title / Role"
              placeholder="e.g. Chief Executive Officer / Managing Director"
              value={signatoryTitle}
              onChange={(e) => setSignatoryTitle(e.target.value)}
            />
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Choose Signature Style</label>
            <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMode('draw')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  mode === 'draw'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <PenTool className="w-3.5 h-3.5" /> Draw Signature
              </button>
              <button
                type="button"
                onClick={() => setMode('type')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-all cursor-pointer ${
                  mode === 'type'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Type className="w-3.5 h-3.5" /> Type Name
              </button>
            </div>
          </div>

          {/* Canvas or Type Mode */}
          {mode === 'draw' ? (
            <div className="space-y-2">
              <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500/60 rounded-xl bg-slate-50 dark:bg-slate-950 overflow-hidden group shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={180}
                  className="w-full h-40 sm:h-44 cursor-crosshair touch-none select-none block"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  onTouchCancel={stopDrawing}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-500 text-xs">
                    <span className="bg-white/90 dark:bg-slate-900/80 px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                      Sign with mouse or finger here
                    </span>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="p-1.5 rounded-lg bg-white/90 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                    title="Clear Canvas"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Clear
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Digital canvas audit signature is hashed and timestamped upon confirmation.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Type your name to generate digital signature"
                value={typedSignature}
                onChange={(e) => setTypedSignature(e.target.value)}
              />
              <div className="h-24 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                <span className="font-serif italic text-2xl text-indigo-600 dark:text-indigo-400 tracking-wider">
                  {typedSignature || signatoryName || 'Signature Preview'}
                </span>
              </div>
            </div>
          )}

          {/* Legal Acknowledgement Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              I certify that I am an authorized representative of my organization and legally empowered to execute this agreement electronically.
            </span>
          </label>

          {/* Confirm Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmSignature}
              disabled={savingSignature}
              className="bg-indigo-600 hover:bg-indigo-500"
              icon={Check}
            >
              {savingSignature ? 'Saving...' : 'Sign & Accept Agreement'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

