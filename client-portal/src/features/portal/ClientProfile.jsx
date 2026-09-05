import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { db, auth } from '../../shared/services/firebaseService'
import { updateDoc, doc, getDoc } from 'firebase/firestore'
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth'
import {
  User,
  Building,
  Mail,
  Phone,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Key
} from 'lucide-react'

export const ClientProfile = () => {
  const { user, userDoc, setUser } = useUserStore()

  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return
      setEmail(user.email || '')

      // Load Firestore user doc if not in store
      let currentDoc = userDoc
      if (!currentDoc) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid))
          if (snap.exists()) {
            currentDoc = snap.data()
            setUser(user, currentDoc, null)
          }
        } catch (err) {
          console.warn('Failed to fetch user doc:', err)
        }
      }

      if (currentDoc) {
        setDisplayName(currentDoc.displayName || '')
        setCompanyName(currentDoc.companyName || currentDoc.organization || '')
        setPhoneNumber(currentDoc.phoneNumber || '')
      } else {
        setDisplayName(user.displayName || '')
        setCompanyName(user.companyName || user.organization || '')
      }
    }
    loadProfile()
  }, [user, userDoc, setUser])


  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const userRef = doc(db, 'users', user.uid)
      const updatedFields = {
        displayName,
        phoneNumber,
        updatedAt: new Date().toISOString(),
      }

      if (import.meta.env.VITE_FIREBASE_API_KEY !== 'mock_api_key_dev') {
        await updateDoc(userRef, updatedFields)
      }

      // Update Zustand store
      const newDoc = { ...userDoc, ...updatedFields, companyName }
      setUser(user, newDoc, null)

      setSuccess('Profile updated successfully!')
    } catch (err) {
      console.error(err)
      setError('Failed to update profile details.')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    if (!newPassword.trim()) return

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setPasswordSaving(true)
    setError('')
    setSuccess('')

    try {
      if (import.meta.env.VITE_FIREBASE_API_KEY !== 'mock_api_key_dev') {
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword)
          setSuccess('Password updated successfully!')
        } else {
          throw new Error('No authenticated Firebase user found.')
        }
      } else {
        setSuccess('[Mock Mode] Password updated successfully!')
      }
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, this operation requires a recent login. Please sign out and sign back in to change password.')
      } else {
        setError(err.message || 'Failed to update password.')
      }
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSendResetEmail = async () => {
    setError('')
    setSuccess('')
    try {
      if (import.meta.env.VITE_FIREBASE_API_KEY !== 'mock_api_key_dev') {
        await sendPasswordResetEmail(auth, email)
        setSuccess(`A password reset link has been emailed to ${email}`)
      } else {
        setSuccess(`[Mock Mode] Simulated password reset link sent to ${email}`)
      }
    } catch (err) {
      console.error(err)
      setError('Failed to send password reset email.')
    }
  }

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="My Client Profile"
        description="Manage your contact details, view company billing links, and configure credentials"
      />

      {error && (
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Card: Account Card info */}
        <div className="md:col-span-1 space-y-6">
          <Card className="p-6 text-center space-y-4 border-slate-200 dark:border-emerald-900/40">
            <div className="w-20 h-20 rounded-2xl bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-bold text-3xl flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30 mx-auto">
              {displayName?.charAt(0) || 'C'}
            </div>
            <div>
              <h3 className="font-bold text-fg">{displayName || 'Client Representative'}</h3>
              <p className="text-xs text-muted flex items-center justify-center gap-1 mt-1">
                <Building className="w-3.5 h-3.5" /> {companyName || 'Acme Corp'}
              </p>
            </div>
            <div className="pt-2">
              <Badge variant="success">Client Workspace</Badge>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-emerald-950/60 text-left text-xs text-muted space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="truncate">{email}</span>
              </div>
              {phoneNumber && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span>{phoneNumber}</span>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 border-slate-200 dark:border-emerald-900/40 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-4 h-4" /> Alternative Reset
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              If you prefer to change your password using a verified email link, click the button below.
            </p>
            <button
              onClick={handleSendResetEmail}
              className="w-full text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              Email Me Password Reset Link
            </button>
          </Card>
        </div>

        {/* Right side: Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <Card className="p-6 border-slate-200 dark:border-emerald-900/40 space-y-4">
            <h3 className="font-bold text-fg text-sm">Personal Details</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Full Name"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  icon={User}
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Company Name (Read-Only)</label>
                  <div className="flex items-center gap-2 bg-chrome border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Building className="w-4 h-4" />
                    <span>{companyName}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  placeholder=" "
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  icon={Phone}
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Login Email (Read-Only)</label>
                  <div className="flex items-center gap-2 bg-chrome border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Mail className="w-4 h-4" />
                    <span>{email}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 px-6 cursor-pointer"
                  icon={Save}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Profile Details'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Change Password Card */}
          <Card className="p-6 border-slate-200 dark:border-emerald-900/40 space-y-4">
            <h3 className="font-bold text-fg text-sm">Security & Password</h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  icon={Lock}
                  required
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  icon={Lock}
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-500 px-6 cursor-pointer"
                  icon={Save}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating...' : 'Change Password'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
