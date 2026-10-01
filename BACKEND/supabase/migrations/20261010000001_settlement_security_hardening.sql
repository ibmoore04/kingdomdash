-- =============================================================================
-- Migration: 20261010000001_settlement_security_hardening.sql
-- Module   : KingdomDash Settlement Engine Comprehensive Security Hardening Patch
-- Purpose  : 1. Explicit table-level DML REVOKE on all core financial ledgers (Defense-in-Depth)
--            2. Terminal state protection in admin_override_delivery_confirmation
--            3. Deliverable state constraint in execute_successful_delivery_confirmation
--            4. Authoritative gross entitlement derivation in claim_partner_receivable_offset
--            5. Caller authorization enforcement in guard_order_payable_mutations trigger
-- =============================================================================

-- ------------------------------------------------------------------------------
-- 1. Explicit Table-Level DML REVOKE on Core Settlement Ledgers (§18)
-- Replaces reliance on implicit RLS filter emptiness with strict SQL engine boundaries.
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.order_financial_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_settlement_status FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_payables FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.payout_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.settlement_queue FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_float_control FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_float_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.platform_float_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.order_refunds FROM PUBLIC, anon, authenticated;

-- Grant selective SELECT to authenticated roles where governed by RLS
GRANT SELECT ON public.order_payables TO authenticated;
GRANT SELECT ON public.order_settlement_status TO authenticated;
GRANT SELECT ON public.order_financial_snapshots TO authenticated;
GRANT SELECT ON public.payout_transactions TO authenticated;
GRANT SELECT ON public.settlement_queue TO authenticated;
GRANT SELECT ON public.platform_float_control TO authenticated;

-- Grant full operational authority exclusively to trusted service_role
GRANT ALL ON public.order_financial_snapshots TO service_role;
GRANT ALL ON public.order_settlement_status TO service_role;
GRANT ALL ON public.order_payables TO service_role;
GRANT ALL ON public.payout_transactions TO service_role;
GRANT ALL ON public.settlement_queue TO service_role;
GRANT ALL ON public.platform_float_control TO service_role;
GRANT ALL ON public.platform_float_reservations TO service_role;
GRANT ALL ON public.platform_float_ledger TO service_role;
GRANT ALL ON public.order_refunds TO service_role;

-- ------------------------------------------------------------------------------
-- 2. Caller Authorization Enforcement in guard_order_payable_mutations Trigger (§18)
-- Prevents any unauthorized user role from attempting DML on payables even if granted table access.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_order_payable_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- 0. CALLER PRIVILEGE CHECK: Mutating payables is restricted to admin or service_role
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only trusted settlement workers and administrators can mutate order payables'
      USING ERRCODE = 'KD403';
  END IF;

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

-- ------------------------------------------------------------------------------
-- 3. Terminal Order State Protection in admin_override_delivery_confirmation (§12)
-- Strictly prevents overriding delivery confirmation on cancelled, refunded, or disputed orders.
-- ------------------------------------------------------------------------------
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
  v_order_status text;
BEGIN
  v_caller_role := public.get_current_user_role();
  v_caller_id := auth.uid();

  IF v_caller_role NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: SuperAdmin or Admin privileges required' USING ERRCODE = 'KD403';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'A substantive override reason (minimum 5 characters) is required' USING ERRCODE = 'KD400';
  END IF;

  -- 1. Exclusively lock order and verify non-terminal state (§12)
  SELECT status INTO v_order_status FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % does not exist', p_order_id USING ERRCODE = 'KD404';
  END IF;

  IF v_order_status IN ('cancelled', 'refunded', 'disputed') THEN
    RAISE EXCEPTION 'Illegal operation: cannot override delivery confirmation on order in terminal state: %', v_order_status
      USING ERRCODE = 'KD409';
  END IF;

  -- 2. Lock confirmation record
  SELECT * INTO v_rec FROM public.delivery_confirmations WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery confirmation record not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- 3. Update delivery confirmation
  UPDATE public.delivery_confirmations
  SET verification_status = 'admin_overridden',
      verified_at = now(),
      verified_by = v_caller_id,
      override_reason = trim(p_reason),
      updated_at = now()
  WHERE id = v_rec.id;

  -- 4. Transition order to delivery_confirmed
  UPDATE public.orders
  SET status = 'delivery_confirmed',
      delivered_at = COALESCE(delivered_at, now()),
      updated_at = now()
  WHERE id = p_order_id;

  -- 5. Advance payables to settlement_queued
  UPDATE public.order_payables
  SET status = 'settlement_queued',
      updated_at = now()
  WHERE order_id = p_order_id AND status = 'payable_pending';

  -- 6. Enqueue into settlement_queue
  INSERT INTO public.settlement_queue (order_id, status, scheduled_at, updated_at) 
  VALUES (p_order_id, 'pending', now(), now())
  ON CONFLICT (order_id) DO UPDATE SET
    status = CASE 
      WHEN public.settlement_queue.status IN ('completed', 'cancelled') THEN public.settlement_queue.status 
      ELSE 'pending' 
    END,
    updated_at = now()
  WHERE public.settlement_queue.status NOT IN ('completed', 'cancelled', 'processing');

  -- 7. Operational audit log
  PERFORM public.log_operational_audit_event(
    'delivery_confirmation_admin_override',
    'orders',
    p_order_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'reason', trim(p_reason),
      'overridden_by', v_caller_id,
      'previous_status', v_rec.verification_status,
      'order_status_before_override', v_order_status
    )
  );

  RETURN jsonb_build_object('success', true, 'status', 'admin_overridden', 'order_id', p_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_delivery_confirmation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_override_delivery_confirmation(uuid, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Deliverable State Constraint in execute_successful_delivery_confirmation (§12)
-- Fallback update requires status = 'delivered' and rejects any unexpected state.
-- ------------------------------------------------------------------------------
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
    -- Strictly accept only if order is already marked delivered
    UPDATE public.orders 
    SET status = 'delivery_confirmed',
        updated_at = now() 
    WHERE id = p_order_id AND status = 'delivered';

    GET DIAGNOSTICS v_order_rows = ROW_COUNT;
    IF v_order_rows != 1 THEN
      RAISE EXCEPTION 'Order % is not in a valid deliverable state for confirmation', p_order_id USING ERRCODE = 'KD409';
    END IF;
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

-- ------------------------------------------------------------------------------
-- 5. Authoritative Gross Entitlement Derivation in claim_partner_receivable_offset (§9)
-- Queries the locked payable directly to eliminate caller-side parameter mismatches.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_partner_receivable_offset(
  p_partner_id uuid,
  p_order_id uuid,
  p_gross_entitlement_kobo bigint DEFAULT NULL
)
RETURNS TABLE (
  claimed_deduction_kobo bigint,
  net_payable_kobo bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
  v_authoritative_gross bigint;
  v_remaining_gross bigint;
  v_total_claimed bigint := 0;
  v_initial_debt bigint;
  v_to_deduct bigint;
  v_post_debt bigint;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only settlement worker can claim receivable offsets' USING ERRCODE = 'KD403';
  END IF;

  -- 1. AUTHORITATIVE PAYABLE LOCK & DERIVATION: Derive gross directly from ledger row
  SELECT gross_entitlement_kobo INTO v_authoritative_gross
  FROM public.order_payables
  WHERE order_id = p_order_id AND recipient_id = p_partner_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payable record not found for order % and partner %', p_order_id, p_partner_id USING ERRCODE = 'KD404';
  END IF;

  -- Verify caller parameter if explicitly supplied
  IF p_gross_entitlement_kobo IS NOT NULL AND p_gross_entitlement_kobo != v_authoritative_gross THEN
    RAISE EXCEPTION 'Entitlement parameter mismatch: caller supplied % kobo, but database ledger records % kobo',
      p_gross_entitlement_kobo, v_authoritative_gross USING ERRCODE = 'KD409';
  END IF;

  v_remaining_gross := v_authoritative_gross;

  -- 2. PARTNER-LEVEL SERIALIZATION: Lock partner profile row
  PERFORM 1 FROM public.profiles WHERE id = p_partner_id FOR UPDATE;

  -- 3. Deterministically lock debt rows ordered by age and ID
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

  -- 4. Update order payable row
  UPDATE public.order_payables
  SET receivable_deduction_kobo = v_total_claimed,
      net_payable_kobo = (v_authoritative_gross - v_total_claimed),
      status = CASE WHEN (v_authoritative_gross - v_total_claimed) = 0 THEN 'clawback_offset' ELSE status END,
      updated_at = now()
  WHERE order_id = p_order_id AND recipient_id = p_partner_id;

  RETURN QUERY SELECT v_total_claimed, (v_authoritative_gross - v_total_claimed);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_partner_receivable_offset(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_partner_receivable_offset(uuid, uuid, bigint) TO service_role;
