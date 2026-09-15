export const SAFE_ERROR_MESSAGES = [
  'Invalid email or password.',
  'Please confirm your email before signing in.',
  'An account with this email already exists.',
  'Password must be at least 8 characters.',
  'Link expired or already used. Please request a new one.',
  'Your account is inactive. Please contact support.',
  'Operation failed. Please try again.',
] as const

/**
 * Maps Supabase auth errors or unexpected exceptions into safe user-facing error messages.
 * Prevents raw database schema details, stack traces, or internal server errors from leaking (P3).
 */
export function mapAuthError(error: unknown, actionFallback = 'Operation'): string {
  if (!error) {
    return `${actionFallback} failed. Please try again.`
  }

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : ''

  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials') || normalized.includes('invalid credentials')) {
    return 'Invalid email or password.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }

  if (
    normalized.includes('already registered') ||
    normalized.includes('user already registered') ||
    normalized.includes('email already in use')
  ) {
    return 'An account with this email already exists.'
  }

  if (
    normalized.includes('password should be at least') ||
    normalized.includes('password must be at least')
  ) {
    return 'Password must be at least 8 characters.'
  }

  if (
    normalized.includes('token has expired') ||
    normalized.includes('link expired') ||
    normalized.includes('otp expired') ||
    normalized.includes('already used')
  ) {
    return 'Link expired or already used. Please request a new one.'
  }

  if (normalized.includes('inactive') || normalized.includes('account disabled')) {
    return 'Your account is inactive. Please contact support.'
  }

  return `${actionFallback} failed. Please try again.`
}
