import React, { useState, useEffect, useRef } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useUserStore } from '../../stores/userStore'
import { db, auth } from '../../shared/services/firebaseService'
import { setDoc, doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
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
  Briefcase,
  Layers,
  Award,
  Sparkles,
} from 'lucide-react'

export const EmployeeProfile = () => {
  const { user, userDoc, claims, setUser } = useUserStore()

  const [displayName, setDisplayName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [roleName, setRoleName] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [skills, setSkills] = useState([])
  const [quote, setQuote] = useState('')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const hydratedUidRef = useRef(null)

  useEffect(() => {
    if (!user?.uid) {
      hydratedUidRef.current = null
      return
    }
    if (hydratedUidRef.current === user.uid) return

    const applyDoc = (currentDoc) => {
      hydratedUidRef.current = user.uid
      setEmail(user.email || '')
      const storedQuote = localStorage.getItem(`crm_quote_${user.uid}`) || ''
      if (currentDoc) {
        setDisplayName(currentDoc.displayName || user?.displayName || '')
        setPhoneNumber(currentDoc.phoneNumber || '')
        setRoleName(currentDoc.roleName || currentDoc.role || 'Team Member')
        setDepartmentName(currentDoc.departmentName || currentDoc.department || 'Delivery & Operations')
        setSkills(currentDoc.skills || ['Productivity'])
        setQuote((Date.parse(currentDoc.quoteUpdatedAt || '') || 0) > 0
          ? (currentDoc.quote || currentDoc.proverb || storedQuote)
          : (storedQuote || currentDoc.quote || currentDoc.proverb || ''))
      } else {
        setDisplayName(user?.displayName || '')
        setRoleName('Software Specialist')
        setDepartmentName('Engineering & Product')
        setSkills(['React', 'Productivity'])
        setQuote(storedQuote)
      }
    }

    if (userDoc) {
      applyDoc(userDoc)
      return
    }

    let cancelled = false
    getDoc(doc(db, 'users', user.uid))
      .then((snap) => {
        if (cancelled || hydratedUidRef.current === user.uid) return
        if (snap.exists()) {
          const currentDoc = snap.data()
          setUser(user, currentDoc, claims)
          applyDoc(currentDoc)
        } else {
          applyDoc(null)
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch user doc:', err)
        if (!cancelled) applyDoc(null)
      })

    return () => {
      cancelled = true
    }
  }, [user, userDoc, claims, setUser])

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const trimmedName = displayName.trim()
      const trimmedQuote = quote.trim()
      const quoteUpdatedAt = new Date().toISOString()
      const updatedFields = {
        displayName: trimmedName,
        phoneNumber: phoneNumber.trim(),
        quote: trimmedQuote,
        proverb: trimmedQuote,
        quoteUpdatedAt,
        updatedAt: quoteUpdatedAt,
      }

      if (user?.uid) {
        localStorage.setItem(`crm_quote_${user.uid}`, trimmedQuote)
      }

      if (import.meta.env.VITE_FIREBASE_API_KEY !== 'mock_api_key_dev') {
        await setDoc(doc(db, 'users', user.uid), updatedFields, { merge: true })
        const quoteFields = { quote: trimmedQuote, proverb: trimmedQuote, quoteUpdatedAt, updatedAt: quoteUpdatedAt }
        const empRef = doc(db, 'employees', user.uid)
        const empSnap = await getDoc(empRef)
        if (empSnap.exists()) {
          await setDoc(empRef, quoteFields, { merge: true })
        } else if (user.email) {
          const empQuery = query(collection(db, 'employees'), where('email', '==', user.email), limit(1))
          const empByEmail = await getDocs(empQuery)
          if (!empByEmail.empty) {
            await setDoc(empByEmail.docs[0].ref, quoteFields, { merge: true })
          }
        }
        if (auth.currentUser) {
          try {
            await updateProfile(auth.currentUser, { displayName: trimmedName })
          } catch (pErr) {
            console.warn('Firebase auth updateProfile warning:', pErr)
          }
        }
      }

      // Update store — propagate displayName and quote to userDoc
      const newDoc = { ...userDoc, ...updatedFields }
      const updatedUser = { ...(user || {}), displayName: trimmedName }
      setUser(updatedUser, newDoc, claims)

      setSuccess('Profile details updated successfully!')
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
        title="My Employee Profile"
        description="Manage your  EMPLOYEEcontact info, view roles, skills, and secure your credentials"
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
            <div className="w-20 h-20 rounded-2xl bg-accent-soft text-accent font-bold text-3xl flex items-center justify-center border border-accent/20 dark:border-accent/30 mx-auto">
              {displayName?.charAt(0) || 'E'}
            </div>
            <div>
              <h3 className="font-bold text-fg">{displayName || 'Employee Representative'}</h3>
              <p className="text-xs text-muted flex items-center justify-center gap-1 mt-1 font-medium">
                <Briefcase className="w-3.5 h-3.5" /> {roleName}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1 mt-0.5">
                <Layers className="w-3.5 h-3.5" /> {departmentName}
              </p>
            </div>
            <div className="pt-2">
              <Badge variant="brand">Employee Workspace</Badge>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left text-xs text-slate-655 dark:text-slate-400 space-y-2">
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

            {/* Skills display */}
            {skills.length > 0 && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-left">
                <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1">
                  <Award className="w-3 h-3" /> Core Skills
                </span>
                <div className="flex flex-wrap gap-1">
                  {skills.map((s, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-chrome text-muted text-[10px] font-semibold rounded-lg">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card className="p-6 border-border space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key className="w-4 h-4" /> Alternate Reset
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-455 leading-relaxed">
              Click below to send a secure password reset link to your registered corporate email.
            </p>
            <button
              onClick={handleSendResetEmail}
              className="w-full text-center text-xs text-accent font-bold hover:underline cursor-pointer"
            >
              Email Me Password Reset Link
            </button>
          </Card>
        </div>

        {/* Right Side: Profile Details & Credentials forms */}
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 border-border space-y-4">
            <h3 className="font-bold text-fg text-sm">Personal Details</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Full Name"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  icon={User}
                  required
                />
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">Corporate Role</label>
                  <div className="flex items-center gap-2 bg-chrome border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Briefcase className="w-4 h-4" />
                    <span>{roleName} ({departmentName})</span>
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
                  <label className="block text-xs font-medium text-muted mb-1.5">Corporate Email</label>
                  <div className="flex items-center gap-2 bg-chrome border border-border text-muted text-xs rounded-xl py-2.5 px-3.5">
                    <Mail className="w-4 h-4" />
                    <span>{email}</span>
                  </div>
                </div>
              </div>

              <Input
                label="Daily Proverb / Quote / Personal Motto"
                placeholder="e.g. Small daily gains compound over time..."
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                icon={Sparkles}
              />

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
