-- ============================================================================
-- Migration: 20261017000002_rider_whatsapp_and_contact_enforcement.sql
-- Description: Add whatsapp_number column to profiles and riders,
--              project whatsapp_number in get_rider_operational_profile(),
--              and provide update_rider_contact_info() RPC for verified riders.
-- ============================================================================

-- 1. Schema Extensions
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

ALTER TABLE public.riders 
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- 2. Update get_rider_operational_profile() to project whatsapp_number
CREATE OR REPLACE FUNCTION public.get_rider_operational_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_profile jsonb;
BEGIN
  -- If caller's role is rider in profiles, guarantee a riders operational row exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rider') THEN
    INSERT INTO public.riders (profile_id, is_available, total_deliveries, is_active, is_verified, created_at, updated_at)
    VALUES (auth.uid(), false, 0, true, true, now(), now())
    ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'profile_id', r.profile_id,
    'vehicle_type', COALESCE(
      (SELECT ra.vehicle_type::text FROM public.rider_applications ra WHERE ra.profile_id = r.profile_id ORDER BY ra.submitted_at DESC LIMIT 1),
      (SELECT v.vehicle_type::text FROM public.vehicles v WHERE v.assigned_rider_id = r.id LIMIT 1),
      'motorcycle'
    ),
    'rating', r.rating,
    'total_deliveries', r.total_deliveries,
    'is_available', r.is_available,
    'is_verified', r.is_verified,
    'is_active', r.is_active,
    'full_name', p.full_name,
    'email', p.email,
    'phone', COALESCE(NULLIF(p.phone, ''), NULLIF((SELECT ra.phone FROM public.rider_applications ra WHERE ra.profile_id = r.profile_id ORDER BY ra.submitted_at DESC LIMIT 1), '')),
    'whatsapp_number', COALESCE(NULLIF(r.whatsapp_number, ''), NULLIF(p.whatsapp_number, '')),
    'avatar_url', p.avatar_url,
    'active_in_flight_count', (
      SELECT count(*)
      FROM public.delivery_assignments da
      JOIN public.deliveries d ON d.id = da.delivery_id
      WHERE da.rider_id = r.id
        AND da.status = 'accepted'
        AND d.status IN ('assigned', 'picked_up', 'in_transit')
    )
  ) INTO v_profile
  FROM public.riders r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.profile_id = auth.uid();

  RETURN v_profile;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_operational_profile() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_operational_profile() TO authenticated, service_role;

-- 3. Dedicated Authoritative RPC for Rider Contact Updates
CREATE OR REPLACE FUNCTION public.update_rider_contact_info(
  p_phone           text,
  p_whatsapp_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id       uuid;
  v_rider_id      uuid;
  v_clean_phone   text;
  v_clean_wa      text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'KD401';
  END IF;

  v_clean_phone := TRIM(COALESCE(p_phone, ''));
  IF v_clean_phone = '' THEN
    RAISE EXCEPTION 'Operational phone number is required' USING ERRCODE = 'KD400';
  END IF;

  -- If whatsapp_number is not provided or empty, fallback to the usual phone number
  v_clean_wa := TRIM(COALESCE(p_whatsapp_number, ''));
  IF v_clean_wa = '' THEN
    v_clean_wa := v_clean_phone;
  END IF;

  -- Verify rider ownership
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = v_user_id;

  IF v_rider_id IS NULL THEN
    -- Verify profile has rider role
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'rider') THEN
      RAISE EXCEPTION 'Only riders can update rider contact information' USING ERRCODE = 'KD403';
    END IF;

    INSERT INTO public.riders (profile_id, is_available, total_deliveries, is_active, is_verified, created_at, updated_at)
    VALUES (v_user_id, false, 0, true, true, now(), now())
    ON CONFLICT (profile_id) DO NOTHING;

    SELECT id INTO v_rider_id
    FROM public.riders
    WHERE profile_id = v_user_id;
  END IF;

  -- Update profiles table
  UPDATE public.profiles
  SET phone = v_clean_phone,
      whatsapp_number = v_clean_wa,
      updated_at = now()
  WHERE id = v_user_id;

  -- Update riders table
  UPDATE public.riders
  SET whatsapp_number = v_clean_wa,
      updated_at = now()
  WHERE id = v_rider_id;

  RETURN jsonb_build_object(
    'success', true,
    'phone', v_clean_phone,
    'whatsapp_number', v_clean_wa
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_rider_contact_info(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.update_rider_contact_info(text, text) TO authenticated, service_role;
