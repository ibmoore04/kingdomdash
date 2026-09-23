-- Migration: 20260902000037_integrate_personal_shopper_as_orders.sql
-- 1. Add 'custom' to service_type enum
-- 2. Allow nullable customer_id on orders and created_by on deliveries for guest/concierge orders
-- 3. Add customer contact snapshot columns to orders
-- 4. Add order_id to personal_shopper_requests
-- 5. Update submit_personal_shopper_request to create orders, order_items, and deliveries atomically
-- 6. Update assign_delivery_to_rider to support 'custom' service type and sync personal_shopper_requests
-- 7. Backfill existing personal_shopper_requests into orders, order_items, deliveries, and delivery_assignments

-- ============================================================
-- Section 1: Column & Enum Alterations
-- ============================================================

-- 1. Alter service_type on orders and deliveries to text.
-- CRITICAL FIX for PostgreSQL error 55P04 ("unsafe use of new value 'custom' of enum type service_type"):
-- In PostgreSQL, ALTER TYPE ... ADD VALUE cannot be used within the same transaction block.
-- By converting service_type on orders and deliveries to text, string values ('food', 'grocery',
-- 'courier', 'custom') are stored directly without enum transaction locking.
ALTER TABLE public.orders ALTER COLUMN service_type TYPE text USING service_type::text;
ALTER TABLE public.deliveries ALTER COLUMN service_type TYPE text USING service_type::text;

-- 2. Safely register 'custom' into the enum type if possible
DO $$
BEGIN
  ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'custom';
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- 3. Allow guest/concierge orders without rigid profile requirement
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.deliveries ALTER COLUMN created_by DROP NOT NULL;

-- 4. Snapshot direct customer name & phone on orders table for fast lookup
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;

-- 5. Link personal_shopper_requests to the authoritative orders table
ALTER TABLE public.personal_shopper_requests ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_shopper_requests_order_id ON public.personal_shopper_requests(order_id);

-- 6. Update vendor constraints to allow 'custom' with vendor_id = NULL
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
  ELSIF NEW.service_type IN ('courier', 'custom') THEN
    IF NEW.vendor_id IS NOT NULL THEN
      RAISE EXCEPTION 'vendor_id must be NULL for % orders', NEW.service_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
  ELSIF NEW.service_type IN ('courier', 'custom') THEN
    IF NEW.vendor_id IS NOT NULL THEN
      RAISE EXCEPTION 'vendor_id must be NULL for % deliveries', NEW.service_type;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- Section 2: Authoritative submit_personal_shopper_request
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_personal_shopper_request(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_market_name text,
  p_budget_cap numeric DEFAULT NULL,
  p_estimated_total numeric DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_new_shopper_id uuid;
  v_order_id       uuid;
  v_delivery_id    uuid;
  v_user_id        uuid;
  v_item           jsonb;
  v_item_name      text;
  v_item_qty_raw   text;
  v_item_qty_int   integer;
  v_item_cost      numeric(12, 2);
  v_subtotal       numeric(12, 2);
  v_total          numeric(12, 2);
  v_delivery_fee   numeric(12, 2) := 600.00;
BEGIN
  v_user_id := auth.uid();
  v_subtotal := COALESCE(p_estimated_total, p_budget_cap, 0.00);
  v_total := v_subtotal + v_delivery_fee;

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
    v_subtotal,
    v_total,
    NULLIF(TRIM(p_notes), ''),
    pg_catalog.now(),
    pg_catalog.now()
  )
  RETURNING id INTO v_order_id;

  -- 3. Link shopper request to order
  UPDATE public.personal_shopper_requests
  SET order_id = v_order_id
  WHERE id = v_new_shopper_id;

  -- 4. Snapshot cargo shopping items into public.order_items
  IF p_items IS NOT NULL AND jsonb_typeof(p_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_item_name := COALESCE(v_item->>'name', 'Shopping Item');
      v_item_qty_raw := COALESCE(v_item->>'quantity', '1');
      v_item_qty_int := regexp_replace(v_item_qty_raw, '[^0-9]', '', 'g')::integer;
      IF v_item_qty_int IS NULL OR v_item_qty_int < 1 THEN
        v_item_qty_int := 1;
      END IF;
      v_item_cost := COALESCE((v_item->>'estimatedCost')::numeric, 0.00);

      INSERT INTO public.order_items (
        order_id,
        product_id,
        product_name,
        unit_price,
        quantity,
        line_total,
        created_at
      ) VALUES (
        v_order_id,
        NULL,
        v_item_name || CASE WHEN v_item_qty_raw <> '' AND v_item_qty_raw <> (v_item_qty_int::text) THEN ' (' || v_item_qty_raw || ')' ELSE '' END,
        v_item_cost,
        v_item_qty_int,
        v_item_cost * v_item_qty_int,
        pg_catalog.now()
      );
    END LOOP;
  END IF;

  -- 5. Create authoritative delivery record in public.deliveries
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
    v_order_id,
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    'custom',
    NULL,
    TRIM(p_market_name),
    'Market Concierge',
    TRIM(p_delivery_address),
    TRIM(p_customer_phone),
    NULLIF(TRIM(p_notes), ''),
    'pending',
    v_user_id,
    pg_catalog.now(),
    pg_catalog.now()
  )
  RETURNING id INTO v_delivery_id;

  RETURN v_new_shopper_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text) TO anon, authenticated;

-- ============================================================
-- Section 3: Update assign_delivery_to_rider for 'custom' orders
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_delivery_to_rider(
  p_delivery_id uuid,
  p_rider_id    uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role           text;
  v_dispatcher_id  uuid;
  v_order_id       uuid;
  v_delivery       record;
  v_order          record;
  v_rider          record;
  v_assignment_id  uuid;
BEGIN
  -- Authorization: strictly Admin or Super Admin
  v_role := public.get_current_user_role();
  IF v_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only dispatch administrators can assign deliveries' USING ERRCODE = 'KD403';
  END IF;

  v_dispatcher_id := auth.uid();
  IF v_dispatcher_id IS NULL THEN
    RAISE EXCEPTION 'Authenticated dispatcher profile required for assignment' USING ERRCODE = 'KD403';
  END IF;

  -- Discover linked order_id
  SELECT order_id INTO v_order_id
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id USING ERRCODE = 'KD404';
  END IF;

  -- 1. Lock linked orders first
  IF v_order_id IS NOT NULL THEN
    SELECT id, service_type, status
    INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF v_order.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot assign delivery for a cancelled order' USING ERRCODE = 'KD409';
    END IF;

    -- Food/grocery validation (allows pending, payment_confirmed, preparing, ready_for_pickup)
    IF v_order.service_type IN ('food', 'grocery') AND v_order.status NOT IN ('pending', 'payment_confirmed', 'preparing', 'ready_for_pickup') THEN
      RAISE EXCEPTION 'Cannot assign food/grocery delivery for order in status %', v_order.status
        USING ERRCODE = 'KD409';
    END IF;

    -- Courier & custom validation (allows pending, payment_confirmed, ready_for_pickup)
    IF v_order.service_type IN ('courier', 'custom') AND v_order.status NOT IN ('pending', 'payment_confirmed', 'ready_for_pickup') THEN
      RAISE EXCEPTION 'Cannot assign % delivery for order in status %', v_order.service_type, v_order.status
        USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, order_id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF v_delivery.status NOT IN ('pending', 'assigned') THEN
    RAISE EXCEPTION 'Delivery % cannot be assigned from status %', p_delivery_id, v_delivery.status
      USING ERRCODE = 'KD409';
  END IF;

  -- Rejection check: cannot assign if delivery already has an accepted assignment
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Delivery % already has an accepted assignment in progress', p_delivery_id
      USING ERRCODE = 'KD409';
  END IF;

  -- 3. Close any existing unaccepted assignment for this delivery
  UPDATE public.delivery_assignments
  SET status = 'rejected',
      notes = COALESCE(notes, '') || ' [Reassigned by dispatcher]',
      responded_at = COALESCE(responded_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE delivery_id = p_delivery_id
    AND status = 'assigned';

  -- Verify rider eligibility with EXCLUSIVE ROW LOCK (FOR UPDATE)
  SELECT id, profile_id, is_verified, is_active, is_available
  INTO v_rider
  FROM public.riders
  WHERE id = p_rider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider % not found', p_rider_id USING ERRCODE = 'KD404';
  END IF;

  -- Ensure rider has 0 in-flight deliveries currently
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.deliveries d ON d.id = da.delivery_id
    WHERE da.rider_id = p_rider_id
      AND da.status IN ('assigned', 'accepted')
      AND d.status IN ('assigned', 'picked_up', 'in_transit')
  ) THEN
    RAISE EXCEPTION 'Rider % already has an active in-flight delivery', p_rider_id
      USING ERRCODE = 'KD409';
  END IF;

  -- Insert assignment record
  INSERT INTO public.delivery_assignments (
    delivery_id,
    rider_id,
    assigned_by,
    status,
    assigned_at
  ) VALUES (
    p_delivery_id,
    p_rider_id,
    v_dispatcher_id,
    'assigned',
    pg_catalog.now()
  )
  RETURNING id INTO v_assignment_id;

  -- Update delivery status to assigned
  UPDATE public.deliveries
  SET status = 'assigned',
      updated_at = pg_catalog.now()
  WHERE id = p_delivery_id;

  -- Update order status to in_transit
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'in_transit',
        updated_at = pg_catalog.now()
    WHERE id = v_order_id;

    -- Also update linked personal_shopper_requests if applicable
    UPDATE public.personal_shopper_requests
    SET status = 'assigned',
        assigned_shopper_id = v_rider.profile_id,
        updated_at = pg_catalog.now()
    WHERE order_id = v_order_id;
  END IF;

  RETURN v_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO authenticated;

-- ============================================================
-- Section 4: Backfill existing personal_shopper_requests
-- ============================================================

DO $$
DECLARE
  r record;
  v_ord_id uuid;
  v_del_id uuid;
  v_item jsonb;
  v_item_name text;
  v_item_qty_raw text;
  v_item_qty_int integer;
  v_item_cost numeric(12,2);
  v_rider_rec record;
BEGIN
  FOR r IN
    SELECT * FROM public.personal_shopper_requests
    WHERE order_id IS NULL
  LOOP
    -- Create order row
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
      subtotal,
      total,
      special_instructions,
      created_at,
      updated_at
    ) VALUES (
      NULL,
      NULL,
      'custom',
      CASE WHEN r.status = 'completed' THEN 'delivered'::order_status WHEN r.status = 'cancelled' THEN 'cancelled'::order_status WHEN r.status = 'assigned' THEN 'in_transit'::order_status ELSE 'pending'::order_status END,
      r.market_name,
      r.delivery_address,
      r.customer_name,
      r.customer_phone,
      r.customer_name,
      r.customer_phone,
      'Market Concierge',
      r.customer_phone,
      600.00,
      COALESCE(r.estimated_total, r.budget_cap, 0.00),
      COALESCE(r.estimated_total, r.budget_cap, 0.00) + 600.00,
      r.notes,
      r.created_at,
      r.updated_at
    )
    RETURNING id INTO v_ord_id;

    -- Link request
    UPDATE public.personal_shopper_requests
    SET order_id = v_ord_id
    WHERE id = r.id;

    -- Insert order items
    IF r.items IS NOT NULL AND jsonb_typeof(r.items) = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(r.items)
      LOOP
        v_item_name := COALESCE(v_item->>'name', 'Shopping Item');
        v_item_qty_raw := COALESCE(v_item->>'quantity', '1');
        v_item_qty_int := regexp_replace(v_item_qty_raw, '[^0-9]', '', 'g')::integer;
        IF v_item_qty_int IS NULL OR v_item_qty_int < 1 THEN
          v_item_qty_int := 1;
        END IF;
        v_item_cost := COALESCE((v_item->>'estimatedCost')::numeric, 0.00);

        INSERT INTO public.order_items (
          order_id,
          product_id,
          product_name,
          unit_price,
          quantity,
          line_total,
          created_at
        ) VALUES (
          v_ord_id,
          NULL,
          v_item_name,
          v_item_cost,
          v_item_qty_int,
          v_item_cost * v_item_qty_int,
          r.created_at
        );
      END LOOP;
    END IF;

    -- Insert delivery
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
      v_ord_id,
      r.customer_name,
      r.customer_phone,
      'custom',
      NULL,
      r.market_name,
      'Market Concierge',
      r.delivery_address,
      r.customer_phone,
      r.notes,
      CASE WHEN r.status = 'assigned' THEN 'assigned'::delivery_status WHEN r.status = 'completed' THEN 'delivered'::delivery_status ELSE 'pending'::delivery_status END,
      NULL,
      r.created_at,
      r.updated_at
    )
    RETURNING id INTO v_del_id;

    -- If already assigned to a shopper, create delivery_assignment
    IF r.assigned_shopper_id IS NOT NULL THEN
      SELECT id INTO v_rider_rec
      FROM public.riders
      WHERE profile_id = r.assigned_shopper_id
      LIMIT 1;

      IF v_rider_rec.id IS NOT NULL THEN
        INSERT INTO public.delivery_assignments (
          delivery_id,
          rider_id,
          assigned_by,
          status,
          assigned_at
        ) VALUES (
          v_del_id,
          v_rider_rec.id,
          r.assigned_shopper_id,
          'assigned',
          r.updated_at
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

  END LOOP;
END $$;
