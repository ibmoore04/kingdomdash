-- =============================================================================
-- Migration: 20261002000001_service_fee_order_authority.sql
-- Module   : KingdomDash Platform Service Fee & Order Financial Authority
-- Purpose  : 1. Add authoritative service_fee column to public.orders
--            2. Prevent client tampering with service_fee via trg_order_financial_authority
--            3. Authoritatively fetch and apply platform_settings.service_fee_ngn
--               in create_order_secure, calculate_delivery_fee_preview,
--               submit_courier_delivery, and submit_personal_shopper_request
--            4. Ensure customer total = subtotal + delivery_fee + service_fee
-- =============================================================================

-- 1. Schema Enhancement: service_fee column on public.orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS service_fee numeric(12,2) NOT NULL DEFAULT 150.00 CHECK (service_fee >= 0);

-- Backfill any existing orders where service_fee is NULL
UPDATE public.orders
SET service_fee = 150.00
WHERE service_fee IS NULL;

-- 2. Explicit RBAC & RLS Security Authority
-- Drops fragile trigger role check that tripped on DEFAULT column values.
-- Enforces PostgreSQL RBAC boundaries: untrusted roles cannot directly INSERT/UPDATE orders.
-- Orders must be submitted via vetted SECURITY DEFINER RPCs (create_order_secure, submit_courier_delivery, submit_personal_shopper_request).
DROP TRIGGER IF EXISTS trg_order_financial_authority ON public.orders;
DROP FUNCTION IF EXISTS public.trg_enforce_order_financial_authority();

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
GRANT SELECT ON public.orders TO authenticated;

-- 3. Update calculate_delivery_fee_preview to return dynamic service_fee
CREATE OR REPLACE FUNCTION public.calculate_delivery_fee_preview(
  p_vendor_id            uuid,
  p_delivery_address_id  uuid,
  p_service_type         service_type
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id           uuid;
  v_address           record;
  v_vendor            record;
  v_rule              record;
  v_is_serviceable    boolean;
  v_distance_km       numeric(10,3);
  v_raw_fee           numeric(12,2);
  v_delivery_fee      numeric(12,2);
  v_service_fee       numeric(12,2) := 150.00;
  v_service_area_name text := NULL;
BEGIN
  -- 1. Authentication check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Read active platform service fee from platform_settings
  SELECT COALESCE(service_fee_ngn, 150.00) INTO v_service_fee
  FROM public.platform_settings
  WHERE id = 'default';
  IF NOT FOUND OR v_service_fee IS NULL THEN
    v_service_fee := 150.00;
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
      'service_fee', v_service_fee,
      'error', 'Delivery address coordinates are missing. Please pin your location on the map.'
    );
  END IF;

  -- 5. Vendor validation & multi-service support
  SELECT id, is_active, latitude, longitude, service_area_id
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF NOT public.vendor_supports_service(p_vendor_id, p_service_type) THEN
    RAISE EXCEPTION '% service delivery is only available for vendors offering this service',
      initcap(p_service_type::text);
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
      'service_fee', v_service_fee,
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
    'service_fee', v_service_fee,
    'base_fee', v_rule.base_fee,
    'distance_rate', v_rule.distance_rate,
    'pricing_tier', v_rule.tier,
    'service_area_name', v_service_area_name
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.calculate_delivery_fee_preview(uuid, uuid, service_type) TO authenticated, service_role;

-- 4. Update create_order_secure to record service_fee and calculate total = subtotal + delivery_fee + service_fee
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
SET search_path = public, pg_catalog
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
  v_service_fee      numeric(12,2) := 150.00;
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

  -- 6. Vendor validation & multi-service check
  SELECT id, is_active, latitude, longitude, service_area_id
  INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  IF NOT public.vendor_supports_service(p_vendor_id, p_service_type) THEN
    RAISE EXCEPTION '% orders can only be placed with vendors that offer % service',
      initcap(p_service_type::text), initcap(p_service_type::text);
  END IF;

  IF v_vendor.latitude IS NULL OR v_vendor.longitude IS NULL THEN
    RAISE EXCEPTION 'Vendor location coordinates are missing or invalid';
  END IF;

  -- 7. Authoritative Geodesic Distance Calculation
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

  -- 10. Platform Service Fee Resolution
  SELECT COALESCE(service_fee_ngn, 150.00) INTO v_service_fee
  FROM public.platform_settings
  WHERE id = 'default';
  IF NOT FOUND OR v_service_fee IS NULL THEN
    v_service_fee := 150.00;
  END IF;

  -- 11. Items array validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 distinct item lines';
  END IF;

  -- Pre-validate item structure and extract product IDs
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
  END LOOP;

  -- Deterministic Product Locking
  PERFORM 1
  FROM public.products p
  WHERE p.id = ANY(v_seen_product_ids)
  ORDER BY p.id ASC
  FOR UPDATE OF p;

  -- Initial Order Row Insertion
  INSERT INTO public.orders (
    customer_id, vendor_id, service_type,
    pickup_address, delivery_address,
    delivery_fee, service_fee, subtotal, total, special_instructions,
    distance_km, pricing_rule_id, delivery_address_id
  )
  VALUES (
    v_user_id, p_vendor_id, p_service_type,
    p_pickup_address, p_delivery_address,
    v_delivery_fee, v_service_fee, 0, 0,
    left(p_special_instructions, 500),
    v_distance_km, v_rule.id, v_address.id
  )
  RETURNING id INTO v_order_id;

  -- Process each item and compute subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_quantity := (v_item->>'quantity')::integer;
    v_product_id := (v_item->>'product_id')::uuid;

    SELECT p.id, p.name, p.price, c.service_type AS category_service_type
    INTO v_product
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    WHERE p.id = v_product_id
      AND p.vendor_id = p_vendor_id
      AND p.is_available = true
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Product % not found, not available, or does not belong to vendor %',
        v_product_id, p_vendor_id;
    END IF;

    IF v_product.category_service_type IS NOT NULL AND v_product.category_service_type <> p_service_type THEN
      RAISE EXCEPTION
        'Product % belongs to % service and cannot be ordered in a % order',
        v_product_id, v_product.category_service_type, p_service_type;
    END IF;

    IF v_product.price * v_item_quantity > 9999999999.99 THEN
      RAISE EXCEPTION
        'Line total for product % exceeds the maximum allowed value', v_product_id;
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
      round(v_product.price * v_item_quantity, 2)
    );

    v_subtotal := v_subtotal + (v_product.price * v_item_quantity);
  END LOOP;

  -- Authoritative Total Computation: Subtotal + Delivery Fee + Service Fee
  v_subtotal := round(v_subtotal, 2);
  v_total := round(v_subtotal + v_delivery_fee + v_service_fee, 2);

  UPDATE public.orders
  SET subtotal = v_subtotal,
      service_fee = v_service_fee,
      total = v_total,
      updated_at = pg_catalog.now()
  WHERE id = v_order_id;

  -- Operational audit log
  PERFORM public.log_operational_audit_event(
    'order_created_secure',
    'orders',
    v_order_id,
    NULL,
    jsonb_build_object(
      'order_id', v_order_id,
      'vendor_id', p_vendor_id,
      'service_type', p_service_type,
      'item_count', array_length(v_seen_product_ids, 1),
      'subtotal', v_subtotal,
      'delivery_fee', v_delivery_fee,
      'service_fee', v_service_fee,
      'total', v_total
    )
  );

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) TO authenticated, service_role;

-- 5. Update submit_courier_delivery to charge platform service fee
DROP FUNCTION IF EXISTS public.submit_courier_delivery(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.submit_courier_delivery(
  p_pickup_address       text,
  p_pickup_contact       text,
  p_pickup_phone         text,
  p_pickup_lat           numeric,
  p_pickup_lon           numeric,
  p_delivery_address     text,
  p_delivery_contact     text,
  p_delivery_phone       text,
  p_delivery_lat         numeric,
  p_delivery_lon         numeric,
  p_idempotency_key      text,
  p_special_instructions text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id        uuid;
  v_existing_order record;
  v_distance_km    numeric(10,3);
  v_rule           record;
  v_raw_fee        numeric(12,2);
  v_delivery_fee   numeric(12,2);
  v_service_fee    numeric(12,2) := 150.00;
  v_total          numeric(12,2);
  v_order_id       uuid;
  v_delivery_id    uuid;
  v_idempotency_key text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit courier orders' USING ERRCODE = 'KD401';
  END IF;

  v_idempotency_key := NULLIF(TRIM(p_idempotency_key), '');

  -- 1. Idempotency Check: Return existing order if key was already submitted
  IF v_idempotency_key IS NOT NULL THEN
    SELECT id, distance_km, delivery_fee, total, status
    INTO v_existing_order
    FROM public.orders
    WHERE customer_id = v_user_id AND idempotency_key = v_idempotency_key;

    IF FOUND THEN
      SELECT id INTO v_delivery_id FROM public.deliveries WHERE order_id = v_existing_order.id;
      RETURN jsonb_build_object(
        'order_id', v_existing_order.id,
        'delivery_id', v_delivery_id,
        'distance_km', v_existing_order.distance_km,
        'delivery_fee', v_existing_order.delivery_fee,
        'total', v_existing_order.total,
        'status', v_existing_order.status,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  -- 2. Input validation
  IF NULLIF(TRIM(p_pickup_address), '') IS NULL THEN
    RAISE EXCEPTION 'Pickup address is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_pickup_contact), '') IS NULL THEN
    RAISE EXCEPTION 'Pickup contact name is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_pickup_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Pickup phone number is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_pickup_lat IS NULL OR p_pickup_lon IS NULL THEN
    RAISE EXCEPTION 'Pickup coordinates are required' USING ERRCODE = 'KD400';
  END IF;

  IF NULLIF(TRIM(p_delivery_address), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery address is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_delivery_contact), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery contact name is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_delivery_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery phone number is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_delivery_lat IS NULL OR p_delivery_lon IS NULL THEN
    RAISE EXCEPTION 'Delivery coordinates are required' USING ERRCODE = 'KD400';
  END IF;

  -- 3. Distance calculation
  v_distance_km := public.calculate_distance_km(
    p_pickup_lat,
    p_pickup_lon,
    p_delivery_lat,
    p_delivery_lon
  );

  -- 4. Pricing rule resolution
  SELECT id, base_fee, distance_rate, min_fee, max_fee
  INTO v_rule
  FROM public.delivery_pricing_rules
  WHERE is_active = true
    AND service_type = 'courier'
    AND effective_date <= CURRENT_DATE
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  ORDER BY effective_date DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, base_fee, distance_rate, min_fee, max_fee
    INTO v_rule
    FROM public.delivery_pricing_rules
    WHERE is_active = true
      AND service_type IS NULL
      AND effective_date <= CURRENT_DATE
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    ORDER BY effective_date DESC, created_at DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active delivery pricing rule found for courier service' USING ERRCODE = 'KD409';
  END IF;

  v_raw_fee := v_rule.base_fee + (v_distance_km * v_rule.distance_rate);
  v_delivery_fee := round(v_raw_fee, 2);

  IF v_rule.min_fee IS NOT NULL AND v_delivery_fee < v_rule.min_fee THEN
    v_delivery_fee := v_rule.min_fee;
  END IF;
  IF v_rule.max_fee IS NOT NULL AND v_delivery_fee > v_rule.max_fee THEN
    v_delivery_fee := v_rule.max_fee;
  END IF;

  -- 5. Service fee resolution
  SELECT COALESCE(service_fee_ngn, 150.00) INTO v_service_fee
  FROM public.platform_settings
  WHERE id = 'default';
  IF NOT FOUND OR v_service_fee IS NULL THEN
    v_service_fee := 150.00;
  END IF;

  v_total := round(v_delivery_fee + v_service_fee, 2);

  -- 6. Insert Order
  BEGIN
    INSERT INTO public.orders (
      customer_id,
      vendor_id,
      service_type,
      pickup_address,
      delivery_address,
      pickup_contact,
      pickup_phone,
      delivery_contact,
      delivery_phone,
      subtotal,
      delivery_fee,
      service_fee,
      total,
      special_instructions,
      distance_km,
      pricing_rule_id,
      status,
      idempotency_key
    ) VALUES (
      v_user_id,
      NULL,
      'courier',
      p_pickup_address,
      p_delivery_address,
      p_pickup_contact,
      p_pickup_phone,
      p_delivery_contact,
      p_delivery_phone,
      0.00,
      v_delivery_fee,
      v_service_fee,
      v_total,
      p_special_instructions,
      v_distance_km,
      v_rule.id,
      'pending',
      v_idempotency_key
    )
    RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF v_idempotency_key IS NOT NULL THEN
        SELECT id, distance_km, delivery_fee, total, status
        INTO v_existing_order
        FROM public.orders
        WHERE customer_id = v_user_id AND idempotency_key = v_idempotency_key;

        SELECT id INTO v_delivery_id FROM public.deliveries WHERE order_id = v_existing_order.id;
        RETURN jsonb_build_object(
          'order_id', v_existing_order.id,
          'delivery_id', v_delivery_id,
          'distance_km', v_existing_order.distance_km,
          'delivery_fee', v_existing_order.delivery_fee,
          'total', v_existing_order.total,
          'status', v_existing_order.status,
          'idempotent_replay', true
        );
      ELSE
        RAISE;
      END IF;
  END;

  -- 7. Insert Delivery
  INSERT INTO public.deliveries (
    order_id,
    service_type,
    pickup_address,
    delivery_address,
    status
  ) VALUES (
    v_order_id,
    'courier',
    p_pickup_address,
    p_delivery_address,
    'pending'
  )
  RETURNING id INTO v_delivery_id;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'delivery_id', v_delivery_id,
    'distance_km', v_distance_km,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'total', v_total,
    'status', 'pending',
    'idempotent_replay', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_courier_delivery(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_courier_delivery(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.submit_courier_delivery(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) TO authenticated, service_role;

-- 6. Update submit_personal_shopper_request to charge platform service fee
-- Explicitly drop previous variants (e.g. Migration 37 defined RETURNS uuid, preventing CREATE OR REPLACE to jsonb)
DROP FUNCTION IF EXISTS public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text);
DROP FUNCTION IF EXISTS public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text, numeric);

CREATE OR REPLACE FUNCTION public.submit_personal_shopper_request(
  p_customer_name     text,
  p_customer_phone    text,
  p_delivery_address  text,
  p_market_name       text,
  p_budget_cap        numeric,
  p_estimated_total   numeric DEFAULT NULL,
  p_items             jsonb DEFAULT '[]'::jsonb,
  p_notes             text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id           uuid;
  v_new_shopper_id    uuid;
  v_new_order_id      uuid;
  v_new_delivery_id   uuid;
  v_delivery_fee      numeric(12,2);
  v_service_fee       numeric(12,2) := 150.00;
  v_subtotal          numeric(12,2);
  v_total             numeric(12,2);
  v_item_elem         jsonb;
  v_item_name         text;
  v_item_qty          int;
  v_item_unit_price   numeric(12,2);
  v_item_line_total   numeric(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to submit a personal shopper request' USING ERRCODE = 'KD401';
  END IF;

  IF NULLIF(TRIM(p_customer_name), '') IS NULL THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_customer_phone), '') IS NULL THEN
    RAISE EXCEPTION 'Customer phone number is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_delivery_address), '') IS NULL THEN
    RAISE EXCEPTION 'Delivery address is required' USING ERRCODE = 'KD400';
  END IF;
  IF NULLIF(TRIM(p_market_name), '') IS NULL THEN
    RAISE EXCEPTION 'Market name is required' USING ERRCODE = 'KD400';
  END IF;

  -- Validate budget cap and estimate boundaries
  IF p_budget_cap IS NULL OR p_budget_cap <= 0 THEN
    RAISE EXCEPTION 'A valid positive budget cap is required' USING ERRCODE = 'KD400';
  END IF;

  IF p_estimated_total IS NOT NULL THEN
    IF p_estimated_total <= 0 THEN
      RAISE EXCEPTION 'Estimated total must be positive if provided' USING ERRCODE = 'KD400';
    END IF;
    IF p_estimated_total > p_budget_cap THEN
      RAISE EXCEPTION 'Estimated total (%) cannot exceed customer budget cap (%)',
        p_estimated_total, p_budget_cap USING ERRCODE = 'KD400';
    END IF;
    v_subtotal := p_estimated_total;
  ELSE
    v_subtotal := p_budget_cap;
  END IF;

  -- Authoritatively resolve delivery fee from pricing rules (never trusting client input)
  SELECT base_fee INTO v_delivery_fee
  FROM public.delivery_pricing_rules
  WHERE is_active = true
    AND (service_type = 'custom' OR service_type IS NULL)
    AND effective_date <= CURRENT_DATE
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
  ORDER BY
    CASE WHEN service_type = 'custom' THEN 1 ELSE 2 END,
    effective_date DESC
  LIMIT 1;

  IF v_delivery_fee IS NULL THEN
    v_delivery_fee := 1500.00;
  END IF;

  SELECT COALESCE(service_fee_ngn, 150.00) INTO v_service_fee
  FROM public.platform_settings
  WHERE id = 'default';
  IF NOT FOUND OR v_service_fee IS NULL THEN
    v_service_fee := 150.00;
  END IF;

  v_total := round(v_subtotal + v_delivery_fee + v_service_fee, 2);

  -- 1. Insert into personal_shopper_requests
  INSERT INTO public.personal_shopper_requests (
    customer_name,
    customer_phone,
    delivery_address,
    market_name,
    budget_cap,
    estimated_total,
    items,
    notes,
    status
  ) VALUES (
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    TRIM(p_delivery_address),
    TRIM(p_market_name),
    p_budget_cap,
    p_estimated_total,
    COALESCE(p_items, '[]'::jsonb),
    NULLIF(TRIM(p_notes), ''),
    'pending'
  )
  RETURNING id INTO v_new_shopper_id;

  -- 2. Insert into public.orders as a first-class order
  INSERT INTO public.orders (
    customer_id,
    vendor_id,
    service_type,
    status,
    pickup_address,
    delivery_address,
    customer_name,
    customer_phone,
    delivery_contact,
    delivery_phone,
    pickup_contact,
    pickup_phone,
    delivery_fee,
    service_fee,
    subtotal,
    total,
    special_instructions,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    NULL,
    'custom',
    'pending',
    TRIM(p_market_name),
    TRIM(p_delivery_address),
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    'Market Concierge',
    TRIM(p_customer_phone),
    v_delivery_fee,
    v_service_fee,
    v_subtotal,
    v_total,
    COALESCE(NULLIF(TRIM(p_notes), ''), 'Personal Shopper Custom Concierge Order'),
    now(),
    now()
  )
  RETURNING id INTO v_new_order_id;

  -- 3. Insert individual order_items if provided
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_name := COALESCE(v_item_elem->>'name', v_item_elem->>'item', 'Custom Market Item');
      v_item_qty  := COALESCE((v_item_elem->>'quantity')::int, (v_item_elem->>'qty')::int, 1);
      v_item_unit_price := COALESCE((v_item_elem->>'estimated_price')::numeric, (v_item_elem->>'price')::numeric, 0.00);
      v_item_line_total := v_item_unit_price * v_item_qty;

      INSERT INTO public.order_items (
        order_id,
        product_name,
        quantity,
        unit_price,
        line_total
      ) VALUES (
        v_new_order_id,
        v_item_name,
        v_item_qty,
        v_item_unit_price,
        v_item_line_total
      );
    END LOOP;
  ELSE
    INSERT INTO public.order_items (
      order_id,
      product_name,
      quantity,
      unit_price,
      line_total
    ) VALUES (
      v_new_order_id,
      'Market Shopping Budget: ' || TRIM(p_market_name),
      1,
      v_subtotal,
      v_subtotal
    );
  END IF;

  -- 4. Insert into deliveries
  INSERT INTO public.deliveries (
    order_id,
    service_type,
    pickup_address,
    delivery_address,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_new_order_id,
    'custom',
    TRIM(p_market_name),
    TRIM(p_delivery_address),
    'pending',
    now(),
    now()
  )
  RETURNING id INTO v_new_delivery_id;

  -- 5. Operational Audit Event
  PERFORM public.log_operational_audit_event(
    'personal_shopper_order_created',
    'orders',
    v_new_order_id,
    NULL,
    jsonb_build_object(
      'shopper_request_id', v_new_shopper_id,
      'market_name', TRIM(p_market_name),
      'budget_cap', p_budget_cap,
      'delivery_fee', v_delivery_fee,
      'service_fee', v_service_fee,
      'total', v_total
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'shopper_request_id', v_new_shopper_id,
    'order_id', v_new_order_id,
    'delivery_id', v_new_delivery_id,
    'delivery_fee', v_delivery_fee,
    'service_fee', v_service_fee,
    'total', v_total,
    'status', 'pending'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text) TO authenticated, service_role;
