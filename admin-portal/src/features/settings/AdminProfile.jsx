import React, { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { useOrgStore } from '../../stores/orgStore'
import { db, auth } from '../../shared/services/firebaseService'
import { updateDoc, doc, getDoc } from 'firebase/firestore'
import { updatePassword, sendPasswordResetEmail, updateProfile } from 'firebase/auth'
import {
  User,
  Building,
  Mail,
  Phone,
  Lock,
  Save,
  CheckCircle,
  AlertCircle,
  Key,
  Shield
} from 'lucide-react'

export const AdminProfile = () => {
  const { user, userDoc, setUser, updateDisplayName } = useUserStore()
  const { org } = useOrgStore()

  const [displayName, setDisplayName] = useState('')
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
        setPhoneNumber(currentDoc.phoneNumber || '')
      } else {
        setDisplayName(user.displayName || '')
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
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName })
        }
        await updateDoc(userRef, updatedFields)
      }

      // Patch only displayName in the store — preserves claims and session
      updateDisplayName(displayName)

      setSuccess('Admin profile updated successfully!')
    } catch (err) {
      console.error(err)
      setError('Failed to update admin profile details.')
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
          setSuccess('Admin password updated successfully!')
        } else {
          throw new Error('No authenticated Firebase user found.')
        }
      } else {
        setSuccess('[Mock Mode] Admin password updated successfully!')
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
        title="Admin Settings & Profile"
        description="Manage your system settings, administrative credentials, and details"
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
        {/* Left Side: Summary Card */}
        <div className="md:col-span-1 space-y-6">
          <Card className="p-6 text-center space-y-4 border-border">
            <div className="w-20 h-20 rounded-2xl bg-accent-soft text-accent font-bold text-3xl flex items-center justify-center border border-accent/30 mx-auto">
              {displayName?.charAt(0) || 'A'}
            </div>
            <div>
              <h3 className="font-bold text-fg">{displayName || 'Administrator'}</h3>
              <p className="text-xs text-muted flex items-center justify-center gap-1 mt-1">
                <Building className="w-3.5 h-3.5" /> {org?.name || 'Business OS Workspace'}
              </p>
            </div>
            <div className="pt-1 flex flex-wrap gap-1.5 justify-center">
              <Badge variant="brand" className="text-[10px]">System Administrator</Badge>
              <Badge variant="neutral" className="text-[10px]">Owner</Badge>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-border text-left text-xs text-muted space-y-2.5">
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
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-400" />
                <span>Full System Operations Access</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 border-border space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-4 h-4" /> Reset Option
            </h4>
            <p className="text-[11px] text-muted dark:text-slate-455 leading-relaxed">
              Generate an administrative link to update credentials via email verification.
            </p>
            <button
              onClick={handleSendResetEmail}
              className="w-full text-center text-xs text-accent font-bold hover:underline cursor-pointer"
            >
              Email Me Password Reset Link
            </button>
          </Card>
        </div>

        {/* Right Side: Account details and password form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 border-border space-y-4">
            <h3 className="font-bold text-fg text-sm">Personal System Details</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Administrator Name"
                  placeholder="e.g. Sarah Jenkins"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  icon={User}
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Organization/Workspace</label>
                  <div className="flex items-center gap-2 bg-canvas border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Building className="w-4 h-4" />
                    <span>{org?.name || 'Business OS Workspace'}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Phone"
                  placeholder=" "
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  icon={Phone}
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Primary Email</label>
                  <div className="flex items-center gap-2 bg-canvas border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Mail className="w-4 h-4" />
                    <span>{email}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-accent hover:bg-accent-hover px-6 cursor-pointer"
                  icon={Save}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Profile Details'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-6 border-border space-y-4">
            <h3 className="font-bold text-fg text-sm">Security & Password</h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="New Admin Password"
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
                  className="bg-accent hover:bg-accent-hover px-6 cursor-pointer"
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
