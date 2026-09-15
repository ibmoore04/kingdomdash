import type { MockProduct, MockVendor } from '@/types'

export const mockVendors: MockVendor[] = [
  {
    id: 'lekki-kitchen',
    name: 'Royal Kitchen',
    businessType: 'restaurant',
    description: 'West African plates, grilled fish, and weekday lunch packs.',
    area: 'Molipa, Ijebu-Ode',
    isOpen: true,
    etaMinutes: 25,
    categories: ['Rice', 'Grills', 'Soups'],
  },
  {
    id: 'yaba-bistro',
    name: 'Ijebu Central Bistro',
    businessType: 'restaurant',
    description: 'Fast Nigerian classics with vegetarian options.',
    area: 'Awujale, Ijebu-Ode',
    isOpen: true,
    etaMinutes: 20,
    categories: ['Swallow', 'Pasta', 'Drinks'],
  },
  {
    id: 'vi-grill-house',
    name: 'Heritage Grill House',
    businessType: 'restaurant',
    description: 'Steaks, suya platters, and catering trays.',
    area: 'Igbeba, Ijebu-Ode',
    isOpen: false,
    etaMinutes: 30,
    categories: ['Grills', 'Sides'],
  },
  {
    id: 'ikeja-fresh-mart',
    name: 'Ogun Fresh Mart',
    businessType: 'grocery_store',
    description: 'Produce, pantry staples, and household essentials.',
    area: 'Degun, Ijebu-Ode',
    isOpen: true,
    etaMinutes: 25,
    categories: ['Produce', 'Pantry', 'Household'],
  },
  {
    id: 'surulere-grocers',
    name: 'Gateway Grocers',
    businessType: 'grocery_store',
    description: 'Packaged foods, beverages, and daily essentials.',
    area: 'Bonojo, Ijebu-Ode',
    isOpen: true,
    etaMinutes: 20,
    categories: ['Beverages', 'Snacks', 'Dairy'],
  },
]

export const mockProducts: MockProduct[] = [
  {
    id: 'jollof-party',
    vendorId: 'lekki-kitchen',
    name: 'Party Jollof',
    description: 'Smoky jollof rice with fried plantain.',
    price: 4500,
    category: 'Rice',
    available: true,
  },
  {
    id: 'grilled-tilapia',
    vendorId: 'lekki-kitchen',
    name: 'Grilled Tilapia',
    description: 'Whole tilapia with pepper sauce.',
    price: 7800,
    category: 'Grills',
    available: true,
  },
  {
    id: 'egusi-soup',
    vendorId: 'yaba-bistro',
    name: 'Egusi with Pounded Yam',
    description: 'Rich egusi soup served with pounded yam.',
    price: 6200,
    category: 'Swallow',
    available: true,
  },
  {
    id: 'suya-platter',
    vendorId: 'vi-grill-house',
    name: 'Suya Platter',
    description: 'Mixed suya with onions and tomatoes.',
    price: 9000,
    category: 'Grills',
    available: false,
  },
  {
    id: 'tomato-basket',
    vendorId: 'ikeja-fresh-mart',
    name: 'Tomato Basket',
    description: 'Fresh tomatoes, 2kg.',
    price: 2800,
    category: 'Produce',
    available: true,
  },
  {
    id: 'rice-5kg',
    vendorId: 'ikeja-fresh-mart',
    name: 'Long Grain Rice 5kg',
    description: 'Household staple rice pack.',
    price: 12500,
    category: 'Pantry',
    available: true,
  },
  {
    id: 'malt-pack',
    vendorId: 'surulere-grocers',
    name: 'Malt Pack (6)',
    description: 'Chilled malt drinks, pack of 6.',
    price: 3600,
    category: 'Beverages',
    available: true,
  },
]

export function getVendorById(id: string): MockVendor | undefined {
  return mockVendors.find((vendor) => vendor.id === id)
}

export function getProductsByVendor(vendorId: string): MockProduct[] {
  return mockProducts.filter((product) => product.vendorId === vendorId)
}

export function getRestaurants(): MockVendor[] {
  return mockVendors.filter((vendor) => vendor.businessType === 'restaurant')
}

export function getGroceryStores(): MockVendor[] {
  return mockVendors.filter((vendor) => vendor.businessType === 'grocery_store')
}
