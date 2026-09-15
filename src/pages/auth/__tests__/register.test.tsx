import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import RegisterPage from '@/pages/auth/register'
import { supabase } from '@/services/supabase/client'
import * as fc from 'fast-check'

// Mock Supabase
vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}))

// Mock app config
vi.mock('@/config/app.config', () => ({
  appConfig: {
    url: 'https://kingdomdash.com',
  },
}))

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWithRouter = () => {
    return render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    )
  }

  describe('Client-side validation', () => {
    it('rejects empty full name', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: '' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Full name is required')).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('rejects invalid email format', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'invalid-email' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('rejects empty phone number', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/phone number is required/i)).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('rejects invalid phone number characters', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '0803abcd567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/only numbers/i)).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('rejects password shorter than 8 characters (P2)', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'short' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'short' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })

    it('rejects mismatched password confirmation', async () => {
      renderWithRouter()
      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      })
      expect(supabase.auth.signUp).not.toHaveBeenCalled()
    })
  })

  describe('P2: Property-based test for short passwords', () => {
    it('never calls signUp for passwords of length 0-7', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 7 }), (shortPassword) => {
          cleanup()
          vi.clearAllMocks()
          renderWithRouter()

          const submitButton = screen.getByRole('button', { name: /create account/i })

          fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
          fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
          fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
          fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: shortPassword } })
          fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: shortPassword } })

          fireEvent.click(submitButton)

          // signUp should never be called for short passwords
          expect(supabase.auth.signUp).not.toHaveBeenCalled()

          cleanup()
        }),
        { numRuns: 20 }
      )
    }, 60000)
  })

  describe('P1: Signup metadata & account intent security', () => {
    it('normalizes Nigerian phone and defaults to customer account intent', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as any)

      renderWithRouter()

      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '0803 123 4567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
          options: {
            data: {
              full_name: 'John Doe',
              phone: '+2348031234567',
              account_type: 'customer',
            },
            emailRedirectTo: 'https://kingdomdash.com/auth/callback',
          },
        })
      })

      // Invariant: Never contains privileged role properties
      const signUpCall = vi.mocked(supabase.auth.signUp).mock.calls[0]
      const metadata = signUpCall[0].options?.data

      expect(metadata).not.toHaveProperty('role')
      expect(metadata).not.toHaveProperty('is_active')
      expect(metadata).not.toHaveProperty('is_admin')
      expect(metadata).not.toHaveProperty('is_rider')
      expect(metadata).not.toHaveProperty('is_vendor')
    })

    it('allows selecting Rider intent and passes account_type: rider without privileged role', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as any)

      renderWithRouter()

      // Select Rider option
      const riderOption = screen.getByRole('radio', { name: /rider/i })
      fireEvent.click(riderOption)

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Rider Smith' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'rider@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '09012345678' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'rider@example.com',
          password: 'password123',
          options: {
            data: {
              full_name: 'Rider Smith',
              phone: '+2349012345678',
              account_type: 'rider',
            },
            emailRedirectTo: 'https://kingdomdash.com/auth/callback',
          },
        })
      })

      // Invariant: Rider intent must NEVER set role
      const signUpCall = vi.mocked(supabase.auth.signUp).mock.calls[0]
      const metadata = signUpCall[0].options?.data as Record<string, unknown> | undefined
      expect(metadata).not.toHaveProperty('role')
      expect(metadata?.account_type).toBe('rider')

      // Rider-specific application confirmation is shown
      await waitFor(() => {
        expect(screen.getByText('Application Submitted')).toBeInTheDocument()
        expect(screen.getByText(/Your Rider application has been submitted/i)).toBeInTheDocument()
      })
    })

    it('allows selecting Vendor intent and displays Vendor confirmation screen', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({ error: null } as any)

      renderWithRouter()

      // Select Vendor option
      const vendorOption = screen.getByRole('radio', { name: /vendor/i })
      fireEvent.click(vendorOption)

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Vendor Chief' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'vendor@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '07081234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(supabase.auth.signUp).toHaveBeenCalledWith({
          email: 'vendor@example.com',
          password: 'password123',
          options: {
            data: {
              full_name: 'Vendor Chief',
              phone: '+2347081234567',
              account_type: 'vendor',
            },
            emailRedirectTo: 'https://kingdomdash.com/auth/callback',
          },
        })
      })

      await waitFor(() => {
        expect(screen.getByText('Application Submitted')).toBeInTheDocument()
        expect(screen.getByText(/Your Vendor application has been submitted/i)).toBeInTheDocument()
      })
    })
  })

  describe('P3: Safe error messages', () => {
    it('displays user-friendly error for duplicate email (P3)', async () => {
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        error: { message: 'User already registered' } as any,
      } as any)

      renderWithRouter()

      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'existing@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('An account with this email already exists.')).toBeInTheDocument()
      })
    })

    it('displays generic error for unexpected errors (P3)', async () => {
      vi.mocked(supabase.auth.signUp).mockRejectedValue(new Error('Network error'))

      renderWithRouter()

      const submitButton = screen.getByRole('button', { name: /create account/i })

      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'John Doe' } })
      fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '08031234567' } })
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } })

      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Sign up failed. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('P15: Accessibility', () => {
    it('has password visibility toggle with dynamic aria-label', () => {
      renderWithRouter()

      const passwordInput = screen.getByLabelText(/^password$/i)
      const toggleButton = screen.getByLabelText('Show password')

      expect(toggleButton).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'password')

      fireEvent.click(toggleButton)

      const hideButton = screen.getByLabelText('Hide password')
      expect(hideButton).toBeInTheDocument()
      expect(passwordInput).toHaveAttribute('type', 'text')
    })

    it('has form with aria-label', () => {
      renderWithRouter()
      const form = screen.getByRole('form', { name: /create your account/i })
      expect(form).toBeInTheDocument()
    })

    it('renders account type radiogroup with accessible roles', () => {
      renderWithRouter()
      const radiogroup = screen.getByRole('radiogroup', { name: /what would you like to do on kingdomdash\?/i })
      expect(radiogroup).toBeInTheDocument()

      const radios = screen.getAllByRole('radio')
      expect(radios).toHaveLength(3)
    })
  })
})
