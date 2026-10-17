-- ============================================================================
-- Migration: 20261017000001_fix_rider_inbox_dedup_and_address.sql
-- Description: Fix rider assignment inbox duplication and delivery address presentation
-- 1. Deduplicates pending offers per order/delivery using DISTINCT ON
-- 2. Correctly strips customer phone/name prefix from delivery_address to expose the actual destination street/area
-- 3. Falls back to vendor business_address for pickup location
-- 4. Uses authoritative order distance_km when coordinates are default (prevents 0.0 km)
-- ============================================================================

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
    jsonb_agg(sub.offer),
    '[]'::jsonb
  ) INTO v_inbox
  FROM (
    SELECT DISTINCT ON (COALESCE(d.order_id, d.id))
      jsonb_build_object(
        'assignment_id', da.id,
        'delivery_id', d.id,
        'order_id', d.order_id,
        'service_type', d.service_type,
        'pickup_address', COALESCE(
          NULLIF(v.business_address, ''),
          NULLIF(d.pickup_address, ''),
          'Ijebu-Ode, Ogun State'
        ),
        'pickup_latitude', COALESCE(d.pickup_latitude, v.latitude),
        'pickup_longitude', COALESCE(d.pickup_longitude, v.longitude),
        'delivery_area', CASE
          WHEN d.delivery_address ~* '^[^,(]+\([^)]+\),\s*' THEN
            regexp_replace(d.delivery_address, '^[^,(]+\([^)]+\),\s*', '')
          ELSE
            COALESCE(NULLIF(d.delivery_address, ''), 'Ijebu-Ode Delivery Zone, Ogun State')
        END,
        'delivery_address', d.delivery_address,
        'estimated_distance_km', GREATEST(
          COALESCE(
            o.distance_km,
            public.calculate_distance_km(
              COALESCE(d.pickup_latitude, v.latitude, 6.8227),
              COALESCE(d.pickup_longitude, v.longitude, 3.9213),
              COALESCE(d.delivery_latitude, 6.8227),
              COALESCE(d.delivery_longitude, 3.9213)
            )
          ),
          1.2
        ),
        'vendor_name', COALESCE(v.business_name, 'Courier Dispatch'),
        'special_instructions_preview', CASE 
          WHEN d.special_instructions IS NOT NULL THEN 'Special instructions provided'
          ELSE NULL 
        END,
        'status', da.status,
        'assigned_at', da.assigned_at
      ) AS offer,
      da.assigned_at
    FROM public.delivery_assignments da
    JOIN public.deliveries d ON d.id = da.delivery_id
    LEFT JOIN public.orders o ON o.id = d.order_id
    LEFT JOIN public.vendors v ON v.id = d.vendor_id
    WHERE da.rider_id = v_rider_id
      AND da.status = 'assigned'
      AND d.status = 'assigned'
    ORDER BY COALESCE(d.order_id, d.id), da.assigned_at DESC
  ) sub;

  RETURN v_inbox;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rider_assignment_inbox() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_rider_assignment_inbox() TO authenticated, service_role;
