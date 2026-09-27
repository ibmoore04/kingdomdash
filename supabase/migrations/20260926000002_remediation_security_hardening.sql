-- Migration: 20260926000002_remediation_security_hardening.sql
-- Description: Comprehensive Security Remediation for KingdomDash:
--   1. P0: Harden get_user_corporate_lead RPC — Revoke anon access, prevent IDOR, bind non-admin queries to verified auth identity.
--   2. P1: Harden admin_direct_onboard_vendor & admin_direct_onboard_rider — Prevent peer administrative account demotion/hijacking.
--   3. P1: Audit and harden sensitive Supabase Storage bucket policies on storage.objects with AS RESTRICTIVE security isolation.
--   4. P2: Harden support ticket reference codes (12-hex high entropy) and redact sensitive PII in get_support_ticket_by_ref RPC.

-- ============================================================================
-- SECTION 1: P0 — HARDEN get_user_corporate_lead (REVOKE ANON & PREVENT IDOR)
-- ============================================================================

-- 1.1 Revoke unauthenticated / public execution privileges
REVOKE ALL ON FUNCTION public.get_user_corporate_lead(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_corporate_lead(text, text) FROM anon;

-- 1.2 Replace RPC with strictly guarded identity-bound implementation
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
  v_caller_id        uuid;
  v_caller_role      text;
  v_search_email     text;
  v_search_phone     text;
BEGIN
  -- Strict Authentication Gate: Anonymous calls are prohibited
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL 
     AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  v_caller_role := public.get_current_user_role();

  -- If caller possesses administrative or service authority, permit parameter-based lookup
  IF v_caller_role IN ('admin', 'super_admin') 
     OR (auth.jwt()->>'role') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    v_search_email := LOWER(COALESCE(NULLIF(TRIM(p_email), ''), auth.jwt()->>'email', ''));
    v_search_phone := TRIM(COALESCE(NULLIF(TRIM(p_phone), ''), ''));
  ELSE
    -- Non-admin callers (customers) are strictly bound to their verified JWT email and profile phone.
    -- Any client-supplied email/phone arguments are discarded to prevent IDOR / enumeration attacks.
    v_search_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
    SELECT TRIM(COALESCE(p.phone, '')) INTO v_search_phone
    FROM public.profiles p
    WHERE p.id = v_caller_id;
  END IF;

  IF v_search_email = '' AND v_search_phone = '' THEN
    RETURN;
  END IF;

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
  WHERE (v_search_email <> '' AND LOWER(cl.email) = v_search_email)
     OR (v_search_phone <> '' AND cl.phone = v_search_phone)
  ORDER BY cl.created_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_corporate_lead(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_corporate_lead(text, text) TO authenticated, service_role;


-- ============================================================================
-- SECTION 2: P1 — PREVENT ADMINISTRATIVE ACCOUNT REASSIGNMENT VIA DIRECT ONBOARDING
-- ============================================================================

-- 2.1 Harden admin_direct_onboard_vendor
CREATE OR REPLACE FUNCTION public.admin_direct_onboard_vendor(
  p_profile_id           uuid,
  p_business_name        text,
  p_business_address     text,
  p_phone                text,
  p_email                text,
  p_service_types        public.service_type[],
  p_business_description text DEFAULT NULL,
  p_business_type        public.business_type DEFAULT 'restaurant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id       uuid;
  v_caller_role     text;
  v_profile         record;
  v_app_id          uuid;
  v_vendor_id       uuid;
  v_st              public.service_type;
  v_chosen_services public.service_type[] := ARRAY[]::public.service_type[];
  v_target_biz_type public.business_type;
BEGIN
  v_caller_id   := auth.uid();
  v_caller_role := public.get_current_user_role();

  -- 1. Authorization Gate (Admin, Super Admin, or Service Role)
  IF v_caller_role NOT IN ('admin', 'super_admin') 
     AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can directly onboard vendors'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Input validation
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile ID is required for vendor onboarding'
      USING ERRCODE = 'KD400';
  END IF;

  -- Prevent self-reassignment
  IF v_caller_id IS NOT NULL AND p_profile_id = v_caller_id THEN
    RAISE EXCEPTION 'Administrative callers cannot reassign their own account'
      USING ERRCODE = 'KD400';
  END IF;

  IF TRIM(COALESCE(p_business_name, '')) = '' THEN
    RAISE EXCEPTION 'Business name cannot be empty'
      USING ERRCODE = 'KD400';
  END IF;

  IF TRIM(COALESCE(p_business_address, '')) = '' THEN
    RAISE EXCEPTION 'Business address cannot be empty'
      USING ERRCODE = 'KD400';
  END IF;

  IF p_service_types IS NULL OR array_length(p_service_types, 1) IS NULL OR array_length(p_service_types, 1) = 0 THEN
    RAISE EXCEPTION 'Vendor onboarding requires selecting at least one active service capability (food, grocery, or food+grocery)'
      USING ERRCODE = 'KD400';
  END IF;

  FOREACH v_st IN ARRAY p_service_types
  LOOP
    IF v_st IN ('food'::public.service_type, 'grocery'::public.service_type) THEN
      IF NOT (v_st = ANY(v_chosen_services)) THEN
        v_chosen_services := array_append(v_chosen_services, v_st);
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_chosen_services, 1) IS NULL OR array_length(v_chosen_services, 1) = 0 THEN
    RAISE EXCEPTION 'Vendor onboarding requires selecting at least one active service capability (food, grocery, or food+grocery)'
      USING ERRCODE = 'KD400';
  END IF;

  -- 3. Lock & check target profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot onboard vendor: target user account is deactivated'
      USING ERRCODE = 'KD409';
  END IF;

  -- Security Hardening: Neither standard admin nor super_admin profiles may be reassigned as vendor
  IF v_profile.role IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Security violation: Cannot demote or reassign an administrative account (%) as vendor', v_profile.role
      USING ERRCODE = 'KD403';
  END IF;

  -- 4. Determine business_type
  IF 'food'::public.service_type = ANY(v_chosen_services) THEN
    v_target_biz_type := 'restaurant'::public.business_type;
  ELSE
    v_target_biz_type := 'grocery_store'::public.business_type;
  END IF;

  -- 5. Upsert vendor_applications record
  SELECT id INTO v_app_id
  FROM public.vendor_applications
  WHERE profile_id = p_profile_id;

  IF v_app_id IS NOT NULL THEN
    UPDATE public.vendor_applications
    SET
      business_name        = TRIM(p_business_name),
      business_type        = v_target_biz_type,
      service_types        = v_chosen_services,
      business_description = TRIM(p_business_description),
      business_address     = TRIM(p_business_address),
      phone                = TRIM(p_phone),
      email                = LOWER(TRIM(p_email)),
      status               = 'approved',
      reviewed_by          = auth.uid(),
      reviewed_at          = now()
    WHERE id = v_app_id;
  ELSE
    INSERT INTO public.vendor_applications (
      profile_id,
      business_name,
      business_type,
      service_types,
      business_description,
      business_address,
      phone,
      email,
      status,
      submitted_at,
      reviewed_by,
      reviewed_at
    ) VALUES (
      p_profile_id,
      TRIM(p_business_name),
      v_target_biz_type,
      v_chosen_services,
      TRIM(p_business_description),
      TRIM(p_business_address),
      TRIM(p_phone),
      LOWER(TRIM(p_email)),
      'approved',
      now(),
      auth.uid(),
      now()
    )
    RETURNING id INTO v_app_id;
  END IF;

  -- 6. Upsert public.vendors operational record
  INSERT INTO public.vendors (
    profile_id,
    business_name,
    business_type,
    business_description,
    business_address,
    phone,
    email,
    is_active,
    is_verified,
    is_accepting_orders,
    commission_rate,
    created_at,
    updated_at
  ) VALUES (
    p_profile_id,
    TRIM(p_business_name),
    v_target_biz_type,
    TRIM(p_business_description),
    TRIM(p_business_address),
    TRIM(p_phone),
    LOWER(TRIM(p_email)),
    true,
    true,
    true,
    15.00,
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    business_name        = EXCLUDED.business_name,
    business_type        = EXCLUDED.business_type,
    business_description = EXCLUDED.business_description,
    business_address     = EXCLUDED.business_address,
    phone                = EXCLUDED.phone,
    email                = EXCLUDED.email,
    is_active            = true,
    is_verified          = true,
    is_accepting_orders  = true,
    updated_at           = now()
  RETURNING id INTO v_vendor_id;

  -- 7. Populate vendor_service_types
  DELETE FROM public.vendor_service_types
  WHERE vendor_id = v_vendor_id;

  FOREACH v_st IN ARRAY v_chosen_services
  LOOP
    INSERT INTO public.vendor_service_types (
      vendor_id,
      service_type,
      is_active,
      created_at
    ) VALUES (
      v_vendor_id,
      v_st,
      true,
      now()
    )
    ON CONFLICT (vendor_id, service_type) DO UPDATE SET
      is_active = true;
  END LOOP;

  -- 8. Elevate target profile role to 'vendor'
  UPDATE public.profiles
  SET
    role       = 'vendor',
    full_name  = COALESCE(NULLIF(TRIM(p_business_name), ''), full_name),
    phone      = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
    updated_at = now()
  WHERE id = p_profile_id;

  -- 9. Audit Log Entry
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    'admin_direct_onboard_vendor',
    'vendors',
    v_vendor_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'business_name', p_business_name,
      'service_types', v_chosen_services,
      'direct_onboarded', true
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', v_vendor_id,
    'application_id', v_app_id,
    'service_types', v_chosen_services
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) TO authenticated, service_role;


-- 2.2 Harden admin_direct_onboard_rider
-- Preserves EXACT parameter signature and order from migration 20260902000031
CREATE OR REPLACE FUNCTION public.admin_direct_onboard_rider(
  p_profile_id    uuid,
  p_full_name     text,
  p_phone         text,
  p_email         text,
  p_vehicle_type  public.vehicle_type,
  p_address       text DEFAULT NULL,
  p_vehicle_make  text DEFAULT NULL,
  p_vehicle_model text DEFAULT NULL,
  p_vehicle_year  integer DEFAULT NULL,
  p_license_plate text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id   uuid;
  v_caller_role text;
  v_profile     record;
  v_app_id      uuid;
  v_rider_id    uuid;
  v_vehicle_id  uuid;
BEGIN
  v_caller_id   := auth.uid();
  v_caller_role := public.get_current_user_role();

  -- 1. Authorization Gate (Admin, Super Admin, or Service Role)
  IF v_caller_role NOT IN ('admin', 'super_admin')
     AND (auth.jwt()->>'role') IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can directly onboard riders'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Input validation
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile ID is required for rider onboarding'
      USING ERRCODE = 'KD400';
  END IF;

  -- Prevent self-reassignment
  IF v_caller_id IS NOT NULL AND p_profile_id = v_caller_id THEN
    RAISE EXCEPTION 'Administrative callers cannot reassign their own account'
      USING ERRCODE = 'KD400';
  END IF;

  IF TRIM(COALESCE(p_full_name, '')) = '' THEN
    RAISE EXCEPTION 'Rider full name cannot be empty'
      USING ERRCODE = 'KD400';
  END IF;

  IF TRIM(COALESCE(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'Rider phone cannot be empty'
      USING ERRCODE = 'KD400';
  END IF;

  IF p_vehicle_type IS NULL THEN
    RAISE EXCEPTION 'Vehicle type is required for rider onboarding'
      USING ERRCODE = 'KD400';
  END IF;

  -- 3. Lock & check target profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found', p_profile_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot onboard rider: target user account is deactivated'
      USING ERRCODE = 'KD409';
  END IF;

  -- Security Hardening: Neither standard admin nor super_admin profiles may be reassigned as rider
  IF v_profile.role IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Security violation: Cannot demote or reassign an administrative account (%) as rider', v_profile.role
      USING ERRCODE = 'KD403';
  END IF;

  -- 4. Upsert rider_applications record
  SELECT id INTO v_app_id
  FROM public.rider_applications
  WHERE profile_id = p_profile_id;

  IF v_app_id IS NOT NULL THEN
    UPDATE public.rider_applications
    SET
      full_name     = TRIM(p_full_name),
      phone         = TRIM(p_phone),
      email         = LOWER(TRIM(p_email)),
      address       = TRIM(p_address),
      vehicle_type  = p_vehicle_type,
      vehicle_make  = TRIM(p_vehicle_make),
      vehicle_model = TRIM(p_vehicle_model),
      vehicle_year  = p_vehicle_year,
      status        = 'approved',
      reviewed_by   = auth.uid(),
      reviewed_at   = now()
    WHERE id = v_app_id;
  ELSE
    INSERT INTO public.rider_applications (
      profile_id,
      full_name,
      phone,
      email,
      address,
      vehicle_type,
      vehicle_make,
      vehicle_model,
      vehicle_year,
      status,
      submitted_at,
      reviewed_by,
      reviewed_at
    ) VALUES (
      p_profile_id,
      TRIM(p_full_name),
      TRIM(p_phone),
      LOWER(TRIM(p_email)),
      TRIM(p_address),
      p_vehicle_type,
      TRIM(p_vehicle_make),
      TRIM(p_vehicle_model),
      p_vehicle_year,
      'approved',
      now(),
      auth.uid(),
      now()
    )
    RETURNING id INTO v_app_id;
  END IF;

  -- 5. Upsert public.riders operational record
  INSERT INTO public.riders (
    profile_id,
    is_available,
    total_deliveries,
    is_active,
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    p_profile_id,
    false, -- Default offline
    0,
    true,
    true,  -- Immediately verified for operational readiness
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    is_active   = true,
    is_verified = true,
    updated_at  = now()
  RETURNING id INTO v_rider_id;

  -- 6. Upsert vehicle record if plate or vehicle details provided
  IF TRIM(COALESCE(p_license_plate, '')) <> '' THEN
    INSERT INTO public.vehicles (
      assigned_rider_id,
      vehicle_type,
      make,
      model,
      year,
      license_plate,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_rider_id,
      p_vehicle_type,
      COALESCE(TRIM(p_vehicle_make), 'Standard'),
      COALESCE(TRIM(p_vehicle_model), 'Fleet'),
      COALESCE(p_vehicle_year, EXTRACT(YEAR FROM now())::integer),
      UPPER(TRIM(p_license_plate)),
      'active',
      now(),
      now()
    )
    ON CONFLICT (license_plate) DO UPDATE SET
      assigned_rider_id = v_rider_id,
      vehicle_type      = EXCLUDED.vehicle_type,
      make              = EXCLUDED.make,
      model             = EXCLUDED.model,
      year              = EXCLUDED.year,
      status            = 'active',
      updated_at        = now()
    RETURNING id INTO v_vehicle_id;
  END IF;

  -- 7. Elevate target profile role to 'rider'
  UPDATE public.profiles
  SET
    role       = 'rider',
    full_name  = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
    phone      = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
    updated_at = now()
  WHERE id = p_profile_id;

  -- 8. Audit Log Entry
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity,
    entity_id,
    metadata,
    created_at
  ) VALUES (
    auth.uid(),
    'admin_direct_onboard_rider',
    'riders',
    v_rider_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'rider_id', v_rider_id,
      'vehicle_id', v_vehicle_id,
      'vehicle_type', p_vehicle_type,
      'license_plate', p_license_plate,
      'direct_onboarded', true
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'rider_id', v_rider_id,
    'application_id', v_app_id,
    'vehicle_id', v_vehicle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) TO authenticated, service_role;


-- ============================================================================
-- SECTION 3: P1 — AUDIT & HARDEN SENSITIVE STORAGE BUCKET POLICIES (RESTRICTIVE)
-- ============================================================================

DO $$
BEGIN
  -- Verify if storage.objects table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    -- Note: storage.objects already has RLS enabled by default in Supabase (owned by supabase_storage_admin).
    -- Attempting to alter storage.objects to enable row level security fails with 42501 (must be owner).
    -- Drop previous iterations of sensitive document policies
    DROP POLICY IF EXISTS "sensitive_documents_isolation" ON storage.objects;
    DROP POLICY IF EXISTS "sensitive_documents_admin_all" ON storage.objects;
    DROP POLICY IF EXISTS "sensitive_documents_owner_insert" ON storage.objects;
    DROP POLICY IF EXISTS "sensitive_documents_isolation_restrictive" ON storage.objects;

    -- Create RESTRICTIVE policy ensuring no permissive policy can ever bypass isolation on sensitive buckets.
    -- Unrelated buckets (avatars, product-images, etc.) evaluate to TRUE immediately and are unaffected.
    CREATE POLICY "sensitive_documents_isolation_restrictive" ON storage.objects
      AS RESTRICTIVE
      FOR ALL
      TO authenticated, anon
      USING (
        bucket_id NOT IN ('rider-licenses', 'kyc-documents', 'vendor-documents')
        OR (
          (auth.role() = 'authenticated' AND (
            owner = auth.uid()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR name LIKE auth.uid()::text || '/%'
            OR public.get_current_user_role() IN ('admin', 'super_admin')
          ))
          OR (auth.jwt()->>'role') = 'service_role'
          OR current_user IN ('postgres', 'supabase_admin')
        )
      )
      WITH CHECK (
        bucket_id NOT IN ('rider-licenses', 'kyc-documents', 'vendor-documents')
        OR (
          (auth.role() = 'authenticated' AND (
            owner = auth.uid()
            OR (storage.foldername(name))[1] = auth.uid()::text
            OR name LIKE auth.uid()::text || '/%'
            OR public.get_current_user_role() IN ('admin', 'super_admin')
          ))
          OR (auth.jwt()->>'role') = 'service_role'
          OR current_user IN ('postgres', 'supabase_admin')
        )
      );

  END IF;
END $$;


-- ============================================================================
-- SECTION 4: P2 — HARDEN SUPPORT TICKET CODES & REDACT SENSITIVE PII IN LOOKUPS
-- ============================================================================

-- 4.1 Update contact_messages default reference code generation to high-entropy 12-hex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'contact_messages' AND column_name = 'reference_code'
  ) THEN
    ALTER TABLE public.contact_messages 
      ALTER COLUMN reference_code SET DEFAULT ('KD-SUP-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12)));
  END IF;
END $$;

-- 4.2 Update submit_support_ticket to generate 12-hex (~281.5 trillion combinations)
CREATE OR REPLACE FUNCTION public.submit_support_ticket(
  p_name    text,
  p_email   text,
  p_phone   text DEFAULT NULL,
  p_subject text DEFAULT 'Support Request',
  p_message text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_ref_code        text;
  v_user_id         uuid;
  v_clean_name      text;
  v_clean_email     text;
  v_clean_phone     text;
  v_clean_subject   text;
  v_clean_message   text;
  v_ticket_id       uuid;
  v_admin_record    record;
  v_attempt         integer := 0;
BEGIN
  -- 1. Input sanitization & validation
  v_clean_name    := TRIM(COALESCE(p_name, ''));
  v_clean_email   := LOWER(TRIM(COALESCE(p_email, '')));
  v_clean_phone   := TRIM(COALESCE(p_phone, ''));
  v_clean_subject := TRIM(COALESCE(p_subject, ''));
  v_clean_message := TRIM(COALESCE(p_message, ''));

  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Full name is required' USING ERRCODE = 'KD400';
  END IF;

  IF v_clean_email = '' OR v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'A valid email address is required' USING ERRCODE = 'KD400';
  END IF;

  IF v_clean_message = '' THEN
    RAISE EXCEPTION 'Support message content is required' USING ERRCODE = 'KD400';
  END IF;

  IF v_clean_subject = '' THEN
    v_clean_subject := 'Support Request from ' || v_clean_name;
  END IF;

  -- 2. Bind authenticated user_id if calling under active session
  v_user_id := auth.uid();

  -- 3. Generate high-entropy reference code: KD-SUP-XXXXXXXXXXXX (12 hex digits = ~281.5T possibilities)
  LOOP
    v_attempt := v_attempt + 1;
    v_ref_code := 'KD-SUP-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
    
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.contact_messages WHERE reference_code = v_ref_code
    ) OR v_attempt >= 5;
  END LOOP;

  -- 4. Insert ticket into public.contact_messages
  INSERT INTO public.contact_messages (
    user_id,
    name,
    email,
    phone,
    subject,
    message,
    category,
    status,
    reference_code,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_clean_name,
    v_clean_email,
    NULLIF(v_clean_phone, ''),
    v_clean_subject,
    v_clean_message,
    'support',
    'new',
    v_ref_code,
    now(),
    now()
  )
  RETURNING id INTO v_ticket_id;

  -- 5. Broadcast notification to active administrators
  FOR v_admin_record IN (
    SELECT id FROM public.profiles 
    WHERE role IN ('admin', 'super_admin') AND is_active = true
  ) LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      metadata,
      created_at
    ) VALUES (
      v_admin_record.id,
      'New Support Ticket: ' || v_ref_code,
      v_clean_name || ' submitted a support inquiry: ' || SUBSTRING(v_clean_subject FROM 1 FOR 60),
      'system',
      jsonb_build_object(
        'ticket_id', v_ticket_id,
        'reference_code', v_ref_code,
        'email', v_clean_email,
        'subject', v_clean_subject
      ),
      now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'reference_code', v_ref_code,
    'message', 'Your support ticket has been received. Our team will contact you shortly.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_support_ticket(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;


-- 4.3 Update get_support_ticket_by_ref to enforce minimum code length and redact PII for public lookups
CREATE OR REPLACE FUNCTION public.get_support_ticket_by_ref(p_ref_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clean_ref text;
  v_rec       record;
  v_is_owner  boolean := false;
  v_is_admin  boolean := false;
BEGIN
  v_clean_ref := UPPER(TRIM(COALESCE(p_ref_code, '')));

  -- Minimum length check: Prevent single-letter / short prefix enumeration
  IF LENGTH(v_clean_ref) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT 
    cm.id,
    cm.user_id,
    cm.reference_code,
    cm.name,
    cm.email,
    cm.phone,
    cm.subject,
    cm.message,
    cm.category,
    cm.status,
    cm.admin_response,
    cm.admin_responded_at,
    cm.created_at,
    cm.updated_at
  INTO v_rec
  FROM public.contact_messages cm
  WHERE cm.reference_code = v_clean_ref
     OR (cm.id::text = LOWER(TRIM(p_ref_code)))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Determine authorization level
  IF auth.uid() IS NOT NULL THEN
    v_is_owner := (v_rec.user_id = auth.uid()) 
                  OR (auth.jwt()->>'email' IS NOT NULL AND LOWER(v_rec.email) = LOWER(auth.jwt()->>'email'));
    v_is_admin := (public.get_current_user_role() IN ('admin', 'super_admin'));
  END IF;

  IF (auth.jwt()->>'role') = 'service_role' OR current_user IN ('postgres', 'supabase_admin') THEN
    v_is_admin := true;
  END IF;

  -- If caller is the ticket creator or an administrator, return complete conversation details
  IF v_is_owner OR v_is_admin THEN
    RETURN jsonb_build_object(
      'id', v_rec.id,
      'reference_code', v_rec.reference_code,
      'name', v_rec.name,
      'email', v_rec.email,
      'phone', v_rec.phone,
      'subject', v_rec.subject,
      'message', v_rec.message,
      'category', v_rec.category,
      'status', v_rec.status,
      'admin_response', v_rec.admin_response,
      'admin_responded_at', v_rec.admin_responded_at,
      'created_at', v_rec.created_at,
      'updated_at', v_rec.updated_at
    );
  END IF;

  -- For public / anonymous lookups: return tracking status and admin response.
  -- Personal identifiers (name, email, phone, and customer message body) are strictly REDACTED
  -- to prevent enumeration and customer data harvesting.
  RETURN jsonb_build_object(
    'id', v_rec.id,
    'reference_code', v_rec.reference_code,
    'subject', v_rec.subject,
    'category', v_rec.category,
    'status', v_rec.status,
    'admin_response', v_rec.admin_response,
    'admin_responded_at', v_rec.admin_responded_at,
    'created_at', v_rec.created_at,
    'updated_at', v_rec.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_ticket_by_ref(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_ticket_by_ref(text) TO anon, authenticated, service_role;
