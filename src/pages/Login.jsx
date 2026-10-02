import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useApp } from '../context/AppContext.jsx'
import { Button, Input } from '../components/ui/Primitives.jsx'
import logo from '../assests/logo/logox.png'

export default function Login() {
  const { isAuthenticated, login, error } = useAuth()
  const { businessProfile } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (isAuthenticated) {
    const dest = location.state?.from?.pathname || '/dashboard'
    return <Navigate to={dest} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    const ok = await login(email, password)
    setSubmitting(false)
    if (ok) navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-paper">
      {/* Brand panel */}
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 14px)',
        }} />
        <div className="relative flex items-start">
          <img src={logo} alt="Logo" className="h-14 w-auto" />
        </div>

        <div className="relative">
          <p className="font-display text-3xl font-semibold leading-snug">
            Every stitch,<br />every rental,<br />one ledger.
          </p>
          <p className="mt-4 max-w-sm text-sm text-white/60">
            Manage inventory, rentals, customers and accounts for your tailoring business — all in one place, built for how your shop actually runs.
          </p>
        </div>

        <p className="relative text-xs text-white/40">{businessProfile.address}</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-start lg:hidden">
            <img src={logo} alt="Logo" className="h-12 w-auto" />
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink">Sign in to your workspace</h1>
          <p className="mt-1 text-sm text-muted">Enter your ERP credentials to continue.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Email</label>
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@sanjayatailors.lk"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-burgundy-light/40 bg-burgundy-50 px-3 py-2 text-xs text-burgundy">
                {error}
              </p>
            )}

            <Button type="submit" variant="brass" size="lg" className="w-full" disabled={submitting} icon={ArrowRight}>
              {submitting ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}
