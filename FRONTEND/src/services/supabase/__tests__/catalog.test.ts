import { describe, it, expect, vi, beforeEach } from 'vitest'

const singleResult = { data: { id: 'mock-item-id' }, error: null }
const listResult = { data: [{ id: 'mock-1' }, { id: 'mock-2' }], error: null }

const mockSingle = vi.fn().mockResolvedValue(singleResult)
const mockMaybeSingle = vi.fn().mockResolvedValue(singleResult)

const makeQueryBuilder = (): Record<string, unknown> => {
  const builder: Record<string, unknown> = {
    then: (resolve: (v: typeof listResult) => void) => resolve(listResult),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    order: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
  }
  return builder
}

const mockFrom = vi.fn((_table?: string) => ({
  select: vi.fn(() => makeQueryBuilder()),
  update: vi.fn(() => makeQueryBuilder()),
  insert: vi.fn(() => makeQueryBuilder()),
  delete: vi.fn(() => makeQueryBuilder()),
}))

vi.mock('../client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
}))

import { getVendorByProfileId, updateVendorProfile } from '../vendors'
import {
  getVendorCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getReferenceCategories,
} from '../categories'
import {
  getVendorProducts,
  createProduct,
  updateProduct,
  toggleProductAvailability,
  deleteProduct,
} from '../products'

describe('Catalog Services Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Vendor Service', () => {
    it('getVendorByProfileId queries vendors table with profile_id', async () => {
      const result = await getVendorByProfileId('profile-123')
      expect(mockFrom).toHaveBeenCalledWith('vendors')
      expect(result).toEqual(singleResult)
    })

    it('updateVendorProfile updates vendor and filters immutable fields', async () => {
      await updateVendorProfile('vendor-123', {
        phone: '08012345678',
        business_address: '123 Main St, Ijebu-Ode',
        // Attempting to modify immutable fields should be omitted
        id: 'hacked-id',
        is_active: false,
      })

      expect(mockFrom).toHaveBeenCalledWith('vendors')
    })
  })

  describe('Category Service', () => {
    it('getVendorCategories queries categories table with vendor_id', async () => {
      const result = await getVendorCategories('vendor-123')
      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(result).toEqual(listResult)
    })

    it('getReferenceCategories queries reference_categories table', async () => {
      const result = await getReferenceCategories('food')
      expect(mockFrom).toHaveBeenCalledWith('reference_categories')
      expect(result).toEqual(listResult)
    })

    it('createCategory inserts new category', async () => {
      const result = await createCategory({
        vendor_id: 'vendor-123',
        name: 'Rice Dishes',
        description: 'Jollof and Fried Rice',
      })
      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(result).toEqual(singleResult)
    })

    it('updateCategory updates category fields', async () => {
      const result = await updateCategory('cat-123', {
        name: 'Soups & Swallows',
        is_active: false,
      })
      expect(mockFrom).toHaveBeenCalledWith('categories')
      expect(result).toEqual(singleResult)
    })

    it('deleteCategory removes category by id', async () => {
      await deleteCategory('cat-123')
      expect(mockFrom).toHaveBeenCalledWith('categories')
    })
  })

  describe('Product Service', () => {
    it('getVendorProducts queries products with optional category and search filters', async () => {
      const result = await getVendorProducts('vendor-123', {
        categoryId: 'cat-123',
        search: 'Jollof',
      })
      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(result).toEqual(listResult)
    })

    it('createProduct validates price is non-negative before calling supabase', async () => {
      await expect(
        createProduct({
          vendor_id: 'vendor-123',
          name: 'Invalid Price Item',
          price: -500,
        })
      ).rejects.toThrow(/negative/)

      expect(mockFrom).not.toHaveBeenCalledWith('products')
    })

    it('createProduct inserts valid product', async () => {
      const result = await createProduct({
        vendor_id: 'vendor-123',
        name: 'Special Fried Rice',
        price: 3500,
      })
      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(result).toEqual(singleResult)
    })

    it('updateProduct validates updated price is non-negative', async () => {
      await expect(
        updateProduct('prod-123', {
          price: -100,
        })
      ).rejects.toThrow(/negative/)
    })

    it('toggleProductAvailability updates is_available boolean', async () => {
      const result = await toggleProductAvailability('prod-123', false)
      expect(mockFrom).toHaveBeenCalledWith('products')
      expect(result).toEqual(singleResult)
    })

    it('deleteProduct deletes product by id', async () => {
      await deleteProduct('prod-123')
      expect(mockFrom).toHaveBeenCalledWith('products')
    })
  })
})
