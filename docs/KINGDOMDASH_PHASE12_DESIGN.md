# KINGDOMDASH — PHASE 12: ADMIN CONTROL CENTER
# SYSTEM ARCHITECTURE & TECHNICAL DESIGN SPECIFICATION

**Document Version:** 2.0.0 (Analytics Hardened & Vehicles Verified)  
**Status:** Approved Master Design Specification  
**Execution Mode:** Authorized Implementation  
**Target Release:** KingdomDash Phase 12  
**Tagline:** SWIFT IN MOTION  

---

## 1. System Architecture Overview

The **Admin Control Center** is the centralized operational interface for KingdomDash platform administrators (`admin` and `super_admin`). It provides unified command, control, and monitoring across multi-service delivery operations (Food, Grocery, Courier).

### 1.1 Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ADMIN CONTROL CENTER (UI LAYER)                   │
│   • React 19 + TypeScript + Tailwind CSS                               │
│   • 15 Modular Sub-Routes (/admin/dashboard, /admin/dispatch, etc.)    │
│   • Interactive SVG Analytics Engine (Volume, Service, Status, Trends) │
│   • TanStack Query Server-State Caching & Reconciliation              │
│   • Multi-Tier RouteGuard (Role Gating: admin vs super_admin)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         ADMIN SERVICE LAYER                            │
│   • src/services/supabase/admin.ts                                     │
│   • Strongly-Typed Param Contracts & Response Sanitization            │
│   • Analytics Aggregator (getAdminAnalytics)                           │
│   • Structured Error Normalization (KD400, KD403, KD404, KD409)        │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
       ┌─────────────────────────┐      ┌─────────────────────────┐
       │   SAFE READ QUERIES /   │      │ AUTHORIZED TRANSACTIONAL│
       │  CONTROLLED PROJECTIONS │      │      MUTATION RPCs      │
       │ (Paginated & Filtered)  │      │   (SECURITY DEFINER)    │
       └────────────┬────────────┘      └────────────┬────────────┘
                    │                                │
                    └───────────────┬────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL / SUPABASE ENGINE                    │
│                                                                        │
│   • Analytics Aggregator RPC (public.get_admin_analytics)              │
│   • Row Level Security (RLS) policies using get_current_user_role()    │
│   • Three Separated State Machines (Orders, Deliveries, Assignments)   │
│   • Immutability Triggers (Orders & Deliveries Snapshots)              │
│   • Verified public.vehicles Table Linked to Fleet Riders              │
│   • Pricing Audit Trigger (trg_audit_delivery_pricing_rules)           │
│   • Hierarchical Row-Level Locks (FOR UPDATE) Eliminating Race Conds   │
│   • Authoritative Lifecycle Triggers (Role Sync & Application States)  │
│   • Append-Only Operational Audit Trail (public.audit_logs)            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Interactive Analytics Architecture

### 2.1 Separation of Concerns: Live Metrics vs. Historical Analytics

KingdomDash Admin strictly differentiates between:
1. **Live Operational Metrics (Real-Time Current State):**
   - Counts reflecting right-now platform state: unassigned deliveries awaiting dispatch, active in-flight couriers, orders awaiting vendor prep, available online riders, pending applications, orders flagged for refund review.
   - Refreshed via query invalidation after administrative actions or periodic background refetching.
2. **Historical Analytics (Time-Bound Aggregations):**
   - Metrics bounded by a specific date window: order volume over time, revenue, delivery fee totals, service type share (Food vs Grocery vs Courier), order status distribution, and completion/cancellation trends.
   - Controlled by the administrative date picker: Today, Last 7 Days, Last 30 Days, Last 90 Days, or Custom Range.

### 2.2 Analytics Projection Contract (`public.get_admin_analytics`)

```sql
CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_start_date timestamptz DEFAULT NULL,
  p_end_date   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog;
```

**JSON Return Shape:**
```json
{
  "summary": {
    "total_orders": 142,
    "completed_orders": 128,
    "cancelled_orders": 8,
    "total_revenue": 845000.00,
    "total_delivery_fees": 152000.00,
    "pending_orders": 4,
    "active_deliveries": 6,
    "unassigned_deliveries": 2,
    "active_riders": 14,
    "available_riders": 9,
    "active_vendors": 18,
    "pending_rider_applications": 3,
    "pending_vendor_applications": 2,
    "refund_review_count": 5
  },
  "orders_over_time": [
    { "date": "2026-09-01", "count": 18, "total_amount": 105000.00 }
  ],
  "orders_by_service": [
    { "service_type": "food", "count": 88, "percentage": 62.0 },
    { "service_type": "grocery", "count": 34, "percentage": 23.9 },
    { "service_type": "courier", "count": 20, "percentage": 14.1 }
  ],
  "order_status_distribution": [
    { "status": "delivered", "count": 128 },
    { "status": "in_transit", "count": 4 }
  ],
  "delivery_status_distribution": [
    { "status": "delivered", "count": 128 },
    { "status": "assigned", "count": 2 }
  ],
  "completion_trends": [
    { "date": "2026-09-01", "completed": 16, "cancelled": 1 }
  ]
}
```

### 2.3 Interactive Chart Components & Drill-Down Behavior
- **OrderVolumeChart:** Line/area chart showing volume and amount trends. Tooltips expose daily totals.
- **ServiceDistributionChart:** Donut chart with legend toggles. Clicking a segment (e.g. "Food") navigates to `/admin/orders?service=food`.
- **OrderStatusChart:** Bar/donut chart. Clicking "Cancelled" navigates to `/admin/orders?status=cancelled`.
- **DeliveryStatusChart:** Visual distribution of logistics states. Clicking "Pending" navigates to `/admin/deliveries?status=pending` (or `/admin/dispatch`).
- **CompletionTrendChart:** Multi-line comparative visualization of successful vs cancelled orders over time.

---

## 3. Multi-Level Admin Authorization Architecture

```
Ring 1: Client Route Guard (RouteGuard allowedRoles=['admin', 'super_admin'])
   ↓
Ring 2: UI Feature Gates (Audit Logs & Super Admin Promotions strictly for super_admin)
   ↓
Ring 3: Admin Service Layer (Typed parameter validation & sanitized payload assembly)
   ↓
Ring 4: Database Row Level Security (RLS enforcing get_current_user_role() IN ('admin', 'super_admin'))
   ↓
Ring 5: PostgreSQL SECURITY DEFINER RPCs (search_path = public, pg_catalog; strict authorization gates; explicit row locks)
```

---

## 4. Frontend Route & UI Architecture

### 4.1 Route Hierarchy

The Admin Control Center adopts a deep-linkable, modular route structure under `/admin/*`:

```
/admin
  ├── /dashboard                   # Live operational metrics, KPI cards & interactive charts
  ├── /orders                      # Global order directory & 10-state filters
  ├── /deliveries                  # Logistics & custody management
  ├── /dispatch                    # Central dispatch console for unassigned orders
  ├── /riders                      # Fleet directory, vehicle assignment & status toggles
  ├── /rider-applications          # Pending rider onboarding queue & vetting
  ├── /vendors                     # Merchant directory & store statuses
  ├── /vendor-applications         # Pending merchant onboarding queue & vetting
  ├── /users                       # Master user directory & account activation
  ├── /exceptions                  # Operational issues & emergency cancellations
  ├── /payments                    # Payment transactions & refund review queue
  ├── /catalog                     # Categories & product oversight
  ├── /pricing                     # Authoritative delivery pricing matrix (with audit)
  ├── /service-areas               # Geographic coverage & zone parameters
  └── /audit-logs                  # Forensic audit viewer (super_admin only)
```

### 4.2 Vehicles Verification & Schema Linkage

Investigation verified that `public.vehicles` exists (created in Migration `20260902000007_create_rider_delivery.sql`):
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `assigned_rider_id uuid UNIQUE REFERENCES public.riders(id) ON DELETE SET NULL`
- `vehicle_type vehicle_type NOT NULL` (`petrol`, `electric`)
- `make text NOT NULL, model text NOT NULL, year integer NOT NULL`
- `license_plate text NOT NULL UNIQUE, vin text, purchase_date date`
- `status vehicle_status NOT NULL DEFAULT 'active'`
- `created_at, updated_at`

In `/admin/riders`, rider details are joined with `public.vehicles` to display vehicle assignment, license plate, and type.

---

## 5. Pricing Auditability Architecture

To ensure platform pricing modifications are 100% auditable:
- Migration `20260902000024_admin_control_center.sql` installs trigger `trg_audit_delivery_pricing_rules` on `public.delivery_pricing_rules`.
- Any `INSERT`, `UPDATE`, or `DELETE` executes `public.log_operational_audit_event()`, capturing old values, new values, actor profile ID, and timestamp.
- Historical orders remain completely immutable; price rule updates apply strictly to future orders according to `effective_date`.

---

## 6. Concurrency & Race Condition Defense

Phase 12 employs explicit PostgreSQL row locks (`SELECT ... FOR UPDATE`):
1. **Hierarchical Locking Sequence:**  
   `orders → deliveries → delivery_assignments → riders`
2. **Deterministic Conflict Handling:**  
   If an entity state changes concurrently, the transaction aborts with an explicit SQLSTATE code (`KD409`), prompting the admin service layer to alert the user and trigger a background cache invalidation.
