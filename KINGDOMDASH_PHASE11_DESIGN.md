# KINGDOMDASH — PHASE 11: RIDER PLATFORM
# TECHNICAL ARCHITECTURE & SYSTEMS DESIGN SPECIFICATION

**Document Version:** 2.0.0 (Server-Side Privacy Reconciled)  
**Status:** Mandatory Specification — Approved for Implementation  
**Execution Mode:** Architecture Correction & Implementation  
**Target Release:** KingdomDash Phase 11  
**Scope:** Client Architecture, Service Layer Contracts, Controlled Read Projections, State Synchronization & Mobile UX  

---

## 1. System Architecture & Topology

The KingdomDash Rider Platform connects the physical mobile rider to the authoritative PostgreSQL database engine established in Phase 10. The architecture is strictly decoupled across three tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: RIDER CLIENT (UI)                       │
│                                                                        │
│   RiderLayout (Header, Mobile Bottom Nav, Online/Offline Switch)       │
│   ├── RiderDashboard (KPIs, Active Trip Card, Assignment Teaser)       │
│   ├── AssignmentInbox (Job Offer Cards, UX Timer, Privacy Safe Preview)│
│   ├── ActiveDeliveryView (Custody Action Bar, Leaflet Map, Nav App)    │
│   ├── DeliveryHistory (Completed Trips, Date Filtering)                │
│   └── OperationalIssueModal (Issue Categorization, Breadcrumb Notes)   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Typed Service Calls & RPCs
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    TIER 2: RIDER SERVICE LAYER                         │
│                                                                        │
│   src/services/rider/                                                  │
│   ├── rider-service.ts (Operational Profile, Availability Toggle)      │
│   ├── assignment-service.ts (Controlled Inbox, Accept/Reject RPCs)     │
│   ├── custody-service.ts (Active Delivery Query, Custody RPCs)         │
│   ├── exception-service.ts (Issue Reporting RPC)                       │
│   └── history-service.ts (Controlled Delivery History Query)           │
│                                                                        │
│   src/hooks/use-current-rider.ts (Active Context, Vetting Verification)│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Supabase PostgREST / RPC Protocol
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               TIER 3: POSTGRESQL AUTHORITATIVE BACKEND                 │
│                                                                        │
│   Controlled Read Projections:                                         │
│   ├── get_rider_assignment_inbox() (Zero customer PII before accept)   │
│   ├── get_rider_active_delivery() (Full details only post-acceptance)  │
│   ├── get_rider_delivery_history(limit, offset) (Completed trips only) │
│   └── get_rider_operational_profile() (Verified profile & stats)       │
│                                                                        │
│   Authoritative Transition RPCs:                                       │
│   ├── update_rider_availability(p_is_available) (Default: false)       │
│   ├── accept_delivery_assignment(p_assignment_id)                      │
│   ├── reject_delivery_assignment(p_assignment_id, p_reason)            │
│   ├── mark_delivery_picked_up(p_delivery_id, p_notes)                  │
│   ├── mark_delivery_in_transit(p_delivery_id, p_notes)                 │
│   ├── mark_delivery_delivered(p_delivery_id, p_notes)                  │
│   └── report_delivery_issue(p_delivery_id, p_issue_type, p_notes)     │
│                                                                        │
│   RLS Hardening & Tenant Isolation:                                    │
│   - deliveries_select_rider (Requires status in 'accepted', 'completed')
│   - orders_select_rider (Requires status in 'accepted', 'completed')   │
│   - order_items_select_rider (Requires status in 'accepted','completed')
│   - Revoked direct table mutations on all operational tables           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database & Authoritative RPC Contracts

### 2.1 Authoritative RPC Summary

All operational state changes and controlled reads execute through designated RPCs. Direct SQL `UPDATE` or `INSERT` statements against operational tables are barred.

| Operation | RPC Name | Parameters | Caller Preconditions | Target Mutations / Output | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Availability Toggle** | `update_rider_availability` | `p_is_available boolean` | Caller is rider profile, `is_verified = true`, `is_active = true`, 0 in-flight trips | Mutates `riders.is_available`, updates `updated_at`, audit log | `KD403`, `KD409` |
| **Assignment Inbox** | `get_rider_assignment_inbox` | *None* | Caller is verified rider profile | Returns JSON array of offers. **Zero customer name, phone, exact address, or exact coords** | `KD403` |
| **Active Delivery** | `get_rider_active_delivery` | *None* | Caller is verified rider profile | Returns active trip with full delivery, customer contact, items, and coordinates | `KD403` |
| **Accept Assignment** | `accept_delivery_assignment` | `p_assignment_id uuid` | Assignment in `assigned`, rider is verified/active/available, 0 in-flight trips | `delivery_assignments.status = 'accepted'`, audit log | `KD403`, `KD404`, `KD409` |
| **Reject Assignment** | `reject_delivery_assignment` | `p_assignment_id uuid`, `p_reason text` | Assignment in `assigned`, owned by caller | `delivery_assignments.status = 'rejected'`, `deliveries.status = 'pending'`, audit log | `KD403`, `KD404`, `KD409` |
| **Confirm Pickup** | `mark_delivery_picked_up` | `p_delivery_id uuid`, `p_notes text` | Delivery `assigned`, assignment `accepted`, order in `ready_for_pickup` (or courier `payment_confirmed`) | `deliveries.status = 'picked_up'`, `orders.status = 'picked_up'`, breadcrumb | `KD403`, `KD404`, `KD409` |
| **Depart In Transit** | `mark_delivery_in_transit` | `p_delivery_id uuid`, `p_notes text` | Delivery `picked_up`, order `picked_up`, assignment `accepted` | `deliveries.status = 'in_transit'`, `orders.status = 'in_transit'`, breadcrumb | `KD403`, `KD404`, `KD409` |
| **Complete Delivery** | `mark_delivery_delivered` | `p_delivery_id uuid`, `p_notes text` | Delivery `in_transit`, order `in_transit`, assignment `accepted` | `deliveries.status = 'delivered'`, `orders.status = 'delivered'`, assignment `completed`, `riders.total_deliveries += 1` | `KD403`, `KD404`, `KD409` |
| **Report Exception** | `report_delivery_issue` | `p_delivery_id uuid`, `p_issue_type text`, `p_notes text` | Active delivery in `assigned`, `picked_up`, or `in_transit`, assignment `accepted` | Appends breadcrumb to `delivery_status_updates` without mutating state; audit log | `KD400`, `KD403`, `KD404`, `KD409` |

### 2.2 Structured Error Mapping

PostgreSQL RPCs raise explicit errors with custom SQLSTATE codes:

```typescript
export function mapRiderRpcError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'An unexpected error occurred. Please retry.'
  
  const pgError = error as { code?: string; message?: string }
  switch (pgError.code) {
    case 'KD400':
      return 'Invalid operation parameters. Please check your inputs.'
    case 'KD403':
      return 'Access denied. You are not authorized for this action or your rider account is pending verification.'
    case 'KD404':
      return 'The requested assignment or delivery could not be found.'
    case 'KD409':
      if (pgError.message?.includes('still being prepared')) {
        return 'Vendor is still preparing this order. Pickup is not yet allowed.'
      }
      if (pgError.message?.includes('already has an active')) {
        return 'You already have an active in-flight delivery. Please complete it first.'
      }
      if (pgError.message?.includes('Cannot accept assignment')) {
        return 'This assignment is no longer available or was already processed.'
      }
      if (pgError.message?.includes('Cannot become available while active delivery is in flight')) {
        return 'Cannot set status to available while an active delivery is currently in flight.'
      }
      return pgError.message || 'Operation conflict. The delivery state has changed.'
    default:
      return pgError.message || 'Network error or server timeout. Please check your connection.'
  }
}
```

---

## 3. Service Layer Architecture

The service layer under `src/services/rider/` provides typed, robust methods connecting the client to PostgreSQL:

### 3.1 Domain Entity Types (`src/types/rider.ts`)

```typescript
export interface RiderProfile {
  id: string
  profile_id: string
  vehicle_type: 'bicycle' | 'motorcycle' | 'car' | 'van'
  rating: number
  total_deliveries: number
  is_available: boolean
  is_verified: boolean
  is_active: boolean
  full_name?: string
  email?: string
  phone?: string
  avatar_url?: string | null
  active_in_flight_count?: number
}

export interface AssignmentInboxOffer {
  assignment_id: string
  delivery_id: string
  service_type: 'food' | 'grocery' | 'courier'
  pickup_address: string
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_area: string // Generalized neighborhood only
  estimated_distance_km: number
  vendor_name: string
  special_instructions_preview: string | null
  status: 'assigned'
  assigned_at: string
}

export interface ActiveDeliveryDetails {
  assignment_id: string
  delivery_id: string
  order_id: string
  service_type: 'food' | 'grocery' | 'courier'
  delivery_status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  assignment_status: 'accepted'
  order_status: string
  pickup_address: string
  pickup_latitude: number | null
  pickup_longitude: number | null
  delivery_address: string
  delivery_latitude: number | null
  delivery_longitude: number | null
  customer_name: string
  customer_phone: string
  special_instructions: string | null
  vendor_id: string | null
  vendor_name: string
  vendor_address: string | null
  assigned_at: string
  responded_at: string | null
  picked_up_at: string | null
  items: Array<{
    id: string
    product_name: string
    quantity: number
  }>
}

export interface CompletedDeliveryHistoryItem {
  assignment_id: string
  delivery_id: string
  order_id: string
  service_type: 'food' | 'grocery' | 'courier'
  vendor_name: string
  pickup_area: string
  delivery_area: string
  delivered_at: string
  assignment_status: 'completed'
  delivery_status: 'delivered'
}

export type OperationalIssueType =
  | 'customer_unreachable'
  | 'vendor_delay'
  | 'address_issue'
  | 'vehicle_breakdown'
  | 'traffic_delay'
  | 'other'
```

### 3.2 Service Modules
1. **`src/services/rider/rider-service.ts`:**
   - `getRiderOperationalProfile(): Promise<{ data: RiderProfile | null; error: Error | null }>`
   - `updateRiderAvailability(available: boolean): Promise<{ success: boolean; error: Error | null }>`
2. **`src/services/rider/assignment-service.ts`:**
   - `getRiderAssignmentInbox(): Promise<{ data: AssignmentInboxOffer[]; error: Error | null }>`
   - `acceptDeliveryAssignment(assignmentId: string): Promise<{ success: boolean; error: Error | null }>`
   - `rejectDeliveryAssignment(assignmentId: string, reason?: string): Promise<{ success: boolean; error: Error | null }>`
3. **`src/services/rider/custody-service.ts`:**
   - `getRiderActiveDelivery(): Promise<{ data: ActiveDeliveryDetails | null; error: Error | null }>`
   - `markDeliveryPickedUp(deliveryId: string, notes?: string): Promise<{ success: boolean; error: Error | null }>`
   - `markDeliveryInTransit(deliveryId: string, notes?: string): Promise<{ success: boolean; error: Error | null }>`
   - `markDeliveryDelivered(deliveryId: string, notes?: string): Promise<{ success: boolean; error: Error | null }>`
4. **`src/services/rider/exception-service.ts`:**
   - `reportDeliveryIssue(deliveryId: string, issueType: OperationalIssueType, notes: string): Promise<{ success: boolean; error: Error | null }>`
5. **`src/services/rider/history-service.ts`:**
   - `getRiderDeliveryHistory(limit?: number, offset?: number): Promise<{ data: CompletedDeliveryHistoryItem[]; error: Error | null }>`

---

## 4. Frontend State & Synchronization Model

### 4.1 Pending-Action State Machine
To guarantee server-authoritative state synchronization, the frontend uses:
$$\text{Pending Action UI} \longrightarrow \text{Server RPC Execution} \longrightarrow \text{Confirmed Server State} \longrightarrow \text{UI Synchronization}$$

- When a rider taps an action (e.g. "Accept Assignment" or "Confirm Pickup"), the UI displays an inline pending spinner and disables the button.
- The UI **does not** advance local state until the PostgreSQL RPC confirms success.
- Upon success, the client invalidates queries and refetches the authoritative projection (`get_rider_active_delivery` or `get_rider_operational_profile`).
- If the RPC fails, the button re-enables and the server error message is displayed in an alert toast.

### 4.2 Real-Time Polling Strategy
- **Active Trip Screen:** Polls `get_rider_active_delivery()` every 10 seconds to detect vendor preparation transitions (`preparing` -> `ready_for_pickup`) and admin reassignments.
- **Assignment Inbox Screen:** Polls `get_rider_assignment_inbox()` every 20 seconds.
- **Tab Invisibility Pause:** Listens to `document.visibilityState` to suspend interval timers when the device screen is off or tab is hidden, conserving battery and mobile data.

---

## 5. Frontend Architecture & Component Hierarchy

### 5.1 Route Tree (`src/App.tsx`)
Guarded by `<RouteGuard allowedRoles={['rider']} />`:
```
/rider                  -> Redirects to /rider/dashboard
/rider/dashboard        -> RiderDashboardPage
/rider/assignments      -> RiderAssignmentsPage
/rider/deliveries/:id   -> RiderActiveDeliveryPage
/rider/history          -> RiderHistoryPage
/rider/profile          -> RiderProfilePage
```

### 5.2 Component Structure Tree
```
src/
├── components/rider/
│   ├── layout/
│   │   ├── rider-layout.tsx              # Shell with desktop sidebar, mobile header & bottom nav
│   │   ├── rider-header.tsx              # Brand, User Name, Availability Switch, Notifications
│   │   ├── rider-sidebar.tsx             # Desktop Navigation
│   │   └── rider-bottom-nav.tsx          # Mobile Sticky Footer Navigation
│   ├── dashboard/
│   │   ├── rider-metrics-card.tsx        # Completed Deliveries, Rating Pill, Online Status
│   │   ├── active-delivery-banner.tsx    # Prominent Card routing to active trip
│   │   └── availability-switch.tsx       # Controlled switch invoking updateRiderAvailability
│   ├── assignments/
│   │   ├── assignment-card.tsx           # Job card with countdown timer & trip preview
│   │   └── assignment-inbox-list.tsx     # List of privacy-safe offers
│   ├── delivery/
│   │   ├── custody-action-bar.tsx        # 52px sticky action button (Accept/Pickup/Transit/Deliver)
│   │   ├── vendor-prep-indicator.tsx     # Live status pill (Preparing vs Ready For Pickup)
│   │   ├── contact-customer-button.tsx   # Phone Call link (unmasked only post-acceptance)
│   │   ├── external-nav-launcher.tsx     # Turn-by-turn navigation deep links
│   │   ├── route-map-view.tsx            # Leaflet Route Map with custom pins
│   │   └── operational-issue-modal.tsx   # Issue reporting dialog (non-mutating breadcrumbs)
│   ├── history/
│   │   └── history-card.tsx              # Summary of completed trip
│   └── shared/
│       ├── rider-pending-view.tsx        # Screen shown to unverified accounts
│       └── rider-status-badge.tsx        # Status pills matching KingdomDash tokens
```

---

## 6. Mobile Operational UX Principles

1. **Touch Ergonomics:**
   - Minimum interactive touch targets: $48 \times 48\,\text{px}$.
   - Primary custody action button spans full mobile viewport width with $52\,\text{px}$ height.
2. **High-Contrast Sunlight Visibility:**
   - Emerald (#10b981) for ready/confirm actions.
   - Amber (#f59e0b) for pending vendor prep.
   - Rose (#f43f5e) for decline/issues.
   - Clear high-contrast text conforming to WCAG 2.1 AAA.
3. **Offline & Connectivity Resilience:**
   - Offline detection banner displays when `navigator.onLine === false`.
   - Actions are disabled while offline to prevent desynchronization errors.
