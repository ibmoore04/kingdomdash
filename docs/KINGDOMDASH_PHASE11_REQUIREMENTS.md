# KINGDOMDASH — PHASE 11: RIDER PLATFORM
# FUNCTIONAL & TECHNICAL REQUIREMENTS SPECIFICATION

**Document Version:** 2.0.0 (Server-Side Privacy Reconciled)  
**Status:** Mandatory Specification — Approved for Implementation  
**Execution Mode:** Architecture Correction & Implementation  
**Target Release:** KingdomDash Phase 11  
**Scope:** Authorized Rider Operations, Assignment Inbox, Custody Workflows, Navigation, Availability & Security  

---

## 1. Executive Summary & Objective

The objective of **Phase 11 — Rider Platform** is to deliver the operational interface and client-facing workflows for authorized KingdomDash dispatch riders. 

Phase 11 connects physical couriers to the server-authoritative **Phase 10 Order & Delivery Operations Engine**. It empowers verified riders to manage availability, evaluate dispatch assignments, accept/reject assignments, navigate to merchant pickups, confirm physical custody handoffs, navigate to customer destinations, report operational issues, and complete deliveries.

### Architectural Invariant: Zero Client State Authority
> [!IMPORTANT]
> **NO CLIENT-SIDE STATE TRANSITIONS & NO FRONTEND-ONLY PRIVACY MASKING:**  
> The Phase 11 Rider Platform **MUST NOT** duplicate the Phase 10 state machines (`orders`, `deliveries`, `delivery_assignments`). The frontend is strictly a visualization and execution layer that invokes authoritative Phase 10 & 21 PostgreSQL RPCs:
> - `update_rider_availability`
> - `accept_delivery_assignment`
> - `reject_delivery_assignment`
> - `mark_delivery_picked_up`
> - `mark_delivery_in_transit`
> - `mark_delivery_delivered`
> - `report_delivery_issue`
>
> Furthermore, pre-acceptance customer privacy is enforced **strictly at the database projection layer** (`get_rider_assignment_inbox()`). The browser never receives unmasked customer PII or exact destination coordinates before assignment acceptance.
>
> Direct table mutations (`INSERT`, `UPDATE`, `DELETE`) on operational tables from the frontend remain **strictly revoked**.

```
┌────────────────────────────────────────────────────────────────────────┐
│             PHASE 10 & 21: ORDER & DELIVERY OPERATIONS ENGINE          │
│   (Authoritative State Machines, Row Locks, Immutability Triggers)     │
└────────────────────────────────────────────────────────────────────────┘
                                    ▲
                   Authoritative RPC Calls & Controlled Projections
                                    │
┌────────────────────────────────────────────────────────────────────────┐
│                     PHASE 11: RIDER PLATFORM                           │
│                                                                        │
│   1. Rider Authentication, Role Verification & Active Account Guard    │
│   2. Server-Authoritative Availability Management (Default: Offline)   │
│   3. Privacy-Safe Assignment Inbox (get_rider_assignment_inbox)        │
│   4. Server-Enforced Pre-Acceptance Privacy (Zero PII to Browser)      │
│   5. Atomic Custody Transitions (Accept -> Pickup -> Transit -> Done)  │
│   6. Mobile-First Operational UI (Touch Targets, Contrast, Offline)    │
│   7. Maps, Distance Display & External Turn-by-Turn Navigation         │
│   8. Non-Mutating Operational Issue & Incident Reporting               │
│   9. Hardened RLS Scope & Tenant Isolation for Riders                  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Scope & Strict Phase Boundaries

### 2.1 In Scope for Phase 11
- **Rider Authentication & Role Gating:** Enforcing `role = 'rider'`, profile active checks (`is_active = true`), and verification checks (`is_verified = true`) via `RouteGuard` and `useCurrentRider`.
- **Rider Availability Management:** Server-authoritative toggling of `riders.is_available` (defaulting to `false` / offline) via `update_rider_availability(boolean)` with checks preventing unverified, inactive, or in-flight riders from going online.
- **Server-Side Privacy & Assignment Inbox:** Controlled projection `get_rider_assignment_inbox()` returning assignment offers with pickup areas, destination zones, distance estimates, and service types — with **zero customer name, zero customer phone, zero exact address, and zero exact destination coordinates**.
- **Tightened RLS on Core Tables:** Direct `SELECT` on `deliveries`, `orders`, and `order_items` restricted to deliveries where the rider's assignment is in `accepted` or `completed` status.
- **Authoritative Custody Handoffs:** Invoking Phase 10 RPCs for Accept, Reject, Pickup, In-Transit, and Delivered states with structured error handling (`KD409`, `KD403`, `KD404`).
- **Interactive Maps & Navigation:** Leaflet-based pickup and delivery location rendering using existing Phase 7/8 infrastructure, plus deep links to external navigation apps (Google Maps, Apple Maps).
- **Rider Dashboard & Delivery History:** Operational dashboard displaying today's summary metrics, active delivery card, assignment teaser, and historical completed deliveries via `get_rider_delivery_history()`.
- **Rider Operational Issue Reporting:** Dedicated non-mutating reporting RPC `report_delivery_issue` recording breadcrumbs to `delivery_status_updates` and `audit_logs` without granting cancellation authority.
- **Migration 021 Hardening:** Delivering `20260902000021_rider_platform.sql`.

### 2.2 Strictly Out of Scope (Phase Boundaries)
- **Phase 10 Modifications:** No changes to order/delivery status machines, payment confirmation logic, pricing rules, or courier ingestion RPCs.
- **Phase 12 (Admin Fleet Center):** Manual rider dispatch console, global fleet tracking map, manual rider verification approval UI, fleet-wide reassignments.
- **Phase 13 (External Notifications):** External SMS, WhatsApp, or Push notifications (Twilio, Termii, FCM). Phase 11 consumes in-app notifications from `public.notifications`.
- **Financial / Rider Wallet Payouts:** Rider payment disbursements, tip processing, bank account payouts, or earnings ledgers.

---

## 3. The Rider Lifecycle Model

The complete rider lifecycle connects initial onboarding to ongoing fulfillment:

```
[Rider Application Submitted] (Phase 2: rider_applications, status = 'pending')
              │
              ▼ (Phase 12 Admin Review)
[Admin Verification & Activation] (is_verified = true, is_active = true, role = 'rider')
              │
              ▼
[Rider Account Ready] (public.riders record established, is_available = false by default)
              │
              ├───► [Offline / Unavailable] (is_available = false)
              │           │
              │           ▼ (Rider toggles via update_rider_availability(true))
              └───► [Online & Available] (is_available = true, active deliveries = 0)
                          │
                          ▼ (Phase 10 Dispatch creates delivery_assignments row)
                    [Assignment Offered] (assignment = 'assigned', delivery = 'assigned')
                    (Exposed via get_rider_assignment_inbox: NO CUSTOMER PII)
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
    [Rider Rejects]             [Rider Accepts] (accept_delivery_assignment)
    (assignment = 'rejected',   (assignment = 'accepted', delivery = 'assigned')
     delivery = 'pending')              │
                                        ▼ (Full delivery details unmasked via get_rider_active_delivery)
                                [Package Picked Up] (mark_delivery_picked_up)
                                (delivery = 'picked_up', order = 'picked_up')
                                        │
                                        ▼ (Rider departs for destination)
                                [In Transit] (mark_delivery_in_transit)
                                (delivery = 'in_transit', order = 'in_transit')
                                        │
                                        ▼ (Customer receives package)
                                [Delivered / Fulfilled] (mark_delivery_delivered)
                                (delivery = 'delivered', order = 'delivered',
                                 assignment = 'completed', total_deliveries += 1)
                                        │
                                        ▼
                                [Active Delivery Cleared]
                                (Rider immediately eligible if is_available = true)
```

---

## 4. Rider Account Model & Anti-Privilege Escalation

### 4.1 Schema Separation: `profiles` vs `riders`

| Data Classification | Table | Fields | Authorization / Mutability Rules |
| :--- | :--- | :--- | :--- |
| **Core Identity** | `public.profiles` | `id`, `email`, `full_name`, `phone`, `avatar_url` | Rider self-service update permitted via `profiles_update_own` (RLS prevents role or active mutation). |
| **System Identity** | `public.profiles` | `role`, `is_active`, `created_at`, `updated_at` | **Admin-only**. Protected by `get_own_profile_flags()` constraint. |
| **Operational State** | `public.riders` | `is_available` | Rider-controlled **strictly** via `update_rider_availability(boolean)` RPC. Default: `false`. Direct table UPDATE revoked. |
| **Vetting & Status** | `public.riders` | `is_verified`, `is_active` | **Admin-only**. Cannot be modified by rider. Checked by RPCs before going online or accepting jobs. |
| **Vehicle Snapshot** | `public.riders` | `vehicle_type` | Initially populated from approved application. Modifiable only by admin. |
| **Performance Stats** | `public.riders` | `rating`, `total_deliveries` | **System-controlled**. Incremented atomically by `mark_delivery_delivered` RPC. Immutable to riders. |

### 4.2 Privilege Escalation Defense
1. Direct `UPDATE` on `public.riders` is **revoked** from `authenticated`.
2. `update_rider_availability` verifies that caller owns the rider row (`profile_id = auth.uid()`) and checks `is_verified = true` and `is_active = true` before allowing `is_available = true`.
3. Direct `UPDATE` on `public.profiles` is gated by RLS `WITH CHECK (role = (SELECT p_role FROM get_own_profile_flags()) AND is_active = (SELECT p_is_active FROM get_own_profile_flags()))`.

---

## 5. Rider Availability Architecture

### 5.1 Storage & Modification Authority
- Stored as `public.riders.is_available boolean NOT NULL DEFAULT false`.
- Mutated exclusively via `update_rider_availability(p_is_available boolean)`.
- Updates `updated_at` and records an operational audit log entry.

### 5.2 State Rules & Concurrency Invariants
1. **Unverified / Suspended Block:** If `p_is_available = true` but `riders.is_verified = false` or `riders.is_active = false`, the RPC raises SQLSTATE `KD403`.
2. **Active Delivery In-Flight Block:** If `p_is_available = true` while an active delivery is currently in flight (`accepted` assignment on `assigned`, `picked_up`, or `in_transit` delivery), the RPC raises SQLSTATE `KD409`.
3. **Offline While Active:** A rider **may** set `is_available = false` while in the middle of an active delivery. This signals the dispatch engine not to offer subsequent assignments once the current delivery is completed.
4. **Dispatch Eligibility Invariant:** In Phase 10, dispatch verifies:
   $$\text{Eligible} \iff (\text{is\_verified} \land \text{is\_active} \land \text{is\_available} \land \text{in\_flight\_deliveries} = 0)$$
5. **Post-Completion State:** `mark_delivery_delivered` completes the active assignment (`status = 'completed'`). The rider's active count immediately drops to 0. If `is_available` is still `true`, the rider is automatically ready for new assignments without manual interaction.

---

## 6. Server-Side Assignment Inbox & Privacy Protection

### 6.1 Server-Side Enforcement (No Frontend Masking Boundary)
> [!IMPORTANT]
> The browser **never receives** unmasked customer PII before assignment acceptance.
> The inbox reads strictly via `get_rider_assignment_inbox()`. Direct SELECT on `deliveries`, `orders`, and `order_items` is denied by RLS until `delivery_assignments.status IN ('accepted', 'completed')`.

### 6.2 Pre-Acceptance Data Projection Matrix

| Data Attribute | Before Acceptance (`get_rider_assignment_inbox`) | After Acceptance (`get_rider_active_delivery`) | Security / Privacy Boundary |
| :--- | :--- | :--- | :--- |
| **Pickup Area** | General address / vendor address | Full street address + unit | Safe for route evaluation |
| **Pickup Coordinates** | Lat/Lon coordinates | Lat/Lon coordinates | Safe merchant navigation |
| **Vendor Name** | Visible (e.g. "Mama Put Kitchen") | Visible + Vendor Contact Phone | Evaluates merchant trip |
| **Destination Area** | Neighborhood name only (e.g. "Molipa") | Full street address + unit notes | **Server-side projected via `split_part`** |
| **Destination Coordinates** | **NULL / Excluded from query** | Exact Lat/Lon marker | **Zero exact coords before acceptance** |
| **Customer Name** | **NULL / Excluded from query** | Full Customer Name | **Zero customer PII before acceptance** |
| **Customer Phone** | **NULL / Excluded from query** | **Visible / Tap to Call** | **Zero customer PII before acceptance** |
| **Service Type** | Visible (`food`, `grocery`, `courier`) | Visible | Cargo capacity evaluation |
| **Estimated Distance** | Server-calculated distance (km) | Exact route distance | Trip evaluation |
| **Special Instructions** | "Special instructions provided" flag | Full customer instructions | Masked until accepted |

---

## 7. Accept / Reject Flow & Concurrency Defense

### 7.1 Authoritative Phase 10 RPC Contracts
The frontend must invoke Phase 10 RPCs directly:
1. `accept_delivery_assignment(p_assignment_id uuid)`
2. `reject_delivery_assignment(p_assignment_id uuid, p_reason text DEFAULT NULL)`

### 7.2 Assignment Expiry / 60-Second Countdown
- The 60-second visual countdown on incoming offers is **strictly UX guidance** to encourage timely courier responses.
- The server remains authoritative. If the countdown expires and the rider has not accepted, the client can prompt an auto-decline or the rider can manually decline. The client **never** declares an assignment expired unless the server returns `KD409`.

### 7.3 Concurrency & Stale UI Handling
- **Idempotent Acceptance:** If the rider taps "Accept" multiple times, the Phase 10 RPC returns gracefully without duplicate state mutation.
- **Race Condition / Reassignment:** If another dispatcher or timeout reassigns or cancels the delivery, the RPC raises `KD409` (`Cannot accept assignment in status...`). The frontend catches this, displays an alert (*"This assignment is no longer available"*), and refreshes the inbox.
- **Rejection Reversion:** Calling `reject_delivery_assignment` atomically marks the assignment `rejected` and returns `deliveries.status` to `pending` so other riders can receive it.

---

## 8. Pickup Workflow & Vendor Preparation Gate

### 8.1 Contract & Preconditions
- Frontend invokes: `mark_delivery_picked_up(p_delivery_id uuid, p_notes text DEFAULT NULL)`.
- **Food & Grocery Orders:** Order must strictly be in `ready_for_pickup`. If rider attempts pickup while vendor is still `preparing`, the RPC fails with SQLSTATE `KD409` (`Order is still being prepared by vendor`).
- **Courier Orders:** Bypasses vendor prep stages; order requires `payment_confirmed`.
- **Custody Handoff:** Atomically sets `deliveries.status = 'picked_up'`, `orders.status = 'picked_up'`, and timestamps `picked_up_at`.

### 8.2 Rider UI Workflow
1. Rider views accepted delivery via `get_rider_active_delivery()`.
2. For `food` or `grocery`, the UI displays a live badge of vendor status (`preparing` vs `ready_for_pickup`).
3. If vendor is still `preparing`, the "Confirm Pickup" button is disabled with a helpful caption: *"Waiting for vendor to mark package ready"*.
4. Once `ready_for_pickup` (or for `courier`), the rider taps "Confirm Pickup", optionally adding pickup notes.

---

## 9. Transit & Completion Workflows

### 9.1 Transit Workflow
- Frontend invokes: `mark_delivery_in_transit(p_delivery_id uuid, p_notes text DEFAULT NULL)`.
- Preconditions enforced by server:
  - Delivery is currently `picked_up`.
  - Order is currently `picked_up`.
  - Caller is the assigned rider on an `accepted` assignment.
- Outcome: Atomically transitions Delivery and Order to `in_transit`. UI shifts map to customer destination coordinates.

### 9.2 Completion Workflow
- Frontend invokes: `mark_delivery_delivered(p_delivery_id uuid, p_notes text DEFAULT NULL)`.
- Preconditions enforced by server:
  - Delivery and Order are currently `in_transit`.
  - Caller is the assigned rider on an `accepted` assignment.
- Outcome:
  - `deliveries.status = 'delivered'` and `orders.status = 'delivered'`.
  - `delivery_assignments.status = 'completed'`.
  - `riders.total_deliveries` incremented atomically by 1.
  - Delivery status breadcrumb inserted into `delivery_status_updates`.
- Post-Completion UI: Displays completion celebration screen with trip summary, refetches profile and history, and routes back to Dashboard where availability is maintained.

---

## 10. Location, Maps & External Navigation

### 10.1 Existing Infrastructure Reuse
- Uses Leaflet and the existing `LocationMap` component (`src/components/map/location-map.tsx`).
- Uses `calculate_distance_km` and `IJEBU_ODE_CENTER` from `src/utils/geo.ts`.
- Zero new mapping libraries or duplicated map engines.

### 10.2 Navigation Views
1. **Pickup View:** Focuses map on pickup coordinates with merchant pin and estimated distance from current position.
2. **Destination View:** Once package is `picked_up` or `in_transit`, map shifts to exact destination coordinates with recipient dropoff pin.
3. **External Turn-by-Turn Navigation:** Deep links using standard device URL schemes:
   - Universal Web: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
   - Apple Maps fallback: `https://maps.apple.com/?daddr={lat},{lng}`

---

## 11. Operational Exceptions & Incident Reporting

### 11.1 Authority Classification

| Exception Type | Rider Authority | System Action | Authoritative Endpoint |
| :--- | :--- | :--- | :--- |
| **Merchant Delay** | Report only | Inserts status update breadcrumb; notifies operations | `report_delivery_issue` (Migration 021) |
| **Customer Unreachable** | Report only | Records call attempt breadcrumb; logs audit event | `report_delivery_issue` (Migration 021) |
| **Wrong Address** | Report only | Flags delivery for dispatcher review | `report_delivery_issue` (Migration 021) |
| **Vehicle Breakdown** | Report only | Alerts dispatch for manual reassignment | `report_delivery_issue` (Migration 021) |
| **Cancellation** | **None** | Barred. Riders cannot cancel deliveries or orders | Admin/Dispatcher only (`cancel_order_operational`) |
| **Rerouting** | **None** | Barred. Snapshot immutability prevents address edits | Admin exception only |

---

## 12. Security & RLS Model (Least Privilege)

### 12.1 Table Permissions Matrix for Rider

| Table | SELECT | INSERT | UPDATE | DELETE | Authority Mechanism |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `profiles` | Own only | ❌ | Own profile | ❌ | RLS (`profiles_update_own` restricts role/is_active changes) |
| `riders` | Own only | ❌ | ❌ (Revoked) | ❌ | Mutated **only** via `update_rider_availability` RPC |
| `orders` | Accepted orders only | ❌ (Revoked) | ❌ (Revoked) | ❌ | RLS `orders_select_rider` (accepted/completed only). Mutated via RPCs |
| `order_items` | Accepted orders only | ❌ (Revoked) | ❌ (Revoked) | ❌ | RLS `order_items_select_rider` (accepted/completed only) |
| `deliveries` | Accepted deliveries only | ❌ (Revoked) | ❌ (Revoked) | ❌ | RLS `deliveries_select_rider` (accepted/completed only). Mutated via RPCs |
| `delivery_assignments`| Own assignments | ❌ (Revoked) | ❌ (Revoked) | ❌ | RLS `assignments_select_rider`. Mutated via Phase 10 RPCs |
| `delivery_status_updates`| Assigned deliveries| ❌ (Revoked) | ❌ (Revoked) | ❌ | RLS `updates_select_operational`. Inserted via RPCs |
| `notifications` | Own only | ❌ | ❌ (Revoked) | ❌ | Read via `getMyNotifications`, marked via `mark_notification_read` |
| `audit_logs` | ❌ (Admin only) | ❌ | ❌ | ❌ | Never exposed to riders. Appended via server RPCs |

---

## 13. Testable Acceptance Criteria

- **AC-11-01 (Role & Verification Gate):** A user with `role != 'rider'` or `riders.is_verified = false` is barred from active rider views and receives the appropriate pending/unauthorized notice.
- **AC-11-02 (Availability Toggle Security):** Unverified, deactivated, or in-flight riders attempting to call `update_rider_availability(true)` receive SQLSTATE `KD403` or `KD409`. Verified active riders without active trips can successfully toggle online/offline.
- **AC-11-03 (Inbox Pre-Acceptance Server-Side Privacy):** Querying `get_rider_assignment_inbox()` strictly omits customer phone number, customer name, and exact destination coordinates. Direct `SELECT` on `deliveries` and `orders` fails with 0 rows for unaccepted assignments.
- **AC-11-04 (Accept Assignment):** Calling `accept_delivery_assignment` transitions assignment to `accepted` and unmasks complete delivery details in `get_rider_active_delivery()`.
- **AC-11-05 (Reject Assignment):** Calling `reject_delivery_assignment` transitions assignment to `rejected` and returns delivery to `pending`.
- **AC-11-06 (Pickup Vendor Readiness Gate):** For food/grocery, calling `mark_delivery_picked_up` while order is in `preparing` fails with SQLSTATE `KD409`. Calling it when `ready_for_pickup` succeeds.
- **AC-11-07 (Transit Transition):** Calling `mark_delivery_in_transit` transitions both order and delivery to `in_transit`. Attempting it before pickup fails with `KD409`.
- **AC-11-08 (Delivery Completion):** Calling `mark_delivery_delivered` transitions order and delivery to `delivered`, closes assignment to `completed`, increments `total_deliveries` by 1 on the server, and leaves rider eligible for new dispatches.
- **AC-11-09 (Issue Reporting):** Calling `report_delivery_issue` inserts a breadcrumb into `delivery_status_updates` without changing delivery status and logs an operational audit event.
- **AC-11-10 (Zero Direct Table Mutation):** Direct SQL `UPDATE` or `INSERT` attempts on `orders`, `deliveries`, `delivery_assignments`, or `delivery_status_updates` fail under RLS/grant revocation.
