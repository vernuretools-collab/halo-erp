import React, { useState } from 'react'
import { Landmark, Copy, Check } from 'lucide-react'
import { Card } from './Card'
import { Button } from './Button'

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
    <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 break-all mt-0.5">{value}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" icon={copied ? Check : Copy} onClick={copy} className="shrink-0">
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}

export const CompanyBankDetails = ({
  bank,
  title = 'Pay our company',
  description = 'Transfer invoice amounts to this account. Include your invoice number in the payment reference.',
  asCard = true,
}) => {
  const body = (
    <>
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
        <Landmark className="w-4 h-4 text-emerald-500" />
        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{title}</h3>
      </div>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      )}
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
            <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3">
              {bank.notes}
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Bank details are not available yet.</p>
      )}
    </>
  )

  if (!asCard) {
    return <div className="space-y-4">{body}</div>
  }

  return <Card className="space-y-4">{body}</Card>
}
