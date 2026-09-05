import React, { useEffect, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { useUserStore } from '../../stores/userStore'
import { getClientOnboardingDoc } from '../../shared/services/onboardingService'
import { getPaymentDetails } from '../../shared/services/paymentDetailsService'
import { Building, CreditCard, MapPin, Mail, Hash } from 'lucide-react'
import { CompanyBankDetails } from '../../components/ui/CompanyBankDetails'

export const ClientBilling = () => {
  const { user, userDoc } = useUserStore()
  const [profile, setProfile] = useState(null)
  const [bank, setBank] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [onboarding, payment] = await Promise.all([
          user?.uid ? getClientOnboardingDoc(user.uid) : null,
          getPaymentDetails(),
        ])
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
        <p className="text-sm text-slate-500">Loading billing details...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border">
              <Building className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-sm text-fg">Your billing profile</h3>
            </div>
            {hasProfile ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Building className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500">Company</p>
                    <p className="font-semibold text-fg">{companyName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hash className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500">GST / Tax ID</p>
                    <p className="font-semibold text-fg">{billing.taxId || 'Not on file yet'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500">Billing address</p>
                    <p className="font-medium text-fg whitespace-pre-line">
                      {billing.billingAddress || 'Not on file yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-500">Billing email</p>
                    <p className="font-medium text-fg">
                      {billing.billingEmail || user?.email || '—'}
                    </p>
                  </div>
                </div>
                {billing.paymentMethod && (
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-500">Preferred method</p>
                      <p className="font-medium uppercase text-fg">{billing.paymentMethod}</p>
                    </div>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 pt-1">
                  Need a GST or address change? Ask your account manager — they update this from your client profile.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Your billing profile has not been filled in yet. Your account manager can add GST and address on your
                client profile.
              </p>
            )}
          </Card>

          <CompanyBankDetails bank={bank} />
        </div>
      )}
    </div>
  )
}
