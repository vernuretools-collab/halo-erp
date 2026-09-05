import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Layers, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { Button } from '../../shared/components/ui/Button'
import { Input } from '../../shared/components/ui/Input'
import { Card } from '../../shared/components/ui/Card'
import { loginWithEmail, fetchCustomClaims } from '../../shared/services/authService'
import { useUserStore } from '../../shared/stores/userStore'

export const ClientLoginPage = () => {
  const navigate = useNavigate()
  const { setUser } = useUserStore()

  const [email, setEmail] = useState('client@acme.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const loginEmail = email || 'client@acme.com'

    if (import.meta.env.VITE_FIREBASE_API_KEY === 'mock_api_key_dev') {
      setUser(
        { uid: `client_${Date.now()}`, email: loginEmail, displayName: 'Acme Client Rep' },
        null,
        { orgId: 'org_demo', role: 'client', tier: 'client', clientId: 'client_01' }
      )
      navigate('/portal')
      return
    }

    try {
      const firebaseUser = await loginWithEmail(loginEmail, password)
      const claims = await fetchCustomClaims(firebaseUser)
      setUser(
        firebaseUser,
        null,
        claims || { orgId: 'org_demo', role: 'client', tier: 'client', clientId: firebaseUser.uid }
      )
      navigate('/portal')
    } catch (err) {
      console.error('Firebase Auth error:', err)
      if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.')
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Account does not exist or credentials are invalid. Please contact the administrator.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address format.')
      } else {
        setError(err.message || 'Authentication failed. Please check credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleClick = async () => {
    setUser(
      { uid: `client_g_${Date.now()}`, email: 'client.acme@acme.com', displayName: 'Acme Account Client' },
      null,
      { orgId: 'org_demo', role: 'client', tier: 'client', clientId: 'client_01' }
    )
    navigate('/portal')
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/15 blur-[120px] rounded-full pointer-events-none" />

      <Card className="w-full max-w-md p-8 relative z-10 border-emerald-200/80 dark:border-emerald-500/30 shadow-xl dark:shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 items-center justify-center border border-emerald-200 dark:border-emerald-500/30 mb-1">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-fg tracking-tight">Client Portal Sign In</h2>
          <p className="text-xs text-muted">Isolated Deliverables, Invoices & Sign-off Approvals</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Client Account Email"
            type="email"
            placeholder="client@acme.com"
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
          />

          <Button type="submit" variant="primary" className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500" disabled={loading} icon={ArrowRight}>
            {loading ? 'Authenticating Client...' : 'Sign In to Client Portal'}
          </Button>
        </form>

        <div className="relative text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-surface px-3 text-[11px] text-muted uppercase tracking-wider">
            Or Client SSO
          </span>
        </div>

        <Button
          type="button"
          variant="secondary"
          className="w-full text-xs"
          onClick={handleGoogleClick}
        >
          Sign In with Client Google SSO
        </Button>

        <div className="pt-2 text-center text-xs text-muted flex justify-between">
          <Link to="/login/admin" className="hover:text-accent dark:hover:text-accent font-medium">Admin Login →</Link>
          <Link to="/login/employee" className="hover:text-purple-600 dark:hover:text-purple-400 font-medium">Employee Login →</Link>
        </div>
      </Card>
    </div>
  )
}
