import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import haloLogo from '../../assets/halologo.png'
import { fetchCustomClaims, logoutUser } from '../../shared/services/authService'
import { auth, supabase } from '../../shared/services/firebaseService'
import { useUserStore } from '../../stores/userStore'
import { useLiveAuthSession } from '../../../../shared/supabase/useLiveAuthSession.js'
import { ONBOARDING_STATUS, isJoiningRole } from '../../../../shared/supabase/employeeOnboarding.js'
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

  useEffect(() => {
    if (!sessionReady || !user) return undefined
    if (!isJoiningRole(claims?.role)) {
      logoutUser().finally(() => setBlocked(true))
      return undefined
    }
    let cancelled = false
    supabase
      .from('employee_onboarding')
      .select('*')
      .eq('auth_id', user.uid)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return
        if (loadError) setError(loadError.message)
        else {
          setRow(data)
          setAnswers(mergeJoiningAnswers(data?.answers))
        }
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
    if (saveError) throw saveError
  }

  const goNext = async () => {
    const message = validateJoiningStep(JOINING_STEPS[step].id, answers)
    if (message) {
      setError(message)
      return
    }
    setError('')
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
      if (submitError) throw submitError
      setRow((current) => ({ ...current, status: ONBOARDING_STATUS.SUBMITTED, answers }))
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
  ][step]

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
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
            {submitted && (
              <p className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">
                Your form is submitted. Your admin can review it.
              </p>
            )}
            <JoiningWizard
              step={step}
              answers={answers}
              setAnswers={setAnswers}
              employment={row.employment || {}}
              readOnly={submitted}
            />
            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-lg border border-teal-700 px-4 py-2 text-sm text-teal-800 disabled:opacity-40"
                disabled={step === 0 || saving}
                onClick={async () => {
                  setError('')
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
                  setStep((current) => Math.max(current - 1, 0))
                }}
              >
                ← Back
              </button>
              {step < JOINING_STEPS.length - 1 ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={goNext}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : `${nextLabel} →`}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || submitted}
                  onClick={submit}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {submitted ? 'Submitted' : saving ? 'Submitting…' : 'Submit Onboarding Form'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
