# KingdomDash Automated Settlement & Split-Payment Engine
## Production Architecture Contract & v1.2.3 Final Hardened Technical Specification

---

### Document Status: FROZEN ARCHITECTURAL CONTRACT (v1.2.3 — FINAL HARDENED)
**Scope:** Complete, self-contained technical specification governing all partner settlement, proof-of-delivery confirmation, Paystack transfer mechanics, transfer fees and stamp duties, float reservation, fee allocation, refund/settlement conflict resolution, and financial reconciliation for KingdomDash.  
**Execution Rule:** This document supersedes all prior drafts (v1.0, v1.1, v1.2, v1.2.1, v1.2.2). No database migrations or application code may be written until this specification passes its final architectural review.

---

## 1. Architectural Philosophy & Core Axioms

1. **Separation of Operational and Financial Domains:**
   * **Delivery Confirmation** is an operational milestone proving physical handover.
   * **Settlement** is an asynchronous financial pipeline executed by an isolated background worker.
   * **The PIN is not the settlement transaction.** PIN verification must never depend on, wait for, or be coupled to external banking APIs.
2. **The Correctness Invariant (Not a Latency Target):**
   * The architectural guarantee is that **PIN verification and delivery-state transition do not depend on Paystack availability**.
   * If mobile connectivity drops, the NIBSS switch is down, or Paystack is degraded, physical delivery confirmation succeeds atomically in the database while settlement queues safely.
3. **Database as Primary Idempotency Authority:**
   * The PostgreSQL database enforces payout uniqueness through relational constraints and state machine transitions.
   * Paystack transfer references serve as an external secondary guard.
4. **Platform-Held Settlement Funds:**
   * Customer funds collected at checkout are termed **"Platform-held settlement funds"** pending fulfillment and settlement.
5. **Exact Inflow and Outflow Conservation:**
   * **Inflow Equation:** `gross_customer_charge_kobo` represents the exact monetary kobo captured from the customer via Paystack:
     $$\text{gross\_customer\_charge\_kobo} = \text{subtotal\_kobo} + \text{delivery\_fee\_kobo} + \text{service\_fee\_kobo} - \text{discount\_amount\_kobo}$$
   * **Outflow Allocation Conservation:**
     $$\text{gross\_customer\_charge\_kobo} \equiv \text{vendor\_gross\_kobo} + \text{rider\_gross\_kobo} + \text{platform\_allocated\_kobo}$$
   * **Commercial Expense Separation:** Gateway charge fees, transfer fees, and stamp duties are platform operational expenses absorbed by `platform_allocated_kobo`. They **never** reduce contractual vendor or rider gross entitlements.
   * Subsequent partner debt recovery only alters the operational cash disbursement; it never mutates the original financial snapshot.
6. **Disbursement Failure $\ne$ Obligation Extinguished:**
   * A failure during a Paystack transfer never extinguishes a partner's contractual entitlement.
   * An order with failed or reversed payouts remains an outstanding liability on the platform's balance sheet until resolved.
7. **Single-Job-Per-Order Queue Semantics:**
   * Exactly **one** `settlement_queue` row exists per order for its entire lifecycle (`UNIQUE(order_id)`). Retries, cooldowns, and admin holds transition state on the existing row without creating duplicate jobs.

---

## 2. Comprehensive Entity Hierarchy & Domain Model

```text
ORDER (Operational — Core Schema)
  │
  ├── DELIVERY_CONFIRMATION (Operational Authentication)
  │     ├── attempt_count (Max 3)
  │     ├── pin_hash (Argon2id standard PHC encoded string with embedded parameters)
  │     └── verification_status ('pending' | 'verified' | 'locked_exhausted' | 'admin_overridden')
  │
  ├── ORDER_FINANCIAL_SNAPSHOT (100% Immutable Inflow & Allocation Snapshot)
  │     ├── gross_customer_charge_kobo, subtotal_kobo, delivery_fee_kobo, service_fee_kobo, discount_amount_kobo
  │     ├── vendor_gross_kobo, rider_gross_kobo, platform_allocated_kobo
  │     ├── Dual Conservation Constraints (Customer Inflow & Outflow Allocation)
  │     ├── payment_reference (Paystack charge reference)
  │     └── captured_at (Trigger-protected against any UPDATE or DELETE)
  │
  ├── ORDER_REFUNDS (Refund / Settlement Conflict Management)
  │     ├── status ('requested' | 'pending' | 'processing' | 'needs_attention' | 'failed' | 'processed' | 'rejected')
  │     └── settlement_action ('block_settlement' | 'freeze_settlement' | 'clawback_required')
  │
  ├── ORDER_SETTLEMENT_STATUS (Mutable Aggregate Order-Level Status)
  │     ├── overall_status ('payable_pending' | 'settlement_queued' | 'settlement_partial' | 'settled' | 'disbursement_failed' | 'refunded' | 'disputed')
  │     ├── vendor_status ('payable_pending' | 'settlement_queued' | 'disbursing' | 'settled' | 'failed' | 'payable_reopened' | 'clawback_offset' | 'cancelled')
  │     ├── rider_status ('payable_pending' | 'settlement_queued' | 'disbursing' | 'settled' | 'failed' | 'payable_reopened' | 'clawback_offset' | 'cancelled')
  │     ├── settled_at (Monotonic sticky timestamp — preserved across reversals)
  │     └── reopened_at (Timestamp if liability reopens after NIBSS reversal)
  │
  ├── ORDER_PAYABLE: VENDOR (Operational Vendor Entitlement — Model A Persisted Fact)
  │     ├── gross_entitlement_kobo (IMMUTABLE after creation)
  │     ├── receivable_deduction_kobo (Updated ONLY via authoritative recovery ledger)
  │     ├── net_payable_kobo (CHECK constraint: gross - deduction)
  │     ├── payable_status ('payable_pending' | 'settlement_queued' | 'disbursing' | 'settled' | 'failed' | 'payable_reopened' | 'clawback_offset' | 'cancelled')
  │     └── PAYOUT_TRANSACTIONS (1..N Attempt History — Append Only)
  │           ├── attempt_number: 1, 2, ...
  │           ├── transfer_reference: kd_ord_<uuid32>_vnd_v{attempt}
  │           ├── paystack_transfer_code: TRF_xxxxxxxxx
  │           ├── amount_kobo
  │           ├── expected_transfer_fee_kobo, expected_stamp_duty_kobo
  │           ├── actual_transfer_fee_kobo, actual_stamp_duty_kobo
  │           └── status ('pending' | 'success' | 'failed' | 'reversed' — SQL State Machine Guarded)
  │
  ├── ORDER_PAYABLE: RIDER (Operational Rider Entitlement — Model A Persisted Fact)
  │     ├── gross_entitlement_kobo (IMMUTABLE after creation)
  │     ├── receivable_deduction_kobo (Updated ONLY via authoritative recovery ledger)
  │     ├── net_payable_kobo (CHECK constraint: gross - deduction)
  │     ├── payable_status ('payable_pending' | 'settlement_queued' | 'disbursing' | 'settled' | 'failed' | 'payable_reopened' | 'clawback_offset' | 'cancelled')
  │     └── PAYOUT_TRANSACTIONS (1..N Attempt History — Append Only)
  │           ├── attempt_number: 1, 2, ...
  │           ├── transfer_reference: kd_ord_<uuid32>_rdr_v{attempt}
  │           ├── paystack_transfer_code: TRF_xxxxxxxxx
  │           ├── amount_kobo
  │           ├── expected_transfer_fee_kobo, expected_stamp_duty_kobo
  │           ├── actual_transfer_fee_kobo, actual_stamp_duty_kobo
  │           └── status ('pending' | 'success' | 'failed' | 'reversed' — SQL State Machine Guarded)
  │
  ├── SETTLEMENT_QUEUE (Distributed Worker Queue — Exactly 1 Row Per Order)
  │     ├── status ('pending' | 'processing' | 'completed' | 'retry_ready' | 'held_float' | 'held_cooldown' | 'action_required' | 'cancelled')
  │     ├── locked_by, locked_until (Worker lease: 90s TTL)
  │     └── attempts (Max 5 before action_required)
  │
  ├── PLATFORM_FLOAT_CONTROL & RESERVATIONS (Concurrency Serialization & Independent TTL)
  │     ├── platform_float_control (Singleton row FOR UPDATE lock, max balance cache 60s)
  │     ├── platform_float_reservations (amount + fee + stamp duty, independent 5m TTL)
  │     └── platform_float_ledger (Audit & reconciliation of polled vs debited float)
  │
  └── PARTNER_BANK_VAULT (Trusted Server-Side KMS Encryption Boundary)
        ├── AES-256-GCM with Cryptographic AAD (profile_id:key_id:bank_account)
        └── Zero-Plaintext Logging Invariant across DB, logs, error reporters, analytics
```

---

## 3. Data Integrity & Database Schema Specifications

### §1. Authoritative Creation & Immutability of Financial Snapshot (`order_financial_snapshots`)

#### Complete SQL Schema
```sql
CREATE TABLE public.order_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  
  -- Customer Pricing Inflow (Canonical Kobo)
  subtotal_kobo bigint NOT NULL CHECK (subtotal_kobo >= 0),
  delivery_fee_kobo bigint NOT NULL CHECK (delivery_fee_kobo >= 0),
  service_fee_kobo bigint NOT NULL DEFAULT 0 CHECK (service_fee_kobo >= 0),
  discount_amount_kobo bigint NOT NULL DEFAULT 0 CHECK (discount_amount_kobo >= 0),
  gross_customer_charge_kobo bigint NOT NULL CHECK (gross_customer_charge_kobo >= 0),
  
  -- Customer Pricing Inflow (Display NGN)
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
  
  -- Platform Allocation (Residual inflow; operational expenses & profit are derived separately)
  platform_allocated_kobo bigint NOT NULL,
  platform_allocated_amount numeric(12,2) GENERATED ALWAYS AS (platform_allocated_kobo / 100.0) STORED,
  
  -- Dual Conservation Constraints:
  -- 1. Inflow Bridge: Exact charge captured from customer via Paystack
  CONSTRAINT chk_customer_pricing_bridge CHECK (
    gross_customer_charge_kobo = (subtotal_kobo + delivery_fee_kobo + service_fee_kobo - discount_amount_kobo)
  ),
  
  -- 2. Outflow Allocation Bridge: Gross Inflow strictly equals Vendor + Rider + Platform Allocation
  CONSTRAINT chk_outflow_conservation CHECK (
    gross_customer_charge_kobo = (vendor_gross_kobo + rider_gross_kobo + platform_allocated_kobo)
  ),
  
  payment_reference text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: Strictly block UPDATE or DELETE operations on financial snapshots
CREATE OR REPLACE FUNCTION public.enforce_order_financial_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CRITICAL: order_financial_snapshots rows are strictly immutable. Mutating financial history is prohibited.'
    USING ERRCODE = 'KD403';
END;
$$;

CREATE TRIGGER trg_protect_order_financial_snapshots
  BEFORE UPDATE OR DELETE ON public.order_financial_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_financial_immutability();
```

#### Authoritative Creation RPC with Idempotency
```sql
CREATE OR REPLACE FUNCTION public.create_order_financial_snapshot_and_payables(
  p_order_id uuid,
  p_payment_reference text,
  p_subtotal_kobo bigint,
  p_delivery_fee_kobo bigint,
  p_service_fee_kobo bigint,
  p_discount_amount_kobo bigint,
  p_vendor_gross_kobo bigint,
  p_rider_gross_kobo bigint,
  p_vendor_profile_id uuid,
  p_rider_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_gross_charge_kobo bigint;
  v_platform_allocated_kobo bigint;
BEGIN
  -- Caller must be service_role or admin
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only payment verification service can create financial snapshots' USING ERRCODE = 'KD403';
  END IF;

  v_gross_charge_kobo := (p_subtotal_kobo + p_delivery_fee_kobo + p_service_fee_kobo - p_discount_amount_kobo);
  v_platform_allocated_kobo := v_gross_charge_kobo - (p_vendor_gross_kobo + p_rider_gross_kobo);

  -- 1. Idempotently insert financial snapshot
  INSERT INTO public.order_financial_snapshots (
    order_id, subtotal_kobo, delivery_fee_kobo, service_fee_kobo, discount_amount_kobo,
    gross_customer_charge_kobo, vendor_gross_kobo, rider_gross_kobo, platform_allocated_kobo,
    payment_reference, captured_at
  ) VALUES (
    p_order_id, p_subtotal_kobo, p_delivery_fee_kobo, p_service_fee_kobo, p_discount_amount_kobo,
    v_gross_charge_kobo, p_vendor_gross_kobo, p_rider_gross_kobo, v_platform_allocated_kobo,
    p_payment_reference, now()
  )
  ON CONFLICT (order_id) DO NOTHING;

  -- 2. Idempotently insert vendor payable
  INSERT INTO public.order_payables (
    order_id, recipient_type, recipient_id, gross_entitlement_kobo, receivable_deduction_kobo,
    net_payable_kobo, status
  ) VALUES (
    p_order_id, 'vendor', p_vendor_profile_id, p_vendor_gross_kobo, 0,
    p_vendor_gross_kobo, 'payable_pending'
  )
  ON CONFLICT (order_id, recipient_type) DO NOTHING;

  -- 3. Idempotently insert rider payable
  INSERT INTO public.order_payables (
    order_id, recipient_type, recipient_id, gross_entitlement_kobo, receivable_deduction_kobo,
    net_payable_kobo, status
  ) VALUES (
    p_order_id, 'rider', p_rider_profile_id, p_rider_gross_kobo, 0,
    p_rider_gross_kobo, 'payable_pending'
  )
  ON CONFLICT (order_id, recipient_type) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
END;
$$;
```

---

### §2. Aggregate Settlement State (`order_settlement_status`) & Operational Payables (`order_payables`)

#### Aggregate Settlement Status Table
```sql
CREATE TABLE public.order_settlement_status (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  
  overall_status text NOT NULL DEFAULT 'payable_pending'
    CHECK (overall_status IN (
      'payable_pending',     -- Order active, awaiting delivery confirmation
      'settlement_queued',   -- Delivery confirmed, job queued for settlement worker
      'settlement_partial',  -- Exactly one payable is settled; or one/both reopened after reversal
      'settled',             -- BOTH vendor and rider payables are settled (or clawback-offset)
      'disbursement_failed', -- Transfer failed; partner is still owed money (action required)
      'refunded',            -- Full order refund issued to customer prior to settlement
      'disputed'             -- Post-settlement customer dispute raised
    )),
    
  vendor_status text NOT NULL DEFAULT 'payable_pending',
  rider_status text NOT NULL DEFAULT 'payable_pending',
  settled_at timestamptz,       -- Monotonic: set on initial settlement, NEVER overwritten with NULL
  reopened_at timestamptz,      -- Set if payout is reversed by NIBSS
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### Operational Payables Table with Immutability Guards
```sql
CREATE TABLE public.order_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  recipient_type text NOT NULL CHECK (recipient_type IN ('vendor', 'rider')),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id),
  
  -- Entitlement Math (Canonical Kobo)
  gross_entitlement_kobo bigint NOT NULL CHECK (gross_entitlement_kobo >= 0),
  receivable_deduction_kobo bigint NOT NULL DEFAULT 0 CHECK (receivable_deduction_kobo >= 0),
  net_payable_kobo bigint NOT NULL CHECK (net_payable_kobo >= 0),
  
  -- Display NGN
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

CREATE OR REPLACE FUNCTION public.guard_order_payable_mutations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.gross_entitlement_kobo != OLD.gross_entitlement_kobo THEN
    RAISE EXCEPTION 'CRITICAL: gross_entitlement_kobo on order_payables is immutable.' USING ERRCODE = 'KD403';
  END IF;

  IF OLD.status = 'settled' AND NEW.status = 'cancelled' THEN
    RAISE EXCEPTION 'Illegal state transition: a settled payable cannot be cancelled. Use reversal workflow.' USING ERRCODE = 'KD409';
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status NOT IN ('payable_pending', 'settlement_queued', 'failed') THEN
    RAISE EXCEPTION 'Illegal cancellation: payable in status % cannot be cancelled.', OLD.status USING ERRCODE = 'KD409';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_order_payable_mutations
  BEFORE UPDATE ON public.order_payables
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_order_payable_mutations();
```

#### Deterministic Aggregate Upsert Trigger (Serialized & Sticky)
```sql
CREATE OR REPLACE FUNCTION public.sync_order_settlement_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_v_status text;
  v_r_status text;
  v_new_overall text;
  v_is_v_settled boolean;
  v_is_r_settled boolean;
  v_has_reopened boolean;
  v_existing_settled_at timestamptz;
  v_new_settled_at timestamptz;
  v_new_reopened_at timestamptz := NULL;
BEGIN
  -- 1. CONCURRENCY SERIALIZATION: Lock the parent order row
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR UPDATE;

  -- 2. Read complete state of both payables
  SELECT status INTO v_v_status 
  FROM public.order_payables 
  WHERE order_id = NEW.order_id AND recipient_type = 'vendor';

  SELECT status INTO v_r_status 
  FROM public.order_payables 
  WHERE order_id = NEW.order_id AND recipient_type = 'rider';

  v_is_v_settled := (v_v_status IN ('settled', 'clawback_offset'));
  v_is_r_settled := (v_r_status IN ('settled', 'clawback_offset'));
  v_has_reopened := (v_v_status = 'payable_reopened' OR v_r_status = 'payable_reopened');

  -- 3. Deterministic Mapping Matrix
  IF v_has_reopened THEN
    v_new_overall := 'settlement_partial';
    v_new_reopened_at := now();
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

  -- 4. Monotonic Sticky settled_at Calculation
  SELECT settled_at INTO v_existing_settled_at
  FROM public.order_settlement_status
  WHERE order_id = NEW.order_id;

  IF v_existing_settled_at IS NOT NULL THEN
    v_new_settled_at := v_existing_settled_at; -- NEVER erase once established
  ELSIF v_new_overall = 'settled' THEN
    v_new_settled_at := now();
  ELSE
    v_new_settled_at := NULL;
  END IF;

  -- 5. Atomic UPSERT
  INSERT INTO public.order_settlement_status (
    order_id, overall_status, vendor_status, rider_status, settled_at, reopened_at, updated_at
  ) VALUES (
    NEW.order_id, v_new_overall, COALESCE(v_v_status, 'payable_pending'), COALESCE(v_r_status, 'payable_pending'), v_new_settled_at, v_new_reopened_at, now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    overall_status = EXCLUDED.overall_status,
    vendor_status  = EXCLUDED.vendor_status,
    rider_status   = EXCLUDED.rider_status,
    settled_at     = EXCLUDED.settled_at,
    reopened_at    = COALESCE(EXCLUDED.reopened_at, public.order_settlement_status.reopened_at),
    updated_at     = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_order_settlement_status
  AFTER INSERT OR UPDATE OF status ON public.order_payables
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_order_settlement_status();
```

---

### §3. Paystack Asynchronous Refund Lifecycle & Settlement Conflict Resolution (`order_refunds`)

Paystack refunds are asynchronous and follow: `refund.pending` $\rightarrow$ `refund.processing` $\rightarrow$ `refund.processed` (or `refund.failed` / `refund.needs-attention`).

```sql
CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  refund_amount_kobo bigint NOT NULL CHECK (refund_amount_kobo > 0),
  
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
```

#### The Three Operational Refund Scenarios
```sql
CREATE OR REPLACE FUNCTION public.process_order_refund_request(
  p_order_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_v_status text;
  v_r_status text;
  v_gross_kobo bigint;
  v_vendor_id uuid;
  v_rider_id uuid;
  v_vendor_entitlement bigint;
  v_rider_entitlement bigint;
BEGIN
  SELECT gross_customer_charge_kobo INTO v_gross_kobo FROM public.order_financial_snapshots WHERE order_id = p_order_id;
  SELECT status, recipient_id, gross_entitlement_kobo INTO v_v_status, v_vendor_id, v_vendor_entitlement 
  FROM public.order_payables WHERE order_id = p_order_id AND recipient_type = 'vendor';
  SELECT status, recipient_id, gross_entitlement_kobo INTO v_r_status, v_rider_id, v_rider_entitlement 
  FROM public.order_payables WHERE order_id = p_order_id AND recipient_type = 'rider';

  -- SCENARIO A: REFUND BEFORE PAYOUT (Safe to block settlement & void payables)
  IF v_v_status IN ('payable_pending', 'settlement_queued') AND v_r_status IN ('payable_pending', 'settlement_queued') THEN
    UPDATE public.settlement_queue SET status = 'cancelled', updated_at = now() WHERE order_id = p_order_id;
    UPDATE public.order_payables SET status = 'cancelled', updated_at = now() WHERE order_id = p_order_id;
    
    INSERT INTO public.order_refunds (order_id, refund_amount_kobo, status, settlement_action, reason, requested_by)
    VALUES (p_order_id, v_gross_kobo, 'pending', 'block_settlement', p_reason, auth.uid());
    
    UPDATE public.orders SET status = 'cancelled', updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('success', true, 'scenario', 'A_blocked_settlement');

  -- SCENARIO B: REFUND DURING PAYOUT (In-flight transfer awaiting finality)
  ELSIF v_v_status = 'disbursing' OR v_r_status = 'disbursing' THEN
    UPDATE public.settlement_queue SET status = 'held_cooldown', updated_at = now() WHERE order_id = p_order_id;
    
    INSERT INTO public.order_refunds (order_id, refund_amount_kobo, status, settlement_action, reason, requested_by)
    VALUES (p_order_id, v_gross_kobo, 'requested', 'freeze_settlement', p_reason, auth.uid());
    
    RETURN jsonb_build_object('success', true, 'scenario', 'B_frozen_awaiting_transfer_finality');

  -- SCENARIO C: REFUND AFTER PAYOUT (Already settled -> Customer refund + Partner Clawback)
  ELSE
    INSERT INTO public.order_refunds (order_id, refund_amount_kobo, status, settlement_action, reason, requested_by)
    VALUES (p_order_id, v_gross_kobo, 'pending', 'clawback_required', p_reason, auth.uid());

    -- Create debt receivables for vendor and rider
    IF v_v_status = 'settled' AND v_vendor_entitlement > 0 THEN
      INSERT INTO public.partner_receivables (
        partner_id, partner_type, source_order_id, reason, initial_debt_kobo, remaining_debt_kobo
      ) VALUES (
        v_vendor_id, 'vendor', p_order_id, format('Refund clawback: %s', p_reason), v_vendor_entitlement, v_vendor_entitlement
      );
    END IF;

    IF v_r_status = 'settled' AND v_rider_entitlement > 0 THEN
      INSERT INTO public.partner_receivables (
        partner_id, partner_type, source_order_id, reason, initial_debt_kobo, remaining_debt_kobo
      ) VALUES (
        v_rider_id, 'rider', p_order_id, format('Refund clawback: %s', p_reason), v_rider_entitlement, v_rider_entitlement
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'scenario', 'C_refund_with_partner_clawback');
  END IF;
END;
$$;
```

---

### §4. Append-Only Payout Ledger with State Machine SQL Guards (`payout_transactions`)

```sql
CREATE TABLE public.payout_transactions (
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
  
  -- Cost Split (Absorbed by platform_allocated_kobo, never partners)
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

CREATE INDEX idx_payout_tx_reference ON public.payout_transactions(transfer_reference);
CREATE INDEX idx_payout_tx_transfer_code ON public.payout_transactions(paystack_transfer_code);

-- Strict SQL State Machine Guard
CREATE OR REPLACE FUNCTION public.guard_payout_transaction_state_transitions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Legal transitions:
  -- pending -> success, failed, reversed
  -- success -> reversed
  -- failed -> TERMINAL (cannot transition)
  -- reversed -> TERMINAL (cannot transition)
  IF OLD.status = 'pending' AND NEW.status IN ('success', 'failed', 'reversed') THEN
    RETURN NEW;
  ELSIF OLD.status = 'success' AND NEW.status = 'reversed' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'Illegal payout transaction state transition: % -> % is strictly prohibited.', OLD.status, NEW.status
      USING ERRCODE = 'KD409';
  END IF;
END;
$$;

CREATE TRIGGER trg_guard_payout_transaction_state_transitions
  BEFORE UPDATE OF status ON public.payout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_payout_transaction_state_transitions();
```

---

### §5. Paystack Pricing, Stamp Duty & Float Control (`platform_float_control`)

#### Statutory Fee and Stamp Duty Calculation
Paystack transfer pricing in Nigeria:
* $\le \text{₦}5,000$: $\text{₦}10.00$ ($1,000\text{ kobo}$)
* $\text{₦}5,001$ – $\text{₦}50,000$: $\text{₦}25.00$ ($2,500\text{ kobo}$)
* $> \text{₦}50,000$: $\text{₦}50.00$ ($5,000\text{ kobo}$)
* **Electronic Money Transfer Levy (Stamp Duty):** Statutory $\text{₦}50.00$ ($5,000\text{ kobo}$) applies to transfers $\ge \text{₦}10,000$ ($1,000,000\text{ kobo}$).

```sql
CREATE OR REPLACE FUNCTION public.calculate_expected_transfer_cost_kobo(
  p_amount_kobo bigint,
  OUT expected_fee_kobo bigint,
  OUT expected_stamp_duty_kobo bigint,
  OUT expected_total_debit_kobo bigint
)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    v_fee,
    v_duty,
    (p_amount_kobo + v_fee + v_duty)
  FROM (
    SELECT 
      CASE 
        WHEN p_amount_kobo <= 500000 THEN 1000    -- ₦10
        WHEN p_amount_kobo <= 5000000 THEN 2500   -- ₦25
        ELSE 5000                                 -- ₦50
      END AS v_fee,
      CASE 
        WHEN p_amount_kobo >= 1000000 THEN 5000   -- ₦50 Stamp Duty for >= ₦10,000
        ELSE 0 
      END AS v_duty
  ) sub;
$$;
```

#### Float Control, Reservations & Ledger Schema
```sql
CREATE TABLE public.platform_float_control (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  last_polled_balance_kobo bigint NOT NULL DEFAULT 0,
  last_polled_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_float_control (id, last_polled_balance_kobo)
VALUES (true, 0)
ON CONFLICT (id) DO NOTHING;

-- Active Float Reservations Table (Independent 5m TTL)
CREATE TABLE public.platform_float_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payable_id uuid NOT NULL REFERENCES public.order_payables(id) ON DELETE RESTRICT,
  reserved_amount_kobo bigint NOT NULL CHECK (reserved_amount_kobo > 0), -- amount + fee + stamp duty
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  expires_at timestamptz NOT NULL, -- 5-minute reservation TTL
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT uq_float_reservation_payable UNIQUE (payable_id, status) 
    WHERE (status = 'active')
);

-- Float Audit and Reconciliation Ledger
CREATE TABLE public.platform_float_ledger (
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
```

#### Transactional Reservation Protocol with Stale-Balance Guard
```sql
BEGIN;

-- 1. Lock singleton control row
SELECT last_polled_balance_kobo, last_polled_at 
INTO v_balance_kobo, v_polled_at
FROM public.platform_float_control
WHERE id = true
FOR UPDATE;

-- 2. HARD STALE BALANCE INVARIANT: Max Age = 60 Seconds
IF (now() - v_polled_at) > interval '60 seconds' THEN
  ROLLBACK;
  -- Worker calls GET /balance, updates platform_float_control, and re-executes
ELSE
  -- 3. Release expired reservations from crashed workers
  UPDATE public.platform_float_reservations 
  SET status = 'released' 
  WHERE status = 'active' AND expires_at < now();

  -- 4. Calculate uncommitted float: Balance - Sum(Active Reservations)
  SELECT COALESCE(SUM(reserved_amount_kobo), 0) INTO v_active_reserved_kobo
  FROM public.platform_float_reservations
  WHERE status = 'active';

  v_available_float_kobo := v_balance_kobo - v_active_reserved_kobo;

  -- 5. Calculate total cost: Net Payable + Expected Transfer Fee + Expected Stamp Duty
  SELECT expected_total_debit_kobo INTO v_required_reservation_kobo
  FROM public.calculate_expected_transfer_cost_kobo(:net_payable_kobo);

  -- 6. Verify sufficiency
  IF v_available_float_kobo < v_required_reservation_kobo THEN
    ROLLBACK;
    -- Worker marks queue job as held_float, reschedules in 5m
  ELSE
    -- Independent 5-minute reservation TTL
    INSERT INTO public.platform_float_reservations (
      worker_id, order_id, payable_id, reserved_amount_kobo, expires_at
    ) VALUES (
      :worker_id, :order_id, :payable_id, v_required_reservation_kobo, now() + interval '5 minutes'
    );
    COMMIT;
  END IF;
END IF;
```

---

### §6. Queue Distributed Leasing & Single-Job-Per-Order Semantics (`settlement_queue`)

```sql
CREATE TABLE public.settlement_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',         -- Ready for worker claim
      'processing',      -- Leased by active worker (90s lease)
      'completed',       -- BOTH payables fully satisfied (settled or clawback_offset)
      'retry_ready',     -- Temporary network error; ready for re-claim
      'held_float',      -- Insufficient platform float (balance + fee buffer); waiting retry
      'held_cooldown',   -- Partner within 24-hour payout hold; scheduled for hold expiry
      'action_required', -- Payout failed permanently; obligation persists, requires operator
      'cancelled'        -- Order canceled/refunded before disbursement
    )),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  
  locked_by text,
  locked_until timestamptz,
  last_heartbeat_at timestamptz,
  
  last_error text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_settlement_queue_claim 
  ON public.settlement_queue (status, scheduled_at) 
  WHERE status IN ('pending', 'retry_ready');
```

#### Invariant: Exactly One Queue Row Per Order
* `order_id` is strictly `UNIQUE`.
* If a payout encounters terminal failure, the row transitions to `action_required`.
* When an administrator or partner fixes the bank account, the **existing** row is updated to `status = 'retry_ready'`, `attempts = 0`. A new row is **never** created.

---

### §7. Settlement Eligibility Contract (`can_disburse_payable`)

```sql
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
  v_partner record;
BEGIN
  -- 1. Fetch payable
  SELECT * INTO v_p FROM public.order_payables WHERE id = p_payable_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Payable record not found', 0::bigint, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 2. Verify Order Delivery
  SELECT status INTO v_order_status FROM public.orders WHERE id = v_p.order_id;
  IF v_order_status != 'delivery_confirmed' THEN
    RETURN QUERY SELECT false, format('Order status is %s; must be delivery_confirmed', v_order_status), v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 3. Verify No Blocking Refund
  SELECT EXISTS (
    SELECT 1 FROM public.order_refunds WHERE order_id = v_p.order_id AND status IN ('requested', 'pending', 'processing')
  ) INTO v_refund_exists;
  IF v_refund_exists THEN
    RETURN QUERY SELECT false, 'Order has an active refund in progress', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 4. Verify Payable Status
  IF v_p.status NOT IN ('settlement_queued', 'failed') THEN
    RETURN QUERY SELECT false, format('Payable status is %s; must be settlement_queued or failed', v_p.status), v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 5. Fetch Partner Bank Record
  IF v_p.recipient_type = 'vendor' THEN
    SELECT bank_account_name_verified, paystack_recipient_active, payout_enabled, paystack_recipient_code, payout_hold_until 
    INTO v_partner FROM public.vendors WHERE profile_id = v_p.recipient_id;
  ELSIF v_p.recipient_type = 'rider' THEN
    SELECT bank_account_name_verified, paystack_recipient_active, payout_enabled, paystack_recipient_code, payout_hold_until 
    INTO v_partner FROM public.riders WHERE profile_id = v_p.recipient_id;
  END IF;

  IF NOT COALESCE(v_partner.bank_account_name_verified, false) OR NOT COALESCE(v_partner.paystack_recipient_active, false) OR NOT COALESCE(v_partner.payout_enabled, false) THEN
    RETURN QUERY SELECT false, 'Partner bank account is not fully verified and payout-enabled', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_partner.paystack_recipient_code IS NULL THEN
    RETURN QUERY SELECT false, 'Paystack recipient code is missing', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 6. Check 24-Hour Payout Hold Cooldown
  IF v_partner.payout_hold_until IS NOT NULL AND v_partner.payout_hold_until > now() THEN
    RETURN QUERY SELECT false, 'Partner under 24-hour payout hold cooldown', v_p.net_payable_kobo, v_p.recipient_id, v_partner.paystack_recipient_code, v_partner.payout_hold_until;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, v_p.net_payable_kobo, v_p.recipient_id, v_partner.paystack_recipient_code, v_partner.payout_hold_until;
END;
$$;
```

---

### §8. Hard Unknown-Transfer Recovery Invariant

$$\text{POST timeout} \longrightarrow \text{GET /transfer/verify/:reference}$$

```text
                           Worker Claims Payable
                                     │
                    Existing Payout Transaction Exists?
                                     │
                     ┌───────────────┴───────────────┐
                     ▼                               ▼
                    YES                              NO
                     │                               │
         (Inconclusive Previous Call)       Evaluate can_disburse_payable()
                     │                               │
       Call GET /transfer/verify/:reference          ▼
                     │                      Initiate New Transfer
                     │                      (Reference: ..._v1)
                     ▼
┌────────────────────┼──────────────────────────────┬────────────────────────────┐
▼                    ▼                              ▼                            ▼
HTTP 200             HTTP 200                       Authoritative "Not Found"    HTTP 5xx / Timeout / Net Error
data.status=success  data.status=pending/processing (data.status=false           (Transient Transport Error)
│                    │                              message="Transfer ref...")   │
▼                    ▼                              │                            ▼
Update DB to         Update DB to 'disbursing'      ▼                            UNKNOWN: DO NOT RETRY POST!
'settled'            Do NOT retry!                  Paystack definitively        Leave job as processing /
Consume reservation  Wait for webhook or            never received request!      reschedule verify on next pass.
Release lock         poll again next pass           Safely replay POST /transfer
                                                    with the SAME reference!
```

---

### §9. Atomic Receivable Recovery with Audit Event Guarantee (`partner_receivables`)

```sql
CREATE TABLE public.partner_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  partner_type text NOT NULL CHECK (partner_type IN ('vendor', 'rider')),
  source_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  reason text NOT NULL,
  initial_debt_kobo bigint NOT NULL CHECK (initial_debt_kobo > 0),
  remaining_debt_kobo bigint NOT NULL CHECK (remaining_debt_kobo >= 0),
  status text NOT NULL DEFAULT 'outstanding'
    CHECK (status IN ('outstanding', 'partially_recovered', 'fully_cleared', 'written_off')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.receivable_recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.partner_receivables(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  pre_recovery_debt_kobo bigint NOT NULL,
  claimed_amount_kobo bigint NOT NULL CHECK (claimed_amount_kobo > 0),
  post_recovery_debt_kobo bigint NOT NULL CHECK (post_recovery_debt_kobo >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.claim_partner_receivable_offset(
  p_partner_id uuid,
  p_order_id uuid,
  p_gross_entitlement_kobo bigint
)
RETURNS TABLE (
  claimed_deduction_kobo bigint,
  net_payable_kobo bigint
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec record;
  v_remaining_gross bigint := p_gross_entitlement_kobo;
  v_total_claimed bigint := 0;
  v_initial_debt bigint;
  v_to_deduct bigint;
  v_post_debt bigint;
BEGIN
  -- 1. PARTNER-LEVEL SERIALIZATION: Lock partner profile row
  PERFORM 1 FROM public.profiles WHERE id = p_partner_id FOR UPDATE;

  -- 2. Deterministically lock debt rows ordered by age and ID
  FOR v_rec IN (
    SELECT id, remaining_debt_kobo 
    FROM public.partner_receivables 
    WHERE partner_id = p_partner_id AND status IN ('outstanding', 'partially_recovered')
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  ) LOOP
    EXIT WHEN v_remaining_gross <= 0;
    
    v_initial_debt := v_rec.remaining_debt_kobo;
    v_to_deduct := LEAST(v_initial_debt, v_remaining_gross);
    v_post_debt := v_initial_debt - v_to_deduct;

    -- Update receivable row
    UPDATE public.partner_receivables 
    SET remaining_debt_kobo = v_post_debt,
        status = CASE WHEN v_post_debt = 0 THEN 'fully_cleared' ELSE 'partially_recovered' END,
        updated_at = now()
    WHERE id = v_rec.id;
    
    -- Insert authoritative audit recovery log with pre/post balances
    INSERT INTO public.receivable_recovery_logs (
      receivable_id, order_id, pre_recovery_debt_kobo, claimed_amount_kobo, post_recovery_debt_kobo, created_at
    ) VALUES (
      v_rec.id, p_order_id, v_initial_debt, v_to_deduct, v_post_debt, now()
    );

    v_total_claimed := v_total_claimed + v_to_deduct;
    v_remaining_gross := v_remaining_gross - v_to_deduct;
  END LOOP;

  -- 3. Update order payable row
  UPDATE public.order_payables
  SET receivable_deduction_kobo = v_total_claimed,
      net_payable_kobo = (p_gross_entitlement_kobo - v_total_claimed),
      status = CASE WHEN (p_gross_entitlement_kobo - v_total_claimed) = 0 THEN 'clawback_offset' ELSE status END,
      updated_at = now()
  WHERE order_id = p_order_id AND recipient_id = p_partner_id;

  RETURN QUERY SELECT v_total_claimed, (p_gross_entitlement_kobo - v_total_claimed);
END;
$$;
```

---

### §10. Partner Bank Vault AES-256-GCM & Server-Side KMS Encryption Boundary

#### Cryptographic Architecture & Defensible Security Model
* **KMS Boundary:** Plaintext account numbers are encrypted **strictly in the Edge Function runtime** using a server-side KMS environment secret (`PAYOUT_VAULT_ENCRYPTION_KEY`). The browser/client never touches the encryption key or performs encryption.
* **Cipher:** AES-256-GCM with Associated Authenticated Data (AAD):
  $$\text{AAD} = \text{UTF-8}(\text{profile\_id} \parallel \text{":"} \parallel \text{key\_id} \parallel \text{":bank_account"})$$
* **Zero-Plaintext Logging Invariant:** Plaintext bank account numbers are strictly prohibited from:
  1. PostgreSQL tables, columns, indexes, WAL logs
  2. HTTP server access logs
  3. Edge Function console logs (`console.log`)
  4. Sentry / Datadog / error telemetry reporters
  5. Audit log metadata
  6. Analytics pipelines

```sql
CREATE TABLE public.partner_bank_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_account_number text NOT NULL, -- Base64 ciphertext
  iv text NOT NULL,                       -- Base64 12-byte nonce
  auth_tag text NOT NULL,                 -- Base64 16-byte GCM tag
  key_id text NOT NULL DEFAULT 'v1',      -- KMS key version
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.partner_bank_vault FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_partner_bank_details(
  p_profile_id uuid,
  p_partner_type text, -- 'vendor' or 'rider'
  p_bank_code text,
  p_bank_name text,
  p_masked_account_number text, -- '******1234'
  p_account_name text,
  p_encrypted_account_number text,
  p_iv text,
  p_auth_tag text,
  p_key_id text,
  p_paystack_recipient_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Caller must be service_role or admin (ensures client cannot directly invoke without Edge Function KMS encryption)
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: bank details must be encrypted by trusted server function' USING ERRCODE = 'KD403';
  END IF;

  IF p_partner_type = 'vendor' THEN
    IF NOT EXISTS (SELECT 1 FROM public.vendors WHERE profile_id = p_profile_id) THEN
      RAISE EXCEPTION 'Profile % is not registered as a vendor', p_profile_id USING ERRCODE = 'KD400';
    END IF;

    UPDATE public.vendors SET
      bank_code = p_bank_code,
      bank_name = p_bank_name,
      account_name = p_account_name,
      masked_account_number = p_masked_account_number,
      paystack_recipient_code = p_paystack_recipient_code,
      bank_details_submitted = true,
      bank_account_name_verified = true,
      paystack_recipient_active = true,
      payout_enabled = true,
      payout_hold_until = now() + interval '24 hours', -- MANDATORY 24H COOLDOWN
      updated_at = now()
    WHERE profile_id = p_profile_id;

  ELSIF p_partner_type = 'rider' THEN
    IF NOT EXISTS (SELECT 1 FROM public.riders WHERE profile_id = p_profile_id) THEN
      RAISE EXCEPTION 'Profile % is not registered as a rider', p_profile_id USING ERRCODE = 'KD400';
    END IF;

    UPDATE public.riders SET
      bank_code = p_bank_code,
      bank_name = p_bank_name,
      account_name = p_account_name,
      masked_account_number = p_masked_account_number,
      paystack_recipient_code = p_paystack_recipient_code,
      bank_details_submitted = true,
      bank_account_name_verified = true,
      paystack_recipient_active = true,
      payout_enabled = true,
      payout_hold_until = now() + interval '24 hours', -- MANDATORY 24H COOLDOWN
      updated_at = now()
    WHERE profile_id = p_profile_id;
  ELSE
    RAISE EXCEPTION 'Invalid partner_type: must be vendor or rider' USING ERRCODE = 'KD400';
  END IF;

  -- Upsert Isolated Bank Vault
  INSERT INTO public.partner_bank_vault (
    profile_id, encrypted_account_number, iv, auth_tag, key_id, updated_at
  ) VALUES (
    p_profile_id, p_encrypted_account_number, p_iv, p_auth_tag, p_key_id, now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    encrypted_account_number = EXCLUDED.encrypted_account_number,
    iv                       = EXCLUDED.iv,
    auth_tag                 = EXCLUDED.auth_tag,
    key_id                   = EXCLUDED.key_id,
    updated_at               = now();

  -- Audit Log (Strictly masked — zero plaintext)
  INSERT INTO public.admin_audit_logs (user_id, action, target_id, details)
  VALUES (auth.uid(), 'update_partner_bank_details', p_profile_id, jsonb_build_object(
    'partner_type', p_partner_type,
    'bank_name', p_bank_name,
    'account_name', p_account_name,
    'masked_account', p_masked_account_number,
    'hold_until', (now() + interval '24 hours')
  ));

  RETURN jsonb_build_object('success', true, 'hold_until', (now() + interval '24 hours'));
END;
$$;
```

---

### §11. Webhook Ingestion & State-Transition Idempotency

#### Ingestion Pipeline
```text
Paystack Webhook Call
         │
         ▼
Verify HMAC-SHA512 Signature?
   ├── NO  ──► Return HTTP 401 Unauthorized
   └── YES
         │
         ▼
Compute Fingerprint: SHA-256(event : COALESCE(ref, code, id) : COALESCE(transferred_at, created_at, now()))
         │
         ▼
INSERT INTO paystack_webhook_events
   ├── DB Connection Fails / Timeout ──► Return HTTP 500 (Paystack retries)
   └── DB COMMIT Succeeds
         │
         ▼
   Return HTTP 200 OK
         │
         ▼
Asynchronous Reconcile Worker
```

```sql
CREATE TABLE public.paystack_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_fingerprint text NOT NULL UNIQUE,
  event_type text NOT NULL,
  reference text,
  transfer_code text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error_message text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_paystack_webhook_fingerprint ON public.paystack_webhook_events(event_fingerprint);
```

#### State-Transition Idempotency
```sql
UPDATE public.payout_transactions
SET status = 'success', updated_at = now()
WHERE paystack_transfer_code = :transfer_code AND status = 'pending';
```

---

### §12. Delivery PIN Verification Standard: Server-Side Argon2id & Atomic Order Transition

#### Parameter Agility Standard
* **Algorithm:** **Argon2id**.
* Format: Standard PHC encoded string (`$argon2id$v=19$m=65536,t=3,p=4$...`).
* The database stores `pin_hash text NOT NULL` (no redundant salt column).

```sql
CREATE TABLE public.delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id uuid NOT NULL REFERENCES public.profiles(id),
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

REVOKE ALL ON public.delivery_confirmations FROM PUBLIC, anon, authenticated;
```

#### Secure Server-Side Execution Protocol
1. Client submits `{ order_id, submitted_pin }` over TLS to the `confirm-delivery` Edge Function.
2. Edge Function checks `auth.uid() = rider_id`.
3. Edge Function retrieves `pin_hash` via privileged call.
4. Edge Function executes Argon2id verification (`argon2.verify(pin_hash, submitted_pin)`).
5. If **VALID**, Edge Function calls `execute_successful_delivery_confirmation(order_id)` via `service_role`.
6. If **INVALID**, Edge Function calls `record_failed_pin_attempt(order_id)`.

```sql
-- Privileged RPC: Executes atomic transition upon server-verified PIN
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
    RAISE EXCEPTION 'Delivery confirmation record not found' USING ERRCODE = 'KD404';
  END IF;
  
  IF v_rec.verification_status != 'pending' THEN
    RAISE EXCEPTION 'Delivery is already %', v_rec.verification_status USING ERRCODE = 'KD409';
  END IF;

  -- AFFECTED-ROW VERIFICATION: Must transition exactly 1 row from out_for_delivery
  UPDATE public.orders 
  SET status = 'delivery_confirmed', updated_at = now() 
  WHERE id = p_order_id AND status = 'out_for_delivery';
  
  GET DIAGNOSTICS v_order_rows = ROW_COUNT;
  IF v_order_rows != 1 THEN
    RAISE EXCEPTION 'Order state conflict: order % is not in out_for_delivery state', p_order_id USING ERRCODE = 'KD409';
  END IF;

  UPDATE public.delivery_confirmations 
  SET verification_status = 'verified', verified_at = now(), verified_by = p_rider_id 
  WHERE id = v_rec.id;

  -- Enqueue exactly 1 settlement queue job
  INSERT INTO public.settlement_queue (order_id, status) 
  VALUES (p_order_id, 'pending')
  ON CONFLICT (order_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'status', 'verified');
END;
$$;

-- Privileged RPC: Increments attempt count and locks on exhaustion
CREATE OR REPLACE FUNCTION public.record_failed_pin_attempt(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_rec FROM public.delivery_confirmations WHERE order_id = p_order_id FOR UPDATE;
  
  UPDATE public.delivery_confirmations 
  SET attempt_count = attempt_count + 1 
  WHERE id = v_rec.id;

  IF v_rec.attempt_count + 1 >= v_rec.max_attempts THEN
    UPDATE public.delivery_confirmations 
    SET verification_status = 'locked_exhausted' 
    WHERE id = v_rec.id;
    
    RETURN jsonb_build_object('success', false, 'status', 'locked_exhausted');
  END IF;

  RETURN jsonb_build_object('success', false, 'status', 'invalid_pin', 'remaining_attempts', (v_rec.max_attempts - (v_rec.attempt_count + 1)));
END;
$$;
```

---

## 4. Sequential Migration Roadmap

```text
Migration 1: 20261001000001_settlement_financial_ledgers.sql
             • order_financial_snapshots (with dual pricing and outflow bridge CHECKs)
             • create_order_financial_snapshot_and_payables RPC (authoritative creation)
             • order_settlement_status (with sticky settled_at & disbursement_failed status)
             • order_payables (with Model A immutability guards, recipient_id = profiles.id)
             • sync_order_settlement_status trigger (order-locked, atomic upsert)
             • payout_transactions (attempt-versioned references, state-machine transition guard trigger)
             • settlement_queue (with 1-job-per-order semantics, 90s worker lease)
             • platform_float_control & platform_float_reservations (60s max age, 5m reservation TTL)
             • platform_float_ledger (audit reconciliation table)
             • calculate_expected_transfer_cost_kobo function (fee + stamp duty)
             • can_disburse_payable function (authoritative eligibility gate)
             • order_refunds table and process_order_refund_request RPC (Scenarios A, B, C)

Migration 2: 20261001000002_partner_bank_vault_and_holds.sql
             • Add multi-stage bank status columns and payout_hold_until to vendors & riders
             • partner_bank_vault (AES-256-GCM isolated table with iv, auth_tag, key_id)
             • update_partner_bank_details RPC (validated against profile_id, restricted to service_role/admin)

Migration 3: 20261001000003_delivery_confirmation_pin_security.sql
             • delivery_confirmations (Argon2id encoded hash, 3-attempt lockout)
             • execute_successful_delivery_confirmation RPC (service_role, ROW_COUNT = 1 check)
             • record_failed_pin_attempt RPC (service_role attempt counter)
             • admin_override_delivery_confirmation RPC (Audited SuperAdmin gate)

Migration 4: 20261001000004_partner_receivables_clawback.sql
             • partner_receivables
             • receivable_recovery_logs (pre/post balance audit guarantee)
             • claim_partner_receivable_offset (serialized on profile lock, atomic audit logging)

Migration 5: 20261001000005_paystack_webhook_events.sql
             • paystack_webhook_events (Composite fingerprint idempotency)
             • State-transition idempotency guards
             • Reversal liability reopening trigger

Migration 6: Edge Functions Deployment
             • confirm-delivery (Server-side Argon2id evaluation & service_role RPC invocation)
             • process-settlement-worker (Distributed queue consumer, float reservation, eligibility gate)
             • paystack-webhook-settlement (HMAC verification, durable persistence, & reconciliation)
```

---

## 5. Architectural Approval Gate

This consolidated v1.2.3 document addresses every single blocker, race condition, float concurrency trap, transfer fee and stamp duty regulation, stale balance invariant, refund conflict scenario, server-side cryptographic KMS boundary, and Paystack integration requirement. 

**Antigravity will not proceed to write Migration 1 until this specification is officially approved.**
