import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DeliveryRadar } from '../delivery-radar'

describe('DeliveryRadar Component (Phase 2)', () => {
  it('renders standard food/grocery steps with active halo styling and dynamic live message', () => {
    render(<DeliveryRadar status="preparing" serviceType="food" />)

    expect(screen.getByTestId('order-timeline')).toBeInTheDocument()
    expect(screen.getByText('Live Fulfillment Radar')).toBeInTheDocument()
    expect(screen.getByText(/Kitchen has received your order and is cooking/i)).toBeInTheDocument()

    const paidStep = screen.getByTestId('timeline-step-paid')
    const prepStep = screen.getByTestId('timeline-step-preparing')
    const readyStep = screen.getByTestId('timeline-step-ready')

    expect(paidStep).toHaveAttribute('data-step-status', 'completed')
    expect(prepStep).toHaveAttribute('data-step-status', 'current')
    expect(readyStep).toHaveAttribute('data-step-status', 'upcoming')
  })

  it('renders courier workflow skipping kitchen preparation', () => {
    render(<DeliveryRadar status="ready_for_pickup" serviceType="courier" />)

    expect(screen.getByText('Courier Dispatch Delivery')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-step-preparing')).not.toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-paid')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-ready')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-in_transit')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-delivered')).toBeInTheDocument()
  })

  it('renders cancelled state gracefully', () => {
    render(
      <DeliveryRadar
        status="cancelled"
        serviceType="food"
        cancellationReason="Rider unavailable"
        refundRequired={true}
      />
    )

    expect(screen.getByTestId('order-timeline-cancelled')).toBeInTheDocument()
    expect(screen.getByText('Order Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Rider unavailable')).toBeInTheDocument()
    expect(screen.getByText(/Refund Status: Queued for review/i)).toBeInTheDocument()
  })
})
