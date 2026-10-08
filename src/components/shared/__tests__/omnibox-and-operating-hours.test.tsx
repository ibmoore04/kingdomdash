import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getVendorOperatingStatus } from '@/utils/operating-hours'
import { OmniboxSearchModal } from '../omnibox-search-modal'
import { PromoHeroCarousel } from '../promo-hero-carousel'

// Mock getActiveVendors for testing isolation
vi.mock('@/services/supabase/vendors', () => ({
  getActiveVendors: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'qa-kitchen-test',
        profile_id: 'p-test',
        business_name: 'QA Kitchen & Delights',
        business_type: 'restaurant',
        business_description: 'Authentic Ijebu Ikokore and party jollof',
        business_address: 'Folagbade Street, Ijebu-Ode',
        phone: '08000000000',
        email: 'qa@example.com',
        logo_url: null,
        cover_image_url: null,
        operating_hours: '8:00 AM - 9:00 PM',
        service_area: 'Ijebu-Ode Central',
        latitude: 6.82,
        longitude: 3.92,
        service_area_id: 'sa-1',
        is_active: true,
        rating: 4.8,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ],
    error: null,
  }),
}))

describe('Phase 1: Operating Hours & Omnibox Suite', () => {
  describe('getVendorOperatingStatus engine', () => {
    it('returns closed with pre-order capability if vendor is deactivated', () => {
      const status = getVendorOperatingStatus('8:00 AM - 9:00 PM', false)
      expect(status.isOpen).toBe(false)
      expect(status.statusText).toBe('Currently Closed')
      expect(status.canPreOrder).toBe(true)
    })

    it('returns open for active vendor during daytime operating hours', () => {
      // 12:00 PM (Noon)
      const noonDate = new Date(2026, 9, 5, 12, 0, 0)
      const status = getVendorOperatingStatus('8:00 AM - 9:00 PM', true, noonDate)
      expect(status.isOpen).toBe(true)
      expect(status.isClosingSoon).toBe(false)
      expect(status.statusText).toBe('Open for orders')
    })

    it('returns closing soon countdown when within 45 minutes of closing', () => {
      // 8:30 PM (30 minutes before 9:00 PM)
      const closingDate = new Date(2026, 9, 5, 20, 30, 0)
      const status = getVendorOperatingStatus('8:00 AM - 9:00 PM', true, closingDate)
      expect(status.isOpen).toBe(true)
      expect(status.isClosingSoon).toBe(true)
      expect(status.statusText).toBe('Closing in 30m')
      expect(status.badgeVariant).toBe('warning')
    })

    it('returns closed when current time is past closing hour', () => {
      // 10:30 PM
      const lateDate = new Date(2026, 9, 5, 22, 30, 0)
      const status = getVendorOperatingStatus('8:00 AM - 9:00 PM', true, lateDate)
      expect(status.isOpen).toBe(false)
      expect(status.canPreOrder).toBe(true)
      expect(status.statusText).toBe('Closed for Today')
    })

    it('defaults to open for orders when vendor has not configured operating hours', () => {
      // Midnight
      const midnightDate = new Date(2026, 9, 5, 23, 30, 0)
      const status = getVendorOperatingStatus(null, true, midnightDate)
      expect(status.isOpen).toBe(true)
      expect(status.statusText).toBe('Open for orders')
      expect(status.badgeVariant).toBe('success')
    })

    it('returns open for orders when vendor configured 24/7 hours', () => {
      const lateDate = new Date(2026, 9, 5, 23, 45, 0)
      const status = getVendorOperatingStatus('Open 24/7', true, lateDate)
      expect(status.isOpen).toBe(true)
      expect(status.statusText).toBe('Open for orders')
      expect(status.badgeVariant).toBe('success')
    })

    it('returns open for orders for active vendor with default platform template schedule', () => {
      // 11:30 PM (after 9:00 PM)
      const lateDate = new Date(2026, 9, 5, 23, 30, 0)
      const status = getVendorOperatingStatus('8:00 AM - 9:00 PM (Mon - Sat)', true, lateDate)
      expect(status.isOpen).toBe(true)
      expect(status.statusText).toBe('Open for orders')
      expect(status.badgeVariant).toBe('success')
    })
  })

  describe('OmniboxSearchModal Component', () => {
    it('renders search input and popular suggestion tags when open', () => {
      render(
        <MemoryRouter>
          <OmniboxSearchModal isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      )

      expect(screen.getByPlaceholderText(/search dishes, restaurants/i)).toBeInTheDocument()
      expect(screen.getByText('Popular:')).toBeInTheDocument()
      expect(screen.getByText('Jollof Rice')).toBeInTheDocument()
      expect(screen.getByText('Fried Chicken')).toBeInTheDocument()
    })

    it('filters curated dishes in real time when typing a query', () => {
      render(
        <MemoryRouter>
          <OmniboxSearchModal isOpen={true} onClose={vi.fn()} />
        </MemoryRouter>
      )

      const input = screen.getByPlaceholderText(/search dishes, restaurants/i)
      fireEvent.change(input, { target: { value: 'meat pie' } })

      expect(screen.getByText(/Freshly Baked Nigerian Beef Meat Pie/i)).toBeInTheDocument()
      expect(screen.getByText(/Reigneth Bakery & Treats/i)).toBeInTheDocument()
    })

    it('calls onClose when ESC key is pressed', () => {
      const handleClose = vi.fn()
      render(
        <MemoryRouter>
          <OmniboxSearchModal isOpen={true} onClose={handleClose} />
        </MemoryRouter>
      )

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(handleClose).toHaveBeenCalled()
    })
  })

  describe('PromoHeroCarousel Component', () => {
    it('renders hero promotion with headline, discount badges and CTAs', () => {
      render(
        <MemoryRouter>
          <PromoHeroCarousel />
        </MemoryRouter>
      )

      expect(screen.getByRole('region', { name: /promotional highlights carousel/i })).toBeInTheDocument()
      expect(screen.getByText(/Doorstep Delivery/i)).toBeInTheDocument()
      expect(screen.getByText(/Flat ₦500 Across All Zones/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /order food now/i })).toHaveAttribute('href', '/food')
    })

    it('navigates to the next slide when next chevron button is clicked', () => {
      render(
        <MemoryRouter>
          <PromoHeroCarousel />
        </MemoryRouter>
      )

      const nextBtn = screen.getByRole('button', { name: /next promotional slide/i })
      fireEvent.click(nextBtn)

      expect(screen.getByText(/Lunch Delivered Swift/i)).toBeInTheDocument()
      expect(screen.getByText(/Direct to TASUED & Hostels/i)).toBeInTheDocument()
    })
  })
})
