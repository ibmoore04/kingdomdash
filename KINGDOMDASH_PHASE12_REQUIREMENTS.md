# KINGDOMDASH — PHASE 12: ADMIN CONTROL CENTER
# FUNCTIONAL & TECHNICAL REQUIREMENTS SPECIFICATION

**Document Version:** 2.0.0 (Analytics Hardened & Vehicles Verified)  
**Status:** Approved Master Specification  
**Execution Mode:** Authorized Implementation  
**Target Release:** KingdomDash Phase 12  
**Tagline:** SWIFT IN MOTION  

---

## 1. Executive Summary & Objective

The objective of **Phase 12 — Admin Control Center** is to deliver a secure, comprehensive, interactive, and responsive administrative operations interface for KingdomDash platform administrators (`admin` and `super_admin`).

KingdomDash operates as a multi-service delivery platform across:
1. **Food Delivery** (Restaurant merchants, prepared food logistics)
2. **Grocery Delivery** (Grocery store merchants, packaged goods logistics)
3. **Courier Dispatch** (Direct parcel logistics without vendor middleman)

Following the implementation of the server-authoritative **Phase 10 Order & Delivery Operations Engine** and the **Phase 11 Rider Platform**, Phase 12 connects central office dispatchers and platform administrators to live commercial, logistics, fleet, catalog, analytics, and onboarding workflows.

### Cardinal Architectural Axioms:
1. **The Admin Control Center is NOT a Second Business-Logic Engine:**  
   All authoritative state machines (`orders`, `deliveries`, `delivery_assignments`), eligibility rules, distance-based pricing models, payment reconciliations, and role promotions remain strictly server-enforced in PostgreSQL.
2. **Zero Client-Side State Authority:**  
   The frontend is strictly an authenticated visualization, analytics, and operational control layer. Direct client table mutations (`INSERT`, `UPDATE`, `DELETE`) on operational tables from the browser remain strictly revoked or constrained by RLS.
3. **Admin UI Must NOT Become a "God Mode" Bypass:**  
   Being an administrator does not grant arbitrary frontend `UPDATE` rights. Every administrative state transition must pass through server-validated, audited, transactional PostgreSQL RPCs.
4. **The Frontend is NOT the Authorization Boundary:**  
   UI role guards and hidden buttons are strictly UX enhancements. Real protection is enforced by PostgreSQL Row Level Security (RLS), role-checking functions (`get_current_user_role()`), `SECURITY DEFINER` procedures with fixed `search_path`, and database constraints.
5. **Real, Authoritative Analytics Only:**  
   No mock data, no static chart datasets, and no client-side fabrications. Analytics must be derived directly from the database and distinguish Live Operational Metrics from Historical Analytics.

---

## 2. Project Scope & Strict Phase Boundaries

### 2.1 In Scope for Phase 12
- **Admin Authentication & Multi-Role Authorization:** Enforcing strict access control for `admin` and `super_admin` roles, maintaining the boundary between `admin` and `super_admin` (e.g. audit log visibility and super-admin role assignment).
- **Interactive, Database-Backed Analytics Engine:** Authoritative aggregation via `get_admin_analytics(p_start_date, p_end_date)` supporting date-range filtering (Today, 7D, 30D, 90D, Custom), interactive charts (order volume, service distribution, order status, delivery status, completion trends), tooltips, legend toggles, and click drill-downs to filtered records.
- **Admin Dashboard & Evidence-Based Metrics:** Replacing hardcoded UI cards with authoritative server-derived operational counts (orders by status, active deliveries, unassigned queue, pending rider/vendor applications, active fleet counts). Clear separation between Live Operational Metrics and Historical Analytics.
- **User Directory & Account Controls:** Searching, filtering, and inspecting customer, vendor, and rider profiles. Toggling account activation (`is_active`). Strictly prohibiting frontend role escalation.
- **Rider Application Management:** Reviewing submitted rider applications and invoking authoritative transactional RPCs `approve_rider_application` and `reject_rider_application`.
- **Rider Fleet Operations:** Inspecting active/verified/availability statuses, in-flight delivery tracking, assigned vehicles (from verified `public.vehicles` table), performance metrics, and deactivation controls.
- **Vendor Application Management:** Reviewing merchant onboarding applications and invoking authoritative transactional RPCs `approve_vendor_application` and `reject_vendor_application`.
- **Vendor Management & Isolation:** Inspecting vendor directories, operational statuses, commercial catalog oversight, while strictly preserving vendor tenant isolation.
- **Order Operations:** Real-time visibility into commercial orders across all service types (`food`, `grocery`, `courier`), timeline inspection, payment status inspection, and operational intervention.
- **Delivery Operations & Dispatch Console:** Tracking independent delivery and assignment states. Executing dispatch and reassignment through authoritative `assign_delivery_to_rider` RPC.
- **Operational Exceptions & Incident Cancellation:** Reviewing delivery breadcrumbs, incident reports (`report_delivery_issue`), and executing administrative cancellations via `cancel_order_operational` (with explicit `refund_required = true` flags and post-pickup incident audit logging).
- **Payment & Refund Status Monitoring:** Reviewing Paystack payment transaction references, amounts, and statuses (`pending`, `processing`, `successful`, `failed`, `refunded`). Reviewing orders flagged as `refund_required` with `refund_status = 'pending_manual_review'`. (No automated payment gateway disbursement).
- **Pricing & Service Area Administration:** Eliminating `localStorage` pseudo-settings and connecting administrative controls directly to `delivery_pricing_rules` and `service_areas` tables, with automated audit triggers.
- **Audit Log Interface (Super Admin Only):** Implementing an append-only, database-enforced audit viewer strictly for `super_admin`, inspecting actors, entity types, diffs, and timestamps.
- **Administrative Notifications & Alerts:** In-app notification center for high-priority operational exceptions and incoming onboarding submissions.

### 2.2 Strictly Out of Scope (Phase Boundaries)
- **Phase 13 (External Notifications & Communications):** SMS delivery (Termii/Twilio), WhatsApp Cloud API automated dispatch bots, push notification broadcast services (FCM). Phase 12 manages only internal database notifications (`public.notifications`).
- **Phase 14 (Automated Penetration & Security Testing Suite):** Full-scale external penetration test harnesses.
- **Automated Financial Refund Gateway Integration:** Executing automated refund API calls against Paystack. The system records operational/financial intent via `refund_required` and `refund_status = 'pending_manual_review'`; monetary disbursement remains an offline/manual banking operation.
- **Client-Side Distance Calculation / Financial Logic:** Re-calculating delivery pricing or order totals in React.
- **Customer / Vendor / Rider Self-Service Interfaces:** Modifying customer checkout, vendor product creation, or rider mobile apps (Phases 5–11).

---

## 3. The 5-Tier Platform Role Model & Authorization Matrix

KingdomDash defines exactly 5 distinct roles in the `public.user_role` PostgreSQL enum:
`customer`, `vendor`, `rider`, `admin`, `super_admin`.

### 3.1 Role Hierarchy & Privilege Definition

| Role | Operational Scope | Identity & Escalation Boundary |
| :--- | :--- | :--- |
| **Super Admin** | Unrestricted platform authority. Master fleet and financial oversight. | Only role permitted to read `public.audit_logs`. Only role permitted to promote an account to `super_admin` or edit a `super_admin` profile. |
| **Admin** | Standard operational dispatch and management. Daily platform maintenance. | Can review applications, dispatch riders, manage catalog, service areas, and pricing rules. **CANNOT** view raw `audit_logs`. **CANNOT** promote any user to `super_admin`. |
| **Vendor** | Merchant catalog, order fulfillment, and store settings. | Restricted strictly to own tenant records (`vendor.profile_id = auth.uid()`). Zero access to other vendors, admin consoles, or global orders. |
| **Rider** | Logistics fulfillment, assignment inbox, custody handoffs. | Restricted to assigned deliveries. Pre-acceptance PII masked. Zero access to dispatch console or unassigned fleet queues. |
| **Customer** | Ordering, personal addresses, order tracking. | Restricted to own orders (`customer_id = auth.uid()`). Zero access to platform operations. |

### 3.2 Authoritative Master Authorization Matrix

| Platform Action | Customer | Rider | Vendor | Admin | Super Admin | Database Enforcement Mechanism |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **View Own Profile** | ✓ | ✓ | ✓ | ✓ | ✓ | RLS: `profiles_select_own` |
| **Update Own Profile Info** | ✓ | ✓ | ✓ | ✓ | ✓ | RLS: `profiles_update_own` (role/active immutable) |
| **View User Directory** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `profiles_select_admin` |
| **Toggle User Active Status** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `profiles_update_admin` / Admin RPC |
| **Promote User to Admin** | ✗ | ✗ | ✗ | restricted | ✓ | RLS: `profiles_update_admin` (`role <> 'super_admin'`) |
| **Promote User to Super Admin** | ✗ | ✗ | ✗ | ✗ | ✓ | RLS: `profiles_update_admin` (`get_current_user_role() = 'super_admin'`) |
| **Submit Rider Application** | ✓ | ✗ | ✗ | ✗ | ✗ | RLS: `rider_applications_insert_own` |
| **View Rider Applications** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `rider_applications_select_admin` |
| **View Sensitive Rider Data** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `rider_application_private_all_admin` |
| **Approve Rider Application** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `approve_rider_application()` (`KD403` check) |
| **Reject Rider Application** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `reject_rider_application()` (`KD403` check) |
| **Toggle Rider Active / Verified** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `riders_update_admin` / RPC |
| **Toggle Rider Availability** | ✗ | ✓ (own) | ✗ | ✗ | ✗ | RPC: `update_rider_availability()` (rider-only) |
| **View Fleet Vehicles** | ✗ | ✓ (assigned) | ✗ | ✓ | ✓ | RLS: `vehicles_all_admin`, `vehicles_select_own_rider` |
| **Submit Vendor Application** | ✓ | ✗ | ✗ | ✗ | ✗ | RLS: `vendor_applications_insert_own` |
| **View Vendor Applications** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `vendor_applications_select_admin` |
| **Approve Vendor Application** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `approve_vendor_application()` (`KD403` check) |
| **Reject Vendor Application** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `reject_vendor_application()` (`KD403` check) |
| **View All Orders** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `orders_select_admin` |
| **View Own Orders** | ✓ (own) | ✗ | ✓ (own) | ✓ | ✓ | RLS: `orders_select_customer`, `orders_select_vendor` |
| **Dispatch / Assign Delivery** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `assign_delivery_to_rider()` (Admin-only) |
| **Reassign Stale Delivery** | ✗ | ✗ | ✗ | ✓ | ✓ | RPC: `assign_delivery_to_rider()` (Closes unaccepted) |
| **Accept Delivery Assignment** | ✗ | ✓ (assigned) | ✗ | ✗ | ✗ | RPC: `accept_delivery_assignment()` (Rider-only) |
| **Reject Delivery Assignment** | ✗ | ✓ (assigned) | ✗ | ✗ | ✗ | RPC: `reject_delivery_assignment()` (Rider-only) |
| **Confirm Package Pickup** | ✗ | ✓ (assigned) | ✗ | ✗ | ✗ | RPC: `mark_delivery_picked_up()` (Rider-only) |
| **Confirm Delivery Completion** | ✗ | ✓ (assigned) | ✗ | ✗ | ✗ | RPC: `mark_delivery_delivered()` (Rider-only) |
| **Cancel Operational Order** | pre-pay | ✗ | pre-prep | ✓ (any) | ✓ (any) | RPC: `cancel_order_operational()` (Role-gated) |
| **View Payment Transactions** | own | ✗ | own | ✓ | ✓ | RLS: `payments_select_admin` |
| **Manage Pricing Rules** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `delivery_pricing_rules_all_admin` |
| **Manage Service Areas** | ✗ | ✗ | ✗ | ✓ | ✓ | RLS: `service_areas_all_admin` |
| **View Raw Audit Logs** | ✗ | ✗ | ✗ | ✗ | ✓ | RLS: `audit_logs_select_super_admin` (`super_admin` only!) |

---

## 4. Privacy & Data Protection Audit

The Admin Control Center provides broad oversight, but operational access is governed by the principle of least privilege.

### 4.1 Data Sensitivity Classification
- **Public:** Categories, active products, service zones, vendor public business profile.
- **Customer PII:** Full name, phone number, delivery address, exact GPS coordinates, order items.
- **Rider Sensitive:** Driver's license, vehicle registration, NIN, background check records in `rider_application_private`.
- **Vendor Sensitive:** Bank accounts, CAC registration, tax IDs, internal commercial margins.
- **Financial / Gateway:** Transaction references, payment amounts, Paystack verification codes, customer codes.
- **Internal Operational:** Dispatch logs, delivery status transitions, rider in-flight count, exception notes.
- **Security & Audit:** Tamper-evident audit logs, actor IP addresses, request user agents, system triggers.

### 4.2 Prohibited Data Exposures
1. **Paystack Secret Keys:** The Paystack secret key must **NEVER** exist in frontend environment variables, bundles, or database tables accessible via client API.
2. **Raw Passwords & Hashes:** Password credentials reside in `auth.users` and are unreachable via client API.
3. **Applicant Private Records:** `public.rider_application_private` is strictly gated to `admin` and `super_admin`. Ordinary users and applicants receive zero rows.
4. **Audit Log Masking:** Direct SELECT on `public.audit_logs` is restricted strictly to `super_admin`.

---

## 5. Detailed Functional Requirements

### 5.1 Admin Operational Dashboard & Interactive Analytics
- **Requirement 12.1.1 (Evidence-Based Counters & Live Separation):** The dashboard must query live server counts strictly separated from historical window aggregates:
  - Total Pending Orders (`status IN ('pending', 'payment_pending', 'payment_confirmed')`)
  - Active Deliveries (`status IN ('assigned', 'picked_up', 'in_transit')`)
  - Deliveries Awaiting Dispatch (`d.status = 'pending' AND o.status IN ('payment_confirmed', 'preparing', 'ready_for_pickup')`)
  - Active & Available Fleet Riders (`is_active = true AND is_available = true`)
  - Pending Rider Applications (`status = 'pending'`)
  - Pending Vendor Applications (`status = 'pending'`)
  - Orders Flagged for Refund Review (`refund_required = true AND refund_status = 'pending_manual_review'`)
- **Requirement 12.1.2 (Interactive Charting Engine):** Implement interactive visualizations backed by `get_admin_analytics()`:
  - **Orders Over Time:** Daily volume and revenue bucketed in Africa/Lagos (WAT, UTC+1) timezone.
  - **Orders by Service:** Breakdown across Food, Grocery, and Courier with authoritative order count and paid volume.
  - **Order Status Distribution:** Breakdown across the 10 order states for orders created within the half-open period `[v_start, v_end)`.
  - **Delivery Status Distribution:** Current status breakdown for deliveries created within the half-open period `[v_start, v_end)`.
  - **Completion Trends:** Comparative daily trends grouped by authoritative completion timestamp (`delivered_at`) and cancellation timestamp (`cancelled_at`), rather than order creation timestamp.
- **Requirement 12.1.3 (Date Range & Timezone Semantics):**
  - Half-open interval `[v_start, v_end)`.
  - Calendar day grouping strictly calculated in Africa/Lagos (West Africa Time, WAT / UTC+1).
  - Validation guards: `v_start >= v_end` returns `KD400`.
  - Excessive range protection: queries exceeding 365 days are rejected with `KD400`.
- **Requirement 12.1.4 (Financial Semantics):**
  - `total_revenue`: Authoritative gross paid order volume for orders that successfully cleared payment (`status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')`).
  - `total_delivery_fees`: Authoritative delivery fee revenue across qualifying paid orders.
- **Requirement 12.1.5 (Chart Drill-Down & Interactivity):** Hovering shows exact tooltips. Clicking a chart segment (e.g. "Food" or "Cancelled") provides deep links or filtered views to the relevant administrative lists. Zero mock telemetry; graceful zero-filled periods and skeleton loaders.

### 5.2 User Management
- **Requirement 12.2.1 (User Directory):** Paginated, searchable listing of all profiles from `public.profiles`. Searchable by `email`, `full_name`, and normalized `phone`.
- **Requirement 12.2.2 (Role Filtering):** Filter users by role (`customer`, `vendor`, `rider`, `admin`, `super_admin`).
- **Requirement 12.2.3 (Account Status Gating):** Ability for admins to activate/deactivate an account (`is_active = true/false`). Inactive accounts are blocked from logging in.
- **Requirement 12.2.4 (Anti-Escalation Safeguard):** The UI must strictly disallow arbitrary role changes. Role promotions to `rider` or `vendor` must occur strictly through application approval RPCs (`approve_rider_application`, `approve_vendor_application`). Promotion to `super_admin` is restricted to existing `super_admin` actors.

### 5.3 Rider & Fleet Management (with Verified Vehicles)
- **Requirement 12.3.1 (Fleet Directory):** Comprehensive listing of all registered riders from `public.riders`, joined with `public.profiles` and `public.vehicles`.
- **Requirement 12.3.2 (Vehicles Integration):** Query and display assigned vehicle details (`vehicle_type`, `make`, `model`, `year`, `license_plate`) from `public.vehicles` (verified table from Migration 007).
- **Requirement 12.3.3 (Operational Attributes):** Display verification state (`is_verified`), active state (`is_active`), current availability (`is_available`), total completed deliveries (`total_deliveries`), and rating (`rating`).
- **Requirement 12.3.4 (In-Flight Delivery Status):** Display whether a rider is currently on an active assignment (`delivery_assignments.status = 'accepted'` on non-terminal delivery).
- **Requirement 12.3.5 (Verification & Activation):** Admin controls to verify a rider (`is_verified = true`) or deactivate a rider (`is_active = false`). Deactivating a rider automatically forces `is_available = false` and cancels future dispatch eligibility.
- **Requirement 12.3.6 (No Hard Deletions):** Deletion of `public.riders` records is strictly blocked by database trigger `trg_prevent_rider_deletion`. The UI must offer deactivation only.

### 5.4 Rider Application Approval Lifecycle
- **Requirement 12.4.1 (Pending Application Queue):** Filtered listing of all `public.rider_applications` with `status = 'pending'`.
- **Requirement 12.4.2 (Application Detail Inspection):** Review applicant personal details, vehicle details (make, model, year, type), and private vetting documents.
- **Requirement 12.4.3 (Authoritative Approval):** The admin UI must invoke `public.approve_rider_application(p_application_id)`.
- **Requirement 12.4.4 (Authoritative Rejection):** The admin UI must invoke `public.reject_rider_application(p_application_id, p_reason)`.

### 5.5 Vendor Management & Applications
- **Requirement 12.5.1 (Vendor Directory):** Comprehensive listing of all merchants from `public.vendors`, joined with `public.profiles`.
- **Requirement 12.5.2 (Merchant Status):** Display business name, business type (`restaurant`, `grocery_store`), business address, contact info, active status (`is_active`), and store coordinates.
- **Requirement 12.5.3 (Merchant Activation Control):** Admin toggle for `is_active`. Deactivating a vendor hides their products from public listings. No hard deletions (`trg_prevent_vendor_deletion`).
- **Requirement 12.5.4 (Authoritative Application Lifecycles):** Invokes `approve_vendor_application` and `reject_vendor_application`.

### 5.6 Order Operations & Commercial Oversight
- **Requirement 12.6.1 (Global Order List):** Searchable, paginated listing of all orders across the platform.
- **Requirement 12.6.2 (Status Filtering):** Filter by exact status from the 10-state lifecycle.
- **Requirement 12.6.3 (Service Type Filtering):** Filter by `food`, `grocery`, or `courier`.
- **Requirement 12.6.4 (Order Detail View):** Complete breakdown of order line items, quantities, subtotal, delivery fee, total, delivery address snapshot, customer contact snapshot, and operational timestamps.

### 5.7 Delivery Operations & Dispatch Management
- **Requirement 12.7.1 (Three-State Separation):** The UI must cleanly distinguish between Order State, Delivery State, and Assignment State.
- **Requirement 12.7.2 (Unassigned Queue):** Dedicated console view of all deliveries in `status = 'pending'` where order is paid (`payment_confirmed`, `preparing`, or `ready_for_pickup`).
- **Requirement 12.7.3 (Authoritative Dispatch Action):** Admin assigns an eligible rider by invoking `public.assign_delivery_to_rider(p_delivery_id, p_rider_id)`.
- **Requirement 12.7.4 (Zero Client Eligibility Logic):** The client must never determine rider availability independently; the server check is absolute.

### 5.8 Operational Exceptions & Incident Control
- **Requirement 12.8.1 (Issue Breadcrumb Viewer):** Review delivery issue reports logged by riders via `report_delivery_issue`.
- **Requirement 12.8.2 (Operational Order Cancellation):** Admin invokes `public.cancel_order_operational(p_order_id, p_reason)`. If cancelled post-pickup, records an operational incident audit flag `requires_investigation = true`. Sets `refund_required = true` on paid orders.

### 5.9 Payment & Refund Administration
- **Requirement 12.9.1 (Payment Audit Viewer):** Read-only view of `public.payments` records.
- **Requirement 12.9.2 (Refund Review Queue):** Filtered view of cancelled orders where `refund_required = true`.
- **Requirement 12.9.3 (No Fake Refund Execution):** The UI must explicitly state: *"Manual Financial Review Required"*; no fake automatic refund buttons.

### 5.10 Catalog Administration
- **Requirement 12.10.1 (Category Management):** Admin ability to view, create, edit, and toggle active status of product categories (`public.categories`).
- **Requirement 12.10.2 (Product Oversight):** Admin ability to view products across all vendors, filter by merchant or category, and deactivate violating products.

### 5.11 Service Area & Pricing Administration (with Audit)
- **Requirement 12.11.1 (Eliminate Mock Settings):** Permanently remove `localStorage` pseudo-settings.
- **Requirement 12.11.2 (Service Area Management):** View and manage zones in `public.service_areas`.
- **Requirement 12.11.3 (Authoritative Pricing Rules):** View and update rules in `public.delivery_pricing_rules`.
- **Requirement 12.11.4 (Pricing Audit Logging & Fail-Closed Semantics):** Every pricing rule mutation (`INSERT`, `UPDATE`, `DELETE`) produces an operational audit log entry via trigger `trg_audit_delivery_pricing_rules` calling `public.log_operational_audit_event()`. The trigger is fail-closed: any failure in writing the audit log immediately aborts the pricing mutation transaction. Minimized payload records only essential pricing tier attributes.
- **Requirement 12.11.5 (Historical Immutability & Deletion Guard):** Changing pricing rules never alters historical order snapshots (`distance_km`, `pricing_rule_id`, `delivery_fee`, `total`). Destructive deletion of pricing rules referenced by existing orders is strictly blocked with `KD409`; administrators must deactivate tiers (`is_active = false`) rather than delete them.

### 5.12 Audit Log Visibility (Super Admin Only)
- **Requirement 12.12.1 (Role-Restricted Navigation):** Strictly visible and accessible to `super_admin`.
- **Requirement 12.12.2 (Audit Log Feed):** Paginated stream from `public.audit_logs`. Ordered descending by `created_at`.
- **Requirement 12.12.3 (Immutability):** Table is append-only; zero frontend edit or delete operations.

---

## 6. Non-Functional & Operational Requirements

- **Performance:** Server-side pagination (default 20, max 50). Consolidated analytics aggregation.
- **Responsive Layout:** Desktop-first (1280px+), collapsing tablet (768px), and mobile card view (375px+).
- **Accessibility:** WCAG 2.1 AA compliant. Focus management, ARIA labels, semantic HTML, and accessible dialogs.
- **Quality Gates:** `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`.
