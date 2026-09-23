import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CustomerRewardsTab } from '../customer-rewards-tab'

describe('CustomerRewardsTab', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders DashPoints balance, tier, and referral code', () => {
    render(<CustomerRewardsTab userId="test-user-456" userName="Bisi" />)

    expect(screen.getByText("Bisi's Rewards")).toBeInTheDocument()
    expect(screen.getByText('Available DashPoints')).toBeInTheDocument()
    expect(screen.getByText(/Current Tier: Bronze Member/i)).toBeInTheDocument()
    expect(screen.getByText(/Refer Friends in Ijebu-Ode/i)).toBeInTheDocument()
    expect(screen.queryByText(/KingdomDash Pass/i)).not.toBeInTheDocument()
  })

  it('allows copying referral code and link and displays WhatsApp sharing button', () => {
    render(<CustomerRewardsTab userId="test-user-456" userName="Bisi" />)

    // Referral code and link copy buttons
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBe(2)

    // Share on WhatsApp button
    expect(screen.getByRole('button', { name: /share on whatsapp/i })).toBeInTheDocument()

    // KD Pass button should NOT be in the document
    expect(screen.queryByRole('button', { name: /subscribe to kd pass/i })).not.toBeInTheDocument()
  })
})
