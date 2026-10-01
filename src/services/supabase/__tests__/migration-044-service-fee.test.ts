import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 20261002000001: Platform Service Fee & Order Financial Authority (Phase 1)', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261002000001_service_fee_order_authority.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261002000001_service_fee_order_authority.sql'
  )

  it('verifies migration file exists in both root and BACKEND directories and are synchronized', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)
    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies service_fee column is added to public.orders with NOT NULL and CHECK constraints', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('ALTER TABLE public.orders')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS service_fee numeric(12,2) NOT NULL DEFAULT 150.00 CHECK (service_fee >= 0)')
  })

  it('verifies explicit RBAC boundary protects orders table from direct client mutations', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;')
    expect(sql).toContain('GRANT SELECT ON public.orders TO authenticated;')
  })

  it('verifies create_order_secure authoritatively computes total = subtotal + delivery_fee + service_fee', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('v_service_fee      numeric(12,2) := 150.00;')
    expect(sql).toContain('SELECT COALESCE(service_fee_ngn, 150.00) INTO v_service_fee')
    expect(sql).toContain('FROM public.platform_settings')
    expect(sql).toContain('v_total := round(v_subtotal + v_delivery_fee + v_service_fee, 2);')
    expect(sql).toContain('service_fee = v_service_fee')
  })

  it('verifies calculate_delivery_fee_preview returns dynamic service_fee from platform_settings', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain("'service_fee', v_service_fee")
    expect(sql).toContain('FROM public.platform_settings')
  })

  it('verifies submit_courier_delivery authoritatively applies platform service fee', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('v_total := round(v_delivery_fee + v_service_fee, 2);')
    expect(sql).toContain("'service_fee', v_service_fee")
  })

  it('verifies submit_personal_shopper_request authoritatively computes delivery fee and applies platform service fee', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')
    expect(sql).toContain('DROP FUNCTION IF EXISTS public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text);')
    expect(sql).toContain('v_total := round(v_subtotal + v_delivery_fee + v_service_fee, 2);')
    expect(sql).toContain("'service_fee', v_service_fee")
    expect(sql).toContain('FROM public.delivery_pricing_rules')
    expect(sql).not.toContain('p_delivery_fee numeric')
  })

  it('verifies Migration 1 snapshot RPC bridges order pricing authority to immutable kobo ledger', () => {
    const m1Path = path.resolve(__dirname, '../../../../supabase/migrations/20261001000001_settlement_financial_ledgers.sql')
    const m1Sql = fs.readFileSync(m1Path, 'utf8')
    expect(m1Sql).toContain("to_jsonb(v_order)->>'service_fee'")
    expect(m1Sql).toContain('ROUND(((to_jsonb(v_order)->>\'service_fee\')::numeric) * 100)::bigint')
    expect(m1Sql).toContain('Financial reconciliation conflict: snapshot service_fee_kobo (%) does not match order service_fee (kobo: %)')
  })
})
