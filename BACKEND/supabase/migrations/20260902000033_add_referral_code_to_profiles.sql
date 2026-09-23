-- Migration: 20260902000033_add_referral_code_to_profiles.sql
-- 1. Add referral_code column to profiles and establish unique constraint
-- 2. Create generate_unique_referral_code() function
-- 3. Backfill referral_code for existing profiles
-- 4. Create index on referral_code
-- 5. Create secure validate_referral_code(p_code text) RPC for public/anon registration checks
-- 6. Update handle_new_user() trigger to automatically assign referral_code on signup

-- ============================================================
-- Section 1: Add referral_code Column
-- ============================================================
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

-- ============================================================
-- Section 2: Helper Function to Generate Unique KD-XXXX Code
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    v_code := 'KD-' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 4));
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================================
-- Section 3: Backfill Existing Profiles
-- ============================================================
UPDATE public.profiles
SET referral_code = public.generate_unique_referral_code()
WHERE referral_code IS NULL;

-- ============================================================
-- Section 4: Performance Index for Referral Lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code 
  ON public.profiles(referral_code)
  WHERE referral_code IS NOT NULL;

-- ============================================================
-- Section 5: Secure validate_referral_code RPC (SECURITY DEFINER)
-- Allows unauthenticated guests on registration to validate referral
-- codes without granting general read access to public.profiles.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE UPPER(referral_code) = UPPER(TRIM(p_code))
      AND is_active = true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;

-- ============================================================
-- Section 6: Update handle_new_user() Trigger Function
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
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_account_type := LOWER(COALESCE(NEW.raw_user_meta_data->>'account_type', 'customer'));
  v_referral_code := public.generate_unique_referral_code();

  -- 1. Always create or update profile with customer role & unique referral code
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
