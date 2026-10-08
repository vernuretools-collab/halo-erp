import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { useUserStore } from '../../stores/userStore'
import haloLogo from '../../assets/halologo.png'
import { loginWithEmail, logoutUser, fetchCustomClaims } from '../../shared/services/authService'
import { supabase } from '../../shared/services/firebaseService'
import {
  isJoiningAccount,
  isValidJoiningUsername,
  joiningUsernameToAuthEmail,
  normalizeJoiningUsername,
} from '../../../../shared/supabase/employeeOnboarding.js'

export const JoiningLoginPage = () => {
  const navigate = useNavigate()
  const { setUser } = useUserStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase?.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const sessionUser = data.session?.user
      if (isJoiningAccount({ role: sessionUser?.app_metadata?.role, email: sessionUser?.email })) navigate('/joining/form')
    })
    return () => {
      cancelled = true
    }
  }, [navigate])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const login = normalizeJoiningUsername(username)
    if (!isValidJoiningUsername(login) || !password) {
      setError('Enter the username and password from your joining details.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const user = await loginWithEmail(joiningUsernameToAuthEmail(login), password)
      const claims = await fetchCustomClaims(user, true)
      if (!isJoiningAccount({ role: claims?.role, email: user?.email })) {
        await logoutUser()
        setError('This login is for the employee portal. Use the employee sign-in page.')
        return
      }
      setUser(user, { displayName: user.displayName, username: login, role: 'employee_onboarding' }, claims)
      navigate('/joining/form')
    } catch (err) {
      const message = String(err.message || '')
      if (/invalid|credential|password/i.test(message)) {
        setError('This joining login is not active yet. In admin, click Save & create joining login and wait for “Joining login ready”, then use that exact username and password here.')
      } else {
        setError(message || 'Could not sign in.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 text-fg">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-20 h-20 rounded-full bg-white p-2 items-center justify-center border border-slate-200 shadow-sm mb-2">
            <img src={haloLogo} alt="The Halo Effect Consulting" className="w-full h-full object-contain rounded-full" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Employee joining</h2>
          <p className="text-xs text-muted">This login is only for your onboarding form. It does not open the employee portal.</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Username" icon={User} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          <Input label="Password" type="password" icon={Lock} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <Button type="submit" className="w-full" disabled={loading} icon={ArrowRight}>
            {loading ? 'Signing in…' : 'Continue'}
          </Button>
        </form>

        <p className="text-xs text-muted text-center">
          Already an employee? <Link to="/login" className="text-accent font-medium">Employee sign in</Link>
        </p>
      </Card>
    </div>
  )
}
