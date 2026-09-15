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

export interface AuthState {
  session: Session | null
  profile: Profile | null
  isLoading: boolean
  isRecoverySession: boolean
  isEmailConfirmed: boolean
  profileError: Error | null
  signOut: () => Promise<void>
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
  profileError: null,

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
          isLoading: false,
        })
        break

      case 'TOKEN_REFRESHED':
        // Session token updated without re-fetching profile
        set({
          session,
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
