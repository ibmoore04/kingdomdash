-- ============================================================
-- Migration 039: Fix Courier & Custom Order Pickup Lifecycle
-- ============================================================
-- Problems fixed:
--   1. assign_delivery_to_rider was setting orders.status = 'in_transit'
--      immediately on assignment (order status should remain 'ready_for_pickup'
--      until the rider physically picks up).
--   2. mark_delivery_picked_up required courier orders to be in
--      'payment_confirmed' status, but now accepts 'ready_for_pickup' and 'payment_confirmed'.
--   3. Custom / personal_shopper orders were not handled at all in
--      the pickup gate — they now follow courier rules (no vendor prep).
-- ============================================================

-- ── 1. Fix assign_delivery_to_rider ──────────────────────────────────────────
--
--   OLD: sets orders.status = 'in_transit' at assignment time
--   NEW: preserves orders.status = 'ready_for_pickup' (rider dispatched to
--        pick up. Status advances to 'picked_up' upon physical pickup, then
--        to 'in_transit' when transit begins.)
-- ─────────────────────────────────────────────────────────────────────────────
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
    IF v_order.service_type IN ('courier', 'custom', 'personal_shopper') AND v_order.status NOT IN ('pending', 'payment_confirmed', 'ready_for_pickup') THEN
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

  -- ── Advance courier/custom orders from pending/payment_confirmed to ready_for_pickup
  --    (delivery status is set to 'assigned'; order status stays 'ready_for_pickup' until physical pickup)
  IF v_order_id IS NOT NULL THEN
    IF v_order.status IN ('pending', 'payment_confirmed') THEN
      UPDATE public.orders
      SET status = 'ready_for_pickup',
          updated_at = pg_catalog.now()
      WHERE id = v_order_id;
    END IF;

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

-- ── 2. Fix mark_delivery_picked_up ───────────────────────────────────────────
--
--   OLD: courier orders require orders.status = 'payment_confirmed'
--        custom orders have no check (fall-through)
--   NEW: courier, custom, personal_shopper require orders.status IN
--        ('assigned', 'payment_confirmed') — both are valid pre-pickup states.
--        food/grocery still require 'ready_for_pickup' (vendor must pack first).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_delivery_picked_up(
  p_delivery_id uuid,
  p_notes       text DEFAULT NULL
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
BEGIN
  -- Resolve calling rider
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

  -- 1. Lock linked order first (hierarchy: orders -> deliveries -> delivery_assignments -> riders)
  IF v_order_id IS NOT NULL THEN
    SELECT id, service_type, status
    INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    -- Food/grocery orders must strictly be in ready_for_pickup (vendor must prep)
    IF v_order.service_type IN ('food', 'grocery') AND v_order.status <> 'ready_for_pickup' THEN
      RAISE EXCEPTION 'Cannot pick up food/grocery order in status ''%''; must be ''ready_for_pickup''',
        v_order.status USING ERRCODE = 'KD409';
    END IF;

    -- Courier, custom, and personal_shopper orders bypass vendor prep.
    -- Valid pre-pickup statuses are 'ready_for_pickup', 'payment_confirmed',
    -- or 'in_transit' (recovering from legacy assignment bug
    -- where orders were set to in_transit prior to physical pickup).
    IF v_order.service_type IN ('courier', 'custom', 'personal_shopper')
       AND v_order.status NOT IN ('ready_for_pickup', 'payment_confirmed', 'in_transit') THEN
      RAISE EXCEPTION 'Cannot pick up % order in status ''%''; must be ''ready_for_pickup'' or ''payment_confirmed''',
        v_order.service_type, v_order.status USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, order_id, service_type, status
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  -- Verify active accepted assignment for caller
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND rider_id = v_rider_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'You do not have an accepted assignment for delivery %', p_delivery_id
      USING ERRCODE = 'KD403';
  END IF;

  IF v_delivery.status <> 'assigned' THEN
    RAISE EXCEPTION 'Delivery % is in status %; must be ''assigned'' to pick up',
      p_delivery_id, v_delivery.status USING ERRCODE = 'KD409';
  END IF;

  -- Update linked order atomically
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'picked_up',
        picked_up_at = COALESCE(picked_up_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE id = v_order_id;

    -- Sync personal_shopper_requests if linked
    UPDATE public.personal_shopper_requests
    SET status = 'in_progress',
        updated_at = pg_catalog.now()
    WHERE order_id = v_order_id
      AND status IN ('assigned', 'pending');
  END IF;

  -- Update delivery row
  UPDATE public.deliveries
  SET status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE id = p_delivery_id;

  -- Record status update breadcrumb
  INSERT INTO public.delivery_status_updates (
    delivery_id, old_status, new_status, updated_by, notes, created_at
  ) VALUES (
    p_delivery_id, 'assigned', 'picked_up', auth.uid(), p_notes, pg_catalog.now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text) TO authenticated;

-- ── 3. Grant service_role access too (consistent with existing grants) ────────
GRANT EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text)  TO service_role;

-- ── 4. One-time data heal for stuck pre-pickup orders ────────────────────────
-- Reverts orders to 'ready_for_pickup' if their linked delivery is still only 'assigned'
-- (resolves existing orders affected by the previous premature in_transit transition)
UPDATE public.orders o
SET status = 'ready_for_pickup',
    updated_at = pg_catalog.now()
FROM public.deliveries d
WHERE d.order_id = o.id
  AND d.status = 'assigned'
  AND o.status = 'in_transit'
  AND o.service_type IN ('courier', 'custom', 'personal_shopper');

