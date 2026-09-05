import React, { useState, useEffect } from 'react'
import { X, Download, Send, FileText, CreditCard, ShieldCheck } from 'lucide-react'
import { Button } from '../../../shared/components/ui/Button'
import { Badge } from '../../../shared/components/ui/Badge'
import { downloadInvoiceAsPDF } from '../utils/pdfGenerator'
import { getPaymentDetails, DEFAULT_PAYMENT_DETAILS } from '../../../shared/services/paymentDetailsService'

export const ProfessionalInvoiceModal = ({ invoice, onClose, onSendClient }) => {
  const [bank, setBank] = useState(DEFAULT_PAYMENT_DETAILS)

  useEffect(() => {
    getPaymentDetails().then(setBank).catch(() => {})
  }, [])

  if (!invoice) return null

  const handleDownloadPDF = () => {
    downloadInvoiceAsPDF(invoice)
  }

  const getStatusVariant = (status) => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'sent':
        return 'info'
      case 'overdue':
        return 'danger'
      default:
        return 'warning'
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-border rounded-2xl shadow-2xl overflow-hidden relative max-h-[92vh] flex flex-col my-auto text-fg">
        
        {/* Modal Top Control Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-950/80">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            <h2 className="font-bold text-sm text-fg">Professional Invoice Details</h2>
            <Badge variant={getStatusVariant(invoice.status)} className="capitalize ml-2">
              {invoice.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Download}
              onClick={handleDownloadPDF}
              className="bg-accent hover:bg-accent-hover text-white font-semibold shadow-lg"
            >
              Download PDF File
            </Button>

            {onSendClient && invoice.status !== 'sent' && invoice.status !== 'paid' && (
              <Button
                variant="secondary"
                size="sm"
                icon={Send}
                onClick={() => onSendClient(invoice.invoiceId)}
              >
                Send to Client
              </Button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet Body */}
        <div id="printable-invoice-sheet" className="p-8 overflow-y-auto space-y-8 bg-surface text-fg">
          
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b border-border pb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-white font-black text-xl shadow-lg">
                  N
                </div>
                <div>
                  <h1 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                    NEXT-GEN CRM SYSTEMS
                  </h1>
                  <p className="text-xs text-muted">Enterprise Solutions & Digital Services</p>
                </div>
              </div>
              <div className="mt-4 text-xs text-muted space-y-0.5">
                <p className="font-medium text-fg">HQ Headquarters Inc.</p>
                <p>100 Innovation Boulevard, Suite 500</p>
                <p>Tech City, CA 94107 | Tax ID: US-987654321</p>
                <p>support@nextgencrm.io | +1 (800) 555-0199</p>
              </div>
            </div>

            <div className="text-right space-y-2">
              <div className="inline-block px-3 py-1 bg-accent-soft border border-accent/30 rounded-lg text-accent font-bold text-xs uppercase tracking-wider">
                INVOICE
              </div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{invoice.invoiceNumber}</h2>
              <div className="text-xs text-muted space-y-1 pt-1">
                <p><span className="font-semibold text-fg">Issue Date:</span> {invoice.issueDate || '2024-07-27'}</p>
                <p><span className="font-semibold text-fg">Due Date:</span> {invoice.dueDate || '2024-08-10'}</p>
                {invoice.sentAt && (
                  <p><span className="font-semibold text-fg">Sent Date:</span> {invoice.sentAt}</p>
                )}
              </div>
            </div>
          </div>

          {/* Billed To & Project Details Section */}
          <div className="grid grid-cols-2 gap-6 bg-canvas/50 p-4 rounded-xl border border-border">
            <div>
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-1">
                Billed To (Client)
              </span>
              <h3 className="font-bold text-base text-fg">{invoice.clientName}</h3>
              {invoice.clientEmail && (
                <p className="text-xs text-muted">{invoice.clientEmail}</p>
              )}
              <p className="text-xs text-muted mt-1">Corporate Client ID: CLI-88402</p>
            </div>

            <div className="border-l border-border pl-6">
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-1">
                Associated Project
              </span>
              <h3 className="font-bold text-sm text-fg">
                {invoice.projectName || 'General Consulting & Services'}
              </h3>
              <p className="text-xs text-muted mt-0.5">
                Project Ref ID: {invoice.projectId || 'PRJ-GENERAL'}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/50">
                <ShieldCheck className="w-3 h-3" /> Standard Payment Terms: Net 15
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider">Itemized Deliverables & Services</h4>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-canvas border-b border-border text-fg font-semibold">
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-center">Qty</th>
                    <th className="p-3.5 text-right">Unit Price (₹)</th>
                    <th className="p-3.5 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {invoice.lineItems && invoice.lineItems.length > 0 ? (
                    invoice.lineItems.map((item, idx) => (
                      <tr key={idx} className="text-fg">
                        <td className="p-3.5 font-medium text-slate-400">{idx + 1}</td>
                        <td className="p-3.5 font-semibold text-fg">{item.description}</td>
                        <td className="p-3.5 text-center font-medium">{item.quantity}</td>
                        <td className="p-3.5 text-right font-medium">₹{(item.unitPrice || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                          ₹{((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr className="text-fg">
                      <td className="p-3.5 font-medium text-slate-400">1</td>
                      <td className="p-3.5 font-semibold text-fg">Professional Services & Consulting</td>
                      <td className="p-3.5 text-center font-medium">1</td>
                      <td className="p-3.5 text-right font-medium">₹{(invoice.subtotal || invoice.total || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3.5 text-right font-bold text-slate-900 dark:text-white">
                        ₹{(invoice.subtotal || invoice.total || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals & Financial Breakdown */}
          <div className="flex justify-between items-start pt-2">
            <div className="w-1/2 space-y-3">
              <div className="p-3.5 rounded-xl bg-canvas/60 border border-border text-xs space-y-1.5">
                <p className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-accent" /> Bank & Wire Transfer Details
                </p>
                <div className="text-muted text-[11px] space-y-0.5 font-mono">
                  <p><span className="font-semibold text-fg">Bank Name:</span> {bank.bankName}</p>
                  <p><span className="font-semibold text-fg">Account Name:</span> {bank.accountName}</p>
                  <p><span className="font-semibold text-fg">Account No:</span> {bank.accountNumber}</p>
                  <p><span className="font-semibold text-fg">IFSC Code:</span> {bank.ifsc}</p>
                </div>
              </div>
            </div>

            <div className="w-5/12 space-y-2 text-xs text-right">
              <div className="flex justify-between text-muted py-1">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  ₹{(invoice.subtotal || invoice.total || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-muted py-1 border-b border-border">
                <span>GST / Tax (10%):</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  ₹{(invoice.taxTotal || Math.round((invoice.total || 0) * 0.1)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between py-2 font-bold text-base text-slate-900 dark:text-white">
                <span>Total Amount Due:</span>
                <span className="text-accent">
                  ₹{(invoice.total || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-2 rounded bg-accent-soft border border-accent/30 text-[11px] text-accent text-center font-medium">
                Thank you for your business! Please include Invoice #{invoice.invoiceNumber} with wire payment.
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-border pt-4 text-center text-[11px] text-muted">
            This is an official invoice generated by Next-Gen CRM Engine.
          </div>
        </div>

        {/* Modal Bottom Control Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-slate-950">
          <span className="text-xs text-slate-400">
            Click Download PDF to save a copy directly to your device
          </span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button variant="primary" size="sm" icon={Download} onClick={handleDownloadPDF}>
              Download PDF File
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
