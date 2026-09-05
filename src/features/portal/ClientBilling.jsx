import React, { useEffect, useState } from 'react'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Button } from '../../shared/components/ui/Button'
import { useUserStore } from '../../shared/stores/userStore'
import { getPaymentDetails } from '../../shared/services/paymentDetailsService'
import { db } from '../../shared/services/firebaseService'
import { doc, getDoc } from 'firebase/firestore'
import { Building, Landmark, Copy, Check } from 'lucide-react'

const CopyRow = ({ label, value }) => {
  const [copied, setCopied] = useState(false)
  if (!value) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-border">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
        <p className="text-sm font-semibold text-fg break-all mt-0.5">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy} className="shrink-0">
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

export const ClientBilling = () => {
  const { user, userDoc } = useUserStore()
  const [profile, setProfile] = useState(null)
  const [bank, setBank] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        let onboarding = null
        if (user?.uid) {
          const snap = await getDoc(doc(db, 'clientOnboarding', user.uid))
          if (snap.exists()) onboarding = snap.data()
        }
        const payment = await getPaymentDetails()
        setProfile(onboarding)
        setBank(payment)
      } catch (err) {
        console.warn('Failed to load billing page:', err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.uid])

  const billing = profile?.billingInfo || {}
  const companyName = profile?.companyName || userDoc?.companyName || ''
  const hasProfile = Boolean(
    companyName || billing.taxId || billing.billingAddress || billing.billingEmail
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <PageHeader
        title="Billing"
        description="Your billing profile and our company bank details for invoice payments."
      />

      {loading ? (
        <p className="text-sm text-muted">Loading billing details...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Building className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-sm text-fg">Your billing profile</h3>
            </div>
            {hasProfile ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] text-muted">Company</p>
                  <p className="font-semibold">{companyName || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">GST / Tax ID</p>
                  <p className="font-semibold">{billing.taxId || 'Not on file yet'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Billing address</p>
                  <p className="font-medium whitespace-pre-line">{billing.billingAddress || 'Not on file yet'}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">Billing email</p>
                  <p className="font-medium">{billing.billingEmail || user?.email || '—'}</p>
                </div>
                <p className="text-[11px] text-muted">
                  Need a GST or address change? Ask your account manager to update your client profile.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Your billing profile has not been filled in yet. Your account manager can add GST and address on your
                client profile.
              </p>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Landmark className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-sm text-fg">Pay our company</h3>
            </div>
            <p className="text-xs text-muted">
              Transfer invoice amounts to this account. Include your invoice number in the payment reference.
            </p>
            {bank ? (
              <div className="space-y-2">
                <CopyRow label="Bank name" value={bank.bankName} />
                <CopyRow label="Account name" value={bank.accountName} />
                <CopyRow label="Account number" value={bank.accountNumber} />
                <CopyRow label="IFSC" value={bank.ifsc} />
                <CopyRow label="SWIFT" value={bank.swift} />
                <CopyRow label="UPI" value={bank.upi} />
                <CopyRow label="Branch" value={bank.branch} />
                {bank.notes && (
                  <p className="text-xs text-muted bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3">
                    {bank.notes}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">Bank details are not available yet.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
