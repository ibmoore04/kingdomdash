-- Migration: 20260902000042_customer_order_cancellation_enhancement.sql
-- Description: Customer order cancellation RPC permissions & refund tracking.

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
  v_user_phone  text;
  v_role        text;
  v_order       record;
  v_delivery    record;
  v_vendor_id   uuid;
  v_was_paid    boolean;
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RAISE EXCEPTION 'A valid cancellation reason is required' USING ERRCODE = 'KD400';
  END IF;

  v_user_id := auth.uid();
  v_role := public.get_current_user_role();

  SELECT phone INTO v_user_phone
  FROM public.profiles
  WHERE id = v_user_id;

  -- 1. Lock orders first
  SELECT id, customer_id, customer_phone, vendor_id, status
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

  ELSIF (v_user_id IS NOT NULL AND v_order.customer_id = v_user_id) 
        OR (v_user_phone IS NOT NULL AND v_order.customer_phone = v_user_phone) THEN
    -- Customer may cancel pre-fulfillment (pending, payment_pending, payment_processing, payment_confirmed)
    IF v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing', 'payment_confirmed') THEN
      RAISE EXCEPTION 'Customers cannot cancel orders once in preparation or fulfillment. Please contact support.'
        USING ERRCODE = 'KD403';
    END IF;

  ELSE
    -- Check if vendor owns this order
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
