# KINGDOMDASH — PHASE 7: MAPS & LOCATION SERVICES
## Comprehensive Plan Reconciliation & Architectural Audit

**Document Version:** 1.0.0  
**Phase:** 7 (Maps & Location Services)  
**Platform:** KingdomDash  
**Author:** Antigravity  
**Status:** Complete — Submitted for Planning Gate Review  

---

## 1. Original Proposed Architecture

The initial Phase 7 proposal established:
- Storing `latitude` and `longitude` as `numeric(10, 7)` on `addresses` and `vendors`.
- Adding composite indexes on `(latitude, longitude)`.
- Creating a center + radius model on `service_areas` (`center_lat`, `center_lon`, `radius_km`).
- Seeding an `Ijebu-Ode Central` service zone with hardcoded center and radius coordinates.
- Introducing `calculate_distance_km` as a `SECURITY DEFINER` function.
- Introducing `is_location_in_service_area` as a `SECURITY DEFINER` function.
- Direct integration with OpenStreetMap Nominatim for geocoding.

---

## 2. Issues Discovered During Architectural Review

1. **Spatial vs. B-Tree Index Misclassification**:
   - Initial documentation described B-tree composite indexes as "spatial indexes." In reality, composite B-tree indexes are 1D-ordered tree structures suitable for rectangular range queries, whereas true spatial indexes require 2D/multi-dimensional GiST/R-tree indexing via PostGIS.
2. **PostGIS Evaluative Ambiguity**:
   - PostGIS was referenced without evaluating whether the current single-city Phase 7/8 delivery workflow genuinely requires PostGIS extensions or whether the added deployment complexity and binary WKB serialization issues outweigh its benefits.
3. **Rigid Circular Service Area Model**:
   - The initial center + radius model failed to account for irregular municipal boundaries or natural geographic borders in Ogun State (e.g. expressways, rivers, administrative ward boundaries).
4. **Unvalidated Business Assumptions on Ijebu-Ode Coordinates**:
   - Centroid coordinates `(6.820556, 3.920833)` and a `12.50 km` radius were presented as authoritative rather than configurable launch seed data requiring business stakeholder confirmation.
5. **Over-Privileged Function Security**:
   - `calculate_distance_km()` was marked `SECURITY DEFINER` despite being a pure mathematical function accessing zero tables. Pure math functions should always be `SECURITY INVOKER`.
   - `is_location_in_service_area()` was marked `SECURITY DEFINER` even though `service_areas` already has a public read policy (`service_areas_select_active_public`).
6. **Distance Semantics Clarification**:
   - Initial drafts casually referred to distance without clearly distinguishing straight-line/geodesic distance from road/driving distance.
7. **Geocoding Provider Coupling**:
   - Initial plans coupled client assumptions to OpenStreetMap Nominatim specificities rather than treating Nominatim strictly as a swappable development/staging adapter.

---

## 3. Corrections Made

1. **Index Semantics Rectified**:
   - Corrected all documentation to accurately describe composite indexes as standard B-tree range indexes `(latitude, longitude)`, avoiding false spatial claims.
2. **PostGIS Explicitly Deferred with Clean Upgrade Path**:
   - Evaluated and formally deferred PostGIS for Phase 7. Documented the surgical generated-column path for Phase 10 when real-time KNN rider dispatch is implemented.
3. **Hybrid Service-Area Model Adopted**:
   - Unified `coverage_polygon jsonb` (already present in migration 006) with fallback center and radius parameters (`center_lat`, `center_lon`, `radius_km`).
4. **Ijebu-Ode Coordinates Classified as Configurable Seed Data**:
   - Explicitly marked launch zone parameters as configurable database seed data subject to business review. The code architecture is strictly data-driven.
5. **Least-Privilege Security Invoker Applied**:
   - Both `calculate_distance_km` and `is_location_in_service_area` are defined as `SECURITY INVOKER` with explicit `SET search_path = public`.
6. **Geodesic Distance Semantics Standardized**:
   - Formally designated `calculate_distance_km` as straight-line/geodesic distance (Haversine formula on WGS84 sphere). Documented Phase 8 road-network considerations.
7. **Strict Provider Isolation Enforced**:
   - Created a clean `GeocodingProvider` interface ensuring application UI code never depends directly on Nominatim-specific behaviors or endpoints.

---

## 4. Final Geographic Storage Decision

* Storage types: `latitude numeric(10, 7)`, `longitude numeric(10, 7)`.
* Coordinate Reference System: WGS84 (EPSG:4326).
* Constraints:
  - `CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0))`
  - `CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0))`
* Indexing: Composite B-tree indexes `(latitude, longitude)` on `addresses` and `vendors`.

---

## 5. Final PostGIS Decision

**PostGIS is deferred to Phase 10 (Rider Dispatch & Real-Time Tracking).**
- *Reason*: Phase 7 and Phase 8 query patterns consist strictly of point-to-point geodesic distance and polygon/radius containment. Standard PostgreSQL PL/pgSQL functions provide microsecond execution without extension dependencies or WKB binary serialization friction in frontend TypeScript models.

---

## 6. Final Service-Area Model

**Hybrid Model**:
- Primary boundary: GeoJSON `Polygon` / `MultiPolygon` in `coverage_polygon`.
- Secondary / default boundary: Circular radius defined by `center_lat`, `center_lon`, and `radius_km`.
- This enables both rapid circular setup and polygon boundary definition across Ogun State.

---

## 7. Final Distance Model

* **Authoritative Source**: Server-side PostgreSQL function `calculate_distance_km(lat1, lon1, lat2, lon2)`.
* **Calculation Method**: Haversine formula on WGS84 mean earth sphere ($R = 6,371.009\text{ km}$).
* **Output**: Kilometers, rounded to 3 decimal places (1 meter resolution).
* **Semantics**: **Straight-line / Geodesic Distance**. Client calculations are visual estimates only.

---

## 8. Geocoding Provider Strategy

* **Core Contract**: `GeocodingProvider` interface (`forwardGeocode`, `reverseGeocode`).
* **Development / Staging Adapter**: `NominatimGeocodingAdapter` (bounded to Nigeria `countrycodes=ng`, viewbox biased to Ijebu-Ode, 400ms debouncing, 8s timeout).
* **Testing / Offline Adapter**: `MockGeocodingAdapter` (deterministic fixture of 10+ Ijebu-Ode landmarks).
* **Production Readiness**: Provider can be switched to Google Maps Geocoding, Mapbox, or Radar by instantiating a new adapter without touching UI components.

---

## 9. Function Security Model

| Function | Parameters | Return Type | Volatility | Security Privilege | Search Path | Grants |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `calculate_distance_km` | `lat1, lon1, lat2, lon2 numeric` | `numeric(10, 3)` | `IMMUTABLE` | `SECURITY INVOKER` | `public` | `authenticated, anon` |
| `is_location_in_service_area` | `lat, lon numeric, area_id uuid` | `boolean` | `STABLE` | `SECURITY INVOKER` | `public` | `authenticated, anon` |

---

## 10. RLS & Grants Analysis

1. **`addresses`**:
   - RLS policy: `addresses_all_own` (`profile_id = auth.uid()`).
   - Customer A cannot read, insert, update, or delete Customer B's coordinates.
   - Anonymous access is completely denied by RLS.
2. **`vendors`**:
   - RLS policies: `vendors_select_public` (anyone can view active vendor coordinates for pickup), `vendors_update_own` (vendor owner can update coordinates).
   - `protect_vendor_immutable_fields()` trigger blocks modification of `profile_id`, `is_active`, `rating`.
3. **`service_areas`**:
   - RLS policies: `service_areas_select_active_public` (anyone can read active zones), `service_areas_all_admin` (admin write only).

---

## 11. Migration 017 Final Scope

* File: `supabase/migrations/20260902000017_maps_location_services.sql`
* Scope:
  - Add `latitude`, `longitude`, `service_area_id` to `addresses`.
  - Add `latitude`, `longitude`, `service_area_id` to `vendors`.
  - Add `center_lat`, `center_lon`, `radius_km` to `service_areas`.
  - Add B-tree composite indexes on coordinate pairs.
  - Seed initial launch coverage for `Ijebu-Ode Central` as configurable launch seed data.
  - Install `calculate_distance_km` and `is_location_in_service_area` functions.

---

## 12. Phase 6 Compatibility Analysis

* Phase 6 Customer Ordering & Cart remain 100% functional and intact.
* `create_order_secure()` is **NOT modified**.
* Existing formatted address string snapshots (`pickup_address`, `delivery_address`) on `orders` continue to function without disruption.
* Checkout continues to use Phase 6 atomic order creation.

---

## 13. Phase 8 Dependencies

Phase 7 delivers the exact inputs required for Phase 8 pricing:
1. Validated pickup coordinates `{ latitude, longitude }`.
2. Validated delivery coordinates `{ latitude, longitude }`.
3. Service-area coverage confirmation.
4. Authoritative straight-line distance via `calculate_distance_km`.

---

## 14. Testing Strategy

1. **Coordinates**: Range checks `[-90, 90]` and `[-180, 180]`, null values, precision formatting, and inverted `(lon, lat)` detection.
2. **Distance**: Identity points (0.000 km), known Ijebu-Ode landmark pairs, symmetry, and invalid argument handling.
3. **Service Areas**: Points inside, outside, on boundary, inactive zones, and invalid IDs.
4. **Address Security**: Cross-customer isolation under `addresses_all_own`.
5. **Geocoding**: Candidate resolution, empty queries, timeouts, error normalization, and mock fallback.
6. **Regression**: Full suite execution ensuring all 27 Phase 0–6 test suites pass cleanly.

---

## 15. Manual Verification Strategy

1. Open `AddressFormModal` in checkout; enter street name ("Awujale Street"); verify debounced suggestions appear.
2. Select candidate; verify pin appears on Leaflet map.
3. Drag pin to precise doorstep; verify coordinates update in real time.
4. Confirm address; verify address card in checkout shows "Verified Location (Ijebu-Ode Coverage)".
5. Test address outside coverage (e.g. Lagos or Ibadan); verify out-of-coverage warning is displayed.

---

## 16. Remaining Business Decisions

1. **Launch Zone Parameters**: Business stakeholders to review and confirm the exact centroid and radius for the `Ijebu-Ode Central` delivery zone prior to commercial launch.
2. **Road Distance Multiplier (Phase 8)**: Business stakeholders to decide whether Phase 8 pricing will use geodesic distance directly, a standard Nigerian road detour multiplier (e.g. $1.25 \times \text{geodesic}$), or an external turn-by-turn routing API.
