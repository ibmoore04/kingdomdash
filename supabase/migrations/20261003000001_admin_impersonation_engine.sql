-- =============================================================================
-- Migration: 20261003000001_admin_impersonation_engine.sql
-- Module   : KingdomDash Admin "View-As" Role Impersonation Engine (Phase 2)
-- Purpose  : 1. Create public.admin_impersonation_logs for immutable audit trail
--            2. Implement admin_start_impersonation RPC with strict hierarchy checks
--            3. Implement admin_stop_impersonation RPC with session lifecycle tracking
--            4. Enforce RLS policies and privilege boundaries
-- =============================================================================

-- 1. Create public.admin_impersonation_logs table
CREATE TABLE IF NOT EXISTS public.admin_impersonation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_role text NOT NULL,
  reason text NOT NULL,
  action text NOT NULL CHECK (action IN ('started', 'ended')),
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_impersonation_logs_admin ON public.admin_impersonation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_logs_target ON public.admin_impersonation_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_logs_created ON public.admin_impersonation_logs(created_at DESC);

-- 2. RLS Security on admin_impersonation_logs
ALTER TABLE public.admin_impersonation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view impersonation audit logs" ON public.admin_impersonation_logs;
CREATE POLICY "Admins can view impersonation audit logs"
  ON public.admin_impersonation_logs FOR SELECT
  TO authenticated
  USING (public.get_current_user_role() IN ('super_admin', 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.admin_impersonation_logs FROM anon, authenticated;
GRANT SELECT ON public.admin_impersonation_logs TO authenticated;

-- 3. RPC: admin_start_impersonation
CREATE OR REPLACE FUNCTION public.admin_start_impersonation(
  p_target_user_id uuid,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_role text;
  v_target_profile record;
  v_log_id uuid;
  v_clean_reason text;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'KD401';
  END IF;

  v_admin_role := public.get_current_user_role();
  IF v_admin_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only platform administrators can impersonate roles' USING ERRCODE = 'KD403';
  END IF;

  v_clean_reason := NULLIF(TRIM(p_reason), '');
  IF v_clean_reason IS NULL OR LENGTH(v_clean_reason) < 5 THEN
    RAISE EXCEPTION 'A valid business reason (at least 5 characters) is strictly required for impersonation audit logging'
      USING ERRCODE = 'KD400';
  END IF;

  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user % not found', p_target_user_id USING ERRCODE = 'KD404';
  END IF;

  IF NOT v_target_profile.is_active THEN
    RAISE EXCEPTION 'Cannot impersonate suspended or deactivated account' USING ERRCODE = 'KD400';
  END IF;

  -- Impersonation Hierarchy Protection:
  -- 1. No one can impersonate a super_admin.
  -- 2. An admin cannot impersonate another admin (only super_admin can inspect an admin).
  -- 3. An admin cannot impersonate themselves.
  IF v_target_profile.id = v_admin_id THEN
    RAISE EXCEPTION 'Self-impersonation is redundant' USING ERRCODE = 'KD400';
  END IF;

  IF v_target_profile.role = 'super_admin' THEN
    RAISE EXCEPTION 'Super-admin accounts cannot be impersonated' USING ERRCODE = 'KD403';
  END IF;

  IF v_target_profile.role = 'admin' AND v_admin_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super-administrators can view-as other administrators' USING ERRCODE = 'KD403';
  END IF;

  -- Record immutable audit log
  INSERT INTO public.admin_impersonation_logs (
    admin_id,
    target_user_id,
    target_role,
    reason,
    action,
    metadata
  ) VALUES (
    v_admin_id,
    v_target_profile.id,
    v_target_profile.role,
    v_clean_reason,
    'started',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  -- Operational audit event
  PERFORM public.log_operational_audit_event(
    'admin_impersonation_started',
    'profiles',
    v_target_profile.id,
    NULL,
    jsonb_build_object(
      'admin_id', v_admin_id,
      'admin_role', v_admin_role,
      'target_user_id', v_target_profile.id,
      'target_role', v_target_profile.role,
      'reason', v_clean_reason,
      'log_id', v_log_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'target_user', jsonb_build_object(
      'id', v_target_profile.id,
      'email', v_target_profile.email,
      'full_name', v_target_profile.full_name,
      'phone', v_target_profile.phone,
      'avatar_url', v_target_profile.avatar_url,
      'role', v_target_profile.role,
      'is_active', v_target_profile.is_active,
      'created_at', v_target_profile.created_at,
      'updated_at', v_target_profile.updated_at
    ),
    'started_at', now()
  );
END;
$$;

-- 4. RPC: admin_stop_impersonation
CREATE OR REPLACE FUNCTION public.admin_stop_impersonation(
  p_target_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_admin_role text;
  v_target_profile record;
  v_log_id uuid;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'KD401';
  END IF;

  v_admin_role := public.get_current_user_role();
  IF v_admin_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: only platform administrators can manage impersonation' USING ERRCODE = 'KD403';
  END IF;

  SELECT * INTO v_target_profile
  FROM public.profiles
  WHERE id = p_target_user_id;

  -- Record immutable audit log
  INSERT INTO public.admin_impersonation_logs (
    admin_id,
    target_user_id,
    target_role,
    reason,
    action,
    metadata
  ) VALUES (
    v_admin_id,
    p_target_user_id,
    COALESCE(v_target_profile.role, 'unknown'),
    'Impersonation session concluded normally',
    'ended',
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  -- Operational audit event
  PERFORM public.log_operational_audit_event(
    'admin_impersonation_ended',
    'profiles',
    p_target_user_id,
    NULL,
    jsonb_build_object(
      'admin_id', v_admin_id,
      'target_user_id', p_target_user_id,
      'log_id', v_log_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'ended_at', now()
  );
END;
$$;

-- 5. Privileges and Grants
REVOKE EXECUTE ON FUNCTION public.admin_start_impersonation(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_start_impersonation(uuid, text, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_start_impersonation(uuid, text, jsonb) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_stop_impersonation(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_stop_impersonation(uuid, jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_stop_impersonation(uuid, jsonb) TO authenticated, service_role;
