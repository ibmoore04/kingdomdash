# KINGDOMDASH — PHASE 13: NOTIFICATIONS & SUPPORTING SYSTEMS
# CORRECTION & ARCHITECTURAL RECONCILIATION MATRIX

**Document Version:** 1.0.0  
**Status:** Approved Master Reconciliation  
**Target Release:** KingdomDash Phase 13  
**Tagline:** SWIFT IN MOTION  

---

## 1. Architectural Discrepancy & Correction Mapping

| Ref # | Identified Architectural Flaw / Gap | Severity | Root Cause in Earlier Phases | Approved Phase 13 Correction |
| :--- | :--- | :--- | :--- | :--- |
| **C13-01** | **Silent Error Swallowing in Notifications** | High | Blanket `BEGIN ... EXCEPTION WHEN OTHERS` without failure classification | Explicitly split into: (1) expected idempotency conflicts handled via `ON CONFLICT DO NOTHING`, and (2) unexpected infrastructure failures logged to `public.audit_logs` via `log_operational_audit_event()`. |
| **C13-02** | **Duplicate Notification Vulnerability** | Critical | No uniqueness constraints on `public.notifications` | Introduced deterministic idempotency keys (`order:{id}:status:{s}:{role}:{uid}`) and `CONSTRAINT uq_notifications_profile_idempotency UNIQUE (profile_id, idempotency_key)`. |
| **C13-03** | **Unrestricted / String-Based Categories** | Medium | `category` not modeled in schema | Created enum `public.notification_category` (`order`, `delivery`, `payment`, `application`, `system`, `promotional`) separating business domain from visual severity (`type`). |
| **C13-04** | **No Database-Level Preference Model** | High | Settings stored exclusively in browser `localStorage` | Implemented `public.notification_preferences` table with RLS and documented preference policy. Critical transactional alerts strictly bypass user opt-outs. |
| **C13-05** | **No Automated Event Triggers** | Critical | Notifications relied on manual Admin INSERTs or UI mocks | Created database lifecycle triggers on `orders`, `delivery_assignments`, and `applications` that automatically invoke `emit_notification()`. |
| **C13-06** | **Inefficient Multi-Row Read & Delete** | Medium | No bulk RPCs; missing DELETE policy on `notifications` | Added atomic SECURITY DEFINER RPCs `mark_all_notifications_read()`, `clear_read_notifications()`, and policy `notifications_delete_own_read`. |
| **C13-07** | **Realtime Publication Duplication Risk** | Medium | Blind `ALTER PUBLICATION` can throw if table already member | Added defensive catalog check querying `pg_publication_tables` before adding table to `supabase_realtime`. Set `REPLICA IDENTITY FULL`. |
| **C13-08** | **Untyped Frontend Service Contracts** | Medium | `src/services/supabase/notifications.ts` cast client to `any` | Fully typed database entity definitions in `src/types/database.types.ts` and strongly typed wrappers in service layer. |
| **C13-09** | **Stale Realtime Subscriptions** | Medium | No unified channel lifecycle management in UI | Implemented `subscribeToMyNotifications()` with automated channel cleanup (`supabase.removeChannel`) on unmount or user change. |
| **C13-10** | **Audit: Failure Semantics Masking DB Errors** | Critical | Blanket `WHEN OTHERS ... RETURN NULL` caught unexpected DB errors | Removed blanket exception handler in `emit_notification()`. Expected duplicates return NULL via `ON CONFLICT DO NOTHING`, opt-outs return NULL, while unexpected database/infrastructure errors re-raise to preserve transaction atomicity. |
| **C13-11** | **Audit: Idempotency NULL Semantics Ambiguity** | High | Table UNIQUE constraint allowed multiple NULLs ambiguously | Replaced with explicit partial unique index `idx_notifications_profile_idempotency ON public.notifications (profile_id, idempotency_key) WHERE idempotency_key IS NOT NULL`. Automated system emissions strictly supply deterministic keys. |
| **C13-12** | **Audit: Application Category Preference Gap** | Medium | No preference column for `application` category | Added `application_updates boolean NOT NULL DEFAULT true` to `public.notification_preferences` for 1:1 category coverage. |
| **C13-13** | **Audit: Authoritative Rider Relationship** | High | Assumed non-existent `deliveries.rider_id` column | Corrected `trg_fn_order_notification_lifecycle` to resolve rider via `public.delivery_assignments da JOIN public.riders r` filtering for active accepted/assigned states. |
| **C13-14** | **Audit: Order Lifecycle Trigger Trigger-Time** | Medium | Attached solely to `AFTER UPDATE` | Attached to `AFTER INSERT OR UPDATE OF status ON public.orders` with `OLD.status IS NOT DISTINCT FROM NEW.status` guard, future-proofing against direct inserts. |
| **C13-15** | **Audit: Metadata Security Guard** | High | Potential credential or payment secret leakage into JSON metadata | Enforced allowed metadata contract (identifiers and safe states only; no secrets, keys, or financial credentials) verified by automated tests. |

---

## 2. Verification Protocol

Every correction above is verified by automated tests in `src/services/supabase/__tests__/`:
1. `migration-025-verification.test.ts` (Validates DDL, enums, RPCs, triggers, partial unique index, and idempotency guarantees).
2. `notifications-security.test.ts` (Validates RLS tenant isolation, unread deletion prevention, metadata security, failure semantics, and preference enforcement).
3. Full regression suite (`npm test`, `npx tsc -b`, `npm run lint`, `npm run build`).
