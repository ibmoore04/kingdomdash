# KINGDOMDASH — PHASE 11: RIDER PLATFORM
# STEP-BY-STEP IMPLEMENTATION TASKS SPECIFICATION

**Document Version:** 2.0.0 (Server-Side Privacy Reconciled)  
**Status:** Mandatory Specification — Approved for Implementation  
**Execution Mode:** Architecture Correction & Implementation  
**Target Release:** KingdomDash Phase 11  
**Total Tasks:** 15 Tasks (T1 through T15)  

---

## Task Dependency Graph

```
[T1: Schema & Security Audit]
         │
         ▼
[T2: Migration 021 Hardening (Projections, Tightened RLS, RPCs)]
         │
         ▼
[T3: Domain Models & Service Layer Contracts (Controlled RPC Clients)]
         │
         ▼
[T4: useCurrentRider Hook & Route Guard Hardening]
         │
         ├───► [T5: Availability Management (Default Offline)]
         │
         ├───► [T6: Privacy-Safe Assignment Inbox (get_rider_assignment_inbox)]
         │        │
         │        ▼
         │     [T7: Accept / Reject Authoritative Flow]
         │        │
         │        ▼
         │     [T8: Pickup Workflow & Vendor Readiness Gate]
         │        │
         │        ▼
         │     [T9: Transit Workflow & Destination Mode]
         │        │
         │        ▼
         │     [T10: Delivery Completion Workflow (Server-Side Total Delivery Increment)]
         │
         ├───► [T11: Rider Dashboard & Operational KPIs]
         │
         ├───► [T12: Delivery History & Past Trips (get_rider_delivery_history)]
         │
         ├───► [T13: Maps & External Turn-by-Turn Nav]
         │
         └───► [T14: Operational Issue Reporting UX (report_delivery_issue)]
                  │
                  ▼
         [T15: Automated Testing & Validation Suite]
```

---

## Detailed Task Breakdown

### T1 — Rider Schema & Security Audit
- **Goal:** Verify that existing migrations (002, 007, 011, 013, 014, 020) and PostgreSQL objects align with Phase 11 requirements.
- **Actions:**
  - Verify that `riders.is_available`, `riders.is_verified`, `riders.is_active`, and `riders.total_deliveries` columns exist.
  - Verify that direct table mutation (`INSERT`, `UPDATE`, `DELETE`) on `deliveries`, `delivery_assignments`, and `riders` is revoked from `authenticated`.
  - Confirm that Phase 10 RPCs (`accept_delivery_assignment`, `reject_delivery_assignment`, `mark_delivery_picked_up`, `mark_delivery_in_transit`, `mark_delivery_delivered`) are fully compiled and callable.
- **Verification:** Execute static schema check against local PostgreSQL migration files.

---

### T2 — Rider Migration 021 (Projections, Tightened RLS & RPCs)
- **Goal:** Prepare Migration `20260902000021_rider_platform.sql`.
- **Actions:**
  - Shift default availability to offline (`ALTER TABLE public.riders ALTER COLUMN is_available SET DEFAULT false`).
  - Create composite index `idx_delivery_assignments_rider_status ON public.delivery_assignments (rider_id, status)`.
  - Tighten RLS SELECT policies on `deliveries`, `orders`, and `order_items` so riders cannot query full rows unless assignment is in `('accepted', 'completed')`.
  - Install controlled read projections: `get_rider_assignment_inbox()`, `get_rider_active_delivery()`, `get_rider_delivery_history()`, `get_rider_operational_profile()`.
  - Replace `update_rider_availability` with hardened checks (`is_verified = true`, `is_active = true`, in-flight conflict check, audit log).
  - Install `report_delivery_issue(p_delivery_id, p_issue_type, p_notes)` SECURITY DEFINER RPC.
  - Revoke public execution and grant to `authenticated`.
- **Verification:** Static SQL syntax and structure validation suite.

---

### T3 — Rider Domain Models & Service Layer Architecture
- **Goal:** Create typed interfaces and service modules under `src/types/rider.ts` and `src/services/rider/`.
- **Actions:**
  - Define `RiderProfile`, `AssignmentInboxOffer`, `ActiveDeliveryDetails`, `CompletedDeliveryHistoryItem`, `OperationalIssueType`.
  - Implement `src/services/rider/rider-service.ts` (`getRiderOperationalProfile`, `updateRiderAvailability`).
  - Implement `src/services/rider/assignment-service.ts` (`getRiderAssignmentInbox`, `acceptDeliveryAssignment`, `rejectDeliveryAssignment`).
  - Implement `src/services/rider/custody-service.ts` (`getRiderActiveDelivery`, `markDeliveryPickedUp`, `markDeliveryInTransit`, `markDeliveryDelivered`).
  - Implement `src/services/rider/exception-service.ts` (`reportDeliveryIssue`).
  - Implement `src/services/rider/history-service.ts` (`getRiderDeliveryHistory`).
- **Verification:** Run `npx tsc -b` to guarantee zero type errors.

---

### T4 — `useCurrentRider` Context Hook & Route Protection
- **Goal:** Provide reactive, validated rider context to all rider routes.
- **Actions:**
  - Implement `src/hooks/use-current-rider.ts` using `getRiderOperationalProfile()`.
  - Check `profile.role === 'rider'`.
  - Expose `rider`, `isLoading`, `error`, `isPendingApproval`, `refreshRider`.
  - Update `src/App.tsx` rider routes under `<RouteGuard allowedRoles={['rider']} />`.
  - Implement `RiderPendingView` component for riders awaiting admin verification.
- **Verification:** Unit tests verifying redirect for unauthenticated users, non-rider roles, and pending riders.

---

### T5 — Rider Availability Management & Online Switch
- **Goal:** Build the UI toggle allowing verified riders to switch between Online and Offline.
- **Actions:**
  - Create `src/components/rider/dashboard/availability-switch.tsx`.
  - Support high-contrast visual state (Green = Online, Slate = Offline).
  - Invoke `updateRiderAvailability` with pending UI and error rollback.
  - Display confirmation modal when going offline during an active shift.
  - Disable toggle with explanatory tooltip if rider is unverified.
- **Verification:** Interactive test confirming RPC call and state synchronization.

---

### T6 — Assignment Inbox & Server-Side Privacy
- **Goal:** Build the incoming dispatch inbox with server-enforced privacy.
- **Actions:**
  - Create `src/components/rider/assignments/assignment-card.tsx` and `assignment-inbox-list.tsx`.
  - Query `getRiderAssignmentInbox()`. Verify customer phone number and exact street address are absent from the network payload.
  - Render service type badge, pickup landmark, dropoff neighborhood, and estimated distance.
  - Add visual countdown timer (60 seconds UX guidance) for incoming job offers.
  - Handle empty inbox state with active animation (*"Waiting for new delivery requests..."*).
- **Verification:** Render tests asserting customer private fields are absent from DOM and network response before acceptance.

---

### T7 — Assignment Accept / Reject Authoritative Flow
- **Goal:** Connect inbox actions to authoritative Phase 10 RPCs.
- **Actions:**
  - Bind Accept button to `acceptDeliveryAssignment(assignmentId)`.
  - Bind Reject button to `rejectDeliveryAssignment(assignmentId, reason)`.
  - On Accept: navigate to active trip `/rider/deliveries/:id`.
  - On Reject: remove card from inbox; toast notification confirming job declined.
  - Handle race conditions (`KD409`): display modal *"This assignment was accepted by another rider or expired"* and refresh inbox.
- **Verification:** Test concurrent acceptance handling and error alerts.

---

### T8 — Pickup Workflow & Vendor Readiness Gate
- **Goal:** Implement the physical pickup step adhering to Phase 10 vendor preparation constraints.
- **Actions:**
  - In `src/components/rider/delivery/custody-action-bar.tsx`, implement Stage 1 (Pickup).
  - For `food` and `grocery`, query linked order status. If `order_status === 'preparing'`, disable "Confirm Pickup" button and render live badge *"Vendor Preparing"*.
  - When `order_status === 'ready_for_pickup'` (or `courier`), enable primary button **[ CONFIRM PICKUP ]**.
  - Invoke `markDeliveryPickedUp(deliveryId, notes)` and transition view to Transit stage upon server confirmation.
- **Verification:** Unit test asserting button is disabled during `preparing` and enabled during `ready_for_pickup`.

---

### T9 — Transit Workflow & Destination Mode
- **Goal:** Transition from pickup location to customer destination navigation.
- **Actions:**
  - Implement Stage 2 (Transit) in `custody-action-bar.tsx`.
  - Display unmasked customer address and phone number with one-touch `tel:` button (now available via `get_rider_active_delivery`).
  - Update Leaflet map center to destination coordinates.
  - Primary button: **[ START TRANSIT ]** invoking `markDeliveryInTransit(deliveryId)`.
  - Upon transit confirmation, update UI state to approaching customer.
- **Verification:** Verify RPC call `mark_delivery_in_transit` and customer data unmasking.

---

### T10 — Delivery Completion Workflow
- **Goal:** Finalize fulfillment using `mark_delivery_delivered`.
- **Actions:**
  - Implement Stage 3 (Dropoff) in `custody-action-bar.tsx`.
  - Primary action: **[ CONFIRM DELIVERED ]** with optional dropoff notes.
  - Invoke `markDeliveryDelivered(deliveryId, notes)`.
  - Render completion summary modal (*"Delivery Completed! Order #..."*).
  - Refetch profile and history from server; redirect to Dashboard with availability intact.
- **Verification:** Test successful completion flow and audit log emission.

---

### T11 — Rider Dashboard & Operational KPIs
- **Goal:** Assemble the unified rider dashboard view at `/rider/dashboard`.
- **Actions:**
  - Create `RiderDashboardPage` replacing Phase 1 shell.
  - Display header with rider name, vehicle badge, rating pill, and availability switch.
  - Prominent `ActiveDeliveryBanner` if an active trip exists, routing directly to `/rider/deliveries/:id`.
  - Incoming job offers summary section.
  - Quick KPI card: Deliveries Completed, Current Rating.
- **Verification:** Component tests verifying correct rendering under active vs idle states.

---

### T12 — Rider Delivery History
- **Goal:** Build the historical delivery ledger at `/rider/history`.
- **Actions:**
  - Create `src/pages/rider/history.tsx` and `src/components/rider/history/history-card.tsx`.
  - Query completed deliveries via `getRiderDeliveryHistory()`.
  - Render delivery date, service type, pickup area, dropoff area, and delivery timestamp.
  - Strict privacy: exclude sensitive customer credentials and admin audit logs.
- **Verification:** Verify RLS filtering ensures only the calling rider's completed deliveries appear.

---

### T13 — Maps & External Turn-by-Turn Navigation Integration
- **Goal:** Integrate interactive Leaflet map and native navigation launcher.
- **Actions:**
  - Build `src/components/rider/delivery/route-map-view.tsx` reusing `LocationMap`.
  - Render custom rider pin, pickup pin (orange), and dropoff pin (emerald).
  - Build `src/components/rider/delivery/external-nav-launcher.tsx`.
  - Deep-link to Google Maps (`https://www.google.com/maps/dir/?api=1&destination=...`) and Apple Maps.
- **Verification:** Test coordinates formatting and deep link URL construction.

---

### T14 — Operational Issue & Incident Reporting UX
- **Goal:** Provide safe, non-mutating operational incident reporting.
- **Actions:**
  - Build `src/components/rider/delivery/operational-issue-modal.tsx`.
  - Support issue types: Customer Unreachable, Vendor Delay, Wrong Address, Vehicle Breakdown, Traffic Delay.
  - Input field for notes.
  - Invoke `reportDeliveryIssue` RPC.
  - Toast confirmation: *"Issue reported to dispatch operations"*.
  - Preserves delivery status (does not cancel order).
- **Verification:** Verify breadcrumb insertion into `delivery_status_updates` and audit log emission.

---

### T15 — Automated Testing & End-to-End Validation Suite
- **Goal:** Comprehensive validation of the entire Rider Platform.
- **Actions:**
  - Unit tests for all service modules (`rider-service.test.ts`, `custody-service.test.ts`, etc.).
  - Component tests for `AvailabilitySwitch`, `AssignmentCard`, `CustodyActionBar`.
  - Integration tests for SQLSTATE error translation (`mapRiderRpcError`).
  - Run full test suite: `npm run test:run`.
  - Typecheck: `npx tsc -b`.
  - Linter: `npm run lint`.
  - Build: `npm run build`.
- **Verification:** 100% test pass rate, 0 lint warnings, 0 type errors.
