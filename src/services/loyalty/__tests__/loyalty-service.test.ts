import { describe, it, expect, beforeEach } from 'vitest'
import {
  getLoyaltyAccount,
  getTierForPoints,
  calculatePointsEarned,
  creditOrderPoints,
  redeemPoints,
  toggleKdPassSubscription,
  applyReferralBonus,
} from '../loyalty-service'

describe('Loyalty Service', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('initializes a new account with 150 welcome bonus points and Bronze tier', () => {
    const account = getLoyaltyAccount('user-123')
    expect(account.userId).toBe('user-123')
    expect(account.pointsBalance).toBe(150)
    expect(account.tier).toBe('Bronze')
    expect(account.referralCode).toMatch(/^KD-[A-Z0-9]+$/)
    expect(account.hasActiveKdPass).toBe(false)
  })

  it('determines tiers correctly based on lifetime points', () => {
    expect(getTierForPoints(0)).toBe('Bronze')
    expect(getTierForPoints(499)).toBe('Bronze')
    expect(getTierForPoints(500)).toBe('Silver')
    expect(getTierForPoints(1499)).toBe('Silver')
    expect(getTierForPoints(1500)).toBe('Gold')
    expect(getTierForPoints(3000)).toBe('Gold')
  })

  it('calculates points earned with tier multipliers', () => {
    // ₦10,000 order = 100 base points
    expect(calculatePointsEarned(10000, 'Bronze')).toBe(100)
    expect(calculatePointsEarned(10000, 'Silver')).toBe(120) // 1.2x
    expect(calculatePointsEarned(10000, 'Gold')).toBe(150) // 1.5x
  })

  it('credits order points and increments balance and transactions', () => {
    const { pointsEarned, newBalance } = creditOrderPoints('user-123', 5000, 'order-abc')
    expect(pointsEarned).toBe(50) // ₦5,000 / 100
    expect(newBalance).toBe(200) // 150 initial + 50
    const updated = getLoyaltyAccount('user-123')
    expect(updated.pointsBalance).toBe(200)
    expect(updated.transactions.length).toBeGreaterThan(1)
  })

  it('redeems points accurately with error handling', () => {
    const userId = 'user-test-redeem'
    getLoyaltyAccount(userId) // balance 150

    // Try redeeming more than balance
    const failedRes = redeemPoints(userId, 200, 500)
    expect(failedRes.success).toBe(false)
    expect(failedRes.error).toContain('only have 150 DashPoints')

    // Valid redemption capped by maxAllowed
    const successRes = redeemPoints(userId, 100, 80)
    expect(successRes.success).toBe(true)
    expect(successRes.discountNgn).toBe(80)

    const updated = getLoyaltyAccount(userId)
    expect(updated.pointsBalance).toBe(70) // 150 - 80
  })

  it('activates and deactivates KD Pass subscription', () => {
    const userId = 'user-kd-pass'
    const active = toggleKdPassSubscription(userId, true)
    expect(active.hasActiveKdPass).toBe(true)
    expect(active.kdPassExpiry).toBeTruthy()

    const disabled = toggleKdPassSubscription(userId, false)
    expect(disabled.hasActiveKdPass).toBe(false)
    expect(disabled.kdPassExpiry).toBeNull()
  })

  it('applies referral bonus to referrer', () => {
    const userId = 'user-referrer'
    const account = applyReferralBonus(userId, 'Tunde Ade')
    expect(account.referredCount).toBe(1)
    expect(account.referralCreditsNgn).toBe(500)
    expect(account.pointsBalance).toBe(400) // 150 + 250
  })
})
