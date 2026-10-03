import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { FloatingCartBar } from '../floating-cart-bar'
import { useCartStore, type CartItem, type CartVendor } from '@/stores/cart-store'

const mockVendor: CartVendor = {
  id: 'vendor-123',
  name: 'Buka Delight',
  address: '12 Ibadan Rd, Ijebu-Ode',
  serviceType: 'food',
}

const mockItem: CartItem = {
  productId: 'prod-1',
  vendorId: 'vendor-123',
  serviceType: 'food',
  name: 'Jollof Rice & Beef',
  price: 2500,
  quantity: 2,
  imageUrl: 'https://example.com/jollof.jpg',
}

describe('FloatingCartBar component', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      vendor: null,
      isOpen: false,
    })
  })

  it('renders nothing when cart is empty', () => {
    render(
      <MemoryRouter initialEntries={['/food']}>
        <FloatingCartBar />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('floating-cart-bar')).not.toBeInTheDocument()
  })

  it('renders nothing when on /cart or /checkout or confirmation page even if cart has items', () => {
    useCartStore.setState({
      items: [mockItem],
      vendor: mockVendor,
    })

    const { rerender } = render(
      <MemoryRouter initialEntries={['/cart']}>
        <FloatingCartBar />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('floating-cart-bar')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/checkout']}>
        <FloatingCartBar />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('floating-cart-bar')).not.toBeInTheDocument()

    rerender(
      <MemoryRouter initialEntries={['/order/kd-12345/confirmation']}>
        <FloatingCartBar />
      </MemoryRouter>
    )
    expect(screen.queryByTestId('floating-cart-bar')).not.toBeInTheDocument()
  })

  it('renders cart summary and vendor when items exist on public routes', () => {
    useCartStore.setState({
      items: [mockItem],
      vendor: mockVendor,
    })

    render(
      <MemoryRouter initialEntries={['/food']}>
        <FloatingCartBar />
      </MemoryRouter>
    )

    expect(screen.getByTestId('floating-cart-bar')).toBeInTheDocument()
    expect(screen.getByText(/2 items/i)).toBeInTheDocument()
    expect(screen.getByText('Buka Delight')).toBeInTheDocument()
    expect(screen.getByText('View Cart')).toBeInTheDocument()
  })

  it('opens cart drawer when clicked', () => {
    useCartStore.setState({
      items: [mockItem],
      vendor: mockVendor,
      isOpen: false,
    })

    render(
      <MemoryRouter initialEntries={['/food']}>
        <FloatingCartBar />
      </MemoryRouter>
    )

    const cartBtn = screen.getByRole('button', { name: /open cart/i })
    fireEvent.click(cartBtn)

    expect(useCartStore.getState().isOpen).toBe(true)
  })
})
