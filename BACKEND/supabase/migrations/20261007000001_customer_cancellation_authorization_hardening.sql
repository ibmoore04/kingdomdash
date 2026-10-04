-- Migration: 20261007000001_customer_cancellation_authorization_hardening.sql
-- Description: Customer Order Cancellation Authorization Hardening & Contact Snapshot
-- 1. Normalizes Nigerian phone matching across prefixes (+234, 0, whitespace)
-- 2. Authorizes customer cancellation if customer_id matches, or delivery_address_id belongs to customer, or phone matches
-- 3. Snapshots customer_phone, delivery_phone, and customer_name on orders via before-insert trigger
-- 4. Backfills existing orders with missing contact snapshots

-- ============================================================
-- Section 1: cancel_order_operational Hardened Definition
-- ============================================================

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
  v_user_id         uuid;
  v_user_phone      text;
  v_norm_user_phone text;
  v_role            text;
  v_order           record;
  v_delivery        record;
  v_vendor_id       uuid;
  v_was_paid        boolean;
  v_is_authorized   boolean := false;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid cancellation reason is required' USING ERRCODE = 'KD400';
  END IF;

  v_user_id := auth.uid();
  v_role := public.get_current_user_role();

  IF v_user_id IS NOT NULL THEN
    SELECT phone INTO v_user_phone
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_phone IS NOT NULL THEN
      v_norm_user_phone := right(regexp_replace(v_user_phone, '[^0-9]', '', 'g'), 10);
    END IF;
  END IF;

  -- 1. Lock orders first
  SELECT id, customer_id, customer_phone, delivery_phone, vendor_id, status, delivery_address_id
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
    IF v_order.status IN ('picked_up', 'in_transit') THEN
      PERFORM public.log_operational_audit_event(
        'order_post_pickup_cancellation_incident',
        'orders',
        p_order_id,
        jsonb_build_object('status', v_order.status, 'actor_role', v_role),
        jsonb_build_object('reason', p_reason, 'incident', true, 'requires_investigation', true)
      );
    END IF;
    v_is_authorized := true;

  ELSE
    -- Check if user is the customer:
    -- A. Direct customer_id match
    IF v_user_id IS NOT NULL AND v_order.customer_id = v_user_id THEN
      v_is_authorized := true;
    -- B. Delivery address belongs to this customer
    ELSIF v_user_id IS NOT NULL AND v_order.delivery_address_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.addresses a
      WHERE a.id = v_order.delivery_address_id AND a.profile_id = v_user_id
    ) THEN
      v_is_authorized := true;
    -- C. Normalized phone match (last 10 digits handles +234 / 080 variations)
    ELSIF v_norm_user_phone IS NOT NULL AND length(v_norm_user_phone) >= 7 AND (
      right(regexp_replace(COALESCE(v_order.customer_phone, ''), '[^0-9]', '', 'g'), 10) = v_norm_user_phone
      OR right(regexp_replace(COALESCE(v_order.delivery_phone, ''), '[^0-9]', '', 'g'), 10) = v_norm_user_phone
    ) THEN
      v_is_authorized := true;
    -- D. Order has unassigned customer_id and customer_phone (guest order claimed on confirmation page)
    ELSIF v_user_id IS NOT NULL AND v_order.customer_id IS NULL AND v_order.customer_phone IS NULL THEN
      v_is_authorized := true;
    END IF;

    IF v_is_authorized THEN
      -- Customer may cancel pre-fulfillment
      IF v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing', 'payment_confirmed') THEN
        RAISE EXCEPTION 'Customers cannot cancel orders once in preparation or fulfillment. Please contact support.'
          USING ERRCODE = 'KD403';
      END IF;
    ELSE
      -- Check if caller is vendor
      SELECT id INTO v_vendor_id
      FROM public.vendors
      WHERE profile_id = v_user_id;

      IF FOUND AND v_vendor_id = v_order.vendor_id THEN
        IF v_order.status <> 'payment_confirmed' THEN
          RAISE EXCEPTION 'Vendors can only cancel orders in payment_confirmed status'
            USING ERRCODE = 'KD403';
        END IF;
      ELSE
        RAISE EXCEPTION 'You are not authorized to cancel this order' USING ERRCODE = 'KD403';
      END IF;
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

  -- Cancel matching delivery and record history
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
      v_user_id,
      'Order cancelled by ' || v_role || '. Reason: ' || p_reason,
      pg_catalog.now()
    );

    PERFORM public.log_operational_audit_event(
      'delivery_cancelled_operational',
      'deliveries',
      v_delivery.id,
      jsonb_build_object('order_id', p_order_id, 'old_status', v_delivery.status),
      jsonb_build_object('reason', p_reason, 'actor_id', v_user_id)
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cancel_order_operational(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Section 2: Automatic Order Contact Snapshot Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_populate_order_contact_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 1. If delivery_address_id is provided, snapshot delivery_phone and customer_name from addresses
  IF NEW.delivery_address_id IS NOT NULL THEN
    IF NEW.delivery_phone IS NULL OR trim(NEW.delivery_phone) = '' THEN
      SELECT phone INTO NEW.delivery_phone FROM public.addresses WHERE id = NEW.delivery_address_id;
    END IF;
    IF NEW.customer_name IS NULL OR trim(NEW.customer_name) = '' THEN
      SELECT recipient_name INTO NEW.customer_name FROM public.addresses WHERE id = NEW.delivery_address_id;
    END IF;
  END IF;

  -- 2. If customer_phone or customer_name is still empty, snapshot from profiles if customer_id exists
  IF NEW.customer_id IS NOT NULL THEN
    IF NEW.customer_phone IS NULL OR trim(NEW.customer_phone) = '' THEN
      SELECT phone INTO NEW.customer_phone FROM public.profiles WHERE id = NEW.customer_id;
    END IF;
    IF NEW.customer_name IS NULL OR trim(NEW.customer_name) = '' THEN
      SELECT full_name INTO NEW.customer_name FROM public.profiles WHERE id = NEW.customer_id;
    END IF;
  END IF;

  -- 3. Fallback: if customer_phone is still empty, copy from delivery_phone
  IF (NEW.customer_phone IS NULL OR trim(NEW.customer_phone) = '') AND NEW.delivery_phone IS NOT NULL THEN
    NEW.customer_phone := NEW.delivery_phone;
  END IF;

  -- 4. Fallback: if delivery_phone is empty, copy from customer_phone
  IF (NEW.delivery_phone IS NULL OR trim(NEW.delivery_phone) = '') AND NEW.customer_phone IS NOT NULL THEN
    NEW.delivery_phone := NEW.customer_phone;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_contact_snapshot ON public.orders;
CREATE TRIGGER trg_order_contact_snapshot
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_populate_order_contact_snapshot();

-- ============================================================
-- Section 3: Retroactive Contact Snapshot Backfill
-- ============================================================

UPDATE public.orders o
SET delivery_phone = COALESCE(o.delivery_phone, a.phone),
    customer_phone = COALESCE(o.customer_phone, a.phone),
    customer_name = COALESCE(o.customer_name, a.recipient_name)
FROM public.addresses a
WHERE o.delivery_address_id = a.id
  AND (o.delivery_phone IS NULL OR o.customer_phone IS NULL OR o.customer_name IS NULL);

UPDATE public.orders o
SET customer_phone = COALESCE(o.customer_phone, p.phone),
    delivery_phone = COALESCE(o.delivery_phone, p.phone),
    customer_name = COALESCE(o.customer_name, p.full_name)
FROM public.profiles p
WHERE o.customer_id = p.id
  AND (o.customer_phone IS NULL OR o.delivery_phone IS NULL OR o.customer_name IS NULL);
