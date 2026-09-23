import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CartDrawer } from '../cart-drawer'
import { useCartStore, type CartVendor } from '@/stores/cart-store'

const mockVendor: CartVendor = {
  id: 'vendor-123',
  name: 'Ijebu Pot',
  address: '15 Degun Street, Ijebu-Ode',
  serviceType: 'food',
}

describe('CartDrawer', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useCartStore.getState().setCartOpen(true)
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    useCartStore.getState().setCartOpen(false)
    const { container } = render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders empty cart view when cart has no items', () => {
    render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    expect(screen.getByText('Your Cart')).toBeDefined()
    expect(screen.getByText('Your cart is empty')).toBeDefined()
    expect(screen.getByText('Order Food')).toBeDefined()
    expect(screen.getByText('Buy Groceries')).toBeDefined()
  })

  it('renders cart items and summary when items are present', () => {
    useCartStore.getState().addItem(
      {
        productId: 'item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Ofada Rice Combo',
        price: 3000,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    expect(screen.getByText('Ofada Rice Combo')).toBeDefined()
    expect(screen.getByText('Ordering from')).toBeDefined()
    expect(screen.getByText('Ijebu Pot')).toBeDefined()
    expect(screen.getByText('₦0.00 (Launch Preview)')).toBeDefined()
    expect(
      screen.getByText(/Delivery fee will be calculated based on distance in Phase 8/i)
    ).toBeDefined()
    expect(screen.getByText('Proceed to Checkout')).toBeDefined()
  })

  it('increments and decrements item quantity inside the drawer', () => {
    useCartStore.getState().addItem(
      {
        productId: 'item-1',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Ofada Rice Combo',
        price: 3000,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    const incrementBtn = screen.getByRole('button', { name: /increase quantity/i })
    fireEvent.click(incrementBtn)

    expect(useCartStore.getState().items[0].quantity).toBe(2)

    const decrementBtn = screen.getByRole('button', { name: /decrease quantity/i })
    fireEvent.click(decrementBtn)

    expect(useCartStore.getState().items[0].quantity).toBe(1)
  })

  it('closes drawer on clicking close button', () => {
    render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    const closeBtn = screen.getByRole('button', { name: /close cart/i })
    fireEvent.click(closeBtn)

    expect(useCartStore.getState().isOpen).toBe(false)
  })

  it('closes drawer when Escape key is pressed', () => {
    render(
      <MemoryRouter>
        <CartDrawer />
      </MemoryRouter>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useCartStore.getState().isOpen).toBe(false)
  })
})
