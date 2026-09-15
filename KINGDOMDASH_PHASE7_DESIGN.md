# KINGDOMDASH — PHASE 7: MAPS & LOCATION SERVICES
## Technical Design & Architecture Specification (Reconciled)

**Document Version:** 1.1.0 (Reconciled)  
**Phase:** 7 (Maps & Location Services)  
**Platform:** KingdomDash  
**Author:** Antigravity  
**Status:** Reconciled — Ready for Planning Gate Verification  

---

## 1. Architectural Architecture & Decisions

### 1.1 Geographic Storage Decision: PostGIS vs. Structured Coordinate Types

**Decision: Defer PostGIS; Implement Structured Numeric Coordinates with Composite B-Tree Indexes for Phase 7.**

**Detailed Architectural Rationale:**
1. **Current Query Patterns**:
   - In Phase 7 and Phase 8, geographic operations are strictly:
     - Point-to-point geodesic distance between vendor pickup and customer delivery door.
     - Service-area boundary containment checks for a single delivery point.
     - Reading and writing customer/vendor coordinates.
2. **PostGIS Complexity & Portability**:
   - Enabling PostGIS requires extension deployment (`CREATE EXTENSION postgis WITH SCHEMA extensions`), which introduces environment dependencies and privileges.
   - Standard Supabase PostGIS `geometry` / `geography` columns serialize as binary Well-Known Binary (WKB) hex strings when queried via PostgREST/Supabase-JS (e.g. `0101000020E6100000...`). Consuming these on the frontend requires heavy parsing libraries (like `wkt-parser` or `wellknown`), adding runtime overhead and typing friction.
   - Storing `latitude numeric(10, 7)` and `longitude numeric(10, 7)` provides clean, standard decimal numbers directly serializable into TypeScript `{ latitude, longitude }` objects without binary transformation.
3. **Index Strategy**:
   - Composite B-tree indexes `(latitude, longitude)` provide fast bounding-box lookups (`WHERE latitude BETWEEN :minLat AND :maxLat AND longitude BETWEEN :minLon AND :maxLon`).
   - *Clarification on Index Types*: B-tree composite indexes are standard range-based indexes; they are **NOT** multi-dimensional R-tree/GiST spatial indexes. For Phase 7 workloads (low-to-medium cardinality single-city lookups), B-tree indexes provide microsecond retrieval without PostGIS overhead.
4. **Future PostGIS Upgrade Path (Phase 10 Dispatch)**:
   - When real-time rider telematics and nearest-rider KNN queries are built in Phase 10, a generated column can be added surgically without altering the application-facing numeric columns:
     ```sql
     ALTER TABLE public.riders ADD COLUMN location geography(Point, 4326)
       GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED;
     CREATE INDEX idx_riders_spatial ON public.riders USING GIST (location);
     ```

---

### 1.2 Service-Area Model: Hybrid (Center+Radius with Polygon Support)

**Decision: Implement a Hybrid Service-Area Model supporting both circular radius and GeoJSON boundary polygons.**

**Model Structure:**
1. `public.service_areas` maintains:
   - `center_lat numeric(10, 7)`: Reference centroid.
   - `center_lon numeric(10, 7)`: Reference centroid.
   - `radius_km numeric(6, 2)`: Standard circular radius threshold.
   - `coverage_polygon jsonb`: Optional GeoJSON `Polygon` / `MultiPolygon` defining non-circular geographic perimeters.
2. **Containment Logic**:
   - If `coverage_polygon` is defined, point-in-polygon ray casting takes precedence.
   - If `coverage_polygon` is null, radial distance from `(center_lat, center_lon) <= radius_km` acts as the definitive boundary.
3. **Expansion Architecture**:
   - Permits future expansion across Ogun State (Sagamu, Abeokuta, Ijebu-Igbo) by adding new `service_areas` rows without modifying code or schema.

---

### 1.3 Ijebu-Ode Launch Zone Status

**Classification: Configurable Launch Seed Data Requiring Business Confirmation.**

The initial values proposed for Migration 017:
- Area Name: `Ijebu-Ode Central`
- Centroid: `(6.8205560, 3.9208330)` [Approx. Awujale/Town Center]
- Radius: `12.50 km`
- Status: `is_active = true`

*Crucial Invariant*: These values are seeded as initial operational defaults for development and testing. The application architecture and containment functions are strictly data-driven; any adjustment made by business stakeholders in the database takes effect instantly without code deployment.

---

## 2. Database Schema & Migration 017 Specification

### 2.1 Schema Extensions

```sql
-- Migration: 20260902000017_maps_location_services.sql
-- Phase 7: Additive location capabilities

-- 1. Extend addresses
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7) CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7) CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  ADD COLUMN IF NOT EXISTS service_area_id uuid REFERENCES public.service_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_addresses_coords ON public.addresses(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_addresses_service_area ON public.addresses(service_area_id);

-- 2. Extend vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7) CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0)),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7) CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0)),
  ADD COLUMN IF NOT EXISTS service_area_id uuid REFERENCES public.service_areas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_coords ON public.vendors(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vendors_service_area ON public.vendors(service_area_id);

-- 3. Extend service_areas
ALTER TABLE public.service_areas
  ADD COLUMN IF NOT EXISTS center_lat numeric(10, 7) CHECK (center_lat IS NULL OR (center_lat >= -90.0 AND center_lat <= 90.0)),
  ADD COLUMN IF NOT EXISTS center_lon numeric(10, 7) CHECK (center_lon IS NULL OR (center_lon >= -180.0 AND center_lon <= 180.0)),
  ADD COLUMN IF NOT EXISTS radius_km numeric(6, 2) CHECK (radius_km IS NULL OR radius_km > 0);

-- Seed initial Ijebu-Ode launch zone (Configurable seed data)
INSERT INTO public.service_areas (name, description, center_lat, center_lon, radius_km, is_active)
VALUES (
  'Ijebu-Ode Central',
  'Primary launch zone covering Ijebu-Ode metropolis (Awujale, Folagbade, Degun, Oke-Aje, Molipa, Igbeba)',
  6.8205560,
  3.9208330,
  12.50,
  true
)
ON CONFLICT (name) DO UPDATE SET
  center_lat = EXCLUDED.center_lat,
  center_lon = EXCLUDED.center_lon,
  radius_km = EXCLUDED.radius_km,
  is_active = EXCLUDED.is_active;
```

---

### 2.2 Database Function Security Specifications

#### Function 1: `public.calculate_distance_km`
* **Purpose**: Computes straight-line/geodesic distance between two WGS84 coordinate pairs.
* **Signature**: `calculate_distance_km(p_lat1 numeric, p_lon1 numeric, p_lat2 numeric, p_lon2 numeric) RETURNS numeric(10, 3)`
* **Semantics**: **Straight-line / Geodesic Distance** using the Haversine formula on a spherical earth of radius 6,371.009 km. Returns distance in kilometers with 1-meter precision (3 decimals).
* **Security Model**:
  - `SECURITY INVOKER` (Touches no tables, operates purely on input arguments).
  - `IMMUTABLE`, `PARALLEL SAFE`.
  - `SET search_path = public`.
  - Grants: `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated, anon;`.

```sql
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  p_lat1 numeric,
  p_lon1 numeric,
  p_lat2 numeric,
  p_lon2 numeric
)
RETURNS numeric(10, 3)
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_r constant numeric := 6371.009;
  v_dlat numeric;
  v_dlon numeric;
  v_a numeric;
  v_c numeric;
  v_lat1_rad numeric;
  v_lat2_rad numeric;
  v_dist numeric;
BEGIN
  IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_lat1 < -90.0 OR p_lat1 > 90.0 OR p_lat2 < -90.0 OR p_lat2 > 90.0 THEN
    RAISE EXCEPTION 'Latitude out of range [-90, 90]: %, %', p_lat1, p_lat2;
  END IF;
  IF p_lon1 < -180.0 OR p_lon1 > 180.0 OR p_lon2 < -180.0 OR p_lon2 > 180.0 THEN
    RAISE EXCEPTION 'Longitude out of range [-180, 180]: %, %', p_lon1, p_lon2;
  END IF;

  IF p_lat1 = p_lat2 AND p_lon1 = p_lon2 THEN
    RETURN 0.000;
  END IF;

  v_lat1_rad := radians(p_lat1);
  v_lat2_rad := radians(p_lat2);
  v_dlat := radians(p_lat2 - p_lat1);
  v_dlon := radians(p_lon2 - p_lon1);

  v_a := sin(v_dlat / 2.0)^2 + cos(v_lat1_rad) * cos(v_lat2_rad) * sin(v_dlon / 2.0)^2;
  v_c := 2.0 * atan2(sqrt(v_a), sqrt(1.0 - v_a));
  v_dist := v_r * v_c;

  RETURN round(v_dist, 3);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_distance_km(numeric, numeric, numeric, numeric) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.calculate_distance_km(numeric, numeric, numeric, numeric) TO authenticated, anon;
```

#### Function 2: `public.is_location_in_service_area`
* **Purpose**: Checks if a location point falls within an active service area.
* **Signature**: `is_location_in_service_area(p_lat numeric, p_lon numeric, p_service_area_id uuid DEFAULT NULL) RETURNS boolean`
* **Security Model**:
  - `SECURITY INVOKER` (Reads `public.service_areas` which has `service_areas_select_active_public` policy allowing public select).
  - `STABLE`, `PARALLEL SAFE`.
  - `SET search_path = public`.
  - Grants: `REVOKE EXECUTE ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated, anon;`.

```sql
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

  IF p_service_area_id IS NOT NULL THEN
    SELECT id, center_lat, center_lon, radius_km, is_active
    INTO v_area
    FROM public.service_areas
    WHERE id = p_service_area_id AND is_active = true;

    IF NOT FOUND OR v_area.center_lat IS NULL OR v_area.center_lon IS NULL THEN
      RETURN false;
    END IF;

    v_dist := public.calculate_distance_km(p_lat, p_lon, v_area.center_lat, v_area.center_lon);
    RETURN v_dist <= v_area.radius_km;
  ELSE
    FOR v_area IN
      SELECT id, center_lat, center_lon, radius_km
      FROM public.service_areas
      WHERE is_active = true AND center_lat IS NOT NULL AND center_lon IS NOT NULL
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

REVOKE EXECUTE ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_location_in_service_area(numeric, numeric, uuid) TO authenticated, anon;
```

---

## 3. Geocoding Provider Architecture

### 3.1 Provider Contract
```ts
export interface Coordinates {
  latitude: number
  longitude: number
}

export interface GeocodeResult {
  coordinates: Coordinates
  formattedAddress: string
  streetName?: string
  neighborhood?: string
  city: string
  state: string
  country: string
  confidence?: number
  provider: string
}

export interface GeocodeOptions {
  limit?: number
  bounded?: boolean
  countryCode?: string
  signal?: AbortSignal
}

export interface GeocodingProvider {
  name: string
  forwardGeocode(query: string, options?: GeocodeOptions): Promise<GeocodeResult[]>
  reverseGeocode(coords: Coordinates, options?: GeocodeOptions): Promise<GeocodeResult | null>
}
```

### 3.2 Resiliency & Operational Behavior
1. **Throttling & Debounce**: Input keystrokes debounced by 400ms.
2. **Timeout**: 8,000ms timeout enforced via `AbortSignal`.
3. **Rate-Limit Handling**: Backoff with exponential delay on HTTP 429.
4. **No-Result Handling**: Returns empty array `[]` cleanly without throwing unhandled exceptions.
5. **Provider Failure / Outage**: Returns typed error object with friendly recovery prompt for the user to place pin manually.
6. **Provider Replacement**: Application code consumes `locationService.forwardGeocode()`; swapping to Google Maps or Radar only requires adding a provider class without touching React components.

---

## 4. End-to-End Serviceability & Address Flow

```text
[1. User enters address text]
             ↓
[2. Debounced Geocoding lookup]
             ↓
[3. User selects candidate match]
             ↓
[4. Map renders pin; user adjusts pin to doorstep]
             ↓
[5. Coordinate validation: [-90, 90], [-180, 180]]
             ↓
[6. Service-Area validation: is_location_in_service_area]
   ├── If Outside: Warning banner; prompt for serviceable address
   └── If Inside: Address saved with coordinates and service_area_id
             ↓
[7. Checkout Review consumes validated address]
```

---

## 5. Security & Isolation Matrix

| Layer | Protected Resource | Enforcement Mechanism | Failure Outcome |
| :--- | :--- | :--- | :--- |
| **Customer Addresses** | `addresses.latitude/longitude` | PostgreSQL RLS (`addresses_all_own`) | Denied (403 / 0 rows affected) |
| **Vendor Locations** | `vendors.latitude/longitude` | PostgreSQL RLS (`vendors_update_own`) | Denied (403 / 0 rows affected) |
| **Vendor Immutables** | Vendor rating, approval, profile_id | DB Trigger `protect_vendor_immutable_fields` | SQL Exception (aborts transaction) |
| **Distance Computation** | Authoritative order distance | Server RPC `calculate_distance_km` | Client calculations ignored by backend |
| **Service Area Read** | Active zones | `service_areas_select_active_public` | Non-active zones hidden from public |
| **Service Area Write** | Service area modifications | `service_areas_all_admin` | Denied for non-admin roles |

---

## 6. Phase 8 Hand-Off Contract

Phase 7 establishes the exact inputs required by the Phase 8 delivery pricing engine:
1. Validated vendor pickup coordinates `{ latitude, longitude }`.
2. Validated customer delivery coordinates `{ latitude, longitude }`.
3. Verified service area validity boolean.
4. Authoritative straight-line geodesic distance in kilometers via `calculate_distance_km`.
5. Phase 8 owns the delivery pricing formula and rate calculation. In Phase 7, the delivery fee display remains explicitly **₦0.00 (Launch Preview)**.
