import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import haloLogo from '../../assets/halologo.png'
import { fetchCustomClaims, logoutUser } from '../../shared/services/authService'
import { auth, supabase } from '../../shared/services/firebaseService'
import { useUserStore } from '../../stores/userStore'
import { useLiveAuthSession } from '../../../../shared/supabase/useLiveAuthSession.js'
import { ONBOARDING_STATUS, isJoiningAccount, onboardingFromProfile } from '../../../../shared/supabase/employeeOnboarding.js'
import { JOINING_STEPS, mergeJoiningAnswers, validateJoiningStep } from '../../../../shared/supabase/joiningForm.js'
import { JoiningWizard } from './JoiningWizard'

export const JoiningFormPage = () => {
  const { user, sessionReady } = useLiveAuthSession({ auth, useUserStore, fetchCustomClaims })
  const claims = useUserStore((s) => s.claims)
  const [row, setRow] = useState(null)
  const [answers, setAnswers] = useState(() => mergeJoiningAnswers(null))
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [detailsConfirmed, setDetailsConfirmed] = useState(false)
  const [submittedPopup, setSubmittedPopup] = useState(false)
  const [returnToPreview, setReturnToPreview] = useState(false)

  useEffect(() => {
    setDetailsConfirmed(false)
  }, [answers])

  useEffect(() => {
    if (!sessionReady || !user) return undefined
    if (!isJoiningAccount({ role: claims?.role, email: user?.email })) {
      logoutUser().finally(() => setBlocked(true))
      return undefined
    }
    let cancelled = false
    Promise.resolve()
      .then(async () => {
        const byAuth = await supabase.from('employee_onboarding').select('*').eq('auth_id', user.uid).maybeSingle()
        if (byAuth.data) return byAuth.data
        const byId = await supabase.from('employee_onboarding').select('*').eq('id', user.uid).maybeSingle()
        if (byId.data) return byId.data
        const profile = await supabase.from('profiles').select('id, auth_id, data, created_at').eq('id', user.uid).maybeSingle()
        if (profile.error) throw profile.error
        return onboardingFromProfile(profile.data)
      })
      .then((data) => {
        if (cancelled) return
        setRow(data)
        setAnswers(mergeJoiningAnswers(data?.answers))
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionReady, user, claims?.role])

  const submitted = row?.status === ONBOARDING_STATUS.SUBMITTED

  const persistDraft = async (nextAnswers) => {
    const { error: saveError } = await supabase.rpc('save_employee_onboarding_draft', { p_answers: nextAnswers })
    if (!saveError) return
    const { data: profile, error: profileError } = await supabase.from('profiles').select('id, data').eq('id', user.uid).maybeSingle()
    if (profileError) throw saveError
    const current = profile?.data && typeof profile.data === 'object' ? profile.data : {}
    const { error: updateError } = await supabase.from('profiles').update({
      data: { ...current, answers: nextAnswers, joiningStatus: current.joiningStatus === 'submitted' ? 'submitted' : 'draft' },
      updated_at: new Date().toISOString(),
    }).eq('id', user.uid)
    if (updateError) throw updateError
  }

  const goNext = async () => {
    const message = validateJoiningStep(JOINING_STEPS[step].id, answers)
    if (message) {
      setError(message)
      return
    }
    setError('')
    const stepId = JOINING_STEPS[step].id
    if (stepId === 'preview') {
      if (!detailsConfirmed) {
        setError('Please confirm that all the details you have given are correct.')
        return
      }
      await submit()
      return
    }
    if (!submitted) {
      setSaving(true)
      try {
        await persistDraft(answers)
      } catch (err) {
        setError(err.message || 'Could not save your progress.')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    if (returnToPreview) {
      setReturnToPreview(false)
      setStep(JOINING_STEPS.findIndex((item) => item.id === 'preview'))
      return
    }
    setStep((current) => Math.min(current + 1, JOINING_STEPS.length - 1))
  }

  const submit = async () => {
    const message = validateJoiningStep('signature', answers)
    if (message) {
      setError(message)
      return
    }
    setSaving(true)
    setError('')
    try {
      const { error: submitError } = await supabase.rpc('submit_employee_onboarding', { p_answers: answers })
      if (submitError) {
        const { data: profile, error: profileError } = await supabase.from('profiles').select('id, data').eq('id', user.uid).maybeSingle()
        if (profileError) throw submitError
        const current = profile?.data && typeof profile.data === 'object' ? profile.data : {}
        const { error: updateError } = await supabase.from('profiles').update({
          data: { ...current, answers, joiningStatus: 'submitted', submittedAt: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq('id', user.uid)
        if (updateError) throw updateError
      }
      setRow({ ...row, status: ONBOARDING_STATUS.SUBMITTED, answers })
      setSubmittedPopup(true)
    } catch (err) {
      setError(err.message || 'Could not submit the form.')
    } finally {
      setSaving(false)
    }
  }

  if (!sessionReady) {
    return <p className="min-h-screen bg-slate-100 text-slate-500 flex items-center justify-center text-sm">Checking session…</p>
  }
  if (!user || blocked) return <Navigate to="/joining" replace />

  const nextLabel = [
    'Next: Employment Details',
    'Next: Bank Details',
    'Next: KYC',
    'Next: Emergency Contact',
    'Next: Policy Acknowledgement',
    'Next: Sign Documents',
    'Next: Review',
    'Submit',
  ][step]

  const hireName = answers.personal?.fullName || row?.employment?.fullName || ''
  const onPreview = JOINING_STEPS[step]?.id === 'preview'
  const primaryLabel = returnToPreview && !onPreview ? 'Save and return to preview' : `${nextLabel} →`

  return (
    <div className="min-h-screen text-slate-900 bg-slate-100">
      <header className="bg-slate-950 text-white px-6 py-4 flex items-center gap-3">
        <img src={haloLogo} alt="" className="w-10 h-10 rounded-full bg-white p-1 object-contain" />
        <div>
          <p className="font-semibold text-sm">The Halo Effect Consulting LLP</p>
          <p className="text-[11px] text-amber-200 italic">Where Insights Meet Influence</p>
        </div>
        <span className="ml-auto text-xs rounded-full border border-white/20 px-3 py-1 text-slate-200">Employee Onboarding Portal</span>
        <button type="button" className="text-xs text-slate-300" onClick={() => logoutUser()}>Sign out</button>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {loading && <p className="text-sm text-slate-500">Loading your form…</p>}
        {!loading && !row && !error && <p className="text-sm text-slate-500">No joining form is linked to this login.</p>}
        {row && (
          <>
            {!submitted && (
              <JoiningWizard
                step={step}
                answers={answers}
                setAnswers={setAnswers}
                employment={row.employment || {}}
                readOnly={submitted}
                detailsConfirmed={detailsConfirmed}
                setDetailsConfirmed={setDetailsConfirmed}
                onEditStep={(index) => {
                  setError('')
                  setReturnToPreview(true)
                  setStep(index)
                }}
              />
            )}
            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
            {submitted && (
              <div className="mt-4 mb-8 rounded-2xl bg-white border border-emerald-200 shadow-sm px-6 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-semibold text-teal-800">Thank you{hireName ? `, ${hireName}` : ''}</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your onboarding form has been submitted successfully. HR has received your details.
                </p>
              </div>
            )}
            {!submitted && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-lg border border-teal-700 px-4 py-2 text-sm text-teal-800 disabled:opacity-40"
                disabled={saving || step === 0}
                onClick={async () => {
                  setError('')
                  setSaving(true)
                  try {
                    await persistDraft(answers)
                  } catch (err) {
                    setError(err.message || 'Could not save your progress.')
                    setSaving(false)
                    return
                  }
                  setSaving(false)
                  setStep((current) => Math.max(current - 1, 0))
                }}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={saving || (onPreview && !detailsConfirmed)}
                onClick={goNext}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${onPreview ? 'bg-amber-500 font-medium' : 'bg-teal-700'}`}
              >
                {onPreview && <Check className="w-4 h-4" />}
                {saving ? (onPreview ? 'Submitting…' : 'Saving…') : primaryLabel}
              </button>
            </div>
            )}
          </>
        )}
      </main>
      {submittedPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white px-6 py-8 text-center shadow-xl" role="dialog" aria-modal="true" aria-labelledby="joining-submitted-title">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="w-6 h-6" />
            </div>
            <h2 id="joining-submitted-title" className="text-xl font-semibold text-teal-800">Your form is submitted</h2>
            <p className="mt-2 text-sm text-slate-600">HR has received your details.</p>
            <button
              type="button"
              className="mt-5 rounded-lg bg-teal-700 px-4 py-2 text-sm text-white"
              onClick={() => setSubmittedPopup(false)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
