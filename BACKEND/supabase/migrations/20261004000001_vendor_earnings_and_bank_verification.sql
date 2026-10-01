-- =============================================================================
-- Migration: 20261004000001_vendor_earnings_and_bank_verification.sql
-- Module   : KingdomDash Vendor Earnings & Bank Verification Portal (Phase 3)
-- Purpose  : 1. Create public.partner_bank_accounts for verified payout accounts
--            2. Implement save_partner_bank_account RPC with validation & audit
--            3. Implement get_partner_bank_account RPC with strict ownership check
--            4. Implement get_vendor_earnings_summary RPC for real-time ledger KPIs
--            5. Implement get_vendor_settlement_statements RPC for immutable statements
-- =============================================================================

-- 1. Create public.partner_bank_accounts table
CREATE TABLE IF NOT EXISTS public.partner_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  bank_code text NOT NULL CHECK (length(bank_code) >= 3 AND bank_code ~ '^[0-9]+$'),
  account_number text NOT NULL CHECK (length(account_number) = 10 AND account_number ~ '^[0-9]+$'),
  account_name text NOT NULL CHECK (length(account_name) >= 3),
  recipient_code text,
  is_verified boolean NOT NULL DEFAULT true,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_bank_accounts_vendor ON public.partner_bank_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_partner_bank_accounts_profile ON public.partner_bank_accounts(profile_id);

-- 2. Row Level Security on partner_bank_accounts
ALTER TABLE public.partner_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors and admins can view partner bank accounts" ON public.partner_bank_accounts;
CREATE POLICY "Vendors and admins can view partner bank accounts"
  ON public.partner_bank_accounts FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    vendor_id IN (SELECT id FROM public.vendors WHERE profile_id = auth.uid()) OR
    public.get_current_user_role() IN ('super_admin', 'admin')
  );

-- Direct mutations revoked: must use vetted save_partner_bank_account RPC
REVOKE INSERT, UPDATE, DELETE ON public.partner_bank_accounts FROM anon, authenticated;
GRANT SELECT ON public.partner_bank_accounts TO authenticated, service_role;

-- 3. Authoritative RPC: save_partner_bank_account
DROP FUNCTION IF EXISTS public.save_partner_bank_account(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.save_partner_bank_account(
  p_vendor_id       uuid,
  p_bank_name       text,
  p_bank_code       text,
  p_account_number  text,
  p_account_name    text
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
    'is_verified', v_record.is_verified,
    'verified_at', v_record.verified_at,
    'updated_at', v_record.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.save_partner_bank_account(uuid, text, text, text, text) TO authenticated, service_role;

-- 4. Authoritative RPC: get_partner_bank_account
DROP FUNCTION IF EXISTS public.get_partner_bank_account(uuid);

CREATE OR REPLACE FUNCTION public.get_partner_bank_account(
  p_vendor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id   uuid;
  v_profile_id  uuid;
  v_caller_role text;
  v_record      record;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'KD401';
  END IF;

  v_caller_role := public.get_current_user_role();

  SELECT profile_id INTO v_profile_id
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'KD404';
  END IF;

  IF v_caller_id != v_profile_id AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: caller does not own this vendor' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_record
  FROM public.partner_bank_accounts
  WHERE vendor_id = p_vendor_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_record.id,
    'vendor_id', v_record.vendor_id,
    'bank_name', v_record.bank_name,
    'bank_code', v_record.bank_code,
    'account_number', v_record.account_number,
    'account_name', v_record.account_name,
    'is_verified', v_record.is_verified,
    'verified_at', v_record.verified_at,
    'created_at', v_record.created_at,
    'updated_at', v_record.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_partner_bank_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_partner_bank_account(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_partner_bank_account(uuid) TO authenticated, service_role;

-- 5. Authoritative RPC: get_vendor_earnings_summary
DROP FUNCTION IF EXISTS public.get_vendor_earnings_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_vendor_earnings_summary(
  p_vendor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id             uuid;
  v_profile_id            uuid;
  v_caller_role           text;
  v_gross_revenue         numeric(12,2) := 0;
  v_net_settled           numeric(12,2) := 0;
  v_pending_balance       numeric(12,2) := 0;
  v_total_orders          bigint := 0;
  v_settled_orders        bigint := 0;
  v_pending_orders        bigint := 0;
  v_settled_payables_kobo bigint := 0;
  v_pending_payables_kobo bigint := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'KD401';
  END IF;

  v_caller_role := public.get_current_user_role();

  SELECT profile_id INTO v_profile_id
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'KD404';
  END IF;

  IF v_caller_id != v_profile_id AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: caller does not own this vendor' USING ERRCODE = 'KD403';
  END IF;

  -- 1. Compute Gross Product Merchandise Revenue attributable to vendor
  -- (All non-cancelled orders that were confirmed / delivered)
  SELECT
    COALESCE(SUM(subtotal), 0),
    COUNT(*)
  INTO v_gross_revenue, v_total_orders
  FROM public.orders
  WHERE vendor_id = p_vendor_id
    AND status NOT IN ('cancelled', 'rejected');

  -- 2. Compute Net Settled & Pending from order_payables if present
  SELECT
    COALESCE(SUM(CASE WHEN op.status = 'settled' THEN op.net_payable_kobo ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN op.status IN ('payable_pending', 'settlement_queued', 'disbursing') THEN op.net_payable_kobo ELSE 0 END), 0),
    COUNT(CASE WHEN op.status = 'settled' THEN 1 END),
    COUNT(CASE WHEN op.status IN ('payable_pending', 'settlement_queued', 'disbursing') THEN 1 END)
  INTO
    v_settled_payables_kobo,
    v_pending_payables_kobo,
    v_settled_orders,
    v_pending_orders
  FROM public.order_payables op
  JOIN public.orders o ON o.id = op.order_id
  WHERE o.vendor_id = p_vendor_id
    AND op.recipient_type = 'vendor';

  -- If payables exist, use precise ledger math; otherwise fall back to orders completed vs pending
  IF v_settled_payables_kobo > 0 OR v_pending_payables_kobo > 0 THEN
    v_net_settled     := round(v_settled_payables_kobo / 100.0, 2);
    v_pending_balance := round(v_pending_payables_kobo / 100.0, 2);
  ELSE
    -- Operational fallback if financial snapshot hasn't generated child payables yet
    SELECT
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN subtotal ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN status IN ('confirmed', 'preparing', 'ready_for_pickup', 'in_transit') THEN subtotal ELSE 0 END), 0),
      COUNT(CASE WHEN status = 'delivered' THEN 1 END),
      COUNT(CASE WHEN status IN ('confirmed', 'preparing', 'ready_for_pickup', 'in_transit') THEN 1 END)
    INTO
      v_net_settled,
      v_pending_balance,
      v_settled_orders,
      v_pending_orders
    FROM public.orders
    WHERE vendor_id = p_vendor_id
      AND status NOT IN ('cancelled', 'rejected');
  END IF;

  RETURN jsonb_build_object(
    'vendor_id', p_vendor_id,
    'gross_revenue', v_gross_revenue,
    'net_settled', v_net_settled,
    'pending_balance', v_pending_balance,
    'total_orders', v_total_orders,
    'settled_orders', v_settled_orders,
    'pending_orders', v_pending_orders
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vendor_earnings_summary(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_earnings_summary(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_vendor_earnings_summary(uuid) TO authenticated, service_role;

-- 6. Authoritative RPC: get_vendor_settlement_statements
DROP FUNCTION IF EXISTS public.get_vendor_settlement_statements(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_vendor_settlement_statements(
  p_vendor_id uuid,
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0
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
  v_statements   jsonb;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'KD401';
  END IF;

  v_caller_role := public.get_current_user_role();

  SELECT profile_id INTO v_profile_id
  FROM public.vendors
  WHERE id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor not found' USING ERRCODE = 'KD404';
  END IF;

  IF v_caller_id != v_profile_id AND v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: caller does not own this vendor' USING ERRCODE = 'KD403';
  END IF;

  SELECT jsonb_agg(stmt) INTO v_statements
  FROM (
    SELECT
      o.id AS order_id,
      o.created_at,
      o.status AS order_status,
      o.subtotal AS vendor_entitlement,
      COALESCE(o.service_fee, 150.00) AS platform_service_fee,
      o.delivery_fee,
      o.total AS customer_total,
      COALESCE(op.status, CASE WHEN o.status = 'delivered' THEN 'settled' ELSE 'payable_pending' END) AS settlement_status,
      COALESCE(op.net_payable, o.subtotal) AS net_payable,
      op.updated_at AS settlement_updated_at,
      p.paystack_reference AS payment_reference,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'name', oi.item_name,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'total_price', oi.total_price
          )
        )
        FROM public.order_items oi
        WHERE oi.order_id = o.id
      ) AS items
    FROM public.orders o
    LEFT JOIN public.order_payables op ON op.order_id = o.id AND op.recipient_type = 'vendor'
    LEFT JOIN (
      SELECT DISTINCT ON (order_id) order_id, paystack_reference
      FROM public.payments
      ORDER BY order_id, created_at DESC
    ) p ON p.order_id = o.id
    WHERE o.vendor_id = p_vendor_id
    ORDER BY o.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) stmt;

  RETURN COALESCE(v_statements, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vendor_settlement_statements(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_vendor_settlement_statements(uuid, integer, integer) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_vendor_settlement_statements(uuid, integer, integer) TO authenticated, service_role;
