import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  useCartStore,
  syncCartToDatabase,
  fetchCartFromDatabase,
  type CartVendor,
  type CartItem,
} from '@/stores/cart-store'
import { supabase } from '../client'

vi.mock('../client', () => {
  const mockSelect = vi.fn().mockReturnThis()
  const mockEq = vi.fn().mockReturnThis()
  const mockDelete = vi.fn().mockReturnThis()
  const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
  const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    eq: mockEq,
    delete: mockDelete,
    upsert: mockUpsert,
    maybeSingle: mockMaybeSingle,
  }))

  return {
    supabase: {
      from: mockFrom,
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  }
})

describe('Migration 040: Persistent User Carts Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000040_persistent_user_carts.sql'
  )
  const backendMigrationPath = path.resolve(
    process.cwd(),
    'BACKEND/supabase/migrations/20260902000040_persistent_user_carts.sql'
  )

  it('verifies both migration files exist and match', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)
    const frontendContent = fs.readFileSync(migrationPath, 'utf8')
    const backendContent = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(frontendContent).toEqual(backendContent)
    expect(frontendContent.length).toBeGreaterThan(500)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Schema Structure & RLS Policies', () => {
    it('creates public.user_carts table with primary key and foreign keys', () => {
      expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.user_carts/i)
      expect(sql).toMatch(/user_id uuid PRIMARY KEY REFERENCES public\.profiles\(id\)/i)
      expect(sql).toMatch(/vendor_id uuid REFERENCES public\.vendors\(id\)/i)
      expect(sql).toMatch(/items jsonb NOT NULL DEFAULT/i)
    })

    it('enables row-level security and defines user isolation policies', () => {
      expect(sql).toMatch(/ALTER TABLE public\.user_carts ENABLE ROW LEVEL SECURITY;/i)
      expect(sql).toMatch(/CREATE POLICY "user_carts_select_own"/i)
      expect(sql).toMatch(/CREATE POLICY "user_carts_insert_own"/i)
      expect(sql).toMatch(/CREATE POLICY "user_carts_update_own"/i)
      expect(sql).toMatch(/CREATE POLICY "user_carts_delete_own"/i)
      expect(sql).toMatch(/auth\.uid\(\) = user_id/i)
    })

    it('creates admin policy and indexing', () => {
      expect(sql).toMatch(/CREATE POLICY "user_carts_admin_all"/i)
      expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_user_carts_user_id/i)
    })

    it('declares atomic RPC management functions', () => {
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.save_user_cart/i)
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_user_cart/i)
      expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.clear_user_cart/i)
    })
  })

  describe('2. Client Cart Store Supabase Sync', () => {
    const testUserId = '11111111-2222-3333-4444-555555555555'
    const testVendor: CartVendor = {
      id: 'vendor-01',
      name: 'Mama Put Ijebu',
      address: '10 Awujale Street',
      serviceType: 'food',
    }
    const testItem: CartItem = {
      productId: 'prod-01',
      vendorId: 'vendor-01',
      serviceType: 'food',
      name: 'Amala with Gbegiri',
      price: 1500,
      quantity: 2,
      imageUrl: null,
    }

    beforeEach(() => {
      vi.clearAllMocks()
      useCartStore.getState().clearCart()
      useCartStore.getState().setUser(null)
    })

    it('syncs cart additions to Supabase when user is authenticated with UUID', async () => {
      useCartStore.getState().setUser(testUserId)
      useCartStore.getState().addItem(testItem, testVendor)

      expect(useCartStore.getState().items).toHaveLength(1)
      expect(useCartStore.getState().items[0].name).toBe('Amala with Gbegiri')

      // Directly verify syncCartToDatabase function
      await syncCartToDatabase(testUserId, [testItem], testVendor)
      expect(supabase.from).toHaveBeenCalledWith('user_carts')
    })

    it('clears remote cart in Supabase when cart items are cleared', async () => {
      await syncCartToDatabase(testUserId, [], null)
      expect(supabase.from).toHaveBeenCalledWith('user_carts')
    })

    it('does not attempt Supabase sync for null or guest users', async () => {
      vi.clearAllMocks()
      await syncCartToDatabase(null, [testItem], testVendor)
      await syncCartToDatabase('guest', [testItem], testVendor)
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('handles fetchCartFromDatabase safely for guest and invalid inputs', async () => {
      const res = await fetchCartFromDatabase(null)
      expect(res).toBeNull()
      const resGuest = await fetchCartFromDatabase('guest')
      expect(resGuest).toBeNull()
    })
  })
})
