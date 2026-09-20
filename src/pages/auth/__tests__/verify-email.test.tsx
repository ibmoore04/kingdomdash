import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import VerifyEmailPage from '../verify-email'
import { useAuthStore, type Profile } from '@/stores/auth-store'

const mockResend = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      resend: (...args: unknown[]) => mockResend(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: () => mockSignOut(),
    },
    from: vi.fn(),
  },
}))

describe('VerifyEmailPage tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: false,
      isEmailConfirmed: false,
      signOut: mockSignOut,
    })
    mockResend.mockResolvedValue({ error: null })
    mockSignOut.mockResolvedValue(undefined)
  })

  function renderVerifyEmailPage(initialPath = '/auth/verify-email?email=newuser@example.com') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<div>Public Homepage</div>} />
          <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/login" element={<div>Login Page</div>} />
          <Route path="/dashboard" element={<div>Customer Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('renders branded verification UI with email address from query param', () => {
    renderVerifyEmailPage('/auth/verify-email?email=test.applicant@kingdomdash.com')

    expect(screen.getByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(screen.getByText('test.applicant@kingdomdash.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /use a different account/i })).toBeInTheDocument()
  })

  it('renders session email if query parameter is omitted', () => {
    useAuthStore.setState({
      session: {
        user: { id: 'usr-unconfirmed', email: 'session.user@kingdomdash.com', email_confirmed_at: null },
      } as unknown as Session,
      isEmailConfirmed: false,
    })

    renderVerifyEmailPage('/auth/verify-email')
    expect(screen.getByText('session.user@kingdomdash.com')).toBeInTheDocument()
  })

  it('calls supabase.auth.resend with type=signup and starts 60s cooldown', async () => {
    renderVerifyEmailPage('/auth/verify-email?email=resend.me@example.com')

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i })
    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(mockResend).toHaveBeenCalledTimes(1)
      expect(mockResend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'resend.me@example.com',
      })
      expect(screen.getByText(/verification email resent successfully/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /resend available in/i })).toBeDisabled()
    })
  })

  it('handles resend error gracefully and displays error alert', async () => {
    mockResend.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded. Try again later.' },
    })

    renderVerifyEmailPage('/auth/verify-email?email=error.resend@example.com')

    const resendBtn = screen.getByRole('button', { name: /resend verification email/i })
    fireEvent.click(resendBtn)

    await waitFor(() => {
      expect(screen.getByText('Email rate limit exceeded. Try again later.')).toBeInTheDocument()
    })
  })

  it('signs out and navigates to login when clicking "Use a different account"', async () => {
    renderVerifyEmailPage('/auth/verify-email?email=switch.account@example.com')

    const switchBtn = screen.getByRole('button', { name: /use a different account/i })
    fireEvent.click(switchBtn)

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  it('redirects already confirmed user to dashboard', async () => {
    const confirmedCustomer: Profile = {
      id: 'usr-confirmed',
      email: 'confirmed@example.com',
      full_name: 'Confirmed User',
      phone: null,
      avatar_url: null,
      role: 'customer',
      is_active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }

    useAuthStore.setState({
      session: {
        user: { id: 'usr-confirmed', email: 'confirmed@example.com', email_confirmed_at: '2026-09-15T00:00:00Z' },
      } as unknown as Session,
      profile: confirmedCustomer,
      isEmailConfirmed: true,
    })

    renderVerifyEmailPage('/auth/verify-email')

    await waitFor(() => {
      expect(screen.getByText('Public Homepage')).toBeInTheDocument()
    })
  })
})
