-- Migration: 20260902000036_platform_settings_and_user_preferences.sql
-- 1. Create public.platform_settings (global configuration, fees, support)
-- 2. Create public.expansion_waitlist (market expansion signups + admin notification trigger)
-- 3. Create public.vendor_settings (store operations, auto-accept, prep time, hours)
-- 4. Create public.rider_settings (navigation app, delivery radius, audio/vibration alerts)
-- 5. Create public.customer_preferences (delivery notes, preferred delivery type)
-- 6. RPC endpoints for platform configuration and waitlist submissions

-- ============================================================
-- Section 1: Platform Settings (Singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id text PRIMARY KEY DEFAULT 'default',
  platform_commission_rate numeric(5,2) NOT NULL DEFAULT 7.50 CHECK (platform_commission_rate >= 0 AND platform_commission_rate <= 100),
  base_delivery_fee_ngn numeric(10,2) NOT NULL DEFAULT 500.00 CHECK (base_delivery_fee_ngn >= 0),
  per_km_delivery_fee_ngn numeric(10,2) NOT NULL DEFAULT 120.00 CHECK (per_km_delivery_fee_ngn >= 0),
  service_fee_ngn numeric(10,2) NOT NULL DEFAULT 150.00 CHECK (service_fee_ngn >= 0),
  max_delivery_radius_km integer NOT NULL DEFAULT 25 CHECK (max_delivery_radius_km >= 1 AND max_delivery_radius_km <= 100),
  maintenance_mode boolean NOT NULL DEFAULT false,
  auto_dispatch_riders boolean NOT NULL DEFAULT true,
  surge_pricing_enabled boolean NOT NULL DEFAULT true,
  support_email text NOT NULL DEFAULT 'ops@kingdomdash.com',
  emergency_hotline text NOT NULL DEFAULT '+234 800 KINGDOM',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Seed default singleton row if not exists
INSERT INTO public.platform_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read platform settings (fees, hotline, support email)
DROP POLICY IF EXISTS "platform_settings_read_all" ON public.platform_settings;
CREATE POLICY "platform_settings_read_all"
  ON public.platform_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Admins and super_admins can modify platform settings
DROP POLICY IF EXISTS "platform_settings_update_admin" ON public.platform_settings;
CREATE POLICY "platform_settings_update_admin"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

-- ============================================================
-- Section 2: Expansion Waitlist Table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expansion_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  contact text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'launched')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expansion_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or guest) can join waitlist
DROP POLICY IF EXISTS "expansion_waitlist_insert_all" ON public.expansion_waitlist;
CREATE POLICY "expansion_waitlist_insert_all"
  ON public.expansion_waitlist
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- Admins can view and manage waitlist entries
DROP POLICY IF EXISTS "expansion_waitlist_admin_all" ON public.expansion_waitlist;
CREATE POLICY "expansion_waitlist_admin_all"
  ON public.expansion_waitlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_expansion_waitlist_city ON public.expansion_waitlist(city);
CREATE INDEX IF NOT EXISTS idx_expansion_waitlist_created ON public.expansion_waitlist(created_at DESC);

-- ============================================================
-- Section 3: Vendor Operational Settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendor_settings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  auto_accept_orders boolean NOT NULL DEFAULT true,
  prep_time_minutes integer NOT NULL DEFAULT 25 CHECK (prep_time_minutes >= 5 AND prep_time_minutes <= 180),
  open_time text NOT NULL DEFAULT '08:00',
  close_time text NOT NULL DEFAULT '21:00',
  open_weekends boolean NOT NULL DEFAULT true,
  sound_alerts boolean NOT NULL DEFAULT true,
  whatsapp_alerts boolean NOT NULL DEFAULT true,
  daily_summary_email boolean NOT NULL DEFAULT true,
  minimum_order_amount numeric(10,2) NOT NULL DEFAULT 1500.00 CHECK (minimum_order_amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_settings ENABLE ROW LEVEL SECURITY;

-- Vendors can read and update their own store settings
DROP POLICY IF EXISTS "vendor_settings_vendor_own" ON public.vendor_settings;
CREATE POLICY "vendor_settings_vendor_own"
  ON public.vendor_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_settings.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

-- Admins can read and manage all vendor settings
DROP POLICY IF EXISTS "vendor_settings_admin_all" ON public.vendor_settings;
CREATE POLICY "vendor_settings_admin_all"
  ON public.vendor_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

-- ============================================================
-- Section 4: Rider Device & Dispatch Preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rider_settings (
  rider_id uuid PRIMARY KEY REFERENCES public.riders(id) ON DELETE CASCADE,
  navigation_app text NOT NULL DEFAULT 'google_maps' CHECK (navigation_app IN ('google_maps', 'apple_maps', 'waze')),
  max_delivery_radius_km integer NOT NULL DEFAULT 15 CHECK (max_delivery_radius_km >= 1 AND max_delivery_radius_km <= 50),
  auto_accept_nearby boolean NOT NULL DEFAULT false,
  order_sound_alerts boolean NOT NULL DEFAULT true,
  vibration_alerts boolean NOT NULL DEFAULT true,
  keep_screen_awake boolean NOT NULL DEFAULT true,
  offline_trip_cache boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rider_settings ENABLE ROW LEVEL SECURITY;

-- Riders can read and update their own settings
DROP POLICY IF EXISTS "rider_settings_rider_own" ON public.rider_settings;
CREATE POLICY "rider_settings_rider_own"
  ON public.rider_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.riders r
      WHERE r.id = rider_settings.rider_id
        AND r.profile_id = auth.uid()
    )
  );

-- Admins can read and manage all rider settings
DROP POLICY IF EXISTS "rider_settings_admin_all" ON public.rider_settings;
CREATE POLICY "rider_settings_admin_all"
  ON public.rider_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

-- ============================================================
-- Section 5: Customer Delivery Preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivery_notes text NOT NULL DEFAULT 'Please ring bell and leave with security if unavailable.',
  preferred_delivery_type text NOT NULL DEFAULT 'doorstep' CHECK (preferred_delivery_type IN ('doorstep', 'pickup_point', 'building_security')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;

-- Customers can read and update their own delivery preferences
DROP POLICY IF EXISTS "customer_preferences_own" ON public.customer_preferences;
CREATE POLICY "customer_preferences_own"
  ON public.customer_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = profile_id);

-- Admins can view customer delivery preferences
DROP POLICY IF EXISTS "customer_preferences_admin_all" ON public.customer_preferences;
CREATE POLICY "customer_preferences_admin_all"
  ON public.customer_preferences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
        AND p.is_active = true
    )
  );

-- ============================================================
-- Section 6: RPC Endpoints & Triggers
-- ============================================================

-- Submit Expansion Waitlist RPC (Callable by public/anon)
CREATE OR REPLACE FUNCTION public.submit_expansion_waitlist(
  p_city text,
  p_contact text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_admin_id uuid;
BEGIN
  INSERT INTO public.expansion_waitlist (city, contact)
  VALUES (p_city, p_contact)
  RETURNING id INTO v_id;

  -- Notify admins of new expansion signup
  FOR v_admin_id IN
    SELECT id FROM public.profiles WHERE role IN ('admin', 'super_admin') AND is_active = true
  LOOP
    INSERT INTO public.notifications (
      profile_id,
      title,
      message,
      type,
      action_url,
      is_read
    ) VALUES (
      v_admin_id,
      'New Expansion Waitlist: ' || p_city,
      'Contact: ' || p_contact || ' requested KingdomDash expansion to ' || p_city || '.',
      'info',
      '/admin/dashboard',
      false
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_expansion_waitlist(text, text) TO anon, authenticated, service_role;

-- Update Platform Settings RPC (Admin only)
CREATE OR REPLACE FUNCTION public.update_platform_settings(
  p_commission_rate numeric,
  p_base_delivery_fee numeric,
  p_per_km_fee numeric,
  p_service_fee numeric,
  p_max_delivery_radius_km integer,
  p_maintenance_mode boolean,
  p_auto_dispatch_riders boolean,
  p_surge_pricing boolean,
  p_support_email text,
  p_emergency_hotline text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
      AND is_active = true
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied. Administrator privileges required.';
  END IF;

  INSERT INTO public.platform_settings (
    id,
    platform_commission_rate,
    base_delivery_fee_ngn,
    per_km_delivery_fee_ngn,
    service_fee_ngn,
    max_delivery_radius_km,
    maintenance_mode,
    auto_dispatch_riders,
    surge_pricing_enabled,
    support_email,
    emergency_hotline,
    updated_at,
    updated_by
  ) VALUES (
    'default',
    p_commission_rate,
    p_base_delivery_fee,
    p_per_km_fee,
    p_service_fee,
    p_max_delivery_radius_km,
    p_maintenance_mode,
    p_auto_dispatch_riders,
    p_surge_pricing,
    p_support_email,
    p_emergency_hotline,
    now(),
    auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    platform_commission_rate = EXCLUDED.platform_commission_rate,
    base_delivery_fee_ngn = EXCLUDED.base_delivery_fee_ngn,
    per_km_delivery_fee_ngn = EXCLUDED.per_km_delivery_fee_ngn,
    service_fee_ngn = EXCLUDED.service_fee_ngn,
    max_delivery_radius_km = EXCLUDED.max_delivery_radius_km,
    maintenance_mode = EXCLUDED.maintenance_mode,
    auto_dispatch_riders = EXCLUDED.auto_dispatch_riders,
    surge_pricing_enabled = EXCLUDED.surge_pricing_enabled,
    support_email = EXCLUDED.support_email,
    emergency_hotline = EXCLUDED.emergency_hotline,
    updated_at = now(),
    updated_by = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_platform_settings(numeric, numeric, numeric, numeric, integer, boolean, boolean, boolean, text, text) TO authenticated, service_role;
