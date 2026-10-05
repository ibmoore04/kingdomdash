-- =============================================================================
-- Migration: 20261012000001_authoritative_loyalty_redemption_and_sync.sql
-- Description: Authoritative DashPoints Redemption & Multi-Device Sync Engine
--              1. Provides SECURITY DEFINER RPC `redeem_dashpoints` with row-level locking
--              2. Provides `get_or_create_loyalty_account` for seamless first-party onboarding
--              3. Prevents client-side balance manipulation & race condition double-spending
--              4. Enforces strict audit ledger in public.loyalty_transactions
-- =============================================================================

-- ── 1. Secure Server-Authoritative DashPoints Redemption RPC ──────────────────
CREATE OR REPLACE FUNCTION public.redeem_dashpoints(
  p_points integer,
  p_description text DEFAULT 'Checkout discount redemption'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  -- 1. Caller Authentication Verification
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to redeem DashPoints'
      USING ERRCODE = 'KD401';
  END IF;

  IF p_points <= 0 THEN
    RAISE EXCEPTION 'Points to redeem must be strictly greater than zero'
      USING ERRCODE = 'KD400';
  END IF;

  -- 2. Concurrency-Safe Pessimistic Row Lock
  SELECT points_balance INTO v_current_balance
  FROM public.loyalty_accounts
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- Initialize on demand if user had not triggered auto-provision
    INSERT INTO public.loyalty_accounts (user_id, points_balance, lifetime_points, tier)
    VALUES (v_user_id, 0, 0, 'Bronze')
    ON CONFLICT (user_id) DO NOTHING;
    
    v_current_balance := 0;
  END IF;

  -- 3. Solvency Guard
  IF v_current_balance < p_points THEN
    RAISE EXCEPTION 'Insufficient DashPoints balance. Available: %, Requested: %',
      v_current_balance, p_points
      USING ERRCODE = 'KD400';
  END IF;

  v_new_balance := v_current_balance - p_points;

  -- 4. Atomic Balance Update
  UPDATE public.loyalty_accounts
  SET points_balance = v_new_balance,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- 5. Immutable Ledger Audit Transaction
  INSERT INTO public.loyalty_transactions (user_id, points, type, description)
  VALUES (v_user_id, -p_points, 'redeemed', COALESCE(NULLIF(trim(p_description), ''), 'Checkout discount applied'));

  RETURN jsonb_build_object(
    'success', true,
    'points_redeemed', p_points,
    'points_balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_dashpoints(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_dashpoints(integer, text) TO authenticated, service_role;


-- ── 2. Get or Create Loyalty Account Helper ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_or_create_loyalty_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec record;
  v_caller uuid;
  v_role text;
BEGIN
  v_caller := auth.uid();
  v_role := public.get_current_user_role();

  -- Access authorization: users can access their own, admins/service_role can access all
  IF v_caller <> p_user_id AND v_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: cannot query or initialize loyalty accounts for another user'
      USING ERRCODE = 'KD403';
  END IF;

  -- Provision initial 150 welcome points for brand new accounts
  INSERT INTO public.loyalty_accounts (user_id, points_balance, lifetime_points, tier)
  VALUES (p_user_id, 150, 150, 'Bronze')
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_rec
  FROM public.loyalty_accounts
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'user_id', v_rec.user_id,
    'points_balance', v_rec.points_balance,
    'lifetime_points', v_rec.lifetime_points,
    'tier', v_rec.tier,
    'referral_credits_ngn', v_rec.referral_credits_ngn,
    'referred_count', v_rec.referred_count,
    'has_active_kd_pass', v_rec.has_active_kd_pass,
    'kd_pass_expiry', v_rec.kd_pass_expiry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_loyalty_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_loyalty_account(uuid) TO authenticated, service_role;
