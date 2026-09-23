/**
 * src/services/supabase/auth.ts
 *
 * KingdomDash authentication service helpers.
 *
 * Rules:
 * - Uses the existing singleton Supabase client (PKCE flow, detectSessionInUrl: false).
 * - redirectTo always points to the existing /auth/callback route.
 * - The optional `redirectParam` is forwarded so post-login routing works
 *   identically to the email/password flow via resolvePostLoginTarget().
 * - No role assignment, no profile creation — all handled server-side by
 *   the handle_new_user() trigger and the existing auth-store listener.
 * - No service-role key, no secrets in frontend code.
 */

import type { AuthError } from '@supabase/supabase-js'
import { supabase } from './client'
import { appConfig } from '@/config/app.config'

/**
 * Initiates the Google OAuth PKCE flow via Supabase Auth.
 *
 * On success Supabase redirects the browser to /auth/callback?code=…
 * The existing AuthCallbackPage calls exchangeCodeForSession(code),
 * which fires SIGNED_IN on onAuthStateChange, which triggers
 * startProfileFetch() in the auth-store — exactly the same path as
 * email/password login.
 *
 * @param redirectParam  Optional ?redirect= path to forward through the
 *                       callback so post-login routing resolves correctly.
 */
export async function signInWithGoogle(
  redirectParam?: string | null
): Promise<{ error: AuthError | null }> {
  // Build the callback URL, forwarding any redirect param so the callback
  // page can resolve the correct post-login destination via resolvePostLoginTarget().
  const callbackBase = `${appConfig.url}/auth/callback`
  const redirectTo = redirectParam
    ? `${callbackBase}?redirect=${encodeURIComponent(redirectParam)}`
    : callbackBase

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      scopes: 'openid email profile',
      queryParams: {
        // Request offline access so Supabase can refresh the session
        access_type: 'offline',
        // Force account selection so users can switch Google accounts
        prompt: 'select_account',
      },
    },
  })

  return { error: error ?? null }
}
