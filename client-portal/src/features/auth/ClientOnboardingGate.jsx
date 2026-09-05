import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield,
  FileCheck2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Building,
  Check,
  FileText,
  Lock,
  Sun,
  Moon,
  CreditCard,
  Landmark,
  Download,
} from 'lucide-react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { SignaturePad } from '../../components/ui/SignaturePad'
import { useUserStore } from '../../stores/userStore'
import { useUIStore } from '../../stores/uiStore'
import haloLogo from '../../assets/halologo.png'
import {
  ONBOARDING_STATUS,
  resolveAgreements,
  getClientOnboardingDoc,
  submitClientOnboarding,
  persistClientAgreement,
} from '../../shared/services/onboardingService'
import { logoutUser } from '../../shared/services/authService'
import { getPaymentDetails } from '../../shared/services/paymentDetailsService'
import { CompanyBankDetails } from '../../components/ui/CompanyBankDetails'
import { downloadAgreementRecordAsPDF } from '../../shared/utils/agreementPdf'

export const ClientOnboardingGate = () => {
  const navigate = useNavigate()
  const { user, userDoc, setUser, clearUser } = useUserStore()
  const { theme, toggleTheme } = useUIStore()

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1) // 1: Signatures, 2: Payment details, 3: Review & Submit
  const [agreementIndex, setAgreementIndex] = useState(0) // 0: MSA, 1: NDA, 2: SOW
  const [paymentDetails, setPaymentDetails] = useState(null)

  // Onboarding Status State
  const [onboardingStatus, setOnboardingStatus] = useState(ONBOARDING_STATUS.PENDING_SIGNATURE)
  const [rejectionReason, setRejectionReason] = useState('')

  // Account profile — entered by the admin at account creation, shown read-only here
  const [companyName, setCompanyName] = useState('')
  const [billingInfo, setBillingInfo] = useState(null)
  const [signerDefaults, setSignerDefaults] = useState(null)

  // Contract wording, which the admin may have tailored for this client
  const [agreementTexts, setAgreementTexts] = useState(null)

  // Agreements State: { msa: { signed: true, ... }, nda: ... }
  const [agreements, setAgreements] = useState({})

  const [errorMsg, setErrorMsg] = useState('')

  const contracts = resolveAgreements(agreementTexts)

  // Load existing onboarding status
  const loadStatus = async () => {
    if (!user?.uid) {
      navigate('/login')
      return
    }

    try {
      const data = await getClientOnboardingDoc(user.uid)
      if (data) {
        const skipAgreements = Boolean(data.skipAgreements)
        const status = skipAgreements
          ? ONBOARDING_STATUS.APPROVED
          : data.onboardingStatus || ONBOARDING_STATUS.PENDING_SIGNATURE
        setOnboardingStatus(status)
        setRejectionReason(data.rejectionReason || '')
        setCompanyName(data.companyName || userDoc?.companyName || '')
        const loadedAgreements = data.agreements || {}
        setAgreements(loadedAgreements)
        setAgreementTexts(data.agreementTexts || null)
        setBillingInfo(data.billingInfo || null)
        setSignerDefaults({
          signatoryName: data.displayName || userDoc?.displayName || '',
          signatoryTitle: data.signatoryTitle || '',
        })

        const resolved = resolveAgreements(data.agreementTexts || null)
        const firstUnsigned = resolved.findIndex((ag) => !loadedAgreements[ag.id]?.signed)
        setAgreementIndex(firstUnsigned >= 0 ? firstUnsigned : Math.max(0, resolved.length - 1))
        if (firstUnsigned < 0 && resolved.length > 0) {
          setStep(1)
        }

        // If approved, update store and localStorage before navigating to prevent AppShell bounce
        if (skipAgreements || status === ONBOARDING_STATUS.APPROVED) {
          try {
            localStorage.setItem(`onboarding_status_${user.uid}`, ONBOARDING_STATUS.APPROVED)
          } catch {
            // ignore
          }
          setUser(user, { ...userDoc, ...data, onboardingStatus: ONBOARDING_STATUS.APPROVED, skipAgreements })
          navigate('/portal', { replace: true })
        }
      }
    } catch (err) {
      console.error('Error loading onboarding status:', err)
    }
  }

  useEffect(() => {
    if (user?.uid) {
      loadStatus()
    }
  }, [user?.uid])

  useEffect(() => {
    let cancelled = false
    getPaymentDetails()
      .then((details) => {
        if (!cancelled) setPaymentDetails(details)
      })
      .catch(() => {
        if (!cancelled) setPaymentDetails(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * Store the exact wording the client saw alongside the signature, so the
   * executed copy is preserved even if a template is edited later.
   * Persist immediately so Re-Sign survives refresh and admin sees the update.
   */
  const handleAgreementSave = async (contract, sigRecord) => {
    const nextRecord = sigRecord
      ? {
          ...sigRecord,
          signedTitle: contract.title,
          signedContent: contract.content,
        }
      : null

    try {
      await persistClientAgreement(user.uid, contract.id, nextRecord)
      setAgreements((prev) => {
        if (!nextRecord) {
          const copy = { ...prev }
          delete copy[contract.id]
          return copy
        }
        return {
          ...prev,
          [contract.id]: nextRecord,
        }
      })
      if (!nextRecord) setStep(1)
      setErrorMsg('')
    } catch (err) {
      setErrorMsg(err.message || 'Could not save your signature. Please try again.')
      throw err
    }
  }

  const handleDownloadAgreement = (ag) => {
    if (!ag) return
    downloadAgreementRecordAsPDF({
      id: ag.id,
      title: ag.title,
      content: ag.content,
      sigRecord: agreements[ag.id],
      clientName: companyName || userDoc?.companyName || user?.displayName,
    })
  }

  const areSignaturesComplete = () => {
    return contracts.length > 0 && contracts.every((ag) => agreements[ag.id]?.signed)
  }

  const isAgreementUnlocked = (idx) => {
    if (idx <= 0) return true
    return contracts.slice(0, idx).every((ag) => agreements[ag.id]?.signed)
  }

  const agreementKindLabel = (idx) => {
    if (idx === 0) return 'Master Services'
    if (idx === 1) return 'Non-Disclosure'
    return 'Statement of Work'
  }

  const goToAgreement = (idx) => {
    if (!isAgreementUnlocked(idx)) {
      setErrorMsg('Finish and sign the current agreement before opening the next one.')
      return
    }
    setErrorMsg('')
    setAgreementIndex(idx)
  }

  const handleSubmitOnboarding = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!areSignaturesComplete()) {
      setErrorMsg('All legal agreements must be electronically signed.')
      setStep(1)
      return
    }

    try {
      setSubmitting(true)
      const result = await submitClientOnboarding(user.uid, { agreements })
      setOnboardingStatus(ONBOARDING_STATUS.PENDING_APPROVAL)
      setUser(user, { ...userDoc, onboardingStatus: ONBOARDING_STATUS.PENDING_APPROVAL })
      return result
    } catch (err) {
      console.error('Submission failed:', err)
      setErrorMsg(err.message || 'Failed to submit your signed agreements. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logoutUser()
    clearUser()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-4 text-fg transition-colors">
        <Spinner size="lg" />
        <p className="text-xs text-muted mt-4">Verifying client workspace authorization...</p>
      </div>
    )
  }

  // ─── RENDER: PENDING APPROVAL SCREEN (UNDER ADMIN REVIEW) ───────────────────────
  if (onboardingStatus === ONBOARDING_STATUS.PENDING_APPROVAL) {
    return (
      <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-4 relative overflow-hidden transition-colors">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-amber-500/10 dark:bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />

        <Card className="w-full max-w-2xl p-8 relative z-10 border-border shadow-xl dark:shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-1 border border-slate-200 dark:border-white/30 flex items-center justify-center shrink-0">
                <img src={haloLogo} alt="Logo" className="w-full h-full object-contain rounded-full" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-fg">Client Agreement Verification</h2>
                <p className="text-xs text-muted">Account: {user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="w-8 h-8 rounded-lg bg-chrome hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 flex items-center justify-center transition-all cursor-pointer border border-border"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
              <Badge variant="warning" className="flex items-center gap-1.5 px-3 py-1 text-xs">
                <Clock className="w-3.5 h-3.5 animate-spin" /> Under Admin Review
              </Badge>
            </div>
          </div>

          <div className="text-center py-4 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-fg">Signed Agreements Under Review</h3>
            <p className="text-xs text-muted max-w-lg mx-auto leading-relaxed">
              Thank you for signing your legal agreements. Our operations team has been notified and is completing the
              final activation of your workspace.
            </p>
          </div>

          {/* Audit Verification Checklist */}
          <div className="bg-slate-50 dark:bg-slate-950/70 border border-border rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Submission Summary</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface border border-border flex items-center gap-2.5 shadow-sm dark:shadow-none">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-fg">Legal Agreements (3/3)</p>
                  <p className="text-[11px] text-muted">MSA, NDA &amp; SOW Digitally Signed</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border flex items-center gap-2.5 shadow-sm dark:shadow-none">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-fg">Account Profile</p>
                  <p className="text-[11px] text-muted">Confirmed for {companyName || 'your entity'}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface border border-border flex items-center gap-2.5 shadow-sm dark:shadow-none sm:col-span-2">
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-semibold text-fg">Admin Approval</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Pending Executive Sign-off</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-accent-soft border border-accent/20 dark:border-accent/20 text-xs text-accent flex items-start gap-2.5">
            <Lock className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
            <span>
              Deliverables, invoices, code repositories, and project timelines will automatically unlock on this portal as soon as an administrator grants approval.
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="secondary" size="sm" onClick={handleLogout} icon={LogOut}>
              Sign Out
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={loadStatus}
              className="bg-accent hover:bg-accent-hover"
              icon={RefreshCw}
            >
              Check Approval Status
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // ─── RENDER: TWO-STEP SIGNATURE WIZARD ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col p-4 sm:p-8 relative overflow-hidden transition-colors">
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent-soft blur-[150px] rounded-full pointer-events-none" />

      {/* Top Header */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white p-1 border border-slate-200 dark:border-white/30 flex items-center justify-center shrink-0">
            <img src={haloLogo} alt="Logo" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-fg">Client Agreement Signing</h1>
            <p className="text-xs text-muted">Sign your agreements to activate your portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sun/Moon Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-9 h-9 rounded-xl bg-chrome hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 flex items-center justify-center transition-all cursor-pointer border border-border shadow-sm"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
            )}
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer px-2.5 py-1.5 rounded-lg border border-border bg-surface/50 shadow-sm"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Step Indicators — later steps appear only after every agreement is signed */}
      <div className="max-w-4xl w-full mx-auto mb-8">
        {areSignaturesComplete() ? (
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              { num: 1, title: 'Sign Agreements', icon: FileCheck2 },
              { num: 2, title: 'Payment Details', icon: Landmark },
              { num: 3, title: 'Review & Submit', icon: CheckCircle2 },
            ].map((s) => {
              const Icon = s.icon
              const isDone = s.num < step
              const isCurrent = step === s.num

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    setErrorMsg('')
                    setStep(s.num)
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-accent-soft dark:bg-accent/15 border-accent dark:border-accent/60 shadow-md shadow-accent/10'
                      : isDone
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/30 text-emerald-900 dark:text-slate-300'
                      : 'bg-surface/40 border-border text-muted hover:border-slate-300 dark:hover:border-slate-700 shadow-sm dark:shadow-none'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-accent text-white'
                          : 'bg-chrome text-muted'
                      }`}
                    >
                      {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : s.num}
                    </div>
                    <Icon
                      className={`w-4 h-4 ${
                        isDone
                          ? 'text-emerald-500 dark:text-emerald-400'
                          : isCurrent
                          ? 'text-accent'
                          : 'text-slate-400 dark:text-slate-600'
                      }`}
                    />
                  </div>
                  <p className="text-xs font-semibold truncate text-slate-900 dark:text-slate-200">{s.title}</p>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="p-3 rounded-xl border bg-accent-soft dark:bg-accent/15 border-accent dark:border-accent/60 shadow-md shadow-accent/10">
            <div className="flex items-center justify-between mb-1.5">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold bg-accent text-white">
                1
              </div>
              <FileCheck2 className="w-4 h-4 text-accent" />
            </div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-200">Sign Agreements</p>
            <p className="text-[11px] text-muted mt-0.5">
              Complete each document in order. Payment details and Review &amp; Submit unlock after all signatures.
            </p>
          </div>
        )}
      </div>

      {/* Main Form Container */}
      <div className="max-w-4xl w-full mx-auto pb-16">
        {/* Rejection / Resubmission Banner if applicable */}
        {onboardingStatus === ONBOARDING_STATUS.REJECTED && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-200">Re-signature Requested by Compliance Admin</p>
              <p className="mt-1 text-fg">
                {rejectionReason || 'Please review your signatures and re-submit for approval.'}
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: LEGAL AGREEMENTS & E-SIGNATURES (INDIVIDUAL CONTRACT SUB-PAGES) */}
        {step === 1 && (() => {
          const currentAgreement = contracts[agreementIndex] || contracts[0]
          const isCurrentAgreementSigned = !!agreements[currentAgreement?.id]?.signed
          const signedAgreementsCount = contracts.filter((ag) => agreements[ag.id]?.signed).length
          const progressPct = contracts.length ? Math.round((signedAgreementsCount / contracts.length) * 100) : 0

          return (
            <div className="space-y-6">
              <div className="bg-surface/40 p-5 rounded-2xl border border-border shadow-sm dark:shadow-none space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-fg">
                      Agreement {agreementIndex + 1} of {contracts.length}
                    </h2>
                    <p className="text-xs text-muted mt-0.5">
                      Sign this document to unlock the next one. You can go back to review a signed agreement.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20 dark:border-accent/20">
                    Progress: {signedAgreementsCount} of {contracts.length} Signed
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-chrome overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Sequential trail — future agreements stay locked until the current one is signed */}
                <div className="flex items-center gap-2">
                  {contracts.map((ag, idx) => {
                    const isSigned = !!agreements[ag.id]?.signed
                    const unlocked = isAgreementUnlocked(idx)
                    const isSelected = agreementIndex === idx

                    return (
                      <React.Fragment key={ag.id}>
                        {idx > 0 && (
                          <div
                            className={`flex-1 h-0.5 rounded-full ${
                              isSigned || unlocked ? 'bg-emerald-400/70 dark:bg-emerald-500/40' : 'bg-slate-200 dark:bg-slate-800'
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => goToAgreement(idx)}
                          disabled={!unlocked}
                          title={
                            unlocked
                              ? `${ag.id.toUpperCase()} Agreement`
                              : 'Sign the previous agreement to unlock this document'
                          }
                          className={`flex items-center gap-2 min-w-0 px-2.5 py-2 rounded-xl border text-left transition-all ${
                            !unlocked
                              ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-950/40 border-border'
                              : isSelected
                              ? 'cursor-pointer bg-accent-soft border-accent shadow-sm'
                              : isSigned
                              ? 'cursor-pointer bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-400'
                              : 'cursor-pointer bg-slate-50/70 dark:bg-slate-950/40 border-border'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSigned
                                ? 'bg-emerald-500 text-white'
                                : isSelected
                                ? 'bg-accent text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-muted'
                            }`}
                          >
                            {isSigned ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : unlocked ? (
                              idx + 1
                            ) : (
                              <Lock className="w-3 h-3" />
                            )}
                          </div>
                          <span className="hidden sm:block text-[11px] font-semibold truncate text-fg">
                            {ag.id.toUpperCase()}
                          </span>
                        </button>
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Only the current agreement is shown as the active card */}
                <div className="p-4 rounded-xl border border-accent/20 dark:border-accent/30 bg-accent-soft/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-accent">
                        Now signing
                      </p>
                      <p className="text-sm font-bold text-fg truncate mt-0.5">
                        {currentAgreement?.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {agreementKindLabel(agreementIndex)}
                      </p>
                    </div>
                    {isCurrentAgreementSigned ? (
                      <Badge variant="success" className="text-[10px] shrink-0">Signed</Badge>
                    ) : (
                      <Badge variant="neutral" className="text-[10px] shrink-0">Pending</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Dedicated Agreement Viewer & Signature Card */}
              {currentAgreement && (
              <SignaturePad
                key={currentAgreement.id}
                agreementTitle={currentAgreement.title}
                agreementSummary={currentAgreement.summary}
                agreementContent={currentAgreement.content}
                initialData={agreements[currentAgreement.id] || signerDefaults}
                onSave={(record) => handleAgreementSave(currentAgreement, record)}
                showFullAgreementByDefault={true}
                allowToggle={true}
                onDownload={() => handleDownloadAgreement(currentAgreement)}
              />
              )}

              {/* Bottom Sub-step Navigation Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div>
                  {agreementIndex > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => goToAgreement(agreementIndex - 1)}
                      icon={ArrowLeft}
                    >
                      Back to {contracts[agreementIndex - 1]?.title.split('(')[0]}
                    </Button>
                  ) : (
                    <div />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {agreementIndex < contracts.length - 1 ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (!isCurrentAgreementSigned) {
                          setErrorMsg(`Please sign and accept the ${currentAgreement.title.split('(')[0]} before moving to the next document.`)
                          return
                        }
                        goToAgreement(agreementIndex + 1)
                      }}
                      disabled={!isCurrentAgreementSigned}
                      className="bg-accent hover:bg-accent-hover"
                      icon={ArrowRight}
                    >
                      Next: {contracts[agreementIndex + 1]?.title.split('(')[0]}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => {
                        if (!areSignaturesComplete()) {
                          setErrorMsg('Please sign this last agreement before continuing.')
                          return
                        }
                        setErrorMsg('')
                        setStep(2)
                      }}
                      disabled={!areSignaturesComplete()}
                      className="bg-accent hover:bg-accent-hover shadow-md shadow-accent/20"
                      icon={ArrowRight}
                    >
                      Continue to Payment Details
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* STEP 2: COMPANY PAYMENT DETAILS */}
        {step === 2 && areSignaturesComplete() && (
          <div className="space-y-6">
            <div className="bg-surface/40 p-4 rounded-xl border border-border shadow-sm dark:shadow-none">
              <h2 className="text-base font-bold text-fg">Step 2: Payment Details</h2>
              <p className="text-xs text-muted mt-1">
                Use these company account details to pay invoices. Copy the account number and include your invoice
                number in the transfer reference.
              </p>
            </div>

            <CompanyBankDetails
              bank={paymentDetails}
              title="Our company account"
              description="Pay into this account. Your account manager can also share these details after your workspace is approved."
            />

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(1)} icon={ArrowLeft}>
                Back to Agreements
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setErrorMsg('')
                  setStep(3)
                }}
                className="bg-accent hover:bg-accent-hover shadow-md shadow-accent/20"
                icon={ArrowRight}
              >
                Continue to Review &amp; Submit
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & SUBMIT */}
        {step === 3 && areSignaturesComplete() && (
          <div className="space-y-6">
            <div className="bg-surface/40 p-4 rounded-xl border border-border shadow-sm dark:shadow-none">
              <h2 className="text-base font-bold text-fg">Step 3: Review &amp; Submit</h2>
              <p className="text-xs text-muted mt-1">
                Please confirm the details below. Your account profile was prepared by our team — if anything is
                incorrect, contact your account manager before submitting.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Signed Contracts Summary */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border">
                  <FileText className="w-4 h-4 text-accent" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-fg">Executed Contracts</h3>
                </div>

                <div className="space-y-2">
                  {contracts.map((ag) => {
                    const sig = agreements[ag.id]
                    return (
                      <div key={ag.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-border flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-fg">{ag.title}</p>
                          <p className="text-[11px] text-muted">Signatory: {sig?.signatoryName || 'Pending'}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {sig?.signed ? (
                            <Badge variant="success" className="text-[10px]">Signed</Badge>
                          ) : (
                            <Badge variant="danger" className="text-[10px]">Missing</Badge>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadAgreement(ag)}
                            className="px-2 py-1 rounded-lg border border-border text-accent font-semibold inline-flex items-center gap-1 hover:bg-accent-soft"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* Account Profile Summary (read-only, prepared by admin) */}
              <Card className="p-5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-bold text-xs uppercase tracking-wider text-fg">Account &amp; Billing</h3>
                  </div>
                  <Badge variant="neutral" className="text-[10px]">Prepared for you</Badge>
                </div>

                {billingInfo || companyName ? (
                  <div className="space-y-2">
                    {[
                      { label: 'Company', value: companyName, icon: Building },
                      { label: 'Billing Email', value: billingInfo?.billingEmail },
                      { label: 'Billing Address', value: billingInfo?.billingAddress },
                      { label: 'Tax ID / GST', value: billingInfo?.taxId },
                      { label: 'Payment Method', value: billingInfo?.paymentMethod?.toUpperCase() },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-border flex items-start justify-between gap-3 text-xs"
                      >
                        <span className="text-muted shrink-0">{row.label}</span>
                        <span className="font-semibold text-fg text-right break-words">
                          {row.value || <span className="text-slate-400 italic font-normal">Not provided</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted italic py-2">
                    Your account manager has not added billing details yet. You can still submit your signatures.
                  </p>
                )}
              </Card>
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                By submitting, you confirm that you are authorized to execute these agreements on behalf of your
                organization. Your workspace access will be activated upon review by the administrator.
              </span>
            </div>

            <div className="flex justify-between pt-4">
              <Button variant="secondary" onClick={() => setStep(2)} icon={ArrowLeft}>
                Back to Payment Details
              </Button>

              <Button
                variant="primary"
                onClick={handleSubmitOnboarding}
                disabled={submitting}
                className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20"
                icon={Shield}
              >
                {submitting ? 'Submitting...' : 'Submit for Admin Approval'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
