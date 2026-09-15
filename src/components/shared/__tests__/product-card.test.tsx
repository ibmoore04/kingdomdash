import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProductCard } from '../product-card'
import { useCartStore, type CartVendor } from '@/stores/cart-store'

const mockVendorA: CartVendor = {
  id: 'vendor-1',
  name: 'Mama Put Kitchen',
  address: '10 Awujale Street, Ijebu-Ode',
  serviceType: 'food',
}

const mockVendorB: CartVendor = {
  id: 'vendor-2',
  name: 'Ijebu Fresh Groceries',
  address: '25 Folagbade Street, Ijebu-Ode',
  serviceType: 'grocery',
}

describe('ProductCard component', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    vi.clearAllMocks()
  })

  it('renders product details accurately', () => {
    render(
      <ProductCard
        product={{
          id: 'prod-101',
          name: 'Asun Special',
          description: 'Spicy roasted goat meat with pepper',
          price: 3500,
          image_url: 'https://example.com/asun.jpg',
          is_available: true,
        }}
        vendor={mockVendorA}
      />
    )

    expect(screen.getByText('Asun Special')).toBeDefined()
    expect(screen.getByText('Spicy roasted goat meat with pepper')).toBeDefined()
    expect(screen.getByText('₦3,500')).toBeDefined()
  })

  it('disables add button when product is unavailable', () => {
    render(
      <ProductCard
        product={{
          id: 'prod-102',
          name: 'Sold Out Catfish',
          price: 4500,
          is_available: false,
        }}
        vendor={mockVendorA}
      />
    )

    const button = screen.getByRole('button', { name: /unavailable/i })
    expect(button).toBeDefined()
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('adds product to cart when + button is clicked', () => {
    render(
      <ProductCard
        product={{
          id: 'prod-103',
          name: 'Egusi Soup & Pounded Yam',
          price: 2800,
          is_available: true,
        }}
        vendor={mockVendorA}
      />
    )

    const button = screen.getByRole('button', { name: /add egusi soup/i })
    fireEvent.click(button)

    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].productId).toBe('prod-103')
    expect(state.items[0].quantity).toBe(1)
    expect(state.vendor?.id).toBe(mockVendorA.id)
  })

  it('calls onVendorConflict callback when adding item from a different vendor', () => {
    // First, populate cart with Vendor A
    useCartStore.getState().addItem(
      {
        productId: 'prod-101',
        vendorId: mockVendorA.id,
        serviceType: 'food',
        name: 'Asun Special',
        price: 3500,
        imageUrl: null,
      },
      mockVendorA
    )

    const onVendorConflict = vi.fn()

    render(
      <ProductCard
        product={{
          id: 'prod-201',
          name: 'Fresh Yam Tuber',
          price: 1500,
          is_available: true,
        }}
        vendor={mockVendorB}
        onVendorConflict={onVendorConflict}
      />
    )

    const button = screen.getByRole('button', { name: /add fresh yam tuber/i })
    fireEvent.click(button)

    expect(onVendorConflict).toHaveBeenCalledTimes(1)
    expect(onVendorConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        currentVendorName: 'Mama Put Kitchen',
        pendingVendor: mockVendorB,
      })
    )

    // Ensure cart still only has Vendor A
    expect(useCartStore.getState().vendor?.id).toBe(mockVendorA.id)
    expect(useCartStore.getState().items).toHaveLength(1)
  })
})
