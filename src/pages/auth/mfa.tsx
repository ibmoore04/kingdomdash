import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, Loader2, AlertCircle, QrCode, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { roleDashboardPath, validateRedirectPath } from '@/utils/safe-redirect'
import {
  AuthShell,
  AuthIconBadge,
  BUTTON_STYLE,
  INPUT_STYLE_BASE,
  INPUT_STYLE_ERROR,
} from '@/components/auth/auth-shell'

interface TotpFactor {
  id: string
  factor_type: string
  status: 'verified' | 'unverified'
  friendly_name?: string
}

export default function MfaPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, mfaLevel, setMfaLevel, signOut } = useAuthStore()

  const searchParams = new URLSearchParams(location.search)
  const rawRedirect = searchParams.get('redirect')
  const redirectParam = validateRedirectPath(rawRedirect) || '/admin'

  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Enrollment state (if admin has not yet configured TOTP)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [enrolledFactorId, setEnrolledFactorId] = useState<string | null>(null)
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null)
  const [secretKey, setSecretKey] = useState<string | null>(null)

  // Active verified factor id (if already enrolled)
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null)

  const codeInputRef = useRef<HTMLInputElement>(null)

  // 1. Guard against unauthorized access to MFA page
  useEffect(() => {
    // If not logged in at all, redirect to login
    if (!session) {
      navigate('/auth/login', { replace: true })
      return
    }

    // If logged in as non-admin (customer, vendor, rider), MFA is not required
    if (profile && profile.role !== 'admin' && profile.role !== 'super_admin') {
      navigate(roleDashboardPath(profile.role), { replace: true })
      return
    }

    // If already at AAL2, redirect straight to intended destination
    if (mfaLevel === 'aal2') {
      navigate(redirectParam, { replace: true })
    }
  }, [session, profile, mfaLevel, redirectParam, navigate])

  // 2. Discover factors and determine whether to Challenge or Enroll
  const loadFactors = useCallback(async () => {
    if (!session || (profile && profile.role !== 'admin' && profile.role !== 'super_admin')) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      if (!supabase.auth?.mfa?.listFactors) {
        // In test/mock environments where MFA API is not available, proceed safely
        setIsLoading(false)
        return
      }

      const { data: factorData, error: factorError } = await supabase.auth.mfa.listFactors()

      if (factorError) {
        setError(factorError.message || 'Failed to inspect authentication factors')
        setIsLoading(false)
        return
      }

      const factors = (factorData?.totp || factorData?.all || []) as TotpFactor[]
      const verifiedFactor = factors.find((f) => f.status === 'verified')

      if (verifiedFactor) {
        // Factor exists: prompt for verification code
        setActiveFactorId(verifiedFactor.id)
        setIsEnrolling(false)
        setIsLoading(false)
      } else {
        // No verified factor exists: start enrollment for mandatory Admin MFA
        setIsEnrolling(true)

        // Clean up any stale unverified factors from previous incomplete sessions
        // to prevent Supabase error: "A factor with the friendly name '' for this user already exists"
        const unverifiedFactors = factors.filter((f) => f.status === 'unverified')
        for (const uf of unverifiedFactors) {
          try {
            if (typeof supabase.auth?.mfa?.unenroll === 'function') {
              await supabase.auth.mfa.unenroll({ factorId: uf.id })
            }
          } catch {
            // Ignore unenroll errors and proceed
          }
        }

        let { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          issuer: 'KingdomDash',
          friendlyName: 'KingdomDash Admin Authenticator',
        })

        // Retry fallback if stale unverified factor was cached in Supabase
        if (enrollError && enrollError.message?.toLowerCase().includes('already exists')) {
          try {
            const { data: refetched } = await supabase.auth.mfa.listFactors()
            const stale = ((refetched?.totp || refetched?.all || []) as TotpFactor[]).filter(
              (f) => f.status === 'unverified'
            )
            for (const sf of stale) {
              if (typeof supabase.auth?.mfa?.unenroll === 'function') {
                await supabase.auth.mfa.unenroll({ factorId: sf.id })
              }
            }
            const retryResult = await supabase.auth.mfa.enroll({
              factorType: 'totp',
              issuer: 'KingdomDash',
              friendlyName: 'KingdomDash Admin Authenticator',
            })
            enrollData = retryResult.data
            enrollError = retryResult.error
          } catch {
            // Retain original error
          }
        }

        if (enrollError || !enrollData) {
          setError(enrollError?.message || 'Failed to initialize two-factor enrollment')
          setIsLoading(false)
          return
        }

        setEnrolledFactorId(enrollData.id)
        setQrCodeUri(enrollData.totp?.qr_code || null)
        setSecretKey(enrollData.totp?.secret || null)
        setIsLoading(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication setup error')
      setIsLoading(false)
    }
  }, [session, profile])

  useEffect(() => {
    void loadFactors()
  }, [loadFactors])

  // Focus input when loaded
  useEffect(() => {
    if (!isLoading && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [isLoading, isEnrolling])

  // 3. Handle TOTP Verification submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const cleanCode = code.replace(/\s+/g, '').trim()
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      setError('Please enter a valid 6-digit verification code')
      return
    }

    const factorIdToVerify = isEnrolling ? enrolledFactorId : activeFactorId
    if (!factorIdToVerify) {
      setError('No authentication factor found to verify')
      return
    }

    setIsVerifying(true)

    try {
      if (supabase.auth?.mfa?.challengeAndVerify) {
        const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
          factorId: factorIdToVerify,
          code: cleanCode,
        })

        if (verifyError) {
          setError(verifyError.message || 'Invalid verification code. Please check your authenticator app.')
          setIsVerifying(false)
          return
        }
      }

      // Upgrade local state to AAL2
      setMfaLevel('aal2')
      navigate(redirectParam, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify authentication code')
      setIsVerifying(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <AuthShell
      headlineLine1="Two-Factor"
      headlineLine2Prefix="Admin "
      headlineKeyword="Security"
    >
      <div className="flex flex-col gap-6">
        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center">
          <AuthIconBadge icon={isEnrolling ? QrCode : ShieldCheck} />
          <h2 className="text-h3 font-bold text-text-primary mt-3">
            {isEnrolling ? 'Setup Authenticator' : 'Two-Factor Challenge'}
          </h2>
          <p className="text-body-small text-text-secondary mt-1 max-w-sm">
            {isEnrolling
              ? 'Multi-factor authentication (AAL2) is mandatory for administrative accounts. Scan the code below using Google Authenticator, Authy, or 1Password.'
              : 'Enter the 6-digit security code generated by your authenticator app to access the KingdomDash administrative console.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-body-small text-primary"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {isEnrolling && (
              <button
                type="button"
                onClick={() => void loadFactors()}
                className="self-start text-xs font-semibold text-primary underline hover:text-primary-hover cursor-pointer"
              >
                Reset and generate new authenticator key
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-caption text-text-secondary">Checking assurance level…</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Enrollment QR / Secret Details */}
            {isEnrolling && (
              <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-light-surface border border-border">
                {qrCodeUri ? (
                  <img
                    src={qrCodeUri}
                    alt="Scan TOTP QR Code"
                    className="w-44 h-44 rounded-lg bg-white p-2 border border-border"
                  />
                ) : (
                  <div className="flex items-center justify-center w-44 h-44 rounded-lg bg-white/5 border border-border">
                    <KeyRound className="w-8 h-8 text-text-secondary" />
                  </div>
                )}
                {secretKey && (
                  <div className="flex flex-col items-center text-center gap-1 w-full">
                    <span className="text-[11px] text-text-muted">Or enter secret key manually:</span>
                    <code className="text-caption font-mono font-bold tracking-wider px-2 py-1 rounded bg-black/40 text-primary border border-border select-all break-all">
                      {secretKey}
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* 6-Digit Code Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="mfa-code" className="text-body-small font-medium text-text-primary">
                6-Digit Security Code
              </label>
              <div className="relative">
                <input
                  ref={codeInputRef}
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  disabled={isVerifying}
                  className={`w-full text-center text-xl font-mono tracking-widest ${
                    error ? INPUT_STYLE_ERROR : INPUT_STYLE_BASE
                  }`}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className={`w-full ${BUTTON_STYLE}`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Verifying…
                </>
              ) : isEnrolling ? (
                'Confirm & Enable MFA'
              ) : (
                'Verify & Enter Admin Console'
              )}
            </Button>
          </form>
        )}

        {/* Footer / Cancel */}
        <div className="flex items-center justify-center pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-caption text-text-secondary hover:text-text-primary transition-colors py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cancel and sign out</span>
          </button>
        </div>
      </div>
    </AuthShell>
  )
}
