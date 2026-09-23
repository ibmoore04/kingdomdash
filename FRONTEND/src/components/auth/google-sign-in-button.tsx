/**
 * GoogleSignInButton — KingdomDash reusable Google OAuth button.
 *
 * Design matches the existing auth page system:
 * - Same borderRadius (12px), height (54px), font size (15px)
 * - Google brand colors on hover only (border highlight)
 * - Inline SVG Google "G" logo — no external dependency
 * - Loading state with spinner + text change
 * - Error propagated to parent via onError callback
 * - Fully accessible (aria-label, disabled when loading)
 * - w-full, no text clip, tappable at 320px — mobile safe
 *
 * Auth logic lives in signInWithGoogle() — this component is pure UI.
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signInWithGoogle } from '@/services/supabase/auth'

interface GoogleSignInButtonProps {
  /** Forwarded ?redirect= param for post-login routing (optional) */
  redirectParam?: string | null
  /** Called when the OAuth initiation fails */
  onError?: (message: string) => void
  /** Additional CSS classes */
  className?: string
}

/** Official Google "G" mark as an inline SVG — no package needed */
function GoogleGMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1804l-2.9087-2.2581c-.8055.54-1.8368.859-3.0477.859-2.3441 0-4.3282-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71C3.7845 10.17 3.6818 9.5932 3.6818 9s.1027-1.17.2822-1.71V4.9582H.9574C.3477 6.173 0 7.5482 0 9s.3477 2.827.9574 4.0418L3.964 10.71z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4627.8918 11.4255 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6718 5.1632 6.6559 3.5795 9 3.5795z"
        fill="#EA4335"
      />
    </svg>
  )
}

export function GoogleSignInButton({
  redirectParam,
  onError,
  className = '',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleClick() {
    if (isLoading) return
    setIsLoading(true)

    const { error } = await signInWithGoogle(redirectParam)

    if (error) {
      // signInWithOAuth resolves before the redirect; only errors come back here
      setIsLoading(false)
      onError?.(
        error.message?.toLowerCase().includes('popup')
          ? 'Google sign-in was blocked. Please allow pop-ups for this site and try again.'
          : 'Could not connect to Google. Please try again.'
      )
    }
    // On success: browser is redirected to /auth/callback — component unmounts naturally.
    // We leave isLoading=true so the button remains in the "Redirecting…" state
    // until navigation completes, preventing a double-click race.
  }

  return (
    <button
      type="button"
      id="google-sign-in-btn"
      onClick={handleClick}
      disabled={isLoading}
      aria-label={isLoading ? 'Redirecting to Google…' : 'Continue with Google'}
      className={`
        w-full flex items-center justify-center gap-3
        bg-white text-[#111111] font-semibold
        transition-all duration-150 cursor-pointer
        disabled:opacity-70 disabled:cursor-not-allowed
        hover:bg-[#f8f8f8] hover:border-[#4285F4]
        active:scale-[0.99]
        ${className}
      `}
      style={{
        height: '54px',
        borderRadius: '12px',
        border: '1.5px solid #e5e7eb',
        fontSize: '15px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-[18px] w-[18px] animate-spin text-[#4285F4] shrink-0" />
          <span>Redirecting to Google…</span>
        </>
      ) : (
        <>
          <span className="shrink-0 flex items-center">
            <GoogleGMark />
          </span>
          <span>Continue with Google</span>
        </>
      )}
    </button>
  )
}
