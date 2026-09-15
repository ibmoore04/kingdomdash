# KINGDOMDASH — PHASE 7: MAPS & LOCATION SERVICES
## Comprehensive Requirements Specification (Reconciled)

**Document Version:** 1.1.0 (Reconciled)  
**Phase:** 7 (Maps & Location Services)  
**Platform:** KingdomDash  
**Tagline:** SWIFT IN MOTION.  
**Launch Market:** Ijebu-Ode, Ogun State, Nigeria  
**Author:** Antigravity  
**Status:** Reconciled — Ready for Planning Gate Verification  

---

## 1. Executive Summary & Objective

Phase 7 establishes the geographic foundation for KingdomDash in its initial launch market of Ijebu-Ode, Ogun State. It introduces:
1. First-class latitude and longitude storage on customer delivery addresses and vendor locations.
2. An abstracted geocoding provider layer isolating third-party services from application code.
3. Interactive, accessible, mobile-responsive map components for location confirmation and pin placement.
4. Database-backed service area containment validation.
5. Authoritative server-side geodesic distance calculation infrastructure in PostgreSQL, establishing a clean, tamper-proof boundary for Phase 8 distance-based pricing.

---

## 2. Scope Boundaries

### In-Scope (Phase 7)
* **Database & Schema**:
  - Migration `20260902000017_maps_location_services.sql`.
  - Add `latitude numeric(10, 7)` and `longitude numeric(10, 7)` to `public.addresses` and `public.vendors`.
  - Add range check constraints: `latitude BETWEEN -90.0000000 AND 90.0000000`, `longitude BETWEEN -180.0000000 AND 180.0000000`.
  - Composite B-tree indexes on `(latitude, longitude)` for addresses and vendors.
  - Extend `public.service_areas` with `center_lat numeric(10, 7)`, `center_lon numeric(10, 7)`, `radius_km numeric(6, 2)`, alongside existing `coverage_polygon jsonb`.
  - Seed configurable launch coverage for `Ijebu-Ode Central` zone (subject to business confirmation).
  - PostgreSQL function `calculate_distance_km(p_lat1, p_lon1, p_lat2, p_lon2)` (`SECURITY INVOKER`, `IMMUTABLE`, `PARALLEL SAFE`).
  - PostgreSQL function `is_location_in_service_area(p_lat, p_lon, p_service_area_id)` (`SECURITY INVOKER`, `STABLE`, `PARALLEL SAFE`).
* **Geocoding Layer**:
  - Provider abstraction interface `GeocodingProvider`.
  - OpenStreetMap Nominatim adapter bounded to Nigeria (`countrycodes=ng`) with Ijebu-Ode viewbox bias for development and staging.
  - Deterministic mock adapter with verified Ijebu-Ode landmarks for offline testing.
  - Request throttling, 400ms debouncing, 8s timeout with `AbortSignal`, and typed error normalization.
* **Customer Address Geolocation UX**:
  - Extend `AddressFormModal` with address autocomplete search, candidate selection, and map pin placement.
  - Draggable / clickable map marker allowing fine doorstep tuning.
  - Explicit customer confirmation before saving coordinates.
  - Service-area coverage notification when an address is outside active delivery bounds.
* **Map Presentation**:
  - Reusable `LocationMap` and `LocationPickerMap` components with OpenStreetMap tiles.
  - Draggable marker, vendor pickup pin, customer delivery pin, and service area boundary circle/polygon overlay.
  - High-contrast SVG coordinate radar fallback when tile networks fail or are blocked.
* **Authoritative Distance Boundary**:
  - `calculate_distance_km` in PostgreSQL is the sole authoritative distance engine.
  - Client-side Haversine helper for non-authoritative UI preview only.

### Out-of-Scope (Strictly Deferred to Later Phases)
* Distance-based delivery fee pricing formula, rates, and minimum/maximum fee caps (Phase 8).
* Paystack payment gateway integration and checkout transactions (Phase 9).
* Live rider tracking, vehicle telematics, and dispatch optimization (Phases 10 & 11).
* Admin control center visual geo-fencing editor (Phase 12).
* Turn-by-turn road routing engines (OSRM / Google Directions) (Phase 10).
* Modifying `create_order_secure()` RPC (preserved intact from Phase 6).

---

## 3. Functional Requirements

### FR-1: Geographic Coordinates & Representation
* **FR-1.1**: All geographic coordinates must use WGS84 (EPSG:4326).
* **FR-1.2**: Coordinates must be stored as `numeric(10, 7)` in decimal degrees:
  - Latitude: range `[-90.0000000, 90.0000000]`.
  - Longitude: range `[-180.0000000, 180.0000000]`.
* **FR-1.3**: Precision must support ~1.1 cm doorstep accuracy.
* **FR-1.4**: TypeScript interfaces must use explicit object types `{ latitude: number; longitude: number }` to eliminate `(lat, lng)` vs `(lng, lat)` inversion errors.

### FR-2: Geocoding Provider Abstraction
* **FR-2.1**: The application must interact with geocoding solely through a provider interface:
  ```ts
  interface GeocodingProvider {
    name: string
    forwardGeocode(query: string, options?: GeocodeOptions): Promise<GeocodeResult[]>
    reverseGeocode(coords: Coordinates, options?: GeocodeOptions): Promise<GeocodeResult | null>
  }
  ```
* **FR-2.2**: The provider layer must isolate external API quirks, query formatting, and error structures.
* **FR-2.3**: Queries must be debounced by at least 400ms with an 8-second abort timeout.
* **FR-2.4**: No private API keys may be bundled into frontend client assets.

### FR-3: Customer Address Flow
* **FR-3.1**: The customer address entry flow must strictly separate:
  1. *Entered Address*: User-typed street string.
  2. *Geocoded Address*: Candidate street match returned by provider.
  3. *Confirmed Location*: Pin location verified by customer on the map.
  4. *Serviceable Location*: Location confirmed to be within active service coverage.
* **FR-3.2**: A geocoded address must never be saved silently without explicit customer confirmation.
* **FR-3.3**: The UI must display a "Verified Location" badge on addresses that possess confirmed coordinates.

### FR-4: Service Area Awareness
* **FR-4.1**: Active delivery zones are defined in `public.service_areas`.
* **FR-4.2**: The database is the authoritative source for serviceability via `is_location_in_service_area`.
* **FR-4.3**: Initial launch seed data for `Ijebu-Ode Central` is marked as configurable launch seed data requiring business confirmation.
* **FR-4.4**: Out-of-area locations display a clear advisory: *"This location is outside KingdomDash delivery coverage in Ijebu-Ode."*

### FR-5: Authoritative Distance Semantics
* **FR-5.1**: `calculate_distance_km` in PostgreSQL computes **straight-line/geodesic distance** via the Haversine formula on a WGS84 sphere (mean radius 6,371.009 km).
* **FR-5.2**: Distance output is rounded to 3 decimal places (1-meter precision).
* **FR-5.3**: Client-side distance calculations are strictly labeled as estimated straight-line previews and are never accepted as authoritative by the backend.

---

## 4. Non-Functional & Security Requirements

### NFR-1: Least-Privilege Database Functions
* **NFR-1.1**: `calculate_distance_km` must be `SECURITY INVOKER`, `IMMUTABLE`, and `PARALLEL SAFE`. It touches zero tables.
* **NFR-1.2**: `is_location_in_service_area` must be `SECURITY INVOKER`, `STABLE`, and `PARALLEL SAFE`. It queries `public.service_areas` which is publicly readable via `service_areas_select_active_public`.
* **NFR-1.3**: Both functions must explicitly set `search_path = public`.

### NFR-2: Row Level Security & Ownership
* **NFR-2.1**: Customer addresses with coordinates remain strictly protected by `addresses_all_own` (`profile_id = auth.uid()`).
* **NFR-2.2**: Vendor coordinates are updated only by the authenticated vendor owner via `vendors_update_own` and are protected against unauthorized modification.
* **NFR-2.3**: Order locations created in Phase 6 remain immutable; historical orders are not retroactively mutated by address changes.

### NFR-3: Performance & Reliability
* **NFR-3.1**: Map components and Leaflet scripts must be lazy-loaded to preserve initial bundle loading speed.
* **NFR-3.2**: If map tile servers are unreachable, the UI must display a graceful fallback coordinate radar rather than a blank or crashing container.
