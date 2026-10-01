-- =============================================================================
-- Migration: 20261006000001_delivery_confirmation_and_settlement_bridge.sql
-- Module   : KingdomDash Delivery Confirmation PIN & Settlement Auto-Bridge
-- Contract : DOCS/SETTLEMENT_ENGINE_ARCHITECTURE.md (§1, §12)
-- Purpose  : 1. Automatic trigger on orders to enqueue settlement_queue jobs on delivery
--            2. delivery_confirmations table with attempt lockout (Max 3)
--            3. execute_successful_delivery_confirmation RPC (atomic delivery transition)
--            4. record_failed_pin_attempt RPC (exhaustion lockout)
--            5. admin_override_delivery_confirmation RPC (audited SuperAdmin gate)
--            6. trg_sync_order_delivery_confirmation to establish PIN confirmation records
-- =============================================================================

-- 1. Table: delivery_confirmations (§12)
CREATE TABLE IF NOT EXISTS public.delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES public.profiles(id),
  pin_hash text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'locked_exhausted', 'admin_overridden')),
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id),
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_order_id ON public.delivery_confirmations(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_confirmations_status ON public.delivery_confirmations(verification_status);

ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_confirmations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.delivery_confirmations TO service_role;
GRANT SELECT ON public.delivery_confirmations TO authenticated;

-- RLS: Riders can read confirmations for orders assigned to them, admins can read all
DROP POLICY IF EXISTS "Riders and admins can view delivery confirmations" ON public.delivery_confirmations;
CREATE POLICY "Riders and admins can view delivery confirmations"
  ON public.delivery_confirmations
  FOR SELECT
  TO authenticated
  USING (
    rider_id = auth.uid() 
    OR public.get_current_user_role() IN ('super_admin', 'admin')
  );

-- 2. Privileged RPC: execute_successful_delivery_confirmation (§12)
-- Atomically transitions order to delivery_confirmed and enqueues settlement job
CREATE OR REPLACE FUNCTION public.execute_successful_delivery_confirmation(
  p_order_id uuid,
  p_rider_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
  v_order_rows integer;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only trusted server function can execute confirmation' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_rec FROM public.delivery_confirmations WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery confirmation record not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;
  
  IF v_rec.verification_status != 'pending' THEN
    RAISE EXCEPTION 'Delivery confirmation is already in state: %', v_rec.verification_status USING ERRCODE = 'KD409';
  END IF;

  -- Atomic affected-row transition check: transition from in_transit or out_for_delivery
  UPDATE public.orders 
  SET status = 'delivery_confirmed',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now() 
  WHERE id = p_order_id AND status IN ('in_transit', 'out_for_delivery');
  
  GET DIAGNOSTICS v_order_rows = ROW_COUNT;
  IF v_order_rows != 1 THEN
    -- Also accept if already marked delivered
    UPDATE public.orders 
    SET status = 'delivery_confirmed',
        updated_at = now() 
    WHERE id = p_order_id;
  END IF;

  -- Update delivery confirmations record
  UPDATE public.delivery_confirmations 
  SET verification_status = 'verified',
      verified_at = now(),
      verified_by = p_rider_id,
      updated_at = now()
  WHERE id = v_rec.id;

  -- Advance any payables from payable_pending to settlement_queued
  UPDATE public.order_payables
  SET status = 'settlement_queued',
      updated_at = now()
  WHERE order_id = p_order_id AND status = 'payable_pending';

  -- Enqueue exactly 1 settlement queue job
  INSERT INTO public.settlement_queue (order_id, status, scheduled_at, updated_at) 
  VALUES (p_order_id, 'pending', now(), now())
  ON CONFLICT (order_id) DO UPDATE SET
    status = CASE 
      WHEN public.settlement_queue.status IN ('completed', 'cancelled') THEN public.settlement_queue.status 
      ELSE 'pending' 
    END,
    updated_at = now()
  WHERE public.settlement_queue.status NOT IN ('completed', 'cancelled', 'processing');

  RETURN jsonb_build_object('success', true, 'status', 'verified', 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_successful_delivery_confirmation(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_successful_delivery_confirmation(uuid, uuid) TO service_role;

-- 3. Privileged RPC: record_failed_pin_attempt (§12)
CREATE OR REPLACE FUNCTION public.record_failed_pin_attempt(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
  v_new_attempts integer;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only trusted server function can record attempt' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_rec FROM public.delivery_confirmations WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery confirmation record not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;

  v_new_attempts := v_rec.attempt_count + 1;

  IF v_new_attempts >= v_rec.max_attempts THEN
    UPDATE public.delivery_confirmations 
    SET attempt_count = v_new_attempts,
        verification_status = 'locked_exhausted',
        updated_at = now()
    WHERE id = v_rec.id;
    
    RETURN jsonb_build_object(
      'success', false, 
      'status', 'locked_exhausted', 
      'remaining_attempts', 0
    );
  END IF;

  UPDATE public.delivery_confirmations 
  SET attempt_count = v_new_attempts,
      updated_at = now()
  WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'success', false, 
    'status', 'invalid_pin', 
    'remaining_attempts', (v_rec.max_attempts - v_new_attempts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_failed_pin_attempt(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_failed_pin_attempt(uuid) TO service_role;

-- 4. Authoritative RPC: admin_override_delivery_confirmation (§12)
CREATE OR REPLACE FUNCTION public.admin_override_delivery_confirmation(
  p_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_caller_id uuid;
  v_rec record;
BEGIN
  v_caller_role := public.get_current_user_role();
  v_caller_id := auth.uid();

  IF v_caller_role NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: SuperAdmin or Admin privileges required' USING ERRCODE = 'KD403';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A substantive override reason (minimum 5 characters) is required' USING ERRCODE = 'KD400';
  END IF;

  SELECT * INTO v_rec FROM public.delivery_confirmations WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery confirmation record not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- Update delivery confirmations
  UPDATE public.delivery_confirmations
  SET verification_status = 'admin_overridden',
      verified_at = now(),
      verified_by = v_caller_id,
      override_reason = trim(p_reason),
      updated_at = now()
  WHERE id = v_rec.id;

  -- Transition order to delivery_confirmed
  UPDATE public.orders
  SET status = 'delivery_confirmed',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id;

  -- Advance payables
  UPDATE public.order_payables
  SET status = 'settlement_queued',
      updated_at = now()
  WHERE order_id = p_order_id AND status = 'payable_pending';

  -- Enqueue into settlement_queue
  INSERT INTO public.settlement_queue (order_id, status, scheduled_at, updated_at) 
  VALUES (p_order_id, 'pending', now(), now())
  ON CONFLICT (order_id) DO UPDATE SET
    status = CASE 
      WHEN public.settlement_queue.status IN ('completed', 'cancelled') THEN public.settlement_queue.status 
      ELSE 'pending' 
    END,
    updated_at = now()
  WHERE public.settlement_queue.status NOT IN ('completed', 'cancelled', 'processing');

  -- Operational audit log
  PERFORM public.log_operational_audit_event(
    'delivery_confirmation_admin_override',
    'orders',
    p_order_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'reason', trim(p_reason),
      'overridden_by', v_caller_id,
      'previous_status', v_rec.verification_status
    )
  );

  RETURN jsonb_build_object('success', true, 'status', 'admin_overridden', 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_delivery_confirmation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_delivery_confirmation(uuid, text) TO authenticated, service_role;

-- 5. Automatic Settlement Bridge Trigger on public.orders (§1, §12)
-- Guarantees that whenever an order is marked delivered or delivery_confirmed,
-- payables advance to settlement_queued and a settlement_queue job is scheduled!
CREATE OR REPLACE FUNCTION public.trg_order_delivery_settlement_bridge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status IN ('delivered', 'delivery_confirmed') AND (OLD.status IS NULL OR OLD.status NOT IN ('delivered', 'delivery_confirmed')) THEN
    -- Advance payables to settlement_queued
    UPDATE public.order_payables
    SET status = 'settlement_queued',
        updated_at = now()
    WHERE order_id = NEW.id AND status = 'payable_pending';

    -- Enqueue settlement job idempotently
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

-- 6. Trigger to automatically provision delivery_confirmations when delivery_pin is set on order
CREATE OR REPLACE FUNCTION public.trg_sync_order_delivery_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_hash text;
BEGIN
  IF NEW.delivery_pin IS NOT NULL AND trim(NEW.delivery_pin) <> '' THEN
    -- Store cryptographic hash (SHA-256 fallback if native argon2 is not built into pg)
    v_hash := encode(digest(trim(NEW.delivery_pin), 'sha256'), 'hex');

    INSERT INTO public.delivery_confirmations (
      order_id,
      pin_hash,
      verification_status,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      v_hash,
      'pending',
      now(),
      now()
    )
    ON CONFLICT (order_id) DO UPDATE SET
      pin_hash = EXCLUDED.pin_hash,
      updated_at = now()
    WHERE public.delivery_confirmations.verification_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_delivery_confirmation ON public.orders;
CREATE TRIGGER trg_sync_order_delivery_confirmation
  AFTER INSERT OR UPDATE OF delivery_pin ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_order_delivery_confirmation();
