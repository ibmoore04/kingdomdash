-- =============================================================================
-- Migration: 20260902000018_distance_based_delivery_pricing.sql
-- Purpose  : Phase 8 Distance-Based Delivery Pricing Engine
-- Applies after migrations 001–017
-- =============================================================================
-- Key Deliverables:
--   1. Orders Snapshot Extension:
--      - Adds distance_km numeric(10,3), pricing_rule_id uuid, delivery_address_id uuid
--      - Foreign keys ON DELETE SET NULL for immutable historical financial integrity
--      - Non-negative check constraint and performance indexes
--   2. Authoritative Delivery Fee Preview RPC:
--      - public.calculate_delivery_fee_preview(...)
--      - Restricted to authenticated users; validates caller owns delivery address
--      - Point-in-radius serviceability verification
--      - Geodesic distance calculation via public.calculate_distance_km()
--      - 4-tier deterministic pricing rule resolution
--   3. Authoritative Order Creation RPC:
--      - public.create_order_secure(...) updated with p_delivery_address_id
--      - Drops obsolete zero-delivery-fee 6-argument version
--      - Fully atomic server calculation of distance, delivery fee, subtotal, and total
--      - Complete isolation: zero client authority over any financial value
-- =============================================================================

-- =============================================================================
-- §1  ORDERS SNAPSHOT EXTENSION
-- =============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS distance_km numeric(10,3),
  ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES public.delivery_pricing_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_distance_km_nonneg'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT chk_orders_distance_km_nonneg
      CHECK (distance_km IS NULL OR distance_km >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_pricing_rule_id
  ON public.orders(pricing_rule_id);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_address_id
  ON public.orders(delivery_address_id);


-- =============================================================================
-- §2  RPC: calculate_delivery_fee_preview
-- =============================================================================
-- Computes an authoritative preview of delivery fee, straight-line distance,
-- serviceability, and selected pricing tier without writing to the database.
--
-- Security:
--   - SECURITY DEFINER to query pricing rules and vendor coordinates reliably.
--   - Strict search_path = public.
--   - Caller MUST be authenticated (auth.uid() IS NOT NULL).
--   - Address ownership verification: p_delivery_address_id MUST belong to auth.uid().
--   - No cross-customer address coordinate discovery possible.
--   - REVOKE FROM PUBLIC, anon. GRANT TO authenticated only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_preview(
  p_vendor_id            uuid,
  p_delivery_address_id  uuid,
  p_service_type         service_type
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id           uuid;
  v_address           record;
  v_vendor            record;
  v_service_area      record;
  v_rule              record;
  v_is_serviceable    boolean;
  v_distance_km       numeric(10,3);
  v_raw_fee           numeric(12,2);
  v_delivery_fee      numeric(12,2);
  v_service_area_name text := NULL;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Courier service type not handled by this preview
  IF p_service_type = 'courier' THEN
    RAISE EXCEPTION 'calculate_delivery_fee_preview does not support courier service type; use courier workflow';
  END IF;

  -- 3. Input presence checks
  IF p_vendor_id IS NULL THEN
    RAISE EXCEPTION 'p_vendor_id is required';
  END IF;
  IF p_delivery_address_id IS NULL THEN
    RAISE EXCEPTION 'p_delivery_address_id is required';
  END IF;

  -- 4. Address validation & ownership verification
  SELECT id, profile_id, latitude, longitude, service_area_id
  INTO v_address
  FROM public.addresses
  WHERE id = p_delivery_address_id AND profile_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery address not found or does not belong to the current customer';
  END IF;

  IF v_address.latitude IS NULL OR v_address.longitude IS NULL THEN
    RETURN jsonb_build_object(
      'is_serviceable', false,
      'error', 'Delivery address coordinates are missing. Please pin your location on the map.'
    );
  END IF;

  -- 5. Vendor validation
  SELECT id, is_active, latitude, longitude, service_area_id
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF v_vendor.latitude IS NULL OR v_vendor.longitude IS NULL THEN
    RAISE EXCEPTION 'Vendor location coordinates are missing or invalid';
  END IF;

  -- 6. Check Serviceability
  v_is_serviceable := public.is_location_in_service_area(
    v_address.latitude,
    v_address.longitude,
    v_address.service_area_id
  );

  -- Retrieve service area name for user-friendly UI display
  IF v_address.service_area_id IS NOT NULL THEN
    SELECT name INTO v_service_area_name
    FROM public.service_areas
    WHERE id = v_address.service_area_id;
  END IF;

  -- 7. Authoritative Geodesic Straight-Line Distance Calculation
  v_distance_km := public.calculate_distance_km(
    v_vendor.latitude,
    v_vendor.longitude,
    v_address.latitude,
    v_address.longitude
  );

  -- If address is not serviceable, return early with distance and unserviceable status
  IF NOT v_is_serviceable THEN
    RETURN jsonb_build_object(
      'is_serviceable', false,
      'distance_km', v_distance_km,
      'service_area_id', v_address.service_area_id,
      'service_area_name', v_service_area_name,
      'delivery_fee', null,
      'error', 'Delivery address is outside the active service area'
    );
  END IF;

  -- 8. Deterministic 4-Tier Pricing Rule Resolution
  SELECT
    id,
    base_fee,
    distance_rate,
    min_fee,
    max_fee,
    CASE
      WHEN service_type = p_service_type AND service_area_id = v_address.service_area_id THEN 1
      WHEN service_type = p_service_type AND service_area_id IS NULL THEN 2
      WHEN service_type IS NULL AND service_area_id = v_address.service_area_id THEN 3
      WHEN service_type IS NULL AND service_area_id IS NULL THEN 4
      ELSE 5
    END AS tier
  INTO v_rule
  FROM public.delivery_pricing_rules
  WHERE is_active = true
    AND effective_date <= CURRENT_DATE
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    AND (
      (service_type = p_service_type AND service_area_id = v_address.service_area_id)
      OR (service_type = p_service_type AND service_area_id IS NULL)
      OR (service_type IS NULL AND service_area_id = v_address.service_area_id)
      OR (service_type IS NULL AND service_area_id IS NULL)
    )
  ORDER BY
    tier ASC,
    effective_date DESC,
    created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active delivery pricing rule found for service % in area %',
      p_service_type, COALESCE(v_address.service_area_id::text, 'global');
  END IF;

  -- 9. Authoritative Delivery Fee Computation
  v_raw_fee := v_rule.base_fee + (v_distance_km * v_rule.distance_rate);
  v_delivery_fee := round(v_raw_fee, 2);

  -- Apply min_fee floor if configured
  IF v_rule.min_fee IS NOT NULL AND v_delivery_fee < v_rule.min_fee THEN
    v_delivery_fee := v_rule.min_fee;
  END IF;

  -- Apply max_fee ceiling if configured
  IF v_rule.max_fee IS NOT NULL AND v_delivery_fee > v_rule.max_fee THEN
    v_delivery_fee := v_rule.max_fee;
  END IF;

  -- 10. Return Typed JSON Snapshot
  RETURN jsonb_build_object(
    'is_serviceable', true,
    'distance_km', v_distance_km,
    'base_fee', v_rule.base_fee,
    'distance_rate', v_rule.distance_rate,
    'min_fee', v_rule.min_fee,
    'max_fee', v_rule.max_fee,
    'raw_fee', v_raw_fee,
    'delivery_fee', v_delivery_fee,
    'pricing_tier', v_rule.tier,
    'pricing_rule_id', v_rule.id,
    'service_area_id', v_address.service_area_id,
    'service_area_name', v_service_area_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) TO authenticated;

COMMENT ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type)
  IS 'Computes server-authoritative preview of delivery fee, distance, and serviceability for authenticated customers.';


-- =============================================================================
-- §3  RPC: create_order_secure — Distance-Based Pricing Hardened Version
-- =============================================================================
-- Replaces migration 015 version.
-- Key enhancements for Phase 8:
--   a) Adds p_delivery_address_id uuid parameter.
--   b) Drops obsolete 6-argument signature so no client can place ₦0 fee orders.
--   c) Verifies customer address ownership (addresses.profile_id = auth.uid()).
--   d) Checks point-in-radius serviceability (is_location_in_service_area).
--   e) Computes authoritative straight-line distance (calculate_distance_km).
--   f) Resolves deterministic 4-tier pricing rule from delivery_pricing_rules.
--   g) Computes server-authoritative delivery fee with round(2), min_fee, and max_fee.
--   h) FOR UPDATE row-locks products to compute authoritative subtotal.
--   i) Computes final total = subtotal + delivery_fee.
--   j) Atomically snapshots distance_km, pricing_rule_id, delivery_address_id on orders.
-- =============================================================================

-- Drop the obsolete 6-argument version to prevent bypassing delivery pricing
DROP FUNCTION IF EXISTS public.create_order_secure(uuid, service_type, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_vendor_id            uuid,
  p_service_type         service_type,
  p_pickup_address       text,
  p_delivery_address     text,
  p_items                jsonb,
  p_special_instructions text DEFAULT NULL,
  p_delivery_address_id  uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid;
  v_order_id         uuid;
  v_address          record;
  v_vendor           record;
  v_product          record;
  v_rule             record;
  v_item             jsonb;
  v_subtotal         numeric(12,2) := 0;
  v_distance_km      numeric(10,3);
  v_raw_fee          numeric(12,2);
  v_delivery_fee     numeric(12,2);
  v_total            numeric(12,2);
  v_item_quantity    integer;
  v_product_id       uuid;
  v_qty_raw          text;
  v_seen_product_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- 1. Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Courier orders not supported by this RPC
  IF p_service_type = 'courier' THEN
    RAISE EXCEPTION 'create_order_secure does not support courier orders; use the courier workflow';
  END IF;

  -- 3. Address text validation
  IF p_pickup_address IS NULL OR trim(p_pickup_address) = '' THEN
    RAISE EXCEPTION 'pickup_address is required and must not be empty';
  END IF;
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'delivery_address is required and must not be empty';
  END IF;

  -- 4. Authoritative delivery address validation & ownership verification
  IF p_delivery_address_id IS NULL THEN
    RAISE EXCEPTION 'p_delivery_address_id is required for food and grocery delivery orders';
  END IF;

  SELECT id, profile_id, latitude, longitude, service_area_id
  INTO v_address
  FROM public.addresses
  WHERE id = p_delivery_address_id AND profile_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery address not found or does not belong to the current customer';
  END IF;

  IF v_address.latitude IS NULL OR v_address.longitude IS NULL THEN
    RAISE EXCEPTION 'Delivery address coordinates are missing. Please pin your location on the map.';
  END IF;

  -- 5. Serviceability validation
  IF NOT public.is_location_in_service_area(v_address.latitude, v_address.longitude, v_address.service_area_id) THEN
    RAISE EXCEPTION 'Delivery address is outside the active service area';
  END IF;

  -- 6. Vendor validation
  SELECT id, is_active, latitude, longitude, service_area_id
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF v_vendor.latitude IS NULL OR v_vendor.longitude IS NULL THEN
    RAISE EXCEPTION 'Vendor location coordinates are missing or invalid';
  END IF;

  -- 7. Authoritative Geodesic Straight-Line Distance Calculation
  v_distance_km := public.calculate_distance_km(
    v_vendor.latitude,
    v_vendor.longitude,
    v_address.latitude,
    v_address.longitude
  );

  -- 8. Deterministic 4-Tier Pricing Rule Resolution
  SELECT
    id,
    base_fee,
    distance_rate,
    min_fee,
    max_fee,
    CASE
      WHEN service_type = p_service_type AND service_area_id = v_address.service_area_id THEN 1
      WHEN service_type = p_service_type AND service_area_id IS NULL THEN 2
      WHEN service_type IS NULL AND service_area_id = v_address.service_area_id THEN 3
      WHEN service_type IS NULL AND service_area_id IS NULL THEN 4
      ELSE 5
    END AS tier
  INTO v_rule
  FROM public.delivery_pricing_rules
  WHERE is_active = true
    AND effective_date <= CURRENT_DATE
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    AND (
      (service_type = p_service_type AND service_area_id = v_address.service_area_id)
      OR (service_type = p_service_type AND service_area_id IS NULL)
      OR (service_type IS NULL AND service_area_id = v_address.service_area_id)
      OR (service_type IS NULL AND service_area_id IS NULL)
    )
  ORDER BY
    tier ASC,
    effective_date DESC,
    created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active delivery pricing rule found for service % in area %',
      p_service_type, COALESCE(v_address.service_area_id::text, 'global');
  END IF;

  -- 9. Authoritative Delivery Fee Computation
  v_raw_fee := v_rule.base_fee + (v_distance_km * v_rule.distance_rate);
  v_delivery_fee := round(v_raw_fee, 2);

  IF v_rule.min_fee IS NOT NULL AND v_delivery_fee < v_rule.min_fee THEN
    v_delivery_fee := v_rule.min_fee;
  END IF;

  IF v_rule.max_fee IS NOT NULL AND v_delivery_fee > v_rule.max_fee THEN
    v_delivery_fee := v_rule.max_fee;
  END IF;

  -- 10. Items array validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 distinct item lines';
  END IF;

  -- 11. Initial Order Row Insertion with snapshot fields
  INSERT INTO public.orders (
    customer_id, vendor_id, service_type,
    pickup_address, delivery_address,
    delivery_fee, subtotal, total, special_instructions,
    distance_km, pricing_rule_id, delivery_address_id
  )
  VALUES (
    v_user_id, p_vendor_id, p_service_type,
    p_pickup_address, p_delivery_address,
    v_delivery_fee, 0, 0,
    left(p_special_instructions, 500),
    v_distance_km, v_rule.id, v_address.id
  )
  RETURNING id INTO v_order_id;

  -- 12. Process each item and compute subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION
        'Each item in p_items must be a JSON object; got element of type: %',
        jsonb_typeof(v_item);
    END IF;

    -- Quantity validation
    v_qty_raw := v_item->>'quantity';
    IF v_qty_raw IS NULL THEN
      RAISE EXCEPTION 'Each item must have a "quantity" field';
    END IF;
    IF v_qty_raw ~ '\.' THEN
      RAISE EXCEPTION 'Item quantity must be a whole number; got: %', v_qty_raw;
    END IF;
    BEGIN
      v_item_quantity := v_qty_raw::integer;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'Item quantity must be a valid integer; got: %', v_qty_raw;
    END;
    IF v_item_quantity < 1 OR v_item_quantity > 999 THEN
      RAISE EXCEPTION 'Item quantity must be between 1 and 999; got: %', v_item_quantity;
    END IF;

    -- Product ID validation
    IF v_item->>'product_id' IS NULL THEN
      RAISE EXCEPTION 'Each item must have a "product_id" field';
    END IF;
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Item product_id is not a valid UUID: %', v_item->>'product_id';
    END;

    -- Reject duplicate product IDs
    IF v_product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION
        'Duplicate product_id % in p_items; use quantity to order multiple units of the same product',
        v_product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_product_id);

    -- Fetch product with FOR UPDATE lock
    SELECT id, name, price INTO v_product
    FROM public.products
    WHERE id = v_product_id
      AND vendor_id = p_vendor_id
      AND is_available = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Product % not found, not available, or does not belong to vendor %',
        v_product_id, p_vendor_id;
    END IF;

    -- Overflow guard for line total
    IF v_product.price * v_item_quantity > 9999999999.99 THEN
      RAISE EXCEPTION
        'Line total for product % exceeds the maximum allowed value', v_product_id;
    END IF;

    -- Insert order item
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

    IF v_subtotal > 9999999999.99 THEN
      RAISE EXCEPTION 'Order subtotal exceeds the maximum allowed value';
    END IF;
  END LOOP;

  -- 13. Calculate Final Total & Update Order Row
  v_total := v_subtotal + v_delivery_fee;

  IF v_total > 9999999999.99 THEN
    RAISE EXCEPTION 'Order total exceeds the maximum allowed value';
  END IF;

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total    = v_total
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid)
  IS 'Creates order with database-authoritative distance, delivery fee, subtotal, and total snapshot.';
