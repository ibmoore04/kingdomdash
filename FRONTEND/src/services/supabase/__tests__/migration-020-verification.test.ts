import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Phase 10 Migration 020 Operational Architecture & Security Verification Suite
 * Verifies SQL structure, state machine separation, elimination of generic triggers,
 * atomic transition RPCs, dispatch rules, cancellation engine, idempotency,
 * audit consistency, and RLS policies in 20260902000020_order_delivery_operations.sql.
 */
describe('Phase 10 - Migration 020 Operational Architecture & Security Suite', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000020_order_delivery_operations.sql'
  )

  it('migration 020 file exists on disk', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Operational Timestamps, Snapshots & Partial Indexes (§1)', () => {
    it('adds authoritative timestamps, refund markers, and courier contact snapshots to orders', () => {
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS confirmed_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS preparing_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS ready_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS picked_up_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS in_transit_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS delivered_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS cancelled_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS cancellation_reason text')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS refund_required boolean DEFAULT false')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS refund_status text DEFAULT NULL')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS pickup_contact text')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS pickup_phone text')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS delivery_contact text')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS delivery_phone text')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS idempotency_key text')
    })

    it('creates partial unique index for per-customer courier order idempotency', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_idempotency')
      expect(sql).toContain('ON public.orders (customer_id, idempotency_key)')
      expect(sql).toContain('WHERE idempotency_key IS NOT NULL;')
    })

    it('adds operational timestamps to deliveries', () => {
      expect(sql).toContain('ALTER TABLE public.deliveries')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS picked_up_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS in_transit_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS delivered_at timestamptz')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS cancelled_at timestamptz')
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_order_id_unique')
    })

    it('adds responded_at and partial unique index to delivery_assignments while preserving NOT NULL on assigned_by', () => {
      expect(sql).toContain('ALTER TABLE public.delivery_assignments')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS responded_at timestamptz')
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_active_delivery_assignment')
      expect(sql).toContain('ON public.delivery_assignments (delivery_id)')
      expect(sql).toContain("WHERE status IN ('assigned', 'accepted');")
      expect(sql).not.toContain('ALTER COLUMN assigned_by DROP NOT NULL')
    })

    it('adds eligibility flags to riders', () => {
      expect(sql).toContain('ALTER TABLE public.riders')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false')
    })
    it('creates triggers enforcing operational snapshot immutability on orders and deliveries', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_enforce_order_snapshot_immutability()')
      expect(sql).toContain('CREATE TRIGGER trg_enforce_order_snapshot_immutability')
      expect(sql).toContain('BEFORE UPDATE ON public.orders')
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_enforce_delivery_snapshot_immutability()')
      expect(sql).toContain('CREATE TRIGGER trg_enforce_delivery_snapshot_immutability')
      expect(sql).toContain('BEFORE UPDATE ON public.deliveries')
    })
  })

  describe('2. Trusted Operational Audit Logging (§2)', () => {
    it('creates log_operational_audit_event targeting profile_id without swallowing audit insert errors', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.log_operational_audit_event')
      expect(sql).toContain("v_profile_id := auth.uid();")
      expect(sql).toContain("v_headers := current_setting('request.headers', true)::jsonb;")
      expect(sql).toContain("v_user_agent := v_headers->>'user-agent';")
      expect(sql).toContain("trim(split_part(v_headers->>'x-forwarded-for', ',', 1))")
      expect(sql).toContain('INSERT INTO public.audit_logs')
      expect(sql).toContain('profile_id,')
      expect(sql).not.toContain('actor_id')
      // Ensure the audit insert itself is NOT wrapped in an exception handler that swallows errors
      expect(sql).not.toContain("RAISE WARNING 'Failed to record audit log: %'")
    })

    it('revokes execution of log_operational_audit_event from PUBLIC, anon, and authenticated (fail-closed, internal only)', () => {
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM PUBLIC;')
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM anon;')
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM authenticated;')
      expect(sql).not.toContain('GRANT  EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) TO authenticated;')
    })
  })

  describe('3. Automatic Delivery Instantiation (§3)', () => {
    it('creates trigger trg_order_payment_confirmed firing BEFORE UPDATE ON public.orders', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_on_order_payment_confirmed()')
      expect(sql).toContain('CREATE TRIGGER trg_order_payment_confirmed')
      expect(sql).toContain('BEFORE UPDATE ON public.orders')
    })

    it('sets confirmed_at and creates delivery record with IF NOT EXISTS idempotency', () => {
      expect(sql).toContain("IF NEW.status = 'payment_confirmed' AND (OLD.status IS DISTINCT FROM 'payment_confirmed')")
      expect(sql).toContain('IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id)')
      expect(sql).toContain('INSERT INTO public.deliveries')
      expect(sql).toContain("'pending'")
    })

    it('isolates the delivery insert exception handler so that audit failures abort the transaction', () => {
      expect(sql).toContain('v_delivery_created   boolean := false;')
      expect(sql).toContain('WHEN unique_violation THEN\n          -- Another concurrent trigger execution already created this delivery row\n          v_delivery_created := false;\n      END;')
      expect(sql).toContain("RAISE EXCEPTION 'Failed to instantiate delivery for order %', NEW.id USING ERRCODE = 'KD500';")
      expect(sql).toContain('IF v_delivery_created THEN\n        PERFORM public.log_operational_audit_event(')
    })

    it('transfers customer, vendor, and courier contact snapshots into deliveries', () => {
      expect(sql).toContain('SELECT full_name, phone_number')
      expect(sql).toContain('FROM public.profiles')
      expect(sql).toContain("COALESCE(NEW.delivery_contact, v_addr_recipient, v_cust_name, 'Customer')")
      expect(sql).toContain("COALESCE(NEW.delivery_phone, v_addr_phone, v_cust_phone, 'N/A')")
      expect(sql).toContain("COALESCE(NEW.pickup_contact, v_vendor_name, 'Sender')")
    })
  })

  describe('4. Generic Sync Triggers Are Strictly Banned (§4)', () => {
    it('does NOT contain generic status-mirroring triggers', () => {
      expect(sql).not.toContain('trg_fn_sync_delivery_to_order')
      expect(sql).not.toContain('trg_sync_delivery_to_order')
    })
  })

  describe('5. Vendor Fulfillment RPCs (§4)', () => {
    it('creates update_order_status_vendor with strict sequential state transitions and SQLSTATE codes', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_order_status_vendor')
      expect(sql).toContain('WHERE profile_id = auth.uid();')
      expect(sql).toContain("RAISE EXCEPTION 'Caller is not a registered vendor profile' USING ERRCODE = 'KD403';")
      expect(sql).toContain("IF v_old_status = 'payment_confirmed' AND p_new_status = 'preparing'")
      expect(sql).toContain("ELSIF v_old_status = 'preparing' AND p_new_status = 'ready_for_pickup'")
      expect(sql).toContain("USING ERRCODE = 'KD409';")
      expect(sql).toContain("preparing_at = COALESCE(preparing_at, pg_catalog.now())")
      expect(sql).toContain("ready_at = COALESCE(ready_at, pg_catalog.now())")
    })

    it('creates vendor_reject_order with standardized lock hierarchy, tracking history, and semantic audit entity IDs', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.vendor_reject_order')
      expect(sql).toContain("IF v_order.status <> 'payment_confirmed' THEN")
      expect(sql).toContain("refund_required = true")
      expect(sql).toContain("refund_status = 'pending_manual_review'")
      expect(sql).toContain("status = 'cancelled'")
      expect(sql).toContain("status IN ('assigned', 'accepted')")
      expect(sql).toContain("'delivery_cancelled_operational'")
      expect(sql).toContain("'assignment_cancelled_order_cancellation'")
      expect(sql).toContain("'delivery_assignments'")
      expect(sql).toContain('INSERT INTO public.delivery_status_updates')
    })
  })

  describe('6. Dispatch & Rider Assignment RPCs (§5)', () => {
    it('creates assign_delivery_to_rider with standardized lock ordering (orders -> deliveries -> assignments -> riders)', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_delivery_to_rider')
      expect(sql).toContain("v_role NOT IN ('admin', 'super_admin')")
      expect(sql).toContain('SELECT order_id INTO v_order_id\n  FROM public.deliveries\n  WHERE id = p_delivery_id;')
      expect(sql).toContain('WHERE id = v_order_id\n    FOR UPDATE;')
      expect(sql).toContain('WHERE id = p_delivery_id\n  FOR UPDATE;')
      expect(sql).toContain("v_order.service_type IN ('food', 'grocery') AND v_order.status NOT IN ('payment_confirmed', 'preparing', 'ready_for_pickup')")
      expect(sql).toContain("v_order.service_type = 'courier' AND v_order.status <> 'payment_confirmed'")
      expect(sql).toContain('WHERE id = p_rider_id\n  FOR UPDATE;')
      expect(sql).toContain("IF NOT (v_rider.is_verified AND v_rider.is_active AND v_rider.is_available) THEN")
      expect(sql).toContain("Rider % already has an active in-flight delivery")
      expect(sql).toContain('INSERT INTO public.delivery_assignments')
      expect(sql).toContain('assigned_by,')
      expect(sql).toContain("status = 'assigned'")
    })
  })

  describe('7. Dedicated Assignment Acceptance & Rejection RPCs (§6)', () => {
    it('creates accept_delivery_assignment with standardized lock ordering, rechecking rider concurrency', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.accept_delivery_assignment')
      expect(sql).toContain("IF v_assignment_peek.status = 'accepted' THEN")
      expect(sql).toContain('RETURN;')
      expect(sql).toContain("IF v_delivery.status <> 'assigned' THEN")
      expect(sql).toContain("IF v_order.status IN ('cancelled', 'delivered') THEN")
      expect(sql).toContain("SET status = 'accepted'")
      expect(sql).toContain('responded_at = pg_catalog.now()')
      expect(sql).toContain('WHERE id = v_assignment_peek.order_id\n    FOR UPDATE;')
      expect(sql).toContain('WHERE id = v_assignment_peek.delivery_id\n  FOR UPDATE;')
    })

    it('creates reject_delivery_assignment with standardized lock ordering reverting delivery to pending only if still assigned', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.reject_delivery_assignment')
      expect(sql).toContain("SET status = 'rejected'")
      expect(sql).toContain("IF NOT FOUND THEN\n    RAISE EXCEPTION 'Associated delivery % not found'")
      expect(sql).toContain("IF v_delivery.status = 'assigned' THEN")
      expect(sql).toContain("UPDATE public.deliveries")
      expect(sql).toContain("SET status = 'pending'")
      expect(sql).toContain('responded_at = pg_catalog.now()')
    })
  })

  describe('8. Rider Logistics Custody RPCs (§7)', () => {
    it('creates mark_delivery_picked_up with standardized lock hierarchy and service-specific readiness checks', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_picked_up')
      expect(sql).toContain('SELECT order_id INTO v_order_id\n  FROM public.deliveries\n  WHERE id = p_delivery_id;')
      expect(sql).toContain("v_order.service_type IN ('food', 'grocery') AND v_order.status <> 'ready_for_pickup'")
      expect(sql).toContain("v_order.service_type = 'courier' AND v_order.status <> 'payment_confirmed'")
      expect(sql).toContain("UPDATE public.orders")
      expect(sql).toContain("SET status = 'picked_up'")
      expect(sql).toContain("UPDATE public.deliveries")
      expect(sql).toContain("SET status = 'picked_up'")
      expect(sql).toContain('INSERT INTO public.delivery_status_updates (\n    delivery_id, old_status, new_status, updated_by, notes, created_at\n  )')
      expect(sql).toContain("'assigned', 'picked_up'")
    })

    it('creates mark_delivery_in_transit enforcing cross-state invariant (order must be picked_up)', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_in_transit')
      expect(sql).toContain("IF v_order.status <> 'picked_up' THEN")
      expect(sql).toContain("must be ''picked_up'' to transition to in_transit")
      expect(sql).toContain("IF v_delivery.status <> 'picked_up' THEN")
      expect(sql).toContain("SET status = 'in_transit'")
      expect(sql).toContain('INSERT INTO public.delivery_status_updates (\n    delivery_id, old_status, new_status, updated_by, notes, created_at\n  )')
      expect(sql).toContain("'picked_up', 'in_transit'")
    })

    it('creates mark_delivery_delivered enforcing cross-state invariant (order must be in_transit) and idempotency', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mark_delivery_delivered')
      expect(sql).toContain("IF v_delivery.status = 'delivered' THEN")
      expect(sql).toContain('RETURN;')
      expect(sql).toContain("IF v_order_id IS NOT NULL AND v_order.status <> 'in_transit' THEN")
      expect(sql).toContain("must be ''in_transit'' to complete delivery")
      expect(sql).toContain("SET status = 'delivered'")
      expect(sql).toContain("UPDATE public.delivery_assignments")
      expect(sql).toContain("SET status = 'completed'")
      expect(sql).toContain('total_deliveries = total_deliveries + 1')
      expect(sql).toContain('INSERT INTO public.delivery_status_updates (\n    delivery_id, old_status, new_status, updated_by, notes, created_at\n  )')
      expect(sql).toContain("'in_transit', 'delivered'")
    })
  })

  describe('9. Operational Cancellation & Refund Marker (§8)', () => {
    it('creates cancel_order_operational enforcing role boundaries, recording delivery tracking, and using semantic audit IDs', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.cancel_order_operational')
      expect(sql).toContain("v_order.status IN ('delivered', 'cancelled')")
      expect(sql).toContain("v_order.customer_id = v_user_id")
      expect(sql).toContain("v_order.status NOT IN ('pending', 'payment_pending')")
      expect(sql).toContain('Customers cannot cancel orders once payment is confirmed or in fulfillment')
      expect(sql).toContain("refund_required = v_was_paid")
      expect(sql).toContain("refund_status = CASE WHEN v_was_paid THEN 'pending_manual_review' ELSE 'none' END")
      expect(sql).toContain("order_post_pickup_cancellation_incident")
      expect(sql).toContain("UPDATE public.deliveries")
      expect(sql).toContain("SET status = 'cancelled'")
      expect(sql).toContain('INSERT INTO public.delivery_status_updates')
      expect(sql).toContain("'delivery_cancelled_operational'")
      expect(sql).toContain("'assignment_cancelled_order_cancellation'")
      expect(sql).toContain("'delivery_assignments'")
    })
  })

  describe('10. Dedicated Courier Order Ingestion RPC (§9)', () => {
    it('creates create_courier_order_secure with safe parameter order, geographic validation, and deterministic pricing tie-breaker', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_courier_order_secure')
      expect(sql).toContain('p_idempotency_key      text,\n  p_special_instructions text DEFAULT NULL\n)')
      expect(sql).toContain("A valid idempotency key is required")
      expect(sql).toContain("service_type = 'courier'")
      expect(sql).toContain('public.is_location_in_service_area(p_pickup_lat, p_pickup_lon)')
      expect(sql).toContain('public.is_location_in_service_area(p_delivery_lat, p_delivery_lon)')
      expect(sql).toContain('ORDER BY created_at ASC, id ASC\n  LIMIT 1;')
      expect(sql).toContain('calculate_distance_km')
      expect(sql).toContain('ORDER BY tier ASC, effective_date DESC, created_at DESC, id DESC')
      expect(sql).toContain('INSERT INTO public.orders')
      expect(sql).toContain('pickup_contact,\n      pickup_phone,\n      delivery_contact,\n      delivery_phone')
      expect(sql).toContain('idempotency_key')
      expect(sql).toContain('EXCEPTION\n    WHEN unique_violation THEN')
      expect(sql).toContain("'idempotent_replayed', true")
    })
  })

  describe('11. RLS Hardening, Mutation Revocation & Policy Cleanup (§10)', () => {
    it('explicitly drops legacy permissive policies that bypassed RPCs', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "orders_update_vendor" ON public.orders;')
      expect(sql).toContain('DROP POLICY IF EXISTS "delivery_assignments_update_own_rider" ON public.delivery_assignments;')
      expect(sql).toContain('DROP POLICY IF EXISTS "delivery_status_updates_insert_rider" ON public.delivery_status_updates;')
    })

    it('explicitly revokes all access from anon and mutation privileges from authenticated on operational tables', () => {
      expect(sql).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders FROM anon;')
      expect(sql).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.deliveries FROM anon;')
      expect(sql).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.delivery_assignments FROM anon;')
      expect(sql).toContain('REVOKE SELECT, INSERT, UPDATE, DELETE ON public.delivery_status_updates FROM anon;')
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;')
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.deliveries FROM authenticated;')
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.delivery_assignments FROM authenticated;')
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.delivery_status_updates FROM authenticated;')
    })

    it('enables RLS and defines customer, vendor, rider, and admin SELECT policies', () => {
      expect(sql).toContain('ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('ALTER TABLE public.delivery_status_updates ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('CREATE POLICY "orders_select_admin" ON public.orders')
      expect(sql).toContain('CREATE POLICY "deliveries_select_customer" ON public.deliveries')
      expect(sql).toContain('CREATE POLICY "deliveries_select_vendor" ON public.deliveries')
      expect(sql).toContain('CREATE POLICY "deliveries_select_rider" ON public.deliveries')
      expect(sql).toContain('CREATE POLICY "deliveries_select_admin" ON public.deliveries')
      expect(sql).toContain('CREATE POLICY "assignments_select_customer" ON public.delivery_assignments')
      expect(sql).toContain('CREATE POLICY "assignments_select_rider" ON public.delivery_assignments')
      expect(sql).toContain('CREATE POLICY "assignments_select_admin" ON public.delivery_assignments')
      expect(sql).toContain('CREATE POLICY "updates_select_operational" ON public.delivery_status_updates')
    })

    it('grants EXECUTE on all operational RPCs strictly to authenticated role', () => {
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.vendor_reject_order(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.mark_delivery_in_transit(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) TO authenticated;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.create_courier_order_secure(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) TO authenticated;')
    })
  })
})
