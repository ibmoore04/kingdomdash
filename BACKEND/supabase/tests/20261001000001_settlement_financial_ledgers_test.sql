-- ==============================================================================
-- Test Suite: 20261001000001_settlement_financial_ledgers_test.sql
-- Module: KingdomDash Automated Settlement & Split-Payment Engine
-- Scope: Hostile adversarial verification of Migration 1 Core Financial Primitives
-- Specification: v1.2.3 Final Hardened Technical Specification (Compliance Hardened)
-- ==============================================================================

BEGIN;

-- Setup Test Schema / Sandbox
DO $$
DECLARE
  v_test_customer_id uuid := gen_random_uuid();
  v_test_vendor_user_id uuid := gen_random_uuid();
  v_test_rider_user_id uuid := gen_random_uuid();
  v_test_other_user_id uuid := gen_random_uuid();
  v_test_order_id uuid := gen_random_uuid();
  v_res jsonb;
  v_rec record;
  v_count integer;
BEGIN
  RAISE NOTICE '=== STARTING MIGRATION 1 HARDENED ADVERSARIAL TEST SUITE ===';

  -- 1. Create Mock Profiles & Order (Strictly using verified schema columns)
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES 
    (v_test_customer_id, 'test_cust@kingdomdash.com', 'Test Customer', '08011111111', 'customer'),
    (v_test_vendor_user_id, 'test_vendor@kingdomdash.com', 'Test Vendor', '08022222222', 'vendor'),
    (v_test_rider_user_id, 'test_rider@kingdomdash.com', 'Test Fleet Rider', '08033333333', 'rider'),
    (v_test_other_user_id, 'test_other@kingdomdash.com', 'Other User', '08044444444', 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.vendors (profile_id, business_name, business_type, business_address, phone, email)
  VALUES (v_test_vendor_user_id, 'Test Vendor Store', 'restaurant', '123 Test St', '08012345678', 'vendor@test.com')
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.riders (profile_id, is_available)
  VALUES (v_test_rider_user_id, true)
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, service_fee, total)
  VALUES (v_test_order_id, v_test_customer_id, 'food', 'in_transit', 'Pickup Spot', 'Dropoff Spot', 10000.00, 1500.00, 150.00, 11650.00)
  ON CONFLICT (id) DO NOTHING;

  -- ----------------------------------------------------------------------------
  -- TEST 1: Dual Conservation & Negative Allocation Prevention
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 1: Testing negative allocation and conservation checks...';
  
  -- Attempt creation where vendor + rider exceeds customer charge (Negative platform allocation)
  BEGIN
    PERFORM public.create_order_financial_snapshot_and_payables(
      p_order_id := v_test_order_id,
      p_payment_reference := 'PAY_TEST_001',
      p_subtotal_kobo := 1000000,      -- ₦10,000
      p_delivery_fee_kobo := 150000,    -- ₦1,500
      p_service_fee_kobo := 15000,     -- ₦150 (authoritative matching orders.service_fee)
      p_discount_amount_kobo := 0,
      p_vendor_gross_kobo := 900000,    -- ₦9,000
      p_rider_gross_kobo := 300000,     -- ₦3,000 (Total ₦12,000 > ₦11,650!)
      p_vendor_profile_id := v_test_vendor_user_id,
      p_rider_profile_id := v_test_rider_user_id
    );
    RAISE EXCEPTION 'TEST 1 FAILED: Negative platform allocation was not rejected!';
  EXCEPTION WHEN SQLSTATE 'KD400' THEN
    RAISE NOTICE '  ✓ PASS: Commercial negative allocation rejected with KD400';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 1b: Divergent Monetary Value Prevention (Snapshot cannot diverge from order pricing quote)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 1b: Testing divergence between order pricing quote and payment snapshot...';
  BEGIN
    PERFORM public.create_order_financial_snapshot_and_payables(
      p_order_id := v_test_order_id,
      p_payment_reference := 'PAY_TEST_001_TAMPER',
      p_subtotal_kobo := 1000000,
      p_delivery_fee_kobo := 150000,
      p_service_fee_kobo := 20000,     -- ₦200 != ₦150 on orders table!
      p_discount_amount_kobo := 0,
      p_vendor_gross_kobo := 800000,
      p_rider_gross_kobo := 150000,
      p_vendor_profile_id := v_test_vendor_user_id,
      p_rider_profile_id := v_test_rider_user_id
    );
    RAISE EXCEPTION 'TEST 1b FAILED: Divergent service_fee_kobo was not rejected!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Divergent service_fee_kobo rejected with KD409';
  END;

  -- Valid Snapshot Creation (₦11,650 gross = ₦8,000 vendor + ₦1,500 rider + ₦2,150 platform)
  v_res := public.create_order_financial_snapshot_and_payables(
    p_order_id := v_test_order_id,
    p_payment_reference := 'PAY_TEST_001',
    p_subtotal_kobo := 1000000,      -- ₦10,000
    p_delivery_fee_kobo := 150000,    -- ₦1,500
    p_service_fee_kobo := 15000,     -- ₦150
    p_discount_amount_kobo := 0,
    p_vendor_gross_kobo := 800000,    -- ₦8,000
    p_rider_gross_kobo := 150000,     -- ₦1,500
    p_vendor_profile_id := v_test_vendor_user_id,
    p_rider_profile_id := v_test_rider_user_id
  );
  ASSERT (v_res->>'success')::boolean = true, 'TEST 1 FAILED: Valid snapshot creation failed';
  RAISE NOTICE '  ✓ PASS: Valid snapshot and payables created successfully';

  -- ----------------------------------------------------------------------------
  -- TEST 2: Snapshot Immutability (Trigger Protection)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 2: Testing snapshot immutability triggers...';
  BEGIN
    UPDATE public.order_financial_snapshots
    SET subtotal_kobo = 2000000
    WHERE order_id = v_test_order_id;
    RAISE EXCEPTION 'TEST 2 FAILED: Snapshot UPDATE was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: Snapshot UPDATE blocked with KD403';
  END;

  BEGIN
    DELETE FROM public.order_financial_snapshots WHERE order_id = v_test_order_id;
    RAISE EXCEPTION 'TEST 2 FAILED: Snapshot DELETE was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: Snapshot DELETE blocked with KD403';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 3: Creation RPC Idempotency, Rule Version & Recipient Conflict Detection
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 3: Testing creation RPC idempotency & recipient conflict detection...';
  
  -- Exact replay -> success (idempotent replay)
  v_res := public.create_order_financial_snapshot_and_payables(
    p_order_id := v_test_order_id,
    p_payment_reference := 'PAY_TEST_001',
    p_subtotal_kobo := 1000000,
    p_delivery_fee_kobo := 150000,
    p_service_fee_kobo := 15000,
    p_discount_amount_kobo := 0,
    p_vendor_gross_kobo := 800000,
    p_rider_gross_kobo := 150000,
    p_vendor_profile_id := v_test_vendor_user_id,
    p_rider_profile_id := v_test_rider_user_id,
    p_fee_rule_version := '2026-02-18'
  );
  ASSERT (v_res->>'idempotent_replay')::boolean = true, 'TEST 3 FAILED: Idempotent replay was not recognized';
  RAISE NOTICE '  ✓ PASS: Identical replay recognised as idempotent';

  -- Conflicting replay (different fee_rule_version) -> throws KD409
  BEGIN
    PERFORM public.create_order_financial_snapshot_and_payables(
      p_order_id := v_test_order_id,
      p_payment_reference := 'PAY_TEST_001',
      p_subtotal_kobo := 1000000,
      p_delivery_fee_kobo := 150000,
      p_service_fee_kobo := 15000,
      p_discount_amount_kobo := 0,
      p_vendor_gross_kobo := 800000,
      p_rider_gross_kobo := 150000,
      p_vendor_profile_id := v_test_vendor_user_id,
      p_rider_profile_id := v_test_rider_user_id,
      p_fee_rule_version := '2027-01-01'
    );
    RAISE EXCEPTION 'TEST 3 FAILED: Conflicting fee_rule_version was not rejected!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Conflicting fee_rule_version rejected with KD409';
  END;

  -- Conflicting replay (different vendor recipient) -> throws KD409
  DECLARE
    v_other_vendor_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, role)
    VALUES (v_other_vendor_id, 'other_vnd@kd.com', 'Other Vendor', '08099999999', 'vendor');

    PERFORM public.create_order_financial_snapshot_and_payables(
      p_order_id := v_test_order_id,
      p_payment_reference := 'PAY_TEST_001',
      p_subtotal_kobo := 1000000,
      p_delivery_fee_kobo := 150000,
      p_service_fee_kobo := 15000,
      p_discount_amount_kobo := 0,
      p_vendor_gross_kobo := 800000,
      p_rider_gross_kobo := 150000,
      p_vendor_profile_id := v_other_vendor_id, -- Substituted vendor!
      p_rider_profile_id := v_test_rider_user_id
    );
    RAISE EXCEPTION 'TEST 3 FAILED: Conflicting vendor recipient was not rejected!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Substituted vendor recipient rejected with KD409';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 4: order_payables State Machine & Identity Immutability
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 4: Testing comprehensive order_payables state machine and immutability...';
  
  -- Identity field: recipient_id modification MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET recipient_id = v_test_other_user_id
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: recipient_id modification was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: recipient_id modification blocked with KD403';
  END;

  -- Identity field: recipient_type modification MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET recipient_type = 'rider'
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: recipient_type modification was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: recipient_type modification blocked with KD403';
  END;

  -- Identity field: order_id modification MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET order_id = gen_random_uuid()
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: order_id modification was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: order_id modification blocked with KD403';
  END;

  -- Financial field: gross_entitlement_kobo modification MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET gross_entitlement_kobo = 999999
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: Payable gross entitlement was altered!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: Payable gross_entitlement_kobo mutation blocked with KD403';
  END;

  -- DELETE protection on order_payables MUST FAIL
  BEGIN
    DELETE FROM public.order_payables WHERE order_id = v_test_order_id;
    RAISE EXCEPTION 'TEST 4 FAILED: DELETE on order_payables was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD403' THEN
    RAISE NOTICE '  ✓ PASS: DELETE on order_payables blocked with KD403';
  END;

  -- Illegal direct transition: payable_pending -> settled MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET status = 'settled'
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: payable_pending -> settled was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Illegal payable_pending -> settled blocked with KD409';
  END;

  -- Illegal direct transition: payable_pending -> disbursing MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET status = 'disbursing'
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: payable_pending -> disbursing was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Illegal payable_pending -> disbursing blocked with KD409';
  END;

  -- Legal transition: payable_pending -> settlement_queued MUST PASS
  UPDATE public.order_payables
  SET status = 'settlement_queued'
  WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
  RAISE NOTICE '  ✓ PASS: Legal payable_pending -> settlement_queued accepted';

  -- Legal transition: settlement_queued -> disbursing MUST PASS
  UPDATE public.order_payables
  SET status = 'disbursing'
  WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
  RAISE NOTICE '  ✓ PASS: Legal settlement_queued -> disbursing accepted';

  -- Legal transition: disbursing -> settled MUST PASS
  UPDATE public.order_payables
  SET status = 'settled'
  WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
  RAISE NOTICE '  ✓ PASS: Legal disbursing -> settled accepted';

  -- Illegal transition: settled -> cancelled MUST FAIL
  BEGIN
    UPDATE public.order_payables
    SET status = 'cancelled'
    WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
    RAISE EXCEPTION 'TEST 4 FAILED: Transition from settled to cancelled was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD409' THEN
    RAISE NOTICE '  ✓ PASS: Illegal settled -> cancelled transition blocked with KD409';
  END;

  -- Legal transition: settled -> payable_reopened MUST PASS
  UPDATE public.order_payables
  SET status = 'payable_reopened'
  WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
  RAISE NOTICE '  ✓ PASS: Legal settled -> payable_reopened accepted';

  -- Re-settle vendor legally: payable_reopened -> disbursing -> settled
  UPDATE public.order_payables SET status = 'disbursing' WHERE order_id = v_test_order_id AND recipient_type = 'vendor';
  UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_test_order_id AND recipient_type = 'vendor';

  -- Test terminal status: cancelled -> settled MUST FAIL
  DECLARE
    v_term_order_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_term_order_id, v_test_customer_id, 'food', 'pending', 'P', 'D', 1000.00, 200.00, 1200.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_term_order_id, 'PAY_TERM_TEST', 100000, 20000, 0, 0, 80000, 20000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    UPDATE public.order_payables SET status = 'cancelled' WHERE order_id = v_term_order_id AND recipient_type = 'vendor';
    
    BEGIN
      UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_term_order_id AND recipient_type = 'vendor';
      RAISE EXCEPTION 'TEST 4 FAILED: cancelled -> settled was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Terminal cancelled status cannot transition to settled (KD409)';
    END;

    -- Test clawback_offset -> settled MUST FAIL
    UPDATE public.order_payables 
    SET status = 'clawback_offset' 
    WHERE order_id = v_term_order_id AND recipient_type = 'rider';

    BEGIN
      UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_term_order_id AND recipient_type = 'rider';
      RAISE EXCEPTION 'TEST 4 FAILED: clawback_offset -> settled was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Terminal clawback_offset status cannot transition to settled (KD409)';
    END;
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 5: Monotonic Sticky settled_at & Reversal Reopening
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 5: Testing monotonic settled_at preservation...';
  
  -- Transition rider legally to settled to achieve overall 'settled'
  UPDATE public.order_payables SET status = 'settlement_queued' WHERE order_id = v_test_order_id AND recipient_type = 'rider';
  UPDATE public.order_payables SET status = 'disbursing' WHERE order_id = v_test_order_id AND recipient_type = 'rider';
  UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_test_order_id AND recipient_type = 'rider';

  SELECT settled_at INTO v_rec 
  FROM public.order_settlement_status 
  WHERE order_id = v_test_order_id;
  ASSERT v_rec.settled_at IS NOT NULL, 'TEST 5 FAILED: settled_at was not populated on full settlement';
  RAISE NOTICE '  ✓ PASS: settled_at populated on complete settlement';

  -- Simulate NIBSS reversal on vendor payable
  UPDATE public.order_payables
  SET status = 'payable_reopened'
  WHERE order_id = v_test_order_id AND recipient_type = 'vendor';

  SELECT overall_status, settled_at, reopened_at INTO v_rec 
  FROM public.order_settlement_status 
  WHERE order_id = v_test_order_id;
  ASSERT v_rec.overall_status = 'settlement_partial', 'TEST 5 FAILED: Overall status did not downgrade to settlement_partial';
  ASSERT v_rec.settled_at IS NOT NULL, 'TEST 5 FAILED: settled_at was erased on reversal!';
  ASSERT v_rec.reopened_at IS NOT NULL, 'TEST 5 FAILED: reopened_at was not populated';
  RAISE NOTICE '  ✓ PASS: settled_at sticky and preserved after NIBSS reversal';

  -- ----------------------------------------------------------------------------
  -- TEST 6: Payout Transactions Immutability, Recipient Code & DELETE Block
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 6: Testing payout transaction immutability, recipient code, and DELETE guards...';
  
  DECLARE
    v_vendor_payable_id uuid;
    v_payout_tx_id uuid;
  BEGIN
    SELECT id INTO v_vendor_payable_id FROM public.order_payables WHERE order_id = v_test_order_id AND recipient_type = 'vendor';

    INSERT INTO public.payout_transactions (
      payable_id, attempt_number, transfer_reference, paystack_recipient_code, amount_kobo,
      expected_transfer_fee_kobo, expected_stamp_duty_kobo, status
    ) VALUES (
      v_vendor_payable_id, 1, 'kd_ord_test1234567890123456_vnd_v1', 'RCP_test1234', 800000,
      2500, 0, 'pending'
    ) RETURNING id INTO v_payout_tx_id;

    -- Financial field mutation blocked
    BEGIN
      UPDATE public.payout_transactions SET amount_kobo = 1000000 WHERE id = v_payout_tx_id;
      RAISE EXCEPTION 'TEST 6 FAILED: payout amount_kobo was mutated!';
    EXCEPTION WHEN SQLSTATE 'KD403' THEN
      RAISE NOTICE '  ✓ PASS: Payout transaction financial fields immutable';
    END;

    -- paystack_recipient_code mutation blocked
    BEGIN
      UPDATE public.payout_transactions SET paystack_recipient_code = 'RCP_malicious' WHERE id = v_payout_tx_id;
      RAISE EXCEPTION 'TEST 6 FAILED: paystack_recipient_code was mutated!';
    EXCEPTION WHEN SQLSTATE 'KD403' THEN
      RAISE NOTICE '  ✓ PASS: paystack_recipient_code mutation blocked with KD403';
    END;

    -- DELETE blocked on payout_transactions
    BEGIN
      DELETE FROM public.payout_transactions WHERE id = v_payout_tx_id;
      RAISE EXCEPTION 'TEST 6 FAILED: DELETE on payout_transactions was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD403' THEN
      RAISE NOTICE '  ✓ PASS: DELETE on payout_transactions blocked with KD403';
    END;

    -- Legal transition: pending -> success
    UPDATE public.payout_transactions SET status = 'success' WHERE id = v_payout_tx_id;
    RAISE NOTICE '  ✓ PASS: Legal pending -> success transition accepted';

    -- Illegal transition: success -> pending blocked
    BEGIN
      UPDATE public.payout_transactions SET status = 'pending' WHERE id = v_payout_tx_id;
      RAISE EXCEPTION 'TEST 6 FAILED: success -> pending was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Illegal backwards transition blocked with KD409';
    END;

    -- Legal transition: success -> reversed
    UPDATE public.payout_transactions SET status = 'reversed' WHERE id = v_payout_tx_id;
    RAISE NOTICE '  ✓ PASS: Legal success -> reversed transition accepted';

    -- Terminal state: reversed cannot transition
    BEGIN
      UPDATE public.payout_transactions SET status = 'success' WHERE id = v_payout_tx_id;
      RAISE EXCEPTION 'TEST 6 FAILED: reversed -> success was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Terminal reversed state cannot transition';
    END;
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 7: Versioned Fee & Stamp Duty Regulatory Calculation (Negative Guard)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 7: Testing versioned transfer cost calculation and negative guard...';
  
  -- Negative amount throws KD400
  BEGIN
    PERFORM public.calculate_expected_transfer_cost_kobo(-50000, '2026-02-18');
    RAISE EXCEPTION 'TEST 7 FAILED: Negative transfer amount was accepted!';
  EXCEPTION WHEN SQLSTATE 'KD400' THEN
    RAISE NOTICE '  ✓ PASS: Negative transfer amount rejected with KD400';
  END;

  -- Supported rule '2026-02-18' (Amount ₦15,000 -> ₦25 fee + ₦50 stamp duty)
  SELECT expected_fee_kobo, expected_stamp_duty_kobo, expected_total_debit_kobo 
  INTO v_rec 
  FROM public.calculate_expected_transfer_cost_kobo(1500000, '2026-02-18');
  ASSERT v_rec.expected_fee_kobo = 2500, 'TEST 7 FAILED: Expected fee is not 2500 kobo';
  ASSERT v_rec.expected_stamp_duty_kobo = 5000, 'TEST 7 FAILED: Expected stamp duty is not 5000 kobo';
  ASSERT v_rec.expected_total_debit_kobo = 1507500, 'TEST 7 FAILED: Total debit mismatch';
  RAISE NOTICE '  ✓ PASS: Statutory pricing calculation verified exact';

  -- Unsupported version throws KD400
  BEGIN
    PERFORM public.calculate_expected_transfer_cost_kobo(1500000, '2027-01-01');
    RAISE EXCEPTION 'TEST 7 FAILED: Unsupported rule version was accepted!';
  EXCEPTION WHEN SQLSTATE 'KD400' THEN
    RAISE NOTICE '  ✓ PASS: Unsupported rule version rejected with KD400';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 8: Float Control, Stale Balance & Zero-Payable Guard
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 8: Testing float control, stale balance guard & zero payable guard...';
  
  -- Zero net payable throws KD400
  BEGIN
    PERFORM public.acquire_platform_float_reservation('worker_1', v_test_order_id, gen_random_uuid(), 0);
    RAISE EXCEPTION 'TEST 8 FAILED: Zero net payable float reservation was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD400' THEN
    RAISE NOTICE '  ✓ PASS: Zero net payable float reservation rejected with KD400';
  END;

  -- Negative net payable throws KD400
  BEGIN
    PERFORM public.acquire_platform_float_reservation('worker_1', v_test_order_id, gen_random_uuid(), -1000);
    RAISE EXCEPTION 'TEST 8 FAILED: Negative net payable float reservation was permitted!';
  EXCEPTION WHEN SQLSTATE 'KD400' THEN
    RAISE NOTICE '  ✓ PASS: Negative net payable float reservation rejected with KD400';
  END;

  -- Stale balance test (last_polled_at older than 60s)
  UPDATE public.platform_float_control 
  SET last_polled_balance_kobo = 50000000, last_polled_at = now() - interval '65 seconds'
  WHERE id = true;

  DECLARE
    v_f_payable_id uuid;
  BEGIN
    SELECT id INTO v_f_payable_id FROM public.order_payables WHERE order_id = v_test_order_id AND recipient_type = 'vendor';

    BEGIN
      PERFORM public.acquire_platform_float_reservation('worker_1', v_test_order_id, v_f_payable_id, 800000);
      RAISE EXCEPTION 'TEST 8 FAILED: Stale balance reservation was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Stale balance rejected with KD409 (60-second limit)';
    END;

    -- Fresh balance test
    UPDATE public.platform_float_control 
    SET last_polled_balance_kobo = 50000000, last_polled_at = now()
    WHERE id = true;

    v_res := public.acquire_platform_float_reservation('worker_1', v_test_order_id, v_f_payable_id, 800000);
    ASSERT (v_res->>'success')::boolean = true, 'TEST 8 FAILED: Fresh float reservation failed';
    RAISE NOTICE '  ✓ PASS: Fresh float reservation acquired successfully';

    -- Insufficient float test
    UPDATE public.platform_float_control 
    SET last_polled_balance_kobo = 100, last_polled_at = now()
    WHERE id = true;

    v_res := public.acquire_platform_float_reservation('worker_2', v_test_order_id, gen_random_uuid(), 800000);
    ASSERT (v_res->>'success')::boolean = false, 'TEST 8 FAILED: Insufficient float was not rejected';
    ASSERT v_res->>'reason' = 'insufficient_float', 'TEST 8 FAILED: Expected reason insufficient_float';
    RAISE NOTICE '  ✓ PASS: Insufficient platform float rejected gracefully with reason';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 9: Settlement Queue updated_at Trigger & Unique Order Enforcement
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 9: Testing settlement queue triggers and constraints...';
  
  INSERT INTO public.settlement_queue (order_id, status)
  VALUES (v_test_order_id, 'pending')
  ON CONFLICT (order_id) DO NOTHING;

  UPDATE public.settlement_queue
  SET status = 'retry_ready'
  WHERE order_id = v_test_order_id;

  SELECT updated_at INTO v_rec FROM public.settlement_queue WHERE order_id = v_test_order_id;
  ASSERT v_rec.updated_at IS NOT NULL, 'TEST 9 FAILED: settlement_queue updated_at was not set';
  RAISE NOTICE '  ✓ PASS: settlement_queue updated_at updated by trigger';

  -- Unique constraint verification (1 job per order)
  BEGIN
    INSERT INTO public.settlement_queue (order_id, status)
    VALUES (v_test_order_id, 'pending');
    RAISE EXCEPTION 'TEST 9 FAILED: Duplicate settlement_queue row was permitted!';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE '  ✓ PASS: Duplicate queue job per order strictly rejected (1-job-per-order invariant)';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 10: Refund Protection, Collision, In-Flight & Scenarios
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 10: Testing refund protections, collision guards, and scenarios...';
  
  DECLARE
    v_new_order_id uuid := gen_random_uuid();
    v_order_b_id uuid := gen_random_uuid();
    v_order_c_id uuid := gen_random_uuid();
    v_order_d_id uuid := gen_random_uuid();
  BEGIN
    -- Scenario A: Pre-payout refund
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_new_order_id, v_test_customer_id, 'food', 'pending', 'Pickup', 'Dropoff', 5000.00, 1000.00, 6000.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_new_order_id, 'PAY_REF_REFUND_TEST', 500000, 100000, 0, 0, 400000, 100000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    INSERT INTO public.settlement_queue (order_id, status)
    VALUES (v_new_order_id, 'pending');

    v_res := public.process_order_refund_request(v_new_order_id, 'Customer changed mind', 'ref_test_req_001', v_test_customer_id);
    ASSERT v_res->>'scenario' = 'A_blocked_settlement', 'TEST 10 FAILED: Scenario A was not triggered';

    -- Verify authoritative aggregate settlement state is transitioned to refund_pending
    SELECT overall_status INTO v_rec FROM public.order_settlement_status WHERE order_id = v_new_order_id;
    ASSERT v_rec.overall_status = 'refund_pending', format('TEST 10 FAILED: overall_status is %s; expected refund_pending', v_rec.overall_status);
    
    -- Idempotent repeat call (same key + same order)
    v_res := public.process_order_refund_request(v_new_order_id, 'Customer changed mind', 'ref_test_req_001', v_test_customer_id);
    ASSERT (v_res->>'idempotent_replay')::boolean = true, 'TEST 10 FAILED: Duplicate refund request was not recognized as idempotent';
    RAISE NOTICE '  ✓ PASS: Refund Scenario A executed, overall_status = refund_pending, and recognized as idempotent';

    -- Key collision test: Same key + different order MUST FAIL with KD409
    BEGIN
      PERFORM public.process_order_refund_request(v_test_order_id, 'Collision test', 'ref_test_req_001', v_test_customer_id);
      RAISE EXCEPTION 'TEST 10 FAILED: Cross-order refund key collision was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Cross-order refund key collision rejected with KD409';
    END;

    -- Scenario B: In-flight refund (disbursing -> held_cooldown with 15m delay)
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_order_b_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 5000.00, 1000.00, 6000.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_order_b_id, 'PAY_REF_B_TEST', 500000, 100000, 0, 0, 400000, 100000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    INSERT INTO public.settlement_queue (order_id, status)
    VALUES (v_order_b_id, 'processing');

    -- Transition legally to disbursing: payable_pending -> settlement_queued -> disbursing
    UPDATE public.order_payables SET status = 'settlement_queued' WHERE order_id = v_order_b_id AND recipient_type = 'vendor';
    UPDATE public.order_payables SET status = 'disbursing' WHERE order_id = v_order_b_id AND recipient_type = 'vendor';

    v_res := public.process_order_refund_request(v_order_b_id, 'Food quality issue in-flight', 'ref_test_req_002', v_test_customer_id);
    ASSERT v_res->>'scenario' = 'B_frozen_awaiting_transfer_finality', 'TEST 10 FAILED: Scenario B was not triggered';

    -- Prevent duplicate active refunds: Different key + active refund on same order MUST FAIL with KD409
    BEGIN
      PERFORM public.process_order_refund_request(v_order_b_id, 'Second refund attempt', 'ref_test_req_002_diff', v_test_customer_id);
      RAISE EXCEPTION 'TEST 10 FAILED: Duplicate active refund request was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Duplicate in-flight refund request rejected with KD409';
    END;

    -- Scenario C: Post-settlement refund (both settled -> clawback required)
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_order_c_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 5000.00, 1000.00, 6000.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_order_c_id, 'PAY_REF_C_TEST', 500000, 100000, 0, 0, 400000, 100000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    -- Transition both payables legally to settled: payable_pending -> settlement_queued -> disbursing -> settled
    UPDATE public.order_payables SET status = 'settlement_queued' WHERE order_id = v_order_c_id;
    UPDATE public.order_payables SET status = 'disbursing' WHERE order_id = v_order_c_id;
    UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_order_c_id;

    v_res := public.process_order_refund_request(v_order_c_id, 'Fraud reported post-delivery', 'ref_test_req_003', v_test_customer_id);
    ASSERT v_res->>'scenario' = 'C_refund_with_partner_clawback', 'TEST 10 FAILED: Scenario C was not triggered';
    RAISE NOTICE '  ✓ PASS: Refund Scenario C post-settlement verified';

    -- TEST 10.B (TERMINAL GUARD): Test 1 — Reject new refund request when a processed refund already exists
    -- Advance refund to processed terminal state
    UPDATE public.order_refunds SET status = 'processed' WHERE order_id = v_order_c_id;

    BEGIN
      PERFORM public.process_order_refund_request(v_order_c_id, 'Second refund after processed', 'ref_test_req_003_replay_new_key', v_test_customer_id);
      RAISE EXCEPTION 'TEST 10 FAILED: Duplicate refund on order with processed refund was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Duplicate refund on order with processed refund rejected with KD409';
    END;

    -- Verify no second refund row was created and original remains processed
    ASSERT (SELECT count(*) FROM public.order_refunds WHERE order_id = v_order_c_id) = 1,
      'TEST 10 FAILED: Duplicate refund row was created!';
    ASSERT (SELECT status FROM public.order_refunds WHERE order_id = v_order_c_id) = 'processed',
      'TEST 10 FAILED: Original processed refund status was altered!';

    -- TEST 10.C (TERMINAL GUARD): Test 2 — Reject new refund request when order_settlement_status overall_status = 'refunded'
    -- (even if no processed row exists, e.g. cancelled/failed refund rows or external sync)
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_order_d_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 5000.00, 1000.00, 6000.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_order_d_id, 'PAY_REF_D_TEST', 500000, 100000, 0, 0, 400000, 100000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    UPDATE public.order_settlement_status 
    SET overall_status = 'refunded' 
    WHERE order_id = v_order_d_id;

    BEGIN
      PERFORM public.process_order_refund_request(v_order_d_id, 'Refund on already refunded order settlement status', 'ref_test_req_004', v_test_customer_id);
      RAISE EXCEPTION 'TEST 10 FAILED: Refund on overall_status = refunded order was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Refund on overall_status = refunded order rejected with KD409';
    END;

    ASSERT (SELECT count(*) FROM public.order_refunds WHERE order_id = v_order_d_id) = 0,
      'TEST 10 FAILED: Refund row was created for already refunded settlement status order!';

    -- TEST 10.D (TERMINAL GUARD): Test 3 — Both conditions (processed refund AND overall_status = refunded)
    -- Update order C settlement status to refunded as well
    UPDATE public.order_settlement_status 
    SET overall_status = 'refunded' 
    WHERE order_id = v_order_c_id;

    BEGIN
      PERFORM public.process_order_refund_request(v_order_c_id, 'Refund attempt when both terminal guards active', 'ref_test_req_005', v_test_customer_id);
      RAISE EXCEPTION 'TEST 10 FAILED: Refund when both terminal conditions present was permitted!';
    EXCEPTION WHEN SQLSTATE 'KD409' THEN
      RAISE NOTICE '  ✓ PASS: Refund when both terminal conditions present rejected with KD409';
    END;
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 11: Worker Eligibility Gate can_disburse_payable (Migration 1 Baseline)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 11: Testing can_disburse_payable baseline gate...';
  
  DECLARE
    v_elig_order_id uuid := gen_random_uuid();
    v_elig_vendor_payable_id uuid;
    v_is_eligible boolean;
    v_inelig_reason text;
  BEGIN
    -- Create delivered order
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_elig_order_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 10000.00, 1500.00, 11500.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_elig_order_id, 'PAY_ELIG_TEST_001', 1000000, 150000, 0, 0, 800000, 150000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    SELECT id INTO v_elig_vendor_payable_id 
    FROM public.order_payables 
    WHERE order_id = v_elig_order_id AND recipient_type = 'vendor';

    -- Payable currently in payable_pending -> Ineligible
    SELECT eligible, ineligibility_reason INTO v_is_eligible, v_inelig_reason
    FROM public.can_disburse_payable(v_elig_vendor_payable_id);
    ASSERT v_is_eligible = false, 'TEST 11 FAILED: payable_pending was marked eligible';
    ASSERT v_inelig_reason LIKE '%must be settlement_queued%', 'TEST 11 FAILED: Expected settlement_queued reason';

    -- Transition payable to settlement_queued
    UPDATE public.order_payables SET status = 'settlement_queued' WHERE id = v_elig_vendor_payable_id;

    -- Migration 1 boundary check: Order is delivered and payable queued, but recipient vault is deferred to Migration 2
    SELECT eligible, ineligibility_reason INTO v_is_eligible, v_inelig_reason
    FROM public.can_disburse_payable(v_elig_vendor_payable_id);
    ASSERT v_is_eligible = false, 'TEST 11 FAILED: Should fail closed in Migration 1 prior to bank vault';
    ASSERT v_inelig_reason = 'Awaiting partner bank vault verification (deferred to Migration 2)', 
      format('TEST 11 FAILED: Unexpected reason %s', v_inelig_reason);
    RAISE NOTICE '  ✓ PASS: can_disburse_payable correctly fails closed on recipient vault until Migration 2';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 12: Payout Failure Recovery & Attempt-Versioned Retry Reference
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 12: Testing payout failure recovery and attempt versioning...';
  
  DECLARE
    v_retry_order_id uuid := gen_random_uuid();
    v_retry_payable_id uuid;
    v_attempt1_id uuid;
    v_attempt2_id uuid;
  BEGIN
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_retry_order_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 10000.00, 1500.00, 11500.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_retry_order_id, 'PAY_RETRY_TEST_001', 1000000, 150000, 0, 0, 800000, 150000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    SELECT id INTO v_retry_payable_id 
    FROM public.order_payables 
    WHERE order_id = v_retry_order_id AND recipient_type = 'vendor';

    -- Attempt 1: Initiated and fails terminally
    INSERT INTO public.payout_transactions (
      payable_id, attempt_number, transfer_reference, paystack_recipient_code, amount_kobo,
      expected_transfer_fee_kobo, expected_stamp_duty_kobo, status
    ) VALUES (
      v_retry_payable_id, 1, 'kd_ord_retrytest001000000001_vnd_v1', 'RCP_retry1', 800000,
      2500, 0, 'pending'
    ) RETURNING id INTO v_attempt1_id;

    -- Fail Attempt 1
    UPDATE public.payout_transactions 
    SET status = 'failed', failure_reason = 'Account name mismatch at NIBSS' 
    WHERE id = v_attempt1_id;

    SELECT status, last_error INTO v_rec FROM public.order_payables WHERE id = v_retry_payable_id;
    ASSERT v_rec.status = 'failed', 'TEST 12 FAILED: Payable was not updated to failed by trigger';
    ASSERT v_rec.last_error = 'Account name mismatch at NIBSS', 'TEST 12 FAILED: last_error not synchronized';
    RAISE NOTICE '  ✓ PASS: Attempt 1 failure synchronized to order_payables';

    -- Attempt 2: Operator corrects bank, worker executes retry attempt 2 with distinct reference
    INSERT INTO public.payout_transactions (
      payable_id, attempt_number, transfer_reference, paystack_recipient_code, amount_kobo,
      expected_transfer_fee_kobo, expected_stamp_duty_kobo, status
    ) VALUES (
      v_retry_payable_id, 2, 'kd_ord_retrytest001000000001_vnd_v2', 'RCP_retry2', 800000,
      2500, 0, 'pending'
    ) RETURNING id INTO v_attempt2_id;

    -- Attempt 2 succeeds -> payable transitions to settled
    UPDATE public.payout_transactions SET status = 'success' WHERE id = v_attempt2_id;

    SELECT status INTO v_rec FROM public.order_payables WHERE id = v_retry_payable_id;
    ASSERT v_rec.status = 'settled', 'TEST 12 FAILED: Payable was not updated to settled upon attempt 2 success';
    RAISE NOTICE '  ✓ PASS: Payout attempt 2 retry succeeded with distinct reference and settled payable';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 13: Terminal Settlement State Preservation (refunded / disputed)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 13: Testing terminal settlement state preservation (refunded / disputed)...';
  DECLARE
    v_term_order_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_term_order_id, v_test_customer_id, 'food', 'delivered', 'P', 'D', 10000.00, 1500.00, 11500.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_term_order_id, 'PAY_TERM_PRESERVE', 1000000, 150000, 0, 0, 800000, 150000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    -- Simulate order confirmed refunded by Paystack webhook
    UPDATE public.order_settlement_status
    SET overall_status = 'refunded'
    WHERE order_id = v_term_order_id;

    -- Child payable mutation: transition vendor payable to cancelled
    UPDATE public.order_payables
    SET status = 'cancelled'
    WHERE order_id = v_term_order_id AND recipient_type = 'vendor';

    -- Crucial Invariant: overall_status MUST REMAIN 'refunded', NOT regress to 'refund_pending' or 'settlement_partial'
    SELECT overall_status INTO v_rec FROM public.order_settlement_status WHERE order_id = v_term_order_id;
    ASSERT v_rec.overall_status = 'refunded', format('TEST 13 FAILED: overall_status downgraded from refunded to %s', v_rec.overall_status);
    RAISE NOTICE '  ✓ PASS: Terminal refunded status strictly preserved across child payable mutations';

    -- Test disputed state preservation
    UPDATE public.order_settlement_status
    SET overall_status = 'disputed'
    WHERE order_id = v_term_order_id;

    UPDATE public.order_payables
    SET status = 'cancelled'
    WHERE order_id = v_term_order_id AND recipient_type = 'rider';

    SELECT overall_status INTO v_rec FROM public.order_settlement_status WHERE order_id = v_term_order_id;
    ASSERT v_rec.overall_status = 'disputed', format('TEST 13 FAILED: overall_status downgraded from disputed to %s', v_rec.overall_status);
    RAISE NOTICE '  ✓ PASS: Terminal disputed status strictly preserved across child payable mutations';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 14: Monotonic Sticky reopened_at & Reversal Retry Failure
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 14: Testing monotonic reopened_at and payable_reopened preservation...';
  DECLARE
    v_rev_order_id uuid := gen_random_uuid();
    v_rev_payable_id uuid;
    v_tx1_id uuid;
    v_tx2_id uuid;
    v_first_reopened_at timestamptz;
  BEGIN
    INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
    VALUES (v_rev_order_id, v_test_customer_id, 'food', 'delivered', 'Pickup', 'Dropoff', 10000.00, 1500.00, 11500.00);

    PERFORM public.create_order_financial_snapshot_and_payables(
      v_rev_order_id, 'PAY_REV_RETRY_TEST', 1000000, 150000, 0, 0, 800000, 150000,
      v_test_vendor_user_id, v_test_rider_user_id
    );

    SELECT id INTO v_rev_payable_id FROM public.order_payables WHERE order_id = v_rev_order_id AND recipient_type = 'vendor';

    -- Settle vendor legally: settlement_queued -> disbursing -> settled
    UPDATE public.order_payables SET status = 'settlement_queued' WHERE id = v_rev_payable_id;
    UPDATE public.order_payables SET status = 'disbursing' WHERE id = v_rev_payable_id;

    INSERT INTO public.payout_transactions (
      payable_id, attempt_number, transfer_reference, paystack_recipient_code, amount_kobo,
      expected_transfer_fee_kobo, expected_stamp_duty_kobo, status
    ) VALUES (
      v_rev_payable_id, 1, 'kd_ord_revtest001000000001_vnd_v1', 'RCP_rev1', 800000,
      2500, 0, 'pending'
    ) RETURNING id INTO v_tx1_id;

    UPDATE public.payout_transactions SET status = 'success' WHERE id = v_tx1_id;

    -- Settle rider as well legally
    UPDATE public.order_payables SET status = 'settlement_queued' WHERE order_id = v_rev_order_id AND recipient_type = 'rider';
    UPDATE public.order_payables SET status = 'disbursing' WHERE order_id = v_rev_order_id AND recipient_type = 'rider';
    UPDATE public.order_payables SET status = 'settled' WHERE order_id = v_rev_order_id AND recipient_type = 'rider';

    SELECT overall_status INTO v_rec FROM public.order_settlement_status WHERE order_id = v_rev_order_id;
    ASSERT v_rec.overall_status = 'settled', 'TEST 14 FAILED: Order not settled';

    -- Attempt 1: Reversed -> Payable reopened
    UPDATE public.payout_transactions SET status = 'reversed' WHERE id = v_tx1_id;

    SELECT overall_status, reopened_at INTO v_rec FROM public.order_settlement_status WHERE order_id = v_rev_order_id;
    ASSERT v_rec.overall_status = 'settlement_partial', 'TEST 14 FAILED: Order status not downgraded';
    ASSERT v_rec.reopened_at IS NOT NULL, 'TEST 14 FAILED: reopened_at was not populated';
    v_first_reopened_at := v_rec.reopened_at;

    -- Attempt 2: Retry payout initiated and then fails
    INSERT INTO public.payout_transactions (
      payable_id, attempt_number, transfer_reference, paystack_recipient_code, amount_kobo,
      expected_transfer_fee_kobo, expected_stamp_duty_kobo, status
    ) VALUES (
      v_rev_payable_id, 2, 'kd_ord_revtest001000000001_vnd_v2', 'RCP_rev2', 800000,
      2500, 0, 'pending'
    ) RETURNING id INTO v_tx2_id;

    UPDATE public.payout_transactions 
    SET status = 'failed', failure_reason = 'Bank network unavailable' 
    WHERE id = v_tx2_id;

    -- Crucial Invariant: Payable MUST PRESERVE payable_reopened semantic, not regress to generic failed!
    SELECT status, last_error INTO v_rec FROM public.order_payables WHERE id = v_rev_payable_id;
    ASSERT v_rec.status = 'payable_reopened', format('TEST 14 FAILED: Payable status became %s; expected payable_reopened', v_rec.status);
    ASSERT v_rec.last_error = 'Bank network unavailable', 'TEST 14 FAILED: last_error not updated';
    RAISE NOTICE '  ✓ PASS: Reversal retry failure preserves payable_reopened liability semantic';

    -- Crucial Invariant: reopened_at MUST BE MONOTONIC (preserved exactly)
    SELECT reopened_at INTO v_rec FROM public.order_settlement_status WHERE order_id = v_rev_order_id;
    ASSERT v_rec.reopened_at = v_first_reopened_at, 'TEST 14 FAILED: reopened_at timestamp was mutated on subsequent sync!';
    RAISE NOTICE '  ✓ PASS: reopened_at is strictly monotonic across payable updates';
  END;

  -- ----------------------------------------------------------------------------
  -- TEST 15: Order Settlement Status Aggregate Consistency Constraint
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Test 15: Testing aggregate consistency check constraint...';
  BEGIN
    DECLARE
      v_bad_order_id uuid := gen_random_uuid();
    BEGIN
      INSERT INTO public.orders (id, customer_id, service_type, status, pickup_address, delivery_address, subtotal, delivery_fee, total)
      VALUES (v_bad_order_id, v_test_customer_id, 'food', 'in_transit', 'Pickup', 'Dropoff', 10000.00, 1500.00, 11500.00);

      INSERT INTO public.order_settlement_status (order_id, overall_status, vendor_status, rider_status)
      VALUES (v_bad_order_id, 'settled', 'payable_pending', 'payable_pending');
      RAISE EXCEPTION 'TEST 15 FAILED: Inconsistent aggregate settled status was permitted!';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE '  ✓ PASS: Inconsistent aggregate settled status blocked by CHECK constraint';
    END;
  END;

  RAISE NOTICE '=== ALL MIGRATION 1 ADVERSARIAL TESTS PASSED SUCCESSFULLY! ===';
END;
$$;

ROLLBACK; -- Always rollback sandbox test transaction
