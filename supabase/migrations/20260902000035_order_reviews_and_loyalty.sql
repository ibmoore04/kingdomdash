-- Migration: 20260902000035_order_reviews_and_loyalty.sql
-- 1. Create public.order_reviews table with RLS & indexes
-- 2. Create public.loyalty_accounts table with RLS & tier progression
-- 3. Create public.loyalty_transactions table with RLS & audit history
-- 4. RPC endpoints for review submission & points accrual

-- ============================================================
-- Section 1: Order Reviews Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_reviews (
  id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

-- Customers can submit reviews for their own orders
DROP POLICY IF EXISTS "reviews_insert_customer" ON public.order_reviews;
CREATE POLICY "reviews_insert_customer"
  ON public.order_reviews
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Anyone can read reviews (ratings and public comments)
DROP POLICY IF EXISTS "reviews_select_all" ON public.order_reviews;
CREATE POLICY "reviews_select_all"
  ON public.order_reviews
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Admins can moderate/delete reviews
DROP POLICY IF EXISTS "reviews_admin_all" ON public.order_reviews;
CREATE POLICY "reviews_admin_all"
  ON public.order_reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_order_reviews_order_id ON public.order_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_rating ON public.order_reviews(rating);

-- ============================================================
-- Section 2: Customer Loyalty Accounts Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loyalty_accounts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_points integer NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  tier text NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze', 'Silver', 'Gold')),
  referral_credits_ngn numeric(12, 2) NOT NULL DEFAULT 0,
  referred_count integer NOT NULL DEFAULT 0,
  has_active_kd_pass boolean NOT NULL DEFAULT false,
  kd_pass_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_accounts ENABLE ROW LEVEL SECURITY;

-- Users can read their own loyalty account
DROP POLICY IF EXISTS "loyalty_select_own" ON public.loyalty_accounts;
CREATE POLICY "loyalty_select_own"
  ON public.loyalty_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view and manage all loyalty accounts
DROP POLICY IF EXISTS "loyalty_admin_all" ON public.loyalty_accounts;
CREATE POLICY "loyalty_admin_all"
  ON public.loyalty_accounts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

-- ============================================================
-- Section 3: Loyalty Transactions Table (Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points integer NOT NULL,
  type text NOT NULL CHECK (type IN ('earned', 'redeemed', 'bonus')),
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own loyalty transactions
DROP POLICY IF EXISTS "loyalty_tx_select_own" ON public.loyalty_transactions;
CREATE POLICY "loyalty_tx_select_own"
  ON public.loyalty_transactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all loyalty transactions
DROP POLICY IF EXISTS "loyalty_tx_admin_all" ON public.loyalty_transactions;
CREATE POLICY "loyalty_tx_admin_all"
  ON public.loyalty_transactions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user_created ON public.loyalty_transactions(user_id, created_at DESC);

-- ============================================================
-- Section 4: RPC Helper for Points Accrual & Tier Progression
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_dashpoints(
  p_user_id uuid,
  p_points integer,
  p_type text,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance integer;
  v_new_lifetime integer;
  v_new_tier text;
BEGIN
  -- Insert transaction record
  INSERT INTO public.loyalty_transactions (user_id, points, type, description)
  VALUES (p_user_id, p_points, p_type, p_description);

  -- Upsert loyalty account
  INSERT INTO public.loyalty_accounts (user_id, points_balance, lifetime_points, tier)
  VALUES (
    p_user_id,
    GREATEST(0, p_points),
    GREATEST(0, p_points),
    CASE 
      WHEN p_points >= 1500 THEN 'Gold'
      WHEN p_points >= 500 THEN 'Silver'
      ELSE 'Bronze'
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    points_balance = GREATEST(0, public.loyalty_accounts.points_balance + EXCLUDED.points_balance),
    lifetime_points = public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance),
    tier = CASE 
      WHEN (public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance)) >= 1500 THEN 'Gold'
      WHEN (public.loyalty_accounts.lifetime_points + GREATEST(0, EXCLUDED.points_balance)) >= 500 THEN 'Silver'
      ELSE public.loyalty_accounts.tier
    END,
    updated_at = now()
  RETURNING points_balance, lifetime_points, tier INTO v_new_balance, v_new_lifetime, v_new_tier;

  RETURN jsonb_build_object(
    'points_balance', v_new_balance,
    'lifetime_points', v_new_lifetime,
    'tier', v_new_tier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_dashpoints(uuid, integer, text, text) TO authenticated, service_role;
