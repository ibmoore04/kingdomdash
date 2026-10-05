import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import { CustomerOrderCard } from '../customer-order-card'

function renderWithRouter(ui: React.ReactElement) {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('CustomerOrderCard Phase 2 Integration (Radar & PIN)', () => {
  const activeOrder = {
    id: 'ord_123456789',
    status: 'in_transit',
    service_type: 'food',
    created_at: new Date().toISOString(),
    total: 4500,
    delivery_fee: 500,
    delivery_pin: '987654',
    vendors: {
      business_name: 'Chicken & Co Ijebu',
    },
    delivery_address: '14 Stadium Road, Ijebu-Ode',
    order_items: [
      {
        id: 'item_1',
        product_name: 'Crispy Fried Chicken',
        quantity: 2,
        unit_price: 2000,
        line_total: 4000,
      },
    ],
  }

  it('renders DeliveryPinCard and DeliveryRadar for an active in-transit order', () => {
    renderWithRouter(<CustomerOrderCard order={activeOrder} />)

    // Verify PIN Security Pass is rendered (masked by default for shoulder surfing protection)
    expect(screen.getByTestId('delivery-pin-card')).toBeInTheDocument()
    expect(screen.getByText('Security Pass')).toBeInTheDocument()
    expect(screen.getByTestId('delivery-pin-display').textContent).toBe('•  •  •  •  •  •')

    // Reveal PIN on click
    const toggleBtn = screen.getByRole('button', { name: /Reveal PIN|Show PIN/i })
    fireEvent.click(toggleBtn)
    expect(screen.getByTestId('delivery-pin-display').textContent).toBe('9  8  7  6  5  4')

    // Verify DeliveryRadar is rendered by default for active order
    expect(screen.getByTestId('order-timeline')).toBeInTheDocument()
    expect(screen.getByText('Live Fulfillment Radar')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-in_transit')).toHaveAttribute('data-step-status', 'current')
  })

  it('allows customer to toggle the Live Delivery Radar visibility', () => {
    renderWithRouter(<CustomerOrderCard order={activeOrder} />)

    const toggleBtn = screen.getByRole('button', { name: /Hide Live Delivery Radar/i })
    expect(toggleBtn).toBeInTheDocument()

    // Collapse radar
    fireEvent.click(toggleBtn)
    expect(screen.queryByTestId('order-timeline')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View Live Delivery Radar/i })).toBeInTheDocument()

    // Re-open radar
    fireEvent.click(screen.getByRole('button', { name: /View Live Delivery Radar/i }))
    expect(screen.getByTestId('order-timeline')).toBeInTheDocument()
  })

  it('does not render DeliveryPinCard when order is delivered', () => {
    const deliveredOrder = {
      ...activeOrder,
      status: 'delivered',
    }

    renderWithRouter(<CustomerOrderCard order={deliveredOrder} />)

    expect(screen.queryByTestId('delivery-pin-card')).not.toBeInTheDocument()
  })
})
