import { describe, it, expect } from 'vitest'
import {
  getProductModifiers,
  calculateItemUnitPrice,
  formatSelectedModifiers,
} from '../product-modifiers'
import type { SelectedModifier } from '@/types'

describe('product-modifiers utility', () => {
  it('generates protein, side, and spice groups for swallow dishes', () => {
    const groups = getProductModifiers({
      name: 'Amala with Ewedu and Gbegiri',
      description: 'Hot authentic swallow',
      serviceType: 'food',
    })

    expect(groups.length).toBeGreaterThanOrEqual(2)
    const proteinGroup = groups.find((g) => g.id === 'protein_choice')
    expect(proteinGroup).toBeDefined()
    expect(proteinGroup?.required).toBe(true)
    expect(proteinGroup?.max_selection).toBeGreaterThanOrEqual(2)
    expect(proteinGroup?.options.some((o) => o.name.includes('Goat Meat'))).toBe(true)

    const sidesGroup = groups.find((g) => g.id === 'extra_sides')
    expect(sidesGroup).toBeDefined()
    expect(sidesGroup?.options.some((o) => o.name.includes('Plantain'))).toBe(true)
  })

  it('generates protein and side options for rice dishes with multi-protein support', () => {
    const groups = getProductModifiers({
      name: 'Smoky Party Jollof Rice',
      description: 'Rich tomato seasoned rice',
      serviceType: 'food',
    })

    const proteinGroup = groups.find((g) => g.id === 'protein_choice')
    expect(proteinGroup).toBeDefined()
    expect(proteinGroup?.max_selection).toBeGreaterThanOrEqual(2)
    expect(proteinGroup?.options.some((o) => o.name.includes('Chicken'))).toBe(true)
  })

  it('returns empty modifier groups for grocery store items', () => {
    const groups = getProductModifiers({
      name: '50kg Royal Stallion Rice',
      description: 'Imported parboiled rice',
      serviceType: 'grocery',
    })

    expect(groups).toHaveLength(0)
  })

  it('accurately calculates unit price with extra modifier costs', () => {
    const basePrice = 3000
    const modifiers: SelectedModifier[] = [
      {
        groupId: 'protein_choice',
        groupName: 'Protein',
        optionId: 'opt-goat',
        optionName: 'Goat Meat',
        price: 1000,
      },
      {
        groupId: 'extra_sides',
        groupName: 'Sides',
        optionId: 'opt-dodo',
        optionName: 'Fried Plantain',
        price: 600,
      },
    ]

    const totalUnitPrice = calculateItemUnitPrice(basePrice, modifiers)
    expect(totalUnitPrice).toBe(4600)
  })

  it('returns base price when no modifiers are selected', () => {
    expect(calculateItemUnitPrice(2500)).toBe(2500)
    expect(calculateItemUnitPrice(2500, [])).toBe(2500)
  })

  it('formats selected modifiers into readable comma-separated string', () => {
    const modifiers: SelectedModifier[] = [
      {
        groupId: 'protein_choice',
        groupName: 'Protein',
        optionId: 'opt-goat',
        optionName: 'Goat Meat',
        price: 1000,
      },
      {
        groupId: 'extra_sides',
        groupName: 'Sides',
        optionId: 'opt-dodo',
        optionName: 'Fried Plantain',
        price: 600,
      },
    ]

    const formatted = formatSelectedModifiers(modifiers)
    expect(formatted).toBe('Goat Meat, Fried Plantain')
  })
})
