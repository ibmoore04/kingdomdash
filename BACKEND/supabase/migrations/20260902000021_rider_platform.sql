-- =============================================================================
-- Migration 021: Rider Platform Authoritative Hardening & Privacy Projections
-- =============================================================================
-- Phase 11 — Rider Platform Foundation
--
-- Purpose:
--   1. Server-Side Pre-Acceptance Privacy:
--      Tightens RLS SELECT on `deliveries`, `orders`, and `order_items` so riders
--      CANNOT query full rows while assignments are merely in 'assigned' status.
--   2. Controlled Rider Read Projections:
--      Installs SECURITY DEFINER functions:
--        • `get_rider_assignment_inbox()` — returns privacy-masked assignment offers
--          (zero customer PII, zero exact destination coordinates, zero customer phone).
--        • `get_rider_active_delivery()` — returns complete operational details
--          only AFTER the assignment has entered 'accepted' status.
--        • `get_rider_delivery_history(p_limit, p_offset)` — returns completed trips
--          without sensitive customer or audit internals.
--        • `get_rider_operational_profile()` — returns verified identity & vehicle status.
--   3. Hardened Rider Availability:
--      Alters `riders.is_available` default to `false` (offline by default).
--      Replaces `update_rider_availability` with strict verification, active status,
--      and in-flight conflict validation, plus audit logging.
--   4. Operational Issue Reporting RPC:
--      Installs `report_delivery_issue` allowing assigned riders to log non-mutating
--      breadcrumbs into `delivery_status_updates` and `audit_logs` without violating
--      mutation revocations or gaining unauthorized cancellation power.
--   5. Performance Indexing:
--      Creates composite indexes on `delivery_assignments(rider_id, status)`.
--
-- Security Properties:
--   • Zero direct table mutation permissions granted to authenticated users.
--   • All functions use SECURITY DEFINER and fixed search_path = public, pg_catalog.
--   • Execution strictly granted to `authenticated` role; revoked from `PUBLIC`.
-- =============================================================================

-- =============================================================================
-- §1  SCHEMA ADJUSTMENTS & COMPOSITE INDEXES
-- =============================================================================

-- 1.1 Shift default availability to offline (false)
ALTER TABLE public.riders ALTER COLUMN is_available SET DEFAULT false;

-- 1.2 Composite indexes for high-frequency rider queries
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider_status
  ON public.delivery_assignments (rider_id, status);

-- =============================================================================
-- §2  TIGHTENED RLS POLICIES (POST-ACCEPTANCE ONLY DIRECT SELECT)
-- =============================================================================

-- 2.1 Tighten Deliveries SELECT: Rider can only select deliveries once assignment is ACCEPTED or COMPLETED
DROP POLICY IF EXISTS "deliveries_select_rider" ON public.deliveries;
CREATE POLICY "deliveries_select_rider" ON public.deliveries
FOR SELECT USING (
  id IN (
    SELECT da.delivery_id FROM public.delivery_assignments da
    JOIN public.riders r ON r.id = da.rider_id
    WHERE r.profile_id = auth.uid()
      AND da.status IN ('accepted', 'completed')
  )
);

-- 2.2 Orders SELECT: Rider can only select linked orders once assignment is ACCEPTED or COMPLETED
DROP POLICY IF EXISTS "orders_select_rider" ON public.orders;
CREATE POLICY "orders_select_rider" ON public.orders
FOR SELECT USING (
  id IN (
    SELECT d.order_id
    FROM public.deliveries d
    JOIN public.delivery_assignments da ON da.delivery_id = d.id
    JOIN public.riders r ON r.id = da.rider_id
    WHERE r.profile_id = auth.uid()
      AND da.status IN ('accepted', 'completed')
  )
);

-- 2.3 Order Items SELECT: Cargo inspection allowed only once assignment is ACCEPTED or COMPLETED
DROP POLICY IF EXISTS "order_items_select_rider" ON public.order_items;
CREATE POLICY "order_items_select_rider" ON public.order_items
FOR SELECT USING (
  order_id IN (
    SELECT d.order_id
    FROM public.deliveries d
    JOIN public.delivery_assignments da ON da.delivery_id = d.id
    JOIN public.riders r ON r.id = da.rider_id
    WHERE r.profile_id = auth.uid()
      AND da.status IN ('accepted', 'completed')
  )
);

-- =============================================================================
-- §3  CONTROLLED SERVER-SIDE RIDER READ PROJECTIONS (PRIVACY ENFORCED)
-- =============================================================================

-- 3.1 Privacy-Safe Assignment Inbox Projection
-- Returns incoming job offers. Zero customer phone, zero customer name, zero exact destination coordinates.
CREATE OR REPLACE FUNCTION public.get_rider_assignment_inbox()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_inbox    jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', da.id,
        'delivery_id', d.id,
        'service_type', d.service_type,
        'pickup_address', d.pickup_address,
        'pickup_latitude', d.pickup_latitude,
        'pickup_longitude', d.pickup_longitude,
        'delivery_area', split_part(d.delivery_address, ',', 1), -- Generalized neighborhood only
        'estimated_distance_km', public.calculate_distance_km(
          COALESCE(d.pickup_latitude, 6.8227),
          COALESCE(d.pickup_longitude, 3.9213),
          COALESCE(d.delivery_latitude, 6.8227),
          COALESCE(d.delivery_longitude, 3.9213)
        ),
        'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
        'special_instructions_preview', CASE 
          WHEN d.special_instructions IS NOT NULL THEN 'Special instructions provided'
          ELSE NULL 
        END,
        'status', da.status,
        'assigned_at', da.assigned_at
      ) ORDER BY da.assigned_at DESC
    ),
    '[]'::jsonb
  ) INTO v_inbox
  FROM public.delivery_assignments da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id
  WHERE da.rider_id = v_rider_id
    AND da.status = 'assigned'
    AND d.status = 'assigned';

  RETURN v_inbox;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_assignment_inbox() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_assignment_inbox() TO authenticated;

-- 3.2 Full Operational Active Delivery Projection (Post-Acceptance Only)
CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_active   jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
  END IF;

  SELECT jsonb_build_object(
    'assignment_id', da.id,
    'delivery_id', d.id,
    'order_id', d.order_id,
    'service_type', d.service_type,
    'delivery_status', d.status,
    'assignment_status', da.status,
    'order_status', o.status,
    'pickup_address', d.pickup_address,
    'pickup_latitude', d.pickup_latitude,
    'pickup_longitude', d.pickup_longitude,
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
GRANT  EXECUTE ON FUNCTION public.get_rider_active_delivery() TO authenticated;

-- 3.3 Rider Delivery History Projection (Privacy-Safe Completed Deliveries)
CREATE OR REPLACE FUNCTION public.get_rider_delivery_history(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_history  jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', da.id,
        'delivery_id', d.id,
        'order_id', d.order_id,
        'service_type', d.service_type,
        'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
        'pickup_area', split_part(d.pickup_address, ',', 1),
        'delivery_area', split_part(d.delivery_address, ',', 1),
        'delivered_at', d.delivered_at,
        'assignment_status', da.status,
        'delivery_status', d.status
      ) ORDER BY d.delivered_at DESC NULLS LAST
    ),
    '[]'::jsonb
  ) INTO v_history
  FROM (
    SELECT da.id, da.delivery_id, da.status
    FROM public.delivery_assignments da
    WHERE da.rider_id = v_rider_id
      AND da.status = 'completed'
    ORDER BY da.updated_at DESC
    LIMIT LEAST(p_limit, 50) OFFSET GREATEST(p_offset, 0)
  ) da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id;

  RETURN v_history;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) TO authenticated;

-- 3.4 Rider Operational Profile Projection
CREATE OR REPLACE FUNCTION public.get_rider_operational_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_profile jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'profile_id', r.profile_id,
    'vehicle_type', COALESCE(
      (SELECT veh.vehicle_type::text FROM public.vehicles veh WHERE veh.assigned_rider_id = r.id LIMIT 1),
      (SELECT ra.vehicle_type::text FROM public.rider_applications ra WHERE ra.profile_id = r.profile_id ORDER BY ra.submitted_at DESC LIMIT 1),
      'motorcycle'
    ),
    'rating', r.rating,
    'total_deliveries', r.total_deliveries,
    'is_available', r.is_available,
    'is_verified', r.is_verified,
    'is_active', r.is_active,
    'full_name', p.full_name,
    'email', p.email,
    'phone', p.phone,
    'avatar_url', p.avatar_url,
    'active_in_flight_count', (
      SELECT count(*)
      FROM public.delivery_assignments da
      JOIN public.deliveries d ON d.id = da.delivery_id
      WHERE da.rider_id = r.id
        AND da.status = 'accepted'
        AND d.status IN ('assigned', 'picked_up', 'in_transit')
    )
  ) INTO v_profile
  FROM public.riders r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.profile_id = auth.uid();

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_operational_profile() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_operational_profile() TO authenticated;

-- =============================================================================
-- §4  HARDENED RIDER AVAILABILITY RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_rider_availability(
  p_is_available boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id    uuid;
  v_rider       record;
  v_old_avail   boolean;
  v_in_flight   integer;
BEGIN
  -- Resolve caller rider record with row lock
  SELECT id, is_verified, is_active, is_available
  INTO v_rider
  FROM public.riders
  WHERE profile_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No rider profile found for current user' USING ERRCODE = 'KD403';
  END IF;

  v_rider_id  := v_rider.id;
  v_old_avail := v_rider.is_available;

  -- Defense-in-depth: Bar unverified or deactivated riders from going online
  IF p_is_available AND NOT (v_rider.is_verified AND v_rider.is_active) THEN
    RAISE EXCEPTION 'Rider % is not verified or active; cannot become available for dispatch', v_rider_id
      USING ERRCODE = 'KD403';
  END IF;

  -- Idempotency: no-op if status unchanged
  IF v_old_avail = p_is_available THEN
    RETURN;
  END IF;

  -- If rider attempts to go online while an active delivery is in-flight, reject
  IF p_is_available THEN
    SELECT count(*) INTO v_in_flight
    FROM public.delivery_assignments da
    JOIN public.deliveries d ON d.id = da.delivery_id
    WHERE da.rider_id = v_rider_id
      AND da.status = 'accepted'
      AND d.status IN ('assigned', 'picked_up', 'in_transit');

    IF v_in_flight > 0 THEN
      RAISE EXCEPTION 'Cannot become available while active delivery is in flight' USING ERRCODE = 'KD409';
    END IF;
  END IF;

  UPDATE public.riders
  SET is_available = p_is_available,
      updated_at   = pg_catalog.now()
  WHERE id = v_rider_id;

  PERFORM public.log_operational_audit_event(
    'rider_availability_updated',
    'riders',
    v_rider_id,
    jsonb_build_object('is_available', v_old_avail),
    jsonb_build_object('is_available', p_is_available)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_rider_availability(boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_rider_availability(boolean) TO authenticated;

-- =============================================================================
-- §5  RIDER OPERATIONAL EXCEPTION / ISSUE REPORTING RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.report_delivery_issue(
  p_delivery_id uuid,
  p_issue_type  text,
  p_notes       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id    uuid;
  v_delivery    record;
  v_valid_types text[] := ARRAY['customer_unreachable', 'vendor_delay', 'address_issue', 'vehicle_breakdown', 'traffic_delay', 'other'];
BEGIN
  -- Validate issue type
  IF NOT (p_issue_type = ANY(v_valid_types)) THEN
    RAISE EXCEPTION 'Invalid issue type ''%''; allowed types: %', p_issue_type, array_to_string(v_valid_types, ', ')
      USING ERRCODE = 'KD400';
  END IF;

  -- Resolve caller rider
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered rider profile' USING ERRCODE = 'KD403';
  END IF;

  -- Lock delivery row for share to prevent concurrent state corruption
  SELECT id, status, order_id
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id USING ERRCODE = 'KD404';
  END IF;

  -- Verify caller has active accepted assignment
  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND rider_id = v_rider_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'You do not have an active accepted assignment for delivery %', p_delivery_id
      USING ERRCODE = 'KD403';
  END IF;

  -- Bar reporting on terminal states
  IF v_delivery.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot report issue for delivery in terminal status ''%''', v_delivery.status
      USING ERRCODE = 'KD409';
  END IF;

  -- Record non-mutating breadcrumb into delivery_status_updates
  INSERT INTO public.delivery_status_updates (
    delivery_id,
    old_status,
    new_status,
    updated_by,
    notes,
    created_at
  ) VALUES (
    p_delivery_id,
    v_delivery.status,
    v_delivery.status,
    auth.uid(),
    '[EXCEPTION: ' || p_issue_type || '] ' || COALESCE(p_notes, ''),
    pg_catalog.now()
  );

  PERFORM public.log_operational_audit_event(
    'delivery_issue_reported',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status', v_delivery.status),
    jsonb_build_object(
      'issue_type', p_issue_type,
      'notes', p_notes,
      'rider_id', v_rider_id
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_delivery_issue(uuid, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.report_delivery_issue(uuid, text, text) TO authenticated;
