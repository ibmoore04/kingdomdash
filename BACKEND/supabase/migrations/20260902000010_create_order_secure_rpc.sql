-- Migration: 20260902000010_create_order_secure_rpc.sql
-- Creates create_order_secure() SECURITY DEFINER RPC
-- Financial authority invariant: client never supplies subtotal, delivery_fee, total,
-- unit_price, or line_total — all monetary values are computed server-side from DB prices.
-- This RPC is the ONLY path for order creation; never INSERT into orders directly from frontend.

CREATE OR REPLACE FUNCTION public.create_order_secure(
  p_vendor_id uuid,
  p_service_type service_type,
  p_pickup_address text,
  p_delivery_address text,
  p_items jsonb,
  p_special_instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_order_id uuid;
  v_vendor record;
  v_product record;
  v_item jsonb;
  v_subtotal numeric(12,2) := 0;
  v_item_quantity integer;
  v_product_id uuid;
BEGIN
  -- Guard: must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Guard: courier orders are not supported by this RPC
  IF p_service_type = 'courier' THEN
    RAISE EXCEPTION 'create_order_secure does not support courier orders';
  END IF;

  -- Guard: items array must not be empty
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- Validate vendor exists and is active
  SELECT id, is_active INTO v_vendor
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND OR v_vendor.is_active = false THEN
    RAISE EXCEPTION 'Vendor not found or is inactive';
  END IF;

  -- Insert the orders row with zero totals (updated after items are inserted)
  INSERT INTO public.orders (
    customer_id,
    vendor_id,
    service_type,
    pickup_address,
    delivery_address,
    delivery_fee,
    subtotal,
    total,
    special_instructions
  )
  VALUES (
    v_user_id,
    p_vendor_id,
    p_service_type,
    p_pickup_address,
    p_delivery_address,
    0,  -- delivery_fee: server-controlled; Phase 8 placeholder
    0,  -- subtotal: updated after items inserted
    0,  -- total: updated after items inserted
    p_special_instructions
  )
  RETURNING id INTO v_order_id;

  -- Loop over items and insert order_items rows
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate quantity: must be a positive integer
    v_item_quantity := (v_item->>'quantity')::integer;
    IF v_item_quantity IS NULL OR v_item_quantity <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be a positive integer';
    END IF;

    -- Get the product_id from the item
    v_product_id := (v_item->>'product_id')::uuid;

    -- Validate product exists, belongs to this vendor, and is available
    -- Price comes from the DB — never from the client
    SELECT id, name, price INTO v_product
    FROM public.products
    WHERE id = v_product_id
      AND vendor_id = p_vendor_id
      AND is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found, unavailable, or belongs to a different vendor', v_product_id;
    END IF;

    -- Insert order item using DB-read price (not client-supplied)
    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      unit_price,
      quantity,
      line_total
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.price,
      v_item_quantity,
      v_product.price * v_item_quantity
    );

    -- Accumulate subtotal
    v_subtotal := v_subtotal + (v_product.price * v_item_quantity);
  END LOOP;

  -- Update order totals after all items are inserted
  -- delivery_fee remains 0 — Phase 8 will compute this server-side
  UPDATE public.orders
  SET subtotal = v_subtotal,
      total = v_subtotal
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

-- Revoke public execute permission (not callable by unauthenticated/anonymous users)
REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) FROM PUBLIC;

-- Grant execute only to authenticated users
GRANT EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) TO authenticated;
