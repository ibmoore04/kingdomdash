# KINGDOMDASH — PHASE 9: PAYSTACK PAYMENT INTEGRATION
# IMPLEMENTATION TASKS & EXECUTION WORKFLOW

**Document Version:** 1.0.0  
**Status:** Planning Draft — Awaiting Implementation Authorization  
**Target Release:** KingdomDash Phase 9  
**Scope:** Step-by-Step Task Breakdown for Paystack Payment Processing  

---

## 1. Overview & Execution Protocol

This document outlines the 14 granular implementation tasks required to complete **KingdomDash Phase 9**.

### 🚨 Strict Invariant: Do Not Implement Until Authorized
Execution of these tasks must not commence until:
1. The Phase 9 Requirements, Design, and Implementation Tasks have been thoroughly reviewed.
2. The project owner provides explicit implementation authorization.

---

## 2. Task Breakdown (T1 – T14)

---

### Task T1: Database Migration — Payment Model & Audit Log
- **Objective**: Create migration `20260902000019_paystack_payment_integration.sql` to enhance `public.payments` and introduce `public.payment_events`.
- **Files / Components Affected**:
  - `supabase/migrations/20260902000019_paystack_payment_integration.sql`
- **Database Changes**:
  - Drop global unique constraint on `public.payments(order_id)`.
  - Add partial unique index: `CREATE UNIQUE INDEX idx_payments_one_success_per_order ON public.payments(order_id) WHERE status = 'successful'`.
  - Add columns to `public.payments`: `customer_id` (UUID references profiles), `paystack_transaction_id` (TEXT), `channel` (TEXT), `gateway_response` (TEXT), `paid_at` (TIMESTAMPTZ).
  - Create table `public.payment_events` (`id`, `payment_id`, `paystack_reference`, `event_type`, `idempotency_key`, `payload`, `processed_at`).
  - Add indices for `paystack_reference` and `paystack_transaction_id`.
- **Dependencies**: None (builds on migration 018).
- **Security Considerations**:
  - `public.payment_events` must have RLS enabled and revoke write access from all client roles.
- **Tests**:
  - Migration verification test verifying schema, constraints, indices, and column types.
- **Completion Criteria**: Migration applies cleanly without errors; table constraints and indices match specifications.

---

### Task T2: Payment Security, RLS & Trigger Hardening
- **Objective**: Implement hardened RLS policies and trigger guards on `payments` and `payment_events`.
- **Files / Components Affected**:
  - `supabase/migrations/20260902000019_paystack_payment_integration.sql`
- **Database Changes**:
  - Ensure customers can only `SELECT` payments where `orders.customer_id = auth.uid()`.
  - Prohibit all direct `INSERT`, `UPDATE`, and `DELETE` on `payments` from `authenticated` and `anon`.
  - Re-assert `protect_payment_immutable_fields()` trigger preventing client or admin mutation of `order_id`, `customer_id`, `amount`, and `currency`.
  - Prohibit all client access to `public.payment_events` (accessible only by `service_role`).
- **Dependencies**: T1.
- **Security Considerations**:
  - Zero client write authority. All mutations must occur via service role or audited RPCs.
- **Tests**:
  - RLS security test verifying cross-user payment isolation and write denial.
- **Completion Criteria**: Verified that authenticated users cannot alter financial records or insert unverified payments.

---

### Task T3: Server Stored Procedure — Atomic Payment Reconciliation
- **Objective**: Author `public.reconcile_paystack_payment()` RPC for atomic, idempotent payment settlement.
- **Files / Components Affected**:
  - `supabase/migrations/20260902000019_paystack_payment_integration.sql`
- **Database Changes**:
  - Stored procedure `public.reconcile_paystack_payment(p_reference, p_paystack_transaction_id, p_kobo_amount, p_currency, p_channel, p_gateway_response, p_paid_at, p_raw_payload)`.
  - Implements row-level locking (`FOR UPDATE`) on `payments` and `orders`.
  - Validates exact Kobo subunit match: `ROUND(orders.total * 100)::bigint == p_kobo_amount`.
  - Transitions `payments.status = 'successful'` and `orders.status = 'payment_confirmed'`.
  - Records event in `public.payment_events` with unique `idempotency_key`.
  - `REVOKE ALL FROM PUBLIC; GRANT EXECUTE TO service_role;`
- **Dependencies**: T1, T2.
- **Security Considerations**:
  - `SECURITY DEFINER` with `SET search_path = public`. Strictly callable only by `service_role`.
- **Tests**:
  - SQL verification test verifying correct execution on matching amount, rejection on underpayment, and idempotency on duplicate call.
- **Completion Criteria**: RPC correctly settles order and payment in a single atomic transaction.

---

### Task T4: Supabase Edge Function — `paystack-initialize`
- **Objective**: Implement the serverless backend function that initializes Paystack transactions.
- **Files / Components Affected**:
  - `supabase/functions/paystack-initialize/index.ts`
- **Database Changes**: None.
- **Dependencies**: T1, T2.
- **Security Considerations**:
  - Authenticates user via Supabase JWT.
  - Verifies caller owns the order.
  - Re-reads authoritative order total from database (never accepts client amount).
  - Converts Naira to integer Kobo subunits.
  - Inserts pending payment record with cryptographically random reference.
  - Calls Paystack API with private `PAYSTACK_SECRET_KEY`.
  - Exposes only `authorization_url`, `access_code`, and `reference` to caller.
- **Tests**:
  - Edge function unit and mock integration tests.
- **Completion Criteria**: Function returns valid Paystack checkout URL and updates database state to `payment_pending`.

---

### Task T5: Supabase Edge Function — `paystack-webhook`
- **Objective**: Implement the webhook receiver that validates Paystack signatures and triggers reconciliation.
- **Files / Components Affected**:
  - `supabase/functions/paystack-webhook/index.ts`
- **Database Changes**: None.
- **Dependencies**: T3, T4.
- **Security Considerations**:
  - Validates `x-paystack-signature` using HMAC-SHA512 with timing-safe comparison.
  - Rejects invalid or missing signatures with HTTP 401.
  - Extracts payload and invokes `public.reconcile_paystack_payment()` via Supabase Service Role client.
  - Handles duplicate webhooks idempotently and returns HTTP 200.
- **Tests**:
  - HMAC signature validation test with real SHA-512 fixtures.
  - Webhook delivery simulation test.
- **Completion Criteria**: Webhook validates signatures, reconciles payments, and logs events with zero data duplication.

---

### Task T6: Supabase Edge Function — `paystack-verify`
- **Objective**: Implement fallback verification endpoint for client return callbacks.
- **Files / Components Affected**:
  - `supabase/functions/paystack-verify/index.ts`
- **Database Changes**: None.
- **Dependencies**: T3, T4.
- **Security Considerations**:
  - Authenticated endpoint verifying that caller owns the order associated with the reference.
  - Calls Paystack API `GET /transaction/verify/:reference` using `PAYSTACK_SECRET_KEY`.
  - Settles order if payment succeeded on Paystack but webhook was delayed.
- **Tests**:
  - Verification endpoint unit test with mock Paystack API responses.
- **Completion Criteria**: Fallback verification correctly synchronizes database state when webhook is delayed.

---

### Task T7: Frontend Service Layer — Paystack Client Service
- **Objective**: Author TypeScript service module to interact with Paystack Edge Functions cleanly.
- **Files / Components Affected**:
  - `src/services/paystack/paystack.ts`
  - `src/services/paystack/types.ts`
- **Database Changes**: None.
- **Dependencies**: T4, T6.
- **Security Considerations**:
  - Contains NO secret keys.
  - Sends only `order_id` for initialization and `reference` for verification.
- **Tests**:
  - Unit tests for service methods, error normalization, and response parsing.
- **Completion Criteria**: Frontend service cleanly encapsulates initialization and verification calls with typed responses.

---

### Task T8: Checkout Integration — Paystack Payment Trigger
- **Objective**: Integrate Paystack initialization into customer checkout workflow.
- **Files / Components Affected**:
  - `src/pages/customer/checkout.tsx`
  - `src/components/checkout/payment-methods-card.tsx`
  - `src/components/checkout/checkout-summary-card.tsx`
- **Database Changes**: None.
- **Dependencies**: T7.
- **Security Considerations**:
  - Disables payment CTA during submission to prevent double initialization.
  - Clears cart immediately upon order creation.
  - Redirects customer to authoritative Paystack `authorization_url`.
- **Tests**:
  - Component tests for checkout button states, error handling, and redirect flow.
- **Completion Criteria**: Clicking "Pay Now" successfully creates order, clears cart, and redirects to Paystack checkout.

---

### Task T9: Order Confirmation Page — Live Payment Status Reconciliation
- **Objective**: Update `/order/:orderId/confirmation` to handle live Paystack return callbacks and status display.
- **Files / Components Affected**:
  - `src/pages/customer/order-confirmation.tsx`
- **Database Changes**: None.
- **Dependencies**: T6, T7, T8.
- **Security Considerations**:
  - Does NOT trust `?status=success` in URL. Queries database/verification endpoint for authoritative confirmation.
- **Tests**:
  - Order confirmation page tests for `payment_confirmed`, `payment_processing`, and `failed` states.
- **Completion Criteria**: Confirmation page accurately displays verified status and handles delayed webhook reconciliation.

---

### Task T10: Error, Cancellation & Retry Handling
- **Objective**: Provide resilient UX when customer cancels checkout, card is declined, or network fails.
- **Files / Components Affected**:
  - `src/pages/customer/checkout.tsx`
  - `src/pages/customer/order-confirmation.tsx`
- **Database Changes**: None.
- **Dependencies**: T8, T9.
- **Security Considerations**:
  - Failed payment attempt leaves order in `payment_pending`, allowing safe retry without creating duplicate orders.
- **Tests**:
  - Retry payment test ensuring fresh reference is generated and previous attempt does not block checkout.
- **Completion Criteria**: Customer can seamlessly retry payment following a failure or cancellation.

---

### Task T11: Security & Penetration Test Suite
- **Objective**: Build dedicated automated security tests targeting all payment attack vectors.
- **Files / Components Affected**:
  - `src/services/paystack/__tests__/paystack-security.test.ts`
- **Database Changes**: None.
- **Dependencies**: T1 through T6.
- **Security Vectors Tested**:
  1. Amount tampering (client sends modified amount -> rejected).
  2. Webhook HMAC forgery (tampered signature -> HTTP 401).
  3. Timing attacks on signature verification.
  4. Cross-customer order payment attempt (Customer A pays Customer B's order -> denied).
  5. Direct client payment insert/update via Supabase client (RLS denies write).
  6. Subunit underpayment (Paystack returns ₦1.00 for ₦12,500 order -> flagged as failed).
  7. Secret key leakage check (scan source code and bundle for secret keys).
- **Completion Criteria**: All security test scenarios pass with zero vulnerabilities detected.

---

### Task T12: End-to-End Integration Tests
- **Objective**: Author automated tests simulating full checkout, initialization, webhook delivery, and confirmation.
- **Files / Components Affected**:
  - `src/services/paystack/__tests__/paystack-e2e.test.ts`
- **Database Changes**: None.
- **Dependencies**: T1 through T10.
- **Tests**:
  - Simulated complete user journey from order placement to verified `payment_confirmed`.
- **Completion Criteria**: Full integration test passes with 100% assertions satisfied.

---

### Task T13: Regression Testing & Quality Gates
- **Objective**: Verify that all existing platform features remain 100% functional.
- **Files / Components Affected**: Repository-wide.
- **Database Changes**: None.
- **Dependencies**: T1 through T12.
- **Commands Executed**:
  - `cmd /c npx tsc -b`
  - `cmd /c npx oxlint`
  - `cmd /c npm test`
  - `cmd /c npm run build`
- **Completion Criteria**: 0 TypeScript errors, 0 Oxlint errors, 100% Vitest test suite passing, production build generates cleanly.

---

### Task T14: Paystack Test Mode Verification & Production Readiness
- **Objective**: Execute live manual verification against Paystack Sandbox / Test Mode.
- **Activities**:
  1. Configure `PAYSTACK_SECRET_KEY=sk_test_...` in Supabase Secrets.
  2. Test checkout with Paystack test card (`4084 0840 0000 0408`).
  3. Verify webhook delivery and automatic order status update.
  4. Test declined card simulation and retry flow.
  5. Document production deployment checklist and webhook URL configuration.
- **Completion Criteria**: Complete real transaction flow verified against Paystack sandbox environment.
