# KINGDOMDASH — PHASE 10: ORDER & DELIVERY OPERATIONS
# IMPLEMENTATION TASK BREAKDOWN

**Document Version:** 2.0.0 (Master Correction Reconciled)  
**Status:** Mandatory Pre-Implementation Specification — Approved for Final Review  
**Execution Mode:** Planning / Architecture Only (Implementation NOT Authorized)  
**Target Release:** KingdomDash Phase 10  
**Execution Rule:** Zero production changes without explicit implementation authorization  

---

## 1. Revised Task Dependency Graph

```
[T1: Schema Timestamps & Indices]
        │
        ▼
[T2: Idempotent Delivery Creation Trigger]
        │
        ▼
[T3: Atomic Order/Delivery Transition Engine]
        │
        ├───────────────────────────────┐
        ▼                               ▼
[T4: Vendor Fulfillment RPCs]   [T5: Dispatch & Assignment RPCs]
        │                               │
        │                               ▼
        │                       [T6: Acceptance & Rejection RPCs]
        │                               │
        └───────────────┬───────────────┘
                        ▼
        [T7: Rider Logistics RPCs (Pickup, Transit, Deliver)]
                        │
                        ▼
        [T8: Cancellation & Refund Marker Engine]
                        │
                        ▼
        [T9: Dedicated Courier Ingestion RPC]
                        │
                        ▼
        [T10: Hardened RLS & Function Grants]
                        │
                        ▼
        [T11: Trusted Operational Audit Logging]
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
[T12: Customer Tracking UI]     [T13: Vendor Operational UI]
        │                               │
        └───────────────┬───────────────┘
                        ▼
        [T14: Automated State Machine & Concurrency Tests]
                        │
                        ▼
        [T15: End-to-End Regression & Quality Gate Verification]
```

---

## 2. Detailed Task Specifications (T1 – T15)

### Task 1: Schema Enhancements, Operational Timestamps & Partial Indexes
- **Objective:** Add non-breaking operational timestamps, cancellation reasons, and refund flags to `orders` and `deliveries`, and create partial unique indexes preventing multiple active assignments.
- **Affected Files / Database Entities:**
  - Database: `public.orders`, `public.deliveries`, `public.delivery_assignments`
  - Migration: `supabase/migrations/20260902000020_order_delivery_operations.sql` (Block 1)
- **Database Changes:**
  - Add to `orders`: `confirmed_at`, `preparing_at`, `ready_at`, `picked_up_at`, `in_transit_at`, `delivered_at`, `cancelled_at`, `cancellation_reason text`, `refund_required boolean DEFAULT false`, `refund_status text DEFAULT NULL`.
  - Add to `deliveries`: `picked_up_at`, `in_transit_at`, `delivered_at`, `cancelled_at`.
  - Add partial unique index: `idx_active_delivery_assignment ON delivery_assignments (delivery_id) WHERE status IN ('assigned', 'accepted')`.
- **Dependencies:** Migrations 001–019.
- **Security Considerations:** Timestamps are populated exclusively by server-side RPCs/triggers.
- **Tests:** Verify column existence, default nullability, and partial index uniqueness enforcement.
- **Completion Criteria:** Schema updated cleanly without breaking existing Phase 6–9 order operations.

---

### Task 2: Idempotent Automatic Delivery Creation Trigger
- **Objective:** Create a database trigger on `public.orders` that automatically instantiates exactly one row in `public.deliveries` when `orders.status` transitions to `'payment_confirmed'`.
- **Affected Files / Database Entities:**
  - Function: `public.trg_fn_create_delivery_on_payment_confirmed()`
  - Trigger: `trg_create_delivery_on_payment_confirmed ON public.orders`
- **Database Changes:**
  - Extracts customer contact and pickup details, freezing them into `deliveries` with `status = 'pending'`.
  - Idempotency guard: `IF NOT EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = NEW.id)`.
- **Dependencies:** Task 1.
- **Security Considerations:** Direct client insertion into `deliveries` is prohibited; only the trigger runs as `SECURITY DEFINER`.
- **Tests:** Simulate payment confirmation; verify exactly 1 delivery row is created. Duplicate calls must not create secondary rows.
- **Completion Criteria:** Paid orders always possess an operational delivery record with immutable snapshots.

---

### Task 3: Atomic Order/Delivery Transition Engine (Foundational RPC Framework)
- **Objective:** Establish the atomic RPC framework replacing generic triggers. Implement common validation helpers and standard error-handling routines using SQLSTATE codes (`KD400`, `KD403`, `KD404`, `KD409`).
- **Affected Files / Database Entities:**
  - Database: PostgreSQL functions in `public` schema.
- **Database Changes:**
  - Revoke generic trigger plans (`trg_fn_sync_delivery_to_order` completely excluded).
  - Setup standard state guard functions ensuring order and delivery status are modified in synchronized single transactions.
- **Dependencies:** Task 1, Task 2.
- **Security Considerations:** All transition functions defined with `SECURITY DEFINER` and `SET search_path = public, pg_catalog`.
- **Tests:** Verify helper functions correctly raise `KD409` on invalid transitions.
- **Completion Criteria:** Structured error framework operational; zero generic bidirectional triggers in schema.

---

### Task 4: Vendor Fulfillment RPCs & State Transition Guards
- **Objective:** Implement hardened `update_order_status_vendor(p_order_id, p_new_status)` enforcing sequential progression (`payment_confirmed → preparing → ready_for_pickup`) and vendor rejection (`vendor_reject_order`).
- **Affected Files / Database Entities:**
  - Functions: `public.update_order_status_vendor`, `public.vendor_reject_order`
- **Database Changes:**
  - Verifies vendor ownership: `orders.vendor_id = (SELECT id FROM vendors WHERE profile_id = auth.uid())`.
  - Sequential state enforcement: `payment_confirmed → preparing`, `preparing → ready_for_pickup`.
  - Populates `preparing_at` or `ready_at`.
  - Rejection marks `orders.status = 'cancelled'`, `refund_required = TRUE`, records reason.
- **Dependencies:** Task 1, Task 3.
- **Security Considerations:** Vendors cannot alter line items, product prices, delivery fees, or customer addresses.
- **Tests:** Test valid vendor progression; test cross-vendor rejection (`KD403`); test jumping states (`KD409`).
- **Completion Criteria:** Vendor fulfillment strictly guarded by database RPC.

---

### Task 5: Dispatch & Rider Assignment RPC
- **Objective:** Implement server-authoritative assignment function `assign_delivery_to_rider(p_delivery_id, p_rider_id)`.
- **Affected Files / Database Entities:**
  - Function: `public.assign_delivery_to_rider(uuid, uuid)`
- **Database Changes:**
  - Row locking: `SELECT status FROM deliveries WHERE id = p_delivery_id FOR UPDATE`.
  - Validates rider: `is_verified = true`, `is_active = true`, `is_available = true`, and 0 active in-flight assignments.
  - Inserts into `delivery_assignments` (`status = 'assigned'`).
  - Updates `deliveries.status = 'assigned'`.
- **Dependencies:** Task 1, Task 2.
- **Security Considerations:** Admin/Dispatcher role required. Concurrent assignment attempts blocked by row lock.
- **Tests:** Parallel assignment test verifying only 1 assignment succeeds and the second raises `KD409`.
- **Completion Criteria:** Deterministic dispatch assignment with zero duplicate assignment collisions.

---

### Task 6: Assignment Acceptance & Rejection RPCs
- **Objective:** Implement dedicated rider response RPCs `accept_delivery_assignment(p_assignment_id)` and `reject_delivery_assignment(p_assignment_id, p_reason)`.
- **Affected Files / Database Entities:**
  - Functions: `public.accept_delivery_assignment`, `public.reject_delivery_assignment`
- **Database Changes:**
  - Acceptance: updates `delivery_assignments.status = 'accepted'`, records `responded_at`. Delivery status remains `assigned`. Idempotent on repeated calls.
  - Rejection: updates `delivery_assignments.status = 'rejected'`, records `responded_at`. Reverts `deliveries.status = 'pending'` for reassignment.
- **Dependencies:** Task 5.
- **Security Considerations:** Caller must be the assigned rider (`riders.profile_id = auth.uid()`).
- **Tests:** Test acceptance keeping delivery `assigned`; test rejection reverting delivery to `pending`.
- **Completion Criteria:** Dedicated assignment responses functioning independently from physical custody.

---

### Task 7: Rider Logistics Custody RPCs (Pickup, Transit, Delivered)
- **Objective:** Implement atomic custody transition functions `mark_delivery_picked_up`, `mark_delivery_in_transit`, and `mark_delivery_delivered`.
- **Affected Files / Database Entities:**
  - Functions: `public.mark_delivery_picked_up`, `public.mark_delivery_in_transit`, `public.mark_delivery_delivered`
- **Database Changes:**
  - `mark_delivery_picked_up`: Enforces order is `ready_for_pickup` (food/grocery) or `payment_confirmed` (courier). Atomically updates `deliveries.status = 'picked_up'`, `orders.status = 'picked_up'`, sets `picked_up_at = NOW()`.
  - `mark_delivery_in_transit`: Atomically updates `deliveries.status = 'in_transit'`, `orders.status = 'in_transit'`, sets `in_transit_at = NOW()`.
  - `mark_delivery_delivered`: Atomically updates `deliveries.status = 'delivered'`, `orders.status = 'delivered'`, `delivery_assignments.status = 'completed'`, sets `delivered_at = NOW()`.
- **Dependencies:** Task 3, Task 6.
- **Security Considerations:** Caller must be assigned rider with `accepted` assignment. State skips rejected with `KD409`.
- **Tests:** Test sequential progression; test pickup rejection when order is still in `preparing`.
- **Completion Criteria:** Complete physical logistics pipeline operational and synchronized atomically.

---

### Task 8: Cancellation & Refund Marker Engine
- **Objective:** Implement unified cancellation RPC `cancel_order_operational(p_order_id, p_reason)` enforcing strict role-based boundaries and setting `refund_required = TRUE` for paid orders.
- **Affected Files / Database Entities:**
  - Function: `public.cancel_order_operational(uuid, text)`
- **Database Changes:**
  - Customer: allowed only if `status IN ('pending', 'payment_pending')`.
  - Vendor: allowed only if `status = 'payment_confirmed'` and vendor owns order.
  - Admin: allowed pre-delivery.
  - If order was paid, sets `refund_required = TRUE`, `refund_status = 'pending_manual_review'`.
  - Atomically sets `orders.status = 'cancelled'`, `deliveries.status = 'cancelled'`.
- **Dependencies:** Task 1, Task 2.
- **Security Considerations:** Post-custody cancellation blocked for non-admins; no automatic Paystack refund claimed.
- **Tests:** Test customer cancellation rejected on `preparing` order; test `refund_required` set on paid cancellation.
- **Completion Criteria:** Role-gated cancellation engine operational with explicit financial flagging.

---

### Task 9: Dedicated Courier Order Ingestion RPC
- **Objective:** Implement `create_courier_order_secure` to provide a dedicated, server-authoritative creation pathway for courier dispatch orders, resolving the existing courier ingestion gap.
- **Affected Files / Database Entities:**
  - Function: `public.create_courier_order_secure(...)`
- **Database Changes:**
  - Validates sender profile, recipient contact, pickup coordinates, delivery coordinates, service area.
  - Computes distance fee via `calculate_distance_km` and `delivery_pricing_rules`.
  - Inserts into `orders` (`service_type = 'courier'`, `vendor_id = NULL`, `subtotal = 0`, `total = delivery_fee`).
- **Dependencies:** Task 1, Phase 7 & 8 pricing functions.
- **Security Considerations:** Sender must be authenticated; coordinates validated against active service areas.
- **Tests:** Test creating courier order; verify fee calculation and null vendor ID.
- **Completion Criteria:** Courier orders created securely and ready for Paystack payment initialization.

---

### Task 10: Hardened RLS & Function Grants
- **Objective:** Enforce strict tenant isolation on `orders`, `deliveries`, `delivery_assignments`, and `delivery_status_updates`. Revoke direct table mutations.
- **Affected Files / Database Entities:**
  - Tables: `orders`, `deliveries`, `delivery_assignments`, `delivery_status_updates`
- **Database Changes:**
  - Revoke direct `UPDATE` and `DELETE` on operational tables for `authenticated` role.
  - Apply granular `SELECT` policies for customers, vendors, and assigned riders.
  - Grant `EXECUTE` on operational RPCs to `authenticated` role.
- **Dependencies:** Tasks 1–9.
- **Security Considerations:** Zero direct mutation capability from client browser.
- **Tests:** Test direct SQL `UPDATE orders SET status = 'delivered'` fails with permission denied.
- **Completion Criteria:** All operational state transitions forced through secure RPCs.

---

### Task 11: Trusted Operational Audit Logging
- **Objective:** Instrument operational RPCs to log structured, append-only events to `public.audit_logs`, extracting trusted client IP and user agent from server request context.
- **Affected Files / Database Entities:**
  - Table: `public.audit_logs`
  - RPCs from Tasks 4–8.
- **Database Changes:**
  - Extract IP and User Agent from `current_setting('request.headers', true)::json`.
  - Record `actor_id`, `action`, `record_id`, `old_values`, `new_values`, `timestamp`.
- **Dependencies:** Tasks 4–8.
- **Security Considerations:** Untrusted client payload metadata ignored.
- **Tests:** Check audit log contents after each operational RPC call.
- **Completion Criteria:** 100% of operational status changes produce an immutable audit log.

---

### Task 12: Customer Tracking & Visual Progress UI
- **Objective:** Build a read-only visual progress tracker component reflecting the authoritative database state across the 5 commercial stages, with courier adaptation.
- **Affected Files:**
  - Component: `src/components/customer/OrderStatusTimeline.tsx` (New)
  - Page: `src/pages/customer/order-confirmation.tsx`
- **Database Changes:** None.
- **Dependencies:** Tasks 1–7.
- **Security Considerations:** Strictly read-only; derives timeline exclusively from server state.
- **Tests:** Component unit tests asserting correct stage active for each `order_status`.
- **Completion Criteria:** Customer sees live order timeline with assigned rider first name and vehicle type.

---

### Task 13: Vendor Operational Fulfillment UI
- **Objective:** Add an "Orders" fulfillment tab to the Vendor Dashboard allowing restaurant/store managers to view paid incoming orders, accept them (`preparing`), and mark them `ready_for_pickup`.
- **Affected Files:**
  - Component: `src/components/vendor/VendorOrdersList.tsx` (New)
  - Page: `src/pages/dashboard/vendor-dashboard.tsx`
- **Database Changes:** None.
- **Dependencies:** Task 4, Task 10.
- **Security Considerations:** Communicates only with `update_order_status_vendor` RPC; cannot edit commercial values.
- **Tests:** Vendor orders list tests verifying action buttons trigger RPC and update UI.
- **Completion Criteria:** Vendors can accept and mark orders ready directly from their web portal.

---

### Task 14: Automated State Machine & Concurrency Test Suite
- **Objective:** Develop comprehensive Vitest and SQL test suites verifying all valid transitions, blocking invalid transitions, testing pickup readiness gates, and verifying concurrency row locks.
- **Affected Files:**
  - Test: `src/test/phase10-order-operations.test.ts`
  - SQL: `supabase/tests/order_delivery_concurrency.sql`
- **Dependencies:** Tasks 1–11.
- **Security Considerations:** Verify race conditions (simultaneous assignment, concurrent cancellation).
- **Tests:** Run full suite with multiple concurrent workers.
- **Completion Criteria:** 100% pass rate on all state machine, security, and concurrency tests.

---

### Task 15: End-to-End Validation & Quality Gate Verification
- **Objective:** Run complete repository verification across TypeScript compilation, linter, test suite, and production build.
- **Affected Files:** All.
- **Dependencies:** Tasks 1–14.
- **Commands:**
  - `npx tsc -b`
  - `npm run lint`
  - `npm test`
  - `npm run build`
- **Completion Criteria:** Zero TypeScript errors, zero linter errors, all test files passing, and clean production build bundle.
