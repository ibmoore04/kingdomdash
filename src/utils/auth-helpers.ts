import type { Session } from '@supabase/supabase-js'

/**
 * Checks whether an authenticated session represents a verified user.
 *
 * A user is considered verified if:
 * 1. `email_confirmed_at` is set (standard email signup)
 * 2. `confirmed_at` is set (alternative Supabase confirmation field)
 * 3. `user_metadata.email_verified` is true (OAuth metadata)
 * 4. User signed in via Google OAuth (trusted OAuth identity)
 */
export function isUserEmailConfirmed(session: Session | null | undefined): boolean {
  if (!session?.user) return false
  const user = session.user
  const isGoogle =
    user.app_metadata?.provider === 'google' ||
    Boolean(user.app_metadata?.providers?.includes('google')) ||
    Boolean(user.identities?.some((id) => id.provider === 'google'))
  return Boolean(
    user.email_confirmed_at ||
    user.confirmed_at ||
    (user.user_metadata as Record<string, unknown> | null)?.email_verified ||
    isGoogle
  )
}
