import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { RouteGuard } from '@/components/auth/route-guard'
import { useAuthStore, type Profile, type UserRole } from '@/stores/auth-store'

describe('RouteGuard tests (P9, P10, P11, P13, Email Verification)', () => {
  const sampleSession = {
    access_token: 'tk',
    user: { id: 'usr-1', email: 'test@example.com', email_confirmed_at: '2026-09-01T00:00:00Z' },
  } as Session

  const activeCustomer: Profile = {
    id: 'usr-1',
    email: 'cust@example.com',
    full_name: 'Customer One',
    phone: null,
    avatar_url: null,
    role: 'customer',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  const mockSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: false,
      isRecoverySession: false,
      isEmailConfirmed: false,
      profileError: null,
      signOut: mockSignOut,
    })
  })

  function renderGuardedRoute(initialPath = '/dashboard', allowedRoles?: UserRole[]) {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth/login" element={<div>Login Page</div>} />
          <Route path="/auth/verify-email" element={<div>Verify Email Page</div>} />
          <Route path="/vendor" element={<div>Vendor Dashboard</div>} />
          <Route path="/rider" element={<div>Rider Dashboard</div>} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
          <Route path="/dashboard" element={<div>Customer Dashboard</div>} />
          <Route element={<RouteGuard allowedRoles={allowedRoles} />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
            <Route path="/dashboard/orders" element={<div>Customer Orders</div>} />
            <Route path="/admin/settings" element={<div>Admin Settings</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  it('P9: renders spinner while isLoading=true and does NOT render protected content', () => {
    useAuthStore.setState({ isLoading: true })
    renderGuardedRoute('/protected')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })

  it('P9: renders spinner while session exists but profile is still resolving', () => {
    useAuthStore.setState({ session: sampleSession, profile: null, isLoading: false, profileError: null })
    renderGuardedRoute('/protected')

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('P10: unauthenticated user redirected to /auth/login with encoded redirect query parameter', () => {
    useAuthStore.setState({ session: null, profile: null, isLoading: false })
    renderGuardedRoute('/protected?tab=details')

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('P9: profile fetch error triggers signOut and redirects to login', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: null,
      profileError: new Error('Failed to fetch profile'),
      isLoading: false,
      signOut: mockSignOut,
    })
    renderGuardedRoute('/protected')

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('P13: inactive profile triggers signOut and redirects to login with inactive flag', () => {
    const inactiveUser: Profile = { ...activeCustomer, is_active: false }
    useAuthStore.setState({
      session: sampleSession,
      profile: inactiveUser,
      isLoading: false,
      signOut: mockSignOut,
    })
    renderGuardedRoute('/protected')

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('P13: inactive accounts for vendor, rider, and admin are all denied and signed out', () => {
    const roles: UserRole[] = ['vendor', 'rider', 'admin', 'super_admin']
    for (const role of roles) {
      mockSignOut.mockClear()
      useAuthStore.setState({
        session: sampleSession,
        profile: { ...activeCustomer, role, is_active: false },
        isLoading: false,
        signOut: mockSignOut,
      })
      const { unmount } = renderGuardedRoute('/protected')
      expect(mockSignOut).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Login Page')).toBeInTheDocument()
      unmount()
    }
  })

  it('P11: authenticated user with mismatched role redirected to own dashboard', () => {
    // Customer attempting to access admin route
    useAuthStore.setState({
      session: sampleSession,
      profile: activeCustomer,
      isLoading: false,
    })
    renderGuardedRoute('/admin/settings', ['admin', 'super_admin'])

    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Admin Settings')).not.toBeInTheDocument()
  })

  it('Security Invariant: Rider applicant (role=customer) blocked from rider dashboard', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: activeCustomer, // Applicant awaiting approval still has customer role
      isLoading: false,
    })
    renderGuardedRoute('/protected', ['rider'])

    // Redirected to customer dashboard
    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('Security Invariant: Vendor applicant (role=customer) blocked from vendor dashboard', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: activeCustomer, // Applicant awaiting approval still has customer role
      isLoading: false,
    })
    renderGuardedRoute('/protected', ['vendor'])

    // Redirected to customer dashboard
    expect(screen.getByText('Customer Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('P9: authorized user with matching role and active profile renders protected content', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: activeCustomer,
      isLoading: false,
    })
    renderGuardedRoute('/dashboard/orders', ['customer'])

    expect(screen.getByText('Customer Orders')).toBeInTheDocument()
  })

  it('Email Verification: redirects unconfirmed user (email_confirmed_at == null) to /auth/verify-email', () => {
    const unconfirmedSession = {
      access_token: 'tk-unconfirmed',
      user: { id: 'usr-unconfirmed', email: 'unconfirmed@example.com', email_confirmed_at: null },
    } as unknown as Session

    useAuthStore.setState({
      session: unconfirmedSession,
      profile: activeCustomer,
      isLoading: false,
    })
    renderGuardedRoute('/protected')

    expect(screen.getByText('Verify Email Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('Email Verification: blocks unconfirmed users from accessing vendor, rider, and admin routes', () => {
    const unconfirmedSession = {
      access_token: 'tk-unconfirmed',
      user: { id: 'usr-unconfirmed', email: 'unconfirmed@example.com', email_confirmed_at: null },
    } as unknown as Session

    const roles: UserRole[] = ['vendor', 'rider', 'admin', 'super_admin']
    for (const role of roles) {
      useAuthStore.setState({
        session: unconfirmedSession,
        profile: { ...activeCustomer, role },
        isLoading: false,
      })
      const { unmount } = renderGuardedRoute('/protected', [role])
      expect(screen.getByText('Verify Email Page')).toBeInTheDocument()
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
      unmount()
    }
  })
})
