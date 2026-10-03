import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CostBreakdownAccordion } from '../cost-breakdown-accordion'

describe('CostBreakdownAccordion Component (Phase 3)', () => {
  it('renders collapsed state initially and expands on click', () => {
    render(<CostBreakdownAccordion subtotal={4500} />)

    expect(screen.getByTestId('cost-breakdown-accordion')).toBeInTheDocument()
    expect(screen.getByText('Transparent Pricing & Fees')).toBeInTheDocument()
    expect(screen.getByText('View breakdown')).toBeInTheDocument()
    expect(screen.queryByText('Items Subtotal')).not.toBeInTheDocument()

    // Click to expand
    fireEvent.click(screen.getByRole('button', { name: /Transparent Pricing & Fees/i }))

    expect(screen.getByText('Hide details')).toBeInTheDocument()
    expect(screen.getByText('Items Subtotal')).toBeInTheDocument()
    expect(screen.getByText('Distance Delivery Fee')).toBeInTheDocument()
    expect(screen.getByText('Safety & Platform Fee')).toBeInTheDocument()
  })

  it('renders distance mileage tag and pricing tier when provided', () => {
    render(
      <CostBreakdownAccordion
        subtotal={5000}
        deliveryFee={750}
        serviceFee={150}
        distanceKm={3.2}
        pricingTier={2}
        isLaunchPreview={false}
      />
    )

    // Expand accordion
    fireEvent.click(screen.getByRole('button', { name: /Transparent Pricing & Fees/i }))

    expect(screen.getByText('3.2 km')).toBeInTheDocument()
    expect(screen.getByText('Tier 2')).toBeInTheDocument()
    expect(screen.getByText(/Haversine straight-line coordinates/i)).toBeInTheDocument()
    expect(screen.getByText('₦5,900')).toBeInTheDocument()
  })
})
