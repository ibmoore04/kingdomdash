import { describe, it, expect } from 'vitest'
import { validatePromoCode, ACTIVE_PROMO_CODES } from '../promo-service'

describe('Promo Code Engine', () => {
  it('rejects empty or whitespace promo codes', () => {
    const res = validatePromoCode('  ', 2000)
    expect(res.isValid).toBe(false)
    expect(res.discountAmount).toBe(0)
    expect(res.errorMessage).toMatch(/please enter a promo code/i)
  })

  it('rejects unknown or invalid promo codes', () => {
    const res = validatePromoCode('UNKNOWN999', 2000)
    expect(res.isValid).toBe(false)
    expect(res.discountAmount).toBe(0)
    expect(res.errorMessage).toMatch(/invalid or has expired/i)
  })

  it('enforces minimum order amount for promo code', () => {
    // SWIFTLAUNCH requires 1500
    const res = validatePromoCode('SWIFTLAUNCH', 1000)
    expect(res.isValid).toBe(false)
    expect(res.discountAmount).toBe(0)
    expect(res.errorMessage).toMatch(/minimum order of ₦1,500/i)
  })

  it('correctly calculates percentage discount with cap', () => {
    // SWIFTLAUNCH: 10% on 5,000 is 500
    const res1 = validatePromoCode('SWIFTLAUNCH', 5000)
    expect(res1.isValid).toBe(true)
    expect(res1.discountAmount).toBe(500)

    // SWIFTLAUNCH on 20,000 would be 2,000, capped at 1,000
    const res2 = validatePromoCode('swiftlaunch', 20000) // case insensitive
    expect(res2.isValid).toBe(true)
    expect(res2.discountAmount).toBe(1000)
  })

  it('correctly calculates fixed amount discount', () => {
    // IJEBUFREE: 500 flat on >= 3000
    const res = validatePromoCode('IJEBUFREE', 4000)
    expect(res.isValid).toBe(true)
    expect(res.discountAmount).toBe(500)
  })

  it('verifies ACTIVE_PROMO_CODES contains all required launch codes', () => {
    const codes = Object.keys(ACTIVE_PROMO_CODES)
    expect(codes.length).toBeGreaterThanOrEqual(4)
    expect(codes).toContain('SWIFTLAUNCH')
    expect(codes).toContain('IJEBUFREE')
    expect(codes).toContain('GRACE50')
    expect(codes).toContain('WELCOMEKD')
  })
})
