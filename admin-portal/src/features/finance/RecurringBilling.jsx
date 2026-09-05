import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../shared/services/firebaseService'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useFinanceStore } from './stores/financeStore'
import { FileText, CreditCard, Clock, Plus, RefreshCw, X, Trash2, Loader2 } from 'lucide-react'

const defaultClients = [
  { id: 'cli_acme', name: 'Acme Corp' },
  { id: 'cli_techcorp', name: 'TechCorp Global' },
  { id: 'cli_nexus', name: 'Nexus Systems' },
]

export const RecurringBilling = () => {
  const { retainers, addRetainer, updateRetainer, deleteRetainer, fetchFinanceData, isLoading } = useFinanceStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteConfirmRetainer, setDeleteConfirmRetainer] = useState(null)

  // Form State
  const [client, setClient] = useState('')
  const [profile, setProfile] = useState('')
  const [interval, setInterval] = useState('Monthly (1st)')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState('Active')

  // Real Clients state
  const [clients, setClients] = useState(defaultClients)

  useEffect(() => {
    fetchFinanceData()
  }, [fetchFinanceData])

  useEffect(() => {
    if (!showAddModal) return
    const fetchClients = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'client'))
        const snap = await getDocs(q)
        const clientList = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().companyName || d.data().displayName || d.data().name || 'Client',
        }))
        if (clientList.length > 0) {
          setClients(clientList)
          setClient(clientList[0].name)
        } else {
          setClients(defaultClients)
          setClient(defaultClients[0].name)
        }
      } catch (err) {
        console.error('Error fetching clients for retainers:', err)
        setClients(defaultClients)
        setClient(defaultClients[0].name)
      }
    }
    fetchClients()
  }, [showAddModal])

  const handleCreateRetainer = async (e) => {
    e.preventDefault()
    if (!client.trim() || !profile.trim()) return

    const numAmount = Number(amount) || 0
    const formattedAmount = `₹${numAmount.toLocaleString('en-IN')}`

    await addRetainer({
      client: client.trim(),
      profile: profile.trim(),
      interval,
      amount: formattedAmount,
      rawAmount: numAmount,
      status,
    })

    setProfile('')
    setAmount('')
    setShowAddModal(false)
  }

  const handleToggleStatus = async (ret) => {
    const rId = ret.retainerId || ret.id
    const nextStatus = ret.status === 'Active' ? 'Paused' : 'Active'
    await updateRetainer(rId, { status: nextStatus })
  }

  const handleDeleteRetainer = async (ret) => {
    const rId = ret.retainerId || ret.id
    await deleteRetainer(rId)
    setDeleteConfirmRetainer(null)
  }

  return (
    <div className="space-y-6">
      {/* Header & Sub Nav */}
      <div className="space-y-4">
        <PageHeader
          title="Recurring Billing & Retainers"
          description="Automate periodic client retainers, subscription profiles, and scheduled invoice generation"
          actions={
            <Button icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
              Add Retainer Profile
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

      {/* Retainers List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-xs text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2 text-accent" /> Loading retainer profiles...
        </div>
      ) : retainers.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-border space-y-3">
          <RefreshCw className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto" />
          <h4 className="font-bold text-fg text-sm">No Retainer Profiles Found</h4>
          <p className="text-xs text-muted max-w-sm mx-auto">
            You have not configured any recurring client retainers or billing schedules yet.
          </p>
          <Button size="sm" icon={Plus} variant="primary" onClick={() => setShowAddModal(true)}>
            Add Retainer Profile
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {retainers.map((ret, i) => {
            const rId = ret.retainerId || ret.id || i
            return (
              <Card key={rId} hover className="space-y-3 border-border relative group">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-fg text-sm">{ret.client}</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(ret)}
                      title="Click to toggle Active / Paused"
                      className="cursor-pointer"
                    >
                      <Badge variant={ret.status === 'Active' ? 'success' : 'warning'}>{ret.status}</Badge>
                    </button>
                    <button
                      onClick={() => setDeleteConfirmRetainer(ret)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-accent font-medium">{ret.profile}</p>
                <div className="flex justify-between items-center text-xs text-muted pt-2 border-t border-border">
                  <span className="flex items-center gap-1 text-muted">
                    <RefreshCw className="w-3 h-3 text-accent" /> {ret.interval}
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{ret.amount}</span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Retainer Profile Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg p-6 space-y-4 border-border shadow-2xl relative bg-surface">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-fg text-sm">Add Retainer Profile</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRetainer} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Client Name</label>
                {clients.length > 0 ? (
                  <select
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="e.g. Acme Corp"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    required
                  />
                )}
              </div>

              <Input
                label="Profile / Package Title"
                placeholder="e.g. Monthly Retainer - Full Service"
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-fg">Billing Interval</label>
                  <select
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-Weekly">Bi-Weekly</option>
                    <option value="Monthly (1st)">Monthly (1st)</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annually">Annually</option>
                  </select>
                </div>

                <Input
                  label="Recurring Amount (₹ INR)"
                  type="number"
                  placeholder="10000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-fg">Initial Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-canvas border border-border text-fg text-sm rounded-xl py-2.5 px-3.5 focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)} className="w-1/3">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="w-2/3" icon={Plus}>
                  Save Retainer Profile
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmRetainer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4 border-border shadow-2xl relative bg-surface text-center">
            <h4 className="font-bold text-fg text-sm">Delete Retainer Profile?</h4>
            <p className="text-xs text-muted">
              Are you sure you want to delete <strong className="text-accent">{deleteConfirmRetainer.profile}</strong> for {deleteConfirmRetainer.client}?
            </p>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => setDeleteConfirmRetainer(null)} className="w-1/2">
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDeleteRetainer(deleteConfirmRetainer)}
                className="w-1/2"
                icon={Trash2}
              >
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
