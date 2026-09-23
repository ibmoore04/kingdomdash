import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import * as vendorService from '@/services/supabase/vendors'
import * as productService from '@/services/supabase/products'
import * as categoryService from '@/services/supabase/categories'
import type { Vendor, Product, Category } from '@/types'

vi.mock('@/services/supabase/vendors')
vi.mock('@/services/supabase/products')
vi.mock('@/services/supabase/categories')

const activeRestaurant: Vendor = {
  id: 'restaurant-1',
  profile_id: 'profile-1',
  business_name: 'Mama Shade Kitchen',
  business_type: 'restaurant',
  business_description: 'Best amala and goat meat in Degun',
  business_address: '12 Degun Street, Ijebu-Ode',
  phone: '08012345678',
  email: 'shade@example.com',
  logo_url: null,
  cover_image_url: null,
  operating_hours: '9:00 AM - 8:00 PM',
  service_area: 'Degun, Ijebu-Ode',
  latitude: null,
  longitude: null,
  service_area_id: null,
  is_active: true,
  rating: 4.9,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const activeGroceryStore: Vendor = {
  id: 'store-1',
  profile_id: 'profile-2',
  business_name: 'Ijebu Fresh Mart',
  business_type: 'grocery_store',
  business_description: 'Fresh farm fruits, vegetables, and pantry grains',
  business_address: '50 Awujale Way, Ijebu-Ode',
  phone: '08098765432',
  email: 'freshmart@example.com',
  logo_url: null,
  cover_image_url: null,
  operating_hours: '8:00 AM - 9:00 PM',
  service_area: 'Awujale, Ijebu-Ode',
  latitude: null,
  longitude: null,
  service_area_id: null,
  is_active: true,
  rating: 4.7,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

const activeProducts: Product[] = [
  {
    id: 'prod-1',
    vendor_id: 'restaurant-1',
    category_id: 'cat-1',
    name: 'Amala with Ewedu and Gbegiri',
    description: 'Fresh piping hot amala with assorted goat meat',
    price: 3200,
    image_url: null,
    is_available: true,
    display_order: 1,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

const activeCategories: Category[] = [
  {
    id: 'cat-1',
    vendor_id: 'restaurant-1',
    name: 'Local Classics',
    description: 'Authentic swallows and soups',
    reference_category_id: null,
    service_type: 'food',
    display_order: 1,
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
]

function renderWithProviders(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe('Public Catalog Supabase Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(vendorService.getVendorsByService).mockImplementation(async (service) => {
      if (service === 'food') {
        return { data: [activeRestaurant], error: null } as never
      }
      if (service === 'grocery') {
        return { data: [activeGroceryStore], error: null } as never
      }
      return { data: [], error: null } as never
    })
    vi.mocked(vendorService.getVendorsByType).mockImplementation(async (type) => {
      if (type === 'restaurant') {
        return { data: [activeRestaurant], error: null } as never
      }
      if (type === 'grocery_store') {
        return { data: [activeGroceryStore], error: null } as never
      }
      return { data: [], error: null } as never
    })
  })

  // ── 1. Food Delivery Page ───────────────────────────────────────────────────
  describe('Food Page (/food)', () => {
    it('fetches and displays active restaurants from Supabase', async () => {
      vi.mocked(vendorService.getVendorsByType).mockResolvedValueOnce({
        data: [activeRestaurant],
        error: null,
      } as never)

      renderWithProviders('/food')

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      await waitFor(() => {
        expect(screen.getByText('Mama Shade Kitchen')).toBeInTheDocument()
      }, { timeout: 10000 })

      expect(screen.getByText(/Best amala and goat meat in Degun/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view menu/i })).toHaveAttribute(
        'href',
        '/food/restaurant-1'
      )
    })

    it('renders welcoming empty state when no active restaurants exist yet', async () => {
      vi.mocked(vendorService.getVendorsByService).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never)
      vi.mocked(vendorService.getVendorsByType).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never)

      renderWithProviders('/food')

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      await waitFor(() => {
        expect(screen.getByText(/Partner Kitchens Launching Soon/i)).toBeInTheDocument()
      }, { timeout: 10000 })
    })
  })

  // ── 2. Groceries Page ───────────────────────────────────────────────────────
  describe('Groceries Page (/groceries)', () => {
    it('fetches and displays active grocery stores from Supabase', async () => {
      vi.mocked(vendorService.getVendorsByService).mockResolvedValueOnce({
        data: [activeGroceryStore],
        error: null,
      } as never)
      vi.mocked(vendorService.getVendorsByType).mockResolvedValueOnce({
        data: [activeGroceryStore],
        error: null,
      } as never)

      renderWithProviders('/groceries')

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      }, { timeout: 10000 })

      await waitFor(() => {
        expect(screen.getByText('Ijebu Fresh Mart')).toBeInTheDocument()
      }, { timeout: 10000 })

      expect(screen.getByRole('link', { name: /shop items/i })).toHaveAttribute(
        'href',
        '/groceries/store-1'
      )
    })
  })

  // ── 3. Restaurant Detail Page ───────────────────────────────────────────────
  describe('Food Detail Page (/food/:vendorId)', () => {
    it('fetches vendor details, categories, and available products', async () => {
      vi.mocked(vendorService.getVendorById).mockResolvedValueOnce({
        data: activeRestaurant,
        error: null,
      } as never)
      vi.mocked(productService.getAvailableProducts).mockResolvedValueOnce({
        data: activeProducts,
        error: null,
      } as never)
      vi.mocked(categoryService.getVendorCategories).mockResolvedValueOnce({
        data: activeCategories,
        error: null,
      } as never)

      renderWithProviders('/food/restaurant-1')

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Mama Shade Kitchen' })).toBeInTheDocument()
      }, { timeout: 5000 })

      expect(screen.getByText('Local Classics')).toBeInTheDocument()
      expect(screen.getByText('Amala with Ewedu and Gbegiri')).toBeInTheDocument()
      expect(screen.getByText(/3,200/)).toBeInTheDocument()
    })

    it('renders 404 error state when vendor does not exist or is inactive', async () => {
      vi.mocked(vendorService.getVendorById).mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      } as never)

      renderWithProviders('/food/non-existent-vendor')

      await waitFor(() => {
        expect(screen.getByText('Restaurant not found')).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  // ── 4. Grocery Detail Page ──────────────────────────────────────────────────
  describe('Grocery Detail Page (/groceries/:storeId)', () => {
    it('fetches store details and available products', async () => {
      vi.mocked(vendorService.getVendorById).mockResolvedValueOnce({
        data: activeGroceryStore,
        error: null,
      } as never)
      vi.mocked(productService.getAvailableProducts).mockResolvedValueOnce({
        data: [
          {
            id: 'grocery-1',
            vendor_id: 'store-1',
            category_id: null,
            name: 'Fresh Tomatoes (1kg Basket)',
            description: 'Ripe red farm tomatoes from Ogun farmers',
            price: 1800,
            image_url: null,
            is_available: true,
            display_order: 1,
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
          },
        ],
        error: null,
      } as never)
      vi.mocked(categoryService.getVendorCategories).mockResolvedValueOnce({
        data: [],
        error: null,
      } as never)

      renderWithProviders('/groceries/store-1')

      await waitFor(() => {
        expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
      }, { timeout: 8000 })

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Ijebu Fresh Mart' })).toBeInTheDocument()
      }, { timeout: 8000 })

      expect(screen.getByText('Fresh Tomatoes (1kg Basket)')).toBeInTheDocument()
      expect(screen.getByText(/1,800/)).toBeInTheDocument()
    })
  })
})
