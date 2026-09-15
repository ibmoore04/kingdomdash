# KINGDOMDASH — PHASE 12: ADMIN CONTROL CENTER
# DEPENDENCY-ORDERED IMPLEMENTATION TASKS SPECIFICATION

**Document Version:** 2.0.0 (Analytics Hardened & Vehicles Verified)  
**Status:** Approved Master Implementation Plan  
**Execution Mode:** Authorized Implementation  
**Target Release:** KingdomDash Phase 12  
**Tagline:** SWIFT IN MOTION  

---

## 1. Implementation Phasing & Task Dependency Graph

The implementation of Phase 12 is structured into 4 sequential stages, strictly ordered by dependency. Foundational data contracts, authoritative analytics projections, and security policies are implemented before the UI modules and end-to-end integration are assembled.

```
STAGE 1: FOUNDATION, SECURITY & ANALYTICS (T1 – T3A)
   ├── T1: Admin Schema & Runtime Function Verification
   ├── T2: Admin RLS & Privilege Verification
   ├── T3: Admin Analytics Projection & Service Foundation
   └── T3A: Interactive Analytics Engine & Chart Contract
            │
            ▼
STAGE 2: ACTORS & ONBOARDING (T4 – T8)
   ├── T4: User Management & Account Gating
   ├── T5: Rider Fleet Management & Vehicle Assignment
   ├── T6: Rider Application Review & Authoritative Approval
   ├── T7: Vendor Directory & Tenant Isolation Oversight
   └── T8: Vendor Application Review & Authoritative Approval
            │
            ▼
STAGE 3: OPERATIONS & CONTROL (T9 – T17)
   ├── T9: Order Operations & Timeline Inspection
   ├── T10: Delivery Operations & Custody Tracking
   ├── T11: Dispatch Console & Rider Reassignment Engine
   ├── T12: Operational Exceptions & Incident Control
   ├── T13: Payment & Refund Review Workflow
   ├── T14: Catalog & Product Compliance Oversight
   ├── T15: Service Areas & Authoritative Pricing Administration (with Audit)
   ├── T16: Audit Log Stream Interface (Super Admin Only)
   └── T17: Admin Notification & Real-Time Alert Center
            │
            ▼
STAGE 4: INTEGRATION & VALIDATION (T18 – T22)
   ├── T18: Master Admin Shell, Modular Routing & Drill-Down Integration
   ├── T19: Security & Privilege Escalation Penetration Testing
   ├── T20: High-Concurrency & Race Condition Validation
   ├── T21: Cross-Phase Platform Regression Suite (Phases 1–11)
   └── T22: Production Build Verification & Final Acceptance Gate
```

---

## 2. Detailed Task Specifications

### STAGE 1: FOUNDATION, SECURITY & ANALYTICS

#### Task 1: Admin Schema & Runtime Function Verification
- **Objective:** Verify static migration definitions and runtime function signatures for all administrative RPCs and catalog constraints.
- **Dependencies:** None (Prerequisite for all tasks).
- **Files Involved:**
  - `supabase/migrations/20260902000009_create_functions_triggers.sql`
  - `supabase/migrations/20260902000011_create_rls_policies.sql`
  - `supabase/migrations/20260902000020_order_delivery_operations.sql`
  - `supabase/migrations/20260902000023_rider_vendor_lifecycle_reconciliation.sql`
  - `supabase/migrations/20260902000024_admin_control_center.sql`
- **Database Dependencies:** Function signatures for `get_current_user_role()`, `approve_rider_application()`, `reject_rider_application()`, `approve_vendor_application()`, `reject_vendor_application()`, `assign_delivery_to_rider()`, `cancel_order_operational()`.
- **Security Requirements:** Validate that every administrative function has `SECURITY DEFINER` with fixed `search_path = public, pg_catalog` and revokes execution from `anon` and `PUBLIC`.
- **Testing Requirements:** Unit test static SQL contracts; verify error codes match `KD400`, `KD403`, `KD404`, `KD409`.
- **Acceptance Criteria:** All administrative RPC signatures are validated and mapped into TypeScript interface definitions.

#### Task 2: Admin RLS & Privilege Verification
- **Objective:** Verify database policies governing table access for `admin` and `super_admin` across all core tables.
- **Dependencies:** Task 1.
- **Files Involved:**
  - `supabase/migrations/20260902000011_create_rls_policies.sql`
  - `supabase/migrations/20260902000013_security_corrections.sql`
  - `supabase/migrations/20260902000014_final_security_hardening.sql`
- **Database Dependencies:** RLS enabled on all operational tables (`orders`, `deliveries`, `delivery_assignments`, `profiles`, `riders`, `vendors`, `payments`, `audit_logs`, `vehicles`, `service_areas`, `delivery_pricing_rules`).
- **Security Requirements:** Confirm that `audit_logs` is strictly readable only by `get_current_user_role() = 'super_admin'`. Confirm that `profiles_update_admin` prohibits assigning `super_admin` unless caller is `super_admin`.
- **Testing Requirements:** Test policy evaluations for customer, rider, vendor, admin, and super_admin mock roles.
- **Acceptance Criteria:** RLS prevents unauthorized role escalation, prevents standard admins from reading `audit_logs`, and prevents ordinary authenticated users from modifying operational records.

#### Task 3: Admin Analytics Projection & Service Foundation
- **Objective:** Deliver migration `20260902000024_admin_control_center.sql` implementing `get_admin_analytics(p_start_date, p_end_date)` and establish `src/services/supabase/admin.ts`.
- **Dependencies:** Task 1, Task 2.
- **Files Involved:**
  - `supabase/migrations/20260902000024_admin_control_center.sql`
  - `src/services/supabase/admin.ts`
  - `src/types/admin.ts`
- **Database Dependencies:** Aggregation across `orders`, `deliveries`, `rider_applications`, `vendor_applications`, `riders`, `vendors`.
- **Security Requirements:** Strict admin check: `IF public.get_current_user_role() NOT IN ('admin', 'super_admin') THEN RAISE EXCEPTION ... USING ERRCODE = 'KD403';`. Zero customer/vendor/rider leakage.
- **Testing Requirements:** Verify consolidation of live metrics (unassigned deliveries, active in-flight, pending applications) and historical series.
- **Acceptance Criteria:** Authoritative analytics RPC compiles and delivers typed payloads with zero mock numbers.

#### Task 3A: Interactive Analytics Engine & Chart Contract
- **Objective:** Implement interactive, accessible SVG charting components supporting tooltips, legend toggling, date-range controls (Today, 7D, 30D, 90D, Custom), and click drill-down.
- **Dependencies:** Task 3.
- **Files Involved:**
  - `src/components/admin/analytics/order-volume-chart.tsx`
  - `src/components/admin/analytics/service-distribution-chart.tsx`
  - `src/components/admin/analytics/order-status-chart.tsx`
  - `src/components/admin/analytics/delivery-status-chart.tsx`
  - `src/components/admin/analytics/completion-trend-chart.tsx`
  - `src/components/admin/analytics/analytics-date-picker.tsx`
  - `src/components/admin/analytics/admin-kpi-card.tsx`
- **Data Contract:** Real data binding; clear separation between Live Operational Metrics (unassigned queue, pending count) and Historical Analytics (order volume over time, revenue, completion ratios).
- **Security Requirements:** Read-only presentation; zero client-side manipulation of historical truth.
- **Testing Requirements:** Test date-range filtering, tooltip hover behavior, click drill-down navigation, and loading/empty/error states.
- **Acceptance Criteria:** Dashboard charts are interactive, responsive, accessible, and 100% database-backed.

---

### STAGE 2: ACTORS & ONBOARDING

#### Task 4: User Management & Account Gating
- **Objective:** Build `/admin/users` supporting paginated listings, search (`full_name`, `email`, `phone`), role filtering, and account activation toggling (`is_active`).
- **Dependencies:** Task 3.
- **Files Involved:**
  - `src/pages/admin/admin-users-page.tsx`
  - `src/components/admin/user-status-modal.tsx`
  - `src/services/supabase/admin.ts`
- **Security Requirements:** Zero client-side role dropdown for promoting to `rider` or `vendor`. Role changes must follow authoritative onboarding lifecycles.
- **Testing Requirements:** Test search debounce, role filtering, pagination, and deactivation toggle.
- **Acceptance Criteria:** Administrators can inspect accounts and toggle active status; non-admins receive 403 Forbidden.

#### Task 5: Rider Fleet Management & Vehicle Assignment
- **Objective:** Build `/admin/riders` displaying verified, active, and available statuses, current assignment, total deliveries, and linked vehicle from `public.vehicles`.
- **Dependencies:** Task 3, Task 4.
- **Files Involved:**
  - `src/pages/admin/admin-riders-page.tsx`
  - `src/components/admin/rider-detail-drawer.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.riders`, `public.profiles`, `public.vehicles`, `public.delivery_assignments`.
- **Security Requirements:** No hard deletions (`trg_prevent_rider_deletion` trigger enforced). Deactivation sets `is_active = false` and forces `is_available = false`.
- **Testing Requirements:** Verify vehicle details display from `public.vehicles`; verify rider deactivation cancels future dispatch eligibility.
- **Acceptance Criteria:** Complete administrative fleet oversight with vehicle linkage and verification controls.

#### Task 6: Rider Application Review & Authoritative Approval
- **Objective:** Build `/admin/rider-applications` displaying pending onboarding applications and invoking authoritative RPCs `approve_rider_application` and `reject_rider_application`.
- **Dependencies:** Task 5.
- **Files Involved:**
  - `src/pages/admin/admin-rider-applications-page.tsx`
  - `src/components/admin/rider-application-dialog.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.rider_applications`, `public.rider_application_private`, RPCs `approve_rider_application()`, `reject_rider_application()`.
- **Security Requirements:** Invokes authoritative RPCs. Sensitive applicant records are restricted to admins. Rejection requires a mandatory reason.
- **Testing Requirements:** Test approval promoting profile role to `rider` and initializing `riders` row; test rejection preserving `customer` role and emitting audit log.
- **Acceptance Criteria:** Seamless, server-enforced onboarding approval lifecycle for couriers.

#### Task 7: Vendor Directory & Tenant Isolation Oversight
- **Objective:** Build `/admin/vendors` displaying merchant details, store type (`restaurant` vs `grocery_store`), address, contact info, active status, and store coordinates.
- **Dependencies:** Task 3, Task 4.
- **Files Involved:**
  - `src/pages/admin/admin-vendors-page.tsx`
  - `src/components/admin/vendor-detail-drawer.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.vendors`, `public.profiles`.
- **Security Requirements:** Preserve vendor tenant isolation. Admins can view all merchants, but vendor-specific mutations must not leak across tenants. Hard deletion is blocked.
- **Testing Requirements:** Test search, store type filtering, active status toggling.
- **Acceptance Criteria:** Complete administrative visibility into registered merchants with deactivation controls.

#### Task 8: Vendor Application Review & Authoritative Approval
- **Objective:** Build `/admin/vendor-applications` connecting merchant applications to authoritative approval/rejection RPCs.
- **Dependencies:** Task 7.
- **Files Involved:**
  - `src/pages/admin/admin-vendor-applications-page.tsx`
  - `src/components/admin/vendor-application-dialog.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.vendor_applications`, RPCs `approve_vendor_application()`, `reject_vendor_application()`.
- **Security Requirements:** Invokes authoritative RPCs. Rejection requires a mandatory reason.
- **Testing Requirements:** Verify approval creates `vendors` record, updates application status, promotes profile role to `vendor`, and logs audit event.
- **Acceptance Criteria:** Reliable, server-enforced onboarding approval lifecycle for merchants.

---

### STAGE 3: OPERATIONS & CONTROL

#### Task 9: Order Operations & Timeline Inspection
- **Objective:** Build `/admin/orders` supporting status filtering across the 10-state lifecycle, service type filtering (`food`, `grocery`, `courier`), customer search, date filtering, and full financial snapshot review.
- **Dependencies:** Task 3.
- **Files Involved:**
  - `src/pages/admin/admin-orders-page.tsx`
  - `src/components/admin/order-detail-drawer.tsx`
  - `src/components/admin/order-timeline.tsx`
  - `src/services/supabase/admin.ts`
- **Security Requirements:** Direct client updates to order status or snapshots are revoked. All reads conform to RLS.
- **Testing Requirements:** Verify 10-state filtering, fee breakdowns, and address snapshot formatting.
- **Acceptance Criteria:** Full operational transparency for any order from checkout confirmation to terminal delivery.

#### Task 10: Delivery Operations & Custody Tracking
- **Objective:** Build `/admin/deliveries` displaying independent delivery states (`pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled`) alongside linked orders and rider assignments.
- **Dependencies:** Task 9.
- **Files Involved:**
  - `src/pages/admin/admin-deliveries-page.tsx`
  - `src/components/admin/delivery-status-badge.tsx`
  - `src/services/supabase/admin.ts`
- **Security Requirements:** Distinct separation between Order and Delivery entities. Snapshots remain immutable.
- **Testing Requirements:** Verify rendering of deliveries by status; verify linked rider contact display once assigned.
- **Acceptance Criteria:** Clear operational visualization of physical package custody across all active deliveries.

#### Task 11: Dispatch Console & Rider Reassignment Engine
- **Objective:** Build `/admin/dispatch` console for unassigned deliveries, featuring eligible rider matching and authoritative assignment dispatching.
- **Dependencies:** Task 5, Task 10.
- **Files Involved:**
  - `src/pages/admin/admin-dispatch-page.tsx`
  - `src/components/admin/dispatch-dialog.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** RPC `assign_delivery_to_rider(p_delivery_id, p_rider_id)`.
- **Security Requirements:** Invokes `assign_delivery_to_rider`. Server validates that target rider is verified, active, available, and has 0 active deliveries. Automatically closes unaccepted assignments on reassignment.
- **Testing Requirements:** Test dispatch modal; test error handling when selecting an ineligible rider (`KD409`); test successful dispatch moving delivery to `assigned`.
- **Acceptance Criteria:** Admins can dispatch and reassign deliveries to qualified riders with full concurrency safety.

#### Task 12: Operational Exceptions & Incident Control
- **Objective:** Build `/admin/exceptions` for reviewing delivery issue reports (`report_delivery_issue`) and executing administrative cancellations with mandatory reasons.
- **Dependencies:** Task 9, Task 10.
- **Files Involved:**
  - `src/pages/admin/admin-exceptions-page.tsx`
  - `src/components/admin/cancel-order-dialog.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** RPC `cancel_order_operational(p_order_id, p_reason)`.
- **Security Requirements:** Invokes `cancel_order_operational`. For post-pickup cancellations, flags an operational incident with `requires_investigation = true`. Sets `refund_required = true` on paid orders.
- **Testing Requirements:** Test cancellation pre-pickup vs post-pickup; verify delivery cancellation and assignment closure; verify audit log emission.
- **Acceptance Criteria:** Safe, audited administrative intervention for operational crises.

#### Task 13: Payment & Refund Review Workflow
- **Objective:** Build `/admin/payments` featuring a read-only payment transaction monitor and a manual refund review queue for cancelled paid orders.
- **Dependencies:** Task 9.
- **Files Involved:**
  - `src/pages/admin/admin-payments-page.tsx`
  - `src/components/admin/refund-review-queue.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.payments`, `public.orders` (`refund_required`, `refund_status`).
- **Security Requirements:** Paystack secret keys are never exposed. No fake automated refund execution button; clearly labeled as manual review.
- **Testing Requirements:** Test payment filtering by status; verify display of cancelled orders requiring refund review.
- **Acceptance Criteria:** Transparent financial audit interface without misleading gateway controls.

#### Task 14: Catalog & Product Compliance Oversight
- **Objective:** Build `/admin/catalog` for managing product categories and moderating merchant products.
- **Dependencies:** Task 7.
- **Files Involved:**
  - `src/pages/admin/admin-catalog-page.tsx`
  - `src/components/admin/category-modal.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.categories`, `public.products`, `public.vendors`.
- **Security Requirements:** Maintain vendor product ownership integrity. Category creation is admin-only.
- **Testing Requirements:** Test category creation and editing; test product deactivation.
- **Acceptance Criteria:** Complete administrative control over taxonomy and catalog compliance.

#### Task 15: Service Areas & Authoritative Pricing Administration (with Audit)
- **Objective:** Build `/admin/service-areas` and `/admin/pricing` connected directly to `public.service_areas` and `public.delivery_pricing_rules`. Attach an automated audit trigger `trg_audit_delivery_pricing_rules` to log all pricing rule modifications.
- **Dependencies:** Task 3.
- **Files Involved:**
  - `supabase/migrations/20260902000024_admin_control_center.sql`
  - `src/pages/admin/admin-pricing-page.tsx`
  - `src/pages/admin/admin-service-areas-page.tsx`
  - `src/components/admin/pricing-rule-modal.tsx`
  - `src/components/admin/service-area-modal.tsx`
  - `src/services/supabase/admin.ts`
- **Security Requirements:** Only `admin` and `super_admin` can insert or update pricing rules and service areas. Changing pricing rules never alters historical order snapshots.
- **Testing Requirements:** Verify creating and updating pricing rules and service areas writes to PostgreSQL; verify pricing audit log entries are generated.
- **Acceptance Criteria:** Platform pricing economics are 100% server-authoritative, auditable, and managed directly from PostgreSQL.

#### Task 16: Audit Log Stream Interface (Super Admin Only)
- **Objective:** Build `/admin/audit-logs` accessible strictly to `super_admin` accounts, providing an append-only forensic audit stream.
- **Dependencies:** Task 2, Task 3.
- **Files Involved:**
  - `src/pages/admin/admin-audit-logs-page.tsx`
  - `src/components/admin/audit-diff-viewer.tsx`
  - `src/services/supabase/admin.ts`
- **Database Dependencies:** `public.audit_logs`, RLS policy `audit_logs_select_super_admin`.
- **Security Requirements:** Strictly gated to `super_admin`. Standard `admin` users navigating to this view receive an access-denied screen. Table is append-only; zero mutation controls.
- **Testing Requirements:** Verify super_admin can read audit logs; verify standard admin receives empty data or access denied.
- **Acceptance Criteria:** Full forensic visibility for super administrators with zero risk of historical log tampering.

#### Task 17: Admin Notification & Real-Time Alert Center
- **Objective:** Replace mock seed notifications in `/admin` with live alerts from `public.notifications` for onboarding events and operational exceptions.
- **Dependencies:** Task 3, Task 6, Task 8.
- **Files Involved:**
  - `src/components/admin/admin-notifications-drawer.tsx`
  - `src/services/supabase/notifications.ts`
- **Security Requirements:** Admins view notifications addressed to admin role or profile.
- **Testing Requirements:** Test loading live notifications, marking as read, and unread badge counters.
- **Acceptance Criteria:** Live operational alerts without local storage mock fallbacks.

---

### STAGE 4: INTEGRATION & VALIDATION

#### Task 18: Master Admin Shell, Modular Routing & Drill-Down Integration
- **Objective:** Integrate all modular administrative views into `src/App.tsx` and provide a responsive shell with collapsible navigation, role indicators, and seamless drill-down links from dashboard charts to filtered entity lists.
- **Dependencies:** Tasks 4 – 17.
- **Files Involved:**
  - `src/App.tsx`
  - `src/pages/admin/admin-shell.tsx`
  - `src/components/admin/admin-sidebar.tsx`
  - `src/components/admin/admin-header.tsx`
- **Security Requirements:** All routes wrapped in `<Route element={<RouteGuard allowedRoles={['admin', 'super_admin']} />}>`.
- **Testing Requirements:** Verify navigation across all 15 sub-routes, route guard protection for unauthenticated and non-admin users, and responsive mobile sidebar behavior.
- **Acceptance Criteria:** Seamless, professional, cohesive admin portal experience.

#### Task 19: Security & Privilege Escalation Penetration Testing
- **Objective:** Execute direct database and API attacks to verify authorization boundaries.
- **Dependencies:** Task 18.
- **Files Involved:**
  - `src/services/supabase/__tests__/admin-security.test.ts`
- **Security Test Cases:**
  1. Customer attempting to invoke `approve_rider_application` -> Rejected with `KD403`.
  2. Rider attempting to invoke `assign_delivery_to_rider` -> Rejected with `KD403`.
  3. Admin attempting to assign `role = 'super_admin'` -> Rejected by RLS `profiles_update_admin`.
  4. Standard admin attempting direct SELECT on `audit_logs` -> Returns 0 rows (RLS blocked).
  5. Attempting to directly update order financial fields or addresses -> Rejected with `KD409`.
  6. Attempting to hard delete a rider or vendor record -> Rejected with `KD409`.
- **Acceptance Criteria:** 100% of privilege escalation and unauthorized mutation attempts fail deterministically.

#### Task 20: High-Concurrency & Race Condition Validation
- **Objective:** Simulate concurrent operational events to verify row locking and state determinism.
- **Dependencies:** Task 18.
- **Files Involved:**
  - `src/services/supabase/__tests__/admin-concurrency.test.ts`
- **Concurrency Test Cases:**
  1. Simultaneous dispatch of two riders to the same delivery.
  2. Dispatch reassignment while the original rider accepts.
  3. Simultaneous approval and rejection of the same application.
  4. Admin cancellation while rider confirms pickup.
- **Acceptance Criteria:** Zero orphaned states, zero duplicate assignments, and zero unhandled database deadlocks.

#### Task 21: Cross-Phase Platform Regression Suite (Phases 1–11)
- **Objective:** Run the full platform test suite to confirm that Phase 12 introduction did not break existing customer ordering, vendor fulfillment, or rider custody workflows.
- **Dependencies:** Tasks 18 – 20.
- **Verification Commands:** `npm test`.
- **Acceptance Criteria:** All Phase 1 through 11 test suites pass without regressions.

#### Task 22: Production Build Verification & Final Acceptance Gate
- **Objective:** Validate that the complete codebase satisfies all production build, linting, and type-check gates.
- **Dependencies:** Tasks 1 – 21.
- **Verification Commands:**
  - `npx tsc -b` (Clean TypeScript compilation)
  - `npm run lint` (0 errors in oxlint)
  - `npm run build` (Vite production bundle generated successfully)
- **Acceptance Criteria:** Zero build errors, zero type errors, zero lint errors. Platform ready for production deployment.
