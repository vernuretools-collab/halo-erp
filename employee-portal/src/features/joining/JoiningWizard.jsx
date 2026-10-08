import React from 'react'
import {
  ACCOUNT_TYPES,
  BLOOD_GROUPS,
  GENDER_OPTIONS,
  JOINING_STEPS,
  KYC_DOCUMENTS,
  MARITAL_OPTIONS,
  POLICY_ITEMS,
  YES_NO,
  declarationText,
} from '../../../../shared/supabase/joiningForm.js'
import { hasIssuedAssets } from '../../../../admin-portal/src/features/team/services/onboardingPacks.js'
import { SignaturePad } from './SignaturePad'

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

export function JoiningWizard({ step, answers, setAnswers, employment, readOnly }) {
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
        <div className="mt-3 flex justify-between gap-2 text-xs">
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
                <input type="date" className={fieldClass} value={personal.dateOfBirth} disabled={readOnly} onChange={(e) => setPersonal('dateOfBirth', e.target.value)} />
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
                ['designation', 'Designation'],
                ['department', 'Department'],
                ['dateOfJoining', 'Date of joining'],
                ['reportingManager', 'Reporting to'],
                ['workMode', 'Work mode'],
                ['monthlyCtc', 'Monthly CTC (gross)'],
                ['probationPeriod', 'Probation period'],
                ['employeeId', 'Employee ID'],
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
            <SectionTitle>Policy acknowledgement</SectionTitle>
            <p className="text-sm text-slate-500 mb-4">
              Please read and acknowledge the following key policies. By checking each box, you confirm you have read and understood the policy. Full policy text is in your Document Pack.
            </p>
            <div className="space-y-3">
              {POLICY_ITEMS.map((item) => (
                <label key={item.id} className="flex gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={readOnly}
                    checked={Boolean(answers.policies[item.id])}
                    onChange={(e) => setAnswers((current) => ({
                      ...current,
                      policies: { ...current.policies, [item.id]: e.target.checked },
                    }))}
                  />
                  <span>{item.text}</span>
                </label>
              ))}
            </div>
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
    </div>
  )
}
