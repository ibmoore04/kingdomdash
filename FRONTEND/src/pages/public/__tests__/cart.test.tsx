import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CartPage from '../cart.tsx'
import { useCartStore, type CartVendor } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const mockVendor: CartVendor = {
  id: 'vendor-food-1',
  name: 'Bisi Eatery',
  address: '22 Molipa Expressway, Ijebu-Ode',
  serviceType: 'food',
}

describe('CartPage', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
    useAuthStore.setState({ session: null, profile: null })
    mockNavigate.mockClear()
  })

  it('renders empty cart view when cart has no items', () => {
    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Shopping Cart')).toBeDefined()
    expect(screen.getByText('Your cart is empty')).toBeDefined()
  })

  it('renders items list and financial breakdown', () => {
    useCartStore.getState().addItem(
      {
        productId: 'item-10',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Fried Rice and Chicken',
        price: 3500,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Fried Rice and Chicken')).toBeDefined()
    expect(screen.getByText('Bisi Eatery')).toBeDefined()
    expect(screen.getByText('₦0.00 (Launch Preview)')).toBeDefined()
    expect(screen.getByText(/Delivery fee will be calculated based on distance in Phase 8/i)).toBeDefined()
  })

  it('redirects guest user to login with redirect param on checkout click', () => {
    useCartStore.getState().addItem(
      {
        productId: 'item-10',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Fried Rice and Chicken',
        price: 3500,
        imageUrl: null,
      },
      mockVendor
    )

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    )

    const checkoutBtn = screen.getByRole('button', { name: /Proceed to Checkout/i })
    fireEvent.click(checkoutBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/auth/login?redirect=/checkout')
  })

  it('navigates logged-in customer directly to checkout', () => {
    useCartStore.getState().addItem(
      {
        productId: 'item-10',
        vendorId: mockVendor.id,
        serviceType: 'food',
        name: 'Fried Rice and Chicken',
        price: 3500,
        imageUrl: null,
      },
      mockVendor
    )

    // Log in user
    useAuthStore.setState({
      session: { user: { id: 'cust-1' } } as any,
      profile: { id: 'cust-1', role: 'customer' } as any,
    })

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>
    )

    const checkoutBtn = screen.getByRole('button', { name: /Proceed to Checkout/i })
    fireEvent.click(checkoutBtn)

    expect(mockNavigate).toHaveBeenCalledWith('/checkout')
  })
})
