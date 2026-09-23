/**
 * RegisterPage — KingdomDash registration page.
 *
 * Implements:
 * - Full name, email address, phone number (Nigerian + international), password, confirm password
 * - Account type selection: Customer, Rider, Vendor
 * - Strict backend role security: Client intent (account_type) never self-assigns privileged roles.
 * - Tailored post-submission confirmation states per account type.
 */

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  UserPlus,
  CheckCircle2,
  XCircle,
  Loader2 as LoaderIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { appConfig } from '@/config/app.config'
import { mapAuthError } from '@/utils/auth-errors'
import { validatePhoneNumber } from '@/utils/phone'
import { useAuthStore } from '@/stores/auth-store'
import { resolvePostLoginTarget } from '@/utils/safe-redirect'
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import {
  AuthShell,
  AuthField,
  AuthIconBadge,
  AuthErrorAlert,
  AuthDivider,
  BUTTON_STYLE,
  INPUT_STYLE_PASSWORD,
  INPUT_STYLE_PASSWORD_ERROR,
} from '@/components/auth/auth-shell'

export type AccountType = 'customer' | 'rider' | 'vendor'

// Referral code validation states
type ReferralStatus = 'idle' | 'checking' | 'valid' | 'invalid'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const location = useLocation()
  const [referralCode, setReferralCode] = useState(() => {
    return new URLSearchParams(location.search).get('ref')?.toUpperCase() || ''
  })
  const [referralStatus, setReferralStatus] = useState<ReferralStatus>('idle')
  const referralDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string
    email?: string
    phone?: string
    password?: string
    confirmPassword?: string
    terms?: string
  }>({})

  const errorRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { session, profile } = useAuthStore()

  // Prevent authenticated / unconfirmed users from accessing registration form
  useEffect(() => {
    if (session) {
      if (!session.user?.email_confirmed_at) {
        navigate(`/auth/verify-email?email=${encodeURIComponent(session.user?.email || '')}`, { replace: true })
        return
      }
      if (profile?.is_active) {
        const redirectParam = new URLSearchParams(location.search).get('redirect')
        navigate(resolvePostLoginTarget(redirectParam, profile), { replace: true })
      }
    }
  }, [session, profile, location.search, navigate])

  // Move focus to error alert for accessibility (P15)
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus()
    }
  }, [error])

  // Referral code real-time validation (debounced 600ms)
  useEffect(() => {
    if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current)
    const trimmed = referralCode.trim()
    if (!trimmed) {
      setReferralStatus('idle')
      return
    }
    setReferralStatus('checking')
    referralDebounceRef.current = setTimeout(async () => {
      try {
        // Use the secure RPC function to safely validate referral codes for anonymous users
        // without violating profiles Row Level Security (RLS).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error: rpcError } = await (supabase.rpc as any)('validate_referral_code', {
          p_code: trimmed,
        })
        if (rpcError || data !== true) {
          setReferralStatus('invalid')
        } else {
          setReferralStatus('valid')
        }
      } catch {
        setReferralStatus('invalid')
      }
    }, 600)
    return () => {
      if (referralDebounceRef.current) clearTimeout(referralDebounceRef.current)
    }
  }, [referralCode])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors: {
      fullName?: string
      email?: string
      phone?: string
      password?: string
      confirmPassword?: string
      terms?: string
    } = {}

    if (!fullName.trim()) {
      errors.fullName = 'Full name is required'
    }

    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address'
    }

    const phoneValidation = validatePhoneNumber(phone)
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.error || 'Please enter a valid phone number'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (!termsAccepted) {
      errors.terms = 'You must accept the Terms of Service and Privacy Policy to register'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      // If a referral code is present but not yet validated (or invalid), block submission
      if (referralCode.trim() && referralStatus === 'checking') {
        setError('Please wait while we validate your referral code.')
        setIsLoading(false)
        return
      }
      if (referralCode.trim() && referralStatus === 'invalid') {
        setError('The referral code you entered does not exist. Please check it and try again.')
        setIsLoading(false)
        return
      }

      if (referralCode.trim()) {
        try {
          localStorage.setItem('kd_pending_referral', referralCode.trim())
        } catch {
          // ignore
        }
      }

      // Send intent only in metadata — role assignment is strictly server-authoritative
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phoneValidation.normalized,
            account_type: 'customer',
            referral_code: referralCode.trim() || undefined,
          },
          emailRedirectTo: `${appConfig.url}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(mapAuthError(signUpError, 'Sign up'))
      } else {
        navigate(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true })
      }
    } catch (err) {
      setError(mapAuthError(err, 'Sign up'))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Registration form ─────────────────────────────────────────────────
  return (
    <AuthShell headlineLine1="Join the" headlineLine2Prefix="" headlineKeyword="KingdomDash">
      {/* Auth icon */}
      <AuthIconBadge icon={UserPlus} />

      {/* Heading */}
      <h2
        className="font-bold leading-none tracking-tight text-[#111111]"
        style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
      >
        Create your{' '}
        <span className="text-[#E50914]">account.</span>
      </h2>
      <p className="mt-2 text-body-small text-[#6b7280]">
        Join KingdomDash and get started with fast, reliable delivery in Ijebu-Ode.
      </p>

      {/* Error alert */}
      {error && (
        <div className="mt-5">
          <AuthErrorAlert message={error} alertRef={errorRef} />
        </div>
      )}

      {/* Google Sign-In — at the top, before the email form */}
      <div className="mt-6">
        <GoogleSignInButton
          redirectParam={new URLSearchParams(location.search).get('redirect')}
          onError={(msg) => setError(msg)}
        />
      </div>

      {/* OR divider */}
      <div className="mt-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-[#e5e7eb]" />
        <span className="text-eyebrow text-[#9ca3af]">OR REGISTER WITH EMAIL</span>
        <div className="flex-1 h-px bg-[#e5e7eb]" />
      </div>

      {/* Form */}
      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Create your account"
        className="mt-6 space-y-5"
      >
        {/* Full name */}
        <AuthField
          id="register-fullname"
          label="Full name"
          type="text"
          required
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value)
            if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }))
          }}
          placeholder="Your full name"
          error={fieldErrors.fullName}
          autoComplete="name"
        />

        {/* Email */}
        <AuthField
          id="register-email"
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }))
          }}
          placeholder="Enter your email address"
          error={fieldErrors.email}
          autoComplete="email"
        />

        {/* Phone number */}
        <AuthField
          id="register-phone"
          label="Phone number"
          type="tel"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: undefined }))
          }}
          placeholder="e.g. 0801 234 5678 or +234 801 234 5678"
          error={fieldErrors.phone}
          autoComplete="tel"
        />

        {/* Password with show/hide toggle */}
        <div>
          <label
            htmlFor="register-password"
            className="block text-label font-semibold text-[#111111] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
              placeholder="Create a strong password (min. 8 characters)"
              autoComplete="new-password"
              className="w-full text-[#111111] placeholder:text-[#9ca3af] transition-colors"
              style={fieldErrors.password ? INPUT_STYLE_PASSWORD_ERROR : INPUT_STYLE_PASSWORD}
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
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {fieldErrors.password && (
            <p id="register-password-error" className="mt-1.5 text-caption text-[#E50914]">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <AuthField
          id="register-confirm-password"
          label="Confirm password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value)
            if (fieldErrors.confirmPassword)
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
          }}
          placeholder="Repeat your password"
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
        />

        {/* Referral code (Optional) */}
        <div>
          <label
            htmlFor="register-referral"
            className="block text-label font-semibold text-[#111111] mb-1.5"
          >
            Referral Code <span className="text-caption text-[#6b7280] font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <input
              id="register-referral"
              type="text"
              value={referralCode}
              onChange={(e) => {
                setReferralCode(e.target.value.toUpperCase())
                setReferralStatus('idle')
              }}
              placeholder="e.g. KD-ABCD"
              className="w-full text-[#111111] placeholder:text-[#9ca3af] uppercase font-mono tracking-wider transition-colors pr-10"
              style={{
                ...INPUT_STYLE_PASSWORD,
                borderColor:
                  referralStatus === 'valid'
                    ? '#059669'
                    : referralStatus === 'invalid'
                    ? '#E50914'
                    : '#e5e7eb',
              }}
              autoComplete="off"
            />
            {/* Validation indicator */}
            {referralStatus === 'checking' && (
              <LoaderIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-[#9ca3af]" />
            )}
            {referralStatus === 'valid' && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#059669]" />
            )}
            {referralStatus === 'invalid' && (
              <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#E50914]" />
            )}
          </div>
          {referralStatus === 'valid' && (
            <p className="mt-1 text-caption text-[#059669] font-medium">
              ✓ Valid referral code! ₦500 delivery credit will be applied on your first order.
            </p>
          )}
          {referralStatus === 'invalid' && (
            <p className="mt-1 text-caption text-[#E50914]">
              This referral code doesn&apos;t exist. Check for typos and try again.
            </p>
          )}
        </div>

        {/* Terms & Privacy acceptance */}
        <div className="space-y-1.5 pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none text-left">
            <input
              type="checkbox"
              id="register-terms"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked)
                if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: undefined }))
              }}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#E50914] focus:ring-[#E50914]"
            />
            <span className="text-body-small text-[#4b5563] leading-snug">
              I agree to KingdomDash&apos;s{' '}
              <Link
                to="/terms"
                target="_blank"
                className="font-semibold text-[#E50914] hover:text-[#b91c1c] underline"
              >
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="font-semibold text-[#E50914] hover:text-[#b91c1c] underline"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.terms && (
            <p id="register-terms-error" className="text-caption text-[#E50914]">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          loading={isLoading}
          aria-label={isLoading ? 'Creating account…' : 'Create account'}
          className="w-full font-bold text-white hover:text-white transition-all"
          style={BUTTON_STYLE}
        >
          {!isLoading && 'Create account'}
        </Button>
      </form>

      <AuthDivider />

      <p className="mt-5 text-center text-body-small text-[#6b7280]">
        Already have an account?{' '}
        <Link
          to="/auth/login"
          className="font-semibold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
