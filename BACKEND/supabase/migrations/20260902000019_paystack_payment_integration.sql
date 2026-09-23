-- Migration: 20260902000019_paystack_payment_integration.sql
-- Phase 9: Paystack Payment Integration (Hardened & Corrected)
-- Establishes server-authoritative Paystack payment lifecycle, webhook reconciliation,
-- multiple payment attempts handling, audit logging, database-level event immutability,
-- strict reference/transaction uniqueness, and financial immutability triggers.

-- =============================================================================
-- §1  payments Table Enhancements & Uniqueness Guarantees
-- =============================================================================

-- In Phase 5, order_id was UNIQUE on payments. In production, customers may abandon
-- a payment modal, experience card declines, or timeout before succeeding on a retry.
-- Replace the global UNIQUE constraint with a partial UNIQUE index that permits
-- multiple payment attempts per order, but strictly enforces at most ONE successful payment.

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_order_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_success_per_order
  ON public.payments(order_id)
  WHERE status = 'successful';

-- Add gateway tracking and audit metadata columns to public.payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS paystack_transaction_id text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS gateway_response text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Drop legacy non-unique or global constraints if existing
DROP INDEX IF EXISTS public.idx_payments_reference;
DROP INDEX IF EXISTS public.idx_payments_transaction_id;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_paystack_reference_key;

-- §1.1 Paystack Reference Uniqueness:
-- Enforces that one Paystack reference belongs to exactly one payment record.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paystack_reference_unique
  ON public.payments(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

-- §2 Paystack Transaction ID Uniqueness:
-- Enforces that one Paystack transaction ID cannot represent multiple KingdomDash payments.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paystack_tx_id_unique
  ON public.payments(paystack_transaction_id)
  WHERE paystack_transaction_id IS NOT NULL;

-- Performance and ownership lookup indexes
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON public.payments(order_id, status);

-- Update RLS on payments to allow customers to view payments where customer_id matches directly
DROP POLICY IF EXISTS "payments_select_own_customer" ON public.payments;
CREATE POLICY "payments_select_own_customer" ON public.payments
  FOR SELECT USING (
    customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- =============================================================================
-- §2  payment_events Table (Database-Level Immutable Webhook & Settlement Audit Log)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  paystack_reference text NOT NULL,
  event_type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on payment_events
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Indexes for event lookups and idempotency validation
CREATE INDEX IF NOT EXISTS idx_payment_events_ref ON public.payment_events(paystack_reference);
CREATE INDEX IF NOT EXISTS idx_payment_events_idempotency ON public.payment_events(idempotency_key);

-- RLS: Only admins can view audit events; no client role may insert, update, or delete
DROP POLICY IF EXISTS "payment_events_select_admin" ON public.payment_events;
CREATE POLICY "payment_events_select_admin" ON public.payment_events
  FOR SELECT
  USING (public.get_current_user_role() IN ('admin', 'super_admin'));

-- §3 Database-Level Event Immutability Trigger
-- Prevents UPDATE and DELETE operations on public.payment_events across all normal execution paths.
CREATE OR REPLACE FUNCTION public.prevent_payment_events_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'payment_events is an immutable audit log; updates and deletes are prohibited.';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_payment_events_modification() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_prevent_payment_events_modification ON public.payment_events;
CREATE TRIGGER trg_prevent_payment_events_modification
  BEFORE UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_payment_events_modification();

-- =============================================================================
-- §3  Update Payment Immutability Trigger (payments Table)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_payment_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- id: must never change
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'payments.id is immutable';
  END IF;

  -- order_id: must never change after creation
  IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION
      'payments.order_id is immutable; attempted change from % to %',
      OLD.order_id, NEW.order_id;
  END IF;

  -- customer_id: strictly immutable after creation (§5)
  -- customer A -> customer A = allowed
  -- customer A -> customer B = rejected
  -- NULL -> customer A after creation = rejected
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION
      'payments.customer_id is immutable; attempted change from % to %',
      OLD.customer_id, NEW.customer_id;
  END IF;

  -- amount: must never change after creation
  IF NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION
      'payments.amount is immutable; attempted change from % to %',
      OLD.amount, NEW.amount;
  END IF;

  -- currency: must never change after creation
  IF NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION
      'payments.currency is immutable; attempted change from % to %',
      OLD.currency, NEW.currency;
  END IF;

  -- paystack_reference: strictly immutable after creation
  IF NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference THEN
    RAISE EXCEPTION
      'payments.paystack_reference is immutable once set; attempted change';
  END IF;

  -- created_at: must never change
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'payments.created_at is immutable';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger functions are PUBLIC EXECUTE by default — revoke immediately
REVOKE ALL ON FUNCTION public.protect_payment_immutable_fields() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_payment_immutable_fields ON public.payments;
CREATE TRIGGER trg_protect_payment_immutable_fields
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_payment_immutable_fields();

-- =============================================================================
-- §4  Payment Attempt Creation Stored Procedure (create_payment_attempt)
-- =============================================================================
-- Validates customer ownership, payable order status, generates server-authoritative
-- Paystack reference, and creates pending payment record. Client cannot tamper with amount.

CREATE OR REPLACE FUNCTION public.create_payment_attempt(
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
  v_kobo_amount bigint;
  v_role text;
BEGIN
  -- 1. Validate caller identity
  v_caller_id := auth.uid();
  v_role := public.get_current_user_role();

  IF v_caller_id IS NULL AND v_role NOT IN ('service_role', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Authentication required to initiate payment';
  END IF;

  -- 2. Consistent Lock Hierarchy: Lock ORDER first
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  -- 3. Verify customer ownership (unless service_role or admin)
  IF v_role NOT IN ('service_role', 'admin', 'super_admin') THEN
    IF v_order.customer_id <> v_caller_id THEN
      RAISE EXCEPTION 'Access denied: caller does not own order %', p_order_id;
    END IF;
  END IF;

  -- 4. Verify order is payable (§9)
  IF v_order.status NOT IN ('pending', 'payment_pending') THEN
    RAISE EXCEPTION 'Order % cannot be paid; current status is %', p_order_id, v_order.status;
  END IF;

  -- 5. Verify no existing successful payment for this order (§12 & §19)
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE order_id = v_order.id AND status = 'successful'
  ) THEN
    RAISE EXCEPTION 'Order % has already been paid successfully', p_order_id;
  END IF;

  -- 6. Verify authoritative order total (§6)
  IF v_order.total <= 0 THEN
    RAISE EXCEPTION 'Order % has invalid total %', p_order_id, v_order.total;
  END IF;

  -- 7. Fetch customer profile for email (required by Paystack initialization)
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_order.customer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer profile for order % not found', p_order_id;
  END IF;

  -- 8. Generate server-authoritative Paystack reference (§20)
  -- Format: kd_<order_prefix>_<epoch>_<entropy>
  v_reference := 'kd_'
    || pg_catalog.substr(pg_catalog.replace(v_order.id::text, '-', ''), 1, 8)
    || '_'
    || (pg_catalog.date_part('epoch', pg_catalog.now())::bigint)::text
    || '_'
    || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 6);

  -- 9. Insert pending payment record
  INSERT INTO public.payments (
    order_id,
    customer_id,
    paystack_reference,
    amount,
    currency,
    status
  ) VALUES (
    v_order.id,
    v_order.customer_id,
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

  v_kobo_amount := pg_catalog.round(v_order.total * 100)::bigint;

  RETURN pg_catalog.jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order.id,
    'reference', v_reference,
    'amount', v_order.total,
    'kobo_amount', v_kobo_amount,
    'currency', 'NGN',
    'customer_email', v_profile.email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_payment_attempt(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_payment_attempt(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_payment_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_payment_attempt(uuid) TO service_role;

-- =============================================================================
-- §5  Atomic Payment Reconciliation Stored Procedure (reconcile_paystack_payment)
-- =============================================================================
-- Hardened with empty search_path, consistent lock hierarchy (orders -> payments),
-- customer ownership verification, currency guards, order transition guards,
-- and atomic concurrency-safe idempotency exception handling.

CREATE OR REPLACE FUNCTION public.reconcile_paystack_payment(
  p_reference text,
  p_paystack_transaction_id text,
  p_kobo_amount bigint,
  p_currency text,
  p_channel text,
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
  v_expected_kobo bigint;
  v_idempotency_key text;
BEGIN
  -- 1. Validate inputs
  IF p_reference IS NULL OR pg_catalog.trim(p_reference) = '' THEN
    RAISE EXCEPTION 'Payment reference is required';
  END IF;

  -- 2. Construct deterministic idempotency key for this gateway event (§13)
  v_idempotency_key := p_reference || ':charge.success:' || pg_catalog.coalesce(p_paystack_transaction_id, 'none');

  -- 3. Fast-exit if event already recorded in audit log (Idempotency Fast-Path)
  IF EXISTS (
    SELECT 1 FROM public.payment_events
    WHERE idempotency_key = v_idempotency_key
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_processed',
      'reference', p_reference,
      'idempotency_key', v_idempotency_key
    );
  END IF;

  -- 4. Lookup payment record to resolve target order_id (§11 Consistent Lock Order)
  SELECT id, order_id INTO v_payment_id, v_order_id
  FROM public.payments
  WHERE paystack_reference = p_reference;

  IF v_payment_id IS NULL THEN
    RAISE EXCEPTION 'Payment reference % not found in database', p_reference;
  END IF;

  -- 5. Lock ORDER first (Lock Order: public.orders -> public.payments)
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % for payment reference % not found', v_order_id, p_reference;
  END IF;

  -- 6. Lock PAYMENT second
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = v_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found during row lock', v_payment_id;
  END IF;

  -- 7. Customer Ownership Consistency Guard (§5)
  -- The payment customer_id must strictly match the order customer_id
  IF v_payment.customer_id IS NOT NULL AND v_payment.customer_id <> v_order.customer_id THEN
    RAISE EXCEPTION 'Customer mismatch: payment customer % does not match order customer %',
      v_payment.customer_id, v_order.customer_id;
  END IF;

  -- 8. Already Successful Check (§12)
  IF v_payment.status = 'successful' THEN
    -- Record duplicate attempt safely under concurrency
    BEGIN
      INSERT INTO public.payment_events (
        payment_id, paystack_reference, event_type, idempotency_key, payload
      ) VALUES (
        v_payment.id, p_reference, 'charge.success.duplicate', v_idempotency_key, p_raw_payload
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

  -- 9. Order Status Transition Guard (§9)
  -- Only payable order states may transition to 'payment_confirmed'
  IF v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing') THEN
    RAISE EXCEPTION 'Cannot reconcile payment: order % is in % status (not payable)',
      v_order.id, v_order.status;
  END IF;

  -- 10. Currency Security Guard (§7)
  -- Validate both Paystack currency and KingdomDash payment record currency
  IF pg_catalog.upper(p_currency) <> 'NGN' THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Rejected invalid currency: ' || p_currency,
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Currency mismatch: expected NGN, received %', p_currency;
  END IF;

  IF pg_catalog.upper(v_payment.currency) <> 'NGN' THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Payment record has invalid currency: ' || v_payment.currency,
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Payment currency mismatch: payment record currency is %', v_payment.currency;
  END IF;

  -- 11. Authoritative Amount Verification (§6)
  -- Exact Kobo conversion from orders.total
  v_expected_kobo := pg_catalog.round(v_order.total * 100)::bigint;

  IF p_kobo_amount <> v_expected_kobo THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Amount mismatch: expected ' || v_expected_kobo || ' kobo, got ' || p_kobo_amount || ' kobo',
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Amount mismatch: expected % kobo, received % kobo', v_expected_kobo, p_kobo_amount;
  END IF;

  -- Also verify payment.amount matches authoritative order total
  IF pg_catalog.round(v_payment.amount * 100)::bigint <> v_expected_kobo THEN
    UPDATE public.payments
    SET status = 'failed',
        gateway_response = 'Payment amount mismatch against order total',
        updated_at = pg_catalog.now()
    WHERE id = v_payment.id;

    RAISE EXCEPTION 'Payment amount mismatch: payment record has %, expected %',
      v_payment.amount, v_order.total;
  END IF;

  -- 12. Mark Payment as Successful
  UPDATE public.payments
  SET status = 'successful',
      paystack_transaction_id = p_paystack_transaction_id,
      channel = p_channel,
      gateway_response = p_gateway_response,
      paid_at = pg_catalog.coalesce(p_paid_at, pg_catalog.now()),
      verified_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  WHERE id = v_payment.id;

  -- 13. Transition Order to 'payment_confirmed'
  UPDATE public.orders
  SET status = 'payment_confirmed',
      updated_at = pg_catalog.now()
  WHERE id = v_order.id;

  -- 14. Record immutable payment event log with Concurrency-Safe Exception Handling (§10)
  BEGIN
    INSERT INTO public.payment_events (
      payment_id, paystack_reference, event_type, idempotency_key, payload
    ) VALUES (
      v_payment.id, p_reference, 'charge.success', v_idempotency_key, p_raw_payload
    );
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent transaction inserted the same event key just before us
    RETURN pg_catalog.jsonb_build_object(
      'status', 'already_processed',
      'reference', p_reference,
      'idempotency_key', v_idempotency_key
    );
  END;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'reconciled',
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'order_status', 'payment_confirmed',
    'payment_status', 'successful'
  );
END;
$$;

-- Security Hardening: Revoke execution from PUBLIC, anon, and authenticated roles.
-- Strictly grant execution only to service_role (used exclusively by Supabase Edge Functions).
REVOKE ALL ON FUNCTION public.reconcile_paystack_payment(text, text, bigint, text, text, text, timestamptz, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_paystack_payment(text, text, bigint, text, text, text, timestamptz, jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.reconcile_paystack_payment(text, text, bigint, text, text, text, timestamptz, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_payment(text, text, bigint, text, text, text, timestamptz, jsonb) TO service_role;
