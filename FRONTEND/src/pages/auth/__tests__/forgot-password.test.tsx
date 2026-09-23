import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ForgotPasswordPage from '@/pages/auth/forgot-password'
import { supabase } from '@/services/supabase/client'

// Mock Supabase
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
    },
  },
}))

// Mock app config
vi.mock('@/config/app.config', () => ({
  appConfig: {
    url: 'https://kingdomdash.com',
  },
}))

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <ForgotPasswordPage />
      </BrowserRouter>
    )
  }

  describe('P6: Empty email validation', () => {
    it('rejects empty email before API call (P6)', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument()
      })
      expect(supabase.auth.resetPasswordForEmail).not.toHaveBeenCalled()
    })

    it('clears field error when user types', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Email is required')).toBeInTheDocument()
      })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      
      expect(screen.queryByText('Email is required')).not.toBeInTheDocument()
    })
  })

  describe('P5: Enumeration prevention', () => {
    it('shows identical confirmation for existing email (P5)', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'existing@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(screen.getByText(/existing@example.com/)).toBeInTheDocument()
        expect(screen.getByText(/If an account exists for/)).toBeInTheDocument()
      })
      
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'existing@example.com',
        { redirectTo: 'https://kingdomdash.com/auth/callback' }
      )
    })

    it('shows identical confirmation for non-existing email (P5)', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({
        error: { message: 'User not found' } as any,
      } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'nonexistent@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(screen.getByText(/nonexistent@example.com/)).toBeInTheDocument()
        expect(screen.getByText(/If an account exists for/)).toBeInTheDocument()
      })
      
      // Confirmation message is identical - user cannot tell if email exists
      expect(screen.queryByText(/not found/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/does not exist/i)).not.toBeInTheDocument()
    })

    it('shows identical confirmation on network error (P5)', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockRejectedValue(new Error('Network error'))
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText('Check your email')).toBeInTheDocument()
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument()
        expect(screen.getByText(/If an account exists for/)).toBeInTheDocument()
      })
      
      // Still shows confirmation despite error
      expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/failed/i)).not.toBeInTheDocument()
    })
  })

  describe('API call parameters', () => {
    it('calls resetPasswordForEmail with correct parameters', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com',
          { redirectTo: 'https://kingdomdash.com/auth/callback' }
        )
      })
    })

    it('trims email before API call', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: '  test@example.com  ' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com',
          { redirectTo: 'https://kingdomdash.com/auth/callback' }
        )
      })
    })
  })

  describe('P15: Accessibility', () => {
    it('has form with aria-label', () => {
      renderWithRouter()
      const form = screen.getByRole('form', { name: /request password reset/i })
      expect(form).toBeInTheDocument()
    })

    it('has accessible error with aria-describedby', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        const emailInput = screen.getByLabelText(/email address/i)
        expect(emailInput).toHaveAttribute('aria-invalid', 'true')
        expect(emailInput).toHaveAttribute('aria-describedby', 'forgot-email-error')
      })
    })

    it('has accessible loading state on button', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(submitButton).toHaveAttribute('aria-label', 'Sending reset link…')
      })
    })
  })

  describe('Confirmation screen', () => {
    it('shows back to sign in link', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        const backLink = screen.getByText(/back to sign in/i)
        expect(backLink).toBeInTheDocument()
        expect(backLink.closest('a')).toHaveAttribute('href', '/auth/login')
      })
    })

    it('displays expiration information', async () => {
      vi.mocked(supabase.auth.resetPasswordForEmail).mockResolvedValue({ error: null } as any)
      
      renderWithRouter()
      
      const submitButton = screen.getByRole('button', { name: /send reset link/i })
      
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/expire in 1 hour/i)).toBeInTheDocument()
        expect(screen.getByText(/check your spam folder/i)).toBeInTheDocument()
      })
    })
  })
})
