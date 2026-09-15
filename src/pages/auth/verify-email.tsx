import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { roleDashboardPath } from '@/utils/safe-redirect'
import {
  AuthShell,
  AuthIconBadge,
  BUTTON_STYLE,
} from '@/components/auth/auth-shell'

export default function VerifyEmailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, isEmailConfirmed, signOut } = useAuthStore()

  // Email resolution: query param takes precedence if arriving right after signup, otherwise current session email
  const searchParams = new URLSearchParams(location.search)
  const queryEmail = searchParams.get('email')
  const email = queryEmail || session?.user?.email || ''

  const [isResending, setIsResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  const statusRef = useRef<HTMLDivElement>(null)

  // If the user's email is already confirmed and profile is loaded, send them to their dashboard
  useEffect(() => {
    if (session && isEmailConfirmed) {
      if (profile) {
        navigate(roleDashboardPath(profile.role), { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [session, isEmailConfirmed, profile, navigate])

  // Resend cooldown timer countdown
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // Move focus to alert for screen readers
  useEffect(() => {
    if (resendStatus !== 'idle' && statusRef.current) {
      statusRef.current.focus()
    }
  }, [resendStatus])

  async function handleResendEmail() {
    if (!email || cooldownSeconds > 0 || isResending) return

    setIsResending(true)
    setResendStatus('idle')
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      })

      if (error) {
        setResendStatus('error')
        setErrorMessage(error.message || 'Failed to resend confirmation email. Please try again later.')
      } else {
        setResendStatus('success')
        // Enforce 60-second cooldown
        setCooldownSeconds(60)
      }
    } catch (err) {
      setResendStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setIsResending(false)
    }
  }

  async function handleSignOutAndSwitch() {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <AuthShell
      headlineLine1="Verify your"
      headlineLine2Prefix="email "
      headlineKeyword="address"
    >
      <AuthIconBadge icon={Mail} />

      <h2
        className="font-bold leading-none tracking-tight text-[#111111]"
        style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
      >
        Check your email
      </h2>
      <p className="mt-2 text-body-small text-[#6b7280]">
        An email confirmation is required to access KingdomDash.
      </p>

      {/* Target email card */}
      <div
        className="mt-6 flex items-start gap-3 rounded-xl px-4 py-4"
        style={{
          background: 'rgba(229,9,20,0.04)',
          border: '1px solid rgba(229,9,20,0.18)',
        }}
      >
        <Mail className="h-5 w-5 text-[#E50914] flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-label font-semibold text-[#111111]">
            Confirmation sent to:
          </p>
          <p className="text-body-small font-medium text-[#111111] mt-0.5 break-all">
            {email || 'Your registered email address'}
          </p>
          <p className="text-caption text-[#6b7280] mt-2 leading-relaxed">
            Please click the confirmation link in that email to activate your account. If you don't see it in your inbox, check your spam or promotions folder.
          </p>
        </div>
      </div>

      {/* Resend Status feedback alerts */}
      {resendStatus === 'success' && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-body-small bg-green-50 text-green-800 border border-green-200 outline-none"
        >
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>Verification email resent successfully! Check your inbox.</span>
        </div>
      )}

      {resendStatus === 'error' && (
        <div
          ref={statusRef}
          tabIndex={-1}
          role="alert"
          className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3 text-body-small bg-red-50 text-red-800 border border-red-200 outline-none"
        >
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <Button
          type="button"
          onClick={handleResendEmail}
          disabled={isResending || cooldownSeconds > 0 || !email}
          className="w-full text-white font-semibold transition-all"
          style={BUTTON_STYLE}
        >
          {isResending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending confirmation…
            </span>
          ) : cooldownSeconds > 0 ? (
            `Resend available in ${cooldownSeconds}s`
          ) : (
            'Resend Verification Email'
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleSignOutAndSwitch}
          className="w-full border-gray-200 text-[#374151] hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Use a different account / Sign in
        </Button>
      </div>
    </AuthShell>
  )
}
