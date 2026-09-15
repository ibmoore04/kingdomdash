import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import App from '@/App'
import { useAuthStore, type Profile } from '@/stores/auth-store'
import * as vendorService from '@/services/supabase/vendors'
import * as categoryService from '@/services/supabase/categories'
import * as productService from '@/services/supabase/products'
import type { Category, Product, Vendor } from '@/types'

vi.mock('@/services/supabase/vendors')
vi.mock('@/services/supabase/categories')
vi.mock('@/services/supabase/products')
vi.mock('@/services/supabase/notifications', () => ({
  getMyNotifications: vi.fn().mockResolvedValue({ data: [], error: null }),
  markNotificationRead: vi.fn().mockResolvedValue({ data: true, error: null }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ count: 0, error: null }),
  clearReadNotifications: vi.fn().mockResolvedValue({ count: 0, error: null }),
  getUnreadNotificationCount: vi.fn().mockResolvedValue({ count: 0, error: null }),
  subscribeToMyNotifications: vi.fn().mockReturnValue(() => {}),
  getNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
  updateNotificationPreferences: vi.fn().mockResolvedValue({ data: null, error: null }),
}))
vi.mock('@/services/rider/rider-service', () => ({
  getRiderOperationalProfile: vi.fn().mockResolvedValue({
    data: {
      id: 'rider-1',
      profile_id: 'user-rider-1',
      full_name: 'Rider Segun',
      phone: '08055443322',
      vehicle_type: 'motorcycle',
      is_available: true,
      is_verified: true,
      is_active: true,
      rating: 5.0,
      total_deliveries: 10,
      created_at: '2026-09-01T00:00:00Z',
    },
    error: null,
  }),
  updateRiderAvailability: vi.fn().mockResolvedValue({ success: true, error: null }),
}))
vi.mock('@/services/rider/assignment-service', () => ({
  getRiderAssignmentInbox: vi.fn().mockResolvedValue({ data: [], error: null }),
  acceptDeliveryAssignment: vi.fn().mockResolvedValue({ success: true, error: null }),
  rejectDeliveryAssignment: vi.fn().mockResolvedValue({ success: true, error: null }),
}))
vi.mock('@/services/rider/custody-service', () => ({
  getRiderActiveDelivery: vi.fn().mockResolvedValue({ data: null, error: null }),
  markDeliveryPickedUp: vi.fn().mockResolvedValue({ success: true, error: null }),
  markDeliveryInTransit: vi.fn().mockResolvedValue({ success: true, error: null }),
  markDeliveryDelivered: vi.fn().mockResolvedValue({ success: true, error: null }),
}))

const mockSession = {
  access_token: 'fake-token',
  user: { id: 'user-vendor-1', email: 'vendor@example.com' },
} as Session

const mockVendorProfile: Profile = {
  id: 'user-vendor-1',
  email: 'vendor@example.com',
  full_name: 'Chef Adeleke',
  phone: '08011223344',
  avatar_url: null,
  role: 'vendor',
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const mockCustomerProfile: Profile = {
  id: 'user-customer-1',
  email: 'customer@example.com',
  full_name: 'Customer Bayo',
  phone: '08099887766',
  avatar_url: null,
  role: 'customer',
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const mockRiderProfile: Profile = {
  id: 'user-rider-1',
  email: 'rider@example.com',
  full_name: 'Rider Segun',
  phone: '08055443322',
  avatar_url: null,
  role: 'rider',
  is_active: true,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const mockVendorData: Vendor = {
  id: 'vendor-uuid-1',
  profile_id: 'user-vendor-1',
  business_name: 'Ijebu Royal Kitchen',
  business_type: 'restaurant',
  business_description: 'Authentic local cuisine in Molipa',
  business_address: '15 Molipa Expressway, Ijebu-Ode',
  phone: '08011223344',
  email: 'vendor@example.com',
  logo_url: null,
  cover_image_url: null,
  operating_hours: '8:00 AM - 9:00 PM',
  service_area: 'Molipa, Ijebu-Ode',
  latitude: null,
  longitude: null,
  service_area_id: null,
  is_active: true,
  rating: 4.8,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const mockCategoriesData: Category[] = [
  {
    id: 'cat-1',
    vendor_id: 'vendor-uuid-1',
    name: 'Rice Dishes',
    description: 'Jollof, Fried Rice, White Rice',
    reference_category_id: null,
    service_type: 'food',
    display_order: 1,
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

const mockProductsData: Product[] = [
  {
    id: 'prod-1',
    vendor_id: 'vendor-uuid-1',
    category_id: 'cat-1',
    name: 'Party Jollof Rice',
    description: 'Smoky firewood jollof rice served with chicken',
    price: 3500,
    image_url: null,
    is_available: true,
    display_order: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

describe('Vendor Dashboard & RBAC Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(vendorService.getVendorByProfileId).mockResolvedValue({
      data: mockVendorData,
      error: null,
    } as never)

    vi.mocked(categoryService.getVendorCategories).mockResolvedValue({
      data: mockCategoriesData,
      error: null,
    } as never)

    vi.mocked(categoryService.getReferenceCategories).mockResolvedValue({
      data: [],
      error: null,
    } as never)

    vi.mocked(productService.getVendorProducts).mockResolvedValue({
      data: mockProductsData,
      error: null,
    } as never)
  })

  // ── 1. RBAC & Route Protection ──────────────────────────────────────────────
  describe('RBAC & Route Protection', () => {
    it('redirects unauthenticated visitor to /auth/login with redirect query param', async () => {
      useAuthStore.setState({
        session: null,
        profile: null,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })

      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('redirects customer role away from /vendor to /dashboard', async () => {
      useAuthStore.setState({
        session: mockSession,
        profile: mockCustomerProfile,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })

      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /customer dashboard/i })).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('redirects rider role away from /vendor to /rider', async () => {
      useAuthStore.setState({
        session: mockSession,
        profile: mockRiderProfile,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })

      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /rider dashboard/i })).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('allows vendor role to access /vendor dashboard', async () => {
      useAuthStore.setState({
        session: mockSession,
        profile: mockVendorProfile,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })

      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      await waitFor(() => {
        expect(screen.getAllByText('Ijebu Royal Kitchen').length).toBeGreaterThan(0)
      }, { timeout: 10000 })
    })
  })

  // ── 2. Pending Vendor State ──────────────────────────────────────────────────
  describe('Pending Onboarding State', () => {
    it('renders VendorPendingView when vendor record is not yet active or created', async () => {
      vi.mocked(vendorService.getVendorByProfileId).mockResolvedValueOnce({
        data: null,
        error: null,
      } as never)

      useAuthStore.setState({
        session: mockSession,
        profile: mockVendorProfile,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })

      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getByText(/Vendor Account Awaiting Activation/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  // ── 3. Vendor Dashboard Tabs & Catalog Actions ───────────────────────────────
  describe('Dashboard Tabs & Catalog Management', () => {
    beforeEach(() => {
      vi.mocked(vendorService.getVendorByProfileId).mockResolvedValue({
        data: mockVendorData,
        error: null,
      } as never)

      useAuthStore.setState({
        session: mockSession,
        profile: mockVendorProfile,
        isLoading: false,
        isRecoverySession: false,
        profileError: null,
      })
    })

    it('renders overview with KPIs and switches to Products tab', async () => {
      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText('Ijebu Royal Kitchen').length).toBeGreaterThan(0)
      }, { timeout: 5000 })

      // Check overview KPIs
      expect(screen.getByText('Total Products')).toBeInTheDocument()
      expect(screen.getAllByText('In Stock').length).toBeGreaterThan(0)

      // Switch to Products tab via sidebar button
      const productsTabButtons = screen.getAllByRole('button', { name: /products & menu/i })
      fireEvent.click(productsTabButtons[0])

      await waitFor(() => {
        expect(screen.getAllByText('Party Jollof Rice').length).toBeGreaterThan(0)
      })
    })

    it('switches to Categories tab and allows adding a category', async () => {
      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText('Ijebu Royal Kitchen').length).toBeGreaterThan(0)
      })

      const categoriesTabButtons = screen.getAllByRole('button', { name: /categories/i })
      fireEvent.click(categoriesTabButtons[0])

      await waitFor(() => {
        expect(screen.getByText('Rice Dishes')).toBeInTheDocument()
      })

      // Click Add Category
      const addCategoryButton = screen.getByRole('button', { name: /add category/i })
      fireEvent.click(addCategoryButton)

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /create category/i })).toBeInTheDocument()
      })
    })

    it('switches to Business Profile tab and shows store details', async () => {
      render(
        <MemoryRouter initialEntries={['/vendor']}>
          <App />
        </MemoryRouter>
      )

      await waitFor(() => {
        expect(screen.getAllByText('Ijebu Royal Kitchen').length).toBeGreaterThan(0)
      })

      const profileTabButtons = screen.getAllByRole('button', { name: /business profile/i })
      fireEvent.click(profileTabButtons[0])

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /store identity & verification/i })).toBeInTheDocument()
        expect(screen.getByDisplayValue('08011223344')).toBeInTheDocument()
      })
    })
  })
})
