import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  CAMPUS_LANDMARKS,
  isLateNightHours,
  filterVendorsByBudget,
  filterVendorsByLateNight,
  SUGGESTED_MEAL_PAIRINGS,
} from '@/utils/campus-discovery'
import { MealPairingUpsell } from '@/components/cart/meal-pairing-upsell'
import { useCartStore, type CartVendor } from '@/stores/cart-store'
import type { Vendor } from '@/types/database'

describe('Phase 4: Campus Discovery & Budget Optimization', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  describe('Campus Landmarks Constants', () => {
    it('defines key TASUED campus landmarks with valid GPS coordinates', () => {
      expect(CAMPUS_LANDMARKS.length).toBeGreaterThanOrEqual(4)
      const landmarkNames = CAMPUS_LANDMARKS.map((l) => l.name)
      expect(landmarkNames.some((n) => n.includes('TASUED Main'))).toBe(true)
      expect(landmarkNames.some((n) => n.includes('CEPEP Annex'))).toBe(true)
      expect(landmarkNames.some((n) => n.includes('Library'))).toBe(true)

      CAMPUS_LANDMARKS.forEach((l) => {
        expect(l.coords.latitude).toBeGreaterThan(6.0)
        expect(l.coords.longitude).toBeGreaterThan(3.0)
        expect(l.address.length).toBeGreaterThan(5)
      })
    })
  })

  describe('isLateNightHours', () => {
    it('accurately detects late-night cravings hours', () => {
      // 9:30 PM (21:30) is late night
      const lateEvening = new Date(2026, 9, 6, 21, 30)
      expect(isLateNightHours(lateEvening)).toBe(true)

      // 2:00 AM is late night
      const lateNight = new Date(2026, 9, 6, 2, 0)
      expect(isLateNightHours(lateNight)).toBe(true)

      // 1:00 PM (13:00) is daytime
      const daytime = new Date(2026, 9, 6, 13, 0)
      expect(isLateNightHours(daytime)).toBe(false)
    })
  })

  describe('filterVendorsByBudget', () => {
    const mockVendors: Vendor[] = [
      {
        id: 'v1',
        business_name: 'Student Buka Delight',
        business_description: 'Affordable student rice, beans, and swallow',
        service_area: 'TASUED Campus',
        is_active: true,
        price_tier: 'budget',
        commission_rate: 0.1,
        rating: 4.5,
        rating_count: 20,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'v2',
        business_name: 'Executive Gourmet Lounge',
        business_description: 'Fine dining platters and premium continental cuisines',
        service_area: 'Ijebu Ode',
        is_active: true,
        price_tier: 'luxury',
        commission_rate: 0.1,
        rating: 4.8,
        rating_count: 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    it('filters out luxury restaurants when student budget filter is applied', () => {
      const pocketFriendly = filterVendorsByBudget(mockVendors, 2500)
      expect(pocketFriendly.length).toBe(1)
      expect(pocketFriendly[0].business_name).toBe('Student Buka Delight')
    })
  })

  describe('filterVendorsByLateNight', () => {
    const mockVendors: Vendor[] = [
      {
        id: 'v1',
        business_name: 'Campus Suya & Grills Spot',
        business_description: 'Night shawarma, spicy beef suya and chilled drinks',
        service_area: 'TASUED Gate',
        is_active: true,
        commission_rate: 0.1,
        rating: 4.6,
        rating_count: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'v2',
        business_name: 'Morning Breakfast Corner',
        business_description: 'Early morning pap, akara and bread',
        service_area: 'Ijagun',
        is_active: true,
        commission_rate: 0.1,
        rating: 4.2,
        rating_count: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    it('identifies late-night cuisine vendors matching keywords', () => {
      const lateNightOptions = filterVendorsByLateNight(mockVendors)
      expect(lateNightOptions.length).toBe(1)
      expect(lateNightOptions[0].business_name).toBe('Campus Suya & Grills Spot')
    })
  })

  describe('MealPairingUpsell Component', () => {
    const mockVendor: CartVendor = {
      id: 'vendor-123',
      name: 'TASUED Jollof Central',
      address: 'TASUED Campus, Ijagun',
      serviceType: 'food',
    }

    it('does not render when the cart is empty', () => {
      const { container } = render(<MealPairingUpsell />)
      expect(container.firstChild).toBeNull()
    })

    it('renders suggested pairings when cart has items and adds item on tap', () => {
      // Add primary item to cart
      useCartStore.getState().addItem(
        {
          productId: 'dish-1',
          vendorId: mockVendor.id,
          serviceType: 'food',
          name: 'Jollof Rice Combo',
          price: 1800,
          imageUrl: null,
        },
        mockVendor
      )

      render(<MealPairingUpsell />)

      expect(screen.getByText(/Complete Your Meal/i)).toBeInTheDocument()
      expect(screen.getByText('Chilled 500ml Drink')).toBeInTheDocument()

      // Click add on Chilled 500ml Drink
      const addButtons = screen.getAllByRole('button', { name: /Add/i })
      fireEvent.click(addButtons[0])

      // Validate cart state now includes the pairing
      const cartItems = useCartStore.getState().items
      expect(cartItems.length).toBe(2)
      const addedPairing = cartItems.find((i) => i.productId.startsWith('upsell-'))
      expect(addedPairing).toBeDefined()
      expect(addedPairing?.price).toBe(SUGGESTED_MEAL_PAIRINGS[0].priceNgn)
    })
  })
})
