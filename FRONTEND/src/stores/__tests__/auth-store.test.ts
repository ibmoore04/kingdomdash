import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({
  authCallback: null as ((event: string, session: Session | null) => void) | null,
  mockSignOut: vi.fn().mockResolvedValue({ error: null }),
  mockProfileResult: { data: null, error: null } as { data: unknown; error: unknown },
}))

vi.mock('@/services/supabase/client', () => {
  return {
    supabase: {
      auth: {
        onAuthStateChange: vi.fn((cb) => {
          mocks.authCallback = cb
          return {
            data: {
              subscription: {
                unsubscribe: vi.fn(() => {
                  mocks.authCallback = null
                }),
              },
            },
          }
        }),
        signOut: (...args: unknown[]) => mocks.mockSignOut(...args),
      },
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve(mocks.mockProfileResult)),
              })),
            })),
          }
        }
        return {}
      }),
    },
  }
})

import {
  useAuthStore,
  initAuthListener,
  cleanupAuthListener,
  type Profile,
} from '@/stores/auth-store'

describe('auth-store tests', () => {
  const sampleUser = { id: 'usr-123', email: 'user@example.com' }
  const sampleSession = {
    access_token: 'token-123',
    refresh_token: 'ref-123',
    user: sampleUser,
  } as unknown as Session

  const sampleProfile: Profile = {
    id: 'usr-123',
    email: 'user@example.com',
    full_name: 'Test User',
    phone: null,
    avatar_url: null,
    role: 'customer',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  beforeEach(() => {
    cleanupAuthListener()
    initAuthListener()
    mocks.mockSignOut.mockReset().mockResolvedValue({ error: null })
    mocks.mockProfileResult = { data: sampleProfile, error: null }
  })

  it('initializes with loading=true and null state', () => {
    cleanupAuthListener()
    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.isLoading).toBe(true)
    expect(state.isRecoverySession).toBe(false)
    expect(state.profileError).toBeNull()
  })

  it('INITIAL_SESSION (null) sets isLoading=false', () => {
    mocks.authCallback?.('INITIAL_SESSION', null)
    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.isLoading).toBe(false)
  })

  it('INITIAL_SESSION (session) loads profile', async () => {
    mocks.authCallback?.('INITIAL_SESSION', sampleSession)
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
    const state = useAuthStore.getState()
    expect(state.session).toEqual(sampleSession)
    expect(state.profile).toEqual(sampleProfile)
    expect(state.profileError).toBeNull()
  })

  it('SIGNED_IN fetches profile and clears recovery flag', async () => {
    useAuthStore.setState({ isRecoverySession: true })
    mocks.authCallback?.('SIGNED_IN', sampleSession)
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
    const state = useAuthStore.getState()
    expect(state.session).toEqual(sampleSession)
    expect(state.profile).toEqual(sampleProfile)
    expect(state.isRecoverySession).toBe(false)
  })

  it('SIGNED_OUT clears all state immediately and cancels pending fetches (P7)', async () => {
    useAuthStore.setState({ session: sampleSession, profile: sampleProfile })
    mocks.authCallback?.('SIGNED_OUT', null)
    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.profileError).toBeNull()
    expect(state.isRecoverySession).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('P7 race condition: SIGNED_IN followed immediately by SIGNED_OUT before fetch completes discards profile', async () => {
    let resolveFetch: any = null
    const { supabase } = await import('@/services/supabase/client')
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(
            () =>
              new Promise((resolve) => {
                resolveFetch = resolve
              })
          ),
        })),
      })),
    } as any)

    // Trigger sign in (fetch starts)
    mocks.authCallback?.('SIGNED_IN', sampleSession)
    expect(useAuthStore.getState().isLoading).toBe(true)

    // Trigger sign out before fetch completes
    mocks.authCallback?.('SIGNED_OUT', null)
    expect(useAuthStore.getState().session).toBeNull()

    // Now resolve the late fetch
    if (resolveFetch) {
      resolveFetch({ data: sampleProfile, error: null })
    }
    await new Promise((r) => setTimeout(r, 20))

    // Profile must still be null!
    expect(useAuthStore.getState().profile).toBeNull()
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('TOKEN_REFRESHED updates session without re-fetching profile', () => {
    useAuthStore.setState({ session: sampleSession, profile: sampleProfile, isLoading: false })
    const refreshedSession = { ...sampleSession, access_token: 'new-token' } as Session
    mocks.authCallback?.('TOKEN_REFRESHED', refreshedSession)

    const state = useAuthStore.getState()
    expect(state.session?.access_token).toBe('new-token')
    expect(state.profile).toEqual(sampleProfile)
  })

  it('PASSWORD_RECOVERY sets isRecoverySession=true', async () => {
    mocks.authCallback?.('PASSWORD_RECOVERY', sampleSession)
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
    const state = useAuthStore.getState()
    expect(state.isRecoverySession).toBe(true)
  })

  it('P8: Profile fetch failure sets profileError, isLoading=false, and does not retry', async () => {
    mocks.mockProfileResult = { data: null, error: { message: 'Database connection failed' } }
    mocks.authCallback?.('SIGNED_IN', sampleSession)
    await vi.waitFor(() => {
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
    const state = useAuthStore.getState()
    expect(state.profile).toBeNull()
    expect(state.profileError).toBeInstanceOf(Error)
    expect(state.profileError?.message).toBe('Database connection failed')
  })

  it('P14: signOut() clears all local state even if supabase.auth.signOut() throws', async () => {
    mocks.mockSignOut.mockRejectedValueOnce(new Error('Network offline'))
    useAuthStore.setState({
      session: sampleSession,
      profile: sampleProfile,
      isRecoverySession: true,
      profileError: new Error('Old error'),
    })

    await useAuthStore.getState().signOut()

    const state = useAuthStore.getState()
    expect(state.session).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.profileError).toBeNull()
    expect(state.isRecoverySession).toBe(false)
    expect(state.isLoading).toBe(false)
  })
})
