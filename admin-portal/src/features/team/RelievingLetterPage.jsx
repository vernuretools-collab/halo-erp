import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Eraser, PenLine, RotateCcw, Upload } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { supabase } from '../../shared/services/firebaseService'
import { TeamSubNav } from './components/TeamSubNav'
import { getEmployees } from './services/teamService'
import { addMonthsInput, downloadAssetsReturn, downloadCredentialsRevocation, downloadExperienceCertificate, downloadFnfSettlement, downloadNda, downloadRelievingLetter, formatTenure } from './services/relievingLetterPdf'

const DEFAULT_SIGNATORY = 'Swathish G'
const DEFAULT_TITLE = 'Co-Founder & Authorised Signatory'
const DEFAULT_CONDUCT = 'satisfactory conduct and professional commitment'
const COFOUNDER_SIGN_KEY = 'crm.relieving.cofounder-sign'

function sameName(left, right) {
  const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const a = normalize(left)
  return Boolean(a) && a === normalize(right)
}

function drawCoFounderSignature() {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#12324a'
  ctx.font = 'italic 86px "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive'
  ctx.textBaseline = 'middle'
  ctx.fillText(DEFAULT_SIGNATORY, 28, 104)
  ctx.strokeStyle = '#12324a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(36, 158)
  ctx.bezierCurveTo(160, 176, 300, 138, 470, 160)
  ctx.stroke()
  return canvas.toDataURL('image/png')
}

function initialCoFounderSign() {
  try {
    const saved = localStorage.getItem(COFOUNDER_SIGN_KEY)
    if (saved && saved.startsWith('data:image/')) return saved
  } catch {
    /* storage unavailable */
  }
  return drawCoFounderSignature()
}

function rememberCoFounderSign(value) {
  try {
    if (value && value.startsWith('data:image/')) localStorage.setItem(COFOUNDER_SIGN_KEY, value)
    else localStorage.removeItem(COFOUNDER_SIGN_KEY)
  } catch {
    /* storage unavailable */
  }
}

function readSignatureFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that signature image.'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const scale = Math.min(720 / image.width, 220 / image.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(image.width * scale))
        canvas.height = Math.max(1, Math.round(image.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      }
      image.onerror = () => reject(new Error('That file is not a usable signature image.'))
      image.src = String(reader.result || '')
    }
    reader.readAsDataURL(file)
  })
}

async function findOnboardingSignature(name) {
  const target = String(name || '').trim()
  if (!target || !supabase) return ''
  const { data, error } = await supabase.from('employee_onboarding').select('employment, answers')
  if (error || !Array.isArray(data)) return ''
  for (const row of data) {
    const employment = row.employment && typeof row.employment === 'object' ? row.employment : {}
    const answers = row.answers && typeof row.answers === 'object' ? row.answers : {}
    const personal = answers.personal && typeof answers.personal === 'object' ? answers.personal : {}
    const signature = answers.signature
    const matches = sameName(employment.fullName, target) || sameName(personal.fullName, target)
    if (matches && typeof signature === 'string' && signature.startsWith('data:image/')) return signature
  }
  return ''
}

function SignCard({ title, hint, image, onUpload, onDraw, onReset, onClear }) {
  const inputRef = useRef(null)
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-2 text-left">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold text-fg">{title}</p>
        <p className="text-[10px] text-muted">{hint}</p>
      </div>
      <div className="mt-1.5 flex h-14 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-white">
        {image ? (
          <img src={image} alt="" className="max-h-12 max-w-[11.5rem] object-contain" />
        ) : (
          <span className="text-[10px] text-slate-400">No signature yet</span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        <button type="button" onClick={onDraw} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-fg cursor-pointer">
          <PenLine className="h-3 w-3" /> Draw
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-fg cursor-pointer">
          <Upload className="h-3 w-3" /> Upload
        </button>
        {onReset && (
          <button type="button" onClick={onReset} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-fg cursor-pointer">
            <RotateCcw className="h-3 w-3" /> Default
          </button>
        )}
        {onClear && image && (
          <button type="button" onClick={onClear} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] text-rose-500 cursor-pointer">
            <Eraser className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onUpload(file)
        }}
      />
    </div>
  )
}

function DrawPad({ title, onSave, onCancel }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  const point = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  const start = (event) => {
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (event) => {
    if (!drawing.current) return
    event.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = point(event)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#12324a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    drawing.current = false
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <Card>
      <p className="text-sm font-medium text-fg">{title}</p>
      <canvas
        ref={canvasRef}
        width={960}
        height={220}
        className="mt-3 h-36 w-full cursor-crosshair rounded-xl border border-dashed border-border bg-white touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}>Use this signature</Button>
        <Button type="button" variant="secondary" icon={Eraser} onClick={clear}>Clear</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}

function todayInput() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function toDateInput(value) {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return ''
}

function employeeLabel(employee) {
  return employee.displayName || employee.name || employee.email || 'Employee'
}

const emptyForm = () => ({
  employeeName: '',
  designation: '',
  department: '',
  dateOfJoining: '',
  resignationDate: '',
  lastWorkingDay: '',
  issueDate: todayInput(),
  totalTenure: '',
  settlementDeadline: '',
  conductSummary: DEFAULT_CONDUCT,
  signatoryName: DEFAULT_SIGNATORY,
  signatoryTitle: DEFAULT_TITLE,
})

export function RelievingLetterPage() {
  const [employees, setEmployees] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [coFounderSign, setCoFounderSign] = useState(initialCoFounderSign)
  const [employeeSign, setEmployeeSign] = useState('')
  const [pad, setPad] = useState('')
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [downloading, setDownloading] = useState('')
  const [error, setError] = useState('')
  const tenureEdited = useRef(false)
  const deadlineEdited = useRef(false)
  const signRequest = useRef(0)

  const letterInput = () => ({ ...form, coFounderSign, employeeSign })

  useEffect(() => {
    let active = true
    getEmployees()
      .then((rows) => {
        if (!active) return
        const list = [...(rows || [])].sort((a, b) => employeeLabel(a).localeCompare(employeeLabel(b)))
        setEmployees(list)
      })
      .catch(() => {
        if (active) setEmployees([])
      })
      .finally(() => {
        if (active) setLoadingEmployees(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (tenureEdited.current) return
    const next = formatTenure(form.dateOfJoining, form.lastWorkingDay)
    setForm((current) => (current.totalTenure === next ? current : { ...current, totalTenure: next }))
  }, [form.dateOfJoining, form.lastWorkingDay])

  useEffect(() => {
    if (deadlineEdited.current) return
    const next = addMonthsInput(form.lastWorkingDay, 2)
    setForm((current) => (current.settlementDeadline === next ? current : { ...current, settlementDeadline: next }))
  }, [form.lastWorkingDay])

  const assetsReady = useMemo(() => [
    form.employeeName,
    form.designation,
    form.department,
    form.lastWorkingDay,
    form.issueDate,
    form.signatoryName,
    form.signatoryTitle,
  ].every((value) => String(value || '').trim()), [form])

  const ready = useMemo(() => [
    form.employeeName,
    form.designation,
    form.department,
    form.dateOfJoining,
    form.resignationDate,
    form.lastWorkingDay,
    form.issueDate,
    form.totalTenure,
    form.signatoryName,
    form.signatoryTitle,
  ].every((value) => String(value || '').trim()), [form])

  const setField = (key, value) => {
    if (key === 'totalTenure') tenureEdited.current = true
    if (key === 'settlementDeadline') deadlineEdited.current = true
    setForm((current) => ({ ...current, [key]: value }))
  }

  const selectEmployee = (id) => {
    setSelectedId(id)
    const employee = employees.find((row) => (row.uid || row.employeeId) === id)
    const ticket = signRequest.current + 1
    signRequest.current = ticket
    setEmployeeSign('')
    if (!employee) return
    tenureEdited.current = false
    const employeeName = employee.displayName || employee.name || ''
    setForm((current) => {
      const dateOfJoining = toDateInput(employee.joiningDate || employee.startDate || employee.joinedAt)
      return {
        ...current,
        employeeName,
        designation: employee.roleName || employee.role || '',
        department: employee.departmentName || employee.department || '',
        dateOfJoining,
        totalTenure: formatTenure(dateOfJoining, current.lastWorkingDay),
      }
    })
    findOnboardingSignature(employeeName).then((signature) => {
      if (ticket === signRequest.current && signature) setEmployeeSign(signature)
    }).catch(() => {})
  }

  const uploadSignature = async (file, apply) => {
    setError('')
    try {
      apply(await readSignatureFile(file))
    } catch (err) {
      setError(err?.message || 'The signature image could not be used.')
    }
  }

  const saveCoFounder = (value) => {
    setCoFounderSign(value)
    rememberCoFounderSign(value)
  }

  const resetCoFounder = () => {
    const next = drawCoFounderSignature()
    setCoFounderSign(next)
    rememberCoFounderSign('')
  }

  const saveDrawnSign = (value) => {
    if (pad === 'cofounder') saveCoFounder(value)
    if (pad === 'employee') setEmployeeSign(value)
    setPad('')
  }

  const handleDownload = async (event) => {
    event.preventDefault()
    if (!ready || downloading) return
    setError('')
    setDownloading('letter')
    try {
      await downloadRelievingLetter(letterInput())
    } catch (err) {
      setError(err?.message || 'The relieving letter could not be downloaded.')
    } finally {
      setDownloading('')
    }
  }

  const downloadPackFile = async (key, save, fallback) => {
    if (!assetsReady || downloading) return
    setError('')
    setDownloading(key)
    try {
      await save(letterInput())
    } catch (err) {
      setError(err?.message || fallback)
    } finally {
      setDownloading('')
    }
  }

  const handleAssetsDownload = () => downloadPackFile(
    'assets',
    downloadAssetsReturn,
    'The assets acknowledgement could not be downloaded.',
  )

  const handleCredentialsDownload = () => downloadPackFile(
    'credentials',
    downloadCredentialsRevocation,
    'The credentials revocation could not be downloaded.',
  )

  const handleNdaDownload = () => downloadPackFile(
    'nda',
    downloadNda,
    'The NDA could not be downloaded.',
  )

  const handleFnfDownload = () => {
    if (!String(form.settlementDeadline || '').trim()) return
    downloadPackFile(
      'fnf',
      downloadFnfSettlement,
      'The full and final settlement could not be downloaded.',
    )
  }

  const handleExperienceDownload = async () => {
    if (!ready || downloading) return
    setError('')
    setDownloading('experience')
    try {
      await downloadExperienceCertificate(letterInput())
    } catch (err) {
      setError(err?.message || 'The experience certificate could not be downloaded.')
    } finally {
      setDownloading('')
    }
  }

  return (
    <div className="space-y-5">
      <TeamSubNav />
      <PageHeader
        title="Relieving Letter"
        description="Enter the exit details, then download any document in the exit pack. Files are not saved to the employee record."
        actions={(
          <div className="grid w-[24rem] max-w-full grid-cols-2 gap-2">
            <SignCard
              title="Co-founder sign"
              hint="Default"
              image={coFounderSign}
              onDraw={() => setPad('cofounder')}
              onUpload={(file) => uploadSignature(file, saveCoFounder)}
              onReset={resetCoFounder}
            />
            <SignCard
              title="Employee sign"
              hint={employeeSign ? 'Added' : 'Needed'}
              image={employeeSign}
              onDraw={() => setPad('employee')}
              onUpload={(file) => uploadSignature(file, setEmployeeSign)}
              onClear={() => setEmployeeSign('')}
            />
          </div>
        )}
      />
      {pad && (
        <DrawPad
          title={pad === 'cofounder' ? 'Draw the co-founder signature' : 'Draw the employee signature'}
          onSave={saveDrawnSign}
          onCancel={() => setPad('')}
        />
      )}
      <form className="space-y-4" onSubmit={handleDownload}>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="w-full space-y-1.5 text-left md:col-span-2">
              <label htmlFor="relieving-employee" className="block text-xs font-medium text-fg">
                Employee
              </label>
              <select
                id="relieving-employee"
                value={selectedId}
                onChange={(event) => selectEmployee(event.target.value)}
                className="w-full bg-surface border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                <option value="">{loadingEmployees ? 'Loading employees…' : 'Enter details manually'}</option>
                {employees.map((employee) => {
                  const id = employee.uid || employee.employeeId
                  return (
                    <option key={id} value={id}>
                      {employeeLabel(employee)}
                    </option>
                  )
                })}
              </select>
            </div>
            <Input label="Employee name *" value={form.employeeName} onChange={(event) => setField('employeeName', event.target.value)} required />
            <Input label="Designation *" value={form.designation} onChange={(event) => setField('designation', event.target.value)} required />
            <Input label="Department *" value={form.department} onChange={(event) => setField('department', event.target.value)} required />
            <Input label="Date of joining *" type="date" value={form.dateOfJoining} onChange={(event) => setField('dateOfJoining', event.target.value)} required />
            <Input label="Resignation date *" type="date" value={form.resignationDate} onChange={(event) => setField('resignationDate', event.target.value)} required />
            <Input label="Last working day *" type="date" value={form.lastWorkingDay} onChange={(event) => setField('lastWorkingDay', event.target.value)} required />
            <Input label="Issue date *" type="date" value={form.issueDate} onChange={(event) => setField('issueDate', event.target.value)} required />
            <Input label="Total tenure *" value={form.totalTenure} onChange={(event) => setField('totalTenure', event.target.value)} required />
            <Input label="F&F deadline *" type="date" value={form.settlementDeadline} onChange={(event) => setField('settlementDeadline', event.target.value)} required />
            <Input label="Conduct summary *" value={form.conductSummary} onChange={(event) => setField('conductSummary', event.target.value)} required />
            <Input label="Authorised signatory *" value={form.signatoryName} onChange={(event) => setField('signatoryName', event.target.value)} required />
            <Input label="Signatory title *" value={form.signatoryTitle} onChange={(event) => setField('signatoryTitle', event.target.value)} required />
          </div>
        </Card>
        {error && <p className="text-sm text-rose-500">{error}</p>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" icon={Download} disabled={!ready || Boolean(downloading)}>
            {downloading === 'letter' ? 'Preparing PDF…' : 'Download relieving letter'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} disabled={!assetsReady || Boolean(downloading)} onClick={handleAssetsDownload}>
            {downloading === 'assets' ? 'Preparing PDF…' : 'Download assets return'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} disabled={!assetsReady || Boolean(downloading)} onClick={handleCredentialsDownload}>
            {downloading === 'credentials' ? 'Preparing PDF…' : 'Download credentials revocation'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} disabled={!assetsReady || Boolean(downloading)} onClick={handleNdaDownload}>
            {downloading === 'nda' ? 'Preparing PDF…' : 'Download NDA'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} disabled={!assetsReady || !form.settlementDeadline || Boolean(downloading)} onClick={handleFnfDownload}>
            {downloading === 'fnf' ? 'Preparing PDF…' : 'Download F&F settlement'}
          </Button>
          <Button type="button" variant="secondary" icon={Download} disabled={!ready || Boolean(downloading)} onClick={handleExperienceDownload}>
            {downloading === 'experience' ? 'Preparing PDF…' : 'Download experience certificate'}
          </Button>
        </div>
      </form>
    </div>
  )
}
