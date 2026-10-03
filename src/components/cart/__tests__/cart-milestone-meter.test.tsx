import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CartMilestoneMeter } from '../cart-milestone-meter'

describe('CartMilestoneMeter Component (Phase 3)', () => {
  it('renders progress toward tier 1 when subtotal is below 5000', () => {
    render(<CartMilestoneMeter subtotal={3000} />)

    expect(screen.getByTestId('cart-milestone-meter')).toBeInTheDocument()
    expect(screen.getByText(/Add/i)).toBeInTheDocument()
    expect(screen.getByText('₦2,000')).toBeInTheDocument()
    expect(screen.getByText(/150 Loyalty Points/i)).toBeInTheDocument()

    const progressBar = screen.getByTestId('milestone-progress-bar')
    expect(progressBar).toHaveStyle({ width: '30%' })
  })

  it('renders unlocked milestone 1 when subtotal is between 5000 and 10000', () => {
    render(<CartMilestoneMeter subtotal={6000} />)

    expect(screen.getByText(/150 Points Unlocked!/i)).toBeInTheDocument()
    expect(screen.getByText('₦4,000')).toBeInTheDocument()
    expect(screen.getByText('Unlocked')).toBeInTheDocument()

    const progressBar = screen.getByTestId('milestone-progress-bar')
    expect(progressBar).toHaveStyle({ width: '60%' })
  })

  it('renders VIP status when subtotal meets or exceeds 10000', () => {
    render(<CartMilestoneMeter subtotal={12000} />)

    expect(screen.getByText(/VIP Rewards Unlocked/i)).toBeInTheDocument()
    expect(screen.getByText(/VIP Tier Achieved: 350 Loyalty Points/i)).toBeInTheDocument()

    const progressBar = screen.getByTestId('milestone-progress-bar')
    expect(progressBar).toHaveStyle({ width: '100%' })
  })
})
