-- Migration: 20260902000013_security_corrections.sql
-- Purpose: Security corrections following full audit of migrations 001–012
--
-- REVISION NOTE: Sections 7, 8, 9, 10 originally created policies with
-- ambiguous bare `id` references in WITH CHECK subqueries (e.g. WHERE da.id = id).
-- PostgreSQL/Supabase rejects these with "column reference id is ambiguous".
-- Those sections now only DROP the original policies. Migration 014 replaces
-- them with SECURITY DEFINER RPCs, which is the correct long-term approach.
--
-- Issues addressed (in order of severity):
--
-- CRITICAL:
--   C1. Block direct INSERT on orders/order_items — enforces create_order_secure() as sole path
--   C2. Fix profiles_update_own WITH CHECK — replace with get_own_profile_flags() helper
--   C3. Drop riders_update_own (replaced by update_rider_availability RPC in migration 014)
--   C4. Drop delivery_assignments_update_own_rider (replaced by accept/reject RPCs in 014)
--   C5. Revoke PUBLIC EXECUTE on all functions that don't need it
--   C6. Harden create_order_secure — integer truncation guard, quantity upper limit
--
-- HIGH:
--   H1. Drop notifications_update_own (replaced by mark_notification_read RPC in 014)
--   H2. Drop orders_update_own_vendor (replaced by update_order_status_vendor RPC in 014)
--   H3. Fix increment_rider_deliveries to SECURITY DEFINER — resolves RLS conflict
--   H4. Add riders.total_deliveries >= 0 CHECK constraint
--
-- MEDIUM:
--   M1. Partial UNIQUE index on vendor_applications/rider_applications — one pending per user
--   M2. Prevent admin self-promotion to super_admin

-- ============================================================
-- SECTION 1: REVOKE PUBLIC EXECUTE on all functions
-- ============================================================
-- PostgreSQL grants EXECUTE to PUBLIC by default on CREATE FUNCTION.
-- Revoke PUBLIC and grant only to roles that legitimately need direct calls.

REVOKE EXECUTE ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_order_vendor_constraint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_delivery_vendor_constraint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_rider_deliveries() FROM PUBLIC;

-- ============================================================
-- SECTION 2: Fix increment_rider_deliveries — change to SECURITY DEFINER
-- ============================================================
-- When an admin triggers delivery_assignments UPDATE (status → 'completed'),
-- the SECURITY INVOKER trigger runs as the admin. The admin's profile_id ≠
-- the rider's profile_id, so UPDATE on riders.total_deliveries would silently
-- affect 0 rows under the riders_select_own RLS policy.
-- FIX: SECURITY DEFINER bypasses RLS for this narrow, audited UPDATE.

CREATE OR REPLACE FUNCTION public.increment_rider_deliveries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_rider_deliveries() FROM PUBLIC;

-- ============================================================
-- SECTION 3: Add CHECK constraint — riders.total_deliveries >= 0
-- ============================================================
ALTER TABLE public.riders
  ADD CONSTRAINT riders_total_deliveries_nonneg CHECK (total_deliveries >= 0);

-- ============================================================
-- SECTION 4: Create get_own_profile_flags() SECURITY DEFINER helper
-- ============================================================
-- Used by profiles_update_own WITH CHECK to read the calling user's
-- current role and is_active without triggering recursive RLS evaluation.

CREATE OR REPLACE FUNCTION public.get_own_profile_flags(
  OUT p_role user_role,
  OUT p_is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role, is_active
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_profile_flags(OUT user_role, OUT boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_own_profile_flags(OUT user_role, OUT boolean) TO authenticated;

-- ============================================================
-- SECTION 5: Fix profiles_update_own
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role      = (SELECT p_role      FROM public.get_own_profile_flags())
    AND is_active = (SELECT p_is_active FROM public.get_own_profile_flags())
  );

-- ============================================================
-- SECTION 6: Remove direct INSERT access to orders and order_items
-- ============================================================
-- Orders must only be created via create_order_secure() SECURITY DEFINER RPC.

DROP POLICY IF EXISTS "orders_insert_own_customer" ON public.orders;
DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;

-- ============================================================
-- SECTION 7: Drop riders_update_own
-- ============================================================
-- The original unrestricted policy allowed riders to update any column.
-- Dropped here; migration 014 installs the secure update_rider_availability()
-- SECURITY DEFINER RPC as the only permitted rider update path.

DROP POLICY IF EXISTS "riders_update_own" ON public.riders;

-- ============================================================
-- SECTION 8: Drop delivery_assignments_update_own_rider
-- ============================================================
-- The original policy had no WITH CHECK. Dropped here; migration 014 installs
-- accept_delivery_assignment() and reject_delivery_assignment() SECURITY DEFINER
-- RPCs as the only permitted assignment status transition paths.

DROP POLICY IF EXISTS "delivery_assignments_update_own_rider" ON public.delivery_assignments;

-- ============================================================
-- SECTION 9: Drop notifications_update_own
-- ============================================================
-- The original policy allowed updating any notification column. Dropped here;
-- migration 014 installs mark_notification_read() SECURITY DEFINER RPC as the
-- only permitted owner-level notification update path (sets is_read = true only).

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- ============================================================
-- SECTION 10: Drop orders_update_own_vendor
-- ============================================================
-- The original policy allowed vendors to update any order column. Dropped here;
-- migration 014 installs update_order_status_vendor() SECURITY DEFINER RPC as
-- the only permitted vendor order update path (status transitions only).

DROP POLICY IF EXISTS "orders_update_own_vendor" ON public.orders;

-- ============================================================
-- SECTION 11: Harden create_order_secure
-- ============================================================
-- Adds: integer truncation guard, decimal rejection, quantity upper limit (999),
-- max 50 item lines, jsonb_typeof array check, UUID format validation.

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_vendor_id            uuid,
  p_service_type         service_type,
  p_pickup_address       text,
  p_delivery_address     text,
  p_items                jsonb,
  p_special_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       uuid;
  v_order_id      uuid;
  v_vendor        record;
  v_product       record;
  v_item          jsonb;
  v_subtotal      numeric(12,2) := 0;
  v_item_quantity integer;
  v_product_id    uuid;
  v_qty_raw       text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_service_type = 'courier' THEN
    RAISE EXCEPTION 'create_order_secure does not support courier orders';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item in a valid JSON array';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 distinct item lines';
  END IF;

  SELECT id, is_active INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  INSERT INTO public.orders (
    customer_id, vendor_id, service_type,
    pickup_address, delivery_address,
    delivery_fee, subtotal, total, special_instructions
  )
  VALUES (
    v_user_id, p_vendor_id, p_service_type,
    p_pickup_address, p_delivery_address,
    0, 0, 0, p_special_instructions
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty_raw := v_item->>'quantity';
    IF v_qty_raw IS NULL THEN
      RAISE EXCEPTION 'Each item must have a "quantity" field';
    END IF;
    IF v_qty_raw ~ '\.' THEN
      RAISE EXCEPTION 'Item quantity must be a whole number, got: %', v_qty_raw;
    END IF;
    BEGIN
      v_item_quantity := v_qty_raw::integer;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Item quantity must be a valid integer, got: %', v_qty_raw;
    END;
    IF v_item_quantity <= 0 OR v_item_quantity > 999 THEN
      RAISE EXCEPTION 'Item quantity must be between 1 and 999, got: %', v_item_quantity;
    END IF;

    IF v_item->>'product_id' IS NULL THEN
      RAISE EXCEPTION 'Each item must have a "product_id" field';
    END IF;
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Item product_id is not a valid UUID: %', v_item->>'product_id';
    END;

    SELECT id, name, price INTO v_product
    FROM public.products
    WHERE id = v_product_id
      AND vendor_id = p_vendor_id
      AND is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found, unavailable, or belongs to a different vendor', v_product_id;
    END IF;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_item_quantity,
      v_product.price * v_item_quantity
    );

    v_subtotal := v_subtotal + (v_product.price * v_item_quantity);
  END LOOP;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total    = v_subtotal
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) TO authenticated;

-- ============================================================
-- SECTION 12: Partial unique indexes — one pending application per user
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_applications_pending_per_profile
  ON public.vendor_applications (profile_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_applications_pending_per_profile
  ON public.rider_applications (profile_id)
  WHERE status = 'pending';

-- ============================================================
-- SECTION 13: Prevent admin self-promotion to super_admin
-- ============================================================
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (
    role <> 'super_admin'
    OR get_current_user_role() = 'super_admin'
  );

-- ============================================================
-- SECTION 14: Add missing index — addresses(profile_id)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_addresses_profile_id ON public.addresses(profile_id);

-- ============================================================
-- SECTION 15: Fix seed data — deterministic effective_date
-- ============================================================
UPDATE public.delivery_pricing_rules
SET effective_date = '2026-09-02'
WHERE service_type IS NULL
  AND base_fee = 500.00
  AND distance_rate = 100.0000
  AND is_active = true
  AND effective_date = CURRENT_DATE;
