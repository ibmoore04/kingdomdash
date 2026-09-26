-- Migration: 20260926000001_fix_corporate_leads_rls_and_rpc.sql
-- 1. Enable RLS SELECT policy for authenticated users to view their own corporate leads
-- 2. Create SECURITY DEFINER RPC get_user_corporate_lead to safely retrieve active corporate status
-- 3. Enhance submit_corporate_lead RPC to prevent duplicate application submissions before admin response

-- ============================================================
-- Section 1: RLS Select Policy for Own Corporate Leads
-- ============================================================
DROP POLICY IF EXISTS "corporate_leads_select_own" ON public.corporate_leads;
CREATE POLICY "corporate_leads_select_own"
  ON public.corporate_leads
  FOR SELECT
  TO authenticated
  USING (
    LOWER(email) = LOWER(auth.jwt()->>'email')
    OR phone = (SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ============================================================
-- Section 2: Secure RPC to Fetch User Corporate Lead
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_corporate_lead(
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL
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
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_email text;
  v_user_phone text;
BEGIN
  v_user_email := LOWER(COALESCE(NULLIF(TRIM(p_email), ''), auth.jwt()->>'email', ''));
  v_user_phone := TRIM(COALESCE(NULLIF(TRIM(p_phone), ''), (SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid()), ''));

  RETURN QUERY
  SELECT 
    cl.id,
    cl.company_name,
    cl.contact_name,
    cl.email,
    cl.phone,
    cl.address,
    cl.business_type,
    cl.estimated_volume,
    cl.notes,
    cl.status,
    cl.created_at,
    cl.updated_at
  FROM public.corporate_leads cl
  WHERE (v_user_email <> '' AND LOWER(cl.email) = v_user_email)
     OR (v_user_phone <> '' AND cl.phone = v_user_phone)
  ORDER BY cl.created_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_corporate_lead(text, text) TO anon, authenticated;

-- ============================================================
-- Section 3: Guarded Corporate Lead Submission RPC
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
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_new_id uuid;
  v_clean_email text;
  v_clean_phone text;
  v_existing_status text;
BEGIN
  v_clean_email := TRIM(LOWER(p_email));
  v_clean_phone := TRIM(p_phone);

  -- Check if an active application already exists for this email or phone
  SELECT cl.status INTO v_existing_status
  FROM public.corporate_leads cl
  WHERE (LOWER(cl.email) = v_clean_email OR cl.phone = v_clean_phone)
    AND cl.status IN ('pending', 'contacted', 'onboarded')
  ORDER BY cl.created_at DESC
  LIMIT 1;

  IF v_existing_status IS NOT NULL THEN
    IF v_existing_status = 'onboarded' THEN
      RAISE EXCEPTION 'Your corporate account is already approved and onboarded.' USING ERRCODE = 'KD409';
    ELSE
      RAISE EXCEPTION 'You already have an active corporate account application under review. Please wait for admin response.' USING ERRCODE = 'KD409';
    END IF;
  END IF;

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
    v_clean_email,
    v_clean_phone,
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
