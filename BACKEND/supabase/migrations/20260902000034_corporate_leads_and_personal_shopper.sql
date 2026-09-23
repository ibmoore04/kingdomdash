-- Migration: 20260902000034_corporate_leads_and_personal_shopper.sql
-- 1. Create public.corporate_leads table with RLS & indexes
-- 2. Create public.personal_shopper_requests table with RLS & indexes
-- 3. Automated notification triggers alerting active administrators
-- 4. Secure RPC endpoints for guest/user submissions & administrative management

-- ============================================================
-- Section 1: Corporate Leads Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.corporate_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text,
  business_type text NOT NULL,
  estimated_volume text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'onboarded', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.corporate_leads ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can submit leads
DROP POLICY IF EXISTS "corporate_leads_insert_any" ON public.corporate_leads;
CREATE POLICY "corporate_leads_insert_any"
  ON public.corporate_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins and super_admins can view and update leads
DROP POLICY IF EXISTS "corporate_leads_admin_all" ON public.corporate_leads;
CREATE POLICY "corporate_leads_admin_all"
  ON public.corporate_leads
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

CREATE INDEX IF NOT EXISTS idx_corporate_leads_status_created 
  ON public.corporate_leads (status, created_at DESC);

-- ============================================================
-- Section 2: Personal Shopper Requests Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.personal_shopper_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  delivery_address text NOT NULL,
  market_name text NOT NULL,
  budget_cap numeric(12, 2),
  estimated_total numeric(12, 2),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'shopping', 'completed', 'cancelled')),
  assigned_shopper_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_shopper_requests ENABLE ROW LEVEL SECURITY;

-- Anonymous and authenticated visitors can submit shopper requests
DROP POLICY IF EXISTS "shopper_requests_insert_any" ON public.personal_shopper_requests;
CREATE POLICY "shopper_requests_insert_any"
  ON public.personal_shopper_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins and super_admins can view and manage shopper requests
DROP POLICY IF EXISTS "shopper_requests_admin_all" ON public.personal_shopper_requests;
CREATE POLICY "shopper_requests_admin_all"
  ON public.personal_shopper_requests
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

CREATE INDEX IF NOT EXISTS idx_shopper_requests_status_created 
  ON public.personal_shopper_requests (status, created_at DESC);

-- ============================================================
-- Section 3: Notification Triggers for Administrator Alerts
-- ============================================================

-- Corporate Lead Insert Trigger -> Notify Admins
CREATE OR REPLACE FUNCTION public.notify_admins_on_corporate_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admin record;
BEGIN
  FOR v_admin IN
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'super_admin') 
      AND is_active = true
  LOOP
    PERFORM public.emit_notification(
      v_admin.id,
      '🏢 Corporate Account Lead: ' || NEW.company_name,
      NEW.contact_name || ' (' || NEW.phone || ') requested business courier for ' || NEW.business_type || '. Est. Volume: ' || COALESCE(NEW.estimated_volume, 'N/A') || '.',
      'info',
      'application',
      '/admin/users?tab=corporate',
      'corp_lead:' || NEW.id || ':admin:' || v_admin.id,
      jsonb_build_object('lead_id', NEW.id, 'company_name', NEW.company_name, 'phone', NEW.phone),
      true
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_corporate_lead_inserted ON public.corporate_leads;
CREATE TRIGGER trg_corporate_lead_inserted
  AFTER INSERT ON public.corporate_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_corporate_lead();


-- Personal Shopper Request Insert Trigger -> Notify Admins
CREATE OR REPLACE FUNCTION public.notify_admins_on_shopper_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admin record;
BEGIN
  FOR v_admin IN
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'super_admin') 
      AND is_active = true
  LOOP
    PERFORM public.emit_notification(
      v_admin.id,
      '🛒 New Personal Shopper Request',
      NEW.customer_name || ' (' || NEW.customer_phone || ') requested a market run at ' || NEW.market_name || '. Delivery: ' || NEW.delivery_address,
      'warning',
      'order',
      '/admin/orders?type=shopper',
      'shopper_req:' || NEW.id || ':admin:' || v_admin.id,
      jsonb_build_object('request_id', NEW.id, 'market_name', NEW.market_name, 'customer_phone', NEW.customer_phone),
      true
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopper_request_inserted ON public.personal_shopper_requests;
CREATE TRIGGER trg_shopper_request_inserted
  AFTER INSERT ON public.personal_shopper_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_shopper_request();

-- ============================================================
-- Section 4: Public Submission RPCs (SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_corporate_lead(
  p_company_name text,
  p_contact_name text,
  p_email text,
  p_phone text,
  p_address text DEFAULT NULL,
  p_business_type text DEFAULT 'General',
  p_estimated_volume text DEFAULT '0-50',
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  INSERT INTO public.corporate_leads (
    company_name,
    contact_name,
    email,
    phone,
    address,
    business_type,
    estimated_volume,
    notes,
    status
  ) VALUES (
    TRIM(p_company_name),
    TRIM(p_contact_name),
    TRIM(LOWER(p_email)),
    TRIM(p_phone),
    NULLIF(TRIM(p_address), ''),
    TRIM(p_business_type),
    TRIM(p_estimated_volume),
    NULLIF(TRIM(p_notes), ''),
    'pending'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_corporate_lead(text, text, text, text, text, text, text, text) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.submit_personal_shopper_request(
  p_customer_name text,
  p_customer_phone text,
  p_delivery_address text,
  p_market_name text,
  p_budget_cap numeric DEFAULT NULL,
  p_estimated_total numeric DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  INSERT INTO public.personal_shopper_requests (
    customer_name,
    customer_phone,
    delivery_address,
    market_name,
    budget_cap,
    estimated_total,
    items,
    notes,
    status
  ) VALUES (
    TRIM(p_customer_name),
    TRIM(p_customer_phone),
    TRIM(p_delivery_address),
    TRIM(p_market_name),
    p_budget_cap,
    p_estimated_total,
    COALESCE(p_items, '[]'::jsonb),
    NULLIF(TRIM(p_notes), ''),
    'pending'
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_personal_shopper_request(text, text, text, text, numeric, numeric, jsonb, text) TO anon, authenticated;

-- ============================================================
-- Section 5: Admin Query & Management RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_corporate_leads(
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  company_name text,
  contact_name text,
  email text,
  phone text,
  address text,
  business_type text,
  estimated_volume text,
  notes text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
BEGIN
  -- Authorize caller as admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an authorized administrator' USING ERRCODE = 'KD403';
  END IF;

  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_limit, 20));

  RETURN QUERY
  WITH filtered AS (
    SELECT cl.*
    FROM public.corporate_leads cl
    WHERE (p_status IS NULL OR cl.status = p_status)
  ),
  counted AS (
    SELECT COUNT(*) AS c FROM filtered
  )
  SELECT 
    f.id,
    f.company_name,
    f.contact_name,
    f.email,
    f.phone,
    f.address,
    f.business_type,
    f.estimated_volume,
    f.notes,
    f.status,
    f.created_at,
    f.updated_at,
    c.c AS total_count
  FROM filtered f, counted c
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_corporate_leads(text, integer, integer) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_personal_shopper_requests(
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  customer_name text,
  customer_phone text,
  delivery_address text,
  market_name text,
  budget_cap numeric,
  estimated_total numeric,
  items jsonb,
  notes text,
  status text,
  assigned_shopper_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
BEGIN
  -- Authorize caller as admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Access denied: caller is not an authorized administrator' USING ERRCODE = 'KD403';
  END IF;

  v_offset := GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_limit, 20));

  RETURN QUERY
  WITH filtered AS (
    SELECT psr.*
    FROM public.personal_shopper_requests psr
    WHERE (p_status IS NULL OR psr.status = p_status)
  ),
  counted AS (
    SELECT COUNT(*) AS c FROM filtered
  )
  SELECT 
    f.id,
    f.customer_name,
    f.customer_phone,
    f.delivery_address,
    f.market_name,
    f.budget_cap,
    f.estimated_total,
    f.items,
    f.notes,
    f.status,
    f.assigned_shopper_id,
    f.created_at,
    f.updated_at,
    c.c AS total_count
  FROM filtered f, counted c
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_personal_shopper_requests(text, integer, integer) TO authenticated;
