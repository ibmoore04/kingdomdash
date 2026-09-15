# KINGDOMDASH — PHASE 13: NOTIFICATIONS & SUPPORTING SYSTEMS
# IMPLEMENTATION TASKS & EXECUTION CHECKLIST

**Document Version:** 1.0.0  
**Status:** Authorized Execution  
**Target Release:** KingdomDash Phase 13  
**Tagline:** SWIFT IN MOTION  

---

## Task Group 1: Master Documentation Suite
- [x] 1.1 Create `KINGDOMDASH_PHASE13_REQUIREMENTS.md` with complete event matrix and failure semantics.
- [x] 1.2 Create `KINGDOMDASH_PHASE13_DESIGN.md` with schema topology, trigger design, and Realtime architecture.
- [x] 1.3 Create `KINGDOMDASH_PHASE13_IMPLEMENTATION_TASKS.md` (this document).
- [x] 1.4 Create `KINGDOMDASH_PHASE13_CORRECTION_MATRIX.md` detailing gaps, mitigations, and verifications.

---

## Task Group 2: Database Migration 025 Implementation
- [x] 2.1 Inspect current PostgreSQL catalog (`pg_publication_tables`, constraints, and triggers) to ensure defensive migration DDL.
- [x] 2.2 Create `supabase/migrations/20260902000025_notifications_and_supporting_systems.sql`:
  - [x] 2.2.1 Create enum `public.notification_category` (`order`, `delivery`, `payment`, `application`, `system`, `promotional`).
  - [x] 2.2.2 Add columns `category`, `metadata`, `idempotency_key` to `public.notifications`.
  - [x] 2.2.3 Add unique constraint `uq_notifications_profile_idempotency` on `(profile_id, idempotency_key)`.
  - [x] 2.2.4 Create table `public.notification_preferences` with RLS policies (`select_own`, `insert_own`, `update_own`).
  - [x] 2.2.5 Create policy `notifications_delete_own_read` on `public.notifications`.
  - [x] 2.2.6 Create composite and partial performance indexes (`idx_notifications_profile_created`, `idx_notifications_profile_unread`, `idx_notifications_profile_category`).
  - [x] 2.2.7 Implement SECURITY DEFINER procedure `public.emit_notification(...)` with preference checking and audit logging.
  - [x] 2.2.8 Implement management RPCs: `mark_all_notifications_read()`, `clear_read_notifications()`, `get_unread_notification_count()`.
  - [x] 2.2.9 Implement lifecycle trigger function `trg_fn_order_notification_lifecycle()` and attach to `public.orders`.
  - [x] 2.2.10 Implement assignment trigger function `trg_fn_delivery_assignment_notification()` and attach to `public.delivery_assignments`.
  - [x] 2.2.11 Implement application trigger function `trg_fn_application_notification()` and attach to `rider_applications` and `vendor_applications`.
  - [x] 2.2.12 Set `REPLICA IDENTITY FULL` on `public.notifications` and safely add table to `supabase_realtime` publication.

---

## Task Group 3: TypeScript Data Contracts & Service Layer
- [x] 3.1 Update `src/types/database.types.ts` with:
  - [x] `notifications` table definition (category, metadata, idempotency_key).
  - [x] `notification_preferences` table definition.
  - [x] `notification_category` enum.
  - [x] RPC signatures (`mark_all_notifications_read`, `clear_read_notifications`, `get_unread_notification_count`).
- [x] 3.2 Update `src/services/supabase/notifications.ts`:
  - [x] Strongly typed interfaces: `NotificationItem`, `NotificationCategory`, `NotificationPreferences`.
  - [x] Implement `getMyNotifications(options)` with category filtering and unread toggles.
  - [x] Implement `getUnreadNotificationCount()`.
  - [x] Implement `markNotificationRead(id)` and `markAllNotificationsRead()`.
  - [x] Implement `clearReadNotifications()`.
  - [x] Implement `getNotificationPreferences()` and `updateNotificationPreferences()`.
  - [x] Implement `subscribeToMyNotifications(userId, callbacks)` with channel teardown.

---

## Task Group 4: Frontend UI Integration & Preferences
- [x] 4.1 Header Notifications Badge & Real-time Integration:
  - [x] Wire dynamic unread count into `AdminHeader` bell trigger.
  - [x] Wire dynamic unread count into `RiderHeader` bell trigger.
  - [x] Wire unread indicator into Customer Dashboard navigation.
- [x] 4.2 Dashboard Notifications Views:
  - [x] Update `AdminNotificationsPage` to use `markAllNotificationsRead` and `clearReadNotifications`.
  - [x] Update `CustomerNotificationsTab` to use unified notification service.
  - [x] Update `VendorNotificationsTab` to use unified notification service.
  - [x] Update `RiderNotificationsPage` to use unified notification service.
- [x] 4.3 Notification Settings & Preferences:
  - [x] Update `CustomerSettingsTab` to persist notification preferences to Supabase.
  - [x] Update `VendorSettingsTab` to persist notification preferences to Supabase.
  - [x] Update `RiderSettingsPage` to persist notification preferences to Supabase.

---

## Task Group 5: Automated Testing & Verification
- [x] 5.1 Create `src/services/supabase/__tests__/migration-025-verification.test.ts`:
  - [x] Test deterministic idempotency key conflict handling (`ON CONFLICT DO NOTHING`).
  - [x] Test order status transitions generating customer, vendor, and rider alerts.
  - [x] Test application review transitions generating alerts.
- [x] 5.2 Create `src/services/supabase/__tests__/notifications-security.test.ts`:
  - [x] Verify tenant isolation (cross-user read/update/delete denied).
  - [x] Verify unread deletion prevention.
  - [x] Verify non-admin direct INSERT denial.
- [x] 5.3 Run full test suite regression (`npm test`).
- [x] 5.4 Run TypeScript compiler check (`npx tsc -b`).
- [x] 5.5 Run production bundle build (`npm run build`).
- [x] 5.6 Produce final Phase 13 Walkthrough and Closure Report.
