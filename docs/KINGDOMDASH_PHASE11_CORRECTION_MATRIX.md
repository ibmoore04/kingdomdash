# KINGDOMDASH — PHASE 11: RIDER PLATFORM
# ARCHITECTURAL CORRECTION & TRAP PREVENTION MATRIX

**Document Version:** 2.0.0 (Server-Side Privacy Reconciled)  
**Status:** Mandatory Specification — Approved for Implementation  
**Execution Mode:** Architecture Correction & Implementation  
**Target Release:** KingdomDash Phase 11  
**Scope:** Prevention of Design Traps, Security Pitfalls, State Desynchronization & Concurrency Errors  

---

## 1. Executive Summary

This document establishes the preventative architectural matrix for **Phase 11 — Rider Platform**. It identifies potential design flaws, security vulnerabilities, and state desynchronization pitfalls that commonly arise when building courier mobile clients, providing the explicit technical correction implemented in KingdomDash.

---

## 2. Comprehensive Architectural Correction Matrix

| ID | Architectural Risk / Trap | Severity | Potential Failure Mode | Authoritative Phase 11 Correction |
| :--- | :--- | :---: | :--- | :--- |
| **TR-11-01** | **Client-Side State Authority** | **CRITICAL** | Frontend directly updates `deliveries.status` or `orders.status` via Supabase table client, bypassing Phase 10 validation, locking, and audit logs. | **Strict RPC Invocation:** Direct `UPDATE` and `INSERT` permissions on `orders`, `deliveries`, `delivery_assignments`, and `delivery_status_updates` remain completely revoked for `authenticated`. The frontend must call Phase 10 & 21 PostgreSQL RPCs (`accept_delivery_assignment`, `mark_delivery_picked_up`, etc.). |
| **TR-11-02** | **Rider Profile Privilege Escalation** | **CRITICAL** | Rider modifies their own `is_verified`, `is_active`, `rating`, or `total_deliveries` column via client mutation. | **Targeted RPC Gate:** Direct table `UPDATE` on `public.riders` is revoked. Availability toggling routes through `update_rider_availability(boolean)` which modifies **only** `is_available` and validates that `is_verified = true` and `is_active = true`. |
| **TR-11-03** | **Premature Food/Grocery Pickup** | **HIGH** | Rider arrives at merchant and marks food order "picked up" while chef is still cooking (`orders.status = 'preparing'`). | **Server-Enforced Gate:** Phase 10 RPC `mark_delivery_picked_up` raises SQLSTATE `KD409` if food/grocery order is not in `ready_for_pickup`. Frontend queries order status and disables the "Confirm Pickup" button with a live *"Vendor Preparing"* badge. |
| **TR-11-04** | **Pre-Acceptance Customer Data Exposure (Frontend-Only Masking Trap)** | **CRITICAL** | Incoming assignment query returns full customer telephone number and destination address, relying on JSX masking to hide them. Malicious couriers inspect network response before accepting. | **Server-Side Controlled Projection:** Inbox reads strictly via `get_rider_assignment_inbox()`. The query projection omits customer name, phone, exact street address, and exact coordinates entirely. Direct SELECT on `deliveries` and `orders` is denied by RLS until assignment enters `accepted` status. |
| **TR-11-05** | **Concurrent Multi-Order Assignment** | **HIGH** | Rider accepts multiple overlapping assignments simultaneously, causing extreme delivery delays. | **Database Concurrency Lock:** `accept_delivery_assignment` locks the rider row `FOR UPDATE` and verifies that active in-flight deliveries count is strictly `0`. If rider already has an active trip, the RPC raises `KD409`. |
| **TR-11-06** | **Availability Desynchronization & Default On** | **MEDIUM** | Rider is initialized as `is_available = true` on registration, receiving dispatches before completing onboarding. | **Offline by Default:** `riders.is_available` defaults to `false`. Rider must explicitly toggle online. `update_rider_availability` verifies `is_verified = true` and `is_active = true`. Completing a delivery automatically clears the in-flight count without clearing online shift intent. |
| **TR-11-07** | **Unauthorized Incident Cancellation** | **HIGH** | Rider client provides a "Cancel Delivery" button that transitions order/delivery to `cancelled`, bypassing refund review. | **Non-Mutating Issue Reporting:** Riders have zero cancellation authority. Phase 11 provides `report_delivery_issue` which appends an operational breadcrumb to `delivery_status_updates` and alerts dispatch without mutating order or delivery state. |
| **TR-11-08** | **Duplicated Mapping Architecture** | **MEDIUM** | Frontend introduces a secondary map framework (e.g. Mapbox or Google Maps SDK) duplicating existing Phase 7/8 Leaflet services. | **Infrastructure Reuse:** Reuses existing `LocationMap` component (`src/components/map/location-map.tsx`), Leaflet pin helpers, and Ijebu-Ode geo-constants (`src/utils/geo.ts`). External navigation launches via universal URI schemes. |
| **TR-11-09** | **Unvetted Account Operational Access** | **HIGH** | Newly registered rider accesses assignment inbox and accepts jobs before admin background check and vehicle verification. | **Triple-Layer Access Gate:** (1) `RouteGuard` checks `profile.role === 'rider'`. (2) `useCurrentRider` verifies `rider.is_verified` and renders `RiderPendingView`. (3) Database RPCs raise `KD403` if `is_verified = false`. |
| **TR-11-10** | **RLS Visibility Gaps on Cargo Details** | **MEDIUM** | Assigned rider is unable to view order items to verify food bags at pickup due to strict RLS policies on `orders` and `order_items`. | **Scoped RLS Policies (Migration 021):** Installs `orders_select_rider` and `order_items_select_rider` allowing riders to select only the orders and line items linked to their accepted assignments. |
| **TR-11-11** | **False Idempotency & Premature UI Optimism** | **MEDIUM** | Frontend claims operation succeeded before network response returns, causing desynchronization on failure. | **Pending-Action Workflow:** Client shows pending spinner on trigger, executes PostgreSQL RPC, and only transitions UI upon confirmed server return. No false "automatic idempotency retries" unless backed by true server idempotency. |
| **TR-11-12** | **Mobile Touch Friction & Sunlight Usability** | **LOW** | Tiny buttons, low-contrast text, or complex multi-tab navigation impairs couriers operating on motorbikes in direct sunlight. | **Ergonomic Mobile UX:** Sticky bottom custody action bar with minimum 52px touch height, high-contrast status colors, and single-screen step progression. |

---

## 3. Review & Verification Checkpoints

1. **Server-Side Privacy:** Ensure `get_rider_assignment_inbox` returns JSON with zero `customer_phone`, zero `customer_name`, and zero exact destination coordinates.
2. **Direct Table Protection:** Ensure direct `SELECT` on `orders` and `deliveries` fails for assignments not in `'accepted'` or `'completed'`.
3. **During service integration:** Ensure every mutation function calls `supabase.rpc()` and never `supabase.from().update()`.
4. **During concurrency testing:** Verify that concurrent acceptance attempts from multiple devices result in deterministic error handling (`KD409`).
