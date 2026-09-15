# KINGDOMDASH — PHASE 9: PAYSTACK PAYMENT INTEGRATION
# REQUIREMENTS SPECIFICATION

**Document Version:** 1.0.0  
**Status:** Planning Draft — Awaiting Implementation Authorization  
**Target Release:** KingdomDash Phase 9  
**Scope:** Server-Authoritative Paystack Payment Processing Engine  

---

## 1. Executive Summary & Objective

In Phases 0 through 8, KingdomDash established an end-to-end multi-vendor commerce platform with role-based access control, product catalogs, customer carts, geographic serviceability, and distance-based delivery pricing. 

In Phase 8, order totals became 100% server-authoritative via the `create_order_secure()` PostgreSQL stored procedure, integrating dynamic geodesic delivery pricing from `public.delivery_pricing_rules`. However, orders currently terminate at checkout without an online financial settlement mechanism:
```text
Payment Method Selected (Paystack) ──> Order Placed (status: pending) ──> Unpaid / Simulated Notice
```

**Phase 9 introduces real, secure, server-authoritative online payment processing via Paystack.**

### Core Invariant: Zero Client Financial Authority
> **THE BROWSER CAN REQUEST A PAYMENT, BUT THE BROWSER CAN NEVER DECIDE WHAT SHOULD BE PAID, WHETHER PAYMENT WAS SUCCESSFUL, OR WHETHER AN ORDER HAS BEEN PAID.**  
> The client cannot submit an amount, subtotal, delivery fee, currency, or payment status. The PostgreSQL database is the sole authority for order totals. Supabase Edge Functions authenticate against Paystack using server-only secrets. Webhooks and verification RPCs update database order status only upon verified cryptographic proof.

---

## 2. Project Context & Platform Scope

- **Product Name**: KingdomDash
- **Tagline**: *SWIFT IN MOTION.*
- **Launch Market**: Ijebu-Ode, Ogun State, Nigeria
- **Operating Currency**: Nigerian Naira (`NGN`, symbol `₦`)
- **Primary Payment Gateway**: Paystack (Standard NGN Checkout & Webhook Reconciliation)
- **Supported Channels**: Card, Bank Transfer, USSD, Mobile Money via Paystack Hosted Modal / Checkout
- **Technology Stack**:
  - Frontend: React 19, TypeScript, Vite, Tailwind CSS, Zustand
  - Backend: Supabase, PostgreSQL 15+, Supabase Edge Functions (Deno runtime)
  - Security Model: Row Level Security (RLS), `SECURITY DEFINER` RPCs with strict `search_path`, HMAC-SHA512 webhook signature verification.

---

## 3. Scope Definition

### 3.1 In-Scope (Phase 9 Deliverables)
1. **Server-Authoritative Payment Initialization**:
   - Secure Supabase Edge Function (`paystack-initialize`) callable only by authenticated customers.
   - Server-side lookup of authoritative order total directly from `public.orders`.
   - Conversion of Naira to integer Kobo subunits (`(orders.total * 100)::bigint`).
   - Generation of unique, unforgeable transaction references.
   - Calling Paystack `/transaction/initialize` using server-only `PAYSTACK_SECRET_KEY`.
   - Secure database record initialization in `public.payments` with status `pending`.
2. **Payment Lifecycle & State Management**:
   - Database schema enhancement on `public.payments` to record Paystack transaction details (`paystack_transaction_id`, `channel`, `gateway_response`, `paid_at`, `payment_method`).
   - Creation of `public.payment_events` table for idempotent webhook audit logging.
   - Precise state mapping between Paystack gateway statuses and KingdomDash `payment_status` / `order_status`.
3. **Paystack Webhook Termination & Idempotent Reconciliation**:
   - Secure public Supabase Edge Function (`paystack-webhook`).
   - Cryptographic validation of `x-paystack-signature` using HMAC-SHA512.
   - Idempotent processing of `charge.success` events via database locking and transaction records.
   - Exact amount and currency matching before transitioning order to `payment_confirmed`.
4. **Active Payment Verification & Fallback**:
   - Verification endpoint / RPC (`paystack-verify`) allowing on-demand status check if customer returns via redirect before webhook delivery.
5. **Checkout & Order Confirmation UX**:
   - "Pay Now" action in `src/pages/customer/checkout.tsx` initializing transaction and launching Paystack checkout.
   - Resilient button states (`Pay Now`, `Initializing Secure Payment...`, `Opening Paystack...`, `Payment Pending`, `Payment Failed`).
   - Enhanced `src/pages/customer/order-confirmation.tsx` displaying live verified payment status (`Payment Confirmed`, `Awaiting Payment Confirmation`, `Payment Failed — Retry`).
6. **Comprehensive Security & RLS Hardening**:
   - Verification that customer cannot read other customers' payments or forge payments.
   - Complete absence of `PAYSTACK_SECRET_KEY` in Vite client bundle, HTML, or browser storage.
7. **Automated Test Suite**:
   - Unit tests, integration tests, RLS policy tests, amount/kobo subunit tests, and webhook signature verification tests.

### 3.2 Out-of-Scope (Strictly Deferred to Later Phases)
- **Rider Dispatch, Assignment & Logistics**: Deferred to Phases 10–11.
- **Real-Time Live Rider GPS Tracking**: Deferred to Phase 11.
- **Admin Payment Dashboard & Advanced Analytics**: Deferred to Phase 12.
- **Vendor Payouts & Automated Split Payments**: Deferred to Phase 13.
- **Customer Refund UI & Processing**: Handled administratively in future phases.
- **Customer Wallet, Saved Cards, Subscriptions & Recurring Charges**: Out of scope.
- **Promotions, Coupons, and Loyalty Points**: Out of scope.

---

## 4. End-to-End User Journey

```text
1. Customer builds cart (Food / Grocery)
        ↓
2. Checkout Page (`/checkout`)
   - Selects delivery address & views authoritative delivery fee
   - Selects "Paystack (Debit/Credit Card, Bank Transfer, USSD)"
        ↓
3. Customer clicks "Pay ₦XX,XXX"
   - Frontend invokes Edge Function `paystack-initialize` with { order_id }
        ↓
4. Edge Function checks:
   - Is customer authenticated?
   - Does customer own this order?
   - Is order in payable status ('pending' or 'payment_pending')?
   - Re-reads authoritative order total from database
   - Generates unique reference: `kd_ord_{order_id_prefix}_{timestamp}_{random}`
   - Inserts or updates pending payment record
   - Calls Paystack API `/transaction/initialize` with server secret key
   - Returns { authorization_url, access_code, reference }
        ↓
5. Paystack Checkout Opens (Redirect or Hosted Popup)
   - Customer completes payment via Card, Transfer, or USSD
        ↓
6. Dual Asynchronous Reconciliation:
   Path A (Authoritative Server):
     - Paystack sends `charge.success` webhook to `paystack-webhook` Edge Function
     - Edge Function verifies HMAC-SHA512 signature
     - Verifies exact amount & currency
     - Calls secure database RPC `record_payment_success()`
     - Sets payments.status = 'successful' & orders.status = 'payment_confirmed'
   Path B (Client Navigation Callback):
     - Paystack redirects customer back to `/order/:orderId/confirmation?reference=...`
     - Confirmation page queries server status / triggers `paystack-verify` fallback
        ↓
7. Order Confirmation Page Displays:
   - Verified "Payment Confirmed — Vendor Notified"
   - Order enters vendor preparation workflow
```

---

## 5. Functional Requirements

### 5.1 Payment Data Model & Integrity Requirements
- **FR-1.1**: The `public.payments` table must store:
  - `id` (`uuid`, primary key, default `gen_random_uuid()`)
  - `order_id` (`uuid`, foreign key referencing `public.orders(id)`)
  - `customer_id` (`uuid`, foreign key referencing `public.profiles(id)`)
  - `paystack_reference` (`text`, unique, indexed)
  - `paystack_transaction_id` (`text`, nullable, indexed)
  - `amount` (`numeric(12, 2)`, positive, matching `orders.total`)
  - `currency` (`text`, default `'NGN'`, check constraint `= 'NGN'`)
  - `channel` (`text`, nullable: e.g. `'card'`, `'bank_transfer'`, `'ussd'`, `'qr'`)
  - `gateway_response` (`text`, nullable: message from Paystack)
  - `status` (`payment_status` enum: `'pending'`, `'processing'`, `'successful'`, `'failed'`, `'refunded'`)
  - `paid_at` (`timestamptz`, nullable)
  - `created_at` (`timestamptz`, default `now()`)
  - `updated_at` (`timestamptz`, default `now()`)
- **FR-1.2**: Immutable Payment Integrity:
  - Once written, `order_id`, `customer_id`, `amount`, and `currency` cannot be altered by any update.
  - An immutable trigger `protect_payment_immutable_fields()` must enforce this constraint at the database engine level.
- **FR-1.3**: Payment Attempt & Event Audit Logging:
  - The database must include a `public.payment_events` table to record every raw webhook and verification payload:
    - `id` (`uuid`, primary key)
    - `payment_id` (`uuid`, nullable, references `public.payments(id)`)
    - `event_type` (`text`, e.g. `'charge.success'`, `'charge.failed'`)
    - `paystack_reference` (`text`, indexed)
    - `idempotency_key` (`text`, unique: `paystack_reference:event_type:transaction_id`)
    - `payload` (`jsonb`, full raw event)
    - `processed_at` (`timestamptz`, default `now()`)

### 5.2 Order vs. Payment Relationship & Multiple Attempts
- **FR-2.1**: Multiple Payment Attempts Allowed:
  - An order may encounter failed or abandoned payment attempts before a successful payment is achieved.
  - Each payment attempt generates a distinct, unique `paystack_reference`.
  - The `public.payments` table will allow multiple payment attempts per `order_id`, with a partial unique constraint ensuring at most **one** payment with `status = 'successful'` per `order_id`:
    ```sql
    CREATE UNIQUE INDEX idx_payments_one_success_per_order 
    ON public.payments(order_id) 
    WHERE status = 'successful';
    ```
- **FR-2.2**: Attempt Serialization:
  - If an active payment attempt is already `pending`, the initialization service may either return the existing valid authorization session or cancel/supersede it with a fresh reference if expired.
  - If an order has already achieved `status = 'payment_confirmed'` or has a `successful` payment, all subsequent payment initializations for that order must be rejected immediately with HTTP 409 Conflict.

### 5.3 Payment Initialization Flow Requirements
- **FR-3.1**: The initialization endpoint (`POST /functions/v1/paystack-initialize`) must:
  1. Authenticate the caller via Supabase JWT (`auth.uid()`).
  2. Validate that `order_id` belongs to `auth.uid()`.
  3. Validate that `orders.status` is either `'pending'` or `'payment_pending'`.
  4. Query the authoritative `orders.total` directly from the database. Reject any attempt if `total <= 0`.
  5. Compute the Kobo integer amount: `kobo_amount = ROUND(orders.total * 100)`.
  6. Generate a cryptographically random reference: `kd_ord_{short_uuid}_{timestamp}_{random}`.
  7. Insert a record into `public.payments` with `status = 'pending'`, `amount = orders.total`, `currency = 'NGN'`, `paystack_reference = reference`.
  8. Update `orders.status = 'payment_pending'`.
  9. Call Paystack API `POST https://api.paystack.co/transaction/initialize` with:
     - `email`: Customer's verified email from `profiles` or `auth.users`
     - `amount`: `kobo_amount`
     - `currency`: `'NGN'`
     - `reference`: `reference`
     - `callback_url`: `${SITE_URL}/order/${order_id}/confirmation`
     - `metadata`: `{ order_id, customer_id, platform: 'kingdomdash' }`
  10. Return only safe data to client:
      ```json
      {
        "success": true,
        "data": {
          "authorization_url": "https://checkout.paystack.com/...",
          "access_code": "...",
          "reference": "kd_ord_..."
        }
      }
      ```

### 5.4 Webhook Architecture & Signature Validation Requirements
- **FR-4.1**: Webhook Endpoint (`POST /functions/v1/paystack-webhook`):
  - Must be publicly reachable by Paystack servers without Supabase JWT bearer token requirement.
  - Must read the raw request body as binary/text before any JSON parsing.
  - Must read the header `x-paystack-signature`.
- **FR-4.2**: Cryptographic HMAC-SHA512 Validation:
  - Compute `HMAC-SHA512(raw_body, PAYSTACK_SECRET_KEY)`.
  - Compare computed digest against `x-paystack-signature` using constant-time comparison (`crypto.subtle.timingSafeEqual` or equivalent timing-attack resistant utility).
  - If signature does not match, immediately return HTTP 401 Unauthorized without leaking error details.
- **FR-4.3**: Event Handling:
  - On `charge.success`:
    1. Extract `data.reference`, `data.amount` (in kobo), `data.currency`, `data.id` (transaction ID), `data.channel`, `data.gateway_response`, and `data.paid_at`.
    2. Check `public.payment_events` for existing idempotency key. If already processed, respond HTTP 200 immediately.
    3. Call atomic database RPC `public.reconcile_paystack_payment(...)` via Supabase Service Role client.
    4. Respond with HTTP 200 OK.
  - On other events (e.g. `charge.failed`, `transfer.reversed`):
    - Record in `public.payment_events` and respond HTTP 200 OK.

### 5.5 Precise Amount & Currency Verification Requirements
- **FR-5.1**: Strict Subunit Comparison:
  - The webhook/verification service must verify that:
    ```text
    paystack_amount_kobo == ROUND(expected_order_total_naira * 100)
    ```
  - If `paystack_amount_kobo < ROUND(expected_order_total_naira * 100)`:
    - **CRITICAL SECURITY VIOLATION**: Mark payment as `'failed'` (amount underpayment).
    - Do NOT mark order as `'payment_confirmed'`.
    - Log high-priority security alert.
  - If `paystack_amount_kobo > ROUND(expected_order_total_naira * 100)`:
    - Reject automatic order confirmation. Flag for manual administrative reconciliation.
- **FR-5.2**: Currency Guard:
  - Verify `data.currency == 'NGN'`. Any non-NGN currency must be rejected.

### 5.6 Payment Verification Fallback (`paystack-verify`)
- **FR-6.1**: Direct Gateway Query:
  - In situations where customer completes checkout and redirects back to KingdomDash before the webhook arrives (or if webhook delivery is delayed):
  - Customer triggers verification via `POST /functions/v1/paystack-verify` with `{ reference }`.
  - Endpoint calls Paystack API `GET https://api.paystack.co/transaction/verify/${reference}` using `PAYSTACK_SECRET_KEY`.
  - If status is `success`, invokes `public.reconcile_paystack_payment(...)` identically to webhook.
  - Returns current order and payment status to client.

### 5.7 Payment Status Lifecycle & State Mapping
- **FR-7.1**: The platform shall map Paystack states to KingdomDash database enums as follows:

| Paystack Status | Paystack Event | KingdomDash `payments.status` | KingdomDash `orders.status` | Customer Action Allowed |
| :--- | :--- | :--- | :--- | :--- |
| Initialized | (None) | `pending` | `payment_pending` | Open Checkout |
| Ongoing / Pending | `charge.pending` | `processing` | `payment_processing` | Wait for confirmation |
| Success | `charge.success` | `successful` | `payment_confirmed` | Order Placed — Vendor Notified |
| Failed | `charge.failed` | `failed` | `payment_pending` | Retry Payment |
| Abandoned | (Timeout / Closed) | `failed` | `payment_pending` | Retry Payment |
| Reversed | `refund.processed` | `refunded` | `cancelled` | Administrative resolution |

- **FR-7.2**: Valid Order Transitions for Payment:
  - `pending` ──> `payment_pending` (on payment initialization)
  - `payment_pending` ──> `payment_processing` (on gateway entry)
  - `payment_processing` ──> `payment_confirmed` (on verified successful payment)
  - `payment_processing` ──> `payment_pending` (on failed or abandoned attempt, allowing retry)
  - `payment_confirmed` ──> `preparing` (vendor accepts order)
  - **INVALID**: A payment failure must NEVER transition order to `delivered`, `preparing`, or `cancelled` automatically. The customer must be allowed to retry payment.
  - **INVALID**: An order with `status = 'payment_confirmed'` must NEVER transition backward to `pending` or `payment_pending`.

---

## 6. Security Requirements

- **SR-1 (Zero Client Financial Trust)**: The frontend client shall never transmit payment amounts, subtotals, or delivery fees. Any client payload containing amount fields shall be ignored or rejected.
- **SR-2 (Secret Key Isolation)**:
  - `PAYSTACK_SECRET_KEY` shall exist strictly inside Supabase Edge Function environment secrets (`supabase secrets set PAYSTACK_SECRET_KEY=...`).
  - It shall NEVER be prefixed with `VITE_` or included in `.env` files committed to Git.
  - It shall NEVER appear in client-side bundles, React components, network payloads to the browser, or database tables readable by customers.
- **SR-3 (Order Ownership Validation)**: Customers can only initialize payments for orders where `orders.customer_id = auth.uid()`.
- **SR-4 (Row Level Security)**:
  - Customers can `SELECT` only payments linked to orders they own (`orders.customer_id = auth.uid()`).
  - Customers have **NO `INSERT`**, **NO `UPDATE`**, and **NO `DELETE`** privileges on `public.payments`.
  - Only backend services via `service_role` or security-audited `SECURITY DEFINER` RPCs can write to `public.payments`.
- **SR-5 (Timing-Attack Safe Webhook Validation)**: Webhook signatures must be validated using cryptographic constant-time comparison.
- **SR-6 (Replay & Duplication Protection)**: Webhooks must be protected by unique idempotency keys in `public.payment_events`. Repeated identical webhooks must return HTTP 200 without executing secondary database mutations.
- **SR-7 (RPC Hardening)**: All payment-related stored procedures must specify `SET search_path = public` and validate caller authorization or be granted solely to `service_role`.

---

## 7. Frontend User Experience Requirements

- **UX-1 (Checkout Payment CTA)**:
  - The checkout button shall dynamically display the authoritative total: `Pay ₦XX,XXX with Paystack`.
  - Clicking the button initiates the secure flow and disables the button to prevent duplicate clicks.
- **UX-2 (Resilient Loading States)**:
  - Display informative status spinners during transition: `Initializing secure payment...` -> `Connecting to Paystack...`.
- **UX-3 (Seamless Checkout Experience)**:
  - Support both Paystack Hosted Redirect (standard, resilient across mobile WebViews) and Paystack Inline Modal popup.
- **UX-4 (Order Confirmation Page State Handling)**:
  - If payment is verified: Display green confirmation badge, order summary, and real-time vendor notification status.
  - If payment is still processing/pending: Display amber status with a "Refresh Status" button and automatic 5-second polling (up to 3 attempts).
  - If payment failed: Display red failure alert with clear reason and a "Retry Payment" button returning customer to checkout.
- **UX-5 (Branding & Design System Consistency)**:
  - All payment UI elements must adhere to KingdomDash's approved visual palette (Kingdom Red `#E60000`, White, Charcoal/Black, Neutral grays).

---

## 8. Environment & Configuration Requirements

| Environment Variable | Scope | Description |
| :--- | :--- | :--- |
| `PAYSTACK_SECRET_KEY` | Server-only (Supabase Secrets) | Private Paystack API secret (`sk_test_...` or `sk_live_...`) |
| `PAYSTACK_WEBHOOK_SECRET` | Server-only (Supabase Secrets) | Secret used for HMAC-SHA512 signature validation (same as secret key in Paystack) |
| `VITE_PAYSTACK_PUBLIC_KEY` | Frontend-safe (Client `.env`) | Public key (`pk_test_...` or `pk_live_...`) for client modal if used |
| `SITE_URL` | Server-only (Supabase Secrets) | Base URL for redirect callbacks (e.g. `https://kingdomdash.ng` or `http://localhost:5173`) |

---

## 9. Acceptance Criteria

- [ ] **AC-1**: Customer cannot forge order total or payment amount from browser.
- [ ] **AC-2**: Payment initialization calculates exact Kobo subunit from database `orders.total`.
- [ ] **AC-3**: `PAYSTACK_SECRET_KEY` is completely absent from Vite bundle and client network calls.
- [ ] **AC-4**: Webhooks with invalid HMAC-SHA512 signatures are rejected with HTTP 401.
- [ ] **AC-5**: Webhooks with valid signatures update `payments` to `successful` and `orders` to `payment_confirmed`.
- [ ] **AC-6**: Underpaid transactions are rejected and flagged as failed.
- [ ] **AC-7**: Duplicate webhooks are processed idempotently without multiple order updates.
- [ ] **AC-8**: Customer can retry payment if first attempt is cancelled or declined.
- [ ] **AC-9**: Order confirmation page accurately reflects server-verified payment state.
- [ ] **AC-10**: All tests (`tsc -b`, `oxlint`, `vitest`, `build`) pass cleanly with 100% compliance.
