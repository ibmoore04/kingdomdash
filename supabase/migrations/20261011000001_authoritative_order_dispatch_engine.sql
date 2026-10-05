-- =============================================================================
-- Migration: 20261011000001_authoritative_order_dispatch_engine.sql
-- Description: Authoritative Order & Delivery Dispatch Engine
--              Provides a SECURITY DEFINER RPC `assign_order_or_delivery_to_rider`
--              and updates `assign_delivery_to_rider` so:
--              1. Orders missing deliveries records are automatically provisioned.
--              2. Flexible order status handling ('pending', 'payment_confirmed',
--                 'preparing', 'ready_for_pickup').
--              3. Safe settlement bridge trigger compatibility (avoids 22P02 enum casts).
--              4. Accepts either riders.id or riders.profile_id seamlessly.
--              5. Prevents silent client RLS permission failures.
--              6. Atomic transition of orders, deliveries, and assignments.
-- =============================================================================

-- ── 0. Ensure order_status Enum Compatibility & Safe Settlement Bridge Trigger ──
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'delivery_confirmed';

CREATE OR REPLACE FUNCTION public.trg_order_delivery_settlement_bridge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status::text IN ('delivered', 'delivery_confirmed') AND (OLD.status IS NULL OR OLD.status::text NOT IN ('delivered', 'delivery_confirmed')) THEN
    UPDATE public.order_payables
    SET status = 'settlement_queued',
        updated_at = now()
    WHERE order_id = NEW.id AND status = 'payable_pending';

    INSERT INTO public.settlement_queue (order_id, status, scheduled_at, updated_at)
    VALUES (NEW.id, 'pending', now(), now())
    ON CONFLICT (order_id) DO UPDATE SET
      status = CASE 
        WHEN public.settlement_queue.status IN ('completed', 'cancelled') THEN public.settlement_queue.status 
        ELSE 'pending' 
      END,
      updated_at = now()
    WHERE public.settlement_queue.status NOT IN ('completed', 'cancelled', 'processing');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_delivery_settlement_bridge ON public.orders;
CREATE TRIGGER trg_order_delivery_settlement_bridge
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_order_delivery_settlement_bridge();


-- ── 0.1 Ensure DashPoints Loyalty Accrual Does Not Block Delivery Completion ──
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
  -- Strict caller verification: direct client calls must be admin or service_role.
  -- Internal database triggers (pg_trigger_depth() > 0) are authorized to award system points.
  IF pg_trigger_depth() = 0 AND auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    ) THEN
      RAISE EXCEPTION 'Unauthorized to accrue DashPoints directly' USING ERRCODE = 'KD403';
    END IF;
  END IF;

  INSERT INTO public.loyalty_transactions (user_id, points, type, description)
  VALUES (p_user_id, p_points, p_type, p_description);

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

REVOKE EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) TO service_role;

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
      BEGIN
        PERFORM public.add_dashpoints(
          NEW.customer_id,
          v_points,
          'earned',
          'Points earned for delivered order #' || substring(NEW.id::text, 1, 8)
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
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


-- ── 0.2 Authoritative Delivery Completion (mark_delivery_delivered) ────────────
CREATE TABLE IF NOT EXISTS public.delivery_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES public.deliveries(id) ON DELETE CASCADE,
  assignment_id uuid,
  previous_status text,
  new_status text,
  changed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

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
  v_rider_id     uuid;
  v_order_id     uuid;
  v_delivery     record;
  v_order        record;
  v_assignment   record;
  v_expected_pin text;
  v_caller_role  text;
BEGIN
  v_caller_role := public.get_current_user_role();

  -- Authenticate rider caller or allow dispatch administrators / service role
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    IF v_caller_role IN ('admin', 'super_admin') OR auth.role() = 'service_role' THEN
      SELECT rider_id INTO v_rider_id
      FROM public.delivery_assignments
      WHERE delivery_id = p_delivery_id AND status IN ('accepted', 'assigned', 'completed')
      ORDER BY created_at DESC
      LIMIT 1;
    ELSE
      RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
    END IF;
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

  -- Idempotency check: if already delivered, return success without duplicate increment
  IF v_delivery.status = 'delivered' THEN
    RETURN;
  END IF;

  -- 3. Lock assignment row third (if rider caller, check assignment)
  IF v_rider_id IS NOT NULL THEN
    SELECT id, status
    INTO v_assignment
    FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND rider_id = v_rider_id
      AND status IN ('accepted', 'assigned', 'completed')
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  -- Allow completion if delivery is in active status
  IF v_delivery.status NOT IN ('in_transit', 'picked_up', 'assigned') THEN
    RAISE EXCEPTION 'Delivery % is in status %; must be in active status to complete delivery',
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
  IF v_assignment.id IS NOT NULL THEN
    UPDATE public.delivery_assignments
    SET status = 'completed',
        updated_at = pg_catalog.now()
    WHERE id = v_assignment.id;
  ELSE
    UPDATE public.delivery_assignments
    SET status = 'completed',
        updated_at = pg_catalog.now()
    WHERE delivery_id = p_delivery_id
      AND status IN ('accepted', 'assigned');
  END IF;

  -- 6. Lock and increment rider completed delivery count atomically
  IF v_rider_id IS NOT NULL THEN
    UPDATE public.riders
    SET total_deliveries = total_deliveries + 1,
        updated_at = pg_catalog.now()
    WHERE id = v_rider_id;
  END IF;

  -- Record status update breadcrumbs resiliently
  BEGIN
    INSERT INTO public.delivery_status_updates (
      delivery_id,
      old_status,
      new_status,
      updated_by,
      notes,
      created_at
    ) VALUES (
      p_delivery_id,
      v_delivery.status::public.delivery_status,
      'delivered'::public.delivery_status,
      COALESCE(auth.uid(), (SELECT profile_id FROM public.riders WHERE id = v_rider_id)),
      COALESCE(p_notes, 'Delivery completed by rider with verified status'),
      pg_catalog.now()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
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
      v_delivery.status::text,
      'delivered',
      auth.uid(),
      COALESCE(p_notes, 'Delivery completed by rider with verified status')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- Provide 2-argument backward-compatible signature
CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(
  p_delivery_id uuid,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  PERFORM public.mark_delivery_delivered(p_delivery_id, p_notes, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) TO authenticated, service_role;


-- ── 1. Create public.assign_order_or_delivery_to_rider ─────────────────────────
CREATE OR REPLACE FUNCTION public.assign_order_or_delivery_to_rider(
  p_order_id uuid,
  p_rider_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_role           text;
  v_dispatcher_id  uuid;
  v_rider          record;
  v_order          record;
  v_delivery       record;
  v_assignment_id  uuid;
  v_target_order_id uuid;
  v_customer_phone text;
  v_customer_name  text;
BEGIN
  -- 1. Authorization: strictly Admin, Super Admin, or Service Role
  v_role := public.get_current_user_role();
  IF v_role NOT IN ('admin', 'super_admin') AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only dispatch administrators can assign orders to riders' USING ERRCODE = 'KD403';
  END IF;

  v_dispatcher_id := auth.uid();
  IF v_dispatcher_id IS NULL THEN
    SELECT id INTO v_dispatcher_id FROM public.profiles WHERE role IN ('admin', 'super_admin') LIMIT 1;
  END IF;

  -- 2. Verify Rider (accepts riders.id OR riders.profile_id)
  SELECT id, profile_id, is_verified, is_active, is_available
  INTO v_rider
  FROM public.riders
  WHERE id = p_rider_id OR profile_id = p_rider_id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider % not found in riders directory', p_rider_id USING ERRCODE = 'KD404';
  END IF;

  -- 3. Discover and lock linked order
  v_target_order_id := p_order_id;
  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_target_order_id
  FOR UPDATE;

  -- Fallback: check if p_order_id is a personal_shopper_requests.id
  IF NOT FOUND THEN
    SELECT order_id INTO v_target_order_id
    FROM public.personal_shopper_requests
    WHERE id = p_order_id;

    IF v_target_order_id IS NOT NULL THEN
      SELECT *
      INTO v_order
      FROM public.orders
      WHERE id = v_target_order_id
      FOR UPDATE;
    END IF;
  END IF;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'KD404';
  END IF;

  IF v_order.status IN ('cancelled', 'delivered') THEN
    RAISE EXCEPTION 'Cannot dispatch order % in terminal status %', v_order.id, v_order.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 4. Check rider in-flight delivery status (ONLY accepted active deliveries block new trips)
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.deliveries d ON d.id = da.delivery_id
    WHERE da.rider_id = v_rider.id
      AND da.status = 'accepted'
      AND d.status IN ('assigned', 'picked_up', 'in_transit')
  ) THEN
    RAISE EXCEPTION 'Rider % already has an active in-flight trip in progress', v_rider.id
      USING ERRCODE = 'KD409';
  END IF;

  -- 5. Discover or automatically instantiate delivery record with system authority
  SELECT id, order_id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE order_id = v_order.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    v_customer_name := COALESCE(v_order.customer_name, 'Valued Customer');
    v_customer_phone := COALESCE(v_order.customer_phone, v_order.delivery_phone, '—');

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
      v_order.id,
      v_customer_name,
      v_customer_phone,
      COALESCE(v_order.service_type, 'food'),
      v_order.vendor_id,
      COALESCE(v_order.pickup_address, 'Store Dispatch'),
      COALESCE(v_order.pickup_contact, 'Store Dispatch'),
      COALESCE(v_order.delivery_address, 'Customer Delivery Address'),
      v_customer_phone,
      v_order.special_instructions,
      'pending',
      COALESCE(v_order.customer_id, v_dispatcher_id),
      now(),
      now()
    )
    RETURNING id, order_id, status INTO v_delivery;
  END IF;

  IF v_delivery.status NOT IN ('pending', 'assigned') THEN
    RAISE EXCEPTION 'Delivery % cannot be assigned from status %', v_delivery.id, v_delivery.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 6. Close any existing open/unaccepted assignments for this delivery
  UPDATE public.delivery_assignments
  SET status = 'rejected',
      notes = COALESCE(notes, '') || ' [Reassigned by dispatch console]',
      responded_at = COALESCE(responded_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE delivery_id = v_delivery.id
    AND status = 'assigned';

  -- 7. Insert the authoritative assignment record
  INSERT INTO public.delivery_assignments (
    delivery_id,
    rider_id,
    assigned_by,
    status,
    assigned_at
  ) VALUES (
    v_delivery.id,
    v_rider.id,
    v_dispatcher_id,
    'assigned',
    pg_catalog.now()
  )
  RETURNING id INTO v_assignment_id;

  -- 8. Synchronize delivery status to 'assigned'
  UPDATE public.deliveries
  SET status = 'assigned',
      updated_at = pg_catalog.now()
  WHERE id = v_delivery.id;

  -- 9. Synchronize order status
  -- Order status advances from pending/payment_confirmed to 'ready_for_pickup' (preparing/ready states are preserved).
  -- Note: 'assigned' is a valid delivery_status, whereas order_status strictly uses 'ready_for_pickup' until physical pickup.
  IF v_order.status IN ('pending', 'payment_pending', 'payment_processing', 'payment_confirmed') THEN
    UPDATE public.orders
    SET status = 'ready_for_pickup',
        updated_at = pg_catalog.now()
    WHERE id = v_order.id;
  END IF;

  -- 10. Synchronize linked personal shopper requests if applicable
  UPDATE public.personal_shopper_requests
  SET status = 'assigned',
      assigned_shopper_id = v_rider.profile_id,
      updated_at = pg_catalog.now()
  WHERE order_id = v_order.id OR id = p_order_id;

  -- 11. Emit push notification to rider's profile safely
  BEGIN
    IF v_rider.profile_id IS NOT NULL THEN
      PERFORM public.emit_notification(
        v_rider.profile_id,
        'New Delivery Assignment Available',
        'Order #' || substr(v_order.id::text, 1, 8) || ' allocated to you. Tap to review pickup and items.',
        'info'::public.notification_type,
        'delivery'::public.notification_category,
        '/rider/assignments',
        'assignment:' || v_assignment_id::text,
        jsonb_build_object(
          'order_id', v_order.id,
          'delivery_id', v_delivery.id,
          'assignment_id', v_assignment_id
        ),
        true
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order.id,
    'delivery_id', v_delivery.id,
    'assignment_id', v_assignment_id,
    'rider_id', v_rider.id,
    'status', 'assigned'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_order_or_delivery_to_rider(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_order_or_delivery_to_rider(uuid, uuid) TO authenticated, service_role;


-- ── 2. Update public.assign_delivery_to_rider to delegate or share logic ─────────
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
  v_order_id       uuid;
  v_res            jsonb;
BEGIN
  -- Discover order_id from delivery
  SELECT order_id INTO v_order_id
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF v_order_id IS NOT NULL THEN
    v_res := public.assign_order_or_delivery_to_rider(v_order_id, p_rider_id);
    RETURN (v_res->>'assignment_id')::uuid;
  END IF;

  -- Fallback if delivery has no order_id
  RAISE EXCEPTION 'Delivery % does not have a linked order', p_delivery_id USING ERRCODE = 'KD404';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO authenticated, service_role;

-- ── 3. Force PostgREST RPC Schema Cache Refresh ─────────────────────────────────
NOTIFY pgrst, 'reload schema';
