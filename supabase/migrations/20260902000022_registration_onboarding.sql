-- Migration: 20260902000022_registration_onboarding.sql
-- KINGDOMDASH — REGISTRATION & ONBOARDING ARCHITECTURE CORRECTION
--
-- Core Security Invariant:
-- 1. Account type selected during registration is INTENT, NOT authorization.
-- 2. Client-submitted intent NEVER grants privileged roles (profiles.role remains 'customer').
-- 3. Rider selection creates rider_applications (status = 'pending') without fake data.
-- 4. Vendor selection creates vendor_applications (status = 'pending') without fake data.
-- 5. Canonical profile phone storage with server-authoritative E.164 normalization.
-- 6. Hardened SECURITY DEFINER functions with minimal search_path = public and revoked PUBLIC execution.

-- ============================================================
-- Section 1: Phone Normalization Function (Server-Authoritative)
-- Implements canonical E.164 normalization matching client utility,
-- supporting local Nigerian 11-digit (080...), 10-digit (80...), 13-digit (23480...),
-- and international formats (+...).
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_phone(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_cleaned text;
BEGIN
  IF p_raw IS NULL OR TRIM(p_raw) = '' THEN
    RETURN NULL;
  END IF;

  -- Strip all whitespace, hyphens, parentheses, dots
  v_cleaned := REGEXP_REPLACE(TRIM(p_raw), '[\s\-\(\)\.]+', '', 'g');

  IF v_cleaned = '' THEN
    RETURN NULL;
  END IF;

  -- Ensure only digits and optional leading plus
  IF NOT (v_cleaned ~ '^\+?[0-9]+$') THEN
    RETURN NULL;
  END IF;

  -- Case 1: Leading plus
  IF v_cleaned LIKE '+%' THEN
    IF LENGTH(SUBSTRING(v_cleaned FROM 2)) BETWEEN 8 AND 15 THEN
      RETURN v_cleaned;
    ELSE
      RETURN NULL;
    END IF;
  END IF;

  -- Case 2: Nigerian 13-digit starting with 234
  IF v_cleaned LIKE '234%' AND LENGTH(v_cleaned) = 13 THEN
    RETURN '+' || v_cleaned;
  END IF;

  -- Case 3: Nigerian 11-digit starting with 0 (e.g. 08031234567)
  IF v_cleaned LIKE '0%' AND LENGTH(v_cleaned) = 11 THEN
    RETURN '+234' || SUBSTRING(v_cleaned FROM 2);
  END IF;

  -- Case 4: Nigerian 10-digit without leading 0 (e.g. 8031234567)
  IF LENGTH(v_cleaned) = 10 AND SUBSTRING(v_cleaned FROM 1 FOR 1) IN ('7', '8', '9') THEN
    RETURN '+234' || v_cleaned;
  END IF;

  -- Case 5: International digits without plus (10 to 15 digits)
  IF LENGTH(v_cleaned) BETWEEN 10 AND 15 THEN
    RETURN '+' || v_cleaned;
  END IF;

  RETURN NULL;
END;
$$;

-- Revoke default PUBLIC permissions on normalization utility
REVOKE EXECUTE ON FUNCTION public.normalize_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, anon;

-- ============================================================
-- Section 2: Canonical Profiles Phone Index
-- Non-unique partial index: Supports fast lookups while allowing
-- family/shared numbers and existing users without phone to register.
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
  ON public.profiles(phone) 
  WHERE phone IS NOT NULL;

-- ============================================================
-- Section 3: Application Tables Schema Adjustments
-- Relaxes historical NOT NULL constraints on subsequent onboarding details.
-- Registration only records verified intent; unknown details remain NULL.
-- ============================================================
ALTER TABLE public.rider_applications 
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN vehicle_type DROP NOT NULL,
  ALTER COLUMN vehicle_make DROP NOT NULL,
  ALTER COLUMN vehicle_model DROP NOT NULL,
  ALTER COLUMN vehicle_year DROP NOT NULL;

ALTER TABLE public.vendor_applications 
  ALTER COLUMN business_name DROP NOT NULL,
  ALTER COLUMN business_type DROP NOT NULL,
  ALTER COLUMN business_address DROP NOT NULL;

-- Ensure partial unique indexes exist to prevent duplicate pending applications
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_applications_pending_per_profile
  ON public.vendor_applications (profile_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_applications_pending_per_profile
  ON public.rider_applications (profile_id)
  WHERE status = 'pending';

-- ============================================================
-- Section 4: Hardened handle_new_user() Trigger Function
-- 1. Sets minimal fixed search_path = public
-- 2. Strictly sets role = 'customer'::user_role (NO privileged escalation possible)
-- 3. Normalizes and stores canonical phone
-- 4. Creates pending application with clean NULLs for unknown fields (NO fake data)
-- 5. Revoked from PUBLIC, anon, and authenticated
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_raw_phone text;
  v_phone text;
  v_account_type text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_raw_phone := NEW.raw_user_meta_data->>'phone';
  v_phone := public.normalize_phone(v_raw_phone);
  v_account_type := LOWER(TRIM(COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer')));

  -- 1. Always create base profile with customer role
  INSERT INTO public.profiles (id, email, full_name, phone, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_phone,
    'customer'::public.user_role,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

  -- 2. If onboarding intent was rider, create pending application with clean NULLs
  IF v_account_type = 'rider' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.rider_applications
      WHERE profile_id = NEW.id AND status = 'pending'
    ) THEN
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
        status
      )
      VALUES (
        NEW.id,
        v_full_name,
        COALESCE(v_phone, ''),
        NEW.email,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'pending'::public.application_status
      );
    END IF;
  ELSIF v_account_type = 'vendor' THEN
    -- 3. If onboarding intent was vendor, create pending application with clean NULLs
    IF NOT EXISTS (
      SELECT 1 FROM public.vendor_applications
      WHERE profile_id = NEW.id AND status = 'pending'
    ) THEN
      INSERT INTO public.vendor_applications (
        profile_id,
        business_name,
        business_type,
        business_address,
        phone,
        email,
        status
      )
      VALUES (
        NEW.id,
        NULL,
        NULL,
        NULL,
        COALESCE(v_phone, ''),
        NEW.email,
        'pending'::public.application_status
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger binding
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger security hardening: Revoke direct execution privileges
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- ============================================================
-- Section 5: Secure submit_onboarding_intent() RPC
-- Allows authenticated users to register or update onboarding intent.
-- Enforces:
-- 1. Resolves identity only via auth.uid()
-- 2. Rejects any account type other than customer, rider, vendor
-- 3. Never mutates profiles.role (role escalation or downgrade impossible)
-- 4. Prevents duplicate pending applications
-- 5. Normalizes phone consistently before persistence
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_onboarding_intent(
  p_account_type text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_role public.user_role;
  v_is_active boolean;
  v_email text;
  v_full_name text;
  v_existing_phone text;
  v_norm_phone text;
  v_type text;
  v_existing_app_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_type := LOWER(TRIM(COALESCE(p_account_type, '')));
  IF v_type NOT IN ('customer', 'rider', 'vendor') THEN
    RAISE EXCEPTION 'Invalid account type: %. Allowed types: customer, rider, vendor', p_account_type;
  END IF;

  -- Load calling user's profile
  SELECT role, is_active, email, full_name, phone
  INTO v_current_role, v_is_active, v_email, v_full_name, v_existing_phone
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  -- Block admin accounts from misusing onboarding RPC
  IF v_current_role IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Admin accounts cannot submit onboarding applications';
  END IF;

  -- Normalize phone if provided
  IF p_phone IS NOT NULL AND TRIM(p_phone) <> '' THEN
    v_norm_phone := public.normalize_phone(p_phone);
    IF v_norm_phone IS NULL THEN
      RAISE EXCEPTION 'Invalid phone number format';
    END IF;

    UPDATE public.profiles
    SET phone = v_norm_phone,
        updated_at = now()
    WHERE id = v_user_id;
  ELSE
    v_norm_phone := v_existing_phone;
  END IF;

  -- Case A: Rider Intent
  IF v_type = 'rider' THEN
    IF v_current_role = 'rider' THEN
      RETURN jsonb_build_object(
        'success', true,
        'account_type', 'rider',
        'status', 'approved',
        'message', 'User is already an approved rider'
      );
    END IF;

    SELECT id INTO v_existing_app_id
    FROM public.rider_applications
    WHERE profile_id = v_user_id AND status = 'pending';

    IF v_existing_app_id IS NOT NULL THEN
      IF v_norm_phone IS NOT NULL THEN
        UPDATE public.rider_applications
        SET phone = v_norm_phone
        WHERE id = v_existing_app_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'account_type', 'rider',
        'status', 'pending',
        'message', 'Rider application already pending review'
      );
    END IF;

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
      status
    )
    VALUES (
      v_user_id,
      v_full_name,
      COALESCE(v_norm_phone, ''),
      v_email,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      'pending'::public.application_status
    );

    RETURN jsonb_build_object(
      'success', true,
      'account_type', 'rider',
      'status', 'pending',
      'message', 'Rider application submitted successfully'
    );

  -- Case B: Vendor Intent
  ELSIF v_type = 'vendor' THEN
    IF v_current_role = 'vendor' THEN
      RETURN jsonb_build_object(
        'success', true,
        'account_type', 'vendor',
        'status', 'approved',
        'message', 'User is already an approved vendor'
      );
    END IF;

    SELECT id INTO v_existing_app_id
    FROM public.vendor_applications
    WHERE profile_id = v_user_id AND status = 'pending';

    IF v_existing_app_id IS NOT NULL THEN
      IF v_norm_phone IS NOT NULL THEN
        UPDATE public.vendor_applications
        SET phone = v_norm_phone
        WHERE id = v_existing_app_id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'account_type', 'vendor',
        'status', 'pending',
        'message', 'Vendor application already pending review'
      );
    END IF;

    INSERT INTO public.vendor_applications (
      profile_id,
      business_name,
      business_type,
      business_address,
      phone,
      email,
      status
    )
    VALUES (
      v_user_id,
      NULL,
      NULL,
      NULL,
      COALESCE(v_norm_phone, ''),
      v_email,
      'pending'::public.application_status
    );

    RETURN jsonb_build_object(
      'success', true,
      'account_type', 'vendor',
      'status', 'pending',
      'message', 'Vendor application submitted successfully'
    );

  -- Case C: Customer Intent
  ELSE
    RETURN jsonb_build_object(
      'success', true,
      'account_type', 'customer',
      'status', 'active',
      'message', 'Customer account ready'
    );
  END IF;
END;
$$;

-- Restrict RPC execution to authenticated users only
REVOKE EXECUTE ON FUNCTION public.submit_onboarding_intent(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_onboarding_intent(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_intent(text, text) TO authenticated;
