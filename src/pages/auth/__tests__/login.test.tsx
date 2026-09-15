import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from '@/pages/auth/login'
import { useAuthStore, type Profile } from '@/stores/auth-store'

const mockSignInWithPassword = vi.fn()

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('LoginPage tests (P3, P4, P15)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: false,
    })
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  function renderLoginPage(initialPath = '/auth/login') {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Customer Dashboard</div>} />
          <Route path="/vendor" element={<div>Vendor Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('validates empty inputs before calling signInWithPassword', async () => {
    renderLoginPage()

    const submitBtn = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument()
      expect(screen.getByText('Password is required')).toBeInTheDocument()
    })
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('submits valid credentials to supabase.auth.signInWithPassword', async () => {
    renderLoginPage()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    })

    const submitBtn = screen.getByRole('button', { name: /login/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      })
    })
  })

  it('P3: maps invalid credentials error to safe message', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Invalid login credentials' },
    })

    renderLoginPage()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'wrong@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'badpassword' },
    })

    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.')
    })
  })

  it('P3: maps unconfirmed email error to confirmation prompt', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      error: { message: 'Email not confirmed' },
    })

    renderLoginPage()

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'unconfirmed@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    })

    fireEvent.click(screen.getByRole('button', { name: /login/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Please confirm your email before signing in.'
      )
    })
  })

  it('P15: password visibility toggle switches between password and text input', () => {
    renderLoginPage()

    const passwordInput = screen.getByLabelText(/^password/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleBtn = screen.getByLabelText('Show password')
    fireEvent.click(toggleBtn)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Hide password'))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('P4: already authenticated active user is redirected to their role dashboard on mount', () => {
    const customerProfile: Profile = {
      id: 'cust-1',
      email: 'c@example.com',
      full_name: 'Customer One',
      phone: null,
      avatar_url: null,
      role: 'customer',
      is_active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }

    useAuthStore.setState({
      session: { access_token: 'tk', user: { id: 'cust-1' } } as any,
      profile: customerProfile,
      isLoading: false,
    })

    renderLoginPage('/auth/login')

    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument()
  })

  it('P4 & P16: already authenticated user respects role-compatible redirect and blocks cross-role', () => {
    const customerProfile: Profile = {
      id: 'cust-1',
      email: 'c@example.com',
      full_name: 'Customer One',
      phone: null,
      avatar_url: null,
      role: 'customer',
      is_active: true,
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-01T00:00:00Z',
    }

    useAuthStore.setState({
      session: { access_token: 'tk', user: { id: 'cust-1' } } as any,
      profile: customerProfile,
      isLoading: false,
    })

    // Customer requesting /vendor -> blocked to /dashboard
    renderLoginPage('/auth/login?redirect=%2Fvendor')
    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument()
  })
})
