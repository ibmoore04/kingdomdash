import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 20261007000001: Customer Cancellation Hardening & Contact Snapshot', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261007000001_customer_cancellation_authorization_hardening.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261007000001_customer_cancellation_authorization_hardening.sql'
  )

  it('verifies migration file exists and is in exact 1:1 parity between root and BACKEND', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)

    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies cancel_order_operational contains hardened customer authorization and phone normalization', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // 1. Function declaration
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cancel_order_operational')

    // 2. Direct customer_id check
    expect(sql).toContain('v_user_id IS NOT NULL AND v_order.customer_id = v_user_id')

    // 3. Delivery address ownership check
    expect(sql).toContain('a.id = v_order.delivery_address_id AND a.profile_id = v_user_id')

    // 4. Normalized Nigerian phone matching (10 digits)
    expect(sql).toContain("right(regexp_replace(v_user_phone, '[^0-9]', '', 'g'), 10)")
    expect(sql).toContain("right(regexp_replace(COALESCE(v_order.customer_phone, ''), '[^0-9]', '', 'g'), 10)")
    expect(sql).toContain("right(regexp_replace(COALESCE(v_order.delivery_phone, ''), '[^0-9]', '', 'g'), 10)")

    // 5. Pre-fulfillment restriction
    expect(sql).toContain("v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing', 'payment_confirmed')")

    // 6. Security grants
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) TO authenticated, service_role;')
  })

  it('verifies automatic contact snapshot trigger and backfill for orders', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // Trigger function and attachment
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_populate_order_contact_snapshot()')
    expect(sql).toContain('CREATE TRIGGER trg_order_contact_snapshot')
    expect(sql).toContain('BEFORE INSERT ON public.orders')

    // Contact backfill
    expect(sql).toContain('UPDATE public.orders o')
    expect(sql).toContain('delivery_phone = COALESCE(o.delivery_phone, a.phone)')
  })
})
