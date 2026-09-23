-- Migration: 20260902000031_direct_partner_onboarding.sql
-- KINGDOMDASH — ADMIN DIRECT PARTNER ONBOARDING RPCs (VENDOR & RIDER)
--
-- Security Invariants:
-- 1. Direct onboarding is restricted strictly to 'admin' and 'super_admin' roles (and service_role).
-- 2. Caller cannot target or demote super_admin profiles (KD403).
-- 3. Multi-service selection is mandatory for vendors (KD400 if empty).
-- 4. Authoritative provisioning of public.vendors + public.vendor_services and public.riders + public.vehicles.
-- 5. Revoked from PUBLIC and anon.

-- ============================================================================
-- §1  ADMIN DIRECT ONBOARD VENDOR RPC
-- ============================================================================

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
  v_caller_role     text;
  v_profile         record;
  v_app_id          uuid;
  v_vendor_id       uuid;
  v_st              public.service_type;
  v_chosen_services public.service_type[] := ARRAY[]::public.service_type[];
  v_target_biz_type public.business_type;
BEGIN
  -- 1. Authorization Gate
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') 
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can directly onboard vendors'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Input validation
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile ID is required for vendor onboarding'
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

  IF v_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot reassign a Super Admin account as vendor'
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
    updated_at           = now()
  RETURNING id INTO v_vendor_id;

  -- 7. Authoritatively synchronize public.vendor_services
  INSERT INTO public.vendor_services (vendor_id, service_type, is_active, updated_at)
  SELECT
    v_vendor_id,
    s.st,
    true,
    now()
  FROM unnest(v_chosen_services) AS s(st)
  ON CONFLICT (vendor_id, service_type) DO UPDATE SET
    is_active  = true,
    updated_at = now();

  -- Deactivate services not in chosen set
  UPDATE public.vendor_services
  SET
    is_active  = false,
    updated_at = now()
  WHERE vendor_id = v_vendor_id
    AND NOT (service_type = ANY(v_chosen_services));

  -- 8. Elevate target profile role to 'vendor'
  UPDATE public.profiles
  SET
    role       = 'vendor',
    phone      = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
    updated_at = now()
  WHERE id = p_profile_id;

  -- 9. Audit log entry
  INSERT INTO public.audit_logs (
    profile_id,
    action,
    entity_type,
    entity_id,
    new_values,
    created_at
  ) VALUES (
    auth.uid(),
    'DIRECT_ONBOARD_VENDOR',
    'vendor',
    v_vendor_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'business_name', p_business_name,
      'services', v_chosen_services,
      'onboarded_by_role', v_caller_role
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'vendor_id', v_vendor_id,
    'profile_id', p_profile_id,
    'application_id', v_app_id,
    'services', v_chosen_services
  );
END;
$$;

-- ============================================================================
-- §2  ADMIN DIRECT ONBOARD RIDER RPC
-- ============================================================================

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
  v_caller_role text;
  v_profile     record;
  v_app_id      uuid;
  v_rider_id    uuid;
  v_vehicle_id  uuid;
BEGIN
  -- 1. Authorization Gate
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') 
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can directly onboard riders'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Input validation
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile ID is required for rider onboarding'
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

  IF v_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'Cannot reassign a Super Admin account as rider'
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

  -- 8. Audit log entry
  INSERT INTO public.audit_logs (
    profile_id,
    action,
    entity_type,
    entity_id,
    new_values,
    created_at
  ) VALUES (
    auth.uid(),
    'DIRECT_ONBOARD_RIDER',
    'rider',
    v_rider_id,
    jsonb_build_object(
      'profile_id', p_profile_id,
      'full_name', p_full_name,
      'vehicle_type', p_vehicle_type,
      'license_plate', p_license_plate,
      'onboarded_by_role', v_caller_role
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'rider_id', v_rider_id,
    'profile_id', p_profile_id,
    'application_id', v_app_id,
    'vehicle_id', v_vehicle_id
  );
END;
$$;

-- ============================================================================
-- §3  PERMISSIONS & REVOCATIONS
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_direct_onboard_vendor(uuid, text, text, text, text, public.service_type[], text, public.business_type) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_direct_onboard_rider(uuid, text, text, text, public.vehicle_type, text, text, text, integer, text) TO authenticated, service_role;
