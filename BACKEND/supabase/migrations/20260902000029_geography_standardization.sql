-- Migration: 20260902000029_geography_standardization.sql
-- Purpose:   Standardise KingdomDash geography to Ijebu-Ode, Ogun State
--            (the platform's intended launch territory).
--
-- Changes:
--   1. Replace Lagos neighbourhood seed data in service_areas with
--      Ijebu-Ode / Ogun State zones.
--   2. Patch business_address fallback strings in three operational
--      PL/pgSQL functions that previously defaulted to 'Market Center, Owerri'.
--      The Owerri string appears in migrations 023 and 028; this migration
--      takes precedence by recreating those functions with correct defaults.
--
-- Safe to apply on a live Supabase project -- all operations are idempotent.
-- ============================================================================


-- ============================================================================
-- SS1  SERVICE AREAS -- Replace Lagos zones with Ijebu-Ode zones
-- ============================================================================

-- Remove the five Lagos neighbourhoods inserted by migration 012.
DELETE FROM public.service_areas
WHERE name IN ('Lekki Phase 1', 'Yaba', 'Victoria Island', 'Ikeja', 'Surulere');

-- Seed Ijebu-Ode operational zones.
-- Centre point: Lat 6.820556, Lng 3.916389 (Ijebu-Ode town centre)
-- Service radius: 12.5 km
INSERT INTO public.service_areas (name, description, is_active)
VALUES
  ('Ijebu-Ode Central',    'Town centre -- Oba Sikiru Adetona Road and environs',        true),
  ('Ijebu-Ode North',      'Areas towards Ago-Iwoye Road and Ita-Osu',                  true),
  ('Ijebu-Ode South',      'Areas towards Sagamu Road and Oke-Sopen',                   true),
  ('Ijebu-Ode East',       'Areas towards Epe Road and Ijebu-Igbo junction',            true),
  ('Ijebu-Ode West',       'Areas towards Ibadan Road and Itoro',                       true)
ON CONFLICT (name) DO NOTHING;


-- ============================================================================
-- SS2  FUNCTION: public.trg_fn_sync_profile_role_to_operational()
--     Recreated from migration 028 -- only business_address fallback changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_fn_sync_profile_role_to_operational()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vapp      record;
  v_vendor_id uuid;
  v_st        public.service_type;
BEGIN
  -- 1. Profile is Rider -> Ensure row exists in public.riders
  IF NEW.role = 'rider' THEN
    INSERT INTO public.riders (
      profile_id,
      is_available,
      total_deliveries,
      is_active,
      is_verified,
      created_at,
      updated_at
    ) VALUES (
      NEW.id,
      false,
      0,
      true,
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      is_verified = true,
      updated_at = now();

    UPDATE public.rider_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';

  ELSIF NEW.role = 'vendor' THEN
    SELECT * INTO v_vapp
    FROM public.vendor_applications
    WHERE profile_id = NEW.id
    ORDER BY submitted_at DESC
    LIMIT 1;

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
      NEW.id,
      COALESCE(v_vapp.business_name, NULLIF(TRIM(NEW.full_name), '') || ' Store', 'KingdomDash Vendor Store'),
      COALESCE(v_vapp.business_type, 'restaurant'::public.business_type),
      v_vapp.business_description,
      COALESCE(v_vapp.business_address, 'Ijebu-Ode, Ogun State'),
      COALESCE(v_vapp.phone, NEW.phone, ''),
      COALESCE(v_vapp.email, NEW.email, ''),
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.vendors.phone),
      email = COALESCE(NULLIF(EXCLUDED.email, ''), public.vendors.email),
      is_active = true,
      updated_at = now()
    RETURNING id INTO v_vendor_id;

    IF v_vapp.service_types IS NOT NULL AND array_length(v_vapp.service_types, 1) > 0 THEN
      FOREACH v_st IN ARRAY v_vapp.service_types
      LOOP
        IF v_st IN ('food', 'grocery') THEN
          INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
          VALUES (v_vendor_id, v_st, true)
          ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
        END IF;
      END LOOP;
    ELSE
      INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
      VALUES (
        v_vendor_id,
        CASE WHEN COALESCE(v_vapp.business_type, 'restaurant') = 'grocery_store' THEN 'grocery'::public.service_type ELSE 'food'::public.service_type END,
        true
      )
      ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
    END IF;

    UPDATE public.vendor_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- SS3  FUNCTION: public.approve_vendor_application(uuid)
--     Recreated from migration 028 -- only business_address fallback changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_vendor_application(
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_app         record;
  v_profile     record;
  v_vendor_id   uuid;
  v_st          public.service_type;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can approve vendor applications'
      USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_app
  FROM public.vendor_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor application % not found', p_application_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_app.status = 'approved' THEN
    SELECT id INTO v_vendor_id FROM public.vendors WHERE profile_id = v_app.profile_id;
    RETURN jsonb_build_object(
      'success', true,
      'application_id', p_application_id,
      'vendor_id', v_vendor_id,
      'profile_id', v_app.profile_id,
      'status', 'already_approved'
    );
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot approve vendor application in % status', v_app.status
      USING ERRCODE = 'KD409';
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_app.profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for vendor applicant % not found', v_app.profile_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot approve vendor application: profile is inactive'
      USING ERRCODE = 'KD409';
  END IF;

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
    v_app.profile_id,
    COALESCE(v_app.business_name, NULLIF(TRIM(v_profile.full_name), '') || ' Store', 'KingdomDash Vendor Store'),
    COALESCE(v_app.business_type, 'restaurant'::public.business_type),
    v_app.business_description,
    COALESCE(v_app.business_address, 'Ijebu-Ode, Ogun State'),
    COALESCE(v_app.phone, v_profile.phone, ''),
    COALESCE(v_app.email, v_profile.email, ''),
    true,
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    business_address = EXCLUDED.business_address,
    is_active = true,
    updated_at = now()
  RETURNING id INTO v_vendor_id;

  IF v_app.service_types IS NOT NULL AND array_length(v_app.service_types, 1) > 0 THEN
    FOREACH v_st IN ARRAY v_app.service_types
    LOOP
      IF v_st IN ('food', 'grocery') THEN
        INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
        VALUES (v_vendor_id, v_st, true)
        ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.vendor_services (vendor_id, service_type, is_active)
    VALUES (
      v_vendor_id,
      CASE WHEN COALESCE(v_app.business_type, 'restaurant') = 'grocery_store' THEN 'grocery'::public.service_type ELSE 'food'::public.service_type END,
      true
    )
    ON CONFLICT (vendor_id, service_type) DO UPDATE SET is_active = true, updated_at = now();
  END IF;

  UPDATE public.vendor_applications
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  UPDATE public.profiles
  SET role = 'vendor'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id;

  PERFORM public.log_operational_audit_event(
    'vendor_application_approved',
    'vendor_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'vendor_id', v_vendor_id),
    'Approved by administrator'
  );

  PERFORM public.log_operational_audit_event(
    'vendor_role_promoted',
    'profile',
    v_app.profile_id,
    jsonb_build_object('role', v_profile.role),
    jsonb_build_object('role', 'vendor', 'vendor_id', v_vendor_id),
    'Role promoted following vendor application approval'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'vendor_id', v_vendor_id,
    'profile_id', v_app.profile_id,
    'role', 'vendor'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_vendor_application(uuid) TO authenticated, service_role;


-- ============================================================================
-- SS4  FUNCTION: public.reconcile_rider_vendor_records()
--     Recreated from migration 023 -- only business_address fallback changed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_rider_vendor_records()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role        text;
  r_rec                record;
  v_vapp               record;
  v_reconciled_riders  integer := 0;
  v_reconciled_vendors integer := 0;
  v_log                jsonb := '[]'::jsonb;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: administrative privileges required'
      USING ERRCODE = 'KD403';
  END IF;

  FOR r_rec IN
    SELECT p.id, p.email, p.full_name, p.phone, p.is_active
    FROM public.profiles p
    LEFT JOIN public.riders r ON r.profile_id = p.id
    WHERE p.role = 'rider' AND r.profile_id IS NULL
  LOOP
    INSERT INTO public.riders (
      profile_id,
      is_available,
      total_deliveries,
      is_active,
      is_verified,
      created_at,
      updated_at
    ) VALUES (
      r_rec.id,
      false,
      0,
      true,
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      is_verified = true,
      updated_at = now();

    UPDATE public.rider_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = r_rec.id AND status = 'pending';

    v_reconciled_riders := v_reconciled_riders + 1;
    v_log := v_log || jsonb_build_object(
      'action', 'reconciled_rider',
      'profile_id', r_rec.id,
      'email', r_rec.email
    );
  END LOOP;

  FOR r_rec IN
    SELECT p.id, p.email, p.full_name, p.phone, p.is_active
    FROM public.profiles p
    LEFT JOIN public.vendors v ON v.profile_id = p.id
    WHERE p.role = 'vendor' AND v.profile_id IS NULL
  LOOP
    SELECT * INTO v_vapp
    FROM public.vendor_applications
    WHERE profile_id = r_rec.id
    ORDER BY submitted_at DESC
    LIMIT 1;

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
      r_rec.id,
      COALESCE(v_vapp.business_name, NULLIF(TRIM(r_rec.full_name), '') || ' Store', 'KingdomDash Vendor Store'),
      COALESCE(v_vapp.business_type, 'restaurant'::public.business_type),
      v_vapp.business_description,
      COALESCE(v_vapp.business_address, 'Ijebu-Ode, Ogun State'),
      COALESCE(v_vapp.phone, r_rec.phone, ''),
      COALESCE(v_vapp.email, r_rec.email, ''),
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      updated_at = now();

    UPDATE public.vendor_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = r_rec.id AND status = 'pending';

    v_reconciled_vendors := v_reconciled_vendors + 1;
    v_log := v_log || jsonb_build_object(
      'action', 'reconciled_vendor',
      'profile_id', r_rec.id,
      'email', r_rec.email
    );
  END LOOP;

  RETURN jsonb_build_object(
    'reconciled_riders_count', v_reconciled_riders,
    'reconciled_vendors_count', v_reconciled_vendors,
    'log', v_log
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reconcile_rider_vendor_records() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reconcile_rider_vendor_records() FROM anon;
GRANT  EXECUTE ON FUNCTION public.reconcile_rider_vendor_records() TO authenticated, service_role;


-- ============================================================================
-- SS5  PATCH EXISTING VENDOR ROWS
--     Any vendor whose business_address was set to the old Owerri fallback
--     (i.e. they had no real address on their application) gets patched to
--     the Ijebu-Ode placeholder so the storefront displays correctly.
-- ============================================================================

UPDATE public.vendors
SET business_address = 'Ijebu-Ode, Ogun State',
    updated_at       = now()
WHERE business_address = 'Market Center, Owerri';
