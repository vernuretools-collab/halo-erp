import React, { useState, useEffect } from 'react'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { usePortalStore } from './stores/portalStore'
import { useUserStore } from '../../stores/userStore'
import { db } from '../../shared/services/firebaseService'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { Briefcase, FileText, CreditCard, Loader2, X, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'

export const ClientInvoices = () => {
  const { user } = useUserStore()
  const { invoices: portalInvoices } = usePortalStore()
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)

  const fetchRealInvoices = async () => {
    try {
      setIsLoading(true)
      let list = []
      if (user?.uid) {
        const q = query(collection(db, 'invoices'), where('clientId', '==', user.uid))
        const snap = await getDocs(q)
        list = snap.docs.map((d) => ({ invoiceId: d.id, ...d.data() }))
      }

      if (list.length === 0 && portalInvoices?.length > 0) {
        list = portalInvoices
      }

      setInvoices(list)
    } catch (err) {
      console.warn('Error fetching client invoices:', err)
      setInvoices([])
    } finally {
      setIsLoading(false)
    }

  }

  useEffect(() => {
    fetchRealInvoices()
  }, [user])

  const handlePayNow = async (invoiceId) => {
    try {
      setInvoices((prev) =>
        prev.map((i) => (i.invoiceId === invoiceId ? { ...i, status: 'Paid' } : i))
      )
      const invRef = doc(db, 'invoices', invoiceId)
      await updateDoc(invRef, { status: 'Paid', paidAt: new Date().toISOString() })
    } catch (err) {
      console.warn('Simulated payment update:', err.message)
    }
  }

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      <div>
        <h2 className="text-2xl font-bold text-fg tracking-tight">
          Invoices & Payments
        </h2>
        <p className="text-sm text-muted mt-1">
          View client billing statements, settlement history, and download PDF receipts.{' '}
          <Link to="/portal/billing" className="text-accent font-semibold hover:underline">
            How to pay
          </Link>
        </p>
      </div>

      {/* Invoices Table */}
      <Card className="p-6 bg-surface border-border rounded-2xl shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 dark:text-slate-400 font-semibold">
                <th className="py-4 font-semibold">Invoice #</th>
                <th className="py-4 font-semibold">Project</th>
                <th className="py-4 font-semibold">Issue Date</th>
                <th className="py-4 font-semibold">Due Date</th>
                <th className="py-4 font-semibold">Amount</th>
                <th className="py-4 font-semibold">Status</th>
                <th className="py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                    <span className="text-xs">Loading client invoices...</span>
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    No client invoices available.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.invoiceId}
                    className="hover:bg-slate-50/60 dark:hover:bg-chrome/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedInvoice(inv)}
                  >
                    <td className="py-4 font-semibold text-fg">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-4 text-fg">
                      {inv.projectName || 'General Consulting'}
                    </td>
                    <td className="py-4 text-muted">
                      {inv.issueDate}
                    </td>
                    <td className="py-4 text-muted">
                      {inv.dueDate}
                    </td>
                    <td className="py-4 font-semibold text-fg">
                      ${(inv.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                          inv.status?.toLowerCase() === 'paid'
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                            : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400'
                        }`}
                      >
                        {inv.status || 'Due'}
                      </span>
                    </td>
                    <td className="py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-chrome hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-accent" />
                        <span>Receipt</span>
                      </button>
                      {inv.status?.toLowerCase() !== 'paid' && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={CreditCard}
                          onClick={() => handlePayNow(inv.invoiceId)}
                          className="bg-accent hover:bg-accent-hover text-white"
                        >
                          Pay Now
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice Detail / Receipt Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl text-fg transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-base text-fg">
                  Invoice: {selectedInvoice.invoiceNumber}
                </h3>
                <p className="text-xs text-muted">
                  {selectedInvoice.projectName || 'General Deliverables'}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-chrome cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-border space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted font-medium">Issue Date:</span>
                <span className="font-semibold text-fg">{selectedInvoice.issueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Due Date:</span>
                <span className="font-semibold text-fg">{selectedInvoice.dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted font-medium">Status:</span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    selectedInvoice.status?.toLowerCase() === 'paid'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400'
                  }`}
                >
                  {selectedInvoice.status}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border text-sm">
                <span className="font-bold text-fg">Total Settlement:</span>
                <span className="font-bold text-accent">
                  ${(selectedInvoice.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.print()}
                icon={Printer}
              >
                Print / Save Receipt
              </Button>
              {selectedInvoice.status?.toLowerCase() !== 'paid' ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    handlePayNow(selectedInvoice.invoiceId)
                    setSelectedInvoice(null)
                  }}
                  icon={CreditCard}
                  className="bg-accent hover:bg-accent-hover text-white"
                >
                  Pay Now
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

