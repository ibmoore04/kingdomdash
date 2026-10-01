-- =============================================================================
-- Migration: 20261007000001_partner_bank_vault_and_receivables_clawback.sql
-- Module   : KingdomDash Bank Vault (AES-256-GCM), 24h Payout Cooldown & Receivables Debt Recovery
-- Contract : DOCS/SETTLEMENT_ENGINE_ARCHITECTURE.md (§9, §10)
-- Purpose  : 1. partner_bank_vault table for server-side encrypted credentials
--            2. 24-hour payout hold cooldown (payout_hold_until) on vendors & riders
--            3. update_partner_bank_details RPC (server-side KMS encryption boundary)
--            4. partner_receivables & receivable_recovery_logs tables
--            5. claim_partner_receivable_offset RPC (atomic partner debt offset)
-- =============================================================================

-- 1. Table: partner_bank_vault (§10)
CREATE TABLE IF NOT EXISTS public.partner_bank_vault (
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
GRANT ALL ON public.partner_bank_vault TO service_role;

-- 2. Add multi-stage bank status columns and 24h payout hold to vendors & riders (§10)
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS masked_account_number text,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text,
  ADD COLUMN IF NOT EXISTS bank_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_name_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paystack_recipient_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz;

ALTER TABLE public.riders
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS masked_account_number text,
  ADD COLUMN IF NOT EXISTS paystack_recipient_code text,
  ADD COLUMN IF NOT EXISTS bank_details_submitted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bank_account_name_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paystack_recipient_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz;

-- 3. Authoritative RPC: update_partner_bank_details (§10)
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
DECLARE
  v_hold_until timestamptz;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: bank details must be encrypted by trusted server function' USING ERRCODE = 'KD403';
  END IF;

  v_hold_until := now() + interval '24 hours';

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
      payout_hold_until = v_hold_until,
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
      payout_hold_until = v_hold_until,
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
  PERFORM public.log_operational_audit_event(
    'update_partner_bank_details',
    'profiles',
    p_profile_id,
    jsonb_build_object(
      'partner_type', p_partner_type,
      'bank_name', p_bank_name,
      'account_name', p_account_name,
      'masked_account', p_masked_account_number,
      'hold_until', v_hold_until
    )
  );

  RETURN jsonb_build_object('success', true, 'hold_until', v_hold_until);
END;
$$;

REVOKE ALL ON FUNCTION public.update_partner_bank_details FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_partner_bank_details TO service_role;

-- 4. Tables: partner_receivables & receivable_recovery_logs (§9)
CREATE TABLE IF NOT EXISTS public.partner_receivables (
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

CREATE INDEX IF NOT EXISTS idx_partner_receivables_claim 
  ON public.partner_receivables(partner_id, status)
  WHERE status IN ('outstanding', 'partially_recovered');

CREATE TABLE IF NOT EXISTS public.receivable_recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id uuid NOT NULL REFERENCES public.partner_receivables(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  pre_recovery_debt_kobo bigint NOT NULL,
  claimed_amount_kobo bigint NOT NULL CHECK (claimed_amount_kobo > 0),
  post_recovery_debt_kobo bigint NOT NULL CHECK (post_recovery_debt_kobo >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receivable_recovery_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partner_receivables FROM PUBLIC, anon;
REVOKE ALL ON public.receivable_recovery_logs FROM PUBLIC, anon;

GRANT SELECT ON public.partner_receivables TO authenticated, service_role;
GRANT SELECT ON public.receivable_recovery_logs TO authenticated, service_role;

DROP POLICY IF EXISTS "Partners can view own receivables" ON public.partner_receivables;
CREATE POLICY "Partners can view own receivables"
  ON public.partner_receivables
  FOR SELECT
  TO authenticated
  USING (
    partner_id = auth.uid() 
    OR public.get_current_user_role() IN ('super_admin', 'admin')
  );

-- 5. Authoritative RPC: claim_partner_receivable_offset (§9)
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
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
  v_remaining_gross bigint := p_gross_entitlement_kobo;
  v_total_claimed bigint := 0;
  v_initial_debt bigint;
  v_to_deduct bigint;
  v_post_debt bigint;
BEGIN
  IF public.get_current_user_role() NOT IN ('super_admin', 'admin') AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: only settlement worker can claim receivable offsets' USING ERRCODE = 'KD403';
  END IF;

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

REVOKE ALL ON FUNCTION public.claim_partner_receivable_offset(uuid, uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_partner_receivable_offset(uuid, uuid, bigint) TO service_role;
