-- =============================================================================
-- Migration: 20260902000028_vendor_multi_service_support.sql
-- Purpose  : Food + Grocery Vendor Multi-Service Support
--            1. Creates normalized public.vendor_services table
--            2. Backfills existing vendors into vendor_services
--            3. Adds service_types to vendor_applications and backfills
--            4. Creates helper function public.vendor_supports_service(uuid, service_type)
--            5. Updates validate_order_vendor_constraint() to check vendor_supports_service
--            6. Updates validate_delivery_vendor_constraint() to check vendor_supports_service
--            7. Updates calculate_delivery_fee_preview() to support multi-service vendors
--            8. Updates create_order_secure() to support multi-service vendors & validate item category service
--            9. Adds triggers for category and product service validation
--           10. Updates vendor application approval & profile sync to provision vendor_services
--           11. Creates set_vendor_services() RPC for vendor/admin service management
--           12. Installs non-recursive RLS policies on vendor_services
-- =============================================================================

-- =============================================================================
-- §1  CREATE VENDOR_SERVICES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vendor_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  service_type public.service_type NOT NULL CHECK (service_type IN ('food', 'grocery')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_vendor_service UNIQUE (vendor_id, service_type)
);

CREATE INDEX IF NOT EXISTS idx_vendor_services_vendor_id ON public.vendor_services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_services_service_type ON public.vendor_services(service_type) WHERE is_active = true;

COMMENT ON TABLE public.vendor_services IS
  'Normalized junction table representing marketplace delivery services (food and/or grocery) operated by a vendor storefront.';


-- =============================================================================
-- §2  BACKFILL EXISTING VENDORS INTO VENDOR_SERVICES
-- =============================================================================

INSERT INTO public.vendor_services (vendor_id, service_type, is_active, created_at, updated_at)
SELECT
  v.id,
  CASE
    WHEN v.business_type = 'grocery_store' THEN 'grocery'::public.service_type
    ELSE 'food'::public.service_type
  END,
  v.is_active,
  now(),
  now()
FROM public.vendors v
ON CONFLICT (vendor_id, service_type) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  updated_at = now();


-- =============================================================================
-- §3  UPDATE VENDOR_APPLICATIONS WITH SERVICE_TYPES ARRAY
-- =============================================================================

ALTER TABLE public.vendor_applications
ADD COLUMN IF NOT EXISTS service_types public.service_type[] DEFAULT ARRAY['food'::public.service_type];

-- Backfill existing vendor_applications
UPDATE public.vendor_applications
SET service_types = CASE
  WHEN business_type = 'grocery_store' THEN ARRAY['grocery'::public.service_type]
  ELSE ARRAY['food'::public.service_type]
END
WHERE service_types IS NULL OR array_length(service_types, 1) IS NULL;


-- =============================================================================
-- §4  HELPER FUNCTION: VENDOR_SUPPORTS_SERVICE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.vendor_supports_service(
  p_vendor_id    uuid,
  p_service_type public.service_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendor_services vs
    JOIN public.vendors v ON v.id = vs.vendor_id
    WHERE vs.vendor_id = p_vendor_id
      AND vs.service_type = p_service_type
      AND vs.is_active = true
      AND v.is_active = true
  );
$$;

COMMENT ON FUNCTION public.vendor_supports_service(uuid, public.service_type) IS
  'Recursion-free authorization check verifying that an active vendor offers a specific marketplace service (food or grocery).';

REVOKE EXECUTE ON FUNCTION public.vendor_supports_service(uuid, public.service_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vendor_supports_service(uuid, public.service_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.vendor_supports_service(uuid, public.service_type) TO authenticated, service_role;


-- =============================================================================
-- §5  UPDATE VALIDATE_ORDER_VENDOR_CONSTRAINT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_order_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.service_type = 'food' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for food orders';
    END IF;
    IF NOT public.vendor_supports_service(NEW.vendor_id, 'food'::public.service_type) THEN
      RAISE EXCEPTION 'Food orders can only be placed with vendors that offer Food service';
    END IF;
  ELSIF NEW.service_type = 'grocery' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for grocery orders';
    END IF;
    IF NOT public.vendor_supports_service(NEW.vendor_id, 'grocery'::public.service_type) THEN
      RAISE EXCEPTION 'Grocery orders can only be placed with vendors that offer Grocery service';
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
-- §6  UPDATE VALIDATE_DELIVERY_VENDOR_CONSTRAINT
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_delivery_vendor_constraint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.service_type = 'food' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for food deliveries';
    END IF;
    IF NOT public.vendor_supports_service(NEW.vendor_id, 'food'::public.service_type) THEN
      RAISE EXCEPTION 'Food deliveries can only be linked to vendors that offer Food service';
    END IF;
  ELSIF NEW.service_type = 'grocery' THEN
    IF NEW.vendor_id IS NULL THEN
      RAISE EXCEPTION 'vendor_id is required for grocery deliveries';
    END IF;
    IF NOT public.vendor_supports_service(NEW.vendor_id, 'grocery'::public.service_type) THEN
      RAISE EXCEPTION 'Grocery deliveries can only be linked to vendors that offer Grocery service';
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
-- §7  UPDATE CALCULATE_DELIVERY_FEE_PREVIEW
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


-- =============================================================================
-- §8  UPDATE CREATE_ORDER_SECURE WITH MULTI-SERVICE & PRODUCT CATEGORY VALIDATION
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

  -- 10. Items array validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 distinct item lines';
  END IF;

  -- 11. Initial Order Row Insertion
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

    -- Fetch product with category service_type
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

    -- Cross-service product line integrity: a food order cannot contain grocery products, and vice versa
    IF v_product.category_service_type IS NOT NULL AND v_product.category_service_type <> p_service_type THEN
      RAISE EXCEPTION
        'Product % belongs to % service and cannot be ordered in a % order',
        v_product_id, v_product.category_service_type, p_service_type;
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
      round(v_product.price * v_item_quantity, 2)
    );

    v_subtotal := v_subtotal + (v_product.price * v_item_quantity);
  END LOOP;

  -- 13. Subtotal and total updates
  v_subtotal := round(v_subtotal, 2);
  v_total := round(v_subtotal + v_delivery_fee, 2);

  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = v_total,
      updated_at = pg_catalog.now()
  WHERE id = v_order_id;

  -- 14. Operational audit log
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
      'total', v_total
    )
  );

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text, uuid) TO authenticated, service_role;


-- =============================================================================
-- §9  TRIGGERS: CATEGORY & PRODUCT VENDOR SERVICE INTEGRITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.validate_category_vendor_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.service_type IS NOT NULL THEN
    IF NOT public.vendor_supports_service(NEW.vendor_id, NEW.service_type) THEN
      RAISE EXCEPTION 'Category service_type "%" is not an active service offered by vendor %',
        NEW.service_type, NEW.vendor_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_category_vendor_service ON public.categories;
CREATE TRIGGER trg_validate_category_vendor_service
  BEFORE INSERT OR UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_category_vendor_service();


CREATE OR REPLACE FUNCTION public.validate_product_vendor_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cat record;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT vendor_id, service_type INTO v_cat
    FROM public.categories
    WHERE id = NEW.category_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Category % does not exist', NEW.category_id;
    END IF;

    IF v_cat.vendor_id <> NEW.vendor_id THEN
      RAISE EXCEPTION 'Category % does not belong to vendor %', NEW.category_id, NEW.vendor_id;
    END IF;

    IF v_cat.service_type IS NOT NULL AND NOT public.vendor_supports_service(NEW.vendor_id, v_cat.service_type) THEN
      RAISE EXCEPTION 'Cannot associate product with category "%" because vendor does not offer % service',
        NEW.category_id, v_cat.service_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_vendor_service ON public.products;
CREATE TRIGGER trg_validate_product_vendor_service
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_product_vendor_service();


-- =============================================================================
-- §10  UPDATE PROFILE SYNC TRIGGER & APPROVE_VENDOR_APPLICATION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_sync_profile_role_to_operational()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vapp      record;
  v_vendor_id uuid;
  v_st        public.service_type;
BEGIN
  -- 1. Profile is Rider -> Ensure row exists in public.riders
  IF NEW.role = 'rider' THEN
    INSERT INTO public.riders (
      profile_id,
      is_available,
      total_deliveries,
      is_active,
      is_verified,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      false, -- Offline by default
      0,
      true,
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      is_verified = true,
      updated_at = now();

    -- Mark pending rider application as approved
    UPDATE public.rider_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';

  -- 2. Profile is Vendor -> Ensure row exists in public.vendors and public.vendor_services
  ELSIF NEW.role = 'vendor' THEN
    SELECT * INTO v_vapp
    FROM public.vendor_applications
    WHERE profile_id = NEW.id
    ORDER BY submitted_at DESC
    LIMIT 1;

    INSERT INTO public.vendors (
      profile_id,
      business_name,
      business_type,
      business_description,
      business_address,
      phone,
      email,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      COALESCE(v_vapp.business_name, NULLIF(TRIM(NEW.full_name), '') || ' Store', 'KingdomDash Vendor Store'),
      COALESCE(v_vapp.business_type, 'restaurant'::public.business_type),
      v_vapp.business_description,
      COALESCE(v_vapp.business_address, 'Market Center, Owerri'),
      COALESCE(v_vapp.phone, NEW.phone, ''),
      COALESCE(v_vapp.email, NEW.email, ''),
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.vendors.phone),
      email = COALESCE(NULLIF(EXCLUDED.email, ''), public.vendors.email),
      is_active = true,
      updated_at = now()
    RETURNING id INTO v_vendor_id;

    -- Provision vendor services based on application service_types or fallback
    IF v_vapp.service_types IS NOT NULL AND array_length(v_vapp.service_types, 1) > 0 THEN
      FOREACH v_st IN ARRAY v_vapp.service_types
      LOOP
        IF v_st IN ('food', 'grocery') THEN
          INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
          VALUES (v_vendor_id, v_st, true)
          ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
        END IF;
      END LOOP;
    ELSE
      INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
      VALUES (
        v_vendor_id,
        CASE WHEN COALESCE(v_vapp.business_type, 'restaurant') = 'grocery_store' THEN 'grocery'::public.service_type ELSE 'food'::public.service_type END,
        true
      )
      ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
    END IF;

    -- Mark pending vendor application as approved
    UPDATE public.vendor_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;


CREATE OR REPLACE FUNCTION public.approve_vendor_application(
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_app         record;
  v_profile     record;
  v_vendor_id   uuid;
  v_st          public.service_type;
BEGIN
  -- 1. Authorization Check
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can approve vendor applications'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Lock and retrieve application
  SELECT * INTO v_app
  FROM public.vendor_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor application % not found', p_application_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_app.status = 'approved' THEN
    SELECT id INTO v_vendor_id FROM public.vendors WHERE profile_id = v_app.profile_id;
    RETURN jsonb_build_object(
      'success', true,
      'application_id', p_application_id,
      'vendor_id', v_vendor_id,
      'profile_id', v_app.profile_id,
      'status', 'already_approved'
    );
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot approve vendor application in % status', v_app.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 3. Lock and retrieve profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_app.profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for vendor applicant % not found', v_app.profile_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot approve vendor application: profile is inactive'
      USING ERRCODE = 'KD409';
  END IF;

  -- 4. ATOMIC CREATION: Insert or update operational vendor record
  INSERT INTO public.vendors (
    profile_id,
    business_name,
    business_type,
    business_description,
    business_address,
    phone,
    email,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    v_app.profile_id,
    COALESCE(v_app.business_name, NULLIF(TRIM(v_profile.full_name), '') || ' Store', 'KingdomDash Vendor Store'),
    COALESCE(v_app.business_type, 'restaurant'::public.business_type),
    v_app.business_description,
    COALESCE(v_app.business_address, 'Market Center, Owerri'),
    COALESCE(v_app.phone, v_profile.phone, ''),
    COALESCE(v_app.email, v_profile.email, ''),
    true,
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    business_address = EXCLUDED.business_address,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_vendor_id;

  -- 5. Provision vendor services
  IF v_app.service_types IS NOT NULL AND array_length(v_app.service_types, 1) > 0 THEN
    FOREACH v_st IN ARRAY v_app.service_types
    LOOP
      IF v_st IN ('food', 'grocery') THEN
        INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
        VALUES (v_vendor_id, v_st, true)
        ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
    VALUES (
      v_vendor_id,
      CASE WHEN COALESCE(v_app.business_type, 'restaurant') = 'grocery_store' THEN 'grocery'::public.service_type ELSE 'food'::public.service_type END,
      true
    )
    ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
  END IF;

  -- 6. Mark application approved
  UPDATE public.vendor_applications
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  -- 7. ATOMIC PROMOTION: Promote profile role to 'vendor'
  UPDATE public.profiles
  SET role = 'vendor'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id;

  -- 8. Audit Events
  PERFORM public.log_operational_audit_event(
    'vendor_application_approved',
    'vendor_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'vendor_id', v_vendor_id),
    'Approved by administrator'
  );

  PERFORM public.log_operational_audit_event(
    'vendor_role_promoted',
    'profile',
    v_app.profile_id,
    jsonb_build_object('role', v_profile.role),
    jsonb_build_object('role', 'vendor', 'vendor_id', v_vendor_id),
    'Role promoted following vendor application approval'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'vendor_id', v_vendor_id,
    'profile_id', v_app.profile_id,
    'role', 'vendor'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_vendor_application(uuid) TO authenticated, service_role;


-- =============================================================================
-- §11  RPC: SET_VENDOR_SERVICES (VENDOR & ADMIN MANAGEMENT)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_vendor_services(
  p_vendor_id     uuid,
  p_service_types text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role  text;
  v_is_owner     boolean;
  v_st_text      text;
  v_valid_types  text[] := ARRAY[]::text[];
BEGIN
  -- 1. Authorization: caller must be admin/super_admin or the vendor profile owner
  v_caller_role := public.get_current_user_role();
  v_is_owner := public.is_current_vendor_owner(p_vendor_id);

  IF v_caller_role NOT IN ('admin', 'super_admin') AND NOT v_is_owner AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators or the vendor owner can modify vendor services'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Validate input array
  IF p_service_types IS NULL OR array_length(p_service_types, 1) IS NULL THEN
    RAISE EXCEPTION 'Vendor must have at least one active service (food or grocery)';
  END IF;

  FOREACH v_st_text IN ARRAY p_service_types
  LOOP
    IF v_st_text IN ('food', 'grocery') THEN
      v_valid_types := array_append(v_valid_types, v_st_text);
    END IF;
  END LOOP;

  IF array_length(v_valid_types, 1) IS NULL OR array_length(v_valid_types, 1) = 0 THEN
    RAISE EXCEPTION 'At least one valid service (food or grocery) must be specified';
  END IF;

  -- 3. Update existing services: deactivate those not in the list
  UPDATE public.vendor_services
  SET is_active = false,
      updated_at = now()
  WHERE vendor_id = p_vendor_id
    AND service_type::text <> ALL(v_valid_types);

  -- 4. Upsert services in the list as active
  FOREACH v_st_text IN ARRAY v_valid_types
  LOOP
    INSERT INTO public.vendor_services (vendor_id, service_type, is_active, updated_at)
    VALUES (p_vendor_id, v_st_text::public.service_type, true, now())
    ON CONFLICT (vendor_id, service_type) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END LOOP;

  -- 5. Audit event
  PERFORM public.log_operational_audit_event(
    'vendor_services_updated',
    'vendors',
    p_vendor_id,
    NULL,
    jsonb_build_object('vendor_id', p_vendor_id, 'services', v_valid_types),
    'Vendor marketplace services updated'
  );

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', p_vendor_id,
    'services', v_valid_types
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_vendor_services(uuid, text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_vendor_services(uuid, text[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_vendor_services(uuid, text[]) TO authenticated, service_role;


-- =============================================================================
-- §12  ROW LEVEL SECURITY ON VENDOR_SERVICES
-- =============================================================================

ALTER TABLE public.vendor_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendor_services_select_public" ON public.vendor_services;
CREATE POLICY "vendor_services_select_public" ON public.vendor_services
  FOR SELECT
  TO PUBLIC
  USING (is_active = true);

DROP POLICY IF EXISTS "vendor_services_select_own_vendor" ON public.vendor_services;
CREATE POLICY "vendor_services_select_own_vendor" ON public.vendor_services
  FOR SELECT
  TO authenticated
  USING (public.is_current_vendor_owner(vendor_id));

DROP POLICY IF EXISTS "vendor_services_manage_own_vendor" ON public.vendor_services;
CREATE POLICY "vendor_services_manage_own_vendor" ON public.vendor_services
  FOR ALL
  TO authenticated
  USING (public.is_current_vendor_owner(vendor_id))
  WITH CHECK (public.is_current_vendor_owner(vendor_id));

DROP POLICY IF EXISTS "vendor_services_all_admin" ON public.vendor_services;
CREATE POLICY "vendor_services_all_admin" ON public.vendor_services
  FOR ALL
  TO authenticated
  USING (public.get_current_user_role() IN ('admin', 'super_admin'))
  WITH CHECK (public.get_current_user_role() IN ('admin', 'super_admin'));

-- Explicit table grants
GRANT SELECT ON public.vendor_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vendor_services TO authenticated, service_role;

-- =============================================================================
-- END OF MIGRATION 028
-- =============================================================================
