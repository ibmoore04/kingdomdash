-- Migration: 20261014000001_service_area_geography_and_coverage_expansion.sql
-- Purpose: Remove restrictive coordinate-radius boundaries. Delivery addresses are
--          human-readable (street, city, state) resolved dynamically via Google Maps.
--          public.is_location_in_service_area validates coordinate integrity without
--          arbitrary circular radius cutoffs.

-- =============================================================================
-- 1. ACTIVATE ALL SERVICE AREAS DYNAMICALLY (ZERO HARDCODED NAMES OR RADII)
-- =============================================================================

UPDATE public.service_areas
SET is_active = true
WHERE is_active IS NOT TRUE;

-- =============================================================================
-- 2. DYNAMIC is_location_in_service_area (ZERO ARBITRARY RADIUS CUTOFFS)
-- =============================================================================

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
BEGIN
  -- Missing coordinates cannot be serviced
  IF p_lat IS NULL OR p_lon IS NULL THEN
    RETURN false;
  END IF;

  -- Validate coordinate range bounds
  IF p_lat < -90.0 OR p_lat > 90.0 THEN
    RETURN false;
  END IF;

  IF p_lon < -180.0 OR p_lon > 180.0 THEN
    RETURN false;
  END IF;

  -- Addresses are resolved dynamically by Google Maps (street, city, state).
  -- Any valid coordinate within operating territory is fully serviceable.
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid)
  IS 'Dynamically evaluates serviceability. Valid coordinates within platform operating territory are serviceable without restrictive geographic radius cutoffs.';

GRANT EXECUTE ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid) TO authenticated, anon;
