import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff, Utensils, ShoppingCart, Package, MapPin, User, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { resolvePostLoginTarget } from '@/utils/safe-redirect'
import { mapAuthError } from '@/utils/auth-errors'
import { appConfig } from '@/config/app.config'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'

// ─── SERVICE DATA ────────────────────────────────────────────────────────────
const SERVICES = [
  {
    icon: Utensils,
    title: 'Food Delivery',
    desc: 'Your favorite meals, delivered to your doorstep.',
  },
  {
    icon: ShoppingCart,
    title: 'Grocery Delivery',
    desc: 'Fresh groceries and essentials delivered fast.',
  },
  {
    icon: Package,
    title: 'Courier Dispatch',
    desc: 'Send and receive parcels quickly and reliably.',
  },
]

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
export default function LoginPage() {
  // ── All existing state & hooks — UNTOUCHED ──────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const errorRef = useRef<HTMLDivElement>(null)
  const { session, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Already-authenticated redirect (P4)
  useEffect(() => {
    if (session) {
      if (!session.user?.email_confirmed_at) {
        navigate('/auth/verify-email', { replace: true })
        return
      }
      if (profile?.is_active) {
        const redirectParam = new URLSearchParams(location.search).get('redirect')
        navigate(resolvePostLoginTarget(redirectParam, profile), { replace: true })
      }
    }
  }, [session, profile, location.search, navigate])

  // Handle redirect params: inactive account and OAuth cancel/error
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const errorParam = params.get('error')
    const oauthParam = params.get('oauth')
    if (errorParam === 'inactive') {
      setError('Your account is inactive. Please contact support.')
    } else if (oauthParam === 'cancelled') {
      setError('Google sign-in was cancelled. You can try again or use your email and password.')
    } else if (oauthParam === 'error') {
      setError('Something went wrong with Google sign-in. Please try again or use your email and password.')
    }
  }, [location.search])

  // Move focus to error alert for accessibility (P15)
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus()
    }
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) {
      errors.email = 'Email is required'
    }
    if (!password) {
      errors.password = 'Password is required'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(mapAuthError(signInError, 'Sign in'))
        return
      }

      if (signInData?.session && !signInData.session.user?.email_confirmed_at) {
        navigate('/auth/verify-email', { replace: true })
        return
      }
      // On success with confirmed email: onAuthStateChange emits SIGNED_IN -> AuthStore fetches profile -> redirect effect runs
    } catch (err) {
      setError(mapAuthError(err, 'Sign in'))
    } finally {
      setIsLoading(false)
    }
  }
  // ── End frozen logic ────────────────────────────────────────────────────────

  return (
    <div className="relative w-full min-h-svh overflow-hidden" style={{ maxHeight: '100svh' }}>
      {/* ── Background — fixed to viewport ────────────────────────────────── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/kingdomDash-realLogin.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
        }}
        aria-hidden="true"
      />
      {/* ── Cinematic overlays ─────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to right, rgba(8,6,7,0.82) 0%, rgba(8,6,7,0.55) 38%, rgba(8,6,7,0.18) 62%, rgba(8,6,7,0.05) 100%)',
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-1/2 h-64 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 0% 100%, rgba(229,9,20,0.22) 0%, transparent 70%)',
        }}
      />

      {/* ── Page grid ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-svh w-full">

        {/* ════════════════════════════════════════════════════════════════════
            LEFT — KingdomDash brand experience (hidden on mobile)
        ════════════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col justify-between w-[52%] px-10 xl:px-14 py-8">

          {/* Brand lockup */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img
              src="/KingdomDash-emblem-clean.png"
              alt="KingdomDash logo"
              className="h-9 w-auto rounded-sm object-contain"
            />
            <div className="leading-none">
              <span className="text-white text-h4 font-bold tracking-tight">KINGDOM</span>
              <span className="text-[#E50914] text-h4 font-bold tracking-tight">DASH</span>
              <p className="text-white/50 text-eyebrow mt-0.5">SWIFT IN MOTION.</p>
            </div>
          </div>

          {/* Hero message */}
          <div className="flex flex-col justify-end flex-1 pb-2">
            <h1
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: 'clamp(2.2rem,3.8vw,3.6rem)' }}
            >
              <span className="text-white block">Delivering what</span>
              <span className="text-white block">
                matters{' '}
                <span className="text-[#E50914]">most</span>
                <span className="text-white">.</span>
              </span>
            </h1>

            <p className="mt-3 text-white/70 text-body-small max-w-xs leading-relaxed">
              Food. Groceries. Courier. All delivered fast,
              safe and reliable across Ijebu-Ode and beyond.
            </p>

            {/* Service highlights */}
            <div className="mt-5 space-y-2">
              {SERVICES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg h-8 w-8"
                    style={{ background: 'rgba(229,9,20,0.18)', border: '1px solid rgba(229,9,20,0.3)' }}
                  >
                    <Icon className="h-3.5 w-3.5 text-[#E50914]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-label font-semibold leading-tight truncate">{title}</p>
                    <p className="text-white/55 text-caption leading-snug truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Location badge */}
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 self-start"
              style={{
                background: 'rgba(10,10,10,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-[#E50914] flex-shrink-0" aria-hidden="true" />
              <span className="text-caption text-white/80">
                Proudly serving{' '}
                <span className="text-[#E50914] font-semibold">Ijebu-Ode, Ogun State</span>
              </span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            RIGHT — White login card
            overflow-y-auto on column: card content scrolls internally if
            viewport is very short; outer page never scrolls.
        ════════════════════════════════════════════════════════════════════ */}
        <main className="flex flex-1 items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-8 xl:px-12 py-6 overflow-y-auto">

          {/* Card */}
          <div
            className="w-full bg-white my-auto"
            style={{
              maxWidth: '520px',
              borderRadius: '28px',
              padding: 'clamp(1.5rem,3vw,2.25rem)',
              boxShadow:
                '0 4px 6px rgba(0,0,0,0.04), 0 10px 20px rgba(0,0,0,0.08), 0 30px 60px rgba(0,0,0,0.18)',
            }}
          >

            {/* Mobile brand (visible only on small screens) */}
            <div className="flex items-center gap-2 mb-5 lg:hidden">
              <img src="/KingdomDash-emblem-clean.png" alt="KingdomDash" className="h-7 w-auto rounded-sm object-contain" />
              <div className="leading-none">
                <span className="text-[#111111] text-label font-bold tracking-tight">KINGDOM</span>
                <span className="text-[#E50914] text-label font-bold tracking-tight">DASH</span>
              </div>
            </div>

            {/* Auth icon */}
            <div
              className="inline-flex items-center justify-center rounded-2xl mb-5"
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(229,9,20,0.08)',
                border: '1px solid rgba(229,9,20,0.15)',
              }}
              aria-hidden="true"
            >
              <User className="h-5 w-5 text-[#E50914]" />
            </div>

            {/* Heading */}
            <h2
              className="font-bold leading-none tracking-tight text-[#111111]"
              style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
            >
              Welcome{' '}
              <span className="text-[#E50914]">back.</span>
            </h2>
            <p className="mt-2 text-body-small text-[#6b7280]">
              Sign in to continue your KingdomDash experience.
            </p>

            {/* ── Error alert & Inactive Account Notice ─────────────────────────────── */}
            {new URLSearchParams(location.search).get('error') === 'inactive' ? (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="mt-5 p-4 sm:p-5 rounded-2xl border border-rose-200 bg-rose-50/90 text-rose-900 space-y-3 focus:outline-none animate-fadeIn"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-rose-950">Account Deactivated or Suspended</h3>
                    <p className="text-[11px] text-rose-800">Your account is currently inactive.</p>
                  </div>
                </div>
                <p className="text-xs text-rose-900 leading-relaxed">
                  Access to ordering and protected dashboard features is currently restricted. If you believe this is in error, please contact our support desk to review your account status.
                </p>
                <div className="pt-1 flex flex-col sm:flex-row gap-2">
                  <Link
                    to="/support?reason=account_inactive"
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-colors shadow-xs"
                  >
                    Contact Support Team
                  </Link>
                  <a
                    href={`tel:${appConfig.support.phoneRaw}`}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-semibold text-text-primary bg-white hover:bg-light-surface border border-border transition-colors shadow-xs"
                  >
                    Call {appConfig.support.phoneDisplay}
                  </a>
                </div>
              </div>
            ) : error ? (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="mt-4 rounded-xl px-4 py-3 text-body-small focus:outline-none"
                style={{
                  background: 'rgba(229,9,20,0.06)',
                  border: '1px solid rgba(229,9,20,0.25)',
                  color: '#b91c1c',
                }}
              >
                {error}
              </div>
            ) : null}

            {/* ── Form — existing logic preserved, presentation updated ────────── */}
            <form
              noValidate
              onSubmit={handleSubmit}
              aria-label="Sign in to your account"
              className="mt-5 space-y-4"
            >

              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-label font-semibold text-[#111111] mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                  placeholder="Enter your email address"
                  className="w-full text-[#111111] placeholder:text-[#9ca3af] transition-colors"
                  style={{
                    height: '54px',
                    border: fieldErrors.email
                      ? '1.5px solid #E50914'
                      : '1.5px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '0 14px',
                    fontSize: '15px',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    if (!fieldErrors.email) e.currentTarget.style.border = '1.5px solid #E50914'
                  }}
                  onBlur={(e) => {
                    if (!fieldErrors.email) e.currentTarget.style.border = '1.5px solid #e5e7eb'
                  }}
                />
                {fieldErrors.email && (
                  <p id="login-email-error" className="mt-1.5 text-caption text-[#E50914]">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="login-password"
                    className="text-label font-semibold text-[#111111]"
                  >
                    Password
                  </label>
                  <Link
                    to="/auth/forgot-password"
                    className="text-caption font-bold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
                    placeholder="Enter your password"
                    className="w-full text-[#111111] placeholder:text-[#9ca3af] transition-colors pr-11"
                    style={{
                      height: '54px',
                      border: fieldErrors.password
                        ? '1.5px solid #E50914'
                        : '1.5px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '0 44px 0 14px',
                      fontSize: '15px',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      if (!fieldErrors.password) e.currentTarget.style.border = '1.5px solid #E50914'
                    }}
                    onBlur={(e) => {
                      if (!fieldErrors.password) e.currentTarget.style.border = '1.5px solid #e5e7eb'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] focus-visible:outline-none transition-colors"
                  >
                    {showPassword
                      ? <EyeOff className="h-5 w-5" />
                      : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="login-password-error" className="mt-1.5 text-caption text-[#E50914]">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Submit button — existing logic preserved */}
              <Button
                type="submit"
                loading={isLoading}
                aria-label={isLoading ? 'Signing in…' : 'Login'}
                className="w-full font-bold text-white hover:text-white transition-all"
                style={{
                  height: '54px',
                  borderRadius: '12px',
                  background: 'linear-gradient(180deg, #ff1a1a 0%, #E50914 100%)',
                  border: 'none',
                  fontSize: '15px',
                  letterSpacing: '0.01em',
                  boxShadow: '0 4px 14px rgba(229,9,20,0.35), 0 1px 3px rgba(229,9,20,0.2)',
                }}
              >
                {!isLoading && 'Sign in'}
              </Button>
            </form>

            {/* Google Sign-In — shown between Sign In button and footer divider */}
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e5e7eb]" />
              <span className="text-eyebrow text-[#9ca3af]">OR</span>
              <div className="flex-1 h-px bg-[#e5e7eb]" />
            </div>

            <GoogleSignInButton
              redirectParam={new URLSearchParams(location.search).get('redirect')}
              onError={(msg) => setError(msg)}
              className="mt-3"
            />

            {/* Divider */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-[#e5e7eb]" />
              <span className="text-eyebrow text-[#9ca3af]">SECURE ACCESS</span>
              <div className="flex-1 h-px bg-[#e5e7eb]" />
            </div>

            {/* Registration link — existing navigation preserved */}
            <p className="mt-4 text-center text-body-small text-[#6b7280]">
              Don&apos;t have an account?{' '}
              <Link
                to="/auth/register"
                className="font-semibold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
