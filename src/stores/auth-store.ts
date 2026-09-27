import { create } from 'zustand'
import type { Session, Subscription } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'
import type { Database } from '@/types/database.types'
import { useCartStore } from './cart-store'

export type UserRole = Database['public']['Enums']['user_role']

export interface Profile {
  id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export function extractJwtAal(token?: string | null): 'aal1' | 'aal2' {
  if (!token || typeof token !== 'string') return 'aal1'
  try {
    const parts = token.split('.')
    if (parts.length >= 2) {
      const payload = JSON.parse(atob(parts[1]))
      if (payload.aal === 'aal2') return 'aal2'
    }
  } catch {
    // fallback
  }
  return 'aal1'
}

export interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isRecoverySession: boolean
  isEmailConfirmed: boolean
  mfaLevel: 'aal1' | 'aal2'
  profileError: Error | null
  signOut: () => Promise<void>
  setMfaLevel: (level: 'aal1' | 'aal2') => void
  checkMfaAssuranceLevel: () => Promise<'aal1' | 'aal2'>
}

// Module-level generation counter to prevent race conditions (Guarantee A and B, P7)
let fetchGeneration = 0
export function invalidateFetch(): void {
  fetchGeneration++
}

// Module-level singleton auth listener management
let authSubscription: Subscription | null = null

async function startProfileFetch(
  userId: string,
  currentGeneration: number,
  set: (partial: Partial<AuthState>) => void
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Discard if a newer event occurred while fetching (P7)
    if (currentGeneration !== fetchGeneration) {
      return
    }

    if (error) {
      set({
        profile: null,
        profileError: new Error(error.message),
        isLoading: false,
      })
      return
    }

    set({
      profile: data as unknown as Profile,
      profileError: null,
      isLoading: false,
    })
  } catch (err) {
    if (currentGeneration !== fetchGeneration) {
      return
    }
    set({
      profile: null,
      profileError: err instanceof Error ? err : new Error('Failed to fetch profile'),
      isLoading: false,
    })
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isLoading: true,
  isRecoverySession: false,
  isEmailConfirmed: false,
  mfaLevel: 'aal1',
  profileError: null,

  setMfaLevel: (mfaLevel) => set({ mfaLevel }),

  checkMfaAssuranceLevel: async () => {
    try {
      if (supabase.auth?.mfa?.getAuthenticatorAssuranceLevel) {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (!error && data?.currentLevel) {
          const lvl = data.currentLevel as 'aal1' | 'aal2'
          set({ mfaLevel: lvl })
          return lvl
        }
      }
    } catch {
      // fallback
    }
    const current = extractJwtAal(useAuthStore.getState().session?.access_token)
    set({ mfaLevel: current })
    return current
  },

  signOut: async () => {
    // Invalidate any in-flight profile fetch immediately (P7)
    invalidateFetch()

    // Explicitly reset active in-memory cart and isolate guest state
    useCartStore.getState().setUser(null)

    // Remote sign-out: ignore network errors so user is never trapped client-side (P14)
    try {
      await supabase.auth.signOut()
    } catch {
      // Swallowed intentionally
    }

    // Unconditionally clear all local auth state (P14)
    set({
      session: null,
      profile: null,
      profileError: null,
      isRecoverySession: false,
      isEmailConfirmed: false,
      mfaLevel: 'aal1',
      isLoading: false,
    })
  },
}))

/**
 * Initializes the Supabase onAuthStateChange listener as a strict singleton.
 */
export function initAuthListener(): void {
  if (authSubscription) {
    return
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(async (event, session) => {
    const set = useAuthStore.setState

    switch (event) {
      case 'INITIAL_SESSION':
        if (session) {
          useCartStore.getState().setUser(session.user.id)
          set({
            session,
            mfaLevel: extractJwtAal(session.access_token),
            isLoading: true,
            isEmailConfirmed: Boolean(session.user?.email_confirmed_at),
          })
          const gen = ++fetchGeneration
          await startProfileFetch(session.user.id, gen, set)
        } else {
          useCartStore.getState().setUser(null)
          set({
            session: null,
            profile: null,
            mfaLevel: 'aal1',
            isLoading: false,
            isRecoverySession: false,
            isEmailConfirmed: false,
          })
        }
        break

      case 'SIGNED_IN': {
        if (session) {
          useCartStore.getState().setUser(session.user.id)
          set({
            session,
            mfaLevel: extractJwtAal(session.access_token),
            isRecoverySession: false,
            isLoading: true,
            isEmailConfirmed: Boolean(session.user?.email_confirmed_at),
          })
          const gen = ++fetchGeneration
          await startProfileFetch(session.user.id, gen, set)
        } else {
          useCartStore.getState().setUser(null)
        }
        break
      }

      case 'SIGNED_OUT':
        invalidateFetch()
        useCartStore.getState().setUser(null)
        set({
          session: null,
          profile: null,
          profileError: null,
          isRecoverySession: false,
          isEmailConfirmed: false,
          mfaLevel: 'aal1',
          isLoading: false,
        })
        break

      case 'TOKEN_REFRESHED':
        // Session token updated without re-fetching profile
        set({
          session,
          mfaLevel: extractJwtAal(session?.access_token),
          isEmailConfirmed: Boolean(session?.user?.email_confirmed_at),
        })
        break

      case 'PASSWORD_RECOVERY': {
        set({
          session,
          isRecoverySession: true,
          isLoading: true,
          isEmailConfirmed: Boolean(session?.user?.email_confirmed_at),
        })
        if (session) {
          useCartStore.getState().setUser(session.user.id)
          const gen = ++fetchGeneration
          await startProfileFetch(session.user.id, gen, set)
        }
        break
      }

      case 'USER_UPDATED': {
        if (session) {
          useCartStore.getState().setUser(session.user.id)
          set({
            session,
            isLoading: true,
            isEmailConfirmed: Boolean(session.user?.email_confirmed_at),
          })
          const gen = ++fetchGeneration
          await startProfileFetch(session.user.id, gen, set)
        }
        break
      }

      default:
        break
    }
  })

  authSubscription = subscription
}

/**
 * Teardown helper for unit tests and HMR to cleanly unsubscribe and reset state.
 */
export function cleanupAuthListener(): void {
  if (authSubscription) {
    authSubscription.unsubscribe()
    authSubscription = null
  }
  invalidateFetch()
  useAuthStore.setState({
    session: null,
    profile: null,
    isLoading: true,
    isRecoverySession: false,
    isEmailConfirmed: false,
    profileError: null,
  })
}

// Auto-initialize singleton listener on module import
initAuthListener()
