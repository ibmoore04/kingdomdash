import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 042: Customer Order Cancellation & Refund Tracking', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260902000042_customer_order_cancellation_enhancement.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20260902000042_customer_order_cancellation_enhancement.sql'
  )

  it('verifies migration 042 file exists in both root and BACKEND directories', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)
  })

  it('verifies cancel_order_operational allows customer pre-fulfillment cancellation and triggers refund tracking', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // 1. Function declaration
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cancel_order_operational')

    // 2. Customer validation check
    expect(sql).toContain('v_order.customer_id = v_user_id')
    expect(sql).toContain("v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing', 'payment_confirmed')")

    // 3. Status updates & refund tracking
    expect(sql).toContain("SET status = 'cancelled'")
    expect(sql).toContain('cancellation_reason = p_reason')
    expect(sql).toContain('refund_required = v_was_paid')
    expect(sql).toContain("refund_status = CASE WHEN v_was_paid THEN 'pending_manual_review' ELSE 'none' END")

    // 4. Delivery cancellation
    expect(sql).toContain("UPDATE public.deliveries\n    SET status = 'cancelled'")
    expect(sql).toContain('INSERT INTO public.delivery_status_updates')

    // 5. Security grants
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) TO authenticated, service_role;')
  })
})
