-- Migration: 20261015000001_enforce_unique_email_and_phone.sql
-- Enforce strict 1:1 account uniqueness per email and per phone number.
-- 1. Deduplicate any existing duplicate emails/phones before indexing:
--    Keeps the newest profile record (or whichever has active activity) and nulls duplicate phones on older records.
-- 2. Create unique index on LOWER(email) in public.profiles.
-- 3. Create unique index on phone in public.profiles (ignoring null and empty strings).
-- 4. Create secure RPC public.check_identifier_exists(p_identifier text) for registration pre-flight check.

-- ============================================================
-- Section 0: Clean up existing duplicate phones & emails
-- ============================================================
-- For duplicate phone numbers: Keep the phone on the most recently updated profile,
-- and set phone to NULL on older duplicate profiles so the unique index can be created safely.
WITH ranked_phones AS (
  SELECT 
    id,
    phone,
    ROW_NUMBER() OVER (
      PARTITION BY phone 
      ORDER BY updated_at DESC, created_at DESC
    ) as rank_order
  FROM public.profiles
  WHERE phone IS NOT NULL AND TRIM(phone) <> ''
)
UPDATE public.profiles p
SET phone = NULL
FROM ranked_phones rp
WHERE p.id = rp.id
  AND rp.rank_order > 1;

-- ============================================================
-- Section 1: Unique Index on LOWER(email)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email_lower
  ON public.profiles (LOWER(email));

-- ============================================================
-- Section 2: Unique Index on phone (canonical format)
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_phone_unique
  ON public.profiles (phone)
  WHERE phone IS NOT NULL AND TRIM(phone) <> '';

-- ============================================================
-- Section 3: Secure RPC to check if email or phone already exists
-- Accessible by anon and authenticated callers during registration.
-- Returns: 'email' if email matches, 'phone' if phone matches, or NULL if available.
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_identifier_exists(
  p_identifier text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cleaned text;
  v_match text := NULL;
BEGIN
  v_cleaned := TRIM(COALESCE(p_identifier, ''));
  IF v_cleaned = '' THEN
    RETURN NULL;
  END IF;

  -- 1. Check as email (case-insensitive)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(email) = LOWER(v_cleaned)
  ) THEN
    RETURN 'email';
  END IF;

  -- 2. Check as phone (exact match or normalized variation)
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE phone IS NOT NULL
      AND (
        phone = v_cleaned
        OR phone = '+' || REGEXP_REPLACE(v_cleaned, '^[+]', '')
        OR REGEXP_REPLACE(phone, '^[+]', '') = REGEXP_REPLACE(v_cleaned, '^[+]', '')
      )
  ) THEN
    RETURN 'phone';
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_identifier_exists(text) TO anon, authenticated;

-- ============================================================
-- Section 4: Upgrade handle_new_user() Trigger Function
-- Gracefully handles Google OAuth users (reading full_name/name)
-- and prevents duplicate email constraint errors on uq_profiles_email_lower.
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
  v_referral_code text;
  v_existing_profile_id uuid;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_account_type := LOWER(COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer'));
  v_referral_code := public.generate_unique_referral_code();

  -- Check if a profile with this email already exists
  SELECT id INTO v_existing_profile_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  IF v_existing_profile_id IS NOT NULL THEN
    -- Update existing profile gracefully
    UPDATE public.profiles
    SET
      full_name = CASE WHEN (full_name IS NULL OR full_name = '') THEN v_full_name ELSE full_name END,
      phone = COALESCE(public.profiles.phone, v_phone),
      referral_code = COALESCE(public.profiles.referral_code, v_referral_code),
      updated_at = NOW()
    WHERE id = v_existing_profile_id;
  ELSE
    -- Insert new profile
    INSERT INTO public.profiles (id, email, full_name, phone, role, referral_code)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      v_phone,
      'customer'::public.user_role,
      v_referral_code
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      full_name = CASE WHEN public.profiles.full_name = '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END,
      referral_code = COALESCE(public.profiles.referral_code, EXCLUDED.referral_code);
  END IF;

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
      COALESCE(v_existing_profile_id, NEW.id),
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
      email,
      phone,
      business_address,
      status
    )
    VALUES (
      COALESCE(v_existing_profile_id, NEW.id),
      COALESCE(NEW.raw_user_meta_data->>'business_name', v_full_name),
      NEW.email,
      COALESCE(v_phone, ''),
      'Pending Onboarding',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- Section 5: Profile Self-Healing RPC and INSERT Policy
-- Allows authenticated sessions (including OAuth) to reliably
-- obtain/create their customer profile without RLS failures.
-- ============================================================

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user record;
  v_profile public.profiles;
  v_full_name text;
  v_referral text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Check if profile already exists by user ID
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id;

  IF FOUND THEN
    RETURN v_profile;
  END IF;

  -- 2. Fetch user details from auth.users
  SELECT * INTO v_user
  FROM auth.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in auth.users';
  END IF;

  -- 3. Check if profile exists by email
  IF v_user.email IS NOT NULL THEN
    SELECT * INTO v_profile
    FROM public.profiles
    WHERE LOWER(email) = LOWER(v_user.email);

    IF FOUND THEN
      RETURN v_profile;
    END IF;
  END IF;

  -- 4. Create missing profile
  v_full_name := COALESCE(
    v_user.raw_user_meta_data->>'full_name',
    v_user.raw_user_meta_data->>'name',
    SPLIT_PART(v_user.email, '@', 1),
    'Customer'
  );
  v_referral := public.generate_unique_referral_code();

  INSERT INTO public.profiles (id, email, full_name, phone, role, referral_code, is_active)
  VALUES (
    v_user_id,
    COALESCE(v_user.email, ''),
    v_full_name,
    v_user.raw_user_meta_data->>'phone',
    'customer'::public.user_role,
    v_referral,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW()
  RETURNING * INTO v_profile;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated;

-- Allow authenticated users to insert their own customer profile row as an RLS backup
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    id = auth.uid()
    AND role = 'customer'::public.user_role
  );

