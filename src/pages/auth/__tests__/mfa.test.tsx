import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MfaPage from '@/pages/auth/mfa'
import { useAuthStore, type Profile } from '@/stores/auth-store'
import type { Session } from '@supabase/supabase-js'

const mockListFactors = vi.fn()
const mockChallengeAndVerify = vi.fn()
const mockEnroll = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: (...args: unknown[]) => mockListFactors(...args),
        challengeAndVerify: (...args: unknown[]) => mockChallengeAndVerify(...args),
        enroll: (...args: unknown[]) => mockEnroll(...args),
      },
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn(),
    },
  },
}))

describe('MFA Page Browser & Security Flow Tests', () => {
  const sampleAdminSession = {
    access_token: 'tk-admin',
    user: { id: 'admin-1', email: 'admin@kingdomdash.net', email_confirmed_at: '2026-09-01T00:00:00Z' },
  } as unknown as Session

  const adminProfile: Profile = {
    id: 'admin-1',
    email: 'admin@kingdomdash.net',
    full_name: 'Admin User',
    phone: null,
    avatar_url: null,
    role: 'admin',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: sampleAdminSession,
      profile: adminProfile,
      mfaLevel: 'aal1',
      isLoading: false,
    })
    mockListFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'factor-123', factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    })
    mockChallengeAndVerify.mockResolvedValue({ data: {}, error: null })
  })

  function renderMfaPage(initialEntry = '/auth/mfa?redirect=/admin') {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/auth/mfa" element={<MfaPage />} />
          <Route path="/admin" element={<div>Admin Console Home</div>} />
          <Route path="/admin/riders" element={<div>Admin Riders Management</div>} />
          <Route path="/auth/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('renders Two-Factor Challenge view when user has a verified TOTP factor', async () => {
    renderMfaPage()

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Challenge')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /verify & enter/i })).toBeInTheDocument()
    })
  })

  it('disables submit button on short code and validates code length on submit', async () => {
    renderMfaPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123' } })

    const submitBtn = screen.getByRole('button', { name: /verify & enter/i })
    expect(submitBtn).toBeDisabled()

    // Submitting form directly triggers validation
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid 6-digit verification code')).toBeInTheDocument()
    })
    expect(mockChallengeAndVerify).not.toHaveBeenCalled()
  })

  it('handles invalid TOTP code error from Supabase API gracefully', async () => {
    mockChallengeAndVerify.mockResolvedValueOnce({
      error: { message: 'Invalid verification code' },
    })

    renderMfaPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '999999' } })

    const submitBtn = screen.getByRole('button', { name: /verify & enter/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Invalid verification code')).toBeInTheDocument()
    })
    expect(mockChallengeAndVerify).toHaveBeenCalledWith({
      factorId: 'factor-123',
      code: '999999',
    })
  })

  it('successfully verifies valid TOTP, upgrades mfaLevel to aal2, and navigates to target', async () => {
    renderMfaPage('/auth/mfa?redirect=/admin/riders')

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123456' } })

    const submitBtn = screen.getByRole('button', { name: /verify & enter/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(useAuthStore.getState().mfaLevel).toBe('aal2')
      expect(screen.getByText('Admin Riders Management')).toBeInTheDocument()
    })
  })

  it('neutralizes open redirect query parameter and defaults to /admin', async () => {
    renderMfaPage('/auth/mfa?redirect=https://evil-attacker.com')

    await waitFor(() => {
      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123456' } })

    const submitBtn = screen.getByRole('button', { name: /verify & enter/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(useAuthStore.getState().mfaLevel).toBe('aal2')
      // Navigates safely to /admin instead of evil-attacker.com
      expect(screen.getByText('Admin Console Home')).toBeInTheDocument()
    })
  })

  it('renders enrollment view with QR code setup when no verified factor exists', async () => {
    mockListFactors.mockResolvedValueOnce({
      data: { totp: [] },
      error: null,
    })
    mockEnroll.mockResolvedValueOnce({
      data: {
        id: 'new-factor-456',
        totp: {
          qr_code: 'data:image/svg+xml;base64,mockqr',
          secret: 'JBSWY3DPEHPK3PXP',
        },
      },
      error: null,
    })

    renderMfaPage()

    await waitFor(() => {
      expect(screen.getByText('Setup Authenticator')).toBeInTheDocument()
      expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    })
  })
})
