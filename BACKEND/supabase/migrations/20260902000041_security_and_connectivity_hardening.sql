-- Migration: 20260902000041_security_and_connectivity_hardening.sql
-- Description: Security and connectivity hardening based on comprehensive audit against Website & Product Revision Brief.
-- 1. SEC-01: Revoke unauthorized direct points accrual on add_dashpoints RPC; add server-side triggers for review & delivery points.
-- 2. SEC-02: Delivery confirmation PIN support on orders & deliveries with server-side validation in mark_delivery_delivered.
-- 3. SEC-03: Hardened RLS INSERT policy and unique order index on order_reviews to guarantee verified purchases only.
-- 4. Expose has_delivery_pin in get_rider_active_delivery for secure rider prompt display.

-- ============================================================
-- Section 1: Delivery Confirmation PIN Schema & Triggers
-- ============================================================

-- Add delivery_pin columns if they don't already exist
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_pin text;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_pin text;

-- Trigger to auto-generate a secure 4-digit delivery PIN on new orders
CREATE OR REPLACE FUNCTION public.trg_assign_order_delivery_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.delivery_pin IS NULL OR TRIM(NEW.delivery_pin) = '' THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivery_pin ON public.orders;
CREATE TRIGGER trg_order_delivery_pin
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assign_order_delivery_pin();

-- Trigger to inherit order delivery_pin on delivery dispatch creation (or generate if standalone courier)
CREATE OR REPLACE FUNCTION public.trg_sync_delivery_pin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF (NEW.delivery_pin IS NULL OR TRIM(NEW.delivery_pin) = '') AND NEW.order_id IS NOT NULL THEN
    SELECT delivery_pin INTO NEW.delivery_pin FROM public.orders WHERE id = NEW.order_id;
  END IF;
  IF NEW.delivery_pin IS NULL OR TRIM(NEW.delivery_pin) = '' THEN
    NEW.delivery_pin := lpad(floor(random() * 10000)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_pin_sync ON public.deliveries;
CREATE TRIGGER trg_delivery_pin_sync
  BEFORE INSERT ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_delivery_pin();

-- Backfill existing orders/deliveries that have NULL delivery_pin
UPDATE public.orders
SET delivery_pin = lpad(floor(random() * 10000)::text, 4, '0')
WHERE delivery_pin IS NULL;

UPDATE public.deliveries d
SET delivery_pin = COALESCE(
  (SELECT o.delivery_pin FROM public.orders o WHERE o.id = d.order_id),
  lpad(floor(random() * 10000)::text, 4, '0')
)
WHERE d.delivery_pin IS NULL;

-- ============================================================
-- Section 2: SEC-02: Server-Side PIN Verification on Delivery Complete
-- ============================================================

DROP FUNCTION IF EXISTS public.mark_delivery_delivered(uuid, text);
DROP FUNCTION IF EXISTS public.mark_delivery_delivered(uuid, text, text);

CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(
  p_delivery_id uuid,
  p_notes       text DEFAULT NULL,
  p_pin         text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id   uuid;
  v_order_id   uuid;
  v_delivery   record;
  v_order      record;
  v_assignment record;
  v_expected_pin text;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
  END IF;

  -- Discover linked order_id before acquiring hierarchical row locks
  SELECT order_id INTO v_order_id
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id USING ERRCODE = 'KD404';
  END IF;

  -- 1. Lock linked order first
  IF v_order_id IS NOT NULL THEN
    SELECT id, status, delivery_pin INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, order_id, status, delivery_pin
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  -- Authorization check: caller must have an authorized assignment for this delivery
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND rider_id = v_rider_id
      AND status IN ('accepted', 'completed')
  ) THEN
    RAISE EXCEPTION 'You do not have an authorized assignment for delivery %', p_delivery_id
      USING ERRCODE = 'KD403';
  END IF;

  -- Idempotency check: if already delivered by this rider, return success without duplicate increment
  IF v_delivery.status = 'delivered' THEN
    RETURN;
  END IF;

  -- 3. Lock assignment row third
  SELECT id, status
  INTO v_assignment
  FROM public.delivery_assignments
  WHERE delivery_id = p_delivery_id
    AND rider_id = v_rider_id
    AND status = 'accepted'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'You do not have an accepted assignment for delivery %', p_delivery_id
      USING ERRCODE = 'KD403';
  END IF;

  -- Cross-state invariant enforcement
  IF v_order_id IS NOT NULL AND v_order.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Linked order % is in status ''%''; must be ''in_transit'' to complete delivery',
      v_order_id, v_order.status USING ERRCODE = 'KD409';
  END IF;

  IF v_delivery.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Delivery % is in status %; must be ''in_transit'' to complete delivery',
      p_delivery_id, v_delivery.status USING ERRCODE = 'KD409';
  END IF;

  -- 4. Server-Side Delivery PIN Verification
  v_expected_pin := COALESCE(NULLIF(TRIM(v_delivery.delivery_pin), ''), NULLIF(TRIM(v_order.delivery_pin), ''));
  IF v_expected_pin IS NOT NULL THEN
    IF p_pin IS NULL OR TRIM(p_pin) <> v_expected_pin THEN
      RAISE EXCEPTION 'Invalid delivery confirmation PIN' USING ERRCODE = 'KD403';
    END IF;
  END IF;

  -- 5. Complete order atomically if linked
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'delivered',
        delivered_at = COALESCE(delivered_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE id = v_order_id;
  END IF;

  -- Update delivery
  UPDATE public.deliveries
  SET status = 'delivered',
      delivered_at = COALESCE(delivered_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE id = p_delivery_id;

  -- Close assignment to completed
  UPDATE public.delivery_assignments
  SET status = 'completed',
      updated_at = pg_catalog.now()
  WHERE id = v_assignment.id;

  -- 6. Lock and increment rider completed delivery count atomically
  UPDATE public.riders
  SET total_deliveries = total_deliveries + 1,
      updated_at = pg_catalog.now()
  WHERE id = v_rider_id;

  -- Record status update breadcrumb
  INSERT INTO public.delivery_status_history (
    delivery_id,
    assignment_id,
    previous_status,
    new_status,
    changed_by,
    notes
  ) VALUES (
    p_delivery_id,
    v_assignment.id,
    'in_transit',
    'delivered',
    auth.uid(),
    COALESCE(p_notes, 'Delivery completed by rider with verified PIN')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text, text) TO authenticated, service_role;

-- ============================================================
-- Section 3: Expose has_delivery_pin in get_rider_active_delivery
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_active jsonb;
BEGIN
  -- Authenticate rider caller
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider' USING ERRCODE = 'KD403';
  END IF;

  -- Select active assignment details with masked PIN flag
  SELECT jsonb_build_object(
    'assignment_id', da.id,
    'delivery_id', d.id,
    'order_id', d.order_id,
    'service_type', d.service_type,
    'delivery_status', d.status,
    'assignment_status', da.status,
    'order_status', o.status,
    'has_delivery_pin', (COALESCE(NULLIF(TRIM(d.delivery_pin), ''), NULLIF(TRIM(o.delivery_pin), '')) IS NOT NULL),
    'pickup_address', d.pickup_address,
    'pickup_latitude', COALESCE(d.pickup_latitude, v.latitude),
    'pickup_longitude', COALESCE(d.pickup_longitude, v.longitude),
    'delivery_address', d.delivery_address,
    'delivery_latitude', d.delivery_latitude,
    'delivery_longitude', d.delivery_longitude,
    'customer_name', d.customer_name,
    'customer_phone', d.customer_phone,
    'special_instructions', d.special_instructions,
    'vendor_id', d.vendor_id,
    'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
    'vendor_address', v.business_address,
    'assigned_at', da.assigned_at,
    'responded_at', da.responded_at,
    'picked_up_at', d.picked_up_at,
    'items', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', p.name,
          'quantity', oi.quantity
        )
      ), '[]'::jsonb)
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = d.order_id
    )
  ) INTO v_active
  FROM public.delivery_assignments da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.orders o ON o.id = d.order_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id
  WHERE da.rider_id = v_rider_id
    AND da.status = 'accepted'
    AND d.status IN ('assigned', 'picked_up', 'in_transit')
  LIMIT 1;

  RETURN v_active;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_active_delivery() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_active_delivery() TO authenticated, service_role;

-- ============================================================
-- Section 4: SEC-01: Lock Down add_dashpoints RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_dashpoints(
  p_user_id uuid,
  p_points integer,
  p_type text,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_new_balance integer;
  v_new_lifetime integer;
  v_new_tier text;
BEGIN
  -- Strict caller verification: prevent arbitrary points minting by client
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized to accrue DashPoints directly' USING ERRCODE = 'KD403';
    END IF;
  END IF;

  -- Insert transaction record
  INSERT INTO public.loyalty_transactions (user_id, points, type, description)
  VALUES (p_user_id, p_points, p_type, p_description);

  -- Upsert loyalty account
  INSERT INTO public.loyalty_accounts (user_id, points_balance, lifetime_points, tier)
  VALUES (
    p_user_id,
    GREATEST(0, p_points),
    GREATEST(0, p_points),
    CASE 
      WHEN p_points >= 1500 THEN 'Gold'
      WHEN p_points >= 500 THEN 'Silver'
      ELSE 'Bronze'
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    points_balance = GREATEST(0, public.loyalty_accounts.points_balance + EXCLUDED.points_balance),
    lifetime_points = public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance),
    tier = CASE 
      WHEN (public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance)) >= 1500 THEN 'Gold'
      WHEN (public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance)) >= 500 THEN 'Silver'
      ELSE public.loyalty_accounts.tier
    END,
    updated_at = now()
  RETURNING points_balance, lifetime_points, tier INTO v_new_balance, v_new_lifetime, v_new_tier;

  RETURN jsonb_build_object(
    'points_balance', v_new_balance,
    'lifetime_points', v_new_lifetime,
    'tier', v_new_tier
  );
END;
$$;

-- Revoke public & authenticated execution
REVOKE EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) TO service_role;

-- Automated Server-Side Loyalty Point Triggers:
-- 1. Review Bonus: 50 DashPoints credited server-side when order review is posted
CREATE OR REPLACE FUNCTION public.trg_award_review_dashpoints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    PERFORM public.add_dashpoints(
      NEW.customer_id,
      50,
      'bonus',
      'Order review DashPoints (' || NEW.order_id || ')'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_review_loyalty_points ON public.order_reviews;
CREATE TRIGGER trg_review_loyalty_points
  AFTER INSERT ON public.order_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_review_dashpoints();

-- 2. Delivery Completion Points: 1 point per ₦100 spent awarded server-side upon delivery
CREATE OR REPLACE FUNCTION public.trg_award_order_completion_dashpoints()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_points integer;
BEGIN
  IF NEW.status = 'delivered' AND (OLD.status IS NULL OR OLD.status <> 'delivered') AND NEW.customer_id IS NOT NULL THEN
    v_points := GREATEST(1, floor(COALESCE(NEW.total, 0) / 100)::integer);
    IF v_points > 0 THEN
      PERFORM public.add_dashpoints(
        NEW.customer_id,
        v_points,
        'earned',
        'Points earned for delivered order #' || substring(NEW.id::text, 1, 8)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_completion_loyalty_points ON public.orders;
CREATE TRIGGER trg_order_completion_loyalty_points
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_award_order_completion_dashpoints();

-- ============================================================
-- Section 5: SEC-03: Hardened RLS Insert Policy on order_reviews
-- ============================================================

-- Ensure an order can only have ONE review posted
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_reviews_unique_order ON public.order_reviews(order_id);

-- Restrict review submission to authenticated customer whose order was actually delivered
DROP POLICY IF EXISTS "reviews_insert_customer" ON public.order_reviews;
CREATE POLICY "reviews_insert_customer"
  ON public.order_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'delivered'
    )
  );
