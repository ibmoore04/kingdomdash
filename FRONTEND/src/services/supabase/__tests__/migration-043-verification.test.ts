import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { submitPersonalShopperRequestSecure } from '../orders'
import { supabase } from '../client'

describe('Migration 043: Enforce Server Financial Authority', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260902000043_enforce_server_financial_authority.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20260902000043_enforce_server_financial_authority.sql'
  )

  it('verifies migration 043 file exists in both root and BACKEND directories and are synchronized', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)
    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies SQL trigger trg_enforce_order_financial_authority prevents unprivileged direct client insertion of financial fields', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_enforce_order_financial_authority()')
    expect(sql).toContain('CREATE TRIGGER trg_order_financial_authority')
    expect(sql).toContain("pg_trigger_depth() = 1")
    expect(sql).toContain("current_setting('role', true) = 'authenticated'")
    expect(sql).toContain('RAISE EXCEPTION')
    expect(sql).toContain('KD403')
  })

  it('verifies submitPersonalShopperRequestSecure calls submit_personal_shopper_request RPC with expected parameters', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'shopper-id-123', error: null } as any)

    const result = await submitPersonalShopperRequestSecure({
      customerName: 'John Doe',
      customerPhone: '08012345678',
      deliveryAddress: '123 Main St, Lagos',
      marketName: 'Mile 12 Market',
      budgetCap: 15000,
      estimatedTotal: 12000,
      items: [{ name: 'Yams', quantity: '2' }],
      notes: 'Please pick fresh items',
    })

    expect(rpcSpy).toHaveBeenCalledWith('submit_personal_shopper_request', {
      p_customer_name: 'John Doe',
      p_customer_phone: '08012345678',
      p_delivery_address: '123 Main St, Lagos',
      p_market_name: 'Mile 12 Market',
      p_budget_cap: 15000,
      p_estimated_total: 12000,
      p_items: [{ name: 'Yams', quantity: '2' }],
      p_notes: 'Please pick fresh items',
    })
    expect(result.data).toBe('shopper-id-123')
    rpcSpy.mockRestore()
  })
})
