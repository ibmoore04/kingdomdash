# KINGDOMDASH — PHASE 8: DISTANCE-BASED DELIVERY PRICING
# REQUIREMENTS SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Planning Draft — Awaiting Implementation Authorization  
**Target Release:** KingdomDash Phase 8  
**Scope:** Authoritative Distance-Based Delivery Pricing Engine  

---

## 1. Executive Summary & Objective

In Phases 0 through 7, KingdomDash established the foundation for user authentication, role-based access control, vendor catalog management, customer ordering, and geographic location services.

During Phase 6 and Phase 7, the delivery fee across all orders was intentionally fixed to a placeholder:
```text
₦0.00 (Launch Preview)
```
**Phase 8 terminates this launch preview and establishes the real, secure, distance-based delivery pricing engine.**

### Core Invariant: Zero Client Authority
> **THE CLIENT MUST NEVER BE THE AUTHORITY FOR DISTANCE, DELIVERY FEE, SUBTOTAL, OR ORDER TOTAL.**  
> The client may calculate and display an estimated delivery fee for UX preview purposes, but the PostgreSQL database is the sole, final, and immutable authority for determining the delivery fee, subtotal, and total amount charged on any order.

---

## 2. Project Context & Platform Scope

- **Product Name**: KingdomDash
- **Official Tagline**: *SWIFT IN MOTION.*
- **Launch Market**: Ijebu-Ode, Ogun State, Nigeria
- **Service Offerings**:
  1. Food Delivery (`service_type = 'food'`)
  2. Grocery Delivery (`service_type = 'grocery'`)
  3. Courier Dispatch (`service_type = 'courier'`) — *Note: Handled via specialized courier workflow; food & grocery are the primary e-commerce catalog ordering services.*
- **Technology Stack**:
  - Frontend: React 19, TypeScript, Vite, Tailwind CSS, Zustand
  - Backend: Supabase, PostgreSQL 15+, Supabase Auth, PostgreSQL RLS
  - Geographic Architecture: Haversine geodesic straight-line distance on WGS84 sphere ($R = 6,371.009\text{ km}$) via `public.calculate_distance_km` (Migration 017)
  - Authoritative Transaction Engine: `public.create_order_secure()` RPC (Migration 015)

---

## 3. Scope Definition

### 3.1 In-Scope (Phase 8 Deliverables)
1. **Authoritative Delivery Pricing Database Engine**:
   - Deterministic pricing rule selection from `public.delivery_pricing_rules`.
   - Authoritative server-side calculation of geodesic distance from vendor coordinates to customer delivery address coordinates.
   - Server-side calculation of delivery fee using base fee, per-km distance rate, minimum fee, and maximum fee clamps.
   - Extension of `public.create_order_secure()` to execute atomic delivery pricing, validate coordinates and serviceability, compute the fee, and snapshot financial values.
2. **Order Financial Snapshotting**:
   - Additive historical snapshot columns on `public.orders`:
     - `distance_km numeric(10, 3)` (geodesic distance at order time)
     - `pricing_rule_id uuid` (rule used to compute delivery fee)
     - `delivery_address_id uuid` (saved address reference)
3. **Delivery Pricing Preview Service & RPC**:
   - Lightweight, read-only server RPC `public.calculate_delivery_fee_preview(p_vendor_id, p_delivery_address_id, p_service_type)` for checkout and cart UI previews.
4. **Checkout UX Integration**:
   - Replacement of `₦0.00 (Launch Preview)` with live calculated delivery fee in `CheckoutSummaryCard` and Cart summary.
   - Comprehensive error and edge-case handling: addresses without coordinates, out-of-service-area locations, inactive pricing rules, and distance preview notices.
5. **Security, RLS & Authorization Hardening**:
   - Strict enforcement of `SECURITY INVOKER` vs `SECURITY DEFINER` boundaries.
   - Address ownership verification preventing cross-customer coordinate exploitation.
   - Complete threat mitigation against client-side parameter tampering (distance, delivery fee, product prices, totals).
6. **Comprehensive Test Suite**:
   - Automated unit, integration, RLS, and security verification tests.

### 3.2 Out-of-Scope (Strictly Deferred to Later Phases)
- **Paystack Integration & Payment Webhooks**: Strictly Phase 9.
- **Rider Dispatch, Assignment & Operations**: Strictly Phases 10–11.
- **Real-Time Live Rider GPS Tracking**: Strictly Phase 11.
- **Road-Network Driving Distance & Routing**: Strictly Phase 10+ (Phase 8 uses geodesic straight-line distance).
- **Admin Control Center UI**: Strictly Phase 12 (Phase 8 establishes the database-level pricing model and rules; admin web UI is built in Phase 12).
- **Coupons, Promotional Discounts & Loyalty Points**: Deferred to Future Enhancements.

---

## 4. User Stories

### 4.1 Customer Persona
- **US-1 (Fee Transparency)**: *As a customer placing a food or grocery order in Ijebu-Ode, I want to see a clear, itemized delivery fee based on the distance between the store and my doorstep before I place my order, so that I understand exactly what I am paying for delivery.*
- **US-2 (Doorstep Precision)**: *As a customer who pinned my delivery address on the map, I want my delivery fee to reflect my verified doorstep location, ensuring fair pricing based on actual distance.*
- **US-3 (Clear Serviceability Guidance)**: *As a customer entering an address outside the active delivery zone, I want immediate notice that delivery cannot be fulfilled to that location, so I do not place an unserviceable order.*

### 4.2 Vendor Persona
- **US-4 (Zero Pricing Burden)**: *As a vendor in Ijebu-Ode, I do not want to manage complex delivery logistics or calculate dispatch fees; I want KingdomDash's platform rules to calculate delivery charges automatically based on my store location.*

### 4.3 Administrator Persona
- **US-5 (Deterministic Rule Control)**: *As a platform administrator, I want delivery pricing rules configured in PostgreSQL with explicit effective dates, service area tiers, and service type categories, so that pricing remains 100% predictable, auditable, and easily updated without altering past order records.*
- **US-6 (Historical Immutability)**: *As a financial auditor, I want every completed order to permanently preserve the exact distance, pricing rule, base fee, and delivery fee charged at the instant of order creation, even if platform pricing rules change the following day.*

---

## 5. Functional Requirements

### 5.1 Pricing Rule Data Model & Invariants
- **FR-1.1**: The database must maintain delivery pricing rules in `public.delivery_pricing_rules` with attributes:
  - `service_type` (`service_type` enum: `'food'`, `'grocery'`, `'courier'`, or `NULL` for universal).
  - `service_area_id` (`uuid` foreign key to `public.service_areas`, or `NULL` for global).
  - `base_fee` (`numeric(12, 2)`, non-negative, minimum base dispatch charge in Naira).
  - `distance_rate` (`numeric(10, 4)`, non-negative, per-kilometer rate in Naira).
  - `min_fee` (`numeric(12, 2)`, optional floor charge).
  - `max_fee` (`numeric(12, 2)`, optional ceiling charge).
  - `is_active` (`boolean`, default `true`).
  - `effective_date` (`date`, default `CURRENT_DATE`).
  - `expiry_date` (`date`, optional expiration cutoff).
- **FR-1.2**: Within any active pricing tier, the partial unique indexes established in Migration 014 must be preserved:
  - At most one active rule for `(service_type IS NULL, service_area_id IS NULL)`.
  - At most one active rule for `(service_type, service_area_id IS NULL)`.
  - At most one active rule for `(service_type IS NULL, service_area_id)`.
  - At most one active rule for `(service_type, service_area_id)`.

### 5.2 Deterministic Pricing Rule Selection Hierarchy
- **FR-2.1**: When pricing an order for `p_service_type` delivered to an address in `v_service_area_id`, the system must query `public.delivery_pricing_rules` using an explicit 4-tier specificity hierarchy:
  1. **Tier 1 (Most Specific)**: `service_type = p_service_type AND service_area_id = v_service_area_id`
  2. **Tier 2 (Service Specific)**: `service_type = p_service_type AND service_area_id IS NULL`
  3. **Tier 3 (Area Specific)**: `service_type IS NULL AND service_area_id = v_service_area_id`
  4. **Tier 4 (Universal Fallback)**: `service_type IS NULL AND service_area_id IS NULL`
- **FR-2.2**: The rule selection query must filter for `is_active = true`, `effective_date <= CURRENT_DATE`, and `(expiry_date IS NULL OR expiry_date >= CURRENT_DATE)`.
- **FR-2.3**: In the event of date overlap across updates, tie-breaking must order by `effective_date DESC, created_at DESC LIMIT 1`.
- **FR-2.4**: If no active rule matches across all 4 tiers, the transaction must abort with an informative exception (`'No active delivery pricing rule found for service % in area %'`).

### 5.3 Authoritative Distance & Serviceability Computation
- **FR-3.1**: Distance must be computed exclusively on the server using `public.calculate_distance_km(v_vendor.latitude, v_vendor.longitude, v_address.latitude, v_address.longitude)`.
- **FR-3.2**: Client-supplied distance values must be completely ignored by the order creation transaction.
- **FR-3.3**: The server must verify that the customer delivery address falls within an active service area via `public.is_location_in_service_area(v_address.latitude, v_address.longitude, v_address.service_area_id)`.
- **FR-3.4**: If the address is outside all active service areas, order creation must be rejected with exception `'Delivery location is outside the active delivery zone'`.

### 5.4 Delivery Fee Formula & Clamping
- **FR-4.1**: The delivery fee formula is:
  $$\text{Raw Fee} = \text{base\_fee} + (\text{distance\_km} \times \text{distance\_rate})$$
- **FR-4.2**: The raw fee must be rounded to two decimal places (kobo precision):
  $$\text{Rounded Fee} = \text{round}(\text{Raw Fee}, 2)$$
- **FR-4.3**: Minimum fee clamping: If `min_fee IS NOT NULL` and $\text{Rounded Fee} < \text{min\_fee}$, set $\text{Delivery Fee} = \text{min\_fee}$.
- **FR-4.4**: Maximum fee clamping: If `max_fee IS NOT NULL` and $\text{Rounded Fee} > \text{max\_fee}$, set $\text{Delivery Fee} = \text{max\_fee}$.
- **FR-4.5**: Otherwise, set $\text{Delivery Fee} = \text{Rounded Fee}$.

### 5.5 Atomic Secure Order Creation
- **FR-5.1**: `public.create_order_secure()` must be updated to accept `p_delivery_address_id uuid`.
- **FR-5.2**: The function must verify that `p_delivery_address_id` belongs to the authenticated customer (`profile_id = auth.uid()`).
- **FR-5.3**: The function must load the vendor coordinates directly from `public.vendors WHERE id = p_vendor_id`.
- **FR-5.4**: The function must calculate subtotal from locked database product prices (`FOR UPDATE`), calculate authoritative delivery fee, and set `total = subtotal + delivery_fee`.
- **FR-5.5**: The order row must snapshot: `subtotal`, `delivery_fee`, `total`, `distance_km`, `pricing_rule_id`, `delivery_address_id`, `pickup_address`, and `delivery_address` (text).

### 5.6 Preview Endpoint for UI / Checkout
- **FR-6.1**: Provide a database RPC `public.calculate_delivery_fee_preview(...)` allowing authenticated customers (and unauthenticated guests exploring the catalog) to obtain a live delivery fee breakdown without creating an order.
- **FR-6.2**: The preview response must return: `distance_km`, `base_fee`, `distance_rate`, `delivery_fee`, `service_area_name`, and `is_serviceable`.

---

## 6. Non-Functional Requirements

### 6.1 Security & Financial Integrity
- **NFR-1.1**: The client has zero financial authority. Any payload attempting to pass `delivery_fee`, `subtotal`, `total`, or `distance` must be ignored or rejected.
- **NFR-1.2**: All pricing calculations inside PostgreSQL must use `numeric(12, 2)` and `numeric(10, 4)` types. Floating-point IEEE-754 arithmetic is strictly prohibited in financial logic.
- **NFR-1.3**: RLS must restrict `delivery_pricing_rules` modifications strictly to `admin` and `super_admin`.

### 6.2 Transactional Atomicity & Concurrency
- **NFR-2.1**: The entire execution of `create_order_secure()` must be atomic. Any validation failure, missing coordinate, or inactive rule must cause an immediate `ROLLBACK`, leaving no orphaned rows.
- **NFR-2.2**: Concurrent price modifications on products or pricing rules must be handled safely via row-level locks (`FOR UPDATE`) or date-effective snapshots.

### 6.3 Performance & Latency
- **NFR-3.1**: The entire pricing calculation (rule selection + Haversine calculation + fee clamping) inside PostgreSQL must execute in under **5 milliseconds**.
- **NFR-3.2**: Indexes on `public.delivery_pricing_rules` and `public.orders` must ensure constant-time $O(1)$ lookups.

---

## 7. Business Decisions Requiring Stakeholder Resolution

The following items are business and operational policy decisions that cannot be assumed or hardcoded as architectural dogma:

| Item ID | Decision Required | Existing Baseline / Default | Impact |
| :--- | :--- | :--- | :--- |
| **BD-1** | **Production Fee Rates for Ijebu-Ode**: Confirm the baseline rates for Food Delivery and Grocery Delivery. | Seed in Migration 012: Base ₦500, Rate ₦100/km. | Determines customer pricing at launch. |
| **BD-2** | **Differentiation Between Food & Grocery**: Should Grocery Delivery have a higher base fee (e.g. ₦700) or higher distance rate due to weight/bulk compared to Food? | Migration 012 has universal rule (`service_type = NULL`). | Determines whether Tier 2 rules should be seeded for `'food'` and `'grocery'`. |
| **BD-3** | **Currency Rounding Policy**: Should delivery fee be rounded to the nearest **₦10**, **₦50**, or exact **₦0.01 (kobo)**? | PostgreSQL standard: `round(fee, 2)` (kobo). | Nigerian cash/digital payment UX generally prefers whole Naira or ₦50 increments. |
| **BD-4** | **Unpinned Address Policy**: If an existing saved customer address has `latitude IS NULL` (legacy or manual address), should checkout: <br>**(A)** Require the customer to pin their doorstep before placing an order?<br>**(B)** Fall back to a default city-center distance / flat launch fee? | Recommended: **Option A** (require doorstep pin for accurate delivery and dispatch). | Prevents unpriceable orders and delivery failures. |
| **BD-5** | **Minimum Delivery Fee Floor**: Should an explicit `min_fee` be enforced (e.g., ₦500 minimum even for 200-meter doorstep deliveries)? | Base fee naturally acts as floor, but `min_fee` can enforce a floor if base fee is lowered. | Protects rider compensation for short trips. |

---

## 8. Acceptance Criteria

- [ ] **AC-1**: `delivery_pricing_rules` supports all 4 specificity tiers with unique partial indexes preventing active rule conflicts.
- [ ] **AC-2**: `create_order_secure()` accepts `p_delivery_address_id`, loads coordinates from DB, and calculates authoritative distance using `calculate_distance_km()`.
- [ ] **AC-3**: `create_order_secure()` determines the authoritative delivery fee, computes `total = subtotal + delivery_fee`, and snapshots `distance_km`, `pricing_rule_id`, and `delivery_address_id` on `orders`.
- [ ] **AC-4**: A malicious client payload containing forged `delivery_fee`, `total`, or `distance` has zero effect on the recorded order price.
- [ ] **AC-5**: Checkout page displays the live estimated delivery fee and distance breakdown, replacing the `₦0.00 (Launch Preview)` banner.
- [ ] **AC-6**: Addresses outside the active service area are blocked from order placement with clear, user-friendly guidance.
- [ ] **AC-7**: All automated tests pass with 0 errors and zero regressions across Phases 0–7.
