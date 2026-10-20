-- ============================================================================
-- Migration: 20261019000001_authoritative_kingdomdash_avatar_system.sql
-- Description: Server-authoritative KingdomDash avatar system.
--              1. Computes default 3D Doll / Anime avatar for every new user on signup.
--              2. Backfills existing profiles with authoritative avatar_url.
--              3. Exposes equip_avatar(p_avatar_url) RPC with validation.
-- ============================================================================

-- Section 1: Helper function to deterministically assign avatar from official roster
CREATE OR REPLACE FUNCTION public.get_default_kingdomdash_avatar(
  p_user_id uuid,
  p_role text DEFAULT 'customer'
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_hash int;
  v_roster text[];
BEGIN
  -- Role-specific biasing
  IF LOWER(COALESCE(p_role, 'customer')) = 'rider' THEN
    v_roster := ARRAY[
      '/avatars/characters/anime-swift-rider.svg',
      '/avatars/characters/doll-mecha-courier.svg',
      '/avatars/characters/anime-cyber-ninja.svg'
    ];
  ELSIF LOWER(COALESCE(p_role, 'customer')) = 'vendor' THEN
    v_roster := ARRAY[
      '/avatars/characters/anime-master-chef.svg',
      '/avatars/characters/anime-sunshine-baker.svg'
    ];
  ELSE
    -- General / Customer / Admin roster
    v_roster := ARRAY[
      '/avatars/characters/royal-doll-prince.jpg',
      '/avatars/characters/royal-doll-princess.jpg',
      '/avatars/characters/anime-royal-queen.svg',
      '/avatars/characters/anime-student-foodie.svg',
      '/avatars/characters/doll-chibi-knight.svg',
      '/avatars/characters/anime-golden-monarch.svg',
      '/avatars/characters/doll-blossom-princess.svg'
    ];
  END IF;

  -- Deterministic modulo from UUID hash
  v_hash := ABS(('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::int);
  RETURN v_roster[1 + (v_hash % array_length(v_roster, 1))];
END;
$$;

-- Section 2: Secure Server-Side RPC to Equip Character Avatar
CREATE OR REPLACE FUNCTION public.equip_avatar(p_avatar_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid uuid;
  v_clean_url text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to equip an avatar';
  END IF;

  v_clean_url := TRIM(p_avatar_url);
  IF v_clean_url IS NULL OR length(v_clean_url) = 0 THEN
    RAISE EXCEPTION 'Invalid avatar URL';
  END IF;

  -- Ensure avatar URL belongs to official KingdomDash character roster or safe scheme
  IF NOT (
    v_clean_url LIKE '/avatars/characters/%'
    OR v_clean_url LIKE 'https://%'
  ) THEN
    RAISE EXCEPTION 'Disallowed avatar asset URL';
  END IF;

  UPDATE public.profiles
  SET
    avatar_url = v_clean_url,
    updated_at = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'avatar_url', v_clean_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.equip_avatar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_avatar(text) TO authenticated;

-- Section 3: Upgrade handle_new_user() Trigger Function to Automatically Assign Avatar
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
  v_avatar_url text;
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
  v_avatar_url := COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    public.get_default_kingdomdash_avatar(NEW.id, v_account_type)
  );

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
      avatar_url = COALESCE(public.profiles.avatar_url, v_avatar_url),
      referral_code = COALESCE(public.profiles.referral_code, v_referral_code),
      updated_at = NOW()
    WHERE id = v_existing_profile_id;
  ELSE
    -- Insert new profile
    INSERT INTO public.profiles (id, email, full_name, phone, avatar_url, role, referral_code)
    VALUES (
      NEW.id,
      NEW.email,
      v_full_name,
      v_phone,
      v_avatar_url,
      'customer'::public.user_role,
      v_referral_code
    )
    ON CONFLICT (id) DO UPDATE SET
      phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
      avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
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
      NEW.id,
      COALESCE(NULLIF(v_full_name, ''), 'Rider Applicant'),
      COALESCE(v_phone, ''),
      NEW.email,
      'Pending Onboarding Address',
      'motorcycle'::public.vehicle_type,
      'Standard',
      'Dispatch Bike',
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
      business_description,
      business_address,
      phone,
      email,
      status
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(v_full_name, ''), 'Vendor Business'),
      'restaurant'::public.business_type,
      'Registration onboarding submission awaiting verification.',
      'Pending Onboarding Address',
      COALESCE(v_phone, ''),
      NEW.email,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Section 4: Authoritative Backfill for Any Existing Users without Avatar
UPDATE public.profiles
SET avatar_url = public.get_default_kingdomdash_avatar(id, role::text)
WHERE avatar_url IS NULL OR TRIM(avatar_url) = '';
