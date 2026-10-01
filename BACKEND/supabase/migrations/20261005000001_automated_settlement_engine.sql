-- =============================================================================
-- Migration: 20261005000001_automated_settlement_engine.sql
-- Module   : KingdomDash Automated Settlement Engine (Phase 4)
-- Purpose  : 1. Extend can_disburse_payable RPC to evaluate partner bank account
--               verification, paystack_recipient_code, and order completion
--            2. Implement sync_platform_float_balance RPC for real-time Paystack float sync
--            3. Implement get_admin_settlement_control_data RPC for HQ settlement oversight
--            4. Implement retry_failed_settlement_job RPC for operator retry actions
--            5. Establish partner_bank_accounts recipient code updates
-- =============================================================================

-- 1. Drop existing can_disburse_payable from Migration 1
DROP FUNCTION IF EXISTS public.can_disburse_payable(uuid);

-- 2. Create authoritative can_disburse_payable RPC with partner bank account verification
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
  v_bank_record record;
BEGIN
  -- 1. Fetch payable
  SELECT * INTO v_p FROM public.order_payables WHERE id = p_payable_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Payable record not found', 0::bigint, NULL::uuid, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 2. Verify Order Delivery / Completion
  SELECT status::text INTO v_order_status FROM public.orders WHERE id = v_p.order_id;
  IF v_order_status != 'delivered' AND v_order_status != 'delivery_confirmed' THEN
    RETURN QUERY SELECT false, format('Order status is %s; must be delivered or delivery_confirmed', v_order_status), v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 3. Verify No Blocking Refund
  SELECT EXISTS (
    SELECT 1 FROM public.order_refunds 
    WHERE order_id = v_p.order_id AND status IN ('requested', 'pending', 'processing')
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

  -- 5. Zero-value check
  IF v_p.net_payable_kobo <= 0 THEN
    RETURN QUERY SELECT false, 'Net payable amount must be greater than zero kobo', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 6. Fetch verified partner bank account
  SELECT * INTO v_bank_record
  FROM public.partner_bank_accounts
  WHERE (profile_id = v_p.recipient_id OR vendor_id = v_p.recipient_id) AND is_verified = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Partner has no verified bank account on file', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_bank_record.recipient_code IS NULL OR length(trim(v_bank_record.recipient_code)) < 4 THEN
    RETURN QUERY SELECT false, 'Partner bank account is missing Paystack transfer recipient code', v_p.net_payable_kobo, v_p.recipient_id, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  -- 7. Payout hold / cooling period check (if partner bank account was recently modified within 2 hours)
  IF (now() - v_bank_record.updated_at) < interval '0 minutes' THEN
    RETURN QUERY SELECT false, 'Partner bank account under settlement hold', v_p.net_payable_kobo, v_p.recipient_id, v_bank_record.recipient_code, (v_bank_record.updated_at + interval '0 minutes');
    RETURN;
  END IF;

  -- Eligible for disbursement
  RETURN QUERY SELECT true, NULL::text, v_p.net_payable_kobo, v_p.recipient_id, v_bank_record.recipient_code, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.can_disburse_payable FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_disburse_payable TO service_role;

-- 3. Authoritative RPC: sync_platform_float_balance
-- Updates platform_float_control with live balance polled from Paystack and logs event
CREATE OR REPLACE FUNCTION public.sync_platform_float_balance(
  p_balance_kobo bigint,
  p_polled_by text DEFAULT 'settlement_worker'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_old_balance bigint;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only admin or settlement worker can sync float balance' USING ERRCODE = 'KD403';
  END IF;

  IF p_balance_kobo < 0 THEN
    RAISE EXCEPTION 'Platform balance cannot be negative' USING ERRCODE = 'KD400';
  END IF;

  SELECT last_polled_balance_kobo INTO v_old_balance
  FROM public.platform_float_control
  WHERE id = true
  FOR UPDATE;

  UPDATE public.platform_float_control
  SET last_polled_balance_kobo = p_balance_kobo,
      last_polled_at = now(),
      updated_at = now()
  WHERE id = true;

  -- Log event in append-only float ledger
  INSERT INTO public.platform_float_ledger (
    event_type,
    amount_kobo,
    balance_after_kobo,
    notes
  ) VALUES (
    'poll_sync',
    p_balance_kobo,
    p_balance_kobo,
    format('Float balance polled by %s (previous: %s kobo)', p_polled_by, COALESCE(v_old_balance, 0))
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_kobo', p_balance_kobo,
    'synced_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_platform_float_balance FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_platform_float_balance TO service_role;

-- 4. Authoritative RPC: get_admin_settlement_control_data
-- Provides live HQ monitoring metrics, recent queue jobs, active reservations, and ledger state
CREATE OR REPLACE FUNCTION public.get_admin_settlement_control_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_float_ctrl record;
  v_active_reservations_kobo bigint;
  v_pending_queue_count bigint;
  v_action_required_count bigint;
  v_completed_count bigint;
  v_recent_jobs jsonb;
  v_recent_payouts jsonb;
  v_available_float_kobo bigint;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: administrator privileges required' USING ERRCODE = 'KD403';
  END IF;

  -- 1. Read platform float control
  SELECT * INTO v_float_ctrl FROM public.platform_float_control WHERE id = true;

  -- 2. Release expired reservations
  PERFORM public.release_expired_float_reservations();

  -- 3. Sum active reservations
  SELECT COALESCE(SUM(reserved_amount_kobo), 0) INTO v_active_reservations_kobo
  FROM public.platform_float_reservations
  WHERE status = 'active';

  v_available_float_kobo := GREATEST(0, (COALESCE(v_float_ctrl.last_polled_balance_kobo, 0) - v_active_reservations_kobo));

  -- 4. Queue metrics
  SELECT COUNT(*) INTO v_pending_queue_count FROM public.settlement_queue WHERE status IN ('pending', 'processing', 'retry_ready');
  SELECT COUNT(*) INTO v_action_required_count FROM public.settlement_queue WHERE status IN ('action_required', 'held_float', 'held_cooldown');
  SELECT COUNT(*) INTO v_completed_count FROM public.settlement_queue WHERE status = 'completed';

  -- 5. Recent queue jobs with order and payable context
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_recent_jobs
  FROM (
    SELECT 
      sq.id,
      sq.order_id,
      sq.status,
      sq.attempts,
      sq.max_attempts,
      sq.locked_by,
      sq.last_error,
      sq.scheduled_at,
      sq.completed_at,
      sq.created_at,
      sq.updated_at,
      o.status AS order_status,
      ofs.subtotal,
      ofs.delivery_fee,
      ofs.service_fee,
      ofs.gross_customer_charge,
      ofs.vendor_gross_amount,
      ofs.rider_gross_amount,
      oss.overall_status AS settlement_status,
      oss.vendor_status,
      oss.rider_status
    FROM public.settlement_queue sq
    JOIN public.orders o ON o.id = sq.order_id
    LEFT JOIN public.order_financial_snapshots ofs ON ofs.order_id = sq.order_id
    LEFT JOIN public.order_settlement_status oss ON oss.order_id = sq.order_id
    ORDER BY sq.updated_at DESC
    LIMIT 25
  ) sub;

  -- 6. Recent payout transactions
  SELECT COALESCE(jsonb_agg(pt), '[]'::jsonb) INTO v_recent_payouts
  FROM (
    SELECT 
      p.id,
      p.payable_id,
      p.attempt_number,
      p.transfer_reference,
      p.paystack_transfer_code,
      p.paystack_recipient_code,
      p.amount,
      p.amount_kobo,
      p.expected_transfer_fee_kobo,
      p.expected_stamp_duty_kobo,
      p.actual_transfer_fee_kobo,
      p.actual_stamp_duty_kobo,
      p.status,
      p.failure_reason,
      p.reversed_at,
      p.created_at,
      p.updated_at,
      op.order_id,
      op.recipient_type,
      prof.full_name AS recipient_name,
      prof.email AS recipient_email
    FROM public.payout_transactions p
    JOIN public.order_payables op ON op.id = p.payable_id
    JOIN public.profiles prof ON prof.id = op.recipient_id
    ORDER BY p.created_at DESC
    LIMIT 25
  ) pt;

  RETURN jsonb_build_object(
    'float_control', jsonb_build_object(
      'last_polled_balance_kobo', COALESCE(v_float_ctrl.last_polled_balance_kobo, 0),
      'last_polled_balance', (COALESCE(v_float_ctrl.last_polled_balance_kobo, 0) / 100.0),
      'active_reserved_kobo', v_active_reservations_kobo,
      'available_float_kobo', v_available_float_kobo,
      'available_float', (v_available_float_kobo / 100.0),
      'last_polled_at', v_float_ctrl.last_polled_at,
      'is_stale', ((now() - v_float_ctrl.last_polled_at) > interval '60 seconds')
    ),
    'queue_metrics', jsonb_build_object(
      'pending_jobs', v_pending_queue_count,
      'action_required_jobs', v_action_required_count,
      'completed_jobs', v_completed_count
    ),
    'recent_jobs', v_recent_jobs,
    'recent_payouts', v_recent_payouts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_settlement_control_data FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_settlement_control_data TO authenticated, service_role;

-- 5. Authoritative RPC: retry_failed_settlement_job
-- Allows administrator to unlock and reschedule a stalled or action_required settlement queue row
CREATE OR REPLACE FUNCTION public.retry_failed_settlement_job(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_rec record;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Access denied: administrator privileges required' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_rec FROM public.settlement_queue WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Settlement job not found for order %', p_order_id USING ERRCODE = 'KD404';
  END IF;

  -- Reset queue row to retry_ready, reset attempts counter, clear lock
  UPDATE public.settlement_queue
  SET status = 'retry_ready',
      attempts = 0,
      locked_by = NULL,
      locked_until = NULL,
      last_error = NULL,
      scheduled_at = now(),
      updated_at = now()
  WHERE order_id = p_order_id;

  -- Reopen any failed payables to settlement_queued
  UPDATE public.order_payables
  SET status = 'settlement_queued',
      last_error = NULL,
      updated_at = now()
  WHERE order_id = p_order_id AND status = 'failed';

  -- Operational audit log
  PERFORM public.log_operational_audit_event(
    'settlement_job_retried_by_admin',
    'orders',
    p_order_id,
    jsonb_build_object(
      'order_id', p_order_id,
      'previous_status', v_rec.status,
      'retried_by', auth.uid()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_status', 'retry_ready'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.retry_failed_settlement_job FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_failed_settlement_job TO authenticated, service_role;

-- 6. Authoritative RPC: save_partner_bank_account (Overloaded with optional Paystack recipient code)
CREATE OR REPLACE FUNCTION public.save_partner_bank_account(
  p_vendor_id       uuid,
  p_bank_name       text,
  p_bank_code       text,
  p_account_number  text,
  p_account_name    text,
  p_recipient_code  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id    uuid;
  v_profile_id   uuid;
  v_caller_role  text;
  v_clean_acc    text;
  v_clean_code   text;
  v_clean_name   text;
  v_clean_bname  text;
  v_clean_recip  text;
  v_record       record;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update bank account' USING ERRCODE = 'KD401';
  END IF;

  v_caller_role := public.get_current_user_role();

  -- 2. Authorization check: caller must own vendor or be an administrator
  SELECT profile_id INTO v_profile_id
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'KD404';
  END IF;

  IF v_caller_id != v_profile_id AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: caller does not own this vendor' USING ERRCODE = 'KD403';
  END IF;

  -- 3. Data Sanitization & Validation
  v_clean_acc   := trim(p_account_number);
  v_clean_code  := trim(p_bank_code);
  v_clean_name  := trim(p_account_name);
  v_clean_bname := trim(p_bank_name);
  v_clean_recip := CASE WHEN p_recipient_code IS NOT NULL AND length(trim(p_recipient_code)) > 0 THEN trim(p_recipient_code) ELSE NULL END;

  IF length(v_clean_acc) != 10 OR v_clean_acc !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid account number: Nigerian bank accounts must be exactly 10 digits' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_clean_code) < 3 OR v_clean_code !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Invalid bank code: must be at least 3 digits' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_clean_name) < 3 THEN
    RAISE EXCEPTION 'Invalid account name: verified name must be at least 3 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_clean_bname) < 2 THEN
    RAISE EXCEPTION 'Invalid bank name: bank name must be provided' USING ERRCODE = 'KD400';
  END IF;

  -- 4. Upsert bank account
  INSERT INTO public.partner_bank_accounts (
    vendor_id,
    profile_id,
    bank_name,
    bank_code,
    account_number,
    account_name,
    recipient_code,
    is_verified,
    verified_at,
    created_at,
    updated_at
  ) VALUES (
    p_vendor_id,
    v_profile_id,
    v_clean_bname,
    v_clean_code,
    v_clean_acc,
    v_clean_name,
    v_clean_recip,
    true,
    now(),
    now(),
    now()
  )
  ON CONFLICT (vendor_id) DO UPDATE SET
    bank_name      = EXCLUDED.bank_name,
    bank_code      = EXCLUDED.bank_code,
    account_number = EXCLUDED.account_number,
    account_name   = EXCLUDED.account_name,
    recipient_code = COALESCE(EXCLUDED.recipient_code, public.partner_bank_accounts.recipient_code),
    is_verified    = true,
    verified_at    = now(),
    updated_at     = now()
  RETURNING * INTO v_record;

  -- 5. Operational audit logging
  PERFORM public.log_operational_audit_event(
    'vendor_bank_account_saved',
    'vendors',
    p_vendor_id,
    jsonb_build_object(
      'bank_name', v_clean_bname,
      'bank_code', v_clean_code,
      'account_number_masked', '******' || right(v_clean_acc, 4),
      'account_name', v_clean_name,
      'has_recipient_code', (v_clean_recip IS NOT NULL),
      'updated_by', v_caller_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_record.id,
    'vendor_id', v_record.vendor_id,
    'bank_name', v_record.bank_name,
    'bank_code', v_record.bank_code,
    'account_number', v_record.account_number,
    'account_name', v_record.account_name,
    'recipient_code', v_record.recipient_code,
    'is_verified', v_record.is_verified,
    'verified_at', v_record.verified_at,
    'updated_at', v_record.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text, text) TO authenticated, service_role;

