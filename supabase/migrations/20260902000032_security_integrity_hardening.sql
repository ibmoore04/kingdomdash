-- ============================================================================
-- KingdomDash Migration: Security & Data Integrity Hardening
-- Migration: 20260902000032_security_integrity_hardening.sql
--
-- Target Hardening Fixes (CodeRabbit Findings):
--   §1. contact_messages: Revoke unrestricted anonymous/authenticated direct INSERT.
--       Public support submissions must route exclusively through the abuse-protected
--       submit_support_ticket() SECURITY DEFINER RPC.
--   §2. reject_delivery_assignment: Add post-lock verification and atomic status check
--       to prevent concurrent state overwrite if accept and reject execute simultaneously.
--   §3. create_order_secure: Implement deterministic product row locking (ordered by
--       product_id ASC) to mathematically eliminate PostgreSQL 40P01 deadlocks when
--       concurrent checkouts contain overlapping products in reverse input order.
--   §4. delivery_pricing_rules: Add named CHECK constraint enforcing min_fee <= max_fee.
--   §5. order_items: Drop order_items_insert_customer policy and revoke direct table INSERT
--       from authenticated and anon. Order item creation remains strictly authoritative
--       via create_order_secure().
-- ============================================================================

-- ============================================================================
-- §1. CONTACT_MESSAGES: Revoke Direct INSERT, Enforce submit_support_ticket RPC
-- ============================================================================

-- 1.1 Drop legacy open INSERT policy allowing unvalidated anonymous insertions
DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;

-- 1.2 Explicitly revoke direct INSERT table privilege from anonymous and authenticated roles
REVOKE INSERT ON public.contact_messages FROM anon, authenticated;

-- 1.3 Ensure submit_support_ticket() RPC retains explicit execution grant for public callers
--     (The function is SECURITY DEFINER with atomic rate limiting and advisory locks)
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;


-- ============================================================================
-- §2. REJECT_DELIVERY_ASSIGNMENT: Atomic Post-Lock Concurrency Hardening
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reject_delivery_assignment(
  p_assignment_id uuid,
  p_reason        text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id         uuid;
  v_assignment_peek  record;
  v_assignment       record;
  v_delivery         record;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rider profile found for current user' USING ERRCODE = 'KD403';
  END IF;

  -- Peek assignment and delivery to discover hierarchy keys before locking
  SELECT da.id, da.delivery_id, da.rider_id, da.status, d.order_id
  INTO v_assignment_peek
  FROM public.delivery_assignments da
  JOIN public.deliveries d ON d.id = da.delivery_id
  WHERE da.id = p_assignment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery assignment % not found', p_assignment_id USING ERRCODE = 'KD404';
  END IF;

  IF v_assignment_peek.rider_id <> v_rider_id THEN
    RAISE EXCEPTION 'Assignment % does not belong to the current rider', p_assignment_id USING ERRCODE = 'KD403';
  END IF;

  IF v_assignment_peek.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''', v_assignment_peek.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 1. Lock linked order first if present (hierarchy: orders -> deliveries -> delivery_assignments)
  IF v_assignment_peek.order_id IS NOT NULL THEN
    PERFORM 1 FROM public.orders WHERE id = v_assignment_peek.order_id FOR UPDATE;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, status INTO v_delivery
  FROM public.deliveries
  WHERE id = v_assignment_peek.delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated delivery % not found',
      v_assignment_peek.delivery_id
      USING ERRCODE = 'KD404';
  END IF;

  -- 3. Lock assignment row third
  SELECT id, delivery_id, rider_id, status
  INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  -- 3.1 Post-lock status verification: ensure status has not transitioned (e.g. to 'accepted')
  --     while waiting to acquire the row lock.
  IF v_assignment.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''', v_assignment.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 3.2 Update assignment status to rejected with atomic status guard in WHERE clause
  UPDATE public.delivery_assignments
  SET status = 'rejected',
      notes = CASE WHEN p_reason IS NOT NULL THEN COALESCE(notes, '') || ' [Rejected: ' || p_reason || ']' ELSE notes END,
      responded_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_assignment_id
    AND status = 'assigned';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot reject assignment in status %; must be ''assigned''', v_assignment.status
      USING ERRCODE = 'KD409';
  END IF;

  -- Revert delivery status to pending ONLY if delivery is still 'assigned' (never reopen cancelled/in_transit deliveries)
  IF v_delivery.status = 'assigned' THEN
    UPDATE public.deliveries
    SET status = 'pending',
        updated_at = pg_catalog.now()
    WHERE id = v_assignment_peek.delivery_id;
  END IF;

  PERFORM public.log_operational_audit_event(
    'assignment_rejected',
    'delivery_assignments',
    p_assignment_id,
    jsonb_build_object('status', 'assigned'),
    jsonb_build_object('status', 'rejected', 'delivery_id', v_assignment_peek.delivery_id, 'reason', p_reason)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) TO authenticated;


-- ============================================================================
-- §3. CREATE_ORDER_SECURE: Deterministic Product Locking (Anti-Deadlock)
-- ============================================================================

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

  -- 10.1 Pre-validate item structure and extract product IDs
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

  -- 10.2 Deterministic Product Locking:
  -- Lock all distinct products in strict ascending UUID order prior to the item loop.
  -- This eliminates cyclic lock wait conditions (SQLSTATE 40P01) between concurrent transactions.
  PERFORM 1
  FROM public.products p
  WHERE p.id = ANY(v_seen_product_ids)
  ORDER BY p.id ASC
  FOR UPDATE OF p;

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
    v_item_quantity := (v_item->>'quantity')::integer;
    v_product_id := (v_item->>'product_id')::uuid;

    -- Fetch product with category service_type (row is already locked)
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


-- ============================================================================
-- §4. DELIVERY_PRICING_RULES: Enforce min_fee <= max_fee Invariant
-- ============================================================================

ALTER TABLE public.delivery_pricing_rules
  DROP CONSTRAINT IF EXISTS check_delivery_pricing_min_max_fee;

ALTER TABLE public.delivery_pricing_rules
  ADD CONSTRAINT check_delivery_pricing_min_max_fee
  CHECK (min_fee IS NULL OR max_fee IS NULL OR min_fee <= max_fee);


-- ============================================================================
-- §5. ORDER_ITEMS: Revoke Direct Customer INSERT, Authorize create_order_secure
-- ============================================================================

-- 5.1 Drop customer INSERT policy on order_items.
--     Customer order creation must flow exclusively through create_order_secure().
DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;

-- 5.2 Revoke direct table INSERT on order_items from authenticated and anon roles.
--     (SELECT policies and admin/service-role permissions remain intact).
REVOKE INSERT ON public.order_items FROM authenticated, anon;
