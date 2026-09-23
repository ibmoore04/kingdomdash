import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import AuthCallbackPage, { _resetCallbackIdempotency } from '@/pages/auth/callback'
import { supabase } from '@/services/supabase/client'
import { useAuthStore, cleanupAuthListener } from '@/stores/auth-store'

// Mock Supabase
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: vi.fn(),
    },
  },
}))

// Mock auth store
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
  cleanupAuthListener: vi.fn(),
}))

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanupAuthListener()
    _resetCallbackIdempotency()
  })

  afterEach(() => {
    cleanupAuthListener()
    _resetCallbackIdempotency()
  })

  describe('P17: Idempotency - exchange code at most once', () => {
    it('does not call exchangeCodeForSession when no code parameter', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ initialEntries: ['/auth/callback'] })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled()
      })
    })

    it('calls exchangeCodeForSession exactly once with valid code (P17)', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_pkce_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('test_pkce_code')
      })
    })

    it('handles Strict Mode double-invocation by calling exchange at most once (P17)', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_pkce_code'] 
      })
      
      const { unmount } = render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      // Simulate Strict Mode double-mount by unmounting and remounting
      unmount()
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        // Should still only be called once total (idempotency guard prevents second call)
        expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Error handling', () => {
    it('navigates to login on exchange error', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
        error: { message: 'Invalid code' } as any,
      } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=invalid_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/login')
      })
    })

    it('navigates to login on network error', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockRejectedValue(new Error('Network error'))
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/login')
      })
    })
  })

  describe('Deterministic routing - Password recovery', () => {
    it('navigates to update-password when isRecoverySession is true', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true, // Recovery context active
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/update-password')
      })
    })

    it('navigates to update-password when URL type=recovery parameter', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code&type=recovery'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/update-password')
      })
    })
  })

  describe('Deterministic routing - Email confirmation', () => {
    it('navigates to public homepage when session and profile resolved without redirect param', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id', email_confirmed_at: '2026-09-01T00:00:00Z' } } as any,
        profile: { 
          role: 'customer',
          full_name: 'Test User',
          is_active: true,
        } as any,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/')
      })
    })

    it('navigates to vendor dashboard for vendor role when redirect param is specified', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id', email_confirmed_at: '2026-09-01T00:00:00Z' } } as any,
        profile: { 
          role: 'vendor',
          full_name: 'Test Vendor',
          is_active: true,
        } as any,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code&redirect=%2Fvendor'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/vendor')
      })
    })

    it('navigates to verify-email if session is unconfirmed', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id', email_confirmed_at: null } } as any,
        profile: { 
          role: 'customer',
          full_name: 'Test User',
          is_active: true,
        } as any,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/verify-email')
      })
    })

    it('waits while isLoading is true', async () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: true, // Still loading
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      // Should show loading spinner
      expect(screen.getByText(/verifying your session/i)).toBeInTheDocument()
      
      // Should not navigate yet
      expect(history.location.pathname).toBe('/auth/callback')
    })
  })

  describe('Loading state', () => {
    it('displays loading indicator while processing', () => {
      vi.mocked(supabase.auth.exchangeCodeForSession).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      expect(screen.getByText(/verifying your session/i)).toBeInTheDocument()
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  describe('Cleanup on unmount', () => {
    it('does not navigate after unmount during exchange', async () => {
      let resolveExchange: any = undefined
      vi.mocked(supabase.auth.exchangeCodeForSession).mockImplementation(
        () => new Promise((resolve) => { resolveExchange = resolve })
      )
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ 
        initialEntries: ['/auth/callback?code=test_code'] 
      })
      
      const { unmount } = render(
        <Router location={history.location} navigator={history}>
          <AuthCallbackPage />
        </Router>
      )

      // Unmount before exchange completes
      unmount()
      
      // Resolve the exchange
      if (resolveExchange) {
        resolveExchange({ error: null })
      }

      // Wait a bit to ensure no navigation happens
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Should still be at callback URL (no navigation after unmount)
      expect(history.location.pathname).toBe('/auth/callback')
    })
  })
})
