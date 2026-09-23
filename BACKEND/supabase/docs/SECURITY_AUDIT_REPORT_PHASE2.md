# KingdomDash Phase 2 — Final Security Audit Report
**Migration set:** `20260902000001` – `20260902000014`
**Audit date:** 2026-09-02
**Status:** COMPLETE

---

## Legend

| Badge | Meaning |
|-------|---------|
| ✅ PASS | Control fully implemented and verified in the migration set. |
| ⚠️ PARTIAL | Implemented with noted caveats or deferred to a later phase. |
| ❌ FAIL | Absent or definitively broken. |
| ℹ️ N/A | Not applicable to Phase 2. |

---

## 1. Final Database Inventory

| Item | Count |
|------|-------|
| Public tables | 23 |
| PostgreSQL enums | 13 |
| SECURITY DEFINER functions | 10 |
| SECURITY INVOKER trigger functions | 4 |
| Triggers | 20 |
| RLS-enabled tables | 23 |
| RLS policies | ~47 (post-014 drops: 43 active) |
| Partial unique indexes | 3 |
| CHECK constraints | 8+ |

---

## 2. Corrective Migrations

### Migration 013 — `20260902000013_security_corrections.sql`

| Issue | Severity | Fix |
|-------|----------|-----|
| Customer direct INSERT on orders/order_items bypasses `create_order_secure()` | CRITICAL | Dropped `orders_insert_own_customer` and `order_items_insert_customer` |
| `profiles_update_own` WITH CHECK used recursive subquery | CRITICAL | Replaced with `get_own_profile_flags()` SECURITY DEFINER helper |
| `riders_update_own` allowed modifying total_deliveries, rating, profile_id | CRITICAL | Added WITH CHECK (later replaced by RPC in 014) |
| `delivery_assignments_update_own_rider` had no WITH CHECK | CRITICAL | Added transition guard (later replaced by RPC in 014) |
| All trigger-only functions had PUBLIC EXECUTE | CRITICAL | Revoked PUBLIC on all trigger-only functions |
| `create_order_secure` missing quantity upper bound and integer guard | HIGH | Added 1–999 range, decimal rejection, 50-item cap |
| `notifications_update_own` allowed changing title/message/type | HIGH | Added WITH CHECK (later replaced by RPC in 014) |
| `orders_update_own_vendor` allowed changing financial fields | HIGH | Added WITH CHECK (later replaced by RPC in 014) |
| `increment_rider_deliveries` SECURITY INVOKER broke admin-triggered counter | HIGH | Changed to SECURITY DEFINER |
| `riders.total_deliveries` had no non-negative CHECK | HIGH | Added CHECK constraint |
| No partial unique index on pending applications | MEDIUM | Added partial unique indexes |
| Admin could self-promote to super_admin | CRITICAL | Added WITH CHECK on `profiles_update_admin` |
| `addresses` missing index on profile_id | LOW | Added index |
| Seed pricing rule used non-deterministic CURRENT_DATE | MEDIUM | Updated to fixed date 2026-09-02 |

### Migration 014 — `20260902000014_final_security_hardening.sql`

| Issue | Severity | Fix |
|-------|----------|-----|
| Fragile `id` self-references in 4 WITH CHECK policies | HIGH | Dropped all 4 policies; replaced with SECURITY DEFINER RPCs |
| `riders_update_own` WITH CHECK still exposed direct UPDATE | HIGH | Dropped; replaced with `update_rider_availability(boolean)` RPC |
| `delivery_assignments_update_own_rider` ambiguous subqueries | HIGH | Dropped; replaced with `accept_delivery_assignment()` / `reject_delivery_assignment()` RPCs |
| `notifications_update_own` ambiguous subqueries | MEDIUM | Dropped; replaced with `mark_notification_read()` RPC |
| `orders_update_own_vendor` ambiguous subqueries | MEDIUM | Dropped; replaced with `update_order_status_vendor()` RPC |
| Product could reference a category from a different vendor | HIGH | `validate_product_category_vendor()` BEFORE INSERT OR UPDATE trigger |
| Multiple active pricing rules could match same criteria | MEDIUM | `uq_active_pricing_rule` partial unique index |
| `riders_total_deliveries_nonneg` not idempotent across migrations | LOW | DO block guard |

---

## 3. Security Findings

### CRITICAL: 0 unresolved
### HIGH: 0 unresolved
### MEDIUM: 2 remaining (non-blocking, Phase 3)

| # | Issue | Severity | Migration | Status |
|---|-------|----------|-----------|--------|
| M1 | `vendor_applications_insert_own` and `rider_applications_insert_own` do not enforce `status = 'pending'` — crafted INSERT could set `status = 'approved'` | MEDIUM | Phase 3 | Open |
| M2 | `payments_update_admin` has no WITH CHECK — admin could theoretically set amount/status | MEDIUM | Phase 3 | Open |

### LOW: 4 remaining (informational)

| # | Issue | Severity | Notes |
|---|-------|----------|-------|
| L1 | No DB-level rate limiting on `contact_messages` INSERT | LOW | Enforce at API Gateway / Edge Function layer |
| L2 | `audit_logs` not auto-populated by triggers | LOW | Phase 3 implementation |
| L3 | `delivery_status_updates` INSERT does not auto-populate `old_status` | LOW | Phase 3 trigger |
| L4 | `delivery_fee` always 0 in `create_order_secure` | LOW | Phase 8 distance-based pricing |

---

## 4. RLS Posture Matrix (post-014)

| Table | anon | customer | vendor | rider | admin | super_admin |
|-------|------|----------|--------|-------|-------|-------------|
| `profiles` | — | SELECT/UPDATE own (no role/is_active) | own row | own row | SELECT all, UPDATE any (no super_admin promo) | Full |
| `vendor_applications` | — | INSERT own, SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `vendors` | SELECT active | — | SELECT own, UPDATE own | — | Full | Full |
| `rider_applications` | — | INSERT own, SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `rider_application_private` | — | **None** | — | — | Full | Full |
| `riders` | — | — | — | SELECT own; availability via RPC | Full | Full |
| `addresses` | — | Full own | — | — | — | — |
| `reference_categories` | SELECT all | SELECT all | SELECT all | SELECT all | Full | Full |
| `categories` | SELECT active | — | INSERT/UPDATE/DELETE own vendor | — | Full | Full |
| `products` | SELECT available | — | INSERT/UPDATE/DELETE own vendor | — | Full | Full |
| `orders` | — | SELECT own; create via RPC only | SELECT own vendor | — | Full | Full |
| `order_items` | — | SELECT own | SELECT own vendor | — | Full | Full |
| `payments` | — | SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `service_areas` | SELECT active | — | — | — | Full | Full |
| `delivery_pricing_rules` | SELECT active | — | — | — | Full | Full |
| `vehicles` | — | — | — | SELECT assigned (via riders.id chain) | Full | Full |
| `deliveries` | — | SELECT (via order) | SELECT (via vendor) | SELECT assigned | Full | Full |
| `delivery_assignments` | — | — | — | SELECT own; accept/reject via RPC | Full | Full |
| `delivery_status_updates` | — | — | — | SELECT+INSERT own assigned | SELECT all, INSERT, Full | Full |
| `rider_earnings` | — | — | — | SELECT own | Full | Full |
| `contact_messages` | INSERT | INSERT | INSERT | INSERT | SELECT all, UPDATE | Full |
| `notifications` | — | SELECT own; mark read via RPC | — | — | SELECT all, INSERT | Full |
| `audit_logs` | — | — | — | — | — | SELECT only |

---

## 5. Function Security Audit

| Function | Mode | search_path | Allowed callers | PUBLIC EXECUTE | Purpose |
|----------|------|-------------|-----------------|----------------|---------|
| `handle_new_user()` | SECURITY DEFINER | `public, auth` | Trigger only | REVOKED | Auto-provision profiles on signup |
| `set_updated_at()` | SECURITY INVOKER | `public` | Trigger only | REVOKED | Maintain updated_at timestamps |
| `validate_order_vendor_constraint()` | SECURITY INVOKER | `public` | Trigger only | REVOKED | Enforce vendor_id/service_type rule on orders |
| `validate_delivery_vendor_constraint()` | SECURITY INVOKER | `public` | Trigger only | REVOKED | Enforce vendor_id/service_type rule on deliveries |
| `increment_rider_deliveries()` | SECURITY DEFINER | `public` | Trigger only | REVOKED | Reliably increment total_deliveries on assignment completion |
| `validate_product_category_vendor()` | SECURITY INVOKER | `public` | Trigger only | REVOKED | Prevent cross-vendor category assignment |
| `get_current_user_role()` | SECURITY DEFINER STABLE | `public` | `authenticated` | REVOKED | RLS role helper — prevents recursive RLS on profiles |
| `get_own_profile_flags()` | SECURITY DEFINER STABLE | `public` | `authenticated` | REVOKED | Provides current role/is_active for profiles_update_own WITH CHECK |
| `create_order_secure(...)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Server-authoritative order creation — the only customer order path |
| `update_rider_availability(boolean)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Rider-only is_available toggle; no other field can be changed |
| `accept_delivery_assignment(uuid)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Rider: assigned → accepted; validates ownership |
| `reject_delivery_assignment(uuid)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Rider: assigned → rejected; validates ownership |
| `mark_notification_read(uuid)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Notification owner: flip is_read only |
| `update_order_status_vendor(uuid, order_status)` | SECURITY DEFINER | `public` | `authenticated` | REVOKED | Vendor: payment_confirmed→preparing or preparing→ready_for_pickup only |

---

## 6. Financial Security Audit

| Claim | Status | Evidence |
|-------|--------|----------|
| Customer cannot set unit_price | ✅ PASS | `order_items_insert_customer` dropped (013); only `create_order_secure` inserts items, price from DB |
| Customer cannot set subtotal | ✅ PASS | No INSERT policy on orders; `create_order_secure` calculates server-side |
| Customer cannot set total | ✅ PASS | Same as above |
| Customer cannot set delivery_fee | ✅ PASS | Hardcoded to 0 in `create_order_secure`; Phase 8 will replace |
| Customer cannot forge payment status | ✅ PASS | No INSERT/UPDATE policy on payments for customers |
| Vendor cannot change financial fields | ✅ PASS | `orders_update_own_vendor` dropped (014); `update_order_status_vendor` only touches status |
| Product price comes from DB | ✅ PASS | `create_order_secure` reads price from `products` table, never from client input |
| `create_order_secure` is protected | ✅ PASS | REVOKE PUBLIC, GRANT authenticated; anon cannot call |
| Paystack secret not in browser architecture | ✅ PASS | Not in any migration; documented as Phase 9 Edge Function responsibility |

---

## 7. State Machine Audit

### Order Status Transitions

| From | To | Who | Mechanism |
|------|----|-----|-----------|
| (new order) | `pending` | `create_order_secure()` | Default on INSERT |
| `pending` | `payment_pending` | Payment system (Phase 9) | Edge Function / trusted backend |
| `payment_pending` | `payment_processing` | Payment system | Edge Function |
| `payment_processing` | `payment_confirmed` | Payment system (Paystack webhook) | Edge Function |
| `payment_confirmed` | `preparing` | Vendor | `update_order_status_vendor()` RPC |
| `preparing` | `ready_for_pickup` | Vendor | `update_order_status_vendor()` RPC |
| `ready_for_pickup` | `picked_up` | Admin / Phase 10 | Admin policy or future trusted RPC |
| `picked_up` | `in_transit` | Admin / Rider (Phase 10) | Future trusted RPC |
| `in_transit` | `delivered` | Admin / Rider (Phase 10) | Future trusted RPC |
| Any | `cancelled` | Admin (currently) | Admin policy |

### Delivery Assignment Status Transitions

| From | To | Who | Mechanism |
|------|----|-----|-----------|
| (new assignment) | `assigned` | Admin | Admin INSERT via `delivery_assignments_all_admin` |
| `assigned` | `accepted` | Rider | `accept_delivery_assignment()` RPC |
| `assigned` | `rejected` | Rider | `reject_delivery_assignment()` RPC |
| `accepted` | `completed` | Admin (Phase 2) | Admin policy; Phase 11 will add trusted rider RPC |

### Payment Status Transitions

| From | To | Who | Mechanism |
|------|----|-----|-----------|
| (new payment) | `pending` | Phase 9 Edge Function | Server-side INSERT |
| `pending` | `processing` | Phase 9 | Paystack webhook |
| `processing` | `successful` | Phase 9 (Paystack verified) | Server-side SECURITY DEFINER function |
| `processing` / `successful` | `failed` | Phase 9 | Server-side |
| `successful` | `refunded` | Admin / Phase 9 | Admin policy + future server function |

---

## 8. Open Items for Future Phases

| Item | Phase | Notes |
|------|-------|-------|
| Application INSERT must enforce `status = 'pending'` | Phase 3 | Add WITH CHECK to both application INSERT policies |
| `payments_update_admin` should restrict updatable columns | Phase 3 | Restrict to status + verified_at only |
| Audit log triggers for sensitive events | Phase 3 | Role changes, payment confirmations, application approvals |
| Contact message rate limiting | Phase 3 | Enforce at Edge Function layer |
| `delivery_status_updates` auto-populate old_status | Phase 3 | Trigger to snapshot current delivery.status before update |
| Distance-based delivery fee calculation | Phase 8 | Replace delivery_fee = 0 in create_order_secure |
| Paystack webhook verification | Phase 9 | Edge Function; validates signature, amount, currency, order |
| Rider-initiated delivery completion | Phase 11 | `complete_delivery_assignment()` SECURITY DEFINER RPC |

---

## 9. FINAL VERDICT

**READY FOR PHASE 3**

All CRITICAL and HIGH security issues are resolved. The remaining MEDIUM items (application INSERT status enforcement, admin payment restrictions) are non-blocking for Phase 3 and should be addressed in the first Phase 3 migration. The two LOW/INFO items are by-design deferrals to their respective later phases.
