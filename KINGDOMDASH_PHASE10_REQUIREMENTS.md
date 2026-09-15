# KINGDOMDASH — PHASE 10: ORDER & DELIVERY OPERATIONS
# FUNCTIONAL & TECHNICAL REQUIREMENTS SPECIFICATION

**Document Version:** 2.0.0 (Master Correction Reconciled)  
**Status:** Mandatory Pre-Implementation Specification — Approved for Final Review  
**Execution Mode:** Planning / Architecture Only (Implementation NOT Authorized)  
**Target Release:** KingdomDash Phase 10  
**Scope:** Server-Authoritative Operational Engine, Multi-State Lifecycle, Fulfillment & Dispatch Contracts  

---

## 1. Executive Summary & Objective

The objective of **Phase 10 — Order & Delivery Operations** is to establish the authoritative, server-enforced operational lifecycle of a KingdomDash order following checkout creation and Paystack payment confirmation.

Phase 10 governs the transition of commercial commitments into physical fulfillment across three distinct operational layers:
1. **Commercial Lifecycle (Order State Machine):** Tracking customer obligations, payment confirmations, and terminal fulfillment.
2. **Logistics Lifecycle (Delivery State Machine):** Tracking physical packages, location snapshots, and custody transfers.
3. **Dispatch & Assignment Lifecycle (Assignment State Machine):** Tracking rider invitations, acceptances, rejections, and completion metrics.

```
CUSTOMER CHECKOUT (Phases 6–8)
       │
       ▼
PAYSTACK PAYMENT CONFIRMATION (Phase 9)
       │
       ▼
┌────────────────────────────────────────────────────────────────────────┐
│             PHASE 10: ORDER & DELIVERY OPERATIONS ENGINE               │
│                                                                        │
│   1. Three Separated State Machines (Order, Delivery, Assignment)      │
│   2. Automatic Delivery Creation & Database-Enforced Immutability      │
│   3. Vendor Fulfillment Controls & Preparation Lifecycle               │
│   4. Deterministic Dispatch Timing & Rider Assignment Engine           │
│   5. Dedicated Assignment Acceptance / Rejection Operations            │
│   6. Atomic Custody Handoff RPCs (NO Generic Sync Triggers)            │
│   7. Courier Ingestion & Direct-Dispatch Logistics Path                │
│   8. Role-Gated Cancellation & Explicit "Refund Required" Marker       │
│   9. Hardened RLS, Tenant Isolation & Trusted Operational Auditing     │
└────────────────────────────────────────────────────────────────────────┘
       │                                │                                │
       ▼                                ▼                                ▼
PHASE 11: RIDER PLATFORM        PHASE 12: ADMIN CENTER          PHASE 13: NOTIFICATIONS
(Mobile App & GPS Tracking)     (Back-Office Fleet Control)     (SMS, Push & WhatsApp)
```

---

## 2. Project Scope & Strict Phase Boundaries

### 2.1 In Scope for Phase 10
- **Three Discrete State Machines:** Independent state machines for Orders, Deliveries, and Assignments with deterministic, documented transitions.
- **Atomic Transition RPCs:** Server-authoritative PostgreSQL functions executing multi-table status transitions within explicit transactions. (Generic bidirectional triggers are strictly barred).
- **Idempotent Delivery Instantiation:** Database-enforced creation of exactly one `public.deliveries` record per paid order upon `orders.status = 'payment_confirmed'`.
- **Database-Enforced Snapshot Immutability:** Revocation of direct client `UPDATE` permissions on delivery snapshots (`pickup_address`, `delivery_address`, customer contact, financial totals).
- **Explicit Dispatch Timing Model:** Defined eligibility for assignment during vendor preparation (`preparing` or `ready_for_pickup`) with strict server-enforced block on physical pickup until `ready_for_pickup`.
- **Dedicated Assignment Acceptance & Rejection:** Standalone transactional RPCs managing rider responses, delivery status reversions, and reassignment queuing.
- **Authoritative Courier Pathway:** Dedicated server-side RPC `create_courier_order_secure` resolving the existing courier order ingestion gap.
- **Role-Gated Cancellation & Refund Marker:** Granular cancellation rules for Customers, Vendors, and Admins, flagging post-payment cancellations as `refund_required = true` without falsely claiming refund execution.
- **Server-Enforced Vendor Tenant Isolation:** Cryptographically authenticating `vendors.profile_id = auth.uid()` on all vendor operations and barring any commercial order modifications.
- **Trusted Operational Audit Trail:** Append-only auditing with server-derived request context (never trusting client-supplied IPs or user agents).
- **Customer Tracking & Vendor Operational UI:** Read-only progress tracker for customers and an operational fulfillment tab for vendors.

### 2.2 Strictly Out of Scope (Phase Boundaries)
- **Phase 11 (Rider Platform):** Dedicated rider mobile application, live GPS polling/broadcasting, turn-by-turn routing, rider onboarding UI, wallet/earnings payouts.
- **Phase 12 (Admin Control Center):** Global fleet map dashboard, manual ledger adjustment UI, back-office analytics, visual dispatch console.
- **Phase 13 (Notifications & Supporting Systems):** External notification delivery (Twilio/Termii SMS, Firebase Cloud Messaging, WhatsApp Business API). Phase 10 produces database records and audit entries only.
- **Financial Refund Engine:** Automatic Paystack chargeback or refund execution. Phase 10 records operational/financial intent via `refund_required`; refund disbursement belongs to a future financial admin workflow.

---

## 3. The Three Separated State Machines

### 3.1 Order State Machine (Commercial / Customer Lifecycle)
Represents the commercial transaction between the customer, KingdomDash, and the merchant:
```
[pending] ───────────────► [cancelled] (Customer abandon / Cart reset)
   │
   ▼
[payment_pending] ───────► [cancelled] (Payment failure / Timeout)
   │
   ▼
[payment_processing]
   │
   ▼
[payment_confirmed] ─────► [cancelled] (Vendor rejection / Out of stock -> refund_required)
   │ (Auto Delivery Instantiated)
   ▼
[preparing] ─────────────► [cancelled] (Unresolvable merchant issue -> refund_required)
   │
   ▼
[ready_for_pickup] ──────► [cancelled] (Admin exception only -> refund_required)
   │
   ▼
[picked_up] ─────────────► [cancelled] (Admin critical incident only -> refund_required)
   │
   ▼
[in_transit] ────────────► [cancelled] (Admin critical incident only -> refund_required)
   │
   ▼
[delivered] (Terminal Success)
```

### 3.2 Delivery State Machine (Logistics / Custody Lifecycle)
Represents the physical packaging, transportation, and custody:
```
[pending] (Awaiting Rider Assignment) ────────► [cancelled]
   │
   ▼
[assigned] (Rider assigned; awaiting pickup) ──► [pending] (If rider rejects)
   │                                          │
   │                                          └──► [cancelled]
   ▼
[picked_up] (In rider physical custody) ───────► [cancelled] (Admin incident)
   │
   ▼
[in_transit] (Heading to recipient) ───────────► [cancelled] (Admin incident)
   │
   ▼
[delivered] (Terminal Success)
```

### 3.3 Assignment State Machine (Rider Relationship Lifecycle)
Represents the individual invitation/contract between a delivery and an assigned rider:
```
[assigned] (Dispatched to Rider)
   ├───► [accepted] (Rider agrees to fulfill)
   │        │
   │        ▼
   │     [completed] (Delivery marked delivered)
   │
   └───► [rejected] (Rider declines; delivery reverts to pending)
```

*Architectural Axiom:* `delivery.status = 'assigned'` and `assignment.status = 'accepted'` are distinct and concurrent. A rider accepting an assignment does **NOT** mean the package has been picked up.

---

## 4. Authoritative State Transition Matrix

| Entity | Current State | Allowed Next State | Authorized Actor | Preconditions & Validation | Side Effects & Immutability Rules |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Order** | `pending` | `payment_pending` | Customer / System | Order created via secure RPC | Generates payment session |
| **Order** | `payment_pending`| `payment_confirmed` | Paystack Webhook / Reconcile | Paystack transaction `status = 'success'` | Creates `deliveries` record (`pending`); sets `confirmed_at` |
| **Order** | `payment_confirmed`| `preparing` | Vendor | Vendor owns order; service type in (`food`, `grocery`) | Sets `preparing_at`; emits audit log |
| **Order** | `preparing` | `ready_for_pickup` | Vendor | Vendor owns order; current status `preparing` | Sets `ready_at`; satisfies pickup condition |
| **Order** | `ready_for_pickup`| `picked_up` | Rider (via RPC) | Delivery is `assigned`, assignment is `accepted`, caller is assigned rider | Sets `picked_up_at`; updates delivery in same tx |
| **Order** | `payment_confirmed`| `picked_up` *(Courier)* | Rider (via RPC) | Service type is `courier`; caller is assigned rider | Sets `picked_up_at`; skips prep stages |
| **Order** | `picked_up` | `in_transit` | Rider (via RPC) | Current status is `picked_up`; caller is assigned rider | Sets `in_transit_at`; updates delivery in same tx |
| **Order** | `in_transit` | `delivered` | Rider (via RPC) | Current status is `in_transit`; caller is assigned rider | Sets `delivered_at`; closes assignment to `completed` |
| **Order** | Any (pre-delivered)| `cancelled` | Role-Specific | Meets cancellation authority matrix (Section 6) | Sets `cancelled_at`, records `cancellation_reason`, flags `refund_required` if paid |
| **Delivery**| `pending` | `assigned` | Dispatcher / Admin | Target rider verified, active, and available | Creates `delivery_assignments` row (`assigned`); locks delivery row |
| **Delivery**| `assigned` | `pending` | Rider (via Reject RPC) | Current assignment rejected; no other active assignment | Re-enters dispatch queue for reassignment |
| **Delivery**| `assigned` | `picked_up` | Rider (via Pickup RPC)| Assignment is `accepted`; order is `ready_for_pickup` (or courier) | Physical custody handoff; sets `picked_up_at` |
| **Delivery**| `picked_up` | `in_transit` | Rider (via Transit RPC)| Current status `picked_up` | Sets `in_transit_at` |
| **Delivery**| `in_transit` | `delivered` | Rider (via Deliver RPC)| Current status `in_transit` | Sets `delivered_at`; updates order to `delivered` |
| **Delivery**| Pre-transit | `cancelled` | Role-Specific | Order cancelled | Delivery cancelled; open assignments marked rejected |
| **Assignment**| `assigned`| `accepted` | Assigned Rider | Assignment owned by rider; current status `assigned` | Sets `responded_at`; delivery remains `assigned` |
| **Assignment**| `assigned`| `rejected` | Assigned Rider | Assignment owned by rider; current status `assigned` | Sets `responded_at`; delivery reverts to `pending` |
| **Assignment**| `accepted`| `completed` | Rider / System | Invoked during `mark_delivery_delivered` | Marks assignment fulfilled |

---

## 5. Elimination of Generic Status Synchronization

> [!IMPORTANT]
> **NO GENERIC BIDIRECTIONAL TRIGGERS:**  
> The previously proposed `trg_fn_sync_delivery_to_order()` trigger is completely eliminated. Order and delivery entities represent distinct business concepts and cannot be joined via automatic mirror triggers.

### The Atomic Transition RPC Architecture
All operational movements spanning Order, Delivery, and Assignment records must occur inside explicit, dedicated PostgreSQL `SECURITY DEFINER` RPCs:
1. `mark_delivery_picked_up(p_delivery_id, p_notes)`
2. `mark_delivery_in_transit(p_delivery_id, p_notes)`
3. `mark_delivery_delivered(p_delivery_id, p_notes)`
4. `cancel_order_operational(p_order_id, p_reason)`

Each RPC:
- Acquires a row-level lock on the delivery and order.
- Validates all preconditions across both entities.
- Mutates the delivery and order records explicitly within a single database transaction.
- Records structured operational audit entries.
- Raises explicit SQLSTATE exceptions on failure (e.g. `KD409`, `KD403`, `KD404`).

---

## 6. Order Cancellation & Refund Boundary

### 6.1 Cancellation Authority Matrix
- **Customer Cancellation:** Permitted **ONLY** when `orders.status IN ('pending', 'payment_pending')`. Once payment is confirmed, customer self-service cancellation is disabled.
- **Vendor Rejection / Cancellation:** Permitted **ONLY** when `orders.status = 'payment_confirmed'` (before `preparing` commences), requiring a mandatory rejection reason.
- **Admin / Dispatcher Cancellation:** Permitted at any stage prior to `delivered`. Post-custody cancellation (`picked_up` or `in_transit`) is reserved for critical operational exceptions.

### 6.2 The "Refund Required" Boundary
- Phase 10 **DOES NOT** execute Paystack refunds.
- If a paid order (`orders.status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit')`) is cancelled, the RPC must set:
  ```sql
  refund_required = TRUE,
  refund_status = 'pending_manual_review'
  ```
- **Axiom:** `refund_required != refund_processed`. The system must never inform the customer that a refund has been issued until an authorized admin or future financial engine processes it.

---

## 7. Service-Type Workflows & Courier Resolution

### 7.1 Food & Grocery Lifecycle
1. Customer pays → `payment_confirmed` → Delivery instantiated (`pending`).
2. Vendor acknowledges → `update_order_status_vendor('preparing')`.
3. Dispatch may assign rider in parallel (`assigned`), but rider **CANNOT** pick up package yet.
4. Vendor completes prep → `update_order_status_vendor('ready_for_pickup')`.
5. Rider arrives and invokes `mark_delivery_picked_up()` → Both Order and Delivery enter `picked_up`.
6. Rider invokes `mark_delivery_in_transit()` → Both Order and Delivery enter `in_transit`.
7. Rider invokes `mark_delivery_delivered()` → Order and Delivery enter `delivered`, Assignment marked `completed`.

### 7.2 Courier Direct-Dispatch Lifecycle
- **Courier Ingestion Gap Resolved:** Courier ordering will be served by an authoritative server RPC `create_courier_order_secure`:
  - Validates sender profile, recipient phone/name, pickup address + coordinates, delivery address + coordinates.
  - Verifies service area and calculates distance-based pricing.
  - Creates an order with `service_type = 'courier'`, `vendor_id = NULL`, `subtotal = 0`, `total = delivery_fee`.
  - Upon payment confirmation, auto-delivery creation instantiates a delivery in `pending` status.
  - Skips `preparing` and `ready_for_pickup`.
  - Immediately dispatchable and eligible for rider pickup upon assignment acceptance.

---

## 8. Dispatch Timing, Rider Eligibility & Concurrency

### 8.1 Explicit Dispatch Timing Decision
- **Assignment Allowed During Preparation:** A delivery becomes dispatchable (`pending` → `assigned`) as soon as the order is `payment_confirmed` or `preparing`. This enables the rider to travel to the restaurant while food is being prepared.
- **Strict Pickup Gate:** The RPC `mark_delivery_picked_up()` enforces that for `food` and `grocery`, the order must strictly be in `ready_for_pickup`. If the rider attempts pickup while the order is still `preparing`, the RPC rejects the transition with SQLSTATE `KD409` (`Order is still being prepared by vendor`).

### 8.2 Rider Eligibility Constraints
The server must verify all of the following inside `assign_delivery_to_rider()`:
1. `riders.is_verified = TRUE`
2. `riders.is_active = TRUE`
3. `riders.is_available = TRUE`
4. Rider has `0` active assignments currently in `status IN ('assigned', 'accepted')` where the linked delivery is not `delivered` or `cancelled`.

### 8.3 Concurrency & Idempotency Rules
- **Row Locking:** `assign_delivery_to_rider()` acquires `SELECT ... FOR UPDATE` on `public.deliveries` to ensure the delivery is in status `'pending'` or has no active accepted assignment.
- **Idempotent Retries:** Re-calling `accept_delivery_assignment()` on an already accepted assignment returns success without state mutation. Re-calling `mark_delivery_delivered()` on an already delivered order returns success without duplicating audit logs or side effects.

---

## 9. Security, RLS & Tenant Isolation

1. **Vendor Tenant Isolation:** All vendor operations strictly match `orders.vendor_id = (SELECT id FROM vendors WHERE profile_id = auth.uid())`. A vendor can never view or update another vendor's order.
2. **Commercial Truth Protection:** Vendor RPCs have zero parameters for line items, quantities, prices, fees, or addresses. Direct `UPDATE` permissions on `orders` and `deliveries` tables are completely revoked for the `authenticated` role.
3. **Customer Privacy:** Customers can only view deliveries linked to their own `orders.customer_id = auth.uid()`. Customer tracking views expose only the rider's first name, vehicle type, and phone number (once assigned).
4. **Trusted Metadata:** Sensitive request metadata (`ip_address`, `user_agent`) recorded in audit logs must be extracted from trusted server/Supabase request context headers, never accepted as client payload arguments.

---

## 10. Testable Acceptance Criteria

- **AC-10-01 (State Machine Separation):** Verify that an order in `preparing` with an assigned delivery and accepted assignment maintains distinct states across all three tables (`orders.status = 'preparing'`, `deliveries.status = 'assigned'`, `delivery_assignments.status = 'accepted'`).
- **AC-10-02 (No Generic Triggers):** Verify that directly modifying `deliveries.status` via SQL does NOT trigger recursive or unvalidated updates on `orders`.
- **AC-10-03 (Delivery Creation Idempotency):** Simulating payment confirmation twice for the same order creates exactly 1 row in `deliveries`.
- **AC-10-04 (Pickup Readiness Gate):** For food orders, calling `mark_delivery_picked_up` while order is in `preparing` fails with SQLSTATE `KD409`. Calling it when order is in `ready_for_pickup` succeeds and transitions both order and delivery to `picked_up`.
- **AC-10-05 (Assignment Acceptance/Rejection):** A rider accepting an assignment moves assignment to `accepted` while delivery remains `assigned`. A rider rejecting an assignment moves assignment to `rejected` and returns delivery to `pending`.
- **AC-10-06 (Courier Flow):** A courier order skips `preparing` and `ready_for_pickup`, successfully executing `payment_confirmed → picked_up → in_transit → delivered`.
- **AC-10-07 (Cancellation & Refund Marker):** Cancelling a paid order sets `status = 'cancelled'`, `refund_required = TRUE`, and logs the actor and reason without executing an automatic Paystack refund.
- **AC-10-08 (Vendor Isolation & Immutability):** A vendor attempting to update an order of another store receives SQLSTATE `KD403`. A vendor has no mechanism to modify item quantities, prices, or delivery fees.
- **AC-10-09 (Concurrency Defense):** Concurrent assignment attempts to two different riders result in exactly 1 success and 1 deterministic SQLSTATE `KD409` error.
