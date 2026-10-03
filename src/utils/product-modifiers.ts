import type { ProductModifierGroup, SelectedModifier } from '@/types'

/**
 * Intelligent preset generator for Nigerian dishes & food items.
 * Ensures swallows, rice, soups, and grills have realistic, appetizing options
 * (protein choices, sides, spice level) even before database admin setups.
 */
export function getProductModifiers(product: {
  name: string
  description?: string | null
  serviceType?: 'food' | 'grocery'
}): ProductModifierGroup[] {
  // Groceries typically do not have culinary cooking modifiers
  if (product.serviceType === 'grocery') {
    return []
  }

  const text = `${product.name} ${product.description || ''}`.toLowerCase()

  // 1. Swallows & Traditional Soups (Amala, Pounded Yam, Eba, Fufu, Semo, Egusi, Ewedu, Ogbono, Ikokore)
  if (
    text.includes('amala') ||
    text.includes('pounded') ||
    text.includes('yam') ||
    text.includes('eba') ||
    text.includes('fufu') ||
    text.includes('semo') ||
    text.includes('egusi') ||
    text.includes('ewedu') ||
    text.includes('ogbono') ||
    text.includes('ikokore') ||
    text.includes('soup') ||
    text.includes('swallow')
  ) {
    return [
      {
        id: 'protein_choice',
        name: 'Choice of Protein',
        required: true,
        min_selection: 1,
        max_selection: 4,
        options: [
          { id: 'opt_beef_assorted', name: 'Assorted Beef & Shaki', price: 0 },
          { id: 'opt_goat_meat', name: 'Tender Goat Meat (Ogufe)', price: 1000 },
          { id: 'opt_fried_catfish', name: 'Crispy Fried Catfish', price: 1200 },
          { id: 'opt_croaker_fish', name: 'Grilled Croaker Fish', price: 1500 },
          { id: 'opt_soft_ponmo', name: 'Ijebu Soft Ponmo', price: 0 },
        ],
      },
      {
        id: 'extra_sides',
        name: 'Extra Sides & Add-ons',
        required: false,
        min_selection: 0,
        max_selection: 3,
        options: [
          { id: 'opt_extra_wrap', name: 'Extra Wrap of Swallow', price: 700 },
          { id: 'opt_dodo', name: 'Fried Plantain (Dodo)', price: 600 },
          { id: 'opt_moimoi', name: 'Steamed Moi-Moi', price: 700 },
          { id: 'opt_extra_soup', name: 'Extra Soup Portion', price: 800 },
        ],
      },
      {
        id: 'spice_level',
        name: 'Pepper & Spice Preference',
        required: false,
        min_selection: 0,
        max_selection: 1,
        options: [
          { id: 'opt_spice_mild', name: 'Mild (Low Pepper)', price: 0 },
          { id: 'opt_spice_classic', name: 'Medium Classic', price: 0 },
          { id: 'opt_spice_hot', name: 'Extra Hot (Ijebu Buka Style)', price: 0 },
        ],
      },
    ]
  }

  // 2. Rice Dishes (Jollof, Fried Rice, Ofada, Coconut Rice, White Rice)
  if (
    text.includes('jollof') ||
    text.includes('fried rice') ||
    text.includes('ofada') ||
    text.includes('rice')
  ) {
    return [
      {
        id: 'protein_choice',
        name: 'Choice of Protein',
        required: true,
        min_selection: 1,
        max_selection: 4,
        options: [
          { id: 'opt_fried_chicken', name: 'Crispy Fried Chicken', price: 0 },
          { id: 'opt_peppered_beef', name: 'Peppered Beef', price: 700 },
          { id: 'opt_crispy_turkey', name: 'Crispy Golden Turkey', price: 1600 },
          { id: 'opt_goat_meat_rice', name: 'Assorted Goat Meat', price: 1200 },
        ],
      },
      {
        id: 'extra_sides',
        name: 'Sides & Complements',
        required: false,
        min_selection: 0,
        max_selection: 3,
        options: [
          { id: 'opt_dodo', name: 'Fried Sweet Plantain (Dodo)', price: 600 },
          { id: 'opt_coleslaw', name: 'Creamy Coleslaw', price: 500 },
          { id: 'opt_boiled_egg', name: 'Hard Boiled Egg', price: 350 },
          { id: 'opt_moimoi', name: 'Steamed Moi-Moi', price: 700 },
        ],
      },
    ]
  }

  // 3. Grills, Chicken, Shawarma, & Fast Foods
  if (
    text.includes('chicken') ||
    text.includes('wings') ||
    text.includes('shawarma') ||
    text.includes('burger') ||
    text.includes('chips') ||
    text.includes('grill') ||
    text.includes('pastr') ||
    text.includes('pie')
  ) {
    return [
      {
        id: 'sauce_glaze',
        name: 'Preparation & Glaze',
        required: true,
        min_selection: 1,
        max_selection: 1,
        options: [
          { id: 'opt_crispy_original', name: 'Original Crispy', price: 0 },
          { id: 'opt_spicy_yaji', name: 'Fiery Yaji Suya Glaze', price: 300 },
          { id: 'opt_bbq_smoky', name: 'Smoky Sweet BBQ', price: 300 },
        ],
      },
      {
        id: 'fastfood_sides',
        name: 'Add Extras',
        required: false,
        min_selection: 0,
        max_selection: 2,
        options: [
          { id: 'opt_extra_chips', name: 'Seasoned French Fries', price: 800 },
          { id: 'opt_extra_sausage', name: 'Extra Jumbo Sausage', price: 600 },
          { id: 'opt_extra_cheese', name: 'Melted Cheddar Cheese', price: 500 },
          { id: 'opt_chilled_soda', name: 'Chilled 50cl Soda', price: 450 },
        ],
      },
    ]
  }

  // 4. Default for other hot cooked dishes
  return [
    {
      id: 'cooking_note',
      name: 'Portion & Pepper Preference',
      required: false,
      min_selection: 0,
      max_selection: 1,
      options: [
        { id: 'opt_prep_mild', name: 'Mild Pepper', price: 0 },
        { id: 'opt_prep_spicy', name: 'Spicy & Well Seasoned', price: 0 },
      ],
    },
    {
      id: 'general_extras',
      name: 'Add Sides',
      required: false,
      min_selection: 0,
      max_selection: 2,
      options: [
        { id: 'opt_side_dodo', name: 'Fried Plantain (Dodo)', price: 600 },
        { id: 'opt_side_drink', name: 'Chilled Water / Soda', price: 400 },
      ],
    },
  ]
}

/**
 * Calculates effective unit price = basePrice + sum(selectedModifiers)
 */
export function calculateItemUnitPrice(
  basePrice: number,
  selectedModifiers?: SelectedModifier[]
): number {
  if (!selectedModifiers || selectedModifiers.length === 0) {
    return basePrice
  }
  const extraTotal = selectedModifiers.reduce((acc, curr) => acc + (curr.price || 0), 0)
  return basePrice + extraTotal
}

/**
 * Format selected modifiers into a neat summary string
 */
export function formatSelectedModifiers(
  selectedModifiers?: SelectedModifier[]
): string {
  if (!selectedModifiers || selectedModifiers.length === 0) {
    return ''
  }
  return selectedModifiers.map((m) => m.optionName).join(', ')
}
