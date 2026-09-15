/**
 * ForgotPasswordPage — KingdomDash password reset request page.
 *
 * VISUAL: Matches the approved Login/Register card design system.
 * FUNCTIONALITY: All auth logic frozen — only presentation changed.
 */

import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { appConfig } from '@/config/app.config'
import {
  AuthShell,
  AuthField,
  AuthIconBadge,
  AuthDivider,
  BUTTON_STYLE,
} from '@/components/auth/auth-shell'

export default function ForgotPasswordPage() {
  // ── Frozen functional state (unchanged) ─────────────────────────────────
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const errorRef = useRef<HTMLDivElement>(null)

  // Move focus to error alert for accessibility (P15)
  useEffect(() => {
    if (fieldError && errorRef.current) {
      errorRef.current.focus()
    }
  }, [fieldError])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    // Client-side validation: non-empty email (P6)
    if (!email.trim()) {
      setFieldError('Email is required')
      return
    }

    setIsLoading(true)

    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${appConfig.url}/auth/callback`,
      })
    } catch {
      // Enumeration prevention: always show confirmation regardless of outcome (P5)
    } finally {
      setIsLoading(false)
      setIsSubmitted(true)
    }
  }
  // ── End frozen logic ────────────────────────────────────────────────────

  // ── Confirmation state (P5 — identical for all outcomes) ──────────────
  if (isSubmitted) {
    return (
      <AuthShell headlineLine1="Delivering what" headlineLine2Prefix="matters " headlineKeyword="most">
        {/* Icon */}
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
          <MailCheck className="h-5 w-5 text-[#E50914]" />
        </div>

        <h2
          className="font-bold leading-none tracking-tight text-[#111111]"
          style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
        >
          Check your email
        </h2>
        <p className="mt-2 text-body-small text-[#6b7280]">
          If an account exists for <span className="font-semibold text-[#111111]">{email}</span>, we have sent password reset instructions.
        </p>

        <div
          className="mt-6 rounded-xl px-4 py-4"
          style={{
            background: 'rgba(229,9,20,0.04)',
            border: '1px solid rgba(229,9,20,0.12)',
          }}
        >
          <p className="text-caption text-[#6b7280]">
            The link will expire in 1 hour. If you don&apos;t see the email, check your spam folder.
          </p>
        </div>

        <AuthDivider />

        <p className="mt-5 text-center text-body-small text-[#6b7280]">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1.5 font-semibold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to sign in
          </Link>
        </p>
      </AuthShell>
    )
  }

  // ── Reset request form ────────────────────────────────────────────────
  return (
    <AuthShell headlineLine1="Delivering what" headlineLine2Prefix="matters " headlineKeyword="most">
      {/* Auth icon */}
      <AuthIconBadge icon={KeyRound} />

      {/* Heading */}
      <h2
        className="font-bold leading-none tracking-tight text-[#111111]"
        style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
      >
        Forgot your{' '}
        <span className="text-[#E50914]">password?</span>
      </h2>
      <p className="mt-2 text-body-small text-[#6b7280]">
        Enter your email and we&apos;ll send you a secure link to reset your password.
      </p>

      {/* Form */}
      <form
        noValidate
        onSubmit={handleSubmit}
        aria-label="Request password reset"
        className="mt-6 space-y-5"
      >
        <AuthField
          id="forgot-email"
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (fieldError) setFieldError(null)
          }}
          placeholder="Enter your email address"
          error={fieldError ?? undefined}
          errorId="forgot-email-error"
          autoComplete="email"
        />

        <Button
          type="submit"
          loading={isLoading}
          aria-label={isLoading ? 'Sending reset link…' : 'Send reset link'}
          className="w-full font-bold text-white hover:text-white transition-all"
          style={BUTTON_STYLE}
        >
          {!isLoading && 'Send reset link'}
        </Button>
      </form>

      <AuthDivider />

      <p className="mt-5 text-center text-body-small text-[#6b7280]">
        <Link
          to="/auth/login"
          className="inline-flex items-center gap-1.5 font-semibold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
