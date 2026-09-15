/**
 * AuthCallbackPage — KingdomDash PKCE callback handler.
 *
 * VISUAL: Matches the approved authentication design system — same background,
 * card dimensions, typography. Shows a branded loading/processing state.
 * FUNCTIONALITY: All auth logic frozen — only presentation changed.
 */

import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { roleDashboardPath } from '@/utils/safe-redirect'
import { AuthShell } from '@/components/auth/auth-shell'

// Idempotency guard: ensure exchangeCodeForSession is called at most once per code
const exchangedCodes = new Set<string>()

export function _resetCallbackIdempotency(): void {
  exchangedCodes.clear()
}

export default function AuthCallbackPage() {
  // ── Frozen functional logic (unchanged) ─────────────────────────────────
  const navigate = useNavigate()
  const location = useLocation()
  const { session, profile, isLoading, isRecoverySession } = useAuthStore()

  // Exchange effect (runs once on mount)
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(location.search)
    const code = params.get('code')

    if (!code) {
      navigate('/auth/login', { replace: true })
      return
    }

    if (exchangedCodes.has(code)) {
      return
    }
    exchangedCodes.add(code)

    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (cancelled) return
        if (error) {
          navigate('/auth/login', { replace: true })
        }
        // Success: onAuthStateChange fires PASSWORD_RECOVERY or SIGNED_IN
        // Reaction effect below handles navigation
      })
      .catch(() => {
        if (cancelled) return
        navigate('/auth/login', { replace: true })
      })

    return () => {
      cancelled = true
    }
  }, [location.search, navigate])

  // Reaction effect (responds to auth store state with deterministic routing)
  useEffect(() => {
    if (isLoading) return

    if (isRecoverySession) {
      navigate('/auth/update-password', { replace: true })
      return
    }

    if (session && profile) {
      navigate(roleDashboardPath(profile.role), { replace: true })
      return
    }
  }, [isRecoverySession, session, profile, isLoading, navigate])
  // ── End frozen logic ────────────────────────────────────────────────────

  // ── Branded loading UI ────────────────────────────────────────────────
  return (
    <AuthShell headlineLine1="Delivering what" headlineLine2Prefix="matters " headlineKeyword="most">
      {/* Spinner icon container */}
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
        <Loader2 className="h-5 w-5 text-[#E50914] animate-spin" />
      </div>

      {/* Heading */}
      <h2
        className="font-bold leading-none tracking-tight text-[#111111]"
        style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
      >
        Verifying your session
      </h2>
      <p className="mt-2 text-body-small text-[#6b7280]">
        Please wait while we confirm your account.
      </p>

      {/* Progress indicator */}
      <div
        className="mt-8 flex items-center gap-4 rounded-xl px-4 py-4"
        style={{
          background: 'rgba(229,9,20,0.04)',
          border: '1px solid rgba(229,9,20,0.10)',
        }}
        role="status"
        aria-label="Completing sign in"
      >
        <div className="flex-shrink-0">
          <Loader2 className="h-5 w-5 text-[#E50914] animate-spin" aria-hidden="true" />
        </div>
        <div>
          <p className="text-label font-semibold text-[#111111]">Completing sign in</p>
          <p className="text-caption text-[#9ca3af] mt-0.5">
            This only takes a moment…
          </p>
        </div>
      </div>

      {/* Subtle divider */}
      <div className="mt-8 flex items-center gap-3">
        <div className="flex-1 h-px bg-[#e5e7eb]" />
        <span className="text-eyebrow text-[#9ca3af]">KINGDOMDASH</span>
        <div className="flex-1 h-px bg-[#e5e7eb]" />
      </div>

      <p className="mt-4 text-center text-caption text-[#9ca3af]">
        You&apos;ll be redirected automatically.
      </p>
    </AuthShell>
  )
}
