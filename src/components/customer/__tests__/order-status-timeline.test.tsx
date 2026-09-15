import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OrderStatusTimeline } from '@/components/customer/OrderStatusTimeline'

describe('OrderStatusTimeline Component (Phase 10)', () => {
  it('renders standard food/grocery 5-stage progress indicator', () => {
    render(<OrderStatusTimeline status="preparing" serviceType="food" />)

    expect(screen.getByTestId('order-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-paid')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-preparing')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-ready')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-in_transit')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-delivered')).toBeInTheDocument()
  })

  it('correctly marks preparing step as current when status is preparing', () => {
    render(<OrderStatusTimeline status="preparing" serviceType="food" />)

    const paidStep = screen.getByTestId('timeline-step-paid')
    const prepStep = screen.getByTestId('timeline-step-preparing')
    const readyStep = screen.getByTestId('timeline-step-ready')

    expect(paidStep).toHaveAttribute('data-step-status', 'completed')
    expect(prepStep).toHaveAttribute('data-step-status', 'current')
    expect(readyStep).toHaveAttribute('data-step-status', 'upcoming')
  })

  it('renders courier 4-stage progress indicator skipping vendor preparation stages', () => {
    render(<OrderStatusTimeline status="ready_for_pickup" serviceType="courier" />)

    expect(screen.getByText('Courier Dispatch Delivery')).toBeInTheDocument()
    expect(screen.queryByTestId('timeline-step-preparing')).not.toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-paid')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-ready')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-in_transit')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-step-delivered')).toBeInTheDocument()
  })

  it('renders cancelled view with cancellation reason and refund marker when status is cancelled', () => {
    render(
      <OrderStatusTimeline
        status="cancelled"
        serviceType="food"
        cancellationReason="Item out of stock at restaurant"
        refundRequired={true}
      />
    )

    expect(screen.getByTestId('order-timeline-cancelled')).toBeInTheDocument()
    expect(screen.getByText('Order Cancelled')).toBeInTheDocument()
    expect(screen.getByText('Item out of stock at restaurant')).toBeInTheDocument()
    expect(screen.getByText(/Refund Status: Queued for review/i)).toBeInTheDocument()
  })
})
