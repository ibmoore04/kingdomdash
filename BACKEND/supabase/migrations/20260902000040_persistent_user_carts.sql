-- Migration: 20260902000040_persistent_user_carts.sql
-- 1. Create public.user_carts table for cross-device authenticated shopping cart persistence
-- 2. Row-Level Security (RLS) policies allowing users to manage their own cart
-- 3. Secure RPC helper endpoints for saving, loading, and clearing carts atomically

-- ============================================================
-- Section 1: User Carts Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_carts (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_data jsonb,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

-- Authenticated customers can read their own persistent cart
DROP POLICY IF EXISTS "user_carts_select_own" ON public.user_carts;
CREATE POLICY "user_carts_select_own"
  ON public.user_carts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Authenticated customers can insert their own cart
DROP POLICY IF EXISTS "user_carts_insert_own" ON public.user_carts;
CREATE POLICY "user_carts_insert_own"
  ON public.user_carts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated customers can update their own cart
DROP POLICY IF EXISTS "user_carts_update_own" ON public.user_carts;
CREATE POLICY "user_carts_update_own"
  ON public.user_carts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated customers can delete/clear their own cart
DROP POLICY IF EXISTS "user_carts_delete_own" ON public.user_carts;
CREATE POLICY "user_carts_delete_own"
  ON public.user_carts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins and super_admins can inspect carts for support and order diagnostics
DROP POLICY IF EXISTS "user_carts_admin_all" ON public.user_carts;
CREATE POLICY "user_carts_admin_all"
  ON public.user_carts
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

CREATE INDEX IF NOT EXISTS idx_user_carts_user_id ON public.user_carts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_carts_updated_at ON public.user_carts(updated_at DESC);

-- ============================================================
-- Section 2: Atomic Cart Management RPCs
-- ============================================================

-- Upsert active cart for calling authenticated user
CREATE OR REPLACE FUNCTION public.save_user_cart(
  p_vendor_id uuid DEFAULT NULL,
  p_vendor_data jsonb DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to save persistent cart' USING ERRCODE = 'KD401';
  END IF;

  IF jsonb_array_length(COALESCE(p_items, '[]'::jsonb)) = 0 THEN
    DELETE FROM public.user_carts WHERE user_id = v_user_id;
    RETURN jsonb_build_object('success', true, 'action', 'cleared');
  END IF;

  INSERT INTO public.user_carts (
    user_id,
    vendor_id,
    vendor_data,
    items,
    updated_at
  ) VALUES (
    v_user_id,
    p_vendor_id,
    p_vendor_data,
    COALESCE(p_items, '[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    vendor_id = EXCLUDED.vendor_id,
    vendor_data = EXCLUDED.vendor_data,
    items = EXCLUDED.items,
    updated_at = now()
  RETURNING jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'vendor_id', vendor_id,
    'items_count', jsonb_array_length(items),
    'updated_at', updated_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_user_cart(uuid, jsonb, jsonb) TO authenticated;

-- Retrieve active cart for calling authenticated user
CREATE OR REPLACE FUNCTION public.get_user_cart()
RETURNS TABLE (
  vendor_id uuid,
  vendor_data jsonb,
  items jsonb,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    uc.vendor_id,
    uc.vendor_data,
    uc.items,
    uc.updated_at
  FROM public.user_carts uc
  WHERE uc.user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_cart() TO authenticated;

-- Clear active cart for calling authenticated user
CREATE OR REPLACE FUNCTION public.clear_user_cart()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.user_carts WHERE user_id = v_user_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_user_cart() TO authenticated;
