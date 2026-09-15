-- =============================================================================
-- Migration: 20260902000015_remaining_medium_fixes.sql
-- Purpose : Fix remaining MEDIUM open items from security audit report
-- Applies after migrations 001–014
-- =============================================================================
--
-- Issues fixed in this migration:
--
-- MEDIUM-1: vendor_applications_insert_own and rider_applications_insert_own
--           do not enforce status = 'pending' on INSERT.
--           A crafted INSERT could set status = 'approved', bypassing the
--           admin approval workflow entirely.
--
-- MEDIUM-2: payments_update_admin has no WITH CHECK.
--           FIX: BEFORE UPDATE trigger on payments enforces that the
--           financial identity fields (order_id, amount, currency,
--           paystack_reference) cannot be changed by any UPDATE, including
--           admin updates. Only status and verified_at remain mutable.
--           Trigger approach avoids all ambiguous `id` subquery issues.
--
-- MEDIUM-3: create_order_secure does not detect duplicate product_id entries.
--           Reject duplicate product IDs within a single order.
--           Also adds FOR UPDATE lock on product SELECT, address validation,
--           JSON object guard, and overflow protection.
--
-- MEDIUM-4: Concurrency — FOR UPDATE lock on product rows inside
--           create_order_secure. See function comments for details.
-- =============================================================================


-- =============================================================================
-- §1  vendor_applications INSERT — enforce status = 'pending'
-- =============================================================================

DROP POLICY IF EXISTS "vendor_applications_insert_own" ON public.vendor_applications;
CREATE POLICY "vendor_applications_insert_own" ON public.vendor_applications
  FOR INSERT
  WITH CHECK (
    profile_id  = auth.uid()
    AND status      = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );


-- =============================================================================
-- §2  rider_applications INSERT — enforce status = 'pending'
-- =============================================================================

DROP POLICY IF EXISTS "rider_applications_insert_own" ON public.rider_applications;
CREATE POLICY "rider_applications_insert_own" ON public.rider_applications
  FOR INSERT
  WITH CHECK (
    profile_id  = auth.uid()
    AND status      = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
  );


-- =============================================================================
-- §3  payments — enforce immutability of financial identity fields via trigger
-- =============================================================================
-- APPROACH: BEFORE UPDATE trigger instead of WITH CHECK subquery.
--
-- Why NOT a WITH CHECK subquery (WHERE p.id = id):
--   The bare `id` inside a WITH CHECK subquery is ambiguous in PostgreSQL/Supabase
--   ("column reference id is ambiguous"). This was the root cause of the error
--   in previous migration drafts. A trigger completely avoids this.
--
-- Why NOT a callable SECURITY DEFINER function (get_payment_immutable_fields):
--   A SECURITY DEFINER function granted to `authenticated` would allow any
--   logged-in user to read order_id, amount, currency, and paystack_reference
--   for any payment UUID — bypassing payments RLS. This is an information
--   disclosure vulnerability. Rejected.
--
-- The trigger runs BEFORE UPDATE on payments, compares OLD vs NEW for the
-- immutable fields, and raises an exception if any differ. It applies to ALL
-- updates including admin updates — enforcing the financial audit trail.
-- Mutable fields (status, verified_at) are not checked and remain changeable.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_payment_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- order_id: must never change after creation
  IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION
      'payments.order_id is immutable; attempted change from % to %',
      OLD.order_id, NEW.order_id;
  END IF;

  -- amount: must never change after creation
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION
      'payments.amount is immutable; attempted change from % to %',
      OLD.amount, NEW.amount;
  END IF;

  -- currency: must never change after creation
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION
      'payments.currency is immutable; attempted change from % to %',
      OLD.currency, NEW.currency;
  END IF;

  -- paystack_reference: must never change once set
  IF NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference THEN
    RAISE EXCEPTION
      'payments.paystack_reference is immutable once set; attempted change';
  END IF;

  -- created_at: must never change
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'payments.created_at is immutable';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are PUBLIC EXECUTE by default — revoke immediately
REVOKE EXECUTE ON FUNCTION public.protect_payment_immutable_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_payment_immutable_fields ON public.payments;
CREATE TRIGGER trg_protect_payment_immutable_fields
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_payment_immutable_fields();

-- payments_update_admin: admin may update only status and verified_at.
-- The trigger above enforces immutability of all other fields regardless.
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE
  USING (get_current_user_role() IN ('admin', 'super_admin'));


-- =============================================================================
-- §4  create_order_secure — final hardened version
-- =============================================================================
-- Changes from migration 013 version:
--   a) Reject items where the JSON element is not an object (e.g. ["hello"])
--   b) Reject duplicate product_id values within a single order
--   c) FOR UPDATE lock on product SELECT — prevents concurrent price changes
--      from producing a different snapshot between SELECT and INSERT
--   d) Overflow guards on line_total and running subtotal
--   e) Non-empty address validation
--   f) special_instructions truncated to 500 chars
-- =============================================================================

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
  v_user_id          uuid;
  v_order_id         uuid;
  v_vendor           record;
  v_product          record;
  v_item             jsonb;
  v_subtotal         numeric(12,2) := 0;
  v_item_quantity    integer;
  v_product_id       uuid;
  v_qty_raw          text;
  v_seen_product_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Authentication
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Courier orders not supported by this RPC
  IF p_service_type = 'courier' THEN
    RAISE EXCEPTION 'create_order_secure does not support courier orders; use the courier workflow';
  END IF;

  -- Address validation
  IF p_pickup_address IS NULL OR trim(p_pickup_address) = '' THEN
    RAISE EXCEPTION 'pickup_address is required and must not be empty';
  END IF;
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'delivery_address is required and must not be empty';
  END IF;

  -- Items array validation
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'p_items must be a non-empty JSON array';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Order cannot contain more than 50 distinct item lines';
  END IF;

  -- Vendor validation
  SELECT id, is_active INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR NOT v_vendor.is_active THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  -- Create order row with zero totals
  -- customer_id comes from auth.uid() only — never from client input
  -- delivery_fee = 0: Phase 8 replaces with distance-based server calculation
  INSERT INTO public.orders (
    customer_id, vendor_id, service_type,
    pickup_address, delivery_address,
    delivery_fee, subtotal, total, special_instructions
  )
  VALUES (
    v_user_id, p_vendor_id, p_service_type,
    p_pickup_address, p_delivery_address,
    0, 0, 0,
    left(p_special_instructions, 500)
  )
  RETURNING id INTO v_order_id;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Each element must be a JSON object, not a scalar or nested array
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
    -- Reject fractional strings like "1.5"
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

    -- Reject duplicate product IDs — callers must use quantity for multiple units
    IF v_product_id = ANY(v_seen_product_ids) THEN
      RAISE EXCEPTION
        'Duplicate product_id % in p_items; use quantity to order multiple units of the same product',
        v_product_id;
    END IF;
    v_seen_product_ids := array_append(v_seen_product_ids, v_product_id);

    -- Fetch product with FOR UPDATE lock.
    -- FOR UPDATE prevents concurrent writers from changing the price until
    -- this transaction commits, making pricing deterministic under concurrency.
    -- The locked price becomes the immutable snapshot for this order line.
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

    -- Overflow guard for individual line total
    IF v_product.price * v_item_quantity > 9999999999.99 THEN
      RAISE EXCEPTION
        'Line total for product % exceeds the maximum allowed value', v_product_id;
    END IF;

    -- Insert order item — price from DB, never from client
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

    -- Overflow guard for running subtotal
    IF v_subtotal > 9999999999.99 THEN
      RAISE EXCEPTION 'Order subtotal exceeds the maximum allowed value';
    END IF;
  END LOOP;

  -- Update order with server-calculated totals
  UPDATE public.orders
  SET subtotal = v_subtotal,
      total    = v_subtotal
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) TO authenticated;


-- =============================================================================
-- END OF MIGRATION 015
-- =============================================================================
-- Summary of changes:
--
-- Policies REPLACED (3):
--   vendor_applications_insert_own — enforces status='pending', reviewed_at/by IS NULL
--   rider_applications_insert_own  — same
--   payments_update_admin          — simplified (immutability enforced by trigger)
--
-- Trigger function CREATED (1):
--   protect_payment_immutable_fields() — SECURITY INVOKER BEFORE UPDATE on payments;
--   rejects changes to order_id, amount, currency, paystack_reference, created_at
--
-- Functions REPLACED (1):
--   create_order_secure(...)       — duplicate product_id rejection, JSON object guard,
--                                    address validation, FOR UPDATE price lock,
--                                    overflow guards, special_instructions length limit
-- =============================================================================
