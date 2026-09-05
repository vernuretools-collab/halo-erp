import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight, AlertCircle, Sun, Moon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { useUserStore } from '../../stores/userStore'
import { useUIStore } from '../../stores/uiStore'
import haloLogo from '../../assets/halologo.png'
import { loginWithEmail, signupWithEmail, fetchCustomClaims } from '../../shared/services/authService'
import {
  getClientOnboardingDoc,
  normalizeOnboardingStatus,
  ONBOARDING_STATUS,
} from '../../shared/services/onboardingService'

export const ClientLoginPage = () => {
  const navigate = useNavigate()
  const { setUser } = useUserStore()
  const { theme, toggleTheme } = useUIStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRealLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter work email and password.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const firebaseUser = await loginWithEmail(email, password)
      const claims = await fetchCustomClaims(firebaseUser)
      const onboardingDoc = await getClientOnboardingDoc(firebaseUser.uid)

      const onboardingStatus = normalizeOnboardingStatus(onboardingDoc?.onboardingStatus)
      const skipAgreements = Boolean(onboardingDoc?.skipAgreements)
      const portalUnlocked = skipAgreements || onboardingStatus === ONBOARDING_STATUS.APPROVED

      const userDocData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        companyName: onboardingDoc?.companyName || '',
        ...onboardingDoc,
        onboardingStatus: portalUnlocked ? ONBOARDING_STATUS.APPROVED : onboardingStatus,
        skipAgreements,
      }

      setUser(
        firebaseUser,
        userDocData,
        { orgId: 'org_real', role: 'client', tier: 'client', ...claims }
      )

      if (portalUnlocked) {
        try {
          localStorage.setItem(`onboarding_status_${firebaseUser.uid}`, ONBOARDING_STATUS.APPROVED)
        } catch {
          // ignore
        }
        navigate('/portal')
      } else {
        navigate('/onboarding')
      }
    } catch (err) {
      console.error('Client Auth error:', err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password. Please try again.')
      } else if (err.code === 'auth/user-not-found') {
        setError('No client account found with this email.')
      } else {
        setError(err.message || 'Authentication failed.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-xl bg-surface hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-amber-400 flex items-center justify-center transition-all cursor-pointer border border-border shadow-sm"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 transition-transform duration-300 -rotate-12 hover:rotate-0" />
          )}
        </button>
      </div>

      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/15 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md p-8 relative z-10 border-emerald-200/80 dark:border-emerald-500/30 shadow-xl dark:shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-20 h-20 rounded-full bg-white p-2 items-center justify-center border border-slate-200 dark:border-white/30 shadow-md mb-2">
            <img src={haloLogo} alt="The Halo Effect Consulting" className="w-full h-full object-contain rounded-full" />
          </div>
          <h2 className="text-2xl font-bold text-fg tracking-tight">Client Portal Sign In</h2>
          <p className="text-xs text-muted">Isolated Deliverables, Invoices & Sign-off Workspace</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRealLogin} className="space-y-4">
          <Input
            label="Client Account Email"
            type="email"
            placeholder="client@company.com"
            icon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            icon={Lock}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500" disabled={loading} icon={ArrowRight}>
            {loading ? 'Authenticating Client...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

