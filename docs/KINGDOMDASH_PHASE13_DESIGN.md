# KINGDOMDASH — PHASE 13: NOTIFICATIONS & SUPPORTING SYSTEMS
# ARCHITECTURAL DESIGN SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Approved Master Design  
**Target Release:** KingdomDash Phase 13  
**Tagline:** SWIFT IN MOTION  

---

## 1. Architectural Topology

Phase 13 establishes a unified, database-first event-driven notification architecture that coordinates between transactional state machines in PostgreSQL, Realtime broadcasting, and role-specific frontend client experiences.

```text
                     ┌──────────────────────────────────────┐
                     │     BUSINESS MUTATION (POSTGRES)     │
                     │ • Order State Transition (RPC)       │
                     │ • Paystack Payment Verification      │
                     │ • Delivery Assignment / Custody RPC  │
                     │ • Onboarding Application Review      │
                     └──────────────────┬───────────────────┘
                                        │
                                        ▼
                     ┌──────────────────────────────────────┐
                     │    POSTGRESQL LIFECYCLE TRIGGERS     │
                     │ • trg_fn_order_notification_lifecycle│
                     │ • trg_fn_assignment_notification     │
                     │ • trg_fn_application_notification    │
                     └──────────────────┬───────────────────┘
                                        │
                                        ▼
                     ┌──────────────────────────────────────┐
                     │       public.emit_notification()     │
                     │ • Deterministic Idempotency Key Gen  │
                     │ • User Preference Evaluation         │
                     │ • ON CONFLICT (profile, key) DO NOTH │
                     │ • Forensic Audit on Infrastructure Err│
                     └──────────────────┬───────────────────┘
                                        │
                                        ▼
                     ┌──────────────────────────────────────┐
                     │        public.notifications          │
                     │ (REPLICA IDENTITY FULL, RLS Protected│
                     └──────────┬───────────────────┬───────┘
                                │                   │
       Database Query Pull      │                   │ Realtime Push
   (getMyNotifications, RPCs)   │                   │ (supabase_realtime)
                                ▼                   ▼
             ┌─────────────────────────────────────────────────┐
             │       FRONTEND NOTIFICATION SERVICE LAYER       │
             │   (src/services/supabase/notifications.ts)      │
             └─────────────────────────┬───────────────────────┘
                                       │
            ┌──────────────────────────┼─────────────────────────┐
            ▼                          ▼                         ▼
   ┌─────────────────┐       ┌───────────────────┐     ┌───────────────────┐
   │ Customer &      │       │ Rider Platform    │     │ Admin Control     │
   │ Vendor Tabs     │       │ Notifications     │     │ Center Alerts     │
   └─────────────────┘       └───────────────────┘     └───────────────────┘
```

---

## 2. Database Schema Design (Migration 025)

### 2.1 Enum Definition: `notification_category`
```sql
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
```

### 2.2 Table Enhancements: `public.notifications`
```sql
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS category public.notification_category NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Partial unique constraint guaranteeing deterministic idempotency per profile
DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT uq_notifications_profile_idempotency
    UNIQUE (profile_id, idempotency_key);
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- High-performance query indexes
CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON public.notifications(profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_profile_unread
  ON public.notifications(profile_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_profile_category
  ON public.notifications(profile_id, category);
```

### 2.3 Table Creation: `public.notification_preferences`
```sql
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_updates boolean NOT NULL DEFAULT true,
  delivery_updates boolean NOT NULL DEFAULT true,
  payment_updates boolean NOT NULL DEFAULT true,
  promotional boolean NOT NULL DEFAULT false,
  operational_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "notification_preferences_insert_own"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences FOR UPDATE
  USING (profile_id = auth.uid());
```

---

## 3. Authoritative Event Emitter Procedure

```sql
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
  -- 1. If not mandatory, evaluate user preferences
  IF NOT p_is_mandatory THEN
    SELECT * INTO v_pref
    FROM public.notification_preferences
    WHERE profile_id = p_profile_id;

    IF FOUND THEN
      IF p_category = 'order' AND NOT v_pref.order_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'delivery' AND NOT v_pref.delivery_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'payment' AND NOT v_pref.payment_updates THEN v_is_allowed := false; END IF;
      IF p_category = 'promotional' AND NOT v_pref.promotional THEN v_is_allowed := false; END IF;
      IF p_category = 'system' AND NOT v_pref.operational_alerts THEN v_is_allowed := false; END IF;
    END IF;
  END IF;

  IF NOT v_is_allowed THEN
    RETURN NULL;
  END IF;

  -- 2. Insert with strict idempotency conflict resolution
  BEGIN
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
    ON CONFLICT (profile_id, idempotency_key) DO NOTHING
    RETURNING id INTO v_inserted_id;

    RETURN v_inserted_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Log non-idempotent unexpected infrastructure failures for forensic observability
      PERFORM public.log_operational_audit_event(
        'notification_emission_failed',
        'notifications',
        NULL,
        NULL,
        jsonb_build_object(
          'target_profile', p_profile_id,
          'category', p_category,
          'error_code', SQLSTATE,
          'error_msg', SQLERRM
        )
      );
      RETURN NULL;
  END;
END;
$$;
```

---

## 4. Lifecycle Trigger Implementations

### 4.1 Orders Lifecycle Trigger (`trg_fn_order_notification_lifecycle`)
Fires `AFTER UPDATE OF status ON public.orders`.
- Evaluates: `IF OLD.status IS DISTINCT FROM NEW.status THEN ...`
- Resolves:
  - Customer (`NEW.customer_id`)
  - Vendor (`SELECT profile_id FROM public.vendors WHERE id = NEW.vendor_id`)
  - Rider (`SELECT profile_id FROM public.riders r JOIN public.deliveries d ON d.rider_id = r.id WHERE d.order_id = NEW.id`)
- Generates corresponding role-specific notifications based on target status.

### 4.2 Assignment Trigger (`trg_fn_delivery_assignment_notification`)
Fires `AFTER INSERT OR UPDATE OF status ON public.delivery_assignments`.
- When `status = 'assigned'`: Alerts courier via `riders.profile_id`.
- Action URL: `/rider/assignments`.

### 4.3 Onboarding Application Trigger (`trg_fn_application_notification`)
Fires `AFTER INSERT OR UPDATE OF status` on:
- `public.rider_applications`
- `public.vendor_applications`
- On `INSERT`: Fans out alerts to all active administrators (`SELECT id FROM public.profiles WHERE role IN ('admin', 'super_admin') AND is_active = true`).
- On `UPDATE OF status` (`approved`/`rejected`): Alerts applicant (`NEW.profile_id`).

---

## 5. Row Level Security & Operational RPCs

```sql
-- Allow users to purge read notifications
CREATE POLICY "notifications_delete_own_read" ON public.notifications
  FOR DELETE USING (profile_id = auth.uid() AND is_read = true);

-- Mark All As Read RPC
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

-- Clear Read Notifications RPC
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

-- Unread Count Fast Query
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
```

---

## 6. Realtime Publication & Subscription Architecture

### 6.1 Publication Registration
```sql
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
```

### 6.2 Frontend Subscription Lifecycle
The client creates a scoped channel:
```typescript
const channel = supabase
  .channel(`realtime:notifications:${user.id}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `profile_id=eq.${user.id}`,
    },
    (payload) => {
      // Re-fetch or apply delta, update badge count
    }
  )
  .subscribe()
```
When user logs out or switches views, `supabase.removeChannel(channel)` is executed cleanly.
