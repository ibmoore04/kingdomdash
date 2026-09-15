-- =============================================================================
-- Migration: 20260902000025_notifications_and_supporting_systems.sql
-- Purpose  : Phase 13 — Notifications & Supporting Systems (Hardened & Corrected)
--            Authoritative Event-Driven Notification Engine, Deterministic
--            Idempotency, Separation of Category vs. Severity, Realtime
--            Publication Security, Preference Hierarchy, and Atomic Bulk RPCs.
-- =============================================================================

-- =============================================================================
-- §1  SCHEMA EXTENSIONS: NOTIFICATION CATEGORY & TABLE ENHANCEMENTS
-- =============================================================================

-- 1.1 Controlled Category Model (Strict separation of Category vs. Severity Type)
DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM (
    'order',
    'delivery',
    'payment',
    'application',
    'system',
    'promotional'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1.2 Table Enhancements on public.notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category public.notification_category NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- 1.3 Deterministic Idempotency Partial Unique Index
-- Nullable idempotency_key is supported for manual/ad-hoc non-idempotent broadcasts,
-- while all automated system emissions supply a deterministic key enforced by a partial unique index.
DO $$ BEGIN
  ALTER TABLE public.notifications
    DROP CONSTRAINT IF EXISTS uq_notifications_profile_idempotency;
EXCEPTION WHEN undefined_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_profile_idempotency
  ON public.notifications (profile_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 1.4 High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON public.notifications(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON public.notifications(profile_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_profile_category
  ON public.notifications(profile_id, category);


-- =============================================================================
-- §2  NOTIFICATION PREFERENCES TABLE & RLS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_updates boolean NOT NULL DEFAULT true,
  delivery_updates boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  application_updates boolean NOT NULL DEFAULT true,
  promotional boolean NOT NULL DEFAULT false,
  operational_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure column exists if table was created previously
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS application_updates boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  USING (profile_id = auth.uid());


-- =============================================================================
-- §3  NOTIFICATIONS ROW LEVEL SECURITY ENHANCEMENTS
-- =============================================================================

-- Allow users to purge their own read notifications securely
DROP POLICY IF EXISTS "notifications_delete_own_read" ON public.notifications;
CREATE POLICY "notifications_delete_own_read" ON public.notifications
  FOR DELETE USING (profile_id = auth.uid() AND is_read = true);


-- =============================================================================
-- §4  CENTRALIZED EVENT EMITTER PROCEDURE
-- =============================================================================
-- Architectural Semantics:
-- 1. Expected Idempotency: ON CONFLICT DO NOTHING returns NULL without error.
-- 2. Preference Suppression: If non-mandatory and opted out, returns NULL intentionally.
-- 3. Unexpected Failure: Unexpected DB/infrastructure errors are NOT swallowed;
--    they propagate as standard PostgreSQL exceptions, preserving transaction atomicity.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_profile_id       uuid,
  p_title            text,
  p_message          text,
  p_type             public.notification_type,
  p_category         public.notification_category,
  p_action_url       text DEFAULT NULL,
  p_idempotency_key  text DEFAULT NULL,
  p_metadata         jsonb DEFAULT '{}'::jsonb,
  p_is_mandatory     boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_pref           record;
  v_is_allowed     boolean := true;
  v_inserted_id    uuid;
BEGIN
  -- 1. Validate target profile exists
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. If not mandatory, evaluate user preferences
  IF NOT p_is_mandatory THEN
    SELECT * INTO v_pref
    FROM public.notification_preferences
    WHERE profile_id = p_profile_id;

    IF FOUND THEN
      IF p_category = 'order' AND NOT v_pref.order_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'delivery' AND NOT v_pref.delivery_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'payment' AND NOT v_pref.payment_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'application' AND NOT v_pref.application_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'promotional' AND NOT v_pref.promotional THEN v_is_allowed := false; END IF;
      IF p_category = 'system' AND NOT v_pref.operational_alerts THEN v_is_allowed := false; END IF;
    END IF;
  END IF;

  IF NOT v_is_allowed THEN
    RETURN NULL;
  END IF;

  -- 3. Insert notification with partial unique index idempotency conflict resolution
  -- Returns newly generated UUID if inserted, or NULL if already emitted (idempotent no-op).
  -- Unexpected schema, constraint, or connection failures propagate immediately.
  INSERT INTO public.notifications (
    profile_id,
    title,
    message,
    type,
    category,
    action_url,
    idempotency_key,
    metadata,
    is_read,
    created_at
  ) VALUES (
    p_profile_id,
    p_title,
    p_message,
    p_type,
    p_category,
    p_action_url,
    p_idempotency_key,
    p_metadata,
    false,
    pg_catalog.now()
  )
  ON CONFLICT (profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_inserted_id;

  RETURN v_inserted_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.emit_notification(uuid, text, text, public.notification_type, public.notification_category, text, text, jsonb, boolean) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.emit_notification(uuid, text, text, public.notification_type, public.notification_category, text, text, jsonb, boolean) TO authenticated;


-- =============================================================================
-- §5  ATOMIC MANAGEMENT RPCS
-- =============================================================================

-- 5.1 Mark all notifications read for the caller
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE profile_id = auth.uid() AND is_read = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- 5.2 Purge caller's read notifications
CREATE OR REPLACE FUNCTION public.clear_read_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.notifications
  WHERE profile_id = auth.uid() AND is_read = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clear_read_notifications() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.clear_read_notifications() TO authenticated;

-- 5.3 Fast unread count query
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT count(*)::integer
  FROM public.notifications
  WHERE profile_id = auth.uid() AND is_read = false;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;


-- =============================================================================
-- §6  LIFECYCLE TRIGGERS
-- =============================================================================

-- 6.1 Order Lifecycle Notification Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_order_notification_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vendor_profile_id uuid;
  v_rider_profile_id  uuid;
  v_order_short_id    text;
BEGIN
  -- Only execute on genuine status transitions
  IF TG_OP = 'UPDATE' AND (OLD.status IS NOT DISTINCT FROM NEW.status) THEN
    RETURN NEW;
  END IF;

  v_order_short_id := substring(NEW.id::text from 1 for 8);

  -- Resolve vendor profile id if applicable
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT profile_id INTO v_vendor_profile_id
    FROM public.vendors
    WHERE id = NEW.vendor_id;
  END IF;

  -- Resolve authoritative assigned rider profile id via active delivery assignment
  SELECT r.profile_id INTO v_rider_profile_id
  FROM public.deliveries d
  JOIN public.delivery_assignments da ON da.delivery_id = d.id AND da.status IN ('accepted', 'assigned')
  JOIN public.riders r ON r.id = da.rider_id
  WHERE d.order_id = NEW.id
  ORDER BY CASE WHEN da.status = 'accepted' THEN 1 ELSE 2 END, da.created_at DESC
  LIMIT 1;

  -- State-specific event emission
  CASE NEW.status
    WHEN 'payment_confirmed' THEN
      -- Customer payment verified notification (Mandatory)
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Payment Confirmed',
        'Your payment for Order #' || v_order_short_id || ' was verified successfully.',
        'success',
        'payment',
        '/order/' || NEW.id || '/confirmation',
        'order:' || NEW.id || ':status:payment_confirmed:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        true
      );

      -- Vendor new order alert (Mandatory)
      IF v_vendor_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_vendor_profile_id,
          'New Paid Order',
          'Order #' || v_order_short_id || ' has been confirmed and is awaiting preparation.',
          'info',
          'order',
          '/vendor?tab=orders',
          'order:' || NEW.id || ':status:payment_confirmed:vendor:' || v_vendor_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          true
        );
      END IF;

    WHEN 'preparing' THEN
      -- Customer prep notification
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Order In Preparation',
        'The merchant is now preparing Order #' || v_order_short_id || '.',
        'info',
        'order',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:preparing:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        false
      );

    WHEN 'ready_for_pickup' THEN
      -- Customer ready notification
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Order Ready for Pickup',
        'Order #' || v_order_short_id || ' is packed and awaiting courier pickup.',
        'info',
        'order',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:ready_for_pickup:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        false
      );

      -- Rider ready notification
      IF v_rider_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_rider_profile_id,
          'Order Ready for Collection',
          'Order #' || v_order_short_id || ' is packed and ready for pickup at the store.',
          'info',
          'delivery',
          '/rider/deliveries/active',
          'order:' || NEW.id || ':status:ready_for_pickup:rider:' || v_rider_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          false
        );
      END IF;

    WHEN 'picked_up' THEN
      -- Customer custody notification (Mandatory)
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Package Picked Up',
        'Courier has collected Order #' || v_order_short_id || ' from the merchant.',
        'info',
        'delivery',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:picked_up:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        true
      );

      -- Vendor custody notification
      IF v_vendor_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_vendor_profile_id,
          'Order Picked Up',
          'Courier has collected Order #' || v_order_short_id || '.',
          'info',
          'delivery',
          '/vendor?tab=orders',
          'order:' || NEW.id || ':status:picked_up:vendor:' || v_vendor_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          false
        );
      END IF;

    WHEN 'in_transit' THEN
      -- Customer in transit notification (Mandatory)
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Courier In Transit',
        'Your courier is on the way with Order #' || v_order_short_id || '.',
        'info',
        'delivery',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:in_transit:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        true
      );

    WHEN 'delivered' THEN
      -- Customer delivery completion (Mandatory)
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Order Delivered',
        'Order #' || v_order_short_id || ' has been successfully delivered. Thank you!',
        'success',
        'order',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:delivered:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
        true
      );

      -- Vendor completion notification
      IF v_vendor_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_vendor_profile_id,
          'Order Delivered',
          'Order #' || v_order_short_id || ' was successfully delivered to the customer.',
          'success',
          'order',
          '/vendor?tab=orders',
          'order:' || NEW.id || ':status:delivered:vendor:' || v_vendor_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          false
        );
      END IF;

    WHEN 'cancelled' THEN
      -- Customer cancellation alert (Mandatory)
      PERFORM public.emit_notification(
        NEW.customer_id,
        'Order Cancelled',
        'Order #' || v_order_short_id || ' has been cancelled. ' || COALESCE(NEW.cancellation_reason, ''),
        'warning',
        'order',
        '/dashboard?tab=orders',
        'order:' || NEW.id || ':status:cancelled:customer:' || NEW.customer_id,
        jsonb_build_object('order_id', NEW.id, 'status', NEW.status, 'reason', NEW.cancellation_reason),
        true
      );

      -- Vendor cancellation alert (Mandatory)
      IF v_vendor_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_vendor_profile_id,
          'Order Cancelled',
          'Order #' || v_order_short_id || ' has been cancelled.',
          'warning',
          'order',
          '/vendor?tab=orders',
          'order:' || NEW.id || ':status:cancelled:vendor:' || v_vendor_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          true
        );
      END IF;

      -- Rider cancellation alert (Mandatory)
      IF v_rider_profile_id IS NOT NULL THEN
        PERFORM public.emit_notification(
          v_rider_profile_id,
          'Delivery Cancelled',
          'The delivery for Order #' || v_order_short_id || ' has been cancelled.',
          'warning',
          'delivery',
          '/rider/assignments',
          'order:' || NEW.id || ':status:cancelled:rider:' || v_rider_profile_id,
          jsonb_build_object('order_id', NEW.id, 'status', NEW.status),
          true
        );
      END IF;

    ELSE
      NULL;
  END CASE;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_notification_lifecycle ON public.orders;
CREATE TRIGGER trg_order_notification_lifecycle
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_order_notification_lifecycle();

-- 6.2 Delivery Assignment Notification Trigger
CREATE OR REPLACE FUNCTION public.trg_fn_delivery_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_rider_profile_id uuid;
BEGIN
  -- When assigned to a courier
  IF NEW.status = 'assigned' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'assigned') THEN
    SELECT profile_id INTO v_rider_profile_id
    FROM public.riders
    WHERE id = NEW.rider_id;

    IF v_rider_profile_id IS NOT NULL THEN
      PERFORM public.emit_notification(
        v_rider_profile_id,
        'New Delivery Assignment',
        'You have a new delivery request awaiting your response.',
        'info',
        'delivery',
        '/rider/assignments',
        'assignment:' || NEW.id || ':status:assigned:rider:' || v_rider_profile_id,
        jsonb_build_object('assignment_id', NEW.id, 'delivery_id', NEW.delivery_id),
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_assignment_notification ON public.delivery_assignments;
CREATE TRIGGER trg_delivery_assignment_notification
  AFTER INSERT OR UPDATE OF status ON public.delivery_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_delivery_assignment_notification();

-- 6.3 Onboarding Applications Notification Trigger (Admins + Applicants)
CREATE OR REPLACE FUNCTION public.trg_fn_application_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_admin_record   record;
  v_app_type       text;
  v_app_target_url text;
BEGIN
  v_app_type := CASE WHEN TG_TABLE_NAME = 'rider_applications' THEN 'rider' ELSE 'vendor' END;
  v_app_target_url := CASE WHEN TG_TABLE_NAME = 'rider_applications' THEN '/admin/rider-applications' ELSE '/admin/vendor-applications' END;

  -- 1. New application submission -> Alert all active administrators
  IF TG_OP = 'INSERT' THEN
    FOR v_admin_record IN
      SELECT id FROM public.profiles WHERE role IN ('admin', 'super_admin') AND is_active = true
    LOOP
      PERFORM public.emit_notification(
        v_admin_record.id,
        'New ' || initcap(v_app_type) || ' Application',
        'A new ' || v_app_type || ' application has been submitted for administrative review.',
        'info',
        'application',
        v_app_target_url,
        'app_sub:' || v_app_type || ':' || NEW.id || ':admin:' || v_admin_record.id,
        jsonb_build_object('application_id', NEW.id, 'type', v_app_type),
        true
      );
    END LOOP;
  END IF;

  -- 2. Status update (approval or rejection) -> Alert applicant
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.status = 'approved' THEN
      PERFORM public.emit_notification(
        NEW.profile_id,
        'Application Approved!',
        'Congratulations! Your ' || v_app_type || ' application has been approved. Welcome to KingdomDash!',
        'success',
        'application',
        CASE WHEN v_app_type = 'rider' THEN '/rider/dashboard' ELSE '/vendor/dashboard' END,
        'app_decision:' || v_app_type || ':' || NEW.id || ':status:approved:applicant:' || NEW.profile_id,
        jsonb_build_object('application_id', NEW.id, 'status', NEW.status),
        true
      );
    ELSIF NEW.status = 'rejected' THEN
      PERFORM public.emit_notification(
        NEW.profile_id,
        'Application Update',
        'Your ' || v_app_type || ' application was reviewed and could not be approved at this time. ' || COALESCE(NEW.rejection_reason, ''),
        'warning',
        'application',
        '/',
        'app_decision:' || v_app_type || ':' || NEW.id || ':status:rejected:applicant:' || NEW.profile_id,
        jsonb_build_object('application_id', NEW.id, 'status', NEW.status, 'reason', NEW.rejection_reason),
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rider_application_notification ON public.rider_applications;
CREATE TRIGGER trg_rider_application_notification
  AFTER INSERT OR UPDATE OF status ON public.rider_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_application_notification();

DROP TRIGGER IF EXISTS trg_vendor_application_notification ON public.vendor_applications;
CREATE TRIGGER trg_vendor_application_notification
  AFTER INSERT OR UPDATE OF status ON public.vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_application_notification();


-- =============================================================================
-- §7  SUPABASE REALTIME PUBLICATION CONFIGURATION
-- =============================================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
