-- Migration: 20260924000001_enhance_contact_messages_support.sql
-- Enhances public.contact_messages for pure Supabase support ticket management, reference codes, RLS, status transitions, and notifications.

-- 1. Ensure contact_status enum includes 'closed' value
ALTER TYPE public.contact_status ADD VALUE IF NOT EXISTS 'closed';

-- 2. Add missing columns to public.contact_messages if they do not exist
ALTER TABLE public.contact_messages 
  ADD COLUMN IF NOT EXISTS reference_code text UNIQUE DEFAULT ('KD-SUP-' || upper(substring(gen_random_uuid()::text from 1 for 6))),
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS admin_response text,
  ADD COLUMN IF NOT EXISTS admin_responded_at timestamptz,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Create performance indexes for reference code tracking and user queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_reference_code 
  ON public.contact_messages (reference_code);

CREATE INDEX IF NOT EXISTS idx_contact_messages_user_id
  ON public.contact_messages (user_id);

-- 4. RLS Policies: Pure Supabase access control
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_select_own_or_ref" ON public.contact_messages;
CREATE POLICY "contact_messages_select_own_or_ref" ON public.contact_messages
  FOR SELECT TO authenticated, anon
  USING (
    user_id = auth.uid()
    OR (auth.jwt()->>'email' IS NOT NULL AND LOWER(email) = LOWER(auth.jwt()->>'email'))
  );

DROP POLICY IF EXISTS "contact_messages_select_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_select_admin" ON public.contact_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "contact_messages_update_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_update_admin" ON public.contact_messages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 5. Update submit_support_ticket RPC
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
  v_category        text := 'general';
  v_ref_code        text;
  v_ticket_id       uuid;
  v_user_id         uuid;
  v_admin_profile   RECORD;
BEGIN
  -- Input validation
  IF length(v_trimmed_name) < 2 OR length(v_trimmed_name) > 100 THEN
    RAISE EXCEPTION 'Name must be between 2 and 100 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_email) < 5 OR length(v_trimmed_email) > 255 THEN
    RAISE EXCEPTION 'Please provide a valid email address' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_subject) < 3 OR length(v_trimmed_subject) > 200 THEN
    RAISE EXCEPTION 'Subject must be between 3 and 200 characters' USING ERRCODE = 'KD400';
  END IF;

  IF length(v_trimmed_message) < 10 OR length(v_trimmed_message) > 3000 THEN
    RAISE EXCEPTION 'Message must be between 10 and 3000 characters' USING ERRCODE = 'KD400';
  END IF;

  -- Extract category if encoded in subject like "[CATEGORY] Subject"
  IF v_trimmed_subject ~ '^\[.*\]' THEN
    v_category := LOWER(substring(v_trimmed_subject from '^\[(.*?)\]'));
  END IF;

  -- Generate Reference Code
  v_ref_code := 'KD-SUP-' || upper(substring(gen_random_uuid()::text from 1 for 6));

  -- Detect caller user_id if authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE LOWER(email) = v_trimmed_email LIMIT 1;
  END IF;

  -- Insert ticket into public.contact_messages
  INSERT INTO public.contact_messages (
    name,
    email,
    phone,
    subject,
    message,
    category,
    reference_code,
    user_id,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_trimmed_name,
    v_trimmed_email,
    NULLIF(v_trimmed_phone, ''),
    v_trimmed_subject,
    v_trimmed_message,
    v_category,
    v_ref_code,
    v_user_id,
    'new'::public.contact_status,
    now(),
    now()
  )
  RETURNING id INTO v_ticket_id;

  -- Notify all admin profiles in public.notifications
  FOR v_admin_profile IN 
    SELECT id FROM public.profiles WHERE role IN ('admin', 'super_admin')
  LOOP
    INSERT INTO public.notifications (
      profile_id,
      title,
      message,
      type,
      action_url,
      created_at
    ) VALUES (
      v_admin_profile.id,
      'New Support Ticket (' || v_ref_code || ')',
      v_trimmed_name || ' (' || v_trimmed_email || '): ' || v_trimmed_subject,
      'info'::public.notification_type,
      '/admin/support?ref=' || v_ref_code,
      now()
    );
  END LOOP;

  -- Notify user if user profile exists (by user_id or email match)
  DECLARE
    v_user_role text := 'customer';
    v_user_url  text;
  BEGIN
    IF v_user_id IS NOT NULL THEN
      SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
      IF v_user_role = 'vendor' THEN
        v_user_url := '/vendor?tab=support&ref=' || v_ref_code;
      ELSIF v_user_role = 'rider' THEN
        v_user_url := '/rider/support?ref=' || v_ref_code;
      ELSE
        v_user_url := '/dashboard?tab=support&ref=' || v_ref_code;
      END IF;

      INSERT INTO public.notifications (
        profile_id,
        title,
        message,
        type,
        action_url,
        created_at
      ) VALUES (
        v_user_id,
        'Support Request Logged (' || v_ref_code || ')',
        'Your support request "' || v_trimmed_subject || '" has been received. Ref ID: ' || v_ref_code,
        'info'::public.notification_type,
        v_user_url,
        now()
      );
    END IF;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'reference_code', v_ref_code,
    'message', 'Your support request has been submitted successfully.'
  );
END;
$$;

-- 6. RPC for status updates and admin replies
CREATE OR REPLACE FUNCTION public.update_support_ticket_status(
  p_ticket_id      text,
  p_status         text,
  p_admin_response text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_status_enum    public.contact_status;
  v_ticket_rec     public.contact_messages%ROWTYPE;
  v_target_user_id uuid;
  v_target_role    text := 'customer';
  v_target_url     text;
  v_notif_title    text;
  v_notif_msg      text;
BEGIN
  -- Verify caller is admin or super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can update support ticket status' USING ERRCODE = 'KD403';
  END IF;

  -- Validate and cast status
  BEGIN
    v_status_enum := p_status::public.contact_status;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid support status: %', p_status USING ERRCODE = 'KD400';
  END;

  -- Update contact_messages
  UPDATE public.contact_messages
  SET 
    status = v_status_enum,
    admin_response = COALESCE(NULLIF(TRIM(p_admin_response), ''), admin_response),
    admin_responded_at = CASE WHEN p_admin_response IS NOT NULL AND TRIM(p_admin_response) != '' THEN now() ELSE admin_responded_at END,
    updated_at = now()
  WHERE reference_code = TRIM(p_ticket_id) OR id::text = TRIM(p_ticket_id)
  RETURNING * INTO v_ticket_rec;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support ticket not found for ID or reference: %', p_ticket_id USING ERRCODE = 'KD404';
  END IF;

  -- Resolve target user profile (by user_id or email)
  v_target_user_id := v_ticket_rec.user_id;
  IF v_target_user_id IS NULL THEN
    SELECT id, role INTO v_target_user_id, v_target_role
    FROM public.profiles
    WHERE LOWER(email) = LOWER(v_ticket_rec.email)
    LIMIT 1;
  ELSE
    SELECT role INTO v_target_role FROM public.profiles WHERE id = v_target_user_id;
  END IF;

  -- Notify user whenever ticket status or admin reply is updated
  IF v_target_user_id IS NOT NULL THEN
    IF v_target_role = 'vendor' THEN
      v_target_url := '/vendor?tab=support&ref=' || v_ticket_rec.reference_code;
    ELSIF v_target_role = 'rider' THEN
      v_target_url := '/rider/support?ref=' || v_ticket_rec.reference_code;
    ELSE
      v_target_url := '/dashboard?tab=support&ref=' || v_ticket_rec.reference_code;
    END IF;

    IF v_status_enum = 'resolved' THEN
      v_notif_title := 'Support Ticket Resolved (' || v_ticket_rec.reference_code || ')';
    ELSIF v_status_enum = 'in_progress' THEN
      v_notif_title := 'Support Ticket Under Review (' || v_ticket_rec.reference_code || ')';
    ELSIF v_status_enum = 'closed' THEN
      v_notif_title := 'Support Ticket Closed (' || v_ticket_rec.reference_code || ')';
    ELSE
      v_notif_title := 'Support Ticket Updated (' || v_ticket_rec.reference_code || ')';
    END IF;

    IF v_ticket_rec.admin_response IS NOT NULL AND TRIM(v_ticket_rec.admin_response) != '' THEN
      v_notif_msg := 'Official response for ticket ' || v_ticket_rec.reference_code || ': "' || v_ticket_rec.admin_response || '"';
    ELSE
      v_notif_msg := 'Your support ticket (' || v_ticket_rec.reference_code || ') status has been changed to ' || UPPER(v_status_enum::text) || '.';
    END IF;

    INSERT INTO public.notifications (
      profile_id,
      title,
      message,
      type,
      action_url,
      created_at
    ) VALUES (
      v_target_user_id,
      v_notif_title,
      v_notif_msg,
      'info'::public.notification_type,
      v_target_url,
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_rec.id,
    'reference_code', v_ticket_rec.reference_code,
    'status', v_ticket_rec.status,
    'admin_response', v_ticket_rec.admin_response,
    'message', 'Support ticket status updated successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_support_ticket(text, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_support_ticket_status(text, text, text) TO authenticated, service_role;

-- 7. RPC for secure exact reference code lookup without broad SELECT RLS exposure
CREATE OR REPLACE FUNCTION public.get_support_ticket_by_ref(p_ref_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rec public.contact_messages%ROWTYPE;
BEGIN
  IF p_ref_code IS NULL OR TRIM(p_ref_code) = '' THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rec
  FROM public.contact_messages
  WHERE reference_code = TRIM(p_ref_code) OR id::text = TRIM(p_ref_code)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN to_jsonb(v_rec);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_support_ticket_by_ref(text) TO anon, authenticated, service_role;
