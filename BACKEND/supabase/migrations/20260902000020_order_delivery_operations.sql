-- =============================================================================
-- Migration: 20260902000020_order_delivery_operations.sql
-- Purpose  : Phase 10 — Order & Delivery Operations Engine (Hardened & Corrected)
--            Authoritative Three-Tier State Machines (Order, Delivery, Assignment)
--            Atomic Custody Transitions, Dispatch Engine, Idempotency, RLS & Immutability
-- =============================================================================

-- =============================================================================
-- §1  SCHEMA ENHANCEMENTS: OPERATIONAL TIMESTAMPS, SNAPSHOTS & INDEXES
-- =============================================================================

-- 1.1 Operational timestamps, refund tracking & courier contact snapshots on public.orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
ADD COLUMN IF NOT EXISTS ready_at timestamptz,
ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
ADD COLUMN IF NOT EXISTS in_transit_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
ADD COLUMN IF NOT EXISTS cancellation_reason text,
ADD COLUMN IF NOT EXISTS refund_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_status text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS pickup_contact text,
ADD COLUMN IF NOT EXISTS pickup_phone text,
ADD COLUMN IF NOT EXISTS delivery_contact text,
ADD COLUMN IF NOT EXISTS delivery_phone text,
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Partial unique index: Strict per-customer idempotency guarantee for courier orders
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_idempotency
ON public.orders (customer_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 1.2 Operational timestamps on public.deliveries
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
ADD COLUMN IF NOT EXISTS in_transit_at timestamptz,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 1.3 Operational response tracking and partial unique index on public.delivery_assignments
-- Note: assigned_by remains NOT NULL REFERENCES public.profiles(id) per Section 2
ALTER TABLE public.delivery_assignments
ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_delivery_assignment
ON public.delivery_assignments (delivery_id)
WHERE status IN ('assigned', 'accepted');

-- 1.4 Operational eligibility flags on public.riders
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- 1.5 Performance and operational lookup indexes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries (status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliveries_order_id_unique ON public.deliveries (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON public.deliveries (order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider_id ON public.delivery_assignments (rider_id);

-- 1.6 Database-enforced snapshot immutability triggers (orders & deliveries)
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_order_snapshot_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Customer identity and service type are immutable from creation under all states
  IF OLD.customer_id IS DISTINCT FROM NEW.customer_id THEN
    RAISE EXCEPTION 'Order customer_id is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.service_type IS DISTINCT FROM NEW.service_type THEN
    RAISE EXCEPTION 'Order service_type is immutable' USING ERRCODE = 'KD409';
  END IF;

  -- Once payment is confirmed or entering fulfillment, commercial, address, and contact snapshots are locked
  IF OLD.status NOT IN ('pending', 'payment_pending', 'payment_processing') THEN
    IF OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
      RAISE EXCEPTION 'Order vendor_id is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.pickup_address IS DISTINCT FROM NEW.pickup_address THEN
      RAISE EXCEPTION 'Order pickup_address is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.delivery_address IS DISTINCT FROM NEW.delivery_address THEN
      RAISE EXCEPTION 'Order delivery_address is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.pickup_contact IS DISTINCT FROM NEW.pickup_contact THEN
      RAISE EXCEPTION 'Order pickup_contact is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.pickup_phone IS DISTINCT FROM NEW.pickup_phone THEN
      RAISE EXCEPTION 'Order pickup_phone is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.delivery_contact IS DISTINCT FROM NEW.delivery_contact THEN
      RAISE EXCEPTION 'Order delivery_contact is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.delivery_phone IS DISTINCT FROM NEW.delivery_phone THEN
      RAISE EXCEPTION 'Order delivery_phone is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.distance_km IS DISTINCT FROM NEW.distance_km THEN
      RAISE EXCEPTION 'Order distance_km is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.pricing_rule_id IS DISTINCT FROM NEW.pricing_rule_id THEN
      RAISE EXCEPTION 'Order pricing_rule_id is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.idempotency_key IS DISTINCT FROM NEW.idempotency_key THEN
      RAISE EXCEPTION 'Order idempotency_key is immutable once paid or in fulfillment' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.subtotal IS DISTINCT FROM NEW.subtotal THEN
      RAISE EXCEPTION 'Finalized order subtotal is immutable' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.delivery_fee IS DISTINCT FROM NEW.delivery_fee THEN
      RAISE EXCEPTION 'Finalized order delivery_fee is immutable' USING ERRCODE = 'KD409';
    END IF;
    IF OLD.total IS DISTINCT FROM NEW.total THEN
      RAISE EXCEPTION 'Finalized order total is immutable' USING ERRCODE = 'KD409';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_snapshot_immutability ON public.orders;
CREATE TRIGGER trg_enforce_order_snapshot_immutability
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_order_snapshot_immutability();

CREATE OR REPLACE FUNCTION public.trg_fn_enforce_delivery_snapshot_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.order_id IS DISTINCT FROM NEW.order_id THEN
    RAISE EXCEPTION 'Delivery order_id is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name THEN
    RAISE EXCEPTION 'Delivery customer_name is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.customer_phone IS DISTINCT FROM NEW.customer_phone THEN
    RAISE EXCEPTION 'Delivery customer_phone is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.service_type IS DISTINCT FROM NEW.service_type THEN
    RAISE EXCEPTION 'Delivery service_type is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.vendor_id IS DISTINCT FROM NEW.vendor_id THEN
    RAISE EXCEPTION 'Delivery vendor_id is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.pickup_address IS DISTINCT FROM NEW.pickup_address THEN
    RAISE EXCEPTION 'Delivery pickup_address is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.pickup_contact IS DISTINCT FROM NEW.pickup_contact THEN
    RAISE EXCEPTION 'Delivery pickup_contact is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.delivery_address IS DISTINCT FROM NEW.delivery_address THEN
    RAISE EXCEPTION 'Delivery delivery_address is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.delivery_contact IS DISTINCT FROM NEW.delivery_contact THEN
    RAISE EXCEPTION 'Delivery delivery_contact is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.special_instructions IS DISTINCT FROM NEW.special_instructions THEN
    RAISE EXCEPTION 'Delivery special_instructions is immutable' USING ERRCODE = 'KD409';
  END IF;
  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Delivery created_by is immutable' USING ERRCODE = 'KD409';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_delivery_snapshot_immutability ON public.deliveries;
CREATE TRIGGER trg_enforce_delivery_snapshot_immutability
BEFORE UPDATE ON public.deliveries
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_enforce_delivery_snapshot_immutability();


-- =============================================================================
-- §2  OPERATIONAL AUDIT HELPER (FAIL-CLOSED TRANSACTIONAL INTEGRITY)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_operational_audit_event(
  p_action      text,
  p_entity_type text,
  p_entity_id   uuid,
  p_old_values  jsonb DEFAULT NULL,
  p_new_values  jsonb DEFAULT NULL,
  p_notes       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_profile_id uuid;
  v_headers    jsonb;
  v_ip_address text;
  v_user_agent text;
BEGIN
  -- Derives actor profile exclusively from trusted authenticated server context
  v_profile_id := auth.uid();

  -- Non-critical request header inspection: only header parsing errors are swallowed
  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
    IF v_headers IS NOT NULL THEN
      v_user_agent := v_headers->>'user-agent';
      IF v_headers ? 'x-forwarded-for' THEN
        v_ip_address := trim(split_part(v_headers->>'x-forwarded-for', ',', 1));
      END IF;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_ip_address := NULL;
      v_user_agent := NULL;
  END;

  -- Transactionally consistent insert: Failures intentionally ABORT the parent transaction.
  -- Schema uses profile_id (from Migration 008) and text ip_address.
  INSERT INTO public.audit_logs (
    profile_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    created_at
  ) VALUES (
    v_profile_id,
    p_action,
    p_entity_type,
    p_entity_id,
    p_old_values,
    CASE 
      WHEN p_notes IS NOT NULL THEN 
        COALESCE(p_new_values, '{}'::jsonb) || jsonb_build_object('notes', p_notes)
      ELSE p_new_values 
    END,
    v_ip_address,
    v_user_agent,
    pg_catalog.now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_operational_audit_event(text, text, uuid, jsonb, jsonb, text) FROM authenticated;


-- =============================================================================
-- §3  AUTOMATIC DELIVERY INSTANTIATION ON PAYMENT CONFIRMATION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_on_order_payment_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_cust_name          text;
  v_cust_phone         text;
  v_vendor_name        text;
  v_addr_recipient     text;
  v_addr_phone         text;
  v_delivery_created   boolean := false;
BEGIN
  -- Only act when transitioning into 'payment_confirmed'
  IF NEW.status = 'payment_confirmed' AND (OLD.status IS DISTINCT FROM 'payment_confirmed') THEN
    
    -- Ensure confirmed_at timestamp is stamped server-side
    IF NEW.confirmed_at IS NULL THEN
      NEW.confirmed_at := pg_catalog.now();
    END IF;

    -- Fetch customer profile snapshot details
    SELECT full_name, phone_number
    INTO v_cust_name, v_cust_phone
    FROM public.profiles
    WHERE id = NEW.customer_id;

    -- Fetch customer address snapshot details if available
    IF NEW.delivery_address_id IS NOT NULL THEN
      SELECT recipient_name, phone
      INTO v_addr_recipient, v_addr_phone
      FROM public.addresses
      WHERE id = NEW.delivery_address_id;
    END IF;

    -- Fetch vendor name if order has a vendor
    IF NEW.vendor_id IS NOT NULL THEN
      SELECT name INTO v_vendor_name
      FROM public.vendors
      WHERE id = NEW.vendor_id;
    END IF;

    -- Provably safe idempotent insert into deliveries: exactly one delivery per order
    IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id) THEN
      BEGIN
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
          NEW.id,
          COALESCE(NEW.delivery_contact, v_addr_recipient, v_cust_name, 'Customer'),
          COALESCE(NEW.delivery_phone, v_addr_phone, v_cust_phone, 'N/A'),
          NEW.service_type,
          NEW.vendor_id,
          NEW.pickup_address,
          COALESCE(NEW.pickup_contact, v_vendor_name, 'Sender'),
          NEW.delivery_address,
          COALESCE(NEW.delivery_contact, v_addr_recipient, v_cust_name, 'Customer'),
          NEW.special_instructions,
          'pending',
          NEW.customer_id,
          pg_catalog.now(),
          pg_catalog.now()
        );
        v_delivery_created := true;
      EXCEPTION
        WHEN unique_violation THEN
          -- Another concurrent trigger execution already created this delivery row
          v_delivery_created := false;
      END;

      -- Confirm delivery exists
      IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id) THEN
        RAISE EXCEPTION 'Failed to instantiate delivery for order %', NEW.id USING ERRCODE = 'KD500';
      END IF;

      -- Audit operation executes strictly outside the delivery exception block:
      -- Any failure in log_operational_audit_event will fail-closed and abort the parent transaction.
      IF v_delivery_created THEN
        PERFORM public.log_operational_audit_event(
          'delivery_created_auto',
          'orders',
          NEW.id,
          NULL,
          jsonb_build_object('order_id', NEW.id, 'service_type', NEW.service_type)
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_payment_confirmed ON public.orders;
CREATE TRIGGER trg_order_payment_confirmed
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_on_order_payment_confirmed();


-- =============================================================================
-- §4  VENDOR FULFILLMENT RPCS
-- =============================================================================

-- 4.1 Advance vendor preparation (payment_confirmed -> preparing -> ready_for_pickup)
CREATE OR REPLACE FUNCTION public.update_order_status_vendor(
  p_order_id   uuid,
  p_new_status order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vendor_id  uuid;
  v_order      record;
  v_old_status order_status;
BEGIN
  -- Resolve vendor for caller
  SELECT id INTO v_vendor_id
  FROM public.vendors
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered vendor profile' USING ERRCODE = 'KD403';
  END IF;

  -- Load order with row lock
  SELECT id, vendor_id, service_type, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'KD404';
  END IF;

  IF v_order.vendor_id <> v_vendor_id THEN
    RAISE EXCEPTION 'Order % does not belong to your vendor profile', p_order_id USING ERRCODE = 'KD403';
  END IF;

  IF v_order.service_type = 'courier' THEN
    RAISE EXCEPTION 'Courier orders do not support vendor fulfillment' USING ERRCODE = 'KD400';
  END IF;

  v_old_status := v_order.status;

  -- Validate sequential state transitions
  IF v_old_status = 'payment_confirmed' AND p_new_status = 'preparing' THEN
    UPDATE public.orders
    SET status = 'preparing',
        preparing_at = COALESCE(preparing_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE id = p_order_id;

  ELSIF v_old_status = 'preparing' AND p_new_status = 'ready_for_pickup' THEN
    UPDATE public.orders
    SET status = 'ready_for_pickup',
        ready_at = COALESCE(ready_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE id = p_order_id;

  ELSE
    RAISE EXCEPTION
      'Invalid vendor status transition from ''%'' to ''%''. Allowed: payment_confirmed -> preparing, preparing -> ready_for_pickup',
      v_old_status, p_new_status
      USING ERRCODE = 'KD409';
  END IF;

  PERFORM public.log_operational_audit_event(
    'order_status_vendor_update',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_order_status_vendor(uuid, order_status) TO authenticated;


-- 4.2 Vendor order rejection / cancellation (only before preparation begins)
CREATE OR REPLACE FUNCTION public.vendor_reject_order(
  p_order_id uuid,
  p_reason   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vendor_id  uuid;
  v_order      record;
  v_delivery   record;
  v_assignment record;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid rejection reason is required' USING ERRCODE = 'KD400';
  END IF;

  SELECT id INTO v_vendor_id
  FROM public.vendors
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not a registered vendor profile' USING ERRCODE = 'KD403';
  END IF;

  -- 1. Lock orders first (hierarchy: orders -> deliveries -> delivery_assignments -> riders)
  SELECT id, vendor_id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'KD404';
  END IF;

  IF v_order.vendor_id <> v_vendor_id THEN
    RAISE EXCEPTION 'Order % does not belong to your vendor profile', p_order_id USING ERRCODE = 'KD403';
  END IF;

  IF v_order.status <> 'payment_confirmed' THEN
    RAISE EXCEPTION 'Vendors can only reject orders in payment_confirmed status (current: %)', v_order.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 2. Lock associated delivery row second
  SELECT id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE order_id = p_order_id
  FOR UPDATE;

  -- Cancel the order, flagging refund_required
  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = p_reason,
      refund_required = true,
      refund_status = 'pending_manual_review',
      updated_at = pg_catalog.now()
  WHERE id = p_order_id;

  -- Cancel associated delivery if one exists and record status update history
  IF v_delivery.id IS NOT NULL THEN
    UPDATE public.deliveries
    SET status = 'cancelled',
        cancelled_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = v_delivery.id;

    INSERT INTO public.delivery_status_updates (
      delivery_id,
      old_status,
      new_status,
      updated_by,
      notes,
      created_at
    ) VALUES (
      v_delivery.id,
      v_delivery.status,
      'cancelled',
      auth.uid(),
      'Vendor rejected order. Reason: ' || p_reason,
      pg_catalog.now()
    );

    PERFORM public.log_operational_audit_event(
      'delivery_cancelled_operational',
      'deliveries',
      v_delivery.id,
      jsonb_build_object('status', v_delivery.status),
      jsonb_build_object('status', 'cancelled', 'reason', p_reason)
    );

    -- 3. Lock and terminate any in-flight assignments to prevent orphaned active assignments
    FOR v_assignment IN
      SELECT id, status, rider_id
      FROM public.delivery_assignments
      WHERE delivery_id = v_delivery.id
        AND status IN ('assigned', 'accepted')
      FOR UPDATE
    LOOP
      UPDATE public.delivery_assignments
      SET status = 'rejected',
          notes = COALESCE(notes, '') || ' [Terminated: Vendor rejected order. Reason: ' || p_reason || ']',
          responded_at = COALESCE(responded_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      WHERE id = v_assignment.id;

      PERFORM public.log_operational_audit_event(
        'assignment_cancelled_order_cancellation',
        'delivery_assignments',
        v_assignment.id,
        jsonb_build_object('status', v_assignment.status),
        jsonb_build_object('status', 'rejected', 'reason', p_reason, 'context', 'vendor_reject_order')
      );
    END LOOP;
  END IF;

  PERFORM public.log_operational_audit_event(
    'vendor_order_rejected',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'refund_required', true, 'reason', p_reason)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vendor_reject_order(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.vendor_reject_order(uuid, text) TO authenticated;


-- =============================================================================
-- §5  DISPATCH & RIDER ASSIGNMENT RPCS
-- =============================================================================

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

  -- Discover linked order_id before acquiring hierarchical row locks
  SELECT order_id INTO v_order_id
  FROM public.deliveries
  WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id USING ERRCODE = 'KD404';
  END IF;

  -- 1. Lock linked orders first (hierarchy: orders -> deliveries -> delivery_assignments -> riders)
  IF v_order_id IS NOT NULL THEN
    SELECT id, service_type, status
    INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF v_order.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot assign delivery for a cancelled order' USING ERRCODE = 'KD409';
    END IF;

    -- Food/grocery orders must be in payment_confirmed, preparing, or ready_for_pickup
    IF v_order.service_type IN ('food', 'grocery') AND v_order.status NOT IN ('payment_confirmed', 'preparing', 'ready_for_pickup') THEN
      RAISE EXCEPTION 'Cannot assign food/grocery delivery for order in status %', v_order.status
        USING ERRCODE = 'KD409';
    END IF;

    -- Courier orders must be in payment_confirmed
    IF v_order.service_type = 'courier' AND v_order.status <> 'payment_confirmed' THEN
      RAISE EXCEPTION 'Cannot assign courier delivery for order in status %', v_order.status
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

  -- 3. Close any existing unaccepted assignment for this delivery to maintain unique index invariant
  UPDATE public.delivery_assignments
  SET status = 'rejected',
      notes = COALESCE(notes, '') || ' [Reassigned by dispatcher]',
      responded_at = COALESCE(responded_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE delivery_id = p_delivery_id
    AND status = 'assigned';

  -- Verify rider eligibility with EXCLUSIVE ROW LOCK (FOR UPDATE) to eliminate assignment races
  SELECT id, is_verified, is_active, is_available
  INTO v_rider
  FROM public.riders
  WHERE id = p_rider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider % not found', p_rider_id USING ERRCODE = 'KD404';
  END IF;

  IF NOT (v_rider.is_verified AND v_rider.is_active AND v_rider.is_available) THEN
    RAISE EXCEPTION 'Rider % is not verified, active, and available for assignment', p_rider_id
      USING ERRCODE = 'KD409';
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

  -- Insert assignment record with non-null assigned_by from verified dispatcher
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

  PERFORM public.log_operational_audit_event(
    'delivery_assigned',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status', v_delivery.status),
    jsonb_build_object('status', 'assigned', 'rider_id', p_rider_id, 'assignment_id', v_assignment_id, 'assigned_by', v_dispatcher_id)
  );

  RETURN v_assignment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.assign_delivery_to_rider(uuid, uuid) TO authenticated;


-- =============================================================================
-- §6  ASSIGNMENT ACCEPTANCE & REJECTION RPCS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_delivery_assignment(
  p_assignment_id uuid
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
  v_order            record;
  v_rider            record;
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

  -- Idempotency: if already accepted, return gracefully
  IF v_assignment_peek.status = 'accepted' THEN
    RETURN;
  END IF;

  IF v_assignment_peek.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot accept assignment in status %; must be ''assigned''', v_assignment_peek.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 1. Lock linked order first (hierarchy: orders -> deliveries -> delivery_assignments -> riders)
  IF v_assignment_peek.order_id IS NOT NULL THEN
    SELECT id, status INTO v_order
    FROM public.orders
    WHERE id = v_assignment_peek.order_id
    FOR UPDATE;

    IF v_order.status IN ('cancelled', 'delivered') THEN
      RAISE EXCEPTION 'Cannot accept assignment for order in terminal status ''%''', v_order.status
        USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 2. Lock and verify underlying delivery status second
  SELECT id, order_id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE id = v_assignment_peek.delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated delivery % not found', v_assignment_peek.delivery_id USING ERRCODE = 'KD404';
  END IF;

  IF v_delivery.status <> 'assigned' THEN
    RAISE EXCEPTION 'Associated delivery % is in status ''%''; cannot be accepted',
      v_delivery.id, v_delivery.status USING ERRCODE = 'KD409';
  END IF;

  -- 3. Lock assignment row third
  SELECT id, delivery_id, rider_id, status
  INTO v_assignment
  FROM public.delivery_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF v_assignment.status = 'accepted' THEN
    RETURN;
  END IF;

  IF v_assignment.status <> 'assigned' THEN
    RAISE EXCEPTION 'Cannot accept assignment in status %; must be ''assigned''', v_assignment.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 4. Recheck rider eligibility and concurrency at acceptance time with row lock fourth
  SELECT id, is_verified, is_active, is_available
  INTO v_rider
  FROM public.riders
  WHERE id = v_rider_id
  FOR UPDATE;

  IF NOT (v_rider.is_verified AND v_rider.is_active AND v_rider.is_available) THEN
    RAISE EXCEPTION 'Rider % is not verified, active, or available to accept assignments', v_rider_id
      USING ERRCODE = 'KD409';
  END IF;

  -- Ensure rider does not already have an active in-flight delivery
  IF EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.deliveries d ON d.id = da.delivery_id
    WHERE da.rider_id = v_rider_id
      AND da.id <> p_assignment_id
      AND da.status = 'accepted'
      AND d.status IN ('assigned', 'picked_up', 'in_transit')
  ) THEN
    RAISE EXCEPTION 'Rider % already has an active in-flight delivery', v_rider_id
      USING ERRCODE = 'KD409';
  END IF;

  UPDATE public.delivery_assignments
  SET status = 'accepted',
      responded_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_assignment_id;

  PERFORM public.log_operational_audit_event(
    'assignment_accepted',
    'delivery_assignments',
    p_assignment_id,
    jsonb_build_object('status', 'assigned'),
    jsonb_build_object('status', 'accepted', 'delivery_id', v_assignment.delivery_id)
  );
END;
$$;

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

  -- Update assignment status to rejected
  UPDATE public.delivery_assignments
  SET status = 'rejected',
      notes = CASE WHEN p_reason IS NOT NULL THEN COALESCE(notes, '') || ' [Rejected: ' || p_reason || ']' ELSE notes END,
      responded_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = p_assignment_id;

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

REVOKE EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.accept_delivery_assignment(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.reject_delivery_assignment(uuid, text) TO authenticated;


-- =============================================================================
-- §7  RIDER LOGISTICS CUSTODY RPCS (ATOMIC MULTI-TABLE TRANSITIONS)
-- =============================================================================

-- 7.1 Confirm Package Pickup
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

    -- Food/grocery orders must strictly be in ready_for_pickup
    IF v_order.service_type IN ('food', 'grocery') AND v_order.status <> 'ready_for_pickup' THEN
      RAISE EXCEPTION 'Cannot pick up food/grocery order in status ''%''; must be ''ready_for_pickup''',
        v_order.status USING ERRCODE = 'KD409';
    END IF;

    -- Courier orders bypass vendor prep and strictly require payment_confirmed
    IF v_order.service_type = 'courier' AND v_order.status <> 'payment_confirmed' THEN
      RAISE EXCEPTION 'Cannot pick up courier order in status ''%''; must be ''payment_confirmed''',
        v_order.status USING ERRCODE = 'KD409';
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
  END IF;

  -- Update delivery row
  UPDATE public.deliveries
  SET status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE id = p_delivery_id;

  -- Record status update breadcrumb using actual schema columns (Migration 007)
  INSERT INTO public.delivery_status_updates (
    delivery_id, old_status, new_status, updated_by, notes, created_at
  ) VALUES (
    p_delivery_id, 'assigned', 'picked_up', auth.uid(), p_notes, pg_catalog.now()
  );

  PERFORM public.log_operational_audit_event(
    'delivery_picked_up',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status', 'assigned'),
    jsonb_build_object('status', 'picked_up', 'notes', p_notes)
  );
END;
$$;

-- 7.2 Mark In-Transit
CREATE OR REPLACE FUNCTION public.mark_delivery_in_transit(
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

  -- 1. Lock linked order first and enforce cross-state invariant
  IF v_order_id IS NOT NULL THEN
    SELECT id, status INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;

    IF v_order.status <> 'picked_up' THEN
      RAISE EXCEPTION 'Linked order % is in status ''%''; must be ''picked_up'' to transition to in_transit',
        v_order_id, v_order.status USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, order_id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.delivery_assignments
    WHERE delivery_id = p_delivery_id
      AND rider_id = v_rider_id
      AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'You do not have an accepted assignment for delivery %', p_delivery_id
      USING ERRCODE = 'KD403';
  END IF;

  IF v_delivery.status <> 'picked_up' THEN
    RAISE EXCEPTION 'Delivery % is in status %; must be ''picked_up'' to go in transit',
      p_delivery_id, v_delivery.status USING ERRCODE = 'KD409';
  END IF;

  -- Update order atomically if linked
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET status = 'in_transit',
        in_transit_at = COALESCE(in_transit_at, pg_catalog.now()),
        updated_at = pg_catalog.now()
    WHERE id = v_order_id;
  END IF;

  -- Update delivery
  UPDATE public.deliveries
  SET status = 'in_transit',
      in_transit_at = COALESCE(in_transit_at, pg_catalog.now()),
      updated_at = pg_catalog.now()
  WHERE id = p_delivery_id;

  -- Record status update breadcrumb using actual schema columns
  INSERT INTO public.delivery_status_updates (
    delivery_id, old_status, new_status, updated_by, notes, created_at
  ) VALUES (
    p_delivery_id, 'picked_up', 'in_transit', auth.uid(), p_notes, pg_catalog.now()
  );

  PERFORM public.log_operational_audit_event(
    'delivery_in_transit',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status', 'picked_up'),
    jsonb_build_object('status', 'in_transit', 'notes', p_notes)
  );
END;
$$;

-- 7.3 Mark Delivered
CREATE OR REPLACE FUNCTION public.mark_delivery_delivered(
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
  v_assignment record;
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
    SELECT id, status INTO v_order
    FROM public.orders
    WHERE id = v_order_id
    FOR UPDATE;
  END IF;

  -- 2. Lock delivery row second
  SELECT id, order_id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  -- Authorization check first: caller must have an authorized assignment for this delivery
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

  -- 4. Complete order atomically if linked
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

  -- 5. Lock and increment rider completed delivery count atomically
  UPDATE public.riders
  SET total_deliveries = total_deliveries + 1,
      updated_at = pg_catalog.now()
  WHERE id = v_rider_id;

  -- Record status update breadcrumb using actual schema columns
  INSERT INTO public.delivery_status_updates (
    delivery_id, old_status, new_status, updated_by, notes, created_at
  ) VALUES (
    p_delivery_id, 'in_transit', 'delivered', auth.uid(), p_notes, pg_catalog.now()
  );

  PERFORM public.log_operational_audit_event(
    'delivery_delivered',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status', 'in_transit'),
    jsonb_build_object('status', 'delivered', 'notes', p_notes)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_picked_up(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_in_transit(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_in_transit(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_delivery_delivered(uuid, text) TO authenticated;


-- =============================================================================
-- §8  OPERATIONAL CANCELLATION & REFUND MARKER ENGINE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cancel_order_operational(
  p_order_id uuid,
  p_reason   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id     uuid;
  v_role        text;
  v_order       record;
  v_delivery    record;
  v_assignment  record;
  v_vendor_id   uuid;
  v_was_paid    boolean;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid cancellation reason is required' USING ERRCODE = 'KD400';
  END IF;

  v_user_id := auth.uid();
  v_role := public.get_current_user_role();

  -- 1. Lock orders first (hierarchy: orders -> deliveries -> delivery_assignments -> riders)
  SELECT id, customer_id, vendor_id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id USING ERRCODE = 'KD404';
  END IF;

  IF v_order.status IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel order in terminal status %', v_order.status USING ERRCODE = 'KD409';
  END IF;

  -- 2. Lock matching delivery second
  SELECT id, status
  INTO v_delivery
  FROM public.deliveries
  WHERE order_id = p_order_id
  FOR UPDATE;

  v_was_paid := v_order.status IN (
    'payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit'
  );

  -- Role-based cancellation validation
  IF v_role IN ('admin', 'super_admin') THEN
    -- Admin has operational override. Post-pickup cancellation is explicitly audited as an operational incident.
    IF v_order.status IN ('picked_up', 'in_transit') THEN
      PERFORM public.log_operational_audit_event(
        'order_post_pickup_cancellation_incident',
        'orders',
        p_order_id,
        jsonb_build_object('status', v_order.status, 'actor_role', v_role),
        jsonb_build_object('reason', p_reason, 'incident', true, 'requires_investigation', true)
      );
    END IF;

  ELSIF v_order.customer_id = v_user_id THEN
    -- Customer may only cancel pre-payment
    IF v_order.status NOT IN ('pending', 'payment_pending') THEN
      RAISE EXCEPTION 'Customers cannot cancel orders once payment is confirmed or in fulfillment'
        USING ERRCODE = 'KD403';
    END IF;

  ELSE
    -- Check if vendor owns this order
    SELECT id INTO v_vendor_id
    FROM public.vendors
    WHERE profile_id = v_user_id;

    IF FOUND AND v_vendor_id = v_order.vendor_id THEN
      -- Vendor may only cancel before preparation begins
      IF v_order.status <> 'payment_confirmed' THEN
        RAISE EXCEPTION 'Vendors can only cancel orders in payment_confirmed status'
          USING ERRCODE = 'KD403';
      END IF;
    ELSE
      RAISE EXCEPTION 'You are not authorized to cancel this order' USING ERRCODE = 'KD403';
    END IF;
  END IF;

  -- Cancel the order
  UPDATE public.orders
  SET status = 'cancelled',
      cancelled_at = pg_catalog.now(),
      cancellation_reason = p_reason,
      refund_required = v_was_paid,
      refund_status = CASE WHEN v_was_paid THEN 'pending_manual_review' ELSE 'none' END,
      updated_at = pg_catalog.now()
  WHERE id = p_order_id;

  -- Cancel matching delivery and record delivery_status_updates history
  IF v_delivery.id IS NOT NULL THEN
    UPDATE public.deliveries
    SET status = 'cancelled',
        cancelled_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = v_delivery.id;

    INSERT INTO public.delivery_status_updates (
      delivery_id, old_status, new_status, updated_by, notes, created_at
    ) VALUES (
      v_delivery.id,
      v_delivery.status,
      'cancelled',
      auth.uid(),
      'Order cancelled by ' || v_role || '. Reason: ' || p_reason,
      pg_catalog.now()
    );

    PERFORM public.log_operational_audit_event(
      'delivery_cancelled_operational',
      'deliveries',
      v_delivery.id,
      jsonb_build_object('status', v_delivery.status),
      jsonb_build_object('status', 'cancelled', 'reason', p_reason)
    );

    -- 3. Lock and terminate all open assignments (assigned and accepted) to maintain state consistency
    FOR v_assignment IN
      SELECT id, status, rider_id
      FROM public.delivery_assignments
      WHERE delivery_id = v_delivery.id
        AND status IN ('assigned', 'accepted')
      FOR UPDATE
    LOOP
      UPDATE public.delivery_assignments
      SET status = 'rejected',
          notes = COALESCE(notes, '') || ' [' || CASE WHEN v_order.status IN ('picked_up', 'in_transit') THEN 'INCIDENT: ' ELSE '' END || 'Terminated: Order cancelled by ' || v_role || '. Reason: ' || p_reason || ']',
          responded_at = COALESCE(responded_at, pg_catalog.now()),
          updated_at = pg_catalog.now()
      WHERE id = v_assignment.id;

      PERFORM public.log_operational_audit_event(
        'assignment_cancelled_order_cancellation',
        'delivery_assignments',
        v_assignment.id,
        jsonb_build_object('status', v_assignment.status),
        jsonb_build_object('status', 'rejected', 'reason', p_reason, 'context', 'cancel_order_operational')
      );
    END LOOP;
  END IF;

  PERFORM public.log_operational_audit_event(
    'order_cancelled_operational',
    'orders',
    p_order_id,
    jsonb_build_object('status', v_order.status),
    jsonb_build_object('status', 'cancelled', 'refund_required', v_was_paid, 'reason', p_reason)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) TO authenticated;


-- =============================================================================
-- §9  DEDICATED COURIER ORDER INGESTION RPC (CONCURRENCY-SAFE IDEMPOTENCY)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_courier_order_secure(
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
  v_user_id          uuid;
  v_idempotency_key  text;
  v_existing_order   record;
  v_order_id         uuid;
  v_service_area     record;
  v_distance_km      numeric(10,3);
  v_rule             record;
  v_raw_fee          numeric(12,2);
  v_delivery_fee     numeric(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'KD403';
  END IF;

  IF p_idempotency_key IS NULL OR trim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'A valid idempotency key is required'
      USING ERRCODE = 'KD400';
  END IF;

  v_idempotency_key := trim(p_idempotency_key);

  -- 1. Fast-path Idempotency Check: return existing order if key was already processed
  SELECT id, distance_km, delivery_fee, total, status
  INTO v_existing_order
  FROM public.orders
  WHERE customer_id = v_user_id AND idempotency_key = v_idempotency_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'distance_km', v_existing_order.distance_km,
      'delivery_fee', v_existing_order.delivery_fee,
      'total', v_existing_order.total,
      'status', v_existing_order.status,
      'idempotent_replayed', true
    );
  END IF;

  -- 2. Field Validations
  IF p_pickup_address IS NULL OR trim(p_pickup_address) = '' THEN
    RAISE EXCEPTION 'pickup_address is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'delivery_address is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_pickup_contact IS NULL OR trim(p_pickup_contact) = '' THEN
    RAISE EXCEPTION 'pickup_contact is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_delivery_contact IS NULL OR trim(p_delivery_contact) = '' THEN
    RAISE EXCEPTION 'delivery_contact is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_pickup_phone IS NULL OR trim(p_pickup_phone) = '' THEN
    RAISE EXCEPTION 'pickup_phone is required' USING ERRCODE = 'KD400';
  END IF;
  IF p_delivery_phone IS NULL OR trim(p_delivery_phone) = '' THEN
    RAISE EXCEPTION 'delivery_phone is required' USING ERRCODE = 'KD400';
  END IF;

  -- 3. Coordinate Validations
  IF p_pickup_lat IS NULL OR p_pickup_lon IS NULL OR p_delivery_lat IS NULL OR p_delivery_lon IS NULL THEN
    RAISE EXCEPTION 'Valid pickup and delivery coordinates are required' USING ERRCODE = 'KD400';
  END IF;

  -- 4. Geographic Service Area Validation for BOTH Pickup and Destination
  IF NOT public.is_location_in_service_area(p_pickup_lat, p_pickup_lon) THEN
    RAISE EXCEPTION 'Pickup location is outside all active KingdomDash service areas' USING ERRCODE = 'KD409';
  END IF;

  IF NOT public.is_location_in_service_area(p_delivery_lat, p_delivery_lon) THEN
    RAISE EXCEPTION 'Delivery location is outside all active KingdomDash service areas' USING ERRCODE = 'KD409';
  END IF;

  -- Resolve delivery service area for pricing tier evaluation deterministically
  SELECT id INTO v_service_area
  FROM public.service_areas
  WHERE is_active = true
    AND public.is_location_in_service_area(p_delivery_lat, p_delivery_lon, id)
  ORDER BY created_at ASC, id ASC
  LIMIT 1;

  -- 5. Calculate Geodesic Distance
  v_distance_km := public.calculate_distance_km(
    p_pickup_lat, p_pickup_lon, p_delivery_lat, p_delivery_lon
  );

  -- 6. Deterministic 4-tier Pricing Rule Resolution
  SELECT
    id, base_fee, distance_rate, min_fee, max_fee,
    CASE
      WHEN service_type = 'courier' AND service_area_id = v_service_area.id THEN 1
      WHEN service_type = 'courier' AND service_area_id IS NULL THEN 2
      WHEN service_type IS NULL AND service_area_id = v_service_area.id THEN 3
      WHEN service_type IS NULL AND service_area_id IS NULL THEN 4
      ELSE 5
    END AS tier
  INTO v_rule
  FROM public.delivery_pricing_rules
  WHERE is_active = true
    AND effective_date <= CURRENT_DATE
    AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
    AND (
      (service_type = 'courier' AND service_area_id = v_service_area.id)
      OR (service_type = 'courier' AND service_area_id IS NULL)
      OR (service_type IS NULL AND service_area_id = v_service_area.id)
      OR (service_type IS NULL AND service_area_id IS NULL)
    )
  ORDER BY tier ASC, effective_date DESC, created_at DESC, id DESC
  LIMIT 1;

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

  -- 7. Concurrency-Safe Order Insertion with Contact Snapshots & Idempotency Key
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
      v_delivery_fee,
      p_special_instructions,
      v_distance_km,
      v_rule.id,
      'pending',
      v_idempotency_key
    )
    RETURNING id INTO v_order_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Race condition: another concurrent request inserted this exact customer+key
      IF v_idempotency_key IS NOT NULL THEN
        SELECT id, distance_km, delivery_fee, total, status
        INTO v_existing_order
        FROM public.orders
        WHERE customer_id = v_user_id AND idempotency_key = v_idempotency_key;

        IF FOUND THEN
          RETURN jsonb_build_object(
            'order_id', v_existing_order.id,
            'distance_km', v_existing_order.distance_km,
            'delivery_fee', v_existing_order.delivery_fee,
            'total', v_existing_order.total,
            'status', v_existing_order.status,
            'idempotent_replayed', true
          );
        END IF;
      END IF;
      RAISE;
  END;

  PERFORM public.log_operational_audit_event(
    'courier_order_created',
    'orders',
    v_order_id,
    NULL,
    jsonb_build_object('delivery_fee', v_delivery_fee, 'distance_km', v_distance_km, 'idempotency_key', v_idempotency_key)
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'distance_km', v_distance_km,
    'delivery_fee', v_delivery_fee,
    'total', v_delivery_fee,
    'status', 'pending'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_courier_order_secure(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_courier_order_secure(text, text, text, numeric, numeric, text, text, text, numeric, numeric, text, text) TO authenticated;


-- =============================================================================
-- §10 RLS HARDENING, MUTATION REVOCATION & POLICY CLEANUP
-- =============================================================================

-- 10.1 Explicitly drop legacy permissive mutation policies and ALL policies that bypassed RPCs
DROP POLICY IF EXISTS "orders_update_vendor" ON public.orders;
DROP POLICY IF EXISTS "orders_update_own_vendor" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_own_customer" ON public.orders;
DROP POLICY IF EXISTS "orders_all_admin" ON public.orders;
DROP POLICY IF EXISTS "deliveries_all_admin" ON public.deliveries;
DROP POLICY IF EXISTS "delivery_assignments_update_own_rider" ON public.delivery_assignments;
DROP POLICY IF EXISTS "delivery_assignments_all_admin" ON public.delivery_assignments;
DROP POLICY IF EXISTS "delivery_status_updates_insert_rider" ON public.delivery_status_updates;
DROP POLICY IF EXISTS "delivery_status_updates_all_admin" ON public.delivery_status_updates;

-- 10.2 Explicitly revoke all access from anonymous users
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.orders FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.deliveries FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.delivery_assignments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.delivery_status_updates FROM anon;

-- Revoke direct table mutations from authenticated users (must flow through verified RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.deliveries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_assignments FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.delivery_status_updates FROM authenticated;

-- Grant SELECT only to authenticated (subject to RLS policies below)
GRANT SELECT ON public.orders TO authenticated;
GRANT SELECT ON public.deliveries TO authenticated;
GRANT SELECT ON public.delivery_assignments TO authenticated;
GRANT SELECT ON public.delivery_status_updates TO authenticated;

-- Enable RLS on all operational tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_status_updates ENABLE ROW LEVEL SECURITY;

-- 10.3 Orders admin SELECT policy (non-admin customer/vendor policies defined in Phase 4/6)
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
CREATE POLICY "orders_select_admin" ON public.orders
FOR SELECT USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);

-- 10.3 Deliveries SELECT policies
DROP POLICY IF EXISTS "deliveries_select_customer" ON public.deliveries;
CREATE POLICY "deliveries_select_customer" ON public.deliveries
FOR SELECT USING (
  order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
);

DROP POLICY IF EXISTS "deliveries_select_vendor" ON public.deliveries;
CREATE POLICY "deliveries_select_vendor" ON public.deliveries
FOR SELECT USING (
  vendor_id IN (SELECT id FROM public.vendors WHERE profile_id = auth.uid())
);

DROP POLICY IF EXISTS "deliveries_select_rider" ON public.deliveries;
CREATE POLICY "deliveries_select_rider" ON public.deliveries
FOR SELECT USING (
  id IN (
    SELECT da.delivery_id FROM public.delivery_assignments da
    JOIN public.riders r ON r.id = da.rider_id
    WHERE r.profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "deliveries_select_admin" ON public.deliveries;
CREATE POLICY "deliveries_select_admin" ON public.deliveries
FOR SELECT USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);

-- 10.4 Delivery Assignments SELECT policies
DROP POLICY IF EXISTS "assignments_select_customer" ON public.delivery_assignments;
CREATE POLICY "assignments_select_customer" ON public.delivery_assignments
FOR SELECT USING (
  delivery_id IN (
    SELECT d.id
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id
    WHERE o.customer_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "assignments_select_rider" ON public.delivery_assignments;
CREATE POLICY "assignments_select_rider" ON public.delivery_assignments
FOR SELECT USING (
  rider_id IN (SELECT id FROM public.riders WHERE profile_id = auth.uid())
);

DROP POLICY IF EXISTS "assignments_select_admin" ON public.delivery_assignments;
CREATE POLICY "assignments_select_admin" ON public.delivery_assignments
FOR SELECT USING (
  public.get_current_user_role() IN ('admin', 'super_admin')
);

-- 10.5 Delivery Status Updates SELECT policies
DROP POLICY IF EXISTS "updates_select_operational" ON public.delivery_status_updates;
CREATE POLICY "updates_select_operational" ON public.delivery_status_updates
FOR SELECT USING (
  delivery_id IN (
    SELECT id FROM public.deliveries WHERE order_id IN (SELECT id FROM public.orders WHERE customer_id = auth.uid())
    UNION
    SELECT da.delivery_id FROM public.delivery_assignments da JOIN public.riders r ON r.id = da.rider_id WHERE r.profile_id = auth.uid()
    UNION
    SELECT id FROM public.deliveries WHERE vendor_id IN (SELECT id FROM public.vendors WHERE profile_id = auth.uid())
  )
  OR public.get_current_user_role() IN ('admin', 'super_admin')
);
