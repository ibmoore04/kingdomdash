-- Migration: 20261013000002_flutterwave_payment_integration.sql
-- Flutterwave Payment Gateway Integration
-- Adds support for Flutterwave payment lifecycle, webhook reconciliation,
-- multiple payment attempts handling, audit logging, and financial immutability triggers.

-- =============================================================================
-- §1  payments Table Enhancements for Flutterwave
-- =============================================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS flutterwave_ref text,
  ADD COLUMN IF NOT EXISTS flutterwave_transaction_id text,
  ADD COLUMN IF NOT EXISTS flw_ref text;

-- §1.1 Flutterwave Reference Uniqueness:
-- Enforces that one Flutterwave transaction reference belongs to at most one payment record.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_flutterwave_ref_unique
  ON public.payments(flutterwave_ref)
  WHERE flutterwave_ref IS NOT NULL;

-- §1.2 Flutterwave Transaction ID Uniqueness:
-- Enforces that one Flutterwave transaction ID cannot represent multiple KingdomDash payments.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_flutterwave_tx_id_unique
  ON public.payments(flutterwave_transaction_id)
  WHERE flutterwave_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_gateway ON public.payments(gateway);

-- =============================================================================
-- §2  flutterwave_webhook_events Table (Webhook Idempotency & Audit Log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.flutterwave_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_fingerprint text NOT NULL UNIQUE,
  event_type text NOT NULL,
  tx_ref text,
  flw_ref text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on flutterwave_webhook_events
ALTER TABLE public.flutterwave_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_flw_webhook_events_tx_ref ON public.flutterwave_webhook_events(tx_ref);
CREATE INDEX IF NOT EXISTS idx_flw_webhook_events_fingerprint ON public.flutterwave_webhook_events(event_fingerprint);

-- RLS: Only admins/super_admins can view webhook audit events; service role can insert
DROP POLICY IF EXISTS "flw_webhook_events_select_admin" ON public.flutterwave_webhook_events;
CREATE POLICY "flw_webhook_events_select_admin" ON public.flutterwave_webhook_events
  FOR SELECT
  USING (public.get_current_user_role() IN ('admin', 'super_admin'));

-- §2.1 Database-Level Event Immutability Trigger
CREATE OR REPLACE FUNCTION public.prevent_flw_webhook_events_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'flutterwave_webhook_events is an immutable audit log; updates and deletes are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_flw_webhook_events_mod ON public.flutterwave_webhook_events;
CREATE TRIGGER trg_prevent_flw_webhook_events_mod
  BEFORE UPDATE OR DELETE ON public.flutterwave_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_flw_webhook_events_modification();

-- =============================================================================
-- §3  create_flutterwave_payment_attempt Stored Procedure
-- =============================================================================
-- Validates customer ownership, payable order status, generates server-authoritative
-- Flutterwave reference, and creates pending payment record. Client cannot tamper with amount.

CREATE OR REPLACE FUNCTION public.create_flutterwave_payment_attempt(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id uuid;
  v_order public.orders%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_reference text;
  v_payment public.payments%ROWTYPE;
  v_role text;
BEGIN
  -- 1. Validate caller identity
  v_caller_id := auth.uid();
  v_role := public.get_current_user_role();

  IF v_caller_id IS NULL AND v_role NOT IN ('service_role', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Authentication required to initiate payment';
  END IF;

  -- 2. Lock ORDER first (Lock Order: public.orders -> public.payments)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- 3. Verify customer ownership
  IF v_role NOT IN ('service_role', 'admin', 'super_admin') THEN
    IF v_order.customer_id <> v_caller_id THEN
      RAISE EXCEPTION 'Access denied: caller does not own order %', p_order_id;
    END IF;
  END IF;

  -- 4. Verify order is payable
  IF v_order.status NOT IN ('pending', 'payment_pending') THEN
    RAISE EXCEPTION 'Order % cannot be paid; current status is %', p_order_id, v_order.status;
  END IF;

  -- 5. Verify no existing successful payment for this order
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE order_id = v_order.id AND status = 'successful'
  ) THEN
    RAISE EXCEPTION 'Order % has already been paid successfully', p_order_id;
  END IF;

  -- 6. Verify authoritative order total
  IF v_order.total <= 0 THEN
    RAISE EXCEPTION 'Order % has invalid total %', p_order_id, v_order.total;
  END IF;

  -- 7. Fetch customer profile for contact info
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_order.customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile for order % not found', p_order_id;
  END IF;

  -- 8. Generate server-authoritative Flutterwave reference
  -- Format: kd_flw_<order_prefix>_<epoch>_<entropy>
  v_reference := 'kd_flw_'
    || pg_catalog.substr(pg_catalog.replace(v_order.id::text, '-', ''), 1, 8)
    || '_'
    || (pg_catalog.date_part('epoch', pg_catalog.now())::bigint)::text
    || '_'
    || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6);

  -- 9. Insert pending payment record
  INSERT INTO public.payments (
    order_id,
    customer_id,
    gateway,
    flutterwave_ref,
    amount,
    currency,
    status
  ) VALUES (
    v_order.id,
    v_order.customer_id,
    'flutterwave',
    v_reference,
    v_order.total,
    'NGN',
    'pending'
  )
  RETURNING * INTO v_payment;

  -- 10. Update order status to payment_pending if currently pending
  IF v_order.status = 'pending' THEN
    UPDATE public.orders
    SET status = 'payment_pending',
        updated_at = pg_catalog.now()
    WHERE id = v_order.id;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'tx_ref', v_reference,
    'amount', v_order.total,
    'currency', 'NGN',
    'customer_email', v_profile.email,
    'customer_name', pg_catalog.coalesce(v_profile.full_name, 'Valued Customer'),
    'customer_phone', pg_catalog.coalesce(v_profile.phone, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_flutterwave_payment_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_flutterwave_payment_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_flutterwave_payment_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_flutterwave_payment_attempt(uuid) TO service_role;

-- =============================================================================
-- §4  reconcile_flutterwave_payment Stored Procedure
-- =============================================================================
-- Reconciles Flutterwave transactions atomically under row-level locking.
-- Verifies authoritative order total, currency, ownership, and transitions order.

CREATE OR REPLACE FUNCTION public.reconcile_flutterwave_payment(
  p_tx_ref text,
  p_flutterwave_transaction_id text,
  p_flw_ref text,
  p_amount numeric,
  p_currency text,
  p_payment_type text,
  p_gateway_response text,
  p_paid_at timestamptz,
  p_raw_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment_id uuid;
  v_order_id uuid;
  v_payment public.payments%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_idempotency_key text;
BEGIN
  -- 1. Validate inputs
  IF p_tx_ref IS NULL OR pg_catalog.trim(p_tx_ref) = '' THEN
    RAISE EXCEPTION 'Transaction reference (tx_ref) is required';
  END IF;

  -- 2. Construct deterministic idempotency key
  v_idempotency_key := p_tx_ref || ':flw_charge.completed:' || pg_catalog.coalesce(p_flutterwave_transaction_id, 'none');

  -- 3. Fast-exit if already processed in payment_events
  IF EXISTS (
    SELECT 1 FROM public.payment_events
    WHERE idempotency_key = v_idempotency_key
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_processed',
      'tx_ref', p_tx_ref,
      'idempotency_key', v_idempotency_key
    );
  END IF;

  -- 4. Lookup payment record by flutterwave_ref
  SELECT id, order_id INTO v_payment_id, v_order_id
  FROM public.payments
  WHERE flutterwave_ref = p_tx_ref;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment reference % not found in database', p_tx_ref;
  END IF;

  -- 5. Lock ORDER first (Lock Order: public.orders -> public.payments)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % for payment reference % not found', v_order_id, p_tx_ref;
  END IF;

  -- 6. Lock PAYMENT second
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found during row lock', v_payment_id;
  END IF;

  -- 7. Customer Ownership Consistency Guard
  IF v_payment.customer_id IS NOT NULL AND v_payment.customer_id <> v_order.customer_id THEN
    RAISE EXCEPTION 'Customer mismatch: payment customer % does not match order customer %',
      v_payment.customer_id, v_order.customer_id;
  END IF;

  -- 8. Already Successful Check
  IF v_payment.status = 'successful' THEN
    BEGIN
      INSERT INTO public.payment_events (
        payment_id, paystack_reference, event_type, idempotency_key, payload
      ) VALUES (
        v_payment.id, p_tx_ref, 'flw_charge.duplicate', v_idempotency_key, p_raw_payload
      );
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_successful',
      'order_id', v_payment.order_id,
      'payment_id', v_payment.id
    );
  END IF;

  -- 9. Order Status Transition Guard
  IF v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing') THEN
    RAISE EXCEPTION 'Cannot reconcile payment: order % is in % status (not payable)',
      v_order.id, v_order.status;
  END IF;

  -- 10. Currency Guard
  IF pg_catalog.upper(p_currency) <> 'NGN' THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Rejected invalid currency: ' || p_currency,
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Currency mismatch: expected NGN, received %', p_currency;
  END IF;

  -- 11. Authoritative Amount Verification
  -- Flutterwave sends amount in major units (Naira). Verify against orders.total
  IF pg_catalog.round(p_amount, 2) < pg_catalog.round(v_order.total, 2) THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Underpaid amount: expected ' || v_order.total || ', got ' || p_amount,
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Amount mismatch: expected %, received %', v_order.total, p_amount;
  END IF;

  -- 12. Mark Payment as Successful
  UPDATE public.payments
  SET status = 'successful',
      gateway = 'flutterwave',
      flutterwave_transaction_id = p_flutterwave_transaction_id,
      flw_ref = p_flw_ref,
      channel = pg_catalog.coalesce(p_payment_type, 'flutterwave'),
      gateway_response = pg_catalog.coalesce(p_gateway_response, 'Successful'),
      paid_at = pg_catalog.coalesce(p_paid_at, pg_catalog.now()),
      verified_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = v_payment.id;

  -- 13. Transition Order to 'payment_confirmed'
  UPDATE public.orders
  SET status = 'payment_confirmed',
      updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  -- 14. Insert Audit Log into payment_events
  BEGIN
    INSERT INTO public.payment_events (
      payment_id,
      paystack_reference,
      event_type,
      idempotency_key,
      payload
    ) VALUES (
      v_payment.id,
      p_tx_ref,
      'flw_charge.completed',
      v_idempotency_key,
      p_raw_payload
    );
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'reconciled',
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'tx_ref', p_tx_ref
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_flutterwave_payment(text, text, text, numeric, text, text, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_flutterwave_payment(text, text, text, numeric, text, text, text, timestamptz, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_flutterwave_payment(text, text, text, numeric, text, text, text, timestamptz, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_flutterwave_payment(text, text, text, numeric, text, text, text, timestamptz, jsonb) TO service_role;
