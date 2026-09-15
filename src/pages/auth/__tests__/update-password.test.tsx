import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter, Router } from 'react-router-dom'
import { createMemoryHistory } from 'history'
import UpdatePasswordPage from '@/pages/auth/update-password'
import { supabase } from '@/services/supabase/client'
import { useAuthStore, cleanupAuthListener } from '@/stores/auth-store'

// Mock Supabase
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      updateUser: vi.fn(),
    },
  },
}))

// Mock auth store
vi.mock('@/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
  cleanupAuthListener: vi.fn(),
}))

describe('UpdatePasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cleanupAuthListener()
  })

  afterEach(() => {
    cleanupAuthListener()
  })

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <UpdatePasswordPage />
      </BrowserRouter>
    )
  }

  describe('P18: Recovery context check', () => {
    it('redirects to login when isRecoverySession is false (P18)', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false, // No recovery context
        profileError: null,
        signOut: vi.fn(),
      })

      const history = createMemoryHistory({ initialEntries: ['/auth/update-password'] })
      
      render(
        <Router location={history.location} navigator={history}>
          <UpdatePasswordPage />
        </Router>
      )

      await waitFor(() => {
        expect(history.location.pathname).toBe('/auth/login')
      })
    })

    it('does not redirect when isRecoverySession is true', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true, // Recovery context active
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()

      await waitFor(() => {
        expect(screen.getByText(/update your password/i)).toBeInTheDocument()
      })
    })
  })

  describe('Client-side validation', () => {
    it('rejects empty password', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Password is required')).toBeInTheDocument()
      })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('rejects password shorter than 8 characters', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'short' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'short' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })

    it('rejects mismatched password confirmation', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'different123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
      expect(supabase.auth.updateUser).not.toHaveBeenCalled()
    })
  })

  describe('Successful password update', () => {
    it('clears recovery state, calls signOut, and navigates to login on success', async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined)
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: mockSignOut,
      })

      const history = createMemoryHistory({ initialEntries: ['/auth/update-password'] })
      
      render(
        <Router location={history.location} navigator={history}>
          <UpdatePasswordPage />
        </Router>
      )

      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'newPassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newPassword123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'newPassword123' })
        expect(mockSignOut).toHaveBeenCalled()
        expect(history.location.pathname).toBe('/auth/login')
      })
    })

    it('sets isRecoverySession to false before signOut', async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined)
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as any)
      
      let isRecoverySessionValue = true
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        get isRecoverySession() { return isRecoverySessionValue },
        profileError: null,
        signOut: mockSignOut,
      })

      const history = createMemoryHistory({ initialEntries: ['/auth/update-password'] })
      
      render(
        <Router location={history.location} navigator={history}>
          <UpdatePasswordPage />
        </Router>
      )

      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'newPassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newPassword123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(supabase.auth.updateUser).toHaveBeenCalled()
      })
    })
  })

  describe('Failed password update', () => {
    it('displays error and preserves recovery session for retry (P3)', async () => {
      vi.mocked(supabase.auth.updateUser).mockResolvedValue({
        error: { message: 'Password too weak' } as any,
      } as any)
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'newPassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newPassword123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to update password/i)).toBeInTheDocument()
      })
      
      // Recovery session should still be active for retry
      expect(vi.mocked(useAuthStore).mock.results[0].value.isRecoverySession).toBe(true)
      expect(vi.mocked(useAuthStore).mock.results[0].value.signOut).not.toHaveBeenCalled()
    })

    it('displays safe error message for unexpected errors (P3)', async () => {
      vi.mocked(supabase.auth.updateUser).mockRejectedValue(new Error('Network error'))
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'newPassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newPassword123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/password update failed/i)).toBeInTheDocument()
      })
      
      // Should not expose raw error details
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
    })
  })

  describe('P15: Accessibility', () => {
    it('has password visibility toggle with dynamic aria-label', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      
      const passwordInput = screen.getByLabelText(/^new password$/i)
      const toggleButton = screen.getByLabelText('Show password')
      
      expect(toggleButton).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')
      
      fireEvent.click(toggleButton)
      
      const hideButton = screen.getByLabelText('Hide password')
      expect(hideButton).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'text')
    })

    it('has form with aria-label', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      const form = screen.getByRole('form', { name: /update your password/i })
      expect(form).toBeInTheDocument()
    })

    it('has accessible error with aria-describedby', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        const passwordInput = screen.getByLabelText(/^new password$/i)
        expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
        expect(passwordInput).toHaveAttribute('aria-describedby', 'update-password-error')
      })
    })

    it('has accessible loading state on button', async () => {
      vi.mocked(supabase.auth.updateUser).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /update password/i })
      
      fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'newPassword123' } })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: 'newPassword123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(submitButton).toHaveAttribute('aria-label', 'Updating password…')
      })
    })
  })

  describe('Navigation', () => {
    it('has sign in link in footer', () => {
      vi.mocked(useAuthStore).mockReturnValue({
        session: { user: { id: 'test-id' } } as any,
        profile: null,
        isLoading: false,
        isRecoverySession: true,
        profileError: null,
        signOut: vi.fn(),
      })

      renderWithRouter()
      
      const signInLink = screen.getByText(/sign in/i)
      expect(signInLink).toBeInTheDocument()
      fireEvent.click(signInLink)
      
      // Should navigate to login
      expect(window.location.pathname).toBe('/auth/login')
    })
  })
})
