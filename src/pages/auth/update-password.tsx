/**
 * UpdatePasswordPage — KingdomDash password update page (after recovery flow).
 *
 * VISUAL: Matches the approved authentication design system.
 * FUNCTIONALITY: All auth logic frozen — only presentation changed.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase/client'
import { useAuthStore } from '@/stores/auth-store'
import { mapAuthError } from '@/utils/auth-errors'
import {
  AuthShell,
  AuthIconBadge,
  AuthErrorAlert,
  AuthDivider,
  BUTTON_STYLE,
  INPUT_STYLE_PASSWORD,
  INPUT_STYLE_PASSWORD_ERROR,
  INPUT_STYLE_BASE,
  INPUT_STYLE_ERROR,
} from '@/components/auth/auth-shell'

export default function UpdatePasswordPage() {
  // ── Frozen functional state (unchanged) ─────────────────────────────────
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string
    confirmPassword?: string
  }>({})

  const errorRef = useRef<HTMLDivElement>(null)
  const signOutInitiated = useRef(false)
  const { isRecoverySession, signOut } = useAuthStore()
  const navigate = useNavigate()

  // Recovery context check: redirect to login if no recovery session (P18)
  useEffect(() => {
    if (!isRecoverySession && !signOutInitiated.current) {
      navigate('/auth/login', { replace: true })
    }
  }, [isRecoverySession, navigate])

  // Move focus to error alert for accessibility (P15)
  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus()
    }
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errors: { password?: string; confirmPassword?: string } = {}

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
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(mapAuthError(updateError, 'Password update failed. Failed to update password'))
      } else {
        useAuthStore.setState?.({ isRecoverySession: false })
        signOutInitiated.current = true
        await signOut()
        navigate('/auth/login', { replace: true })
      }
    } catch (err) {
      setError(mapAuthError(err, 'Password update failed. Failed to update password'))
    } finally {
      setIsLoading(false)
    }
  }
  // ── End frozen logic ────────────────────────────────────────────────────

  return (
    <AuthShell headlineLine1="Delivering what" headlineLine2Prefix="matters " headlineKeyword="most">
      {/* Auth icon */}
      <AuthIconBadge icon={LockKeyhole} />

      {/* Heading */}
      <h2
        className="font-bold leading-none tracking-tight text-[#111111]"
        style={{ fontSize: 'clamp(2rem,3.5vw,2.6rem)' }}
      >
        Update your password
      </h2>
      <p className="mt-2 text-body-small text-[#6b7280]">
        Choose a strong password for your KingdomDash account.
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
        aria-label="Update your password"
        className="mt-6 space-y-5"
      >
        {/* New password */}
        <div>
          <label
            htmlFor="update-password"
            className="block text-label font-semibold text-[#111111] mb-1.5"
          >
            New password
          </label>
          <div className="relative">
            <input
              id="update-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
              }}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'update-password-error' : undefined}
              placeholder="Enter your new password"
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
            <p id="update-password-error" className="mt-1.5 text-caption text-[#E50914]">
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Confirm password */}
        <div>
          <label
            htmlFor="update-confirm-password"
            className="block text-label font-semibold text-[#111111] mb-1.5"
          >
            Confirm new password
          </label>
          <input
            id="update-confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (fieldErrors.confirmPassword)
                setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }))
            }}
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={
              fieldErrors.confirmPassword ? 'update-confirm-password-error' : undefined
            }
            placeholder="Confirm your new password"
            autoComplete="new-password"
            className="w-full text-[#111111] placeholder:text-[#9ca3af] transition-colors"
            style={fieldErrors.confirmPassword ? INPUT_STYLE_ERROR : INPUT_STYLE_BASE}
            onFocus={(e) => {
              if (!fieldErrors.confirmPassword)
                e.currentTarget.style.border = '1.5px solid #E50914'
            }}
            onBlur={(e) => {
              if (!fieldErrors.confirmPassword)
                e.currentTarget.style.border = '1.5px solid #e5e7eb'
            }}
          />
          {fieldErrors.confirmPassword && (
            <p id="update-confirm-password-error" className="mt-1.5 text-caption text-[#E50914]">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          loading={isLoading}
          aria-label={isLoading ? 'Updating password…' : 'Update password'}
          className="w-full font-bold text-white hover:text-white transition-all"
          style={BUTTON_STYLE}
        >
          {!isLoading && 'Update password'}
        </Button>
      </form>

      <AuthDivider />

      <p className="mt-5 text-center text-body-small text-[#6b7280]">
        Remember your password?{' '}
        <button
          type="button"
          onClick={() => navigate('/auth/login')}
          className="font-semibold text-[#E50914] hover:text-[#b91c1c] hover:underline transition-colors"
        >
          Sign in
        </button>
      </p>
    </AuthShell>
  )
}
