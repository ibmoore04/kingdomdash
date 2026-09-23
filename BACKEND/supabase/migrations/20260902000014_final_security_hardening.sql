-- =============================================================================
-- Migration: 20260902000014_final_security_hardening.sql
-- Purpose : Final security hardening pass — KingdomDash Phase 2
-- Applies after migrations 001–013
-- =============================================================================
--
-- SECTION OVERVIEW
-- ─────────────────────────────────────────────────────────────────────────────
-- §1  Drop fragile WITH CHECK policies introduced in migration 013
--     Affected: riders_update_own, delivery_assignments_update_own_rider,
--               notifications_update_own, orders_update_own_vendor
--
-- §2  RPC: update_rider_availability(p_is_available boolean)
--     SECURITY DEFINER — resolves rider via profile_id → riders.id,
--     updates ONLY is_available. Replaces riders_update_own policy.
--
-- §3  RPC: accept_delivery_assignment(p_assignment_id uuid)
--     SECURITY DEFINER — validates rider ownership and assigned→accepted
--     status transition. Replaces delivery_assignments_update_own_rider.
--
-- §4  RPC: reject_delivery_assignment(p_assignment_id uuid)
--     SECURITY DEFINER — validates rider ownership and assigned→rejected
--     status transition. Replaces delivery_assignments_update_own_rider.
--
-- §5  RPC: mark_notification_read(p_notification_id uuid)
--     SECURITY DEFINER — validates profile_id ownership, flips is_read only.
--     Replaces notifications_update_own policy.
--
-- §6  RPC: update_order_status_vendor(p_order_id uuid, p_new_status order_status)
--     SECURITY DEFINER — validates vendor ownership and status transitions
--     payment_confirmed→preparing and preparing→ready_for_pickup only.
--     Replaces orders_update_own_vendor policy.
--
-- §7  Trigger function: validate_product_category_vendor()
--     SECURITY INVOKER BEFORE INSERT OR UPDATE ON products
--     Prevents cross-vendor category assignment (product.vendor_id must match
--     category.vendor_id when category_id is not NULL).
--
-- §8  Unique partial indexes: uq_active_pricing_rule_*
--     Four partial indexes covering all NULL/non-NULL cases for
--     (service_type, service_area_id) — makes pricing selection deterministic.
--
-- §9  Idempotent CHECK constraint guard
--     riders_total_deliveries_nonneg (already added in 013; DO block skips if present).
--
-- §10 Re-confirm PUBLIC EXECUTE revocation on all new functions from this migration
-- =============================================================================


-- =============================================================================
-- §1  DROP FRAGILE WITH CHECK POLICIES
-- =============================================================================
-- These four policies were added/replaced in migration 013 and contain
-- unqualified `id` self-references in subquery WHERE clauses.  While
-- PostgreSQL WITH CHECK resolves bare `id` to NEW.id (correct semantics
-- in most cases), the pattern is fragile:
--   • `WHERE da.id = id`  —  id resolves to NEW.id which is right, but
--     the query re-reads the same row from the same table inside a lock,
--     risking subtle ordering issues under concurrent updates.
--   • Any schema change that adds a column named `id` to a joined subquery
--     would silently re-bind the reference.
-- All four policies are replaced with SECURITY DEFINER RPCs (§2–§6).
-- The SELECT policies and admin-level ALL policies are preserved unchanged.

-- Drop the fragile riders UPDATE policy (replaced by update_rider_availability RPC)
DROP POLICY IF EXISTS "riders_update_own" ON public.riders;

-- Drop the fragile delivery_assignments UPDATE policy (replaced by accept/reject RPCs)
DROP POLICY IF EXISTS "delivery_assignments_update_own_rider" ON public.delivery_assignments;

-- Drop the fragile notifications UPDATE policy (replaced by mark_notification_read RPC)
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- Drop the fragile orders UPDATE policy for vendors (replaced by update_order_status_vendor RPC)
DROP POLICY IF EXISTS "orders_update_own_vendor" ON public.orders;


-- =============================================================================
-- §2  RPC: update_rider_availability
-- =============================================================================
-- Replaces riders_update_own RLS policy.
-- Only the is_available boolean may be changed.
-- All other rider fields (total_deliveries, rating, profile_id) are system-
-- controlled and cannot be touched by this function.
--
-- Security properties:
--   • SECURITY DEFINER — bypasses RLS to perform a targeted UPDATE.
--   • SET search_path = public — prevents search_path injection attacks.
--   • Caller identity resolved via auth.uid() → riders.profile_id.
--   • Only the is_available column is included in the SET clause.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_rider_availability(
  p_is_available boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id uuid;
BEGIN
  -- Resolve the rider row for the calling user
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rider profile found for current user';
  END IF;

  -- Update ONLY is_available; all other fields are untouched
  UPDATE public.riders
  SET is_available = p_is_available
  WHERE id = v_rider_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_rider_availability(boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_rider_availability(boolean) TO authenticated;


-- =============================================================================
-- §3  RPC: accept_delivery_assignment
-- =============================================================================
-- Replaces the accept path of delivery_assignments_update_own_rider.
-- Transitions status: 'assigned' → 'accepted'.
--
-- Security properties:
--   • SECURITY DEFINER — bypasses RLS for a targeted, validated UPDATE.
--   • SET search_path = public — prevents search_path injection.
--   • Validates assignment belongs to the calling rider.
--   • Validates current status = 'assigned' before accepting.
--   • Only the status column is updated.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_delivery_assignment(
  p_assignment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id   uuid;
  v_assignment record;
BEGIN
  -- Resolve rider for calling user
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rider profile found for current user';
  END IF;

  -- Load the assignment, asserting it belongs to this rider
  SELECT id, rider_id, status
  INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery assignment % not found', p_assignment_id;
  END IF;

  IF v_assignment.rider_id <> v_rider_id THEN
    RAISE EXCEPTION 'Assignment % does not belong to the current rider', p_assignment_id;
  END IF;

  -- Guard: only 'assigned' → 'accepted' is permitted
  IF v_assignment.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot accept assignment in status %; must be ''assigned''',
      v_assignment.status;
  END IF;

  -- Perform the narrow status update
  UPDATE public.delivery_assignments
  SET status = 'accepted'
  WHERE id = p_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid) TO authenticated;


-- =============================================================================
-- §4  RPC: reject_delivery_assignment
-- =============================================================================
-- Replaces the reject path of delivery_assignments_update_own_rider.
-- Transitions status: 'assigned' → 'rejected'.
--
-- Security properties: identical to accept_delivery_assignment above.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reject_delivery_assignment(
  p_assignment_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rider_id   uuid;
  v_assignment record;
BEGIN
  -- Resolve rider for calling user
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rider profile found for current user';
  END IF;

  -- Load the assignment
  SELECT id, rider_id, status
  INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery assignment % not found', p_assignment_id;
  END IF;

  IF v_assignment.rider_id <> v_rider_id THEN
    RAISE EXCEPTION 'Assignment % does not belong to the current rider', p_assignment_id;
  END IF;

  -- Guard: only 'assigned' → 'rejected' is permitted
  IF v_assignment.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''',
      v_assignment.status;
  END IF;

  -- Perform the narrow status update
  UPDATE public.delivery_assignments
  SET status = 'rejected'
  WHERE id = p_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid) TO authenticated;


-- =============================================================================
-- §5  RPC: mark_notification_read
-- =============================================================================
-- Replaces notifications_update_own RLS policy.
-- Sets is_read = true on the caller's notification; nothing else mutates.
--
-- Security properties:
--   • SECURITY DEFINER + SET search_path = public.
--   • Validates profile_id = auth.uid() before updating.
--   • Only the is_read column is set in the UPDATE.
--   • Does not expose notification content in error messages.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(
  p_notification_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification record;
BEGIN
  -- Load the notification
  SELECT id, profile_id
  INTO v_notification
  FROM public.notifications
  WHERE id = p_notification_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found';
  END IF;

  -- Ownership check: only the notification's owner may mark it read
  IF v_notification.profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'Notification does not belong to current user';
  END IF;

  -- Flip only is_read; no other column is touched
  UPDATE public.notifications
  SET is_read = true
  WHERE id = p_notification_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;


-- =============================================================================
-- §6  RPC: update_order_status_vendor
-- =============================================================================
-- Replaces orders_update_own_vendor RLS policy.
-- Vendors may only transition orders through exactly two paths:
--   payment_confirmed → preparing
--   preparing         → ready_for_pickup
-- Financial fields (subtotal, total, delivery_fee) are never touched.
--
-- Security properties:
--   • SECURITY DEFINER + SET search_path = public.
--   • Resolves vendor via auth.uid() → vendors.profile_id → vendors.id.
--   • Validates order.vendor_id = caller's vendor.id.
--   • Enforces explicit allowlist of (current_status → new_status) transitions.
--   • Only the status column is updated.
--   • No financial or ownership data can be modified through this function.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_order_status_vendor(
  p_order_id   uuid,
  p_new_status order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
  v_order     record;
BEGIN
  -- Resolve the vendor for the calling user
  SELECT id INTO v_vendor_id
  FROM public.vendors
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No vendor profile found for current user';
  END IF;

  -- Load the order
  SELECT id, vendor_id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- Ownership check
  IF v_order.vendor_id <> v_vendor_id THEN
    RAISE EXCEPTION 'Order % does not belong to the current vendor', p_order_id;
  END IF;

  -- Enforce transition allowlist:
  --   payment_confirmed → preparing
  --   preparing         → ready_for_pickup
  -- All other combinations are rejected.
  IF NOT (
    (v_order.status = 'payment_confirmed' AND p_new_status = 'preparing')
    OR
    (v_order.status = 'preparing'         AND p_new_status = 'ready_for_pickup')
  ) THEN
    RAISE EXCEPTION
      'Vendor cannot transition order from ''%'' to ''%''. Allowed: payment_confirmed→preparing, preparing→ready_for_pickup',
      v_order.status, p_new_status;
  END IF;

  -- Update ONLY the status field; financial and ownership fields are untouched
  UPDATE public.orders
  SET status = p_new_status
  WHERE id = p_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status) TO authenticated;


-- =============================================================================
-- §7  TRIGGER FUNCTION: validate_product_category_vendor
-- =============================================================================
-- Prevents cross-vendor category assignment on products.
-- A product's category_id (when not NULL) must reference a category whose
-- vendor_id equals the product's own vendor_id.
--
-- Without this guard, a vendor could set their product's category_id to a
-- category belonging to a different vendor, poisoning the category hierarchy.
--
-- Security properties:
--   • SECURITY INVOKER — runs as the calling user; safe because we only
--     SELECT from categories (no privilege escalation risk).
--   • Raises an EXCEPTION to abort the DML if the constraint is violated.
--   • Fires BEFORE INSERT OR UPDATE so invalid rows never reach storage.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_product_category_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_category_vendor_id uuid;
BEGIN
  -- Only check when category_id is explicitly set
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch the vendor_id of the referenced category
  SELECT vendor_id INTO v_category_vendor_id
  FROM public.categories
  WHERE id = NEW.category_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
  END IF;

  -- Cross-vendor integrity check
  IF v_category_vendor_id <> NEW.vendor_id THEN
    RAISE EXCEPTION
      'Category % belongs to a different vendor; cannot assign to product with vendor_id %',
      NEW.category_id, NEW.vendor_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are PUBLIC EXECUTE by default — revoke immediately
REVOKE EXECUTE ON FUNCTION public.validate_product_category_vendor() FROM PUBLIC;

-- Attach trigger to products table
DROP TRIGGER IF EXISTS trg_validate_product_category_vendor ON public.products;
CREATE TRIGGER trg_validate_product_category_vendor
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_category_vendor();


-- =============================================================================
-- §8  UNIQUE PARTIAL INDEXES: pricing rule determinism
-- =============================================================================
-- Ensures at most one active pricing rule exists per (service_type, service_area_id)
-- combination, making pricing rule selection deterministic.
--
-- Four partial indexes cover the four NULL/non-NULL cases:
--   1. Both NULL    → one global default rule
--   2. type set, area NULL → one rule per service type globally
--   3. type NULL, area set → one rule per area globally
--   4. Both set     → one rule per (type + area) pair
--
-- Why not a single expression index with COALESCE(service_type::text, '__null__')?
-- PostgreSQL requires index expressions to be IMMUTABLE. Casting an enum to text
-- is STABLE, so Postgres rejects it with error 42P17. The four-index approach
-- avoids all function calls in the index expressions.
-- =============================================================================

-- uq_active_pricing_rule: at most one active rule per (service_type, service_area_id).
--
-- Why not COALESCE(service_type::text, '__null__')?
-- PostgreSQL requires index expressions to be IMMUTABLE. Casting an enum to text
-- is STABLE, not IMMUTABLE, so Postgres rejects it in index expressions.
--
-- Fix: four partial unique indexes covering all combinations of NULL / non-NULL,
-- which are each simple column equality checks (no function calls):
--   1. Both NULL    — one global default rule
--   2. type set, area NULL — one rule per service type globally
--   3. type NULL, area set — one rule per area globally
--   4. Both set     — one rule per (type, area) pair

-- Case 1: global default (service_type IS NULL AND service_area_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pricing_rule_global
  ON public.delivery_pricing_rules (is_active)
  WHERE is_active = true
    AND service_type IS NULL
    AND service_area_id IS NULL;

-- Case 2: service-type specific, no area
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pricing_rule_by_type
  ON public.delivery_pricing_rules (service_type)
  WHERE is_active = true
    AND service_type IS NOT NULL
    AND service_area_id IS NULL;

-- Case 3: area specific, no service type
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pricing_rule_by_area
  ON public.delivery_pricing_rules (service_area_id)
  WHERE is_active = true
    AND service_type IS NULL
    AND service_area_id IS NOT NULL;

-- Case 4: service type + area both specified
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_pricing_rule_by_type_and_area
  ON public.delivery_pricing_rules (service_type, service_area_id)
  WHERE is_active = true
    AND service_type IS NOT NULL
    AND service_area_id IS NOT NULL;


-- =============================================================================
-- §9  IDEMPOTENT CHECK CONSTRAINT GUARD
-- =============================================================================
-- riders_total_deliveries_nonneg was added in migration 013.
-- This block is a no-op if the constraint already exists (which it should),
-- and adds it if somehow this migration is applied without 013.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint
    WHERE  conname = 'riders_total_deliveries_nonneg'
    AND    conrelid = 'public.riders'::regclass
  ) THEN
    ALTER TABLE public.riders
      ADD CONSTRAINT riders_total_deliveries_nonneg
      CHECK (total_deliveries >= 0);
  END IF;
END;
$$;


-- =============================================================================
-- §10  CONFIRM PUBLIC EXECUTE REVOCATION ON ALL NEW FUNCTIONS IN THIS MIGRATION
-- =============================================================================
-- These REVOKE statements are already executed immediately after each CREATE
-- FUNCTION above (§2–§7). This section re-states them explicitly as a
-- defence-in-depth measure and audit trail.
--
-- Functions from migration 013 that were already restricted:
--   get_current_user_role()               → EXECUTE TO authenticated only
--   get_own_profile_flags()               → EXECUTE TO authenticated only
--   create_order_secure(...)              → EXECUTE TO authenticated only
--   increment_rider_deliveries()          → PUBLIC revoked (trigger-only)
--   handle_new_user()                     → PUBLIC revoked (trigger-only)
--   set_updated_at()                      → PUBLIC revoked (trigger-only)
--   validate_order_vendor_constraint()    → PUBLIC revoked (trigger-only)
--   validate_delivery_vendor_constraint() → PUBLIC revoked (trigger-only)
--
-- New functions from this migration (014) — final revocation confirmation:
REVOKE EXECUTE ON FUNCTION public.update_rider_availability(boolean)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid)                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_notification_read(uuid)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_product_category_vendor()              FROM PUBLIC;

-- =============================================================================
-- END OF MIGRATION 014
-- =============================================================================
-- Summary of changes applied:
--
-- Policies DROPPED (4):
--   riders_update_own
--   delivery_assignments_update_own_rider
--   notifications_update_own
--   orders_update_own_vendor
--
-- SECURITY DEFINER RPCs CREATED (5):
--   update_rider_availability(boolean)
--   accept_delivery_assignment(uuid)
--   reject_delivery_assignment(uuid)
--   mark_notification_read(uuid)
--   update_order_status_vendor(uuid, order_status)
--
-- SECURITY INVOKER trigger function CREATED (1):
--   validate_product_category_vendor() — with BEFORE INSERT OR UPDATE trigger
--
-- Indexes CREATED (4):
--   uq_active_pricing_rule_global         (global default rule: both NULL)
--   uq_active_pricing_rule_by_type        (per service_type, no area)
--   uq_active_pricing_rule_by_area        (per area, no service_type)
--   uq_active_pricing_rule_by_type_and_area (per service_type + area)
--
-- Constraint GUARD (1):
--   riders_total_deliveries_nonneg — no-op if present, adds if missing
-- =============================================================================
