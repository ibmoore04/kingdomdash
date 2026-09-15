# KINGDOMDASH — PHASE 8: DISTANCE-BASED DELIVERY PRICING
# IMPLEMENTATION TASKS SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Planning Draft — Awaiting Implementation Authorization  
**Phase:** 8 (Distance-Based Delivery Pricing)  
**Execution Rule:** Strictly sequential. Quality gate verified after each task.  

---

## Task Dependency Graph

```text
[Task 1: Migration 018 — Schema Extension & RPCs]
                       ↓
[Task 2: Database Pricing & Snapshot Verification Tests]
                       ↓
[Task 3: TypeScript Types & Domain Interfaces]
                       ↓
[Task 4: Delivery Pricing Service Layer (pricing.ts)]
                       ↓
[Task 5: Orders Service Layer Update (orders.ts)]
                       ↓
[Task 6: Checkout UI Integration & Fee Breakdown]
                       ↓
[Task 7: Automated Integration, Threat Model & Regression Tests]
                       ↓
[Task 8: Production Build & Phase 8 Final Verification Gate]
```

---

## Detailed Task Breakdown

### Task 1: Migration 018 — Schema Extension & Authoritative RPCs
- **Task ID**: `TASK-P8-01`
- **Objective**: Author Migration `20260902000018_distance_based_delivery_pricing.sql` to extend `orders` with snapshot columns, implement the 4-tier `calculate_delivery_fee_preview()` RPC, and extend `create_order_secure()` with distance-based pricing.
- **Files Affected**:
  - `supabase/migrations/20260902000018_distance_based_delivery_pricing.sql`
- **Dependencies**: Migration 017 (`20260902000017_maps_location_services.sql`)
- **Implementation Requirements**:
  1. `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS distance_km numeric(10, 3);`
  2. `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pricing_rule_id uuid REFERENCES public.delivery_pricing_rules(id) ON DELETE SET NULL;`
  3. `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address_id uuid REFERENCES public.addresses(id) ON DELETE SET NULL;`
  4. Create B-tree indexes: `idx_orders_pricing_rule_id` and `idx_orders_delivery_address_id`.
  5. Implement `public.calculate_delivery_fee_preview(p_vendor_id uuid, p_delivery_address_id uuid, p_service_type service_type) RETURNS jsonb`:
     - `SECURITY INVOKER`, `STABLE`, `SET search_path = public`.
     - Executes 4-tier deterministic rule selection.
     - Computes geodesic distance and clamped delivery fee.
     - `REVOKE FROM PUBLIC; GRANT TO authenticated, anon;`
  6. Extend `public.create_order_secure(...)`:
     - Accepts `p_delivery_address_id uuid DEFAULT NULL`.
     - Validates address ownership (`profile_id = auth.uid()`).
     - Loads vendor coordinates directly from `public.vendors`.
     - Validates serviceability via `is_location_in_service_area()`.
     - Calculates geodesic distance via `calculate_distance_km()`.
     - Selects rule, computes clamped fee, and sets `total = subtotal + delivery_fee`.
     - Snapshots `distance_km`, `pricing_rule_id`, and `delivery_address_id` into the order row.
     - `SECURITY DEFINER`, `VOLATILE`, `SET search_path = public`.
     - `REVOKE FROM PUBLIC; GRANT TO authenticated;`
- **Security Requirements**:
  - `SECURITY INVOKER` on preview function prevents privilege escalation.
  - `SET search_path = public` on both functions prevents search-path hijacking.
  - Ownership check `profile_id = auth.uid()` prevents unauthorized address lookups.
- **Tests**:
  - SQL verification script testing: rule tiers, clamped fee boundaries, missing coordinates rejection, and order snapshot preservation.
- **Acceptance Criteria**:
  - Migration runs idempotently. Both functions execute with exact schema signatures.

---

### Task 2: Database Pricing & Snapshot Verification Tests
- **Task ID**: `TASK-P8-02`
- **Objective**: Create dedicated automated database and SQL test suite verifying Migration 018 behavior against edge cases.
- **Files Affected**:
  - `src/services/supabase/__tests__/pricing-db.test.ts`
- **Dependencies**: `TASK-P8-01`
- **Implementation Requirements**:
  - Verify 4-tier selection algorithm:
    1. Service + Area rule matches first.
    2. Falls back to Service-only rule if area rule absent.
    3. Falls back to Area-only rule if service rule absent.
    4. Falls back to Global Default if no other rule matches.
  - Verify clamping logic: `min_fee` floor and `max_fee` ceiling.
  - Verify rejection of unpinned addresses (missing coordinates).
  - Verify rejection of out-of-service-area locations.
- **Security Requirements**:
  - Verify anonymous users cannot modify pricing rules.
  - Verify customer A cannot use customer B's address ID.
- **Tests**:
  - Vitest test suite executing mocked RPC calls and SQL assertion matrices.
- **Acceptance Criteria**:
  - 100% of test cases pass with zero errors.

---

### Task 3: TypeScript Types & Domain Interfaces
- **Task ID**: `TASK-P8-03`
- **Objective**: Update database types and domain entity models with Phase 8 structures.
- **Files Affected**:
  - `src/types/database.types.ts`
  - `src/types/index.ts`
- **Dependencies**: `TASK-P8-01`
- **Implementation Requirements**:
  1. In `database.types.ts`:
     - Update `orders` Table Row, Insert, and Update to include:
       - `distance_km: number | null`
       - `pricing_rule_id: string | null`
       - `delivery_address_id: string | null`
     - Add `calculate_delivery_fee_preview` RPC to `Database['public']['Functions']`.
     - Update `create_order_secure` RPC arguments to include optional `p_delivery_address_id`.
  2. In `src/types/index.ts`:
     - Export `DeliveryPricingRule = Database['public']['Tables']['delivery_pricing_rules']['Row']`.
     - Export `DeliveryFeePreview` interface:
       ```ts
       export interface DeliveryFeePreview {
         is_serviceable: boolean
         distance_km: number
         base_fee: number
         distance_rate: number
         raw_fee: number
         delivery_fee: number
         pricing_tier: number
         service_area_name: string
       }
       ```
- **Security Requirements**:
  - Strict typing: zero `any` usage.
- **Tests**:
  - `npx tsc -b` passes cleanly.
- **Acceptance Criteria**:
  - Full TypeScript type safety across orders, rules, and RPC payloads.

---

### Task 4: Delivery Pricing Service Layer
- **Task ID**: `TASK-P8-04`
- **Objective**: Implement frontend Supabase pricing service in `src/services/supabase/pricing.ts`.
- **Files Affected**:
  - `src/services/supabase/pricing.ts` (NEW)
  - `src/services/supabase/__tests__/pricing.test.ts` (NEW)
- **Dependencies**: `TASK-P8-03`
- **Implementation Requirements**:
  1. Implement `getDeliveryFeePreview(vendorId: string, deliveryAddressId: string, serviceType: ServiceType)`:
     - Calls `supabase.rpc('calculate_delivery_fee_preview', { ... })`.
     - Graceful offline/test fallback: calculates distance via Haversine and applies default pricing formula.
  2. Implement `getActivePricingRules()`:
     - Queries `public.delivery_pricing_rules` with `is_active = true`.
- **Security Requirements**:
  - Safe error handling without crashing UI on network abort or server exception.
- **Tests**:
  - Unit tests covering successful preview, offline fallback, and invalid inputs.
- **Acceptance Criteria**:
  - Unit tests pass with 100% assertions verified.

---

### Task 5: Orders Service Layer Update
- **Task ID**: `TASK-P8-05`
- **Objective**: Update `src/services/supabase/orders.ts` to pass `p_delivery_address_id` into `create_order_secure()`.
- **Files Affected**:
  - `src/services/supabase/orders.ts`
  - `src/services/supabase/__tests__/orders.test.ts`
- **Dependencies**: `TASK-P8-04`
- **Implementation Requirements**:
  1. Extend `CreateOrderParams`:
     ```ts
     export interface CreateOrderParams {
       vendorId: string
       serviceType: 'food' | 'grocery'
       pickupAddress: string
       deliveryAddress: string
       items: OrderItem[]
       specialInstructions?: string
       deliveryAddressId?: string
     }
     ```
  2. Pass `p_delivery_address_id: params.deliveryAddressId || null` in `createOrderSecure()`.
- **Security Requirements**:
  - Does NOT accept client `delivery_fee`, `total`, or `distance`.
- **Tests**:
  - Update orders unit tests to verify `deliveryAddressId` forwarding.
- **Acceptance Criteria**:
  - RPC properly called with address ID.

---

### Task 6: Checkout UI Integration & Fee Breakdown
- **Task ID**: `TASK-P8-06`
- **Objective**: Integrate real-time distance pricing into Checkout and Cart UI, replacing the `₦0.00 (Launch Preview)` placeholder.
- **Files Affected**:
  - `src/pages/customer/checkout.tsx`
  - `src/components/checkout/checkout-summary-card.tsx`
  - `src/pages/public/cart.tsx`
- **Dependencies**: `TASK-P8-05`
- **Implementation Requirements**:
  1. In `checkout.tsx`:
     - When `selectedAddress` is selected: call `getDeliveryFeePreview()`.
     - Update delivery fee state and total calculation: `total = subtotal + deliveryFee`.
     - When submitting order: pass `deliveryAddressId: selectedAddress.id`.
     - Handle unpinned addresses: display warning prompting user to pin location on map.
     - Handle out-of-service-area addresses: disable submission and show notice.
  2. In `checkout-summary-card.tsx`:
     - Display authoritative delivery fee: e.g. `₦850.00`.
     - Display itemized distance line: `Straight-Line Distance: 3.5 km`.
     - Display order total: `formatNgn(subtotal + deliveryFee)`.
     - Remove launch preview disclaimer; replace with: *"Delivery fee calculated based on straight-line distance."*
  3. In `cart.tsx`:
     - Update summary card to indicate delivery fee will be calculated at checkout based on delivery address distance.
- **Security Requirements**:
  - UI displayed values clearly designated as previews until order creation.
- **Tests**:
  - Component tests in `checkout.test.tsx` and `checkout-summary-card.test.tsx`.
- **Acceptance Criteria**:
  - Customer sees live delivery fee update upon address selection.

---

### Task 7: Automated Integration, Threat Model & Regression Tests
- **Task ID**: `TASK-P8-07`
- **Objective**: Author and execute comprehensive test suites covering financial security, threat vectors, edge cases, and Phase 0–7 regression verification.
- **Files Affected**:
  - `src/pages/customer/__tests__/checkout-pricing.test.tsx` (NEW)
  - `src/services/supabase/__tests__/pricing-security.test.ts` (NEW)
- **Dependencies**: `TASK-P8-06`
- **Implementation Requirements**:
  - Test threat model:
    - Attempt to tamper with delivery fee in API payload.
    - Attempt to pass distance = 0.
    - Attempt to pass total = 1.
    - Attempt to pass modified unit prices.
    - Attempt to checkout with unpinned address.
    - Attempt to checkout with address outside service area.
  - Regression verification across all existing 32 test files.
- **Security Requirements**:
  - Prove that client has zero authority over any pricing parameter.
- **Tests**:
  - `npm test`
- **Acceptance Criteria**:
  - All test files pass with 0 errors.

---

### Task 8: Production Build & Phase 8 Final Verification Gate
- **Task ID**: `TASK-P8-08`
- **Objective**: Execute full quality gate pipeline (`tsc`, `oxlint`, `vitest`, `vite build`) and produce final Phase 8 Walkthrough.
- **Files Affected**:
  - All project files
  - `walkthrough.md`
- **Dependencies**: `TASK-P8-07`
- **Implementation Requirements**:
  1. `npx tsc -b`: 0 errors.
  2. `npx oxlint`: 0 errors.
  3. `npm test`: all test suites pass.
  4. `npm run build`: bundle builds cleanly.
  5. Produce completion walkthrough artifact.
- **Acceptance Criteria**:
  - 100% clean quality gate.
