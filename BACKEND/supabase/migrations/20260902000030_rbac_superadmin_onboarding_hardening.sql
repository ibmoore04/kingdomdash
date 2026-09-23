-- Migration: 20260902000030_rbac_superadmin_onboarding_hardening.sql
-- Description:
--   1. Super Admin Isolation: Hardens profiles RLS so standard Admins receive zero
--      super_admin records on SELECT, have ZERO direct UPDATE capability on profiles
--      (all administrative updates route through dedicated SECURITY DEFINER RPCs),
--      and cannot promote anyone to super_admin or admin.
--   2. Dedicated Activation RPC: admin_toggle_user_active(target_id, is_active) with
--      strict server-side caller validation, service_role JWT recognition, KD403 for
--      targeting Super Admin, self-deactivation prevention, non-destructive operational
--      sync, and fail-closed audit rollback.
--   3. Dedicated Role Management RPC: admin_set_user_role(target_id, new_role) with
--      strict role transitions, protecting Super Admin accounts from operational mutation,
--      preventing Admin privilege escalation and application workflow bypass.
--   4. Vendor Multi-Service Approval: Overloads approve_vendor_application to accept
--      explicit service types (food, grocery, or both) and atomically populate vendor_services.
--      Strictly rejects empty service selections (KD400) without silent fallback.
--   5. Support System Persistence: submit_support_ticket RPC reusing public.contact_messages
--      with synchronized 3,000 char validation, transactional advisory lock anti-race
--      guard, rate limiting index optimizations, and safe sanitization.

-- ============================================================================
-- §1  ROW LEVEL SECURITY HARDENING: PROFILES TABLE
-- ============================================================================

-- 1.1 SELECT Policy: Standard admins receive ZERO super_admin records.
--     Super admins receive all records.
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT
  USING (
    public.get_current_user_role() = 'super_admin'
    OR (public.get_current_user_role() = 'admin' AND role <> 'super_admin')
  );

-- 1.2 UPDATE Policy: Standard admins have ZERO direct UPDATE access to profiles.
--     Super admins retain emergency direct UPDATE capability.
--     Normal users update only their own profile via profiles_update_own (auth.uid() = id).
--     All administrative role and active status modifications MUST route through the
--     dedicated SECURITY DEFINER RPCs (admin_toggle_user_active, admin_set_user_role).
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_super_admin" ON public.profiles;
CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE
  USING (
    public.get_current_user_role() = 'super_admin'
  )
  WITH CHECK (
    public.get_current_user_role() = 'super_admin'
  );

-- ============================================================================
-- §2  DEDICATED ACTIVATION RPC: admin_toggle_user_active
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_toggle_user_active(
  p_target_user_id uuid,
  p_is_active      boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id        uuid;
  v_caller_role      text;
  v_is_service_role  boolean;
  v_actor_identifier text;
  v_target           record;
BEGIN
  v_caller_id := auth.uid();
  v_caller_role := public.get_current_user_role();

  -- 1. Comprehensive Supabase / PostgREST execution context check
  -- Recognizes authenticated session roles, direct database superusers,
  -- and service_role JWT execution contexts where auth.uid() may be null.
  v_is_service_role := (
    current_user IN ('postgres', 'supabase_admin')
    OR auth.role() = 'service_role'
    OR (COALESCE(auth.jwt() ->> 'role', '')) = 'service_role'
    OR (COALESCE(current_setting('request.jwt.claim.role', true), '')) = 'service_role'
  );

  IF NOT v_is_service_role AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: administrator privileges required'
      USING ERRCODE = 'KD403';
  END IF;

  v_actor_identifier := COALESCE(v_caller_id::text, CASE WHEN v_is_service_role THEN 'service_role' ELSE 'system' END);

  -- 2. Lock and retrieve target user
  SELECT id, role, is_active, email INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile % not found', p_target_user_id
      USING ERRCODE = 'KD404';
  END IF;

  -- 3. Self-Deactivation Prevention:
  -- Any administrator attempting self-deactivation is blocked (KD400)
  IF p_target_user_id = v_caller_id AND NOT p_is_active THEN
    RAISE EXCEPTION 'Administrators cannot deactivate their own account'
      USING ERRCODE = 'KD400';
  END IF;

  -- 4. Super Admin Target Protection Invariants:
  --   a) Standard Admins CANNOT modify Super Admin accounts (KD403)
  --   b) Super Admin accounts CANNOT be deactivated through operational RPC by ANY caller (KD403)
  IF v_target.role = 'super_admin' THEN
    IF v_caller_role = 'admin' THEN
      RAISE EXCEPTION 'Access denied: administrators cannot modify super administrator accounts'
        USING ERRCODE = 'KD403';
    END IF;
    IF NOT p_is_active THEN
      RAISE EXCEPTION 'Access denied: Super Administrator accounts cannot be deactivated through operational RPC'
        USING ERRCODE = 'KD403';
    END IF;
  END IF;

  -- 5. Mutate Profile Active State
  UPDATE public.profiles
  SET is_active = p_is_active,
      updated_at = now()
  WHERE id = p_target_user_id;

  -- 6. Non-destructive Operational Synchronization
  -- Deactivation marks vendor/rider offline/inactive without deleting historical orders or corrupting ledger
  IF NOT p_is_active THEN
    UPDATE public.vendors
    SET is_active = false,
        updated_at = now()
    WHERE profile_id = p_target_user_id;

    UPDATE public.riders
    SET is_active = false,
        is_available = false,
        updated_at = now()
    WHERE profile_id = p_target_user_id;
  ELSE
    UPDATE public.vendors
    SET is_active = true,
        updated_at = now()
    WHERE profile_id = p_target_user_id;

    UPDATE public.riders
    SET is_active = true,
        updated_at = now()
    WHERE profile_id = p_target_user_id;
  END IF;

  -- 7. Operational Audit Event
  -- Fail-closed semantics: Any failure in log_operational_audit_event aborts and rolls back the enclosing transaction.
  PERFORM public.log_operational_audit_event(
    'user_status_toggled',
    'profiles',
    p_target_user_id,
    jsonb_build_object('is_active', v_target.is_active),
    jsonb_build_object('is_active', p_is_active, 'modified_by', v_actor_identifier),
    CASE WHEN p_is_active THEN 'Account activated by administrator' ELSE 'Account deactivated by administrator' END
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'is_active', p_is_active
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_toggle_user_active(uuid, boolean) TO authenticated, service_role;

-- ============================================================================
-- §3  DEDICATED ROLE MANAGEMENT RPC: admin_set_user_role
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_target_user_id uuid,
  p_new_role       public.user_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_id        uuid;
  v_caller_role      text;
  v_is_service_role  boolean;
  v_actor_identifier text;
  v_target           record;
BEGIN
  v_caller_id := auth.uid();
  v_caller_role := public.get_current_user_role();

  -- 1. Comprehensive Supabase / PostgREST execution context check
  v_is_service_role := (
    current_user IN ('postgres', 'supabase_admin')
    OR auth.role() = 'service_role'
    OR (COALESCE(auth.jwt() ->> 'role', '')) = 'service_role'
    OR (COALESCE(current_setting('request.jwt.claim.role', true), '')) = 'service_role'
  );

  IF NOT v_is_service_role AND (v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'super_admin')) THEN
    RAISE EXCEPTION 'Access denied: administrator privileges required'
      USING ERRCODE = 'KD403';
  END IF;

  v_actor_identifier := COALESCE(v_caller_id::text, CASE WHEN v_is_service_role THEN 'service_role' ELSE 'system' END);

  -- 2. Lock and retrieve target user
  SELECT id, role, is_active INTO v_target
  FROM public.profiles
  WHERE id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile % not found', p_target_user_id
      USING ERRCODE = 'KD404';
  END IF;

  -- 3. Self-Demotion / Role Mutation Prevention:
  -- Administrative users cannot change their own role (KD400).
  IF p_target_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Administrative users cannot modify their own role'
      USING ERRCODE = 'KD400';
  END IF;

  -- 4. Super Admin Target Protection:
  -- Super Admin accounts CANNOT have their role modified through operational RPC by ANY caller
  -- (prevents peer Super Admin demotions and Admin attacks) (KD403).
  IF v_target.role = 'super_admin' THEN
    IF v_caller_role = 'admin' THEN
      RAISE EXCEPTION 'Access denied: administrators cannot modify super administrator accounts'
        USING ERRCODE = 'KD403';
    END IF;
    RAISE EXCEPTION 'Access denied: Super Administrator roles cannot be modified through operational RPC'
      USING ERRCODE = 'KD403';
  END IF;

  -- 5. Standard Admin Caller Restrictions:
  -- Standard admins cannot elevate anyone to admin or super_admin.
  IF v_caller_role = 'admin' AND p_new_role IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Access denied: administrators cannot grant administrative privileges'
      USING ERRCODE = 'KD403';
  END IF;

  -- 6. Workflow Bypass Invariant Checks:
  -- Direct promotion to vendor/rider must not bypass application approval.
  IF p_new_role = 'vendor' AND NOT EXISTS (
    SELECT 1 FROM public.vendor_applications
    WHERE profile_id = p_target_user_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Cannot assign vendor role without an approved vendor application'
      USING ERRCODE = 'KD409';
  END IF;

  IF p_new_role = 'rider' AND NOT EXISTS (
    SELECT 1 FROM public.rider_applications
    WHERE profile_id = p_target_user_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Cannot assign rider role without an approved rider application'
      USING ERRCODE = 'KD409';
  END IF;

  -- 7. Mutate Profile Role
  UPDATE public.profiles
  SET role = p_new_role,
      updated_at = now()
  WHERE id = p_target_user_id;

  -- 8. Operational Audit Event (Fail-closed)
  PERFORM public.log_operational_audit_event(
    'user_role_updated',
    'profiles',
    p_target_user_id,
    jsonb_build_object('old_role', v_target.role),
    jsonb_build_object('new_role', p_new_role, 'modified_by', v_actor_identifier),
    'User role modified by administrator'
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'old_role', v_target.role,
    'new_role', p_new_role
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) TO authenticated, service_role;

-- ============================================================================
-- §4  VENDOR MULTI-SERVICE APPROVAL RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_vendor_application(
  p_application_id uuid,
  p_service_types  public.service_type[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller_role     text;
  v_app             record;
  v_profile         record;
  v_vendor_id       uuid;
  v_st              public.service_type;
  v_chosen_services public.service_type[] := ARRAY[]::public.service_type[];
BEGIN
  -- 1. Authorization Gate
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

  -- 4. Authoritative Multi-Service Validation:
  -- Explicit requirement: An Admin approving a vendor must select at least one service.
  -- No silent fallback if an empty array is provided.
  IF p_service_types IS NOT NULL THEN
    IF array_length(p_service_types, 1) IS NULL OR array_length(p_service_types, 1) = 0 THEN
      RAISE EXCEPTION 'Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)'
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
      RAISE EXCEPTION 'Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)'
        USING ERRCODE = 'KD400';
    END IF;
  ELSIF v_app.service_types IS NOT NULL AND array_length(v_app.service_types, 1) > 0 THEN
    FOREACH v_st IN ARRAY v_app.service_types
    LOOP
      IF v_st IN ('food'::public.service_type, 'grocery'::public.service_type) THEN
        IF NOT (v_st = ANY(v_chosen_services)) THEN
          v_chosen_services := array_append(v_chosen_services, v_st);
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- If still no explicit valid service selection, reject with KD400 (NO silent default fallback)
  IF array_length(v_chosen_services, 1) IS NULL OR array_length(v_chosen_services, 1) = 0 THEN
    RAISE EXCEPTION 'Vendor approval requires selecting at least one active service capability (food, grocery, or food+grocery)'
      USING ERRCODE = 'KD400';
  END IF;

  -- 5. Insert or Update public.vendors
  -- Note: business_type is populated solely to satisfy legacy NOT NULL column constraints on public.vendors.
  -- Authoritative capability is strictly determined by public.vendor_services and checked via public.vendor_supports_service().
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

  -- 6. Upsert chosen active services in public.vendor_services
  FOREACH v_st IN ARRAY v_chosen_services
  LOOP
    INSERT INTO public.vendor_services (vendor_id, service_type, is_active, updated_at)
    VALUES (v_vendor_id, v_st, true, now())
    ON CONFLICT (vendor_id, service_type) DO UPDATE SET
      is_active = true,
      updated_at = now();
  END LOOP;

  -- Deactivate any previous services not in the chosen list
  UPDATE public.vendor_services
  SET is_active = false,
      updated_at = now()
  WHERE vendor_id = v_vendor_id
    AND service_type <> ALL(v_chosen_services);

  -- 7. Update Application & Profile Role
  UPDATE public.vendor_applications
  SET status = 'approved',
      service_types = v_chosen_services,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = p_application_id;

  UPDATE public.profiles
  SET role = 'vendor'::public.user_role,
      updated_at = now()
  WHERE id = v_app.profile_id;

  -- 8. Operational Audit Events (Fail-closed)
  PERFORM public.log_operational_audit_event(
    'vendor_application_approved',
    'vendor_application',
    p_application_id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'vendor_id', v_vendor_id, 'services', v_chosen_services),
    'Approved by administrator with multi-service capabilities'
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
    'services', v_chosen_services,
    'role', 'vendor'
  );
END;
$$;

-- Backward-compatible single parameter overload
CREATE OR REPLACE FUNCTION public.approve_vendor_application(
  p_application_id uuid
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.approve_vendor_application(p_application_id, NULL::public.service_type[]);
$$;

REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid, public.service_type[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid, public.service_type[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_vendor_application(uuid, public.service_type[]) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_vendor_application(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.approve_vendor_application(uuid) TO authenticated, service_role;

-- ============================================================================
-- §5  SUPPORT SYSTEM PERSISTENCE: submit_support_ticket
-- ============================================================================

-- Performance index for spam checking and support query optimization
CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created_at
  ON public.contact_messages (email, created_at DESC);

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
  v_trimmed_name    text := TRIM(COALESCE(p_name, ''));
  v_trimmed_email   text := LOWER(TRIM(COALESCE(p_email, '')));
  v_trimmed_phone   text := TRIM(COALESCE(p_phone, ''));
  v_trimmed_subject text := TRIM(COALESCE(p_subject, ''));
  v_trimmed_message text := TRIM(COALESCE(p_message, ''));
  v_ticket_id       uuid;
  v_recent_count    integer;
BEGIN
  -- 1. Input Validation (Message length synchronized to 3,000 characters)
  IF length(v_trimmed_name) < 2 OR length(v_trimmed_name) > 100 THEN
    RAISE EXCEPTION 'Name must be between 2 and 100 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_email) < 5 OR length(v_trimmed_email) > 255 OR v_trimmed_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please provide a valid email address' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_subject) < 3 OR length(v_trimmed_subject) > 200 THEN
    RAISE EXCEPTION 'Subject must be between 3 and 200 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_message) < 10 OR length(v_trimmed_message) > 3000 THEN
    RAISE EXCEPTION 'Message must be between 10 and 3000 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_phone) > 30 THEN
    RAISE EXCEPTION 'Phone number is too long' USING ERRCODE = 'KD400';
  END IF;

  -- 2. Concurrency-Safe Anti-Race Advisory Lock:
  -- Serializes concurrent ticket submissions for the exact same email address.
  -- Automatically released upon transaction commit or rollback.
  PERFORM pg_advisory_xact_lock(hashtext(v_trimmed_email));

  -- 3. Spam & Abuse Rate-Limiting Guard (max 5 submissions per email in 10 minutes)
  -- Serves as an atomic database-level rate limiting guard, complemented by edge gateway rate limits.
  SELECT count(*) INTO v_recent_count
  FROM public.contact_messages
  WHERE LOWER(email) = v_trimmed_email
    AND created_at > (now() - interval '10 minutes');

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Too many requests submitted recently. Please wait a few moments before trying again.'
      USING ERRCODE = 'KD429';
  END IF;

  -- 4. Atomic Insertion into public.contact_messages
  -- Status is forced to 'new'; caller cannot manipulate status or operational metadata
  INSERT INTO public.contact_messages (
    name,
    email,
    phone,
    subject,
    message,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_trimmed_name,
    v_trimmed_email,
    NULLIF(v_trimmed_phone, ''),
    v_trimmed_subject,
    v_trimmed_message,
    'new'::public.contact_status,
    now(),
    now()
  )
  RETURNING id INTO v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'message', 'Your support request has been submitted successfully.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;
