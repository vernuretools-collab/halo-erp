import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useFinanceStore } from './stores/financeStore'
import { useProjectStore } from '../projects/stores/projectStore'
import { getInvoices, createInvoice, updateInvoiceStatusInDb, deleteInvoiceFromDb } from './services/financeService'
import { ProfessionalInvoiceModal } from './components/ProfessionalInvoiceModal'
import { downloadInvoiceAsPDF } from './utils/pdfGenerator'
import {
  Plus,
  Search,
  IndianRupee,
  FileText,
  Clock,
  TrendingUp,
  AlertCircle,
  Download,
  Send,
  Trash2,
  X,
  PlusCircle,
  CreditCard,
  Briefcase,
  CheckCircle2,
  Loader2
} from 'lucide-react'

export const InvoiceList = () => {
  const {
    invoices,
    isLoading,
    addInvoice,
    sendInvoiceToClient,
    updateInvoiceStatus,
    deleteInvoice,
    invoiceStatusFilter,
    setInvoiceStatusFilter,
    setInvoices,
    setIsLoading,
  } = useFinanceStore()

  const { projects } = useProjectStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [sendSuccessMsg, setSendSuccessMsg] = useState('')

  // Invoice form state
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [taxRate, setTaxRate] = useState(10)
  const [lineItems, setLineItems] = useState([
    { description: 'Professional Consulting Services', quantity: 1, unitPrice: 5000 },
  ])

  useEffect(() => {
    let isMounted = true
    const fetchRealInvoices = async () => {
      setIsLoading(true)
      const data = await getInvoices()
      if (isMounted) {
        setInvoices(data || [])
      }
    }
    fetchRealInvoices()
    return () => {
      isMounted = false
    }
  }, [setInvoices, setIsLoading])

  // When project dropdown changes in creation modal
  const handleProjectSelect = (projId) => {
    setSelectedProjectId(projId)
    const matchedProj = projects.find((p) => (p.projectId || p.id) === projId)
    if (matchedProj) {
      setClientName(matchedProj.clientName || 'Acme Client Corp')
      setClientEmail(`billing@${(matchedProj.clientName || 'acme').toLowerCase().replace(/[^a-z]/g, '')}.com`)
    }
  }

  // Filtered invoices
  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.clientName && inv.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (inv.projectName && inv.projectName.toLowerCase().includes(searchQuery.toLowerCase()))
    const matchesStatus =
      invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter
    return matchesSearch && matchesStatus
  })

  // Finance Metrics
  const totalInvoiced = invoices.reduce((sum, i) => sum + (i.total || 0), 0)
  const totalCollected = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.total || 0), 0)
  const totalOverdue = invoices
    .filter((i) => i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amountDue || 0), 0)

  // Line item helpers
  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      { description: '', quantity: 1, unitPrice: 0 },
    ])
  }

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems]
    updated[index][field] = field === 'description' ? value : Number(value)
    setLineItems(updated)
  }

  const handleRemoveLineItem = (index) => {
    if (lineItems.length === 1) return
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const subtotal = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice || 0),
    0
  )
  const taxTotal = Math.round(subtotal * (taxRate / 100))
  const grandTotal = subtotal + taxTotal

  const handleCreateInvoice = async (e) => {
    e.preventDefault()
    if (!clientName.trim()) return

    const selectedProj = projects.find((p) => (p.projectId || p.id) === selectedProjectId)

    const processedLineItems = lineItems.map((item) => ({
      ...item,
      amount: item.quantity * item.unitPrice,
    }))

    const payload = {
      clientName,
      clientEmail: clientEmail || `${clientName.toLowerCase().replace(/[^a-z]/g, '')}@client.com`,
      projectId: selectedProjectId || 'proj_general',
      projectName: selectedProj ? selectedProj.name : 'General Client Services',
      dueDate: dueDate || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0],
      subtotal,
      taxTotal,
      total: grandTotal,
      lineItems: processedLineItems,
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
      status: 'draft',
      issueDate: new Date().toISOString().split('T')[0],
      amountPaid: 0,
      amountDue: grandTotal,
      currency: 'INR',
    }

    const created = await createInvoice(payload)
    addInvoice(created)

    // Reset Form
    setSelectedProjectId('')
    setClientName('')
    setClientEmail('')
    setLineItems([{ description: 'Professional Consulting Services', quantity: 1, unitPrice: 5000 }])
    setShowAddModal(false)
  }

  const handleSendInvoiceToClient = async (invoiceId) => {
    sendInvoiceToClient(invoiceId)
    await updateInvoiceStatusInDb(invoiceId, 'sent')
    const inv = invoices.find((i) => i.invoiceId === invoiceId)
    setSendSuccessMsg(`Invoice ${inv?.invoiceNumber || ''} successfully sent to client for ${inv?.projectName || 'Project'}!`)
    setTimeout(() => setSendSuccessMsg(''), 4000)
    if (selectedInvoice && selectedInvoice.invoiceId === invoiceId) {
      setSelectedInvoice({ ...selectedInvoice, status: 'sent', sentAt: new Date().toLocaleString() })
    }
  }

  const handleStatusChange = async (invoiceId, status) => {
    updateInvoiceStatus(invoiceId, status)
    await updateInvoiceStatusInDb(invoiceId, status)
  }

  const handleDeleteInvoice = async (invoiceId) => {
    if (selectedInvoice?.invoiceId === invoiceId) {
      setSelectedInvoice(null)
    }
    deleteInvoice(invoiceId)
    await deleteInvoiceFromDb(invoiceId)
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {sendSuccessMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-xl flex items-center justify-between text-xs font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{sendSuccessMsg}</span>
          </div>
          <button onClick={() => setSendSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Finance & Invoicing Engine"
          description="Client billing, professional invoice generation, project dispatch, and expense tracking"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Create Invoice
            </Button>
          }
        />

        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <NavLink
              to="/finance/invoices"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <FileText className="w-3.5 h-3.5" /> Invoices
            </NavLink>
            <NavLink
              to="/finance/expenses"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <CreditCard className="w-3.5 h-3.5" /> Expenses & Vendors
            </NavLink>
            <NavLink
              to="/finance/recurring"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-accent-soft text-accent border border-accent/30'
                    : 'text-muted hover:text-fg hover:bg-slate-100 dark:hover:bg-slate-800'
                }`
              }
            >
              <Clock className="w-3.5 h-3.5" /> Recurring Billing
            </NavLink>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="bg-canvas border border-border text-xs text-fg rounded-xl px-3 py-1.5 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="sent">Sent</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
            </select>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search invoice #, client, project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-canvas border border-border text-xs text-fg placeholder:text-muted rounded-xl pl-8 pr-3 py-1.5 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Finance Metrics Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Invoiced
            </span>
            <p className="text-xl font-bold text-fg mt-1">
              ₹{totalInvoiced.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <IndianRupee className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Total Collected Revenue
            </span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{totalCollected.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between border-border">
          <div>
            <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Outstanding Overdue
            </span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              ₹{totalOverdue.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400 font-semibold">
              <th className="p-4 font-semibold">Invoice #</th>
              <th className="p-4 font-semibold">Client Name</th>
              <th className="p-4 font-semibold">Target Project</th>
              <th className="p-4 font-semibold">Issue Date</th>
              <th className="p-4 font-semibold">Due Date</th>
              <th className="p-4 font-semibold">Total Amount</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-muted">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-accent mb-2" />
                  <span className="text-xs">Loading real invoices from database...</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted">
                  No invoices found. Create your first invoice!
                </td>
              </tr>
            ) : (
              filtered.map((inv) => (
                <tr
                  key={inv.invoiceId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer text-fg"
                  onClick={() => setSelectedInvoice(inv)}
                >
                  <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{inv.invoiceNumber}</td>
                  <td className="p-4 text-slate-800 dark:text-slate-300 font-medium">{inv.clientName}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-accent-soft text-accent font-medium text-[11px] border border-accent/30">
                      <Briefcase className="w-3 h-3" />
                      {inv.projectName || 'General Service'}
                    </span>
                  </td>
                  <td className="p-4 text-muted">{inv.issueDate}</td>
                  <td className="p-4 text-muted">{inv.dueDate}</td>
                  <td className="p-4 font-bold text-fg">
                    ₹{inv.total.toLocaleString('en-IN')}
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={inv.status}
                      onChange={(e) => handleStatusChange(inv.invoiceId, e.target.value)}
                      className="bg-canvas border border-border text-xs text-slate-800 dark:text-slate-300 rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td className="p-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Download Professional Invoice PDF */}
                    <button
                      onClick={() => downloadInvoiceAsPDF(inv)}
                      className="p-1.5 hover:bg-accent-soft text-muted hover:text-accent dark:hover:text-accent rounded-lg transition-colors"
                      title="Download PDF Invoice"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    {/* Send Invoice to Client */}
                    {inv.status !== 'sent' && inv.status !== 'paid' && (
                      <button
                        onClick={() => handleSendInvoiceToClient(inv.invoiceId)}
                        className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-muted hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors"
                        title="Send Invoice to Client Portal"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}

                    {/* Delete Invoice */}
                    <button
                      onClick={() => handleDeleteInvoice(inv.invoiceId)}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-muted hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                      title="Delete Invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Create Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl p-6 space-y-4 border-border shadow-2xl relative max-h-[90vh] overflow-y-auto bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-bold text-fg text-sm">Create New Invoice</h3>
                <p className="text-xs text-muted">Link to a client project and dispatch to client portal</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* Project Selection Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-fg">
                  Select Project Created for Client
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-2.5 focus:outline-none focus:border-accent"
                >
                  <option value="">-- Custom / No Specific Project --</option>
                  {projects.map((p) => (
                    <option key={p.projectId || p.id} value={p.projectId || p.id}>
                      {p.name} ({p.clientName || 'Client Project'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Client Name"
                  placeholder="e.g. Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
                <Input
                  label="Client Email"
                  placeholder="e.g. billing@acme.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Due Date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-fg">Currency</label>
                  <input
                    type="text"
                    disabled
                    value="INR (₹)"
                    className="w-full bg-slate-100/50 dark:bg-slate-900 border border-border text-muted text-xs rounded-xl p-2.5"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-fg">Itemized Services</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={PlusCircle}
                    onClick={handleAddLineItem}
                  >
                    Add Item
                  </Button>
                </div>

                {lineItems.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Item Description"
                      value={item.description}
                      onChange={(e) => handleLineItemChange(index, 'description', e.target.value)}
                      className="flex-1 bg-canvas border border-border text-fg placeholder:text-muted text-xs rounded-xl p-2.5 focus:outline-none focus:border-accent transition-all"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                      className="w-16 bg-canvas border border-border text-fg placeholder:text-muted text-xs rounded-xl p-2.5 focus:outline-none focus:border-accent transition-all"
                    />
                    <input
                      type="number"
                      placeholder="Unit Price (₹)"
                      value={item.unitPrice}
                      onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value)}
                      className="w-28 bg-canvas border border-border text-fg placeholder:text-muted text-xs rounded-xl p-2.5 focus:outline-none focus:border-accent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLineItem(index)}
                      className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Calculations Summary */}
              <div className="p-4 rounded-xl bg-canvas border border-border space-y-1.5 text-xs text-right">
                <div className="flex justify-between text-muted">
                  <span>Subtotal:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-200">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center text-muted">
                  <span>Tax Rate (%):</span>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-16 bg-surface border border-border text-fg text-xs rounded px-2 py-0.5 text-right focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="flex justify-between text-fg font-bold text-sm pt-2 border-t border-border">
                  <span>Grand Total:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Generate & Save Invoice
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Professional Invoice Modal */}
      {selectedInvoice && (
        <ProfessionalInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSendClient={handleSendInvoiceToClient}
        />
      )}
    </div>
  )
}
