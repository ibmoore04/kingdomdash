-- ==============================================================================
-- Migration: 20261001000001_settlement_financial_ledgers.sql
-- Module: KingdomDash Automated Settlement & Split-Payment Engine
-- Specification: v1.2.3 Final Hardened Technical Specification (Compliance Hardened)
-- Scope: Migration 1 Core Financial Primitives
--   1. order_financial_snapshots (Immutable Inflow Snapshot & Non-Negative Conservation)
--   2. create_order_financial_snapshot_and_payables RPC (Authoritative Creation & Conflict Detection)
--   3. order_settlement_status (Aggregate Order Settlement State & Monotonic settled_at)
--   4. order_payables (Model A Operational Vendor/Rider Entitlements & Mutation Guards)
--   5. sync_order_settlement_status Trigger (Order-Locked Atomic Upsert)
--   6. payout_transactions (Attempt-Versioned Payout Ledger & SQL State Machine Guard)
--   7. trg_sync_payout_transaction_to_payable Trigger (Authoritative Bridge to Payables)
--   8. settlement_queue (Single-Job-Per-Order Distributed Queue with updated_at)
--   9. platform_float_control & platform_float_reservations (Serialized Float Control)
--  10. platform_float_ledger (Float Audit & Reconciliation Ledger)
--  11. calculate_expected_transfer_cost_kobo Function (Strict Versioned Regulatory Pricing)
--  12. acquire_platform_float_reservation & release_expired_float_reservations RPCs
--  13. can_disburse_payable Function (Authoritative Worker Eligibility Gate)
--  14. order_refunds Table & process_order_refund_request RPC (Idempotent Scenarios A, B, C)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: order_financial_snapshots
-- 100% Immutable Inflow & Allocation Baseline. Once created, updates and deletes are blocked.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  
  -- Customer Pricing Inflow (Canonical Integer Kobo)
  subtotal_kobo bigint NOT NULL CHECK (subtotal_kobo >= 0),
  delivery_fee_kobo bigint NOT NULL CHECK (delivery_fee_kobo >= 0),
  service_fee_kobo bigint NOT NULL DEFAULT 0 CHECK (service_fee_kobo >= 0),
  discount_amount_kobo bigint NOT NULL DEFAULT 0 CHECK (discount_amount_kobo >= 0),
  gross_customer_charge_kobo bigint NOT NULL CHECK (gross_customer_charge_kobo >= 0),
  
  -- Display NGN Generated Columns
  subtotal numeric(12,2) GENERATED ALWAYS AS (subtotal_kobo / 100.0) STORED,
  delivery_fee numeric(12,2) GENERATED ALWAYS AS (delivery_fee_kobo / 100.0) STORED,
  service_fee numeric(12,2) GENERATED ALWAYS AS (service_fee_kobo / 100.0) STORED,
  discount_amount numeric(12,2) GENERATED ALWAYS AS (discount_amount_kobo / 100.0) STORED,
  gross_customer_charge numeric(12,2) GENERATED ALWAYS AS (gross_customer_charge_kobo / 100.0) STORED,
  
  -- Contractual Gross Entitlements
  vendor_gross_kobo bigint NOT NULL CHECK (vendor_gross_kobo >= 0),
  vendor_gross_amount numeric(12,2) GENERATED ALWAYS AS (vendor_gross_kobo / 100.0) STORED,
  
  rider_gross_kobo bigint NOT NULL CHECK (rider_gross_kobo >= 0),
  rider_gross_amount numeric(12,2) GENERATED ALWAYS AS (rider_gross_kobo / 100.0) STORED,
  
  -- Platform Allocation: Must be non-negative. Commercial subsidies cannot be hidden as negative allocation.
  platform_allocated_kobo bigint NOT NULL CHECK (platform_allocated_kobo >= 0),
  platform_allocated_amount numeric(12,2) GENERATED ALWAYS AS (platform_allocated_kobo / 100.0) STORED,
  
  -- Dual Conservation Constraints:
  -- Constraint 1 (Inflow Bridge): Exact monetary kobo captured from customer via Paystack
  CONSTRAINT chk_customer_pricing_bridge CHECK (
    gross_customer_charge_kobo = (subtotal_kobo + delivery_fee_kobo + service_fee_kobo - discount_amount_kobo)
  ),
  
  -- Constraint 2 (Outflow Allocation Bridge): Gross inflow strictly equals Vendor + Rider + Platform Allocation
  CONSTRAINT chk_outflow_conservation CHECK (
    gross_customer_charge_kobo = (vendor_gross_kobo + rider_gross_kobo + platform_allocated_kobo)
  ),
  
  payment_reference text NOT NULL,
  fee_rule_version text NOT NULL DEFAULT '2026-02-18',
  captured_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: Strictly block UPDATE or DELETE operations on financial snapshots
CREATE OR REPLACE FUNCTION public.enforce_order_financial_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL: order_financial_snapshots rows are strictly immutable. Mutating financial history is prohibited.'
    USING ERRCODE = 'KD403';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_financial_snapshots ON public.order_financial_snapshots;
CREATE TRIGGER trg_protect_order_financial_snapshots
  BEFORE UPDATE OR DELETE ON public.order_financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_financial_immutability();

CREATE INDEX IF NOT EXISTS idx_order_financial_snapshots_order_id ON public.order_financial_snapshots(order_id);
CREATE INDEX IF NOT EXISTS idx_order_financial_snapshots_payment_ref ON public.order_financial_snapshots(payment_reference);

ALTER TABLE public.order_financial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all financial snapshots" ON public.order_financial_snapshots;
CREATE POLICY "Admins can view all financial snapshots"
  ON public.order_financial_snapshots FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 2. Table: order_settlement_status
-- Authoritative order-level settlement aggregate, synchronized transactionally.
-- settled_at represents the first historical timestamp when the order became fully settled.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_settlement_status (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  
  overall_status text NOT NULL DEFAULT 'payable_pending'
    CHECK (overall_status IN (
      'payable_pending',     -- Order active, awaiting delivery confirmation
      'settlement_queued',   -- Delivery confirmed, job queued for settlement worker
      'settlement_partial',  -- Exactly one payable is settled; or one/both reopened after reversal
      'settled',             -- BOTH vendor and rider payables are settled (or clawback-offset)
      'disbursement_failed', -- Transfer failed; partner is still owed money (action required)
      'refund_pending',      -- Refund requested/in-flight; settlement blocked awaiting Paystack confirmation
      'refunded',            -- Full order refund confirmed processed by Paystack (liability discharged)
      'disputed'             -- Post-settlement customer dispute raised
    )),
    
  vendor_status text NOT NULL DEFAULT 'payable_pending',
  rider_status text NOT NULL DEFAULT 'payable_pending',
  settled_at timestamptz,       -- First timestamp order achieved full settlement (never overwritten with NULL)
  reopened_at timestamptz,      -- First timestamp payout liability reopens after NIBSS reversal (monotonic)
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Structural aggregate consistency guard: overall_status cannot be settled unless both payables are settled
  CONSTRAINT chk_settled_overall_consistency CHECK (
    overall_status != 'settled' OR (
      vendor_status IN ('settled', 'clawback_offset') AND 
      rider_status IN ('settled', 'clawback_offset')
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_order_settlement_status_overall ON public.order_settlement_status(overall_status);

ALTER TABLE public.order_settlement_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view order settlement status" ON public.order_settlement_status;
CREATE POLICY "Admins can view order settlement status"
  ON public.order_settlement_status FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 3. Table: order_payables
-- Model A Operational Vendor & Rider Entitlements.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  recipient_type text NOT NULL CHECK (recipient_type IN ('vendor', 'rider')),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  
  -- Entitlement Math (Canonical Integer Kobo)
  gross_entitlement_kobo bigint NOT NULL CHECK (gross_entitlement_kobo >= 0),
  receivable_deduction_kobo bigint NOT NULL DEFAULT 0 CHECK (receivable_deduction_kobo >= 0),
  net_payable_kobo bigint NOT NULL CHECK (net_payable_kobo >= 0),
  
  -- Display NGN Generated Columns
  gross_entitlement numeric(12,2) GENERATED ALWAYS AS (gross_entitlement_kobo / 100.0) STORED,
  receivable_deduction numeric(12,2) GENERATED ALWAYS AS (receivable_deduction_kobo / 100.0) STORED,
  net_payable numeric(12,2) GENERATED ALWAYS AS (net_payable_kobo / 100.0) STORED,
  
  status text NOT NULL DEFAULT 'payable_pending'
    CHECK (status IN (
      'payable_pending',    -- Created at payment verification, awaiting PIN confirmation
      'settlement_queued',  -- PIN confirmed, queued for worker disbursement
      'disbursing',         -- Worker has initiated transfer; awaiting Paystack finality
      'settled',            -- Paystack transfer.success confirmed via webhook
      'failed',             -- Terminal payout failure (invalid bank, rejected); obligation persists
      'payable_reopened',   -- Transfer was settled, but reversed by NIBSS; liability re-opened
      'clawback_offset',    -- Net payable was 0 because 100% was offset to recover past debt
      'cancelled'           -- Legitimate pre-disbursement administrative voiding
    )),
    
  last_error text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_order_payable_recipient UNIQUE (order_id, recipient_type),
  CONSTRAINT chk_payable_kobo_balance CHECK (net_payable_kobo = (gross_entitlement_kobo - receivable_deduction_kobo))
);

-- Trigger: Guard immutability of payable entitlement and state transition legality
CREATE OR REPLACE FUNCTION public.guard_order_payable_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 1. DELETE Protection: Payables represent permanent contractual obligations
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'order_payables rows are strictly permanent. Deleting payables is prohibited.'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Identity and contractual gross entitlement fields are strictly immutable
  IF NEW.order_id != OLD.order_id OR
     NEW.recipient_type != OLD.recipient_type OR
     NEW.recipient_id != OLD.recipient_id OR
     NEW.gross_entitlement_kobo != OLD.gross_entitlement_kobo THEN
    RAISE EXCEPTION 'Identity and gross entitlement fields on order_payables are strictly immutable'
      USING ERRCODE = 'KD403';
  END IF;

  -- 3. Exhaustive State Transition Matrix
  IF OLD.status != NEW.status THEN
    IF OLD.status = 'payable_pending' AND NEW.status IN ('settlement_queued', 'cancelled', 'clawback_offset') THEN
      NULL; -- Allowed
    ELSIF OLD.status = 'settlement_queued' AND NEW.status IN ('disbursing', 'cancelled', 'clawback_offset') THEN
      NULL; -- Allowed
    ELSIF OLD.status = 'disbursing' AND NEW.status IN ('settled', 'failed') THEN
      NULL; -- Allowed
    ELSIF OLD.status = 'settled' AND NEW.status IN ('payable_reopened') THEN
      NULL; -- Allowed (strictly reserved for NIBSS reversals)
    ELSIF OLD.status = 'failed' AND NEW.status IN ('settlement_queued', 'disbursing', 'settled', 'cancelled') THEN
      NULL; -- Allowed
    ELSIF OLD.status = 'payable_reopened' AND NEW.status IN ('settlement_queued', 'disbursing', 'settled') THEN
      NULL; -- Allowed
    ELSE
      RAISE EXCEPTION 'Illegal state transition on order_payables: % -> % is prohibited.', OLD.status, NEW.status
        USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 4. Receivable deductions can only be adjusted pre-disbursement and cannot exceed gross entitlement.
  -- NOTE ON AUDIT BOUNDARY: Full automated receivable recovery/clawback auditing belongs to Migration 2/3.
  -- Migration 1 enforces the mathematical invariant and restricts deduction modifications to un-disbursed payables.
  IF NEW.receivable_deduction_kobo != OLD.receivable_deduction_kobo THEN
    IF OLD.status NOT IN ('payable_pending', 'settlement_queued') THEN
      RAISE EXCEPTION 'CRITICAL: receivable_deduction_kobo cannot be modified once disbursement has begun (status: %).', OLD.status
        USING ERRCODE = 'KD409';
    END IF;
    IF NEW.receivable_deduction_kobo > NEW.gross_entitlement_kobo THEN
      RAISE EXCEPTION 'CRITICAL: receivable_deduction_kobo (%) cannot exceed gross_entitlement_kobo (%).',
        NEW.receivable_deduction_kobo, NEW.gross_entitlement_kobo USING ERRCODE = 'KD400';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payable_mutations ON public.order_payables;
CREATE TRIGGER trg_guard_order_payable_mutations
  BEFORE UPDATE OR DELETE ON public.order_payables
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_payable_mutations();

CREATE INDEX IF NOT EXISTS idx_order_payables_order_id ON public.order_payables(order_id);
CREATE INDEX IF NOT EXISTS idx_order_payables_recipient ON public.order_payables(recipient_id);
CREATE INDEX IF NOT EXISTS idx_order_payables_status ON public.order_payables(status);

ALTER TABLE public.order_payables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view their own payables" ON public.order_payables;
CREATE POLICY "Partners can view their own payables"
  ON public.order_payables FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid() OR public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 4. Trigger Function: sync_order_settlement_status
-- Recalculates order_settlement_status across both children with order serialization.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_order_settlement_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_v_status text;
  v_r_status text;
  v_new_overall text;
  v_is_v_settled boolean;
  v_is_r_settled boolean;
  v_has_reopened boolean;
  v_existing_overall text;
  v_existing_settled_at timestamptz;
  v_existing_reopened_at timestamptz;
  v_new_settled_at timestamptz;
  v_new_reopened_at timestamptz := NULL;
BEGIN
  -- 1. CONCURRENCY SERIALIZATION: Lock the parent order row
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR UPDATE;

  -- 2. Read existing order settlement status if present
  SELECT overall_status, settled_at, reopened_at 
  INTO v_existing_overall, v_existing_settled_at, v_existing_reopened_at
  FROM public.order_settlement_status
  WHERE order_id = NEW.order_id;

  -- 3. Read complete state of both payables
  SELECT status INTO v_v_status 
  FROM public.order_payables 
  WHERE order_id = NEW.order_id AND recipient_type = 'vendor';

  SELECT status INTO v_r_status 
  FROM public.order_payables 
  WHERE order_id = NEW.order_id AND recipient_type = 'rider';

  v_is_v_settled := (v_v_status IN ('settled', 'clawback_offset'));
  v_is_r_settled := (v_r_status IN ('settled', 'clawback_offset'));
  v_has_reopened := (v_v_status = 'payable_reopened' OR v_r_status = 'payable_reopened');

  -- 4. Deterministic Mapping Matrix with Terminal State Preservation
  -- Authoritative terminal order-level states (refunded, disputed) cannot be downgraded by child payable sync.
  IF v_existing_overall IN ('refunded', 'disputed') THEN
    v_new_overall := v_existing_overall;
  ELSIF (v_v_status = 'cancelled') AND (v_r_status = 'cancelled') THEN
    v_new_overall := 'refund_pending';
  ELSIF v_has_reopened THEN
    v_new_overall := 'settlement_partial';
  ELSIF v_is_v_settled AND v_is_r_settled THEN
    v_new_overall := 'settled';
  ELSIF v_is_v_settled OR v_is_r_settled THEN
    v_new_overall := 'settlement_partial';
  ELSIF (v_v_status = 'failed') AND (v_r_status = 'failed') THEN
    v_new_overall := 'disbursement_failed';
  ELSIF (v_v_status = 'failed') OR (v_r_status = 'failed') THEN
    v_new_overall := 'settlement_partial';
  ELSIF (v_v_status = 'settlement_queued') OR (v_r_status = 'settlement_queued') THEN
    v_new_overall := 'settlement_queued';
  ELSIF (v_v_status = 'disbursing') OR (v_r_status = 'disbursing') THEN
    v_new_overall := 'settlement_queued';
  ELSE
    v_new_overall := 'payable_pending';
  END IF;

  -- 5. Monotonic Sticky settled_at & reopened_at Calculation
  IF v_existing_settled_at IS NOT NULL THEN
    v_new_settled_at := v_existing_settled_at; -- Monotonic: NEVER overwrite with NULL
  ELSIF v_new_overall = 'settled' THEN
    v_new_settled_at := now();
  ELSE
    v_new_settled_at := NULL;
  END IF;

  IF v_existing_reopened_at IS NOT NULL THEN
    v_new_reopened_at := v_existing_reopened_at; -- Monotonic: preserve the first historical reopen timestamp
  ELSIF v_has_reopened THEN
    v_new_reopened_at := now();
  ELSE
    v_new_reopened_at := NULL;
  END IF;

  -- 5. Atomic UPSERT
  INSERT INTO public.order_settlement_status (
    order_id,
    overall_status,
    vendor_status,
    rider_status,
    settled_at,
    reopened_at,
    updated_at
  ) VALUES (
    NEW.order_id,
    v_new_overall,
    COALESCE(v_v_status, 'payable_pending'),
    COALESCE(v_r_status, 'payable_pending'),
    v_new_settled_at,
    v_new_reopened_at,
    now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    overall_status = EXCLUDED.overall_status,
    vendor_status  = EXCLUDED.vendor_status,
    rider_status   = EXCLUDED.rider_status,
    settled_at     = EXCLUDED.settled_at,
    reopened_at    = COALESCE(public.order_settlement_status.reopened_at, EXCLUDED.reopened_at),
    updated_at     = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_settlement_status ON public.order_payables;
CREATE TRIGGER trg_sync_order_settlement_status
  AFTER INSERT OR UPDATE OF status ON public.order_payables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_settlement_status();

-- ------------------------------------------------------------------------------
-- 5. RPC: create_order_financial_snapshot_and_payables
-- Authoritative creation boundary for financial facts.
-- Enforces input validation and detects conflicting payload replays.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order_financial_snapshot_and_payables(
  p_order_id uuid,
  p_payment_reference text,
  p_subtotal_kobo bigint,
  p_delivery_fee_kobo bigint,
  p_service_fee_kobo bigint DEFAULT NULL,
  p_discount_amount_kobo bigint DEFAULT 0,
  p_vendor_gross_kobo bigint DEFAULT 0,
  p_rider_gross_kobo bigint DEFAULT 0,
  p_vendor_profile_id uuid DEFAULT NULL,
  p_rider_profile_id uuid DEFAULT NULL,
  p_fee_rule_version text DEFAULT '2026-02-18'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_existing_snap record;
  v_gross_charge_kobo bigint;
  v_platform_allocated_kobo bigint;
  v_vendor_exists boolean;
  v_rider_exists boolean;
  v_order record;
  v_order_service_fee_kobo bigint;
  v_effective_service_fee_kobo bigint;
BEGIN
  -- Strict Access Control
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only payment verification service can create financial snapshots' USING ERRCODE = 'KD403';
  END IF;

  -- Input Validation: Zero or positive amounts
  IF p_subtotal_kobo < 0 OR p_delivery_fee_kobo < 0 OR (p_service_fee_kobo IS NOT NULL AND p_service_fee_kobo < 0)
     OR p_discount_amount_kobo < 0 OR p_vendor_gross_kobo < 0 OR p_rider_gross_kobo < 0 THEN
    RAISE EXCEPTION 'Financial parameters must be non-negative integers' USING ERRCODE = 'KD400';
  END IF;

  -- 1. CONCURRENCY SERIALIZATION & ORDER RECORD LOCKING
  -- Exclusively lock the parent order row to serialize concurrent payment processing
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not exist', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- 2. Bridging Operational Pricing Quote to Ledger Authority:
  -- Derive authoritative service fee from the order record (orders.service_fee NGN -> kobo)
  IF (to_jsonb(v_order) ? 'service_fee') AND (to_jsonb(v_order)->>'service_fee') IS NOT NULL THEN
    v_order_service_fee_kobo := ROUND(((to_jsonb(v_order)->>'service_fee')::numeric) * 100)::bigint;
    
    -- If caller supplied p_service_fee_kobo, verify strict equality with authoritative order price
    IF p_service_fee_kobo IS NOT NULL AND p_service_fee_kobo != v_order_service_fee_kobo THEN
      RAISE EXCEPTION 'Financial reconciliation conflict: snapshot service_fee_kobo (%) does not match order service_fee (kobo: %)',
        p_service_fee_kobo, v_order_service_fee_kobo USING ERRCODE = 'KD409';
    END IF;
    v_effective_service_fee_kobo := v_order_service_fee_kobo;
  ELSE
    -- Legacy/Pre-migration fallback: use supplied p_service_fee_kobo or 0
    v_effective_service_fee_kobo := COALESCE(p_service_fee_kobo, 0);
  END IF;

  -- 3. Strict Operational-to-Financial Cross-Validation:
  -- Subtotal and Delivery Fee cannot drift between order record and financial snapshot
  IF v_order.subtotal IS NOT NULL AND p_subtotal_kobo != ROUND(v_order.subtotal * 100)::bigint THEN
    RAISE EXCEPTION 'Financial reconciliation conflict: snapshot subtotal_kobo (%) does not match order subtotal (kobo: %)',
      p_subtotal_kobo, ROUND(v_order.subtotal * 100)::bigint USING ERRCODE = 'KD409';
  END IF;

  IF v_order.delivery_fee IS NOT NULL AND p_delivery_fee_kobo != ROUND(v_order.delivery_fee * 100)::bigint THEN
    RAISE EXCEPTION 'Financial reconciliation conflict: snapshot delivery_fee_kobo (%) does not match order delivery_fee (kobo: %)',
      p_delivery_fee_kobo, ROUND(v_order.delivery_fee * 100)::bigint USING ERRCODE = 'KD409';
  END IF;

  -- Role Integrity: Enforce that profiles match the designated contractual roles
  IF p_vendor_profile_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_vendor_profile_id AND role = 'vendor') INTO v_vendor_exists;
    IF NOT v_vendor_exists THEN
      RAISE EXCEPTION 'Vendor profile % does not exist or does not possess the vendor role', p_vendor_profile_id USING ERRCODE = 'KD404';
    END IF;
  END IF;

  IF p_rider_profile_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = p_rider_profile_id AND role = 'rider') INTO v_rider_exists;
    IF NOT v_rider_exists THEN
      RAISE EXCEPTION 'Rider profile % does not exist or does not possess the rider role', p_rider_profile_id USING ERRCODE = 'KD404';
    END IF;
  END IF;

  v_gross_charge_kobo := (p_subtotal_kobo + p_delivery_fee_kobo + v_effective_service_fee_kobo - p_discount_amount_kobo);
  IF v_gross_charge_kobo < 0 THEN
    RAISE EXCEPTION 'Net customer charge cannot be negative' USING ERRCODE = 'KD400';
  END IF;

  v_platform_allocated_kobo := v_gross_charge_kobo - (p_vendor_gross_kobo + p_rider_gross_kobo);
  IF v_platform_allocated_kobo < 0 THEN
    RAISE EXCEPTION 'Commercial constraint violation: vendor (%) + rider (%) exceeds gross customer charge (%)',
      p_vendor_gross_kobo, p_rider_gross_kobo, v_gross_charge_kobo USING ERRCODE = 'KD400';
  END IF;

  -- Check existing snapshot for idempotency vs conflict
  SELECT * INTO v_existing_snap 
  FROM public.order_financial_snapshots 
  WHERE order_id = p_order_id;

  IF FOUND THEN
    IF v_existing_snap.subtotal_kobo = p_subtotal_kobo AND
       v_existing_snap.delivery_fee_kobo = p_delivery_fee_kobo AND
       v_existing_snap.service_fee_kobo = v_effective_service_fee_kobo AND
       v_existing_snap.discount_amount_kobo = p_discount_amount_kobo AND
       v_existing_snap.gross_customer_charge_kobo = v_gross_charge_kobo AND
       v_existing_snap.vendor_gross_kobo = p_vendor_gross_kobo AND
       v_existing_snap.rider_gross_kobo = p_rider_gross_kobo AND
       v_existing_snap.payment_reference = p_payment_reference AND
       v_existing_snap.fee_rule_version = p_fee_rule_version THEN
      
      -- Verify existing payables match contractual recipient identities
      DECLARE
        v_existing_vendor_id uuid;
        v_existing_rider_id uuid;
      BEGIN
        SELECT recipient_id INTO v_existing_vendor_id 
        FROM public.order_payables 
        WHERE order_id = p_order_id AND recipient_type = 'vendor';

        SELECT recipient_id INTO v_existing_rider_id 
        FROM public.order_payables 
        WHERE order_id = p_order_id AND recipient_type = 'rider';

        IF (v_existing_vendor_id IS DISTINCT FROM p_vendor_profile_id) OR (v_existing_rider_id IS DISTINCT FROM p_rider_profile_id) THEN
          RAISE EXCEPTION 'Financial snapshot conflict: recipient profile IDs do not match existing payables'
            USING ERRCODE = 'KD409';
        END IF;

        RETURN jsonb_build_object('success', true, 'idempotent_replay', true, 'order_id', p_order_id);
      END;
    ELSE
      RAISE EXCEPTION 'Financial snapshot conflict: order % already has an immutable snapshot with different monetary values or rule version',
        p_order_id USING ERRCODE = 'KD409';
    END IF;
  END IF;

  -- 1. Insert financial snapshot
  INSERT INTO public.order_financial_snapshots (
    order_id, subtotal_kobo, delivery_fee_kobo, service_fee_kobo, discount_amount_kobo,
    gross_customer_charge_kobo, vendor_gross_kobo, rider_gross_kobo, platform_allocated_kobo,
    payment_reference, fee_rule_version, captured_at
  ) VALUES (
    p_order_id, p_subtotal_kobo, p_delivery_fee_kobo, v_effective_service_fee_kobo, p_discount_amount_kobo,
    v_gross_charge_kobo, p_vendor_gross_kobo, p_rider_gross_kobo, v_platform_allocated_kobo,
    p_payment_reference, p_fee_rule_version, now()
  );

  -- 2. Insert vendor payable
  INSERT INTO public.order_payables (
    order_id, recipient_type, recipient_id, gross_entitlement_kobo, receivable_deduction_kobo,
    net_payable_kobo, status
  ) VALUES (
    p_order_id, 'vendor', p_vendor_profile_id, p_vendor_gross_kobo, 0,
    p_vendor_gross_kobo, 'payable_pending'
  );

  -- 3. Insert rider payable
  INSERT INTO public.order_payables (
    order_id, recipient_type, recipient_id, gross_entitlement_kobo, receivable_deduction_kobo,
    net_payable_kobo, status
  ) VALUES (
    p_order_id, 'rider', p_rider_profile_id, p_rider_gross_kobo, 0,
    p_rider_gross_kobo, 'payable_pending'
  );

  RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_financial_snapshot_and_payables FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_financial_snapshot_and_payables TO service_role;

-- ------------------------------------------------------------------------------
-- 6. Regulatory Versioned Pricing: calculate_expected_transfer_cost_kobo
-- Strict Versioned Calculation: Unsupported rule versions are rejected.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_expected_transfer_cost_kobo(
  p_amount_kobo bigint,
  p_rule_version text DEFAULT '2026-02-18',
  OUT expected_fee_kobo bigint,
  OUT expected_stamp_duty_kobo bigint,
  OUT expected_total_debit_kobo bigint,
  OUT applied_rule_version text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_amount_kobo < 0 THEN
    RAISE EXCEPTION 'Transfer amount cannot be negative'
      USING ERRCODE = 'KD400';
  END IF;

  IF p_rule_version NOT IN ('2026-02-18') THEN
    RAISE EXCEPTION 'Unsupported fee rule version: %. Active regulatory version is 2026-02-18.', p_rule_version 
      USING ERRCODE = 'KD400';
  END IF;

  applied_rule_version := p_rule_version;

  -- Paystack Nigeria Pricing (Rule 2026-02-18)
  IF p_amount_kobo <= 500000 THEN
    expected_fee_kobo := 1000;    -- ₦10.00 for <= ₦5,000
  ELSIF p_amount_kobo <= 5000000 THEN
    expected_fee_kobo := 2500;    -- ₦25.00 for ₦5,001 - ₦50,000
  ELSE
    expected_fee_kobo := 5000;    -- ₦50.00 for > ₦50,000
  END IF;

  -- Statutory EMTL Stamp Duty (Statutory from Feb 18, 2026)
  IF p_amount_kobo >= 1000000 THEN
    expected_stamp_duty_kobo := 5000; -- ₦50.00 for >= ₦10,000
  ELSE
    expected_stamp_duty_kobo := 0;
  END IF;

  expected_total_debit_kobo := p_amount_kobo + expected_fee_kobo + expected_stamp_duty_kobo;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Table: payout_transactions
-- Attempt-versioned payout ledger with strict state-machine and financial-field immutability guards.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payable_id uuid NOT NULL REFERENCES public.order_payables(id) ON DELETE RESTRICT,
  attempt_number integer NOT NULL CHECK (attempt_number >= 1),
  
  -- Paystack Reference (16-50 chars): kd_ord_<uuid32>_<type>_v{attempt}
  transfer_reference text NOT NULL UNIQUE CHECK (
    char_length(transfer_reference) >= 16 
    AND char_length(transfer_reference) <= 50
    AND transfer_reference ~ '^[a-z0-9_-]+$'
  ),
  
  paystack_transfer_code text UNIQUE,
  paystack_recipient_code text NOT NULL,
  
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  amount numeric(12,2) GENERATED ALWAYS AS (amount_kobo / 100.0) STORED,
  
  -- Regulatory Rule Version & Cost Isolation (Absorbed by platform_allocated_kobo)
  fee_rule_version text NOT NULL DEFAULT '2026-02-18',
  expected_transfer_fee_kobo bigint NOT NULL DEFAULT 0 CHECK (expected_transfer_fee_kobo >= 0),
  expected_stamp_duty_kobo bigint NOT NULL DEFAULT 0 CHECK (expected_stamp_duty_kobo >= 0),
  actual_transfer_fee_kobo bigint CHECK (actual_transfer_fee_kobo >= 0),
  actual_stamp_duty_kobo bigint CHECK (actual_stamp_duty_kobo >= 0),
  
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'reversed')),
    
  failure_reason text,
  reversed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_payout_payable_attempt UNIQUE (payable_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_payout_tx_reference ON public.payout_transactions(transfer_reference);
CREATE INDEX IF NOT EXISTS idx_payout_tx_transfer_code ON public.payout_transactions(paystack_transfer_code);
CREATE INDEX IF NOT EXISTS idx_payout_tx_payable_id ON public.payout_transactions(payable_id);

-- Payout Transactions Immutability and State Machine Guard
CREATE OR REPLACE FUNCTION public.guard_payout_transaction_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 1. DELETE Protection: payout_transactions are strictly append-only
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payout_transactions rows are strictly append-only. DELETE is prohibited.'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Protect immutable financial baseline, recipient, and rule version fields
  IF NEW.amount_kobo != OLD.amount_kobo OR
     NEW.payable_id != OLD.payable_id OR
     NEW.attempt_number != OLD.attempt_number OR
     NEW.transfer_reference != OLD.transfer_reference OR
     NEW.paystack_recipient_code != OLD.paystack_recipient_code OR
     NEW.fee_rule_version != OLD.fee_rule_version OR
     NEW.expected_transfer_fee_kobo != OLD.expected_transfer_fee_kobo OR
     NEW.expected_stamp_duty_kobo != OLD.expected_stamp_duty_kobo THEN
    RAISE EXCEPTION 'Financial, rule version, recipient code, and reference fields on payout_transactions are strictly immutable'
      USING ERRCODE = 'KD403';
  END IF;

  -- 3. Paystack transfer code cannot be altered once set
  IF OLD.paystack_transfer_code IS NOT NULL AND NEW.paystack_transfer_code != OLD.paystack_transfer_code THEN
    RAISE EXCEPTION 'paystack_transfer_code is immutable once set' USING ERRCODE = 'KD403';
  END IF;

  -- 4. State Machine Transitions
  IF OLD.status != NEW.status THEN
    IF OLD.status = 'pending' AND NEW.status IN ('success', 'failed', 'reversed') THEN
      NULL; -- Allowed
    ELSIF OLD.status = 'success' AND NEW.status = 'reversed' THEN
      NULL; -- Allowed (NIBSS reversal)
    ELSE
      RAISE EXCEPTION 'Illegal payout transaction state transition: % -> % is strictly prohibited.', OLD.status, NEW.status
        USING ERRCODE = 'KD409';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payout_transaction_mutations ON public.payout_transactions;
CREATE TRIGGER trg_guard_payout_transaction_mutations
  BEFORE UPDATE OR DELETE ON public.payout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_payout_transaction_mutations();

-- ------------------------------------------------------------------------------
-- 8. Trigger: Authoritative Bridge between payout_transactions and order_payables
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_payout_transaction_to_payable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE public.order_payables
    SET status = 'settled',
        settled_at = COALESCE(settled_at, now()),
        updated_at = now()
    WHERE id = NEW.payable_id AND status != 'settled';
  ELSIF NEW.status = 'reversed' THEN
    UPDATE public.order_payables
    SET status = 'payable_reopened',
        updated_at = now()
    WHERE id = NEW.payable_id;
  ELSIF NEW.status = 'failed' THEN
    -- Only update payable to failed if no active or successful attempts remain
    IF NOT EXISTS (
      SELECT 1 FROM public.payout_transactions 
      WHERE payable_id = NEW.payable_id AND id != NEW.id AND status IN ('pending', 'success')
    ) THEN
      UPDATE public.order_payables
      SET status = CASE 
                     -- Preserve payable_reopened semantic: a failed retry attempt on a reversed payout
                     -- does not erase the fact that this liability originated from a NIBSS reversal.
                     -- The payable remains payable_reopened until another attempt succeeds.
                     WHEN status = 'payable_reopened' THEN 'payable_reopened'
                     ELSE 'failed'
                   END,
          last_error = NEW.failure_reason,
          updated_at = now()
      WHERE id = NEW.payable_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payout_transaction_to_payable ON public.payout_transactions;
CREATE TRIGGER trg_sync_payout_transaction_to_payable
  AFTER UPDATE OF status ON public.payout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_payout_transaction_to_payable();

ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view payout transactions" ON public.payout_transactions;
CREATE POLICY "Admins can view payout transactions"
  ON public.payout_transactions FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 9. Table: settlement_queue
-- Exactly 1 row per order for its entire lifetime.
-- Includes updated_at column and automatic update trigger.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',         -- Ready for worker claim
      'processing',      -- Leased by active worker (90s worker lease)
      'completed',       -- BOTH payables fully satisfied (settled or clawback_offset)
      'retry_ready',     -- Temporary network error; ready for re-claim
      'held_float',      -- Insufficient platform float (balance + fee buffer); waiting retry
      'held_cooldown',   -- Partner within 24-hour payout hold or in-flight refund freeze
      'action_required', -- Payout failed permanently; obligation persists, requires operator
      'cancelled'        -- Order canceled/refunded before disbursement
    )),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  
  -- Distributed Leasing Primitives (90-second Worker Lease)
  locked_by text,
  locked_until timestamptz,
  last_heartbeat_at timestamptz,
  
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_settlement_queue_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_settlement_queue_updated_at ON public.settlement_queue;
CREATE TRIGGER trg_settlement_queue_updated_at
  BEFORE UPDATE ON public.settlement_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.set_settlement_queue_updated_at();

CREATE INDEX IF NOT EXISTS idx_settlement_queue_claim 
  ON public.settlement_queue (status, scheduled_at) 
  WHERE status IN ('pending', 'retry_ready');

CREATE INDEX IF NOT EXISTS idx_settlement_queue_order_id ON public.settlement_queue(order_id);

ALTER TABLE public.settlement_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view settlement queue" ON public.settlement_queue;
CREATE POLICY "Admins can view settlement queue"
  ON public.settlement_queue FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 10. Tables: platform_float_control, platform_float_reservations, platform_float_ledger
-- Serialized float control with 60s cache max age, independent 5m reservation TTL, and audit ledger.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_float_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  last_polled_balance_kobo bigint NOT NULL DEFAULT 0,
  last_polled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_float_control (id, last_polled_balance_kobo)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.platform_float_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payable_id uuid NOT NULL REFERENCES public.order_payables(id) ON DELETE RESTRICT,
  reserved_amount_kobo bigint NOT NULL CHECK (reserved_amount_kobo > 0),
  fee_rule_version text NOT NULL DEFAULT '2026-02-18',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  expires_at timestamptz NOT NULL, -- Independent 5-minute reservation TTL
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_float_reservation_active_payable 
  ON public.platform_float_reservations (payable_id) 
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_float_reservations_worker ON public.platform_float_reservations(worker_id);
CREATE INDEX IF NOT EXISTS idx_float_reservations_order_id ON public.platform_float_reservations(order_id);

CREATE TABLE IF NOT EXISTS public.platform_float_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('poll_sync', 'reservation_claimed', 'transfer_debited', 'reservation_released')),
  order_id uuid REFERENCES public.orders(id),
  payable_id uuid REFERENCES public.order_payables(id),
  amount_kobo bigint NOT NULL,
  fee_kobo bigint NOT NULL DEFAULT 0,
  stamp_duty_kobo bigint NOT NULL DEFAULT 0,
  balance_after_kobo bigint NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_float_ledger_created ON public.platform_float_ledger(created_at);

-- Trigger: Strictly block UPDATE or DELETE operations on platform float ledger (append-only)
CREATE OR REPLACE FUNCTION public.enforce_platform_float_ledger_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL: platform_float_ledger rows are strictly append-only. Mutating or deleting float audit logs is prohibited.'
    USING ERRCODE = 'KD403';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_platform_float_ledger ON public.platform_float_ledger;
CREATE TRIGGER trg_protect_platform_float_ledger
  BEFORE UPDATE OR DELETE ON public.platform_float_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_platform_float_ledger_immutability();

ALTER TABLE public.platform_float_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_float_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_float_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view float control" ON public.platform_float_control;
CREATE POLICY "Admins can view float control"
  ON public.platform_float_control FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Admins can view float reservations" ON public.platform_float_reservations;
CREATE POLICY "Admins can view float reservations"
  ON public.platform_float_reservations FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

DROP POLICY IF EXISTS "Admins can view float ledger" ON public.platform_float_ledger;
CREATE POLICY "Admins can view float ledger"
  ON public.platform_float_ledger FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

-- ------------------------------------------------------------------------------
-- 11. RPCs: acquire_platform_float_reservation & release_expired_float_reservations
-- Database-enforced atomic float reservation with stale-balance and expiration protections.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_expired_float_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_released_count integer := 0;
  v_rec record;
  v_current_bal bigint;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'KD403';
  END IF;

  SELECT last_polled_balance_kobo INTO v_current_bal 
  FROM public.platform_float_control WHERE id = true FOR UPDATE;

  FOR v_rec IN (
    SELECT * FROM public.platform_float_reservations 
    WHERE status = 'active' AND expires_at < now()
    FOR UPDATE
  ) LOOP
    UPDATE public.platform_float_reservations 
    SET status = 'released' 
    WHERE id = v_rec.id;

    INSERT INTO public.platform_float_ledger (
      event_type, order_id, payable_id, amount_kobo, balance_after_kobo, notes
    ) VALUES (
      'reservation_released', v_rec.order_id, v_rec.payable_id, v_rec.reserved_amount_kobo, v_current_bal,
      format('Expired reservation auto-released (TTL: %s)', v_rec.expires_at)
    );

    v_released_count := v_released_count + 1;
  END LOOP;

  RETURN v_released_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.acquire_platform_float_reservation(
  p_worker_id text,
  p_order_id uuid,
  p_payable_id uuid,
  p_net_payable_kobo bigint,
  p_rule_version text DEFAULT '2026-02-18'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_balance_kobo bigint;
  v_polled_at timestamptz;
  v_active_reserved_kobo bigint;
  v_available_float_kobo bigint;
  v_required_debit_kobo bigint;
  v_expected_fee bigint;
  v_expected_duty bigint;
  v_reservation_id uuid;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'KD403';
  END IF;

  -- Validate net payable > 0: zero-value or negative payables must never reserve platform float
  IF p_net_payable_kobo <= 0 THEN
    RAISE EXCEPTION 'Net payable must be greater than zero to reserve float'
      USING ERRCODE = 'KD400';
  END IF;

  -- 1. Lock singleton float control row
  SELECT last_polled_balance_kobo, last_polled_at 
  INTO v_balance_kobo, v_polled_at
  FROM public.platform_float_control
  WHERE id = true
  FOR UPDATE;

  -- 2. HARD STALE BALANCE INVARIANT (60 Seconds)
  IF (now() - v_polled_at) > interval '60 seconds' THEN
    RAISE EXCEPTION 'Stale float balance: last polled % ago. Worker must refresh Paystack balance.',
      (now() - v_polled_at) USING ERRCODE = 'KD409';
  END IF;

  -- 3. Release any expired reservations
  PERFORM public.release_expired_float_reservations();

  -- 4. Calculate uncommitted float
  SELECT COALESCE(SUM(reserved_amount_kobo), 0) INTO v_active_reserved_kobo
  FROM public.platform_float_reservations
  WHERE status = 'active';

  v_available_float_kobo := v_balance_kobo - v_active_reserved_kobo;

  -- 5. Calculate expected transfer costs
  SELECT expected_fee_kobo, expected_stamp_duty_kobo, expected_total_debit_kobo
  INTO v_expected_fee, v_expected_duty, v_required_debit_kobo
  FROM public.calculate_expected_transfer_cost_kobo(p_net_payable_kobo, p_rule_version);

  -- 6. Verify sufficiency
  IF v_available_float_kobo < v_required_debit_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_float',
      'available_float_kobo', v_available_float_kobo,
      'required_debit_kobo', v_required_debit_kobo
    );
  END IF;

  -- 7. Insert reservation with independent 5-minute TTL
  INSERT INTO public.platform_float_reservations (
    worker_id, order_id, payable_id, reserved_amount_kobo, fee_rule_version, status, expires_at
  ) VALUES (
    p_worker_id, p_order_id, p_payable_id, v_required_debit_kobo, p_rule_version, 'active', now() + interval '5 minutes'
  )
  RETURNING id INTO v_reservation_id;

  -- 8. Record audit event
  INSERT INTO public.platform_float_ledger (
    event_type, order_id, payable_id, amount_kobo, fee_kobo, stamp_duty_kobo, balance_after_kobo, notes
  ) VALUES (
    'reservation_claimed', p_order_id, p_payable_id, p_net_payable_kobo, v_expected_fee, v_expected_duty,
    (v_available_float_kobo - v_required_debit_kobo), format('Reservation %s claimed by %s', v_reservation_id, p_worker_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'reserved_amount_kobo', v_required_debit_kobo,
    'fee_kobo', v_expected_fee,
    'stamp_duty_kobo', v_expected_duty,
    'expires_at', (now() + interval '5 minutes')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_expired_float_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_platform_float_reservation FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_float_reservations TO service_role;
GRANT EXECUTE ON FUNCTION public.acquire_platform_float_reservation TO service_role;

-- ------------------------------------------------------------------------------
-- 12. Table: order_refunds & RPC: process_order_refund_request
-- Scenarios A, B, and C refund request creation and settlement guarding.
-- NOTE ON ARCHITECTURAL BOUNDARY:
-- Migration 1 is responsible for creating the refund request, recording the scenario,
-- voiding/cancelling payables and queue in Scenario A, and freezing the queue with a
-- deterministic cooldown in Scenario B.
-- The downstream Paystack refund webhook/worker migration (Migration 2+) is responsible
-- for executing the Paystack refund API call, processing refund webhooks, transitioning
-- refund status to 'processed'/'failed'/'rejected', transitioning overall_status from
-- 'refund_pending' to 'refunded' upon confirmed Paystack credit, and activating partner
-- clawback debt (partner_receivables) ONLY after confirmed refund success.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  refund_request_key text NOT NULL UNIQUE,
  refund_amount_kobo bigint NOT NULL CHECK (refund_amount_kobo > 0),
  refund_amount numeric(12,2) GENERATED ALWAYS AS (refund_amount_kobo / 100.0) STORED,
  
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested',       -- Customer/operator requested refund
      'pending',         -- Initiated with Paystack API
      'processing',      -- Paystack processing bank credit
      'needs_attention', -- Paystack flagged for manual review
      'failed',          -- Refund rejected by banking rails
      'processed',       -- Refund fully credited to customer (liability discharged)
      'rejected'         -- Operator rejected refund request
    )),
    
  settlement_action text NOT NULL
    CHECK (settlement_action IN (
      'block_settlement',   -- Pre-payout: cancel queue and void payables
      'freeze_settlement',  -- In-flight: wait for Paystack transfer finality
      'clawback_required'   -- Post-payout: refund customer and create partner receivables
    )),
    
  reason text NOT NULL,
  paystack_refund_id text UNIQUE,
  paystack_refund_reference text UNIQUE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_order_id ON public.order_refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_order_refunds_status ON public.order_refunds(status);

ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all refunds" ON public.order_refunds;
CREATE POLICY "Admins can view all refunds"
  ON public.order_refunds FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

CREATE OR REPLACE FUNCTION public.process_order_refund_request(
  p_order_id uuid,
  p_reason text,
  p_refund_request_key text DEFAULT NULL,
  p_requested_by uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_key text;
  v_existing_ref record;
  v_v_status text;
  v_r_status text;
  v_gross_kobo bigint;
  v_vendor_id uuid;
  v_rider_id uuid;
  v_vendor_entitlement bigint;
  v_rider_entitlement bigint;
  v_requested_by uuid;
BEGIN
  -- Strict Authorization Gate: Admin roles or backend service_role
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only administrators can process refund requests' USING ERRCODE = 'KD403';
  END IF;

  -- 1. CONCURRENCY SERIALIZATION: Exclusively lock the parent order row
  PERFORM 1 FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not exist', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- 2. Audit Actor Resolution: Fail closed if no valid requesting profile is provided
  v_requested_by := COALESCE(p_requested_by, auth.uid());
  IF v_requested_by IS NULL THEN
    RAISE EXCEPTION 'Requesting actor profile ID is required (p_requested_by or authenticated session)' USING ERRCODE = 'KD400';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_requested_by) THEN
    RAISE EXCEPTION 'Requesting actor profile % not found in profiles', v_requested_by USING ERRCODE = 'KD404';
  END IF;

  v_key := COALESCE(p_refund_request_key, format('ref_%s_full', p_order_id));

  -- 3. Idempotency Check: Return existing refund record if key already processed
  SELECT * INTO v_existing_ref 
  FROM public.order_refunds 
  WHERE refund_request_key = v_key;

  IF FOUND THEN
    IF v_existing_ref.order_id != p_order_id THEN
      RAISE EXCEPTION 'Conflicting refund request key % is already associated with order %', v_key, v_existing_ref.order_id
        USING ERRCODE = 'KD409';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'refund_id', v_existing_ref.id,
      'status', v_existing_ref.status,
      'scenario', v_existing_ref.settlement_action,
      'requested_by', v_existing_ref.requested_by
    );
  END IF;

  -- 4. Guard against duplicate terminal refunds on already refunded orders
  IF EXISTS (
    SELECT 1 FROM public.order_refunds 
    WHERE order_id = p_order_id AND status = 'processed'
  ) OR EXISTS (
    SELECT 1 FROM public.order_settlement_status 
    WHERE order_id = p_order_id AND overall_status = 'refunded'
  ) THEN
    RAISE EXCEPTION 'Order % has already been refunded', p_order_id
      USING ERRCODE = 'KD409';
  END IF;

  -- 5. Prevent duplicate active refunds for the same order
  IF EXISTS (
    SELECT 1 FROM public.order_refunds 
    WHERE order_id = p_order_id AND status IN ('requested', 'pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'An active refund request is already in progress for order %', p_order_id
      USING ERRCODE = 'KD409';
  END IF;

  SELECT gross_customer_charge_kobo INTO v_gross_kobo 
  FROM public.order_financial_snapshots WHERE order_id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial snapshot not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- Read child payables under the active order lock
  SELECT status, recipient_id, gross_entitlement_kobo INTO v_v_status, v_vendor_id, v_vendor_entitlement 
  FROM public.order_payables WHERE order_id = p_order_id AND recipient_type = 'vendor';
  
  SELECT status, recipient_id, gross_entitlement_kobo INTO v_r_status, v_rider_id, v_rider_entitlement 
  FROM public.order_payables WHERE order_id = p_order_id AND recipient_type = 'rider';

  -- SCENARIO A: REFUND BEFORE PAYOUT (Safe to cancel queue & void payables)
  IF v_v_status IN ('payable_pending', 'settlement_queued') AND v_r_status IN ('payable_pending', 'settlement_queued') THEN
    UPDATE public.settlement_queue SET status = 'cancelled', updated_at = now() WHERE order_id = p_order_id;
    UPDATE public.order_payables SET status = 'cancelled', updated_at = now() WHERE order_id = p_order_id;
    
    INSERT INTO public.order_refunds (
      order_id, refund_request_key, refund_amount_kobo, status, settlement_action, reason, requested_by
    ) VALUES (
      p_order_id, v_key, v_gross_kobo, 'pending', 'block_settlement', p_reason, v_requested_by
    );
    
    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
    
    UPDATE public.order_settlement_status 
    SET overall_status = 'refund_pending', updated_at = now() 
    WHERE order_id = p_order_id;
    
    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'scenario', 'A_blocked_settlement', 'requested_by', v_requested_by);

  -- SCENARIO B: REFUND DURING PAYOUT (In-flight transfer -> Freeze queue with deterministic cooldown)
  ELSIF v_v_status = 'disbursing' OR v_r_status = 'disbursing' THEN
    -- Deterministic resume cooldown: Worker will re-evaluate in 15 minutes after Paystack webhook/verify resolution
    UPDATE public.settlement_queue 
    SET status = 'held_cooldown',
        scheduled_at = now() + interval '15 minutes',
        updated_at = now() 
    WHERE order_id = p_order_id;
    
    INSERT INTO public.order_refunds (
      order_id, refund_request_key, refund_amount_kobo, status, settlement_action, reason, requested_by
    ) VALUES (
      p_order_id, v_key, v_gross_kobo, 'requested', 'freeze_settlement', p_reason, v_requested_by
    );
    
    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'scenario', 'B_frozen_awaiting_transfer_finality', 'requested_by', v_requested_by);

  -- SCENARIO C: REFUND AFTER PAYOUT (Strictly verified settled state -> Customer refund request recorded; clawback activated on success)
  ELSIF v_v_status IN ('settled', 'clawback_offset') AND v_r_status IN ('settled', 'clawback_offset') THEN
    INSERT INTO public.order_refunds (
      order_id, refund_request_key, refund_amount_kobo, status, settlement_action, reason, requested_by
    ) VALUES (
      p_order_id, v_key, v_gross_kobo, 'pending', 'clawback_required', p_reason, v_requested_by
    );

    -- NOTE ON FINANCIAL ORDERING & ASYNC REFUND BOUNDARY:
    -- Partner debt (partner_receivables) MUST NOT be created while customer refund is still 'pending'.
    -- If the Paystack refund fails or is rejected, creating partner debt beforehand would create a
    -- phantom liability against the partner. Therefore, Migration 1 records the refund request with
    -- settlement_action = 'clawback_required'. The downstream Paystack refund webhook processor
    -- migration is responsible for creating and activating the partner_receivables liability
    -- ONLY after Paystack confirms the customer refund has reached terminal 'processed' status.

    RETURN jsonb_build_object('success', true, 'idempotent_replay', false, 'scenario', 'C_refund_with_partner_clawback', 'requested_by', v_requested_by);

  -- UNHANDLED / CONFLICTING STATES: Must fail explicitly. Never silently fall through to clawback!
  ELSE
    RAISE EXCEPTION 'Illegal refund state conflict: order payables are in unhandled intermediate or disparate state (vendor: %, rider: %). Manual operator resolution required.',
      v_v_status, v_r_status USING ERRCODE = 'KD409';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_refund_request FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_order_refund_request TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 13. Function: can_disburse_payable
-- Authoritative worker settlement eligibility gate (Migration 1 Baseline).
-- Evaluates order delivery status, active refunds, and payable state.
-- NOTE ON BOUNDARY: Migration 1 checks foundational financial eligibility only.
-- Recipient bank vault verification, recipient codes, and the 24-hour payout hold
-- belong to Migration 2. In Migration 1, this function fails closed on recipient 
-- verification with an explicit reason ('Awaiting partner bank vault verification (deferred to Migration 2)').
-- Migration 2 will DROP and REPLACE this function with full vault and recipient checks.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_disburse_payable(p_payable_id uuid)
RETURNS TABLE (
  eligible boolean,
  ineligibility_reason text,
  net_payable_kobo bigint,
  recipient_profile_id uuid,
  paystack_recipient_code text,
  payout_hold_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_p record;
  v_order_status text;
  v_refund_exists boolean;
BEGIN
  SELECT * INTO v_p FROM public.order_payables WHERE id = p_payable_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Payable record not found', 0::bigint, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT status::text INTO v_order_status FROM public.orders WHERE id = v_p.order_id;
  IF v_order_status != 'delivered' THEN
    RETURN QUERY SELECT false, format('Order status is %s; must be delivered', v_order_status), v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.order_refunds 
    WHERE order_id = v_p.order_id AND status IN ('requested', 'pending', 'processing')
  ) INTO v_refund_exists;
  
  IF v_refund_exists THEN
    RETURN QUERY SELECT false, 'Order has an active refund in progress', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_p.status NOT IN ('settlement_queued', 'failed') THEN
    RETURN QUERY SELECT false, format('Payable status is %s; must be settlement_queued or failed', v_p.status), v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- Migration 1 boundary: recipient bank vault does not exist yet.
  -- Fail closed on operational bank verification until Migration 2 replaces this function.
  RETURN QUERY SELECT false, 'Awaiting partner bank vault verification (deferred to Migration 2)', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.can_disburse_payable FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_disburse_payable TO service_role;

