-- Migration: 20260902000022_registration_onboarding.sql
-- Registration Flow Enhancement:
-- 1. Canonical profiles.phone index and application table schema relaxation
-- 2. Server-authoritative handle_new_user() supporting phone and intent-based application creation
-- 3. Secure submit_onboarding_intent() RPC for authenticated users
-- 4. Multi-layer RBAC security: Client intent NEVER grants privileged roles

-- ============================================================
-- Section 1: Canonical Profiles Phone Index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_phone 
  ON public.profiles(phone) 
  WHERE phone IS NOT NULL;

-- ============================================================
-- Section 2: Application Tables Schema Adjustments
-- Allows initial registration intent to create pending applications
-- without violating historical non-null constraints on subsequent onboarding details.
-- ============================================================
ALTER TABLE public.rider_applications 
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN vehicle_make DROP NOT NULL,
  ALTER COLUMN vehicle_model DROP NOT NULL,
  ALTER COLUMN vehicle_year DROP NOT NULL,
  ALTER COLUMN vehicle_type SET DEFAULT 'petrol'::public.vehicle_type;

ALTER TABLE public.vendor_applications 
  ALTER COLUMN business_name DROP NOT NULL,
  ALTER COLUMN business_address DROP NOT NULL,
  ALTER COLUMN business_type SET DEFAULT 'restaurant'::public.business_type;

-- Ensure idempotent partial unique constraints exist for pending applications
CREATE UNIQUE INDEX IF NOT EXISTS uq_vendor_applications_pending_per_profile
  ON public.vendor_applications (profile_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_rider_applications_pending_per_profile
  ON public.rider_applications (profile_id)
  WHERE status = 'pending';

-- ============================================================
-- Section 3: Server-Authoritative handle_new_user() Trigger
-- Hardcodes role = 'customer'. If account_type is 'rider' or 'vendor',
-- creates a pending application record. Privileged roles CANNOT be self-assigned.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_full_name text;
  v_phone text;
  v_account_type text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_account_type := LOWER(COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer'));

  -- 1. Always create or update profile with customer role
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    v_full_name,
    v_phone,
    'customer'::public.user_role
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;

  -- 2. If user intent was 'rider', create pending application
  IF v_account_type = 'rider' THEN
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
      'Pending Onboarding',
      'petrol',
      'Pending Onboarding',
      'Pending Onboarding',
      EXTRACT(YEAR FROM CURRENT_DATE)::integer,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3. If user intent was 'vendor', create pending application
  IF v_account_type = 'vendor' THEN
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
      CASE WHEN v_full_name <> '' THEN v_full_name || '''s Store' ELSE 'New Vendor' END,
      'restaurant',
      'Pending Onboarding',
      COALESCE(v_phone, ''),
      NEW.email,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Section 4: Secure submit_onboarding_intent() RPC
-- Allows authenticated users to safely register or update their application
-- intent without any role escalation ability.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_onboarding_intent(
  p_account_type text,
  p_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_type text;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_type := LOWER(TRIM(p_account_type));
  IF v_type NOT IN ('customer', 'rider', 'vendor') THEN
    RAISE EXCEPTION 'Invalid account type. Allowed types: customer, rider, vendor';
  END IF;

  -- Read current user profile
  SELECT email, full_name INTO v_email, v_full_name
  FROM public.profiles
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;

  -- Update profile phone if provided
  IF p_phone IS NOT NULL AND TRIM(p_phone) <> '' THEN
    UPDATE public.profiles
    SET phone = TRIM(p_phone),
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  IF v_type = 'rider' THEN
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
      COALESCE(p_phone, ''),
      v_email,
      'Pending Onboarding',
      'petrol',
      'Pending Onboarding',
      'Pending Onboarding',
      EXTRACT(YEAR FROM CURRENT_DATE)::integer,
      'pending'
    )
    ON CONFLICT (profile_id) WHERE status = 'pending' DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.rider_applications.phone);

    v_result := jsonb_build_object(
      'success', true,
      'account_type', 'rider',
      'status', 'pending',
      'message', 'Rider application submitted successfully'
    );

  ELSIF v_type = 'vendor' THEN
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
      CASE WHEN v_full_name <> '' THEN v_full_name || '''s Store' ELSE 'New Vendor' END,
      'restaurant',
      'Pending Onboarding',
      COALESCE(p_phone, ''),
      v_email,
      'pending'
    )
    ON CONFLICT (profile_id) WHERE status = 'pending' DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, public.vendor_applications.phone);

    v_result := jsonb_build_object(
      'success', true,
      'account_type', 'vendor',
      'status', 'pending',
      'message', 'Vendor application submitted successfully'
    );

  ELSE
    -- Ordinary customer
    v_result := jsonb_build_object(
      'success', true,
      'account_type', 'customer',
      'status', 'active',
      'message', 'Customer account ready'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Secure privileges
REVOKE EXECUTE ON FUNCTION public.submit_onboarding_intent(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_intent(text, text) TO authenticated;
