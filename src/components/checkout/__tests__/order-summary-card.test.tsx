import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OrderSummaryCard } from '../order-summary-card'
import type { CartItem } from '@/stores/cart-store'

const mockItems: CartItem[] = [
  {
    productId: 'p-1',
    vendorId: 'v-1',
    name: 'Jollof Rice with Fried Chicken',
    price: 2500,
    quantity: 2,
    serviceType: 'food',
    imageUrl: '/placeholder.jpg',
  },
]

describe('OrderSummaryCard with Promo Codes', () => {
  it('renders subtotal, delivery fee, service fee, and total', () => {
    render(
      <MemoryRouter>
        <OrderSummaryCard
          items={mockItems}
          subtotal={5000}
          deliveryFee={600}
          serviceFee={150}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Jollof Rice with Fried Chicken')).toBeInTheDocument()
    expect(screen.getAllByText('₦5,000').length).toBeGreaterThanOrEqual(1) // item total & subtotal
    expect(screen.getByText('₦600')).toBeInTheDocument() // delivery fee
    expect(screen.getByText('₦150')).toBeInTheDocument() // service fee
    expect(screen.getByText('₦5,750')).toBeInTheDocument() // 5000 + 600 + 150
  })

  it('triggers onApplyPromo when user inputs and submits a promo code', () => {
    const handleApply = vi.fn()
    render(
      <MemoryRouter>
        <OrderSummaryCard
          items={mockItems}
          subtotal={5000}
          deliveryFee={600}
          serviceFee={150}
          onApplyPromo={handleApply}
        />
      </MemoryRouter>
    )

    const input = screen.getByPlaceholderText(/Promo code/i)
    fireEvent.change(input, { target: { value: 'SWIFTLAUNCH' } })

    const applyBtn = screen.getByRole('button', { name: /apply/i })
    fireEvent.click(applyBtn)

    expect(handleApply).toHaveBeenCalledWith('SWIFTLAUNCH')
  })

  it('displays applied discount row and recalculates total when promo is active', () => {
    render(
      <MemoryRouter>
        <OrderSummaryCard
          items={mockItems}
          subtotal={5000}
          deliveryFee={600}
          serviceFee={150}
          promoDiscount={500}
          appliedPromoCode="SWIFTLAUNCH"
        />
      </MemoryRouter>
    )

    expect(screen.getByText(/Promo applied:/i)).toBeInTheDocument()
    expect(screen.getByText('SWIFTLAUNCH')).toBeInTheDocument()
    expect(screen.getByText('-₦500')).toBeInTheDocument()
    // Total should be: 5000 - 500 + 600 + 150 = 5,250
    expect(screen.getByText('₦5,250')).toBeInTheDocument()
  })

  it('renders promo error message when provided', () => {
    render(
      <MemoryRouter>
        <OrderSummaryCard
          items={mockItems}
          subtotal={5000}
          deliveryFee={600}
          serviceFee={150}
          promoError="Promo code requires a minimum order of ₦6,000."
        />
      </MemoryRouter>
    )

    expect(
      screen.getByText(/Promo code requires a minimum order of ₦6,000./i)
    ).toBeInTheDocument()
  })
})
