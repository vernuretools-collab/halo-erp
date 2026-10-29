import React, { useEffect, useRef, useState } from 'react'
import {
  ACCOUNT_TYPES,
  BLOOD_GROUPS,
  GENDER_OPTIONS,
  JOINING_STEPS,
  KYC_DOCUMENTS,
  MARITAL_OPTIONS,
  POLICY_ITEMS,
  policyBrief,
  policyLabel,
  YES_NO,
  declarationText,
} from '../../../../shared/supabase/joiningForm.js'
import { hasIssuedAssets } from '../../../../admin-portal/src/features/team/services/onboardingPacks.js'
import { SignaturePad } from './SignaturePad'
import { Calendar, X } from 'lucide-react'

const labelClass = 'block text-[11px] font-semibold tracking-wide text-slate-800 mb-1.5'
const fieldClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-700 disabled:bg-slate-50 disabled:text-slate-600'

function Field({ label, required, children }) {
  return (
    <label className="block text-left">
      <span className={labelClass}>
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold tracking-wide text-teal-700 border-l-4 border-teal-700 pl-3 mb-4">
      {children}
    </h3>
  )
}

function displayValue(value) {
  const text = String(value ?? '').trim()
  return text || '—'
}

function PreviewSection({ title, onEdit, children }) {
  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-semibold text-teal-800">{title}</h4>
        {onEdit ? (
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-teal-700 underline cursor-pointer">
            Edit
          </button>
        ) : null}
      </div>
      <dl className="px-4 py-1">{children}</dl>
    </section>
  )
}

function PreviewRow({ label, value }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-800 whitespace-pre-wrap break-words">{displayValue(value)}</dd>
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const BIRTH_YEAR_START = 1940

function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  return { year, month, day }
}

function toIsoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function displayDate(value) {
  const parsed = parseIsoDate(value)
  if (!parsed) return ''
  return `${String(parsed.day).padStart(2, '0')}/${String(parsed.month + 1).padStart(2, '0')}/${parsed.year}`
}

function BirthDateField({ value, disabled, onChange }) {
  const parsed = parseIsoDate(value)
  const today = new Date()
  const maxYear = today.getFullYear()
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed?.year || maxYear - 25)
  const [viewMonth, setViewMonth] = useState(parsed?.month || 0)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openPicker = () => {
    if (disabled) return
    const current = parseIsoDate(value)
    setViewYear(current?.year || maxYear - 25)
    setViewMonth(current?.month ?? 0)
    setOpen(true)
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
  const years = []
  for (let year = maxYear; year >= BIRTH_YEAR_START; year -= 1) years.push(year)
  const todayStamp = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return (
    <div className="relative" ref={rootRef}>
      <input
        readOnly
        disabled={disabled}
        value={displayDate(value)}
        placeholder="dd/mm/yyyy"
        onClick={openPicker}
        className={`${fieldClass} cursor-pointer pr-10`}
        aria-label="Date of birth"
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Choose date, month, and year"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-teal-700 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <Calendar className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Month"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-teal-700"
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
            >
              {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
            </select>
            <select
              aria-label="Year"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-teal-700"
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
            >
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-400">
            {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }, (_, index) => <span key={`empty-${index}`} />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1
              const selected = parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === day
              const future = new Date(viewYear, viewMonth, day).getTime() > todayStamp
              return (
                <button
                  key={day}
                  type="button"
                  disabled={future}
                  onClick={() => {
                    onChange(toIsoDate(viewYear, viewMonth, day))
                    setOpen(false)
                  }}
                  className={`h-8 rounded-md text-sm cursor-pointer disabled:cursor-not-allowed ${selected ? 'bg-teal-700 text-white' : 'text-slate-800 hover:bg-teal-50 disabled:text-slate-300 disabled:hover:bg-transparent'}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const EMPLOYMENT_FIELDS = [
  ['designation', 'Designation'],
  ['department', 'Department'],
  ['dateOfJoining', 'Date of joining'],
  ['reportingManager', 'Reporting to'],
  ['workMode', 'Work mode'],
  ['monthlyCtc', 'Monthly CTC (gross)'],
  ['probationPeriod', 'Probation period'],
  ['employeeId', 'Employee ID'],
]

export function JoiningWizard({
  step,
  answers,
  setAnswers,
  employment,
  readOnly,
  detailsConfirmed,
  setDetailsConfirmed,
  onEditStep,
}) {
  const [policyPopup, setPolicyPopup] = useState(null)
  const personal = answers.personal
  const setPersonal = (key, value) => setAnswers((current) => ({
    ...current,
    personal: { ...current.personal, [key]: value },
  }))
  const setBank = (key, value) => setAnswers((current) => ({
    ...current,
    bank: { ...current.bank, [key]: value },
  }))
  const setKyc = (key, value) => setAnswers((current) => ({
    ...current,
    kyc: { ...current.kyc, [key]: value },
  }))
  const setEmergency = (key, value) => setAnswers((current) => ({
    ...current,
    emergency: { ...current.emergency, [key]: value },
  }))

  const toggleDoc = (name) => {
    setAnswers((current) => {
      const documents = current.kyc.documents.includes(name)
        ? current.kyc.documents.filter((item) => item !== name)
        : [...current.kyc.documents, name]
      return { ...current, kyc: { ...current.kyc, documents } }
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl px-6 py-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-teal-700 text-center">Employee Onboarding Form</h2>
        <p className="text-center text-sm text-slate-500 mt-1">
          Complete all sections. Fields marked <span className="text-rose-600">*</span> are required.
        </p>
        <div className="mt-4 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-amber-400"
            style={{ width: `${((step + 1) / JOINING_STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-x-2 gap-y-1 text-xs">
          {JOINING_STEPS.map((item, index) => (
            <span key={item.id} className={index === step ? 'text-amber-600 font-semibold' : index < step ? 'text-teal-700' : 'text-slate-400'}>
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {step === 0 && (
          <>
            <SectionTitle>Personal details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Full name (as on Aadhaar)" required>
                <input className={fieldClass} placeholder="As on Aadhaar card" value={personal.fullName} disabled={readOnly} onChange={(e) => setPersonal('fullName', e.target.value)} />
              </Field>
              <Field label="Date of birth" required>
                <BirthDateField value={personal.dateOfBirth} disabled={readOnly} onChange={(next) => setPersonal('dateOfBirth', next)} />
              </Field>
              <Field label="Gender" required>
                <select className={fieldClass} value={personal.gender} disabled={readOnly} onChange={(e) => setPersonal('gender', e.target.value)}>
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Nationality">
                <input className={fieldClass} value={personal.nationality} disabled={readOnly} onChange={(e) => setPersonal('nationality', e.target.value)} />
              </Field>
              <Field label="Aadhaar number" required>
                <input className={fieldClass} placeholder="XXXX XXXX XXXX" value={personal.aadhaar} disabled={readOnly} onChange={(e) => setPersonal('aadhaar', e.target.value)} />
              </Field>
              <Field label="PAN number" required>
                <input className={fieldClass} placeholder="ABCDE1234F" value={personal.pan} disabled={readOnly} onChange={(e) => setPersonal('pan', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Mobile number" required>
                <input className={fieldClass} placeholder="+91 XXXXX XXXXX" value={personal.mobile} disabled={readOnly} onChange={(e) => setPersonal('mobile', e.target.value)} />
              </Field>
              <Field label="Personal email" required>
                <input type="email" className={fieldClass} placeholder="your@email.com" value={personal.email} disabled={readOnly} onChange={(e) => setPersonal('email', e.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Permanent address" required>
                  <textarea className={`${fieldClass} min-h-20`} placeholder="Full address with pin code" value={personal.permanentAddress} disabled={readOnly} onChange={(e) => setPersonal('permanentAddress', e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Current address (if different)">
                  <textarea className={`${fieldClass} min-h-20`} placeholder="Leave blank if same as permanent" value={personal.currentAddress} disabled={readOnly} onChange={(e) => setPersonal('currentAddress', e.target.value)} />
                </Field>
              </div>
              <Field label="Father's name">
                <input className={fieldClass} value={personal.fatherName} disabled={readOnly} onChange={(e) => setPersonal('fatherName', e.target.value)} />
              </Field>
              <Field label="Mother's name">
                <input className={fieldClass} value={personal.motherName} disabled={readOnly} onChange={(e) => setPersonal('motherName', e.target.value)} />
              </Field>
              <Field label="Marital status">
                <select className={fieldClass} value={personal.maritalStatus} disabled={readOnly} onChange={(e) => setPersonal('maritalStatus', e.target.value)}>
                  <option value="">Select</option>
                  {MARITAL_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Blood group">
                <select className={fieldClass} value={personal.bloodGroup} disabled={readOnly} onChange={(e) => setPersonal('bloodGroup', e.target.value)}>
                  <option value="">Select</option>
                  {BLOOD_GROUPS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <SectionTitle>Your employment details</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">These details have been set by HR. Please review and confirm they are correct.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ...EMPLOYMENT_FIELDS,
                ...(hasIssuedAssets(employment.assets) ? [['assets', 'Assets to be issued']] : []),
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input className={fieldClass} value={employment[key] || ''} disabled />
                </Field>
              ))}
            </div>
            <p className="mt-4 rounded-lg border-l-4 border-teal-700 bg-teal-50 px-4 py-3 text-sm text-teal-900">
              If any of the above details are incorrect, please contact HR before proceeding.
            </p>
            <div className="mt-6">
              <Field label="Conflict of interest disclosure" required>
                <p className="text-xs text-slate-500 mb-2">
                  Do any of your family members, relatives, or close associates run a business or freelance in digital marketing, web development, SEO, sales, or any related field?
                </p>
                <select
                  className={fieldClass}
                  value={answers.employment.conflictOfInterest}
                  disabled={readOnly}
                  onChange={(e) => setAnswers((current) => ({
                    ...current,
                    employment: { conflictOfInterest: e.target.value },
                  }))}
                >
                  <option value="">Select</option>
                  {YES_NO.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <SectionTitle>Bank & payroll details</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Bank name" required>
                <input className={fieldClass} placeholder="e.g. State Bank of India" value={answers.bank.bankName} disabled={readOnly} onChange={(e) => setBank('bankName', e.target.value)} />
              </Field>
              <Field label="Account holder name" required>
                <input className={fieldClass} placeholder="As per bank records" value={answers.bank.accountHolder} disabled={readOnly} onChange={(e) => setBank('accountHolder', e.target.value)} />
              </Field>
              <Field label="Account number" required>
                <input className={fieldClass} placeholder="Account number" value={answers.bank.accountNumber} disabled={readOnly} onChange={(e) => setBank('accountNumber', e.target.value)} />
              </Field>
              <Field label="IFSC code" required>
                <input className={fieldClass} placeholder="e.g. SBIN0001234" value={answers.bank.ifsc} disabled={readOnly} onChange={(e) => setBank('ifsc', e.target.value.toUpperCase())} />
              </Field>
              <Field label="Branch & city" required>
                <input className={fieldClass} placeholder="Branch name and city" value={answers.bank.branchCity} disabled={readOnly} onChange={(e) => setBank('branchCity', e.target.value)} />
              </Field>
              <Field label="Account type" required>
                <select className={fieldClass} value={answers.bank.accountType} disabled={readOnly} onChange={(e) => setBank('accountType', e.target.value)}>
                  {ACCOUNT_TYPES.map((option) => <option key={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Existing UAN (PF) — if any">
                <input className={fieldClass} placeholder="Leave blank if none" value={answers.bank.uan} disabled={readOnly} onChange={(e) => setBank('uan', e.target.value)} />
              </Field>
              <Field label="Blood group">
                <input className={fieldClass} value={personal.bloodGroup || ''} disabled />
              </Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <SectionTitle>KYC & document submission</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">Please confirm which documents you are bringing on your joining day. You must bring all original documents for verification.</p>
            <p className="text-xs font-semibold tracking-wide text-slate-700 mb-3">Education & previous employment</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Highest qualification">
                <input className={fieldClass} placeholder="e.g. B.Com, MBA" value={answers.kyc.qualification} disabled={readOnly} onChange={(e) => setKyc('qualification', e.target.value)} />
              </Field>
              <Field label="Institution & year">
                <input className={fieldClass} placeholder="e.g. Anna University, 2022" value={answers.kyc.institutionYear} disabled={readOnly} onChange={(e) => setKyc('institutionYear', e.target.value)} />
              </Field>
              <Field label="Last employer">
                <input className={fieldClass} placeholder="Company name or NIL" value={answers.kyc.lastEmployer} disabled={readOnly} onChange={(e) => setKyc('lastEmployer', e.target.value)} />
              </Field>
              <Field label="Last designation">
                <input className={fieldClass} placeholder="Role or NIL" value={answers.kyc.lastDesignation} disabled={readOnly} onChange={(e) => setKyc('lastDesignation', e.target.value)} />
              </Field>
            </div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-800 mt-5 mb-2">Documents to be submitted on joining day *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {KYC_DOCUMENTS.map((name) => (
                <label key={name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={answers.kyc.documents.includes(name)}
                    onChange={() => toggleDoc(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
            <Field label="Any conflicting obligations from previous employer?">
              <textarea
                className={`${fieldClass} min-h-24 mt-2`}
                placeholder="Describe any non-compete, NDA, or other obligations from previous employer. Write NIL if none."
                value={answers.kyc.obligations}
                disabled={readOnly}
                onChange={(e) => setKyc('obligations', e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 4 && (
          <>
            <SectionTitle>Emergency contact</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Primary contact name" required>
                <input className={fieldClass} value={answers.emergency.primaryName} disabled={readOnly} onChange={(e) => setEmergency('primaryName', e.target.value)} />
              </Field>
              <Field label="Relationship" required>
                <input className={fieldClass} placeholder="e.g. Mother, Spouse" value={answers.emergency.primaryRelationship} disabled={readOnly} onChange={(e) => setEmergency('primaryRelationship', e.target.value)} />
              </Field>
              <Field label="Mobile number" required>
                <input className={fieldClass} value={answers.emergency.primaryMobile} disabled={readOnly} onChange={(e) => setEmergency('primaryMobile', e.target.value)} />
              </Field>
              <Field label="Address">
                <input className={fieldClass} placeholder="City, State" value={answers.emergency.address} disabled={readOnly} onChange={(e) => setEmergency('address', e.target.value)} />
              </Field>
              <Field label="Secondary contact name">
                <input className={fieldClass} value={answers.emergency.secondaryName} disabled={readOnly} onChange={(e) => setEmergency('secondaryName', e.target.value)} />
              </Field>
              <Field label="Relationship">
                <input className={fieldClass} value={answers.emergency.secondaryRelationship} disabled={readOnly} onChange={(e) => setEmergency('secondaryRelationship', e.target.value)} />
              </Field>
              <Field label="Secondary mobile">
                <input className={fieldClass} value={answers.emergency.secondaryMobile} disabled={readOnly} onChange={(e) => setEmergency('secondaryMobile', e.target.value)} />
              </Field>
              <Field label="Known allergies / medical conditions">
                <input className={fieldClass} placeholder="Write NIL if none" value={answers.emergency.allergies} disabled={readOnly} onChange={(e) => setEmergency('allergies', e.target.value)} />
              </Field>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <SectionTitle>POLICY ACKNOWLEDGEMENT</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Tick each policy after you have read it. Use Read more to open the full text from your document pack.
            </p>
            <div className="space-y-3">
              {POLICY_ITEMS.map((item) => (
                <div key={item.id} className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="flex gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-teal-700"
                      disabled={readOnly}
                      checked={Boolean(answers.policies[item.id])}
                      onChange={(e) => setAnswers((current) => ({
                        ...current,
                        policies: { ...current.policies, [item.id]: e.target.checked },
                      }))}
                    />
                    <div className="min-w-0">
                      <p>
                        {item.title ? (
                          <>
                            <strong className="font-semibold text-slate-900">{item.title}</strong>
                            {' — '}
                            {item.text}
                          </>
                        ) : (
                          <strong className="font-semibold text-slate-900">{item.text}</strong>
                        )}
                      </p>
                      <button
                        type="button"
                        className="mt-1 text-xs font-semibold text-teal-700 underline cursor-pointer"
                        onClick={() => setPolicyPopup(item.id)}
                      >
                        Read more
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 7 && (
          <>
            <SectionTitle>Review your details</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Check everything below. Use Edit if something needs to change, then return here to submit.
            </p>
            <div className="space-y-4">
              <PreviewSection title="Personal details" onEdit={readOnly ? null : () => onEditStep(0)}>
                <PreviewRow label="Full name" value={personal.fullName} />
                <PreviewRow label="Date of birth" value={personal.dateOfBirth} />
                <PreviewRow label="Gender" value={personal.gender} />
                <PreviewRow label="Nationality" value={personal.nationality} />
                <PreviewRow label="Aadhaar number" value={personal.aadhaar} />
                <PreviewRow label="PAN number" value={personal.pan} />
                <PreviewRow label="Mobile number" value={personal.mobile} />
                <PreviewRow label="Personal email" value={personal.email} />
                <PreviewRow label="Permanent address" value={personal.permanentAddress} />
                <PreviewRow label="Current address" value={personal.currentAddress} />
                <PreviewRow label="Father's name" value={personal.fatherName} />
                <PreviewRow label="Mother's name" value={personal.motherName} />
                <PreviewRow label="Marital status" value={personal.maritalStatus} />
                <PreviewRow label="Blood group" value={personal.bloodGroup} />
              </PreviewSection>
              <PreviewSection title="Employment details" onEdit={readOnly ? null : () => onEditStep(1)}>
                {EMPLOYMENT_FIELDS.map(([key, label]) => (
                  <PreviewRow key={key} label={label} value={employment[key]} />
                ))}
                {hasIssuedAssets(employment.assets) ? <PreviewRow label="Assets to be issued" value={employment.assets} /> : null}
                <PreviewRow label="Conflict of interest" value={answers.employment.conflictOfInterest} />
              </PreviewSection>
              <PreviewSection title="Bank & payroll" onEdit={readOnly ? null : () => onEditStep(2)}>
                <PreviewRow label="Bank name" value={answers.bank.bankName} />
                <PreviewRow label="Account holder" value={answers.bank.accountHolder} />
                <PreviewRow label="Account number" value={answers.bank.accountNumber} />
                <PreviewRow label="IFSC code" value={answers.bank.ifsc} />
                <PreviewRow label="Branch & city" value={answers.bank.branchCity} />
                <PreviewRow label="Account type" value={answers.bank.accountType} />
                <PreviewRow label="UAN (PF)" value={answers.bank.uan} />
              </PreviewSection>
              <PreviewSection title="KYC & documents" onEdit={readOnly ? null : () => onEditStep(3)}>
                <PreviewRow label="Highest qualification" value={answers.kyc.qualification} />
                <PreviewRow label="Institution & year" value={answers.kyc.institutionYear} />
                <PreviewRow label="Last employer" value={answers.kyc.lastEmployer} />
                <PreviewRow label="Last designation" value={answers.kyc.lastDesignation} />
                <PreviewRow label="Documents" value={answers.kyc.documents.join(', ')} />
                <PreviewRow label="Previous obligations" value={answers.kyc.obligations} />
              </PreviewSection>
              <PreviewSection title="Emergency contact" onEdit={readOnly ? null : () => onEditStep(4)}>
                <PreviewRow label="Primary contact" value={answers.emergency.primaryName} />
                <PreviewRow label="Relationship" value={answers.emergency.primaryRelationship} />
                <PreviewRow label="Mobile number" value={answers.emergency.primaryMobile} />
                <PreviewRow label="Address" value={answers.emergency.address} />
                <PreviewRow label="Secondary contact" value={answers.emergency.secondaryName} />
                <PreviewRow label="Secondary relationship" value={answers.emergency.secondaryRelationship} />
                <PreviewRow label="Secondary mobile" value={answers.emergency.secondaryMobile} />
                <PreviewRow label="Allergies / medical" value={answers.emergency.allergies} />
              </PreviewSection>
              <PreviewSection title="Policy acknowledgement" onEdit={readOnly ? null : () => onEditStep(5)}>
                {POLICY_ITEMS.map((item) => (
                  <div key={item.id} className="py-2.5 border-b border-slate-100 last:border-0">
                    <p className="text-sm text-slate-800">{policyLabel(item)}</p>
                    <p className={`mt-1 text-xs font-semibold ${answers.policies[item.id] ? 'text-teal-700' : 'text-rose-600'}`}>
                      {answers.policies[item.id] ? 'Acknowledged' : 'Not acknowledged'}
                    </p>
                  </div>
                ))}
              </PreviewSection>
              <PreviewSection title="Signature" onEdit={readOnly ? null : () => onEditStep(6)}>
                <div className="py-3">
                  {answers.signature ? (
                    <img src={answers.signature} alt="Signature" className="max-h-32 border border-slate-200 rounded-xl bg-white" />
                  ) : (
                    <p className="text-sm text-slate-500">No signature added.</p>
                  )}
                </div>
              </PreviewSection>
            </div>
            <label className="mt-6 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-1"
                disabled={readOnly}
                checked={Boolean(detailsConfirmed)}
                onChange={(e) => setDetailsConfirmed?.(e.target.checked)}
              />
              <span>I confirm that all the details I have given are correct.</span>
            </label>
          </>
        )}

        {step === 6 && (
          <>
            <SectionTitle>Your signature</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Draw your signature below or upload an image of your signature. This will appear on all your onboarding documents.
            </p>
            {readOnly && answers.signature ? (
              <img src={answers.signature} alt="Signature" className="max-h-40 border border-slate-200 rounded-xl bg-white" />
            ) : (
              <SignaturePad
                value={answers.signature}
                disabled={readOnly}
                onChange={(signature) => setAnswers((current) => ({ ...current, signature }))}
              />
            )}
          </>
        )}
      </div>

      {step === 6 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <SectionTitle>Declaration</SectionTitle>
          <p className="rounded-lg border-l-4 border-teal-700 bg-teal-50 px-4 py-3 text-sm text-slate-700">
            {declarationText(personal.fullName)}
          </p>
        </div>
      )}
      {policyPopup && (() => {
        const item = POLICY_ITEMS.find((policy) => policy.id === policyPopup)
        if (!item) return null
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
            onClick={() => setPolicyPopup(null)}
          >
            <div
              className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="policy-popup-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="absolute top-4 right-4 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                aria-label="Close"
                onClick={() => setPolicyPopup(null)}
              >
                <X className="h-5 w-5" />
              </button>
              <h3 id="policy-popup-title" className="pr-8 text-lg font-semibold text-teal-800">
                {item.title || 'Document pack'}
              </h3>
              <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc pl-5">
                {policyBrief(item, employment).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
