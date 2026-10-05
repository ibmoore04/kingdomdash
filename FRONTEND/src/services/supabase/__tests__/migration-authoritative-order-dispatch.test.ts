import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 20261011000001: Authoritative Order & Delivery Dispatch Engine', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261011000001_authoritative_order_dispatch_engine.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261011000001_authoritative_order_dispatch_engine.sql'
  )

  it('verifies migration file exists and is in exact 1:1 parity between root and BACKEND', () => {
    expect(fs.existsSync(rootMigrationPath)).toBe(true)
    expect(fs.existsSync(backendMigrationPath)).toBe(true)

    const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
    const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
    expect(rootSql).toBe(backendSql)
  })

  it('verifies assign_order_or_delivery_to_rider has robust security checks and dual rider resolution', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // 1. Function declaration with SECURITY DEFINER
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_order_or_delivery_to_rider(')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = public, pg_catalog')

    // 2. Dispatch authorization check
    expect(sql).toContain("v_role NOT IN ('admin', 'super_admin') AND auth.role() <> 'service_role'")
    expect(sql).toContain('Only dispatch administrators can assign orders to riders')

    // 3. Dual rider identifier support (accepts riders.id OR riders.profile_id)
    expect(sql).toContain('WHERE id = p_rider_id OR profile_id = p_rider_id')

    // 4. In-flight check only blocks on accepted active trips
    expect(sql).toContain("da.status = 'accepted'")
    expect(sql).toContain("d.status IN ('assigned', 'picked_up', 'in_transit')")
  })

  it('verifies automatic delivery record provisioning and status synchronization', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // 1. Automatic provisioning if delivery not found
    expect(sql).toContain('INSERT INTO public.deliveries (')
    expect(sql).toContain('RETURNING id, order_id, status INTO v_delivery')

    // 2. Rejection of prior stale assignments
    expect(sql).toContain("SET status = 'rejected'")
    expect(sql).toContain("notes = COALESCE(notes, '') || ' [Reassigned by dispatch console]'")

    // 3. Atomically sets delivery and order status
    expect(sql).toContain("UPDATE public.deliveries\n  SET status = 'assigned'")
    expect(sql).toContain("UPDATE public.orders\n    SET status = 'ready_for_pickup'")

    // 4. Personal shopper sync and notification emission
    expect(sql).toContain('UPDATE public.personal_shopper_requests')
    expect(sql).toContain('PERFORM public.emit_notification(')

    // 5. Execution grants
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.assign_order_or_delivery_to_rider(uuid, uuid) FROM PUBLIC;')
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.assign_order_or_delivery_to_rider(uuid, uuid) TO authenticated, service_role;')
  })

  it('verifies delegating wrapper public.assign_delivery_to_rider', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_delivery_to_rider(')
    expect(sql).toContain('public.assign_order_or_delivery_to_rider(v_order_id, p_rider_id)')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) FROM PUBLIC;')
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO authenticated, service_role;')
  })

  it('verifies authoritative mark_delivery_delivered and schema cache reload', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    // Verifies 3-arg authoritative function and 2-arg compatibility overload
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(\n  p_delivery_id uuid,\n  p_notes       text DEFAULT NULL,\n  p_pin         text DEFAULT NULL\n)')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(\n  p_delivery_id uuid,\n  p_notes       text DEFAULT NULL\n)')
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text, text) TO authenticated, service_role;')
    expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) TO authenticated, service_role;')
    expect(sql).toContain("NOTIFY pgrst, 'reload schema';")
  })
})

