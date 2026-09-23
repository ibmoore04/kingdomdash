-- ============================================================
-- Migration: 20260902000023_rider_vendor_lifecycle_reconciliation.sql
-- Description:
--   1. Ensures updated_at columns on application tables if missing.
--   2. Ensures unique constraints on operational tables (riders, vendors).
--   3. Migration-time autonomous reconciliation:
--        - If role = 'rider' in profiles -> automatically ensures row in riders table.
--        - If role = 'vendor' in profiles -> automatically ensures row in vendors table.
--   4. Automatic synchronization trigger on public.profiles:
--        - Whenever profiles.role becomes 'rider', row in public.riders is created.
--        - Whenever profiles.role becomes 'vendor', row in public.vendors is created.
--   5. Authoritative transactional approval/rejection RPCs with audit logging.
--   6. Protection against destructive operational deletions (enforces is_active deactivation).
--   7. Runtime diagnostic audit and safe reconciliation functions.
-- ============================================================

-- ============================================================
-- SECTION 1: Schema Adjustments & Unique Constraints
-- ============================================================

-- Add updated_at to application tables if not existing
ALTER TABLE public.rider_applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.vendor_applications ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add coordinate columns on public.deliveries if not existing
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS pickup_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS pickup_longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS delivery_latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS delivery_longitude numeric(10,7);

DO $$
BEGIN
  -- Verify or add UNIQUE(profile_id) constraint on public.riders
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.riders'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.riders'::regclass AND attname = 'profile_id')]
  ) THEN
    ALTER TABLE public.riders ADD CONSTRAINT uq_riders_profile_id UNIQUE (profile_id);
  END IF;

  -- Verify or add UNIQUE(profile_id) constraint on public.vendors
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.vendors'::regclass
      AND contype = 'u'
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.vendors'::regclass AND attname = 'profile_id')]
  ) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT uq_vendors_profile_id UNIQUE (profile_id);
  END IF;
END;
$$;

-- ============================================================
-- SECTION 2: Migration-Time Autonomous Reconciliation
-- (Guarantees every profile with role=rider has a riders row,
--  and every profile with role=vendor has a vendors row)
-- ============================================================

DO $$
DECLARE
  v_rider_broken_count      integer := 0;
  v_vendor_broken_count     integer := 0;
  v_orphan_riders_count     integer := 0;
  v_orphan_vendors_count    integer := 0;
  v_duplicate_riders_count  integer := 0;
  v_duplicate_vendors_count integer := 0;
  v_reconciled_riders       integer := 0;
  v_reconciled_vendors      integer := 0;

  r_rec                     record;
  v_vapp                    record;
BEGIN
  -- ── 1. Baseline Inconsistency Diagnostics ──────────────────
  SELECT count(*) INTO v_rider_broken_count
  FROM public.profiles p
  LEFT JOIN public.riders r ON r.profile_id = p.id
  WHERE p.role = 'rider' AND r.profile_id IS NULL;

  SELECT count(*) INTO v_vendor_broken_count
  FROM public.profiles p
  LEFT JOIN public.vendors v ON v.profile_id = p.id
  WHERE p.role = 'vendor' AND v.profile_id IS NULL;

  SELECT count(*) INTO v_orphan_riders_count
  FROM public.riders r
  LEFT JOIN public.profiles p ON p.id = r.profile_id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_orphan_vendors_count
  FROM public.vendors v
  LEFT JOIN public.profiles p ON p.id = v.profile_id
  WHERE p.id IS NULL;

  SELECT count(*) INTO v_duplicate_riders_count
  FROM (
    SELECT profile_id FROM public.riders GROUP BY profile_id HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_duplicate_vendors_count
  FROM (
    SELECT profile_id FROM public.vendors GROUP BY profile_id HAVING count(*) > 1
  ) d;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'KINGDOMDASH RIDER/VENDOR LIFECYCLE AUDIT (BASELINE)';
  RAISE NOTICE 'Profiles with role=rider missing riders: %', v_rider_broken_count;
  RAISE NOTICE 'Profiles with role=vendor missing vendors: %', v_vendor_broken_count;
  RAISE NOTICE 'Riders missing profiles (orphans): %', v_orphan_riders_count;
  RAISE NOTICE 'Vendors missing profiles (orphans): %', v_orphan_vendors_count;
  RAISE NOTICE 'Duplicate riders: %', v_duplicate_riders_count;
  RAISE NOTICE 'Duplicate vendors: %', v_duplicate_vendors_count;
  RAISE NOTICE '============================================================';

  -- ── 2. Guarantee: Every role=rider profile has a riders operational row ──
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
      false, -- Default offline
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

    -- Mark any pending rider application for this profile as approved
    UPDATE public.rider_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = r_rec.id AND status = 'pending';

    v_reconciled_riders := v_reconciled_riders + 1;
  END LOOP;

  -- ── 3. Guarantee: Every role=vendor profile has a vendors operational row ──
  FOR r_rec IN
    SELECT p.id, p.email, p.full_name, p.phone, p.is_active
    FROM public.profiles p
    LEFT JOIN public.vendors v ON v.profile_id = p.id
    WHERE p.role = 'vendor' AND v.profile_id IS NULL
  LOOP
    -- Look up application details using submitted_at (NOT created_at)
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
      COALESCE(v_vapp.business_address, 'Market Center, Owerri'),
      COALESCE(v_vapp.phone, r_rec.phone, ''),
      COALESCE(v_vapp.email, r_rec.email, ''),
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      updated_at = now();

    -- Mark any pending vendor application for this profile as approved
    UPDATE public.vendor_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = r_rec.id AND status = 'pending';

    v_reconciled_vendors := v_reconciled_vendors + 1;
  END LOOP;

  RAISE NOTICE 'RECONCILIATION SUMMARY:';
  RAISE NOTICE 'Riders operational records created: %', v_reconciled_riders;
  RAISE NOTICE 'Vendors operational records created: %', v_reconciled_vendors;

  -- ── 4. Post-Reconciliation Verification ───────────────────
  SELECT count(*) INTO v_rider_broken_count
  FROM public.profiles p
  LEFT JOIN public.riders r ON r.profile_id = p.id
  WHERE p.role = 'rider' AND r.profile_id IS NULL;

  SELECT count(*) INTO v_vendor_broken_count
  FROM public.profiles p
  LEFT JOIN public.vendors v ON v.profile_id = p.id
  WHERE p.role = 'vendor' AND v.profile_id IS NULL;

  RAISE NOTICE 'POST-RECONCILIATION STATUS:';
  RAISE NOTICE 'Profiles with role=rider missing riders: % (Expected: 0)', v_rider_broken_count;
  RAISE NOTICE 'Profiles with role=vendor missing vendors: % (Expected: 0)', v_vendor_broken_count;
  RAISE NOTICE '============================================================';
END;
$$;

-- ============================================================
-- SECTION 3: Profile Role -> Operational Sync Trigger
-- (Whenever profiles.role is set to 'rider' or 'vendor',
--  the operational row is automatically created/ensured)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_fn_sync_profile_role_to_operational()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vapp record;
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
      false, -- Offline by default
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

    -- Also mark any pending application as approved
    UPDATE public.rider_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';

  -- 2. Profile is Vendor -> Ensure row exists in public.vendors
  ELSIF NEW.role = 'vendor' THEN
    -- Look up application details using submitted_at (never created_at)
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
      COALESCE(v_vapp.business_address, 'Market Center, Owerri'),
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
      updated_at = now();

    -- Also mark any pending application as approved
    UPDATE public.vendor_applications
    SET status = 'approved',
        reviewed_at = COALESCE(reviewed_at, now())
    WHERE profile_id = NEW.id AND status = 'pending';

  -- 3. Profile was demoted/changed to customer -> Deactivate operational rows (no hard delete)
  ELSIF NEW.role = 'customer' AND TG_OP = 'UPDATE' THEN
    IF OLD.role = 'rider' THEN
      UPDATE public.riders
      SET is_active = false,
          is_available = false,
          updated_at = now()
      WHERE profile_id = NEW.id;
    ELSIF OLD.role = 'vendor' THEN
      UPDATE public.vendors
      SET is_active = false,
          updated_at = now()
      WHERE profile_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_operational ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_to_operational
  AFTER INSERT OR UPDATE
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sync_profile_role_to_operational();

-- ============================================================
-- SECTION 4: Authoritative Transactional Approval & Rejection RPCs
-- ============================================================

-- 4.1 Approve Rider Application
CREATE OR REPLACE FUNCTION public.approve_rider_application(
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
  v_rider_id    uuid;
BEGIN
  -- 1. Authorization: Only admin and super_admin can approve applications
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can approve rider applications'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Lock and retrieve application
  SELECT * INTO v_app
  FROM public.rider_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider application % not found', p_application_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_app.status = 'approved' THEN
    SELECT id INTO v_rider_id FROM public.riders WHERE profile_id = v_app.profile_id;
    RETURN jsonb_build_object(
      'success', true,
      'application_id', p_application_id,
      'rider_id', v_rider_id,
      'profile_id', v_app.profile_id,
      'status', 'already_approved'
    );
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot approve rider application in % status', v_app.status
      USING ERRCODE = 'KD409';
  END IF;

  -- 3. Lock and retrieve profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_app.profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile for applicant % not found', v_app.profile_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_profile.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Cannot approve rider application: profile is inactive'
      USING ERRCODE = 'KD409';
  END IF;

  -- 4. ATOMIC CREATION: Insert or update operational rider record
  INSERT INTO public.riders (
    profile_id,
    is_available,
    total_deliveries,
    is_active,
    is_verified,
    created_at,
    updated_at
  ) VALUES (
    v_app.profile_id,
    false, -- Default offline
    0,
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE SET
    is_active = true,
    is_verified = true,
    updated_at = now()
  RETURNING id INTO v_rider_id;

  -- 5. Mark application approved
  UPDATE public.rider_applications
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  -- 6. ATOMIC PROMOTION: Promote profile role to 'rider'
  UPDATE public.profiles
  SET role = 'rider'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id;

  -- 7. Audit Events
  PERFORM public.log_operational_audit_event(
    'rider_application_approved',
    'rider_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'rider_id', v_rider_id),
    'Approved by administrator'
  );

  PERFORM public.log_operational_audit_event(
    'rider_role_promoted',
    'profile',
    v_app.profile_id,
    jsonb_build_object('role', v_profile.role),
    jsonb_build_object('role', 'rider', 'rider_id', v_rider_id),
    'Role promoted following rider application approval'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'rider_id', v_rider_id,
    'profile_id', v_app.profile_id,
    'role', 'rider'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_rider_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_rider_application(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_rider_application(uuid) TO authenticated, service_role;

-- 4.2 Reject Rider Application
CREATE OR REPLACE FUNCTION public.reject_rider_application(
  p_application_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_app         record;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can reject rider applications'
      USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_app
  FROM public.rider_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rider application % not found', p_application_id
      USING ERRCODE = 'KD404';
  END IF;

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot reject rider application in % status', v_app.status
      USING ERRCODE = 'KD409';
  END IF;

  UPDATE public.rider_applications
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  -- Ensure profile role remains / reverts to customer
  UPDATE public.profiles
  SET role = 'customer'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id
    AND role = 'rider';

  PERFORM public.log_operational_audit_event(
    'rider_application_rejected',
    'rider_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected', 'reason', p_reason),
    'Rejected by administrator'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'profile_id', v_app.profile_id,
    'status', 'rejected'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_rider_application(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_rider_application(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reject_rider_application(uuid, text) TO authenticated, service_role;

-- 4.3 Approve Vendor Application
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
BEGIN
  -- 1. Authorization Check
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can approve vendor applications'
      USING ERRCODE = 'KD403';
  END IF;

  -- 2. Lock and retrieve application
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

  -- 3. Lock and retrieve profile
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

  -- 4. ATOMIC CREATION: Insert or update operational vendor record
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
    COALESCE(v_app.business_address, 'Market Center, Owerri'),
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

  -- 5. Mark application approved
  UPDATE public.vendor_applications
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  -- 6. ATOMIC PROMOTION: Promote profile role to 'vendor'
  UPDATE public.profiles
  SET role = 'vendor'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id;

  -- 7. Audit Events
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

-- 4.4 Reject Vendor Application
CREATE OR REPLACE FUNCTION public.reject_vendor_application(
  p_application_id uuid,
  p_reason         text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role text;
  v_app         record;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: only administrators can reject vendor applications'
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

  IF v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'Cannot reject vendor application in % status', v_app.status
      USING ERRCODE = 'KD409';
  END IF;

  UPDATE public.vendor_applications
  SET status = 'rejected',
      rejection_reason = p_reason,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  UPDATE public.profiles
  SET role = 'customer'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id
    AND role = 'vendor';

  PERFORM public.log_operational_audit_event(
    'vendor_application_rejected',
    'vendor_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected', 'reason', p_reason),
    'Rejected by administrator'
  );

  RETURN jsonb_build_object(
    'success', true,
    'application_id', p_application_id,
    'profile_id', v_app.profile_id,
    'status', 'rejected'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_vendor_application(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_vendor_application(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reject_vendor_application(uuid, text) TO authenticated, service_role;

-- ============================================================
-- SECTION 5: Operational Deletion Protection
-- ============================================================

-- Prevent Destructive Hard Deletion of Operational Records
-- Enforces deactivation via is_active = false to protect historical relationships.
CREATE OR REPLACE FUNCTION public.trg_fn_prevent_operational_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Operational % records cannot be deleted. Deactivate by setting is_active = false instead to preserve historical integrity.', TG_TABLE_NAME
    USING ERRCODE = 'KD409';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_rider_deletion ON public.riders;
CREATE TRIGGER trg_prevent_rider_deletion
  BEFORE DELETE ON public.riders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_prevent_operational_deletion();

DROP TRIGGER IF EXISTS trg_prevent_vendor_deletion ON public.vendors;
CREATE TRIGGER trg_prevent_vendor_deletion
  BEFORE DELETE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_prevent_operational_deletion();

-- ============================================================
-- SECTION 6: Runtime Consistency Diagnostics & Reconcile RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.audit_rider_vendor_consistency()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role  text;
  v_rider_broken jsonb;
  v_vendor_broken jsonb;
  v_orphan_riders jsonb;
  v_orphan_vendors jsonb;
  v_dup_riders   jsonb;
  v_dup_vendors  jsonb;
BEGIN
  v_caller_role := public.get_current_user_role();
  IF v_caller_role NOT IN ('admin', 'super_admin', 'service_role') AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: administrative privileges required'
      USING ERRCODE = 'KD403';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'role', p.role
  )), '[]'::jsonb)
  INTO v_rider_broken
  FROM public.profiles p
  LEFT JOIN public.riders r ON r.profile_id = p.id
  WHERE p.role = 'rider' AND r.profile_id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_id', p.id,
    'email', p.email,
    'full_name', p.full_name,
    'role', p.role
  )), '[]'::jsonb)
  INTO v_vendor_broken
  FROM public.profiles p
  LEFT JOIN public.vendors v ON v.profile_id = p.id
  WHERE p.role = 'vendor' AND v.profile_id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'rider_id', r.id,
    'profile_id', r.profile_id
  )), '[]'::jsonb)
  INTO v_orphan_riders
  FROM public.riders r
  LEFT JOIN public.profiles p ON p.id = r.profile_id
  WHERE p.id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vendor_id', v.id,
    'profile_id', v.profile_id,
    'business_name', v.business_name
  )), '[]'::jsonb)
  INTO v_orphan_vendors
  FROM public.vendors v
  LEFT JOIN public.profiles p ON p.id = v.profile_id
  WHERE p.id IS NULL;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_id', profile_id,
    'count', count_rows
  )), '[]'::jsonb)
  INTO v_dup_riders
  FROM (
    SELECT profile_id, count(*) AS count_rows FROM public.riders GROUP BY profile_id HAVING count(*) > 1
  ) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'profile_id', profile_id,
    'count', count_rows
  )), '[]'::jsonb)
  INTO v_dup_vendors
  FROM (
    SELECT profile_id, count(*) AS count_rows FROM public.vendors GROUP BY profile_id HAVING count(*) > 1
  ) d;

  RETURN jsonb_build_object(
    'timestamp', now(),
    'profiles_role_rider_missing_riders_count', jsonb_array_length(v_rider_broken),
    'profiles_role_rider_missing_riders', v_rider_broken,
    'profiles_role_vendor_missing_vendors_count', jsonb_array_length(v_vendor_broken),
    'profiles_role_vendor_missing_vendors', v_vendor_broken,
    'riders_missing_profiles_count', jsonb_array_length(v_orphan_riders),
    'riders_missing_profiles', v_orphan_riders,
    'vendors_missing_profiles_count', jsonb_array_length(v_orphan_vendors),
    'vendors_missing_profiles', v_orphan_vendors,
    'duplicate_riders_count', jsonb_array_length(v_dup_riders),
    'duplicate_riders', v_dup_riders,
    'duplicate_vendors_count', jsonb_array_length(v_dup_vendors),
    'duplicate_vendors', v_dup_vendors
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_rider_vendor_consistency() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_rider_vendor_consistency() FROM anon;
GRANT  EXECUTE ON FUNCTION public.audit_rider_vendor_consistency() TO authenticated, service_role;

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

  -- Reconcile Riders: ensure row in riders exists
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

    -- Mark any pending rider application as approved
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

  -- Reconcile Vendors: ensure row in vendors exists
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
      COALESCE(v_vapp.business_address, 'Market Center, Owerri'),
      COALESCE(v_vapp.phone, r_rec.phone, ''),
      COALESCE(v_vapp.email, r_rec.email, ''),
      true,
      now(),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      is_active = true,
      updated_at = now();

    -- Mark any pending vendor application as approved
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

-- ============================================================
-- SECTION 7: Hardened Rider Dashboard RPCs
-- (Fixes r.vehicle_type column error and eliminates 400 exceptions
--  by gracefully auto-provisioning rider records for rider roles)
-- ============================================================

-- 7.1 Rider Operational Profile Projection
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
    'phone', p.phone,
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

-- 7.2 Rider Active Delivery Projection
CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_active   jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF v_rider_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rider') THEN
      INSERT INTO public.riders (profile_id, is_available, total_deliveries, is_active, is_verified, created_at, updated_at)
      VALUES (auth.uid(), false, 0, true, true, now(), now())
      ON CONFLICT (profile_id) DO NOTHING;

      SELECT id INTO v_rider_id
      FROM public.riders
      WHERE profile_id = auth.uid();
    END IF;
  END IF;

  IF v_rider_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'assignment_id', da.id,
    'delivery_id', d.id,
    'order_id', d.order_id,
    'service_type', d.service_type,
    'delivery_status', d.status,
    'assignment_status', da.status,
    'order_status', o.status,
    'pickup_address', d.pickup_address,
    'pickup_latitude', COALESCE(d.pickup_latitude, v.latitude),
    'pickup_longitude', COALESCE(d.pickup_longitude, v.longitude),
    'delivery_address', d.delivery_address,
    'delivery_latitude', d.delivery_latitude,
    'delivery_longitude', d.delivery_longitude,
    'customer_name', d.customer_name,
    'customer_phone', d.customer_phone,
    'special_instructions', d.special_instructions,
    'vendor_id', d.vendor_id,
    'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
    'vendor_address', v.business_address,
    'assigned_at', da.assigned_at,
    'responded_at', da.responded_at,
    'picked_up_at', d.picked_up_at,
    'items', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', oi.id,
          'product_name', p.name,
          'quantity', oi.quantity
        )
      ), '[]'::jsonb)
      FROM public.order_items oi
      LEFT JOIN public.products p ON p.id = oi.product_id
      WHERE oi.order_id = d.order_id
    )
  ) INTO v_active
  FROM public.delivery_assignments da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.orders o ON o.id = d.order_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id
  WHERE da.rider_id = v_rider_id
    AND da.status = 'accepted'
    AND d.status IN ('assigned', 'picked_up', 'in_transit')
  LIMIT 1;

  RETURN v_active;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_active_delivery() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_active_delivery() TO authenticated, service_role;

-- 7.3 Rider Assignment Inbox
CREATE OR REPLACE FUNCTION public.get_rider_assignment_inbox()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_inbox    jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF v_rider_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rider') THEN
      INSERT INTO public.riders (profile_id, is_available, total_deliveries, is_active, is_verified, created_at, updated_at)
      VALUES (auth.uid(), false, 0, true, true, now(), now())
      ON CONFLICT (profile_id) DO NOTHING;

      SELECT id INTO v_rider_id
      FROM public.riders
      WHERE profile_id = auth.uid();
    END IF;
  END IF;

  IF v_rider_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', da.id,
        'delivery_id', d.id,
        'service_type', d.service_type,
        'pickup_address', d.pickup_address,
        'pickup_latitude', d.pickup_latitude,
        'pickup_longitude', d.pickup_longitude,
        'delivery_area', split_part(d.delivery_address, ',', 1),
        'estimated_distance_km', public.calculate_distance_km(
          COALESCE(d.pickup_latitude, 6.8227),
          COALESCE(d.pickup_longitude, 3.9213),
          COALESCE(d.delivery_latitude, 6.8227),
          COALESCE(d.delivery_longitude, 3.9213)
        ),
        'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
        'special_instructions_preview', CASE 
          WHEN d.special_instructions IS NOT NULL THEN 'Special instructions provided'
          ELSE NULL 
        END,
        'status', da.status,
        'assigned_at', da.assigned_at
      ) ORDER BY da.assigned_at DESC
    ),
    '[]'::jsonb
  ) INTO v_inbox
  FROM public.delivery_assignments da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id
  WHERE da.rider_id = v_rider_id
    AND da.status = 'assigned'
    AND d.status = 'assigned';

  RETURN v_inbox;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_assignment_inbox() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_assignment_inbox() TO authenticated, service_role;

-- 7.4 Rider Delivery History
CREATE OR REPLACE FUNCTION public.get_rider_delivery_history(
  p_limit  integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_id uuid;
  v_history  jsonb;
BEGIN
  SELECT id INTO v_rider_id
  FROM public.riders
  WHERE profile_id = auth.uid();

  IF v_rider_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'rider') THEN
      INSERT INTO public.riders (profile_id, is_available, total_deliveries, is_active, is_verified, created_at, updated_at)
      VALUES (auth.uid(), false, 0, true, true, now(), now())
      ON CONFLICT (profile_id) DO NOTHING;

      SELECT id INTO v_rider_id
      FROM public.riders
      WHERE profile_id = auth.uid();
    END IF;
  END IF;

  IF v_rider_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'assignment_id', da.id,
        'delivery_id', d.id,
        'order_id', d.order_id,
        'service_type', d.service_type,
        'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
        'pickup_area', split_part(d.pickup_address, ',', 1),
        'delivery_area', split_part(d.delivery_address, ',', 1),
        'delivered_at', d.delivered_at,
        'assignment_status', da.status,
        'delivery_status', d.status
      ) ORDER BY d.delivered_at DESC NULLS LAST
    ),
    '[]'::jsonb
  ) INTO v_history
  FROM (
    SELECT da.id, da.delivery_id, da.status
    FROM public.delivery_assignments da
    WHERE da.rider_id = v_rider_id
      AND da.status = 'completed'
    ORDER BY da.updated_at DESC
    LIMIT LEAST(p_limit, 50) OFFSET GREATEST(p_offset, 0)
  ) da
  JOIN public.deliveries d ON d.id = da.delivery_id
  LEFT JOIN public.vendors v ON v.id = d.vendor_id;

  RETURN v_history;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) TO authenticated, service_role;

