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
  CheckCircle,
  Mail,
  ShoppingBag,
  Bike,
  Store,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { appConfig } from '@/config/app.config'
import { mapAuthError } from '@/utils/auth-errors'
import { validatePhoneNumber } from '@/utils/phone'
import { useAuthStore } from '@/stores/auth-store'
import { resolvePostLoginTarget } from '@/utils/safe-redirect'
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

interface AccountOption {
  type: AccountType
  title: string
  description: string
  icon: typeof ShoppingBag
}

const ACCOUNT_OPTIONS: AccountOption[] = [
  {
    type: 'customer',
    title: 'Customer',
    description: 'Order food, groceries, and courier services.',
    icon: ShoppingBag,
  },
  {
    type: 'rider',
    title: 'Rider',
    description: 'Deliver orders and courier packages.',
    icon: Bike,
  },
  {
    type: 'vendor',
    title: 'Vendor',
    description: 'Sell food or groceries through KingdomDash.',
    icon: Store,
  },
]

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('customer')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string
    email?: string
    phone?: string
    password?: string
    confirmPassword?: string
    accountType?: string
  }>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const errorRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors: {
      fullName?: string
      email?: string
      phone?: string
      password?: string
      confirmPassword?: string
      accountType?: string
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

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsLoading(true)

    try {
      // Send intent only in metadata — role assignment is strictly server-authoritative
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phoneValidation.normalized,
            account_type: accountType,
          },
          emailRedirectTo: `${appConfig.url}/auth/callback`,
        },
      })

      if (signUpError) {
        setError(mapAuthError(signUpError, 'Sign up'))
      } else {
        if (accountType === 'customer') {
          navigate(`/auth/verify-email?email=${encodeURIComponent(email.trim())}`, { replace: true })
        } else {
          setIsSubmitted(true)
        }
      }
    } catch (err) {
      setError(mapAuthError(err, 'Sign up'))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Post-registration confirmation state ──────────────────────────────
  if (isSubmitted) {
    return (
      <AuthShell>
        {accountType === 'customer' ? (
          <>
            {/* Customer confirmation */}
            <div
              className="inline-flex items-center justify-center rounded-2xl mb-5"
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(22,163,74,0.10)',
                border: '1px solid rgba(22,163,74,0.25)',
              }}
              aria-hidden="true"
            >
              <CheckCircle className="h-5 w-5 text-[#16a34a]" />
            </div>

            <h2
              className="font-bold leading-none tracking-tight text-[#111111]"
              style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
            >
              Check your email
            </h2>
            <p className="mt-2 text-body-small text-[#6b7280]">
              We've sent a confirmation link to your inbox.
            </p>

            <div
              className="mt-6 flex items-start gap-3 rounded-xl px-4 py-4"
              style={{
                background: 'rgba(22,163,74,0.06)',
                border: '1px solid rgba(22,163,74,0.2)',
              }}
            >
              <Mail className="h-5 w-5 text-[#16a34a] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-label font-semibold text-[#111111]">
                  Confirm your email at
                </p>
                <p className="text-body-small text-[#6b7280] mt-0.5 break-all">{email}</p>
                <p className="text-caption text-[#9ca3af] mt-2">
                  Click the link in the email to activate your account, then sign in.
                  Check your spam folder if you don't see it.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Applicant (Rider or Vendor) confirmation */}
            <div
              className="inline-flex items-center justify-center rounded-2xl mb-5"
              style={{
                width: '48px',
                height: '48px',
                background: 'rgba(234,88,12,0.10)',
                border: '1px solid rgba(234,88,12,0.25)',
              }}
              aria-hidden="true"
            >
              <Clock className="h-5 w-5 text-[#ea580c] animate-pulse" />
            </div>

            <h2
              className="font-bold leading-none tracking-tight text-[#111111]"
              style={{ fontSize: 'clamp(1.8rem,3.2vw,2.3rem)' }}
            >
              Application Submitted
            </h2>
            <p className="mt-2 text-body-small text-[#6b7280]">
              {accountType === 'rider'
                ? 'Your Rider application has been submitted. Your account will become available for Rider operations after verification and approval.'
                : 'Your Vendor application has been submitted. Your account will become available for Vendor operations after review and approval.'}
            </p>

            <div
              className="mt-6 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                <p className="text-label font-semibold text-[#111111]">
                  Next Steps:
                </p>
              </div>
              <ul className="text-caption text-[#6b7280] space-y-1.5 list-disc list-inside">
                <li>Check your email (<strong className="text-[#111111]">{email}</strong>) to confirm your account.</li>
                <li>The KingdomDash operations team will review your application.</li>
                <li>Once approved, you will be granted access to the {accountType === 'rider' ? 'Rider Platform' : 'Vendor Portal'}.</li>
              </ul>
            </div>
          </>
        )}

        <AuthDivider />

        <p className="mt-5 text-center text-body-small text-[#6b7280]">
          Already confirmed?{' '}
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

        {/* Account Type Selection */}
        <div className="pt-2">
          <label className="block text-label font-semibold text-[#111111] mb-2">
            What would you like to do on KingdomDash?
          </label>
          <div
            role="radiogroup"
            aria-label="What would you like to do on KingdomDash?"
            className="grid grid-cols-1 gap-2.5"
          >
            {ACCOUNT_OPTIONS.map((option) => {
              const isSelected = accountType === option.type
              const Icon = option.icon
              return (
                <button
                  key={option.type}
                  type="button"
                  role="radio"
                  aria-label={option.title}
                  aria-checked={isSelected}
                  onClick={() => setAccountType(option.type)}
                  className={`flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-[#E50914] bg-red-50/40 shadow-sm ring-1 ring-[#E50914]'
                      : 'border-[#e5e7eb] bg-white hover:border-[#d1d5db] hover:bg-gray-50/50'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-[#E50914] text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-body-small font-semibold text-[#111111]">
                        {option.title}
                      </span>
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? 'border-[#E50914] bg-[#E50914]'
                            : 'border-[#d1d5db] bg-white'
                        }`}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <p className="mt-0.5 text-caption text-[#6b7280]">
                      {option.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
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
