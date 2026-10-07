import type { Vendor } from '@/types'
export { CAMPUS_LANDMARKS } from '@/constants/campus-landmarks'

export interface MealPairingItem {
  id: string
  name: string
  priceNgn: number
  category: 'drink' | 'side' | 'protein'
  emoji: string
  description: string
}

export const SUGGESTED_MEAL_PAIRINGS: MealPairingItem[] = [
  {
    id: 'pair-drink-coke',
    name: 'Chilled 500ml Drink',
    priceNgn: 400,
    category: 'drink',
    emoji: '🥤',
    description: 'Ice-cold carbonated beverage',
  },
  {
    id: 'pair-side-dodo',
    name: 'Fried Plantain (Dodo)',
    priceNgn: 450,
    category: 'side',
    emoji: '🍌',
    description: 'Golden sweet ripe fried plantains',
  },
  {
    id: 'pair-protein-chicken',
    name: 'Crispy Fried Chicken',
    priceNgn: 1200,
    category: 'protein',
    emoji: '🍗',
    description: 'Tender seasoned poultry portion',
  },
  {
    id: 'pair-drink-water',
    name: 'Table Water 75cl',
    priceNgn: 250,
    category: 'drink',
    emoji: '💧',
    description: 'Refreshing pure bottled water',
  },
]

/**
 * Checks whether current local time is in late-night delivery hours (8:30 PM to 5:00 AM).
 */
export function isLateNightHours(now = new Date()): boolean {
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTime = hours + minutes / 60

  // 20:30 (8:30 PM) to 23:59, OR 00:00 to 05:00 (5:00 AM)
  return currentTime >= 20.5 || currentTime < 5.0
}

/**
 * Filters vendors by student budget limit (e.g. Under ₦2,500).
 */
export function filterVendorsByBudget(
  vendors: Vendor[],
  _maxBudgetNgn = 2500
): Vendor[] {
  return vendors.filter((v) => {
    const desc = (v.business_description || '').toLowerCase()
    const name = (v.business_name || '').toLowerCase()

    // Vendors explicitly mentioning budget, pocket-friendly, combos, student packs, or local buka
    const hasBudgetKeyword =
      desc.includes('budget') ||
      desc.includes('student') ||
      desc.includes('pocket') ||
      desc.includes('combo') ||
      desc.includes('buka') ||
      desc.includes('local') ||
      name.includes('buka') ||
      name.includes('mama') ||
      name.includes('eatery')

    // Or vendors without luxury pricing tier markers
    return hasBudgetKeyword || !desc.includes('fine dining')
  })
}

/**
 * Filters vendors specializing in late-night grills, shawarma, pizza, and quick cravings.
 */
export function filterVendorsByLateNight(vendors: Vendor[]): Vendor[] {
  const lateNightKeywords = [
    'shawarma',
    'grill',
    'suya',
    'bbq',
    'pizza',
    'burger',
    'fries',
    'drinks',
    'bar',
    'chilled',
    'late',
    'night',
    'fast food',
  ]

  return vendors.filter((v) => {
    const text = `${v.business_name} ${v.business_description || ''}`.toLowerCase()
    return lateNightKeywords.some((keyword) => text.includes(keyword))
  })
}
