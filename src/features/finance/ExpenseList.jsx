import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { PageHeader } from '../../shared/components/layout/PageHeader'
import { Card } from '../../shared/components/ui/Card'
import { Badge } from '../../shared/components/ui/Badge'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { useFinanceStore } from './stores/financeStore'
import { FileText, CreditCard, Clock, Plus, Trash2, X } from 'lucide-react'

export const ExpenseList = () => {
  const { expenses, categories, addExpense, deleteExpense, addCategory, fetchFinanceData } = useFinanceStore()

  useEffect(() => {
    fetchFinanceData()
  }, [fetchFinanceData])

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState(null)
  const [vendor, setVendor] = useState('')
  const [category, setCategory] = useState('Software & Infrastructure')
  const [customCategory, setCustomCategory] = useState('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')

  const handleCreateExpense = async (e) => {
    e.preventDefault()
    if (!vendor.trim()) return

    const finalCategory = isCustomCategory ? customCategory.trim() : category
    if (!finalCategory) return

    if (isCustomCategory && customCategory.trim()) {
      await addCategory(customCategory.trim())
    }

    await addExpense({
      vendor: vendor.trim(),
      category: finalCategory,
      amount: Number(amount) || 0,
      notes,
    })

    setVendor('')
    setAmount('')
    setNotes('')
    setCustomCategory('')
    setIsCustomCategory(false)
    setCategory(finalCategory)
    setShowAddModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Expenses & Vendor Tracking"
          description="Track operational expenses, vendor invoices, software subscriptions, and outgoing cashflow"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Log Expense
            </Button>
          }
        />

        <div className="flex items-center gap-2 border-b border-border pb-3">
          <NavLink
            to="/finance/invoices"
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                isActive
                  ? 'bg-accent-soft text-accent border border-accent/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
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
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`
            }
          >
            <Clock className="w-3.5 h-3.5" /> Recurring Billing
          </NavLink>
        </div>
      </div>

      {/* Expenses Table */}
      <Card className="overflow-x-auto p-0 border-border">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-canvas/80 border-b border-border text-slate-700 dark:text-slate-400">
              <th className="p-4 font-semibold">Vendor</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold">Amount</th>
              <th className="p-4 font-semibold">Notes</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
            {expenses.map((exp) => (
              <tr key={exp.expenseId || exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="p-4 font-bold text-slate-900 dark:text-slate-200">{exp.vendor}</td>
                <td className="p-4 text-fg">{exp.category}</td>
                <td className="p-4 text-muted">{exp.date}</td>
                <td className="p-4 font-bold text-rose-600 dark:text-rose-400">₹{exp.amount?.toLocaleString('en-IN')}</td>
                <td className="p-4 text-muted max-w-xs truncate">{exp.notes || '—'}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setDeleteConfirmExpense(exp)}
                    className="p-1.5 hover:bg-rose-500/10 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Create Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Log Expense</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4">
              <Input
                label="Vendor / Payee *"
                placeholder="e.g. AWS Cloud Services"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                required
              />

              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-fg">Category</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCategory(!isCustomCategory)
                      setCustomCategory('')
                    }}
                    className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                  >
                    {isCustomCategory ? '← Select existing' : '+ Type custom category'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <Input
                    placeholder="e.g. Equipment & Hardware"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required
                  />
                ) : (
                  <select
                    value={category}
                    onChange={(e) => {
                      if (e.target.value === '__ADD_NEW__') {
                        setIsCustomCategory(true)
                        setCustomCategory('')
                      } else {
                        setCategory(e.target.value)
                      }
                    }}
                    className="w-full bg-canvas border border-border text-fg text-xs rounded-xl p-2.5 focus:outline-none cursor-pointer"
                  >
                    {(categories || []).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__ADD_NEW__">+ Type Custom Category...</option>
                  </select>
                )}
              </div>

              <Input
                label="Amount (₹) *"
                type="number"
                placeholder="e.g. 15000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />

              <Input
                label="Notes / Receipt Ref"
                placeholder="Reference number or description..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Save Expense
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Confirm Delete Expense Modal */}
      {deleteConfirmExpense && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" /> Confirm Delete Expense
              </h3>
              <button
                onClick={() => setDeleteConfirmExpense(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Are you sure you want to delete expense for <strong className="text-slate-900 dark:text-white">{deleteConfirmExpense.vendor}</strong> (₹{deleteConfirmExpense.amount?.toLocaleString('en-IN')})? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button variant="secondary" onClick={() => setDeleteConfirmExpense(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  deleteExpense(deleteConfirmExpense.expenseId || deleteConfirmExpense.id)
                  setDeleteConfirmExpense(null)
                }}
              >
                Yes, Delete Expense
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
