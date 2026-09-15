import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { RouteGuard } from '@/components/auth/route-guard'
import { useAuthStore, type Profile } from '@/stores/auth-store'

describe('Phase 6 Route & RBAC Protection', () => {
  const sampleSession = {
    access_token: 'tk',
    user: { id: 'usr-1', email: 'test@example.com' },
  } as Session

  const customerProfile: Profile = {
    id: 'usr-1',
    email: 'customer@kingdomdash.com',
    full_name: 'Customer One',
    phone: null,
    avatar_url: null,
    role: 'customer',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  const vendorProfile: Profile = {
    id: 'usr-2',
    email: 'vendor@kingdomdash.com',
    full_name: 'Vendor One',
    phone: null,
    avatar_url: null,
    role: 'vendor',
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({
      session: null,
      profile: null,
      isLoading: false,
      isRecoverySession: false,
      profileError: null,
    })
  })

  function renderPhase6App(initialPath: string) {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/auth/login" element={<div>Login Page</div>} />
          <Route path="/vendor" element={<div>Vendor Dashboard</div>} />
          <Route path="/cart" element={<div>Public Cart Page</div>} />

          {/* Protected Customer Routes */}
          <Route element={<RouteGuard allowedRoles={['customer']} />}>
            <Route path="/checkout" element={<div>Customer Checkout Page</div>} />
            <Route path="/order/:orderId/confirmation" element={<div>Order Confirmation Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  it('allows unauthenticated guest to access /cart', () => {
    renderPhase6App('/cart')
    expect(screen.getByText('Public Cart Page')).toBeDefined()
  })

  it('redirects unauthenticated guest accessing /checkout to login with encoded redirect', () => {
    renderPhase6App('/checkout')
    expect(screen.getByText('Login Page')).toBeDefined()
    expect(screen.queryByText('Customer Checkout Page')).toBeNull()
  })

  it('redirects unauthenticated guest accessing /order/:orderId/confirmation to login', () => {
    renderPhase6App('/order/order-xyz/confirmation')
    expect(screen.getByText('Login Page')).toBeDefined()
    expect(screen.queryByText('Order Confirmation Page')).toBeNull()
  })

  it('allows customer role to access /checkout and order confirmation', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: customerProfile,
    })

    const { unmount } = renderPhase6App('/checkout')
    expect(screen.getByText('Customer Checkout Page')).toBeDefined()
    unmount()

    renderPhase6App('/order/order-xyz/confirmation')
    expect(screen.getByText('Order Confirmation Page')).toBeDefined()
  })

  it('redirects non-customer role (e.g. vendor) accessing /checkout to their own dashboard', () => {
    useAuthStore.setState({
      session: sampleSession,
      profile: vendorProfile,
    })

    renderPhase6App('/checkout')
    expect(screen.getByText('Vendor Dashboard')).toBeDefined()
    expect(screen.queryByText('Customer Checkout Page')).toBeNull()
  })
})
