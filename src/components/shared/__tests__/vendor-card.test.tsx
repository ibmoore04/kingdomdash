import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { VendorCard } from '../vendor-card'
import type { Vendor } from '@/types'

const mockFoodVendor: Vendor = {
  id: 'v-chicken-co',
  profile_id: 'p-1',
  business_name: 'Chicken & Co',
  business_type: 'restaurant',
  business_description: 'Crispy fried chicken and seasoned chips',
  business_address: '14 Ibadan Rd, Ijebu-Ode',
  phone: '08012345678',
  email: 'chicken@example.com',
  logo_url: null,
  cover_image_url: null,
  operating_hours: null,
  service_area: 'Oke-Aje, Ijebu-Ode',
  latitude: 6.82,
  longitude: 3.92,
  service_area_id: 'sa-1',
  is_active: true,
  rating: 4.9,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('VendorCard component', () => {
  it('renders rich details including name, tags, rating, delivery fee, and verified badge', () => {
    render(
      <MemoryRouter>
        <VendorCard vendor={mockFoodVendor} serviceType="food" />
      </MemoryRouter>
    )

    // Name
    expect(screen.getByText('Chicken & Co')).toBeInTheDocument()

    // Verified badge
    expect(screen.getByText('Verified')).toBeInTheDocument()

    // Popular badge
    expect(screen.getByText('Popular')).toBeInTheDocument()

    // Status
    expect(screen.getByText('Open for orders')).toBeInTheDocument()

    // Rating
    expect(screen.getByText('4.9')).toBeInTheDocument()

    // Tags
    expect(screen.getByText('Crispy Chicken')).toBeInTheDocument()

    // Delivery fee
    expect(screen.getByText(/delivery/i)).toBeInTheDocument()

    // CTA
    expect(screen.getByText('View Menu')).toBeInTheDocument()
  })

  it('links to /food/:id by default for food vendors', () => {
    render(
      <MemoryRouter>
        <VendorCard vendor={mockFoodVendor} serviceType="food" />
      </MemoryRouter>
    )

    const link = screen.getByRole('link', { name: /view menu/i })
    expect(link).toHaveAttribute('href', '/food/v-chicken-co')
  })

  it('renders grocery CTA and links to /groceries/:id for grocery vendors', () => {
    const mockGroceryStore: Vendor = {
      ...mockFoodVendor,
      id: 'g-market-square',
      business_name: 'Market Square Supermarket',
      business_type: 'grocery_store',
    }

    render(
      <MemoryRouter>
        <VendorCard vendor={mockGroceryStore} serviceType="grocery" />
      </MemoryRouter>
    )

    expect(screen.getByText('Shop Items')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /shop items/i })
    expect(link).toHaveAttribute('href', '/groceries/g-market-square')
  })
})
