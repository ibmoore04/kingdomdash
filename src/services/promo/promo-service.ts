export interface PromoCode {
  code: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number // e.g. 10 for 10%, 500 for 500 NGN
  maxDiscount?: number // e.g. 1000 NGN maximum discount for percentage promos
  minOrderAmount: number
  serviceType?: 'food' | 'grocery' | 'courier' | 'all'
}

export interface PromoValidationResult {
  isValid: boolean
  discountAmount: number
  errorMessage?: string
  promo?: PromoCode
}

export const ACTIVE_PROMO_CODES: Record<string, PromoCode> = {
  SWIFTLAUNCH: {
    code: 'SWIFTLAUNCH',
    description: '10% Launch Discount for Ijebu-Ode orders (up to ₦1,000)',
    discountType: 'percentage',
    discountValue: 10,
    maxDiscount: 1000,
    minOrderAmount: 1500,
    serviceType: 'all',
  },
  IJEBUFREE: {
    code: 'IJEBUFREE',
    description: '₦500 Flat Savings on orders of ₦3,000 or more',
    discountType: 'fixed',
    discountValue: 500,
    minOrderAmount: 3000,
    serviceType: 'all',
  },
  GRACE50: {
    code: 'GRACE50',
    description: '5% Community Appreciation Discount',
    discountType: 'percentage',
    discountValue: 5,
    maxDiscount: 500,
    minOrderAmount: 1000,
    serviceType: 'all',
  },
  WELCOMEKD: {
    code: 'WELCOMEKD',
    description: '₦300 Welcome voucher for new customers',
    discountType: 'fixed',
    discountValue: 300,
    minOrderAmount: 2000,
    serviceType: 'all',
  },
}

/**
 * Validates and calculates discount for a given promo code and order subtotal.
 */
export function validatePromoCode(
  rawCode: string,
  subtotal: number,
  serviceType: 'food' | 'grocery' | 'courier' = 'food'
): PromoValidationResult {
  const cleanCode = rawCode.trim().toUpperCase()

  if (!cleanCode) {
    return {
      isValid: false,
      discountAmount: 0,
      errorMessage: 'Please enter a promo code.',
    }
  }

  const promo = ACTIVE_PROMO_CODES[cleanCode]
  if (!promo) {
    return {
      isValid: false,
      discountAmount: 0,
      errorMessage: `Promo code "${cleanCode}" is invalid or has expired.`,
    }
  }

  if (promo.serviceType && promo.serviceType !== 'all' && promo.serviceType !== serviceType) {
    return {
      isValid: false,
      discountAmount: 0,
      errorMessage: `This promo code is only valid for ${promo.serviceType} orders.`,
    }
  }

  if (subtotal < promo.minOrderAmount) {
    return {
      isValid: false,
      discountAmount: 0,
      errorMessage: `Promo code requires a minimum order of ₦${promo.minOrderAmount.toLocaleString()}.`,
    }
  }

  let discount = 0
  if (promo.discountType === 'percentage') {
    discount = Math.round((subtotal * promo.discountValue) / 100)
    if (promo.maxDiscount && discount > promo.maxDiscount) {
      discount = promo.maxDiscount
    }
  } else {
    discount = promo.discountValue
  }

  // Ensure discount never exceeds subtotal
  discount = Math.min(discount, subtotal)

  return {
    isValid: true,
    discountAmount: discount,
    promo,
  }
}
