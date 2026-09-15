-- =============================================================================
-- Migration: 20260902000026_multi_service_architecture_alignment.sql
-- Purpose  : Multi-Service Provider Architecture Alignment & Runtime Hardening
--            1. Fixes column name defects in trg_fn_on_order_payment_confirmed():
--               - profiles.phone (was incorrectly querying non-existent phone_number)
--               - vendors.business_name (was incorrectly querying non-existent name)
--            2. Enforces cross-service integrity in validate_order_vendor_constraint():
--               - food: vendor_id required AND vendor.business_type = 'restaurant'
--               - grocery: vendor_id required AND vendor.business_type = 'grocery_store'
--               - courier: vendor_id MUST BE NULL
--            3. Enforces cross-service integrity in validate_delivery_vendor_constraint():
--               - food: vendor_id required AND vendor.business_type = 'restaurant'
--               - grocery: vendor_id required AND vendor.business_type = 'grocery_store'
--               - courier: vendor_id MUST BE NULL
--            4. Enforces cross-service vendor matching in calculate_delivery_fee_preview()
--            5. Enforces cross-service vendor matching in create_order_secure()
-- =============================================================================

-- =============================================================================
-- §1  FIX RUNTIME DEFECT IN PAYMENT CONFIRMATION TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_on_order_payment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cust_name          text;
  v_cust_phone         text;
  v_vendor_name        text;
  v_addr_recipient     text;
  v_addr_phone         text;
  v_delivery_created   boolean := false;
BEGIN
  -- Only act when transitioning into 'payment_confirmed'
  IF NEW.status = 'payment_confirmed' AND (OLD.status IS DISTINCT FROM 'payment_confirmed') THEN
    
    -- Ensure confirmed_at timestamp is stamped server-side
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := pg_catalog.now();
    END IF;

    -- Fetch customer profile snapshot details (profiles table has 'phone', not 'phone_number')
    SELECT full_name, phone
    INTO v_cust_name, v_cust_phone
    FROM public.profiles
    WHERE id = NEW.customer_id;

    -- Fetch customer address snapshot details if available
    IF NEW.delivery_address_id IS NOT NULL THEN
      SELECT recipient_name, phone
      INTO v_addr_recipient, v_addr_phone
      FROM public.addresses
      WHERE id = NEW.delivery_address_id;
    END IF;

    -- Fetch vendor name if order has a vendor (vendors table has 'business_name', not 'name')
    IF NEW.vendor_id IS NOT NULL THEN
      SELECT business_name INTO v_vendor_name
      FROM public.vendors
      WHERE id = NEW.vendor_id;
    END IF;

    -- Provably safe idempotent insert into deliveries: exactly one delivery per order
    IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id) THEN
      BEGIN
        INSERT INTO public.deliveries (
          order_id,
          customer_name,
          customer_phone,
          service_type,
          vendor_id,
          pickup_address,
          pickup_contact,
          delivery_address,
          delivery_contact,
          special_instructions,
          status,
          created_by,
          created_at,
          updated_at
        ) VALUES (
          NEW.id,
          COALESCE(NEW.delivery_contact, v_addr_recipient, v_cust_name, 'Customer'),
          COALESCE(NEW.delivery_phone, v_addr_phone, v_cust_phone, 'N/A'),
          NEW.service_type,
          NEW.vendor_id,
          NEW.pickup_address,
          COALESCE(NEW.pickup_contact, v_vendor_name, 'Sender'),
          NEW.delivery_address,
          COALESCE(NEW.delivery_contact, v_addr_recipient, v_cust_name, 'Customer'),
          NEW.special_instructions,
          'pending',
          NEW.customer_id,
          pg_catalog.now(),
          pg_catalog.now()
        );
        v_delivery_created := true;
      EXCEPTION
        WHEN unique_violation THEN
          -- Another concurrent trigger execution already created this delivery row
          v_delivery_created := false;
      END;

      -- Confirm delivery exists
      IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id) THEN
        RAISE EXCEPTION 'Failed to instantiate delivery for order %', NEW.id USING ERRCODE = 'KD500';
      END IF;

      -- Audit operation executes strictly outside the delivery exception block:
      IF v_delivery_created THEN
        PERFORM public.log_operational_audit_event(
          'delivery_created_auto',
          'orders',
          NEW.id,
          NULL,
          jsonb_build_object('order_id', NEW.id, 'service_type', NEW.service_type)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- =============================================================================
-- §2  CROSS-SERVICE INTEGRITY CONSTRAINTS ON ORDERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_order_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type = 'food' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for food orders';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND business_type = 'restaurant') THEN
      RAISE EXCEPTION 'Food orders can only be placed with restaurant vendors';
    END IF;
  ELSIF NEW.service_type = 'grocery' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for grocery orders';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND business_type = 'grocery_store') THEN
      RAISE EXCEPTION 'Grocery orders can only be placed with grocery store vendors';
    END IF;
  ELSIF NEW.service_type = 'courier' THEN
    IF NEW.vendor_id IS NOT NULL THEN
      RAISE EXCEPTION 'vendor_id must be NULL for courier orders';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- §3  CROSS-SERVICE INTEGRITY CONSTRAINTS ON DELIVERIES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_delivery_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type = 'food' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for food deliveries';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND business_type = 'restaurant') THEN
      RAISE EXCEPTION 'Food deliveries can only be linked to restaurant vendors';
    END IF;
  ELSIF NEW.service_type = 'grocery' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for grocery deliveries';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE id = NEW.vendor_id AND business_type = 'grocery_store') THEN
      RAISE EXCEPTION 'Grocery deliveries can only be linked to grocery store vendors';
    END IF;
  ELSIF NEW.service_type = 'courier' THEN
    IF NEW.vendor_id IS NOT NULL THEN
      RAISE EXCEPTION 'vendor_id must be NULL for courier deliveries';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- §4  CROSS-SERVICE VENDOR VALIDATION IN CALCULATE_DELIVERY_FEE_PREVIEW
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

  -- 5. Vendor validation & service category matching
  SELECT id, is_active, latitude, longitude, service_area_id, business_type
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF p_service_type = 'food' AND v_vendor.business_type <> 'restaurant' THEN
    RAISE EXCEPTION 'Food service delivery is only available for restaurant vendors';
  END IF;

  IF p_service_type = 'grocery' AND v_vendor.business_type <> 'grocery_store' THEN
    RAISE EXCEPTION 'Grocery service delivery is only available for grocery store vendors';
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

  IF NOT v_is_serviceable THEN
    RETURN jsonb_build_object(
      'is_serviceable', false,
      'distance_km', null,
      'delivery_fee', null,
      'error', 'Delivery address is outside the vendor service area'
    );
  END IF;

  -- 7. Calculate Geodesic Distance
  v_distance_km := public.calculate_distance_km(
    v_vendor.latitude,
    v_vendor.longitude,
    v_address.latitude,
    v_address.longitude
  );

  -- 8. Deterministic 4-Tier Pricing Rule Resolution
  SELECT
    id, base_fee, distance_rate, min_fee, max_fee,
    CASE
      WHEN service_type = p_service_type AND service_area_id = v_address.service_area_id THEN 1
      WHEN service_type = p_service_type AND service_area_id IS NULL THEN 2
      WHEN service_type IS NULL AND service_area_id = v_address.service_area_id THEN 3
      WHEN service_type IS NULL AND service_area_id = v_address.service_area_id THEN 4
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

  -- 10. Optional service area name lookup
  IF v_address.service_area_id IS NOT NULL THEN
    SELECT name INTO v_service_area_name
    FROM public.service_areas
    WHERE id = v_address.service_area_id;
  END IF;

  RETURN jsonb_build_object(
    'is_serviceable', true,
    'distance_km', v_distance_km,
    'delivery_fee', v_delivery_fee,
    'base_fee', v_rule.base_fee,
    'distance_rate', v_rule.distance_rate,
    'pricing_tier', v_rule.tier,
    'service_area_name', v_service_area_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) TO authenticated;


-- =============================================================================
-- §5  CROSS-SERVICE VENDOR VALIDATION IN CREATE_ORDER_SECURE
-- =============================================================================

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

  -- 6. Vendor validation & service category matching
  SELECT id, is_active, latitude, longitude, service_area_id, business_type
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF p_service_type = 'food' AND v_vendor.business_type <> 'restaurant' THEN
    RAISE EXCEPTION 'Food orders can only be placed with restaurant vendors';
  END IF;

  IF p_service_type = 'grocery' AND v_vendor.business_type <> 'grocery_store' THEN
    RAISE EXCEPTION 'Grocery orders can only be placed with grocery vendors';
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

  -- 13. Subtotal must be greater than 0
  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Order subtotal must be greater than 0';
  END IF;

  -- 14. Compute total
  v_total := v_subtotal + v_delivery_fee;

  IF v_total > 9999999999.99 THEN
    RAISE EXCEPTION 'Order total exceeds the maximum allowed value';
  END IF;

  -- 15. Atomic Final Update: write authoritative subtotal and total
  UPDATE public.orders
  SET
    subtotal   = v_subtotal,
    total      = v_total,
    updated_at = now()
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) TO authenticated;

-- =============================================================================
-- §6  VENDOR PROFILE EDITABILITY & IMMUTABILITY TRIGGER REFINEMENT
-- =============================================================================
-- Permits vendors to update their public business_name, phone, address, 
-- description, hours, and branding while maintaining immutable locks on:
--   - id, profile_id (identity & ownership hijacking prevention)
--   - business_type (cross-service switching requires re-onboarding)
--   - email (auth account link)
--   - is_active (approval status cannot be self-elevated)
--   - rating (reputation cannot be manipulated)
--   - created_at (audit trail)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_vendor_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current_role public.user_role;
BEGIN
  v_current_role := public.get_current_user_role();

  -- Admin and super_admin may modify all vendor fields
  IF (v_current_role IS NULL OR v_current_role NOT IN ('admin', 'super_admin')) THEN
    -- Protect immutable identity and ownership links
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Cannot modify vendor id.';
    END IF;
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'Cannot modify vendor profile_id.';
    END IF;

    -- Protect registered service vertical and auth email
    IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN
      RAISE EXCEPTION 'Vendors cannot alter their registered business_type.';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Vendors cannot alter their registered email.';
    END IF;

    -- Protect status, operational rating, and audit timestamps
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Vendors cannot alter their own active status.';
    END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Vendors cannot alter their own rating.';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot modify vendor created_at.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_vendor_immutable_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_vendor_immutable_fields() TO authenticated;

DROP TRIGGER IF EXISTS trg_protect_vendor_fields ON public.vendors;
CREATE TRIGGER trg_protect_vendor_fields
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_vendor_immutable_fields();

-- Explicit SECURE RPC for updating vendor profile
CREATE OR REPLACE FUNCTION public.update_vendor_profile_secure(
  p_vendor_id            uuid,
  p_business_name        text DEFAULT NULL,
  p_phone                text DEFAULT NULL,
  p_business_address     text DEFAULT NULL,
  p_service_area         text DEFAULT NULL,
  p_business_description text DEFAULT NULL,
  p_operating_hours      jsonb DEFAULT NULL,
  p_logo_url             text DEFAULT NULL,
  p_cover_image_url      text DEFAULT NULL
)
RETURNS public.vendors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role public.user_role;
  v_vendor      public.vendors;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  v_caller_role := public.get_current_user_role();

  -- Verify existence and ownership: caller must own the vendor record OR be admin/super_admin
  SELECT * INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor profile not found.';
  END IF;

  IF v_vendor.profile_id != v_caller_id AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied. You can only update your own vendor profile.';
  END IF;

  UPDATE public.vendors
  SET
    business_name        = COALESCE(NULLIF(trim(p_business_name), ''), v_vendor.business_name),
    phone                = COALESCE(NULLIF(trim(p_phone), ''), v_vendor.phone),
    business_address     = COALESCE(NULLIF(trim(p_business_address), ''), v_vendor.business_address),
    service_area         = CASE WHEN p_service_area IS NOT NULL THEN NULLIF(trim(p_service_area), '') ELSE v_vendor.service_area END,
    business_description = CASE WHEN p_business_description IS NOT NULL THEN NULLIF(trim(p_business_description), '') ELSE v_vendor.business_description END,
    operating_hours      = COALESCE(p_operating_hours, v_vendor.operating_hours),
    logo_url             = COALESCE(p_logo_url, v_vendor.logo_url),
    cover_image_url      = COALESCE(p_cover_image_url, v_vendor.cover_image_url),
    updated_at           = pg_catalog.now()
  WHERE id = p_vendor_id
  RETURNING * INTO v_vendor;

  RETURN v_vendor;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_vendor_profile_secure(uuid, text, text, text, text, text, jsonb, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_vendor_profile_secure(uuid, text, text, text, text, text, jsonb, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_vendor_profile_secure(uuid, text, text, text, text, text, jsonb, text, text) TO authenticated;

