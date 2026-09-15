-- Migration: 20260902000017_maps_location_services.sql
-- Phase 7: Maps & Location Services Foundation
-- Extends service_areas with circular boundary definition
-- Extends addresses and vendors with coordinate storage & service area references
-- Implements authoritative distance and serviceability calculation functions
-- Security: SECURITY INVOKER, strict input validation, zero client financial/distance authority

-- =============================================================================
-- 1. EXTEND public.service_areas
-- =============================================================================
ALTER TABLE public.service_areas
  ADD COLUMN IF NOT EXISTS center_lat numeric(10,7),
  ADD COLUMN IF NOT EXISTS center_lon numeric(10,7),
  ADD COLUMN IF NOT EXISTS radius_km numeric(8,2);

-- Coordinate validation constraint for service_areas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_areas_lat'
  ) THEN
    ALTER TABLE public.service_areas
      ADD CONSTRAINT chk_service_areas_lat
      CHECK (center_lat IS NULL OR (center_lat >= -90.0 AND center_lat <= 90.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_areas_lon'
  ) THEN
    ALTER TABLE public.service_areas
      ADD CONSTRAINT chk_service_areas_lon
      CHECK (center_lon IS NULL OR (center_lon >= -180.0 AND center_lon <= 180.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_areas_radius'
  ) THEN
    ALTER TABLE public.service_areas
      ADD CONSTRAINT chk_service_areas_radius
      CHECK (radius_km IS NULL OR radius_km > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_areas_center_pair'
  ) THEN
    ALTER TABLE public.service_areas
      ADD CONSTRAINT chk_service_areas_center_pair
      CHECK (
        (center_lat IS NULL AND center_lon IS NULL AND radius_km IS NULL) OR
        (center_lat IS NOT NULL AND center_lon IS NOT NULL AND radius_km IS NOT NULL)
      );
  END IF;
END $$;

-- Seed / Upsert Launch Market: Ijebu-Ode Central (Configurable seed data)
INSERT INTO public.service_areas (name, description, center_lat, center_lon, radius_km, is_active)
VALUES (
  'Ijebu-Ode Central',
  'Ijebu-Ode central delivery zone covering key municipal districts',
  6.820556,
  3.920833,
  12.50,
  true
)
ON CONFLICT (name) DO UPDATE SET
  center_lat = EXCLUDED.center_lat,
  center_lon = EXCLUDED.center_lon,
  radius_km = EXCLUDED.radius_km,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;

-- =============================================================================
-- 2. EXTEND public.addresses
-- =============================================================================
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS service_area_id uuid REFERENCES public.service_areas(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_addresses_latitude'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT chk_addresses_latitude
      CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_addresses_longitude'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT chk_addresses_longitude
      CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_addresses_coord_pair'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT chk_addresses_coord_pair
      CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL)
      );
  END IF;
END $$;

-- Indexes on addresses
CREATE INDEX IF NOT EXISTS idx_addresses_lat_lon
  ON public.addresses(latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_service_area_id
  ON public.addresses(service_area_id);

-- =============================================================================
-- 3. EXTEND public.vendors
-- =============================================================================
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS service_area_id uuid REFERENCES public.service_areas(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vendors_latitude'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT chk_vendors_latitude
      CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vendors_longitude'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT chk_vendors_longitude
      CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vendors_coord_pair'
  ) THEN
    ALTER TABLE public.vendors
      ADD CONSTRAINT chk_vendors_coord_pair
      CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL)
      );
  END IF;
END $$;

-- Indexes on vendors
CREATE INDEX IF NOT EXISTS idx_vendors_lat_lon
  ON public.vendors(latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_service_area_id
  ON public.vendors(service_area_id);

-- =============================================================================
-- 4. AUTHORITATIVE GEOGRAPHIC FUNCTIONS
-- =============================================================================

-- calculate_distance_km: Straight-line (Haversine) distance calculation
-- Earth radius: 6371.009 km (WGS84 mean spherical radius)
-- IMMUTABLE, STRICT, PARALLEL SAFE, SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 numeric,
  lon1 numeric,
  lat2 numeric,
  lon2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r_lat1 double precision;
  r_lat2 double precision;
  dlat double precision;
  dlon double precision;
  a double precision;
  c double precision;
  dist double precision;
BEGIN
  -- Input range validation
  IF lat1 < -90.0 OR lat1 > 90.0 OR lat2 < -90.0 OR lat2 > 90.0 THEN
    RAISE EXCEPTION 'Latitude out of bounds [-90, 90]: %, %', lat1, lat2;
  END IF;

  IF lon1 < -180.0 OR lon1 > 180.0 OR lon2 < -180.0 OR lon2 > 180.0 THEN
    RAISE EXCEPTION 'Longitude out of bounds [-180, 180]: %, %', lon1, lon2;
  END IF;

  -- Identical points return 0 immediately
  IF lat1 = lat2 AND lon1 = lon2 THEN
    RETURN 0.000;
  END IF;

  r_lat1 := radians(lat1::double precision);
  r_lat2 := radians(lat2::double precision);
  dlat := radians((lat2 - lat1)::double precision);
  dlon := radians((lon2 - lon1)::double precision);

  a := (sin(dlat / 2.0) * sin(dlat / 2.0)) +
       cos(r_lat1) * cos(r_lat2) * (sin(dlon / 2.0) * sin(dlon / 2.0));

  -- Guard against numerical overflow exceeding 1.0 due to float rounding
  IF a > 1.0 THEN
    a := 1.0;
  END IF;

  c := 2.0 * atan2(sqrt(a), sqrt(greatest(0.0::double precision, 1.0::double precision - a)));
  dist := 6371.009 * c;

  -- Return rounded to 3 decimal places (meter precision)
  RETURN round(dist::numeric, 3);
END;
$$;

COMMENT ON FUNCTION public.calculate_distance_km(numeric, numeric, numeric, numeric)
  IS 'Computes geodesic straight-line distance in kilometers using the Haversine formula (WGS84 sphere R=6371.009km).';

-- is_location_in_service_area: Checks whether a coordinate point falls inside an active service area
-- If p_service_area_id is provided, checks that specific area.
-- If p_service_area_id is NULL, checks if point falls within ANY active service area.
-- STABLE, PARALLEL SAFE, SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.is_location_in_service_area(
  p_lat numeric,
  p_lon numeric,
  p_service_area_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_area record;
  v_dist numeric;
BEGIN
  IF p_lat IS NULL OR p_lon IS NULL THEN
    RETURN false;
  END IF;

  -- Input range validation
  IF p_lat < -90.0 OR p_lat > 90.0 THEN
    RAISE EXCEPTION 'Latitude out of bounds [-90, 90]: %', p_lat;
  END IF;

  IF p_lon < -180.0 OR p_lon > 180.0 THEN
    RAISE EXCEPTION 'Longitude out of bounds [-180, 180]: %', p_lon;
  END IF;

  IF p_service_area_id IS NOT NULL THEN
    SELECT id, center_lat, center_lon, radius_km, is_active
    INTO v_area
    FROM public.service_areas
    WHERE id = p_service_area_id AND is_active = true;

    IF NOT FOUND OR v_area.center_lat IS NULL OR v_area.center_lon IS NULL OR v_area.radius_km IS NULL THEN
      RETURN false;
    END IF;

    v_dist := public.calculate_distance_km(p_lat, p_lon, v_area.center_lat, v_area.center_lon);
    RETURN v_dist <= v_area.radius_km;
  ELSE
    FOR v_area IN
      SELECT id, center_lat, center_lon, radius_km
      FROM public.service_areas
      WHERE is_active = true
        AND center_lat IS NOT NULL
        AND center_lon IS NOT NULL
        AND radius_km IS NOT NULL
    LOOP
      v_dist := public.calculate_distance_km(p_lat, p_lon, v_area.center_lat, v_area.center_lon);
      IF v_dist <= v_area.radius_km THEN
        RETURN true;
      END IF;
    END LOOP;

    RETURN false;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid)
  IS 'Evaluates whether a given latitude/longitude coordinate falls within an active service area boundary.';

-- =============================================================================
-- 5. FUNCTION PERMISSIONS
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.calculate_distance_km(numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_distance_km(numeric, numeric, numeric, numeric) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid) TO authenticated, anon;
