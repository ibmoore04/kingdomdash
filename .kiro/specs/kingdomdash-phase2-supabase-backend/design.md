# Design Document — KingdomDash Phase 2: Supabase Backend & Database Foundation

**Feature:** `kingdomdash-phase2-supabase-backend`
**Workflow:** Requirements-First
**Date:** 2026-09-02
**Status:** Draft

---

## 1. Phase 2 Objective & Scope

### What Phase 2 Builds

Phase 2 establishes the complete, secure, and type-safe PostgreSQL backend for KingdomDash using Supabase. Specifically it delivers:

- Supabase client configuration and environment variable structure
- All 22 application tables plus the `reference_categories` lookup table (23 total public tables), defined via versioned migration files
- 13 PostgreSQL enums enforcing categorical integrity at the database level
- All business-rule CHECK constraints and referential integrity (foreign keys, cascades)
- Performance indexes on high-frequency query columns
- Database functions and triggers (`set_updated_at`, `handle_new_user`, `get_current_user_role`, `validate_order_vendor_constraint`, `validate_delivery_vendor_constraint`, `increment_rider_deliveries`)
- Row Level Security (RLS) with Default Deny posture on all application tables
- The `create_order_secure` SECURITY DEFINER RPC for server-authoritative order creation
- Seed/reference data (food categories, grocery categories, service areas, default pricing rule)
- TypeScript type generation (`db:types` script, `database.types.ts`)
- A typed service layer under `src/services/supabase/`
- RLS/security tests in vitest
- Schema documentation at `supabase/docs/schema.md`

### What Phase 2 Does NOT Build

- Authentication UI (login, register, forgot-password pages — Phase 3)
- Paystack payment integration (Phase 9)
- Maps, geocoding, or live GPS (Phases 7–8)
- Shopping cart UI or checkout UI (Phase 6)
- Order fulfilment workflows visible to users (Phase 10)
- Any changes to `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, or `src/styles/` from Phase 1

---

## 2. Architecture Overview

```
Browser (Vite + React)
        |
        |  VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (public)
        v
src/services/supabase/client.ts   <-- typed createClient<Database>()
        |
        |  supabase-js (HTTPS to Supabase REST/Realtime)
        v
Supabase Project
|-- Auth (auth.users)
|       |  handle_new_user() trigger
|       v
|   profiles (application users)
|
|-- PostgreSQL Database
|   |-- 13 enums
|   |-- 23 public tables (22 application + reference_categories)
|   |-- RLS policies (Default Deny)
|   |-- SECURITY DEFINER functions
|   |   |-- get_current_user_role()   -- role-based RLS helper
|   |   |-- handle_new_user()         -- profile provisioning
|   |   `-- create_order_secure()     -- server-authoritative order creation
|   `-- Triggers
|       |-- set_updated_at()
|       |-- validate_order_vendor_constraint()
|       |-- validate_delivery_vendor_constraint()
|       `-- increment_rider_deliveries()
|
|-- Versioned Migrations (supabase/migrations/)
|
`-- Seed Data (separate migration file)

src/types/
|-- database.types.ts   <- generated (npm run db:types), never edited manually
`-- index.ts            <- hand-maintained, re-exports DB types, Phase 1 compat

supabase/docs/schema.md <- human-readable schema reference
```

The browser **never** holds the service-role key. All SECURITY DEFINER functions run as the function owner (postgres), bypassing RLS only for tightly scoped, vetted operations.

---

## 3. Supabase Architecture

### 3.1 Project Configuration

The Supabase project is managed via the Supabase CLI. Local development uses `supabase start` to spin up a local stack (Postgres + Auth + REST + Storage). CI/production targets the hosted Supabase project via environment variables.

### 3.2 Supabase Client Setup

**File:** `src/services/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[KingdomDash] Missing Supabase environment variables. ' +
    'Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in .env.local'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

The error is thrown at module evaluation time, before the React tree mounts, so a missing configuration surfaces immediately during development.

### 3.3 Environment Variables

| Variable | Prefix | Location | Description |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `VITE_` | `.env.local` | Supabase project URL (public, safe in browser) |
| `VITE_SUPABASE_ANON_KEY` | `VITE_` | `.env.local` | Supabase anon/public key (public, safe in browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | none | Server / CI only | Service-role secret — NEVER in frontend, NEVER `VITE_`-prefixed |
| `SUPABASE_DB_PASSWORD` | none | Server / CI only | Database password for direct connection — NEVER in frontend |

### 3.4 Secret Handling Rules

- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_PASSWORD` are used **only** by the Supabase CLI migration tooling and are read from non-`VITE_`-prefixed environment variables.
- These keys must never appear in any file that is imported or processed by Vite.
- `.env`, `.env.local`, and `.env.*.local` are listed in `.gitignore`; only `.env.example` is committed.
- Updated `.env.example` must document both categories of keys with inline comments.

---

## 4. Database Architecture

### 4.1 PostgreSQL via Supabase

KingdomDash uses PostgreSQL managed by Supabase. All schema changes are expressed as sequential migration files — no manual schema edits via the Supabase Dashboard.

### 4.2 Migration Strategy

- **Directory:** `supabase/migrations/`
- **File naming:** `{UTC_TIMESTAMP}_{description}.sql` (e.g. `20260902000001_create_enums.sql`)
- **Ordering:** Migrations are applied in ascending filename order, ensuring deterministic schema evolution
- **Idempotency:** The Supabase CLI tracks applied migrations; already-applied files are skipped without error
- **Separation of concerns:** Schema and seed data are in separate migration files

Recommended migration file order:
1. `20260902000001_create_enums.sql`
2. `20260902000002_create_tables.sql`
3. `20260902000003_seed_reference_data.sql`
4. `20260902000004_create_order_secure_rpc.sql`

The seed migration is a separate migration file. Migrations are tracked by the Supabase CLI — once applied, a migration file cannot simply be "re-run independently." To achieve repeatable development seeding without touching the migration history, use `INSERT ... ON CONFLICT DO NOTHING` in the seed migration to make it idempotent. If a clean-slate re-seed is needed during development, use an explicit `supabase db reset` (local) or apply a new corrective migration.

### 4.3 Schema Extension

All application tables live in the `public` schema. `auth.users` is Supabase-managed and must not be modified. The `handle_new_user()` trigger bridges `auth.users` to `public.profiles`.

---

## 5. Entity Relationship Overview

```
auth.users (Supabase-managed)
    | 1:1 (trigger)
    v
profiles
    |-- 1:1 --> vendors
    |               |-- 1:N --> categories -------> reference_categories (FK nullable)
    |               |-- 1:N --> products
    |               `-- 1:N --> deliveries (vendor_id)
    |
    |-- 1:1 --> riders
    |               |-- 1:1 --> vehicles (assigned_rider_id)
    |               |-- 1:N --> delivery_assignments
    |               `-- 1:N --> rider_earnings
    |
    |-- 1:N --> addresses
    |-- 1:N --> notifications
    |-- 1:N --> orders (customer_id)
    |-- 1:N --> vendor_applications
    |-- 1:N --> rider_applications
    |               `-- 1:1 --> rider_application_private
    |-- 1:N --> audit_logs
    `-- 1:N --> deliveries (created_by)

orders
    |-- 1:N --> order_items (product snapshot)
    |-- 1:1 --> payments
    `-- 1:1 --> deliveries (order_id)

deliveries
    |-- 1:N --> delivery_assignments
    `-- 1:N --> delivery_status_updates

delivery_assignments
    `-- 1:1 --> rider_earnings

reference_categories
    `-- 1:N --> categories (reference_category_id nullable FK)

service_areas
    `-- 1:N --> delivery_pricing_rules (service_area_id nullable)
```

### Rider ID Chain (Critical for RLS)

This exact chain must be traversed by any RLS policy that asks "is the current user this rider?":

```
auth.uid()
    |
    | profiles.id = auth.uid()
    v
profiles.id
    |
    | riders.profile_id = profiles.id
    v
riders.id
    |
    | vehicles.assigned_rider_id = riders.id
    v
vehicles (the rider's assigned vehicle)
    
    riders.id = delivery_assignments.rider_id
    v
delivery_assignments
    |
    | delivery_assignments.delivery_id = deliveries.id
    v
deliveries
```

**Key constraint:** `auth.uid() != riders.id` — they are separate UUIDs. RLS policies must never assume they are equal.


---

## 6. Enums

All 13 enums are created in the `public` schema.

| Enum | Values | Rationale |
|---|---|---|
| `user_role` | `customer`, `vendor`, `rider`, `admin`, `super_admin` | Application permission tier; matches `src/utils/constants.ts` |
| `business_type` | `restaurant`, `grocery_store` | Vendor discriminator; single `vendors` table with this column |
| `application_status` | `pending`, `approved`, `rejected` | Vendor and rider application lifecycle |
| `vehicle_type` | `petrol`, `electric` | KingdomDash fleet supports both motorcycle types |
| `vehicle_status` | `active`, `maintenance`, `retired` | Fleet operational lifecycle |
| `service_type` | `food`, `grocery`, `courier` | Core service lines; drives business-rule constraints on `orders` and `deliveries` |
| `order_status` | `pending`, `payment_pending`, `payment_processing`, `payment_confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `in_transit`, `delivered`, `cancelled` | Full order lifecycle from placement through delivery; matches `src/utils/constants.ts` |
| `payment_status` | `pending`, `processing`, `successful`, `failed`, `refunded` | Paystack payment states; matches `src/utils/constants.ts` |
| `delivery_status` | `pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled` | Operational delivery lifecycle; matches `src/utils/constants.ts` |
| `assignment_status` | `assigned`, `accepted`, `rejected`, `completed` | Rider-to-delivery assignment states; matches `src/utils/constants.ts` |
| `notification_type` | `info`, `success`, `warning`, `error` | Visual severity classification for in-app notifications |
| `contact_status` | `new`, `in_progress`, `resolved` | Admin workflow state for contact form messages |
| `earning_payment_status` | `pending`, `paid` | Rider earnings payout tracking |

Invalid enum values are rejected by PostgreSQL with a constraint violation error at insert time — no application-layer validation required for categorical enforcement.

---

## 7. Table Designs

### 7.1 Category Design (Contradiction Resolution)

The requirements contained a conflict:
- `categories.vendor_id NOT NULL` implies all categories are vendor-specific
- Requirement 9 requests vendor-independent "reference food/grocery categories" as seed data

**Resolution: Two-table design**

#### `reference_categories` — Global lookup table

Seeded once, never vendor-owned. Provides canonical food/grocery category names.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `name` | `text` | `NOT NULL` | — |
| `service_type` | `service_type` | `NOT NULL` | — |
| `display_order` | `integer` | `NOT NULL` | `0` |
| `is_active` | `boolean` | `NOT NULL` | `true` |

No `vendor_id`. Seed data populates this table with canonical food/grocery names.

#### `categories` — Vendor-specific categories

Each vendor maintains their own category list. They may optionally link to a reference category via the nullable FK.

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `vendor_id` | `uuid` | `NOT NULL REFERENCES vendors(id) ON DELETE CASCADE` | — |
| `name` | `text` | `NOT NULL` | — |
| `reference_category_id` | `uuid` | `REFERENCES reference_categories(id) ON DELETE SET NULL` | `NULL` |
| `service_type` | `service_type` | — | `NULL` |
| `description` | `text` | — | `NULL` |
| `display_order` | `integer` | `NOT NULL` | `0` |
| `is_active` | `boolean` | `NOT NULL` | `true` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

This design satisfies both requirements: seed data lives in `reference_categories`, vendors control their own `categories`, and the optional link allows UI to group or suggest standard names.

---

### 7.2 All Application Tables

#### profiles

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | — |
| `email` | `text` | `NOT NULL` | — |
| `full_name` | `text` | `NOT NULL` | — |
| `phone` | `text` | — | `NULL` |
| `avatar_url` | `text` | — | `NULL` |
| `role` | `user_role` | `NOT NULL` | `'customer'` |
| `is_active` | `boolean` | `NOT NULL` | `true` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### vendor_applications

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `business_name` | `text` | `NOT NULL` | — |
| `business_type` | `business_type` | `NOT NULL` | — |
| `business_description` | `text` | — | `NULL` |
| `business_address` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `operating_hours` | `jsonb` | — | `NULL` |
| `service_area` | `text` | — | `NULL` |
| `status` | `application_status` | `NOT NULL` | `'pending'` |
| `rejection_reason` | `text` | — | `NULL` |
| `submitted_at` | `timestamptz` | `NOT NULL` | `now()` |
| `reviewed_at` | `timestamptz` | — | `NULL` |
| `reviewed_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | `NULL` |

#### vendors

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `business_name` | `text` | `NOT NULL` | — |
| `business_type` | `business_type` | `NOT NULL` | — |
| `business_description` | `text` | — | `NULL` |
| `business_address` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `logo_url` | `text` | — | `NULL` |
| `cover_image_url` | `text` | — | `NULL` |
| `operating_hours` | `jsonb` | — | `NULL` |
| `service_area` | `text` | — | `NULL` |
| `is_active` | `boolean` | `NOT NULL` | `true` |
| `rating` | `numeric(3,2)` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### rider_applications

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `full_name` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `address` | `text` | `NOT NULL` | — |
| `vehicle_type` | `vehicle_type` | `NOT NULL` | — |
| `vehicle_make` | `text` | `NOT NULL` | — |
| `vehicle_model` | `text` | `NOT NULL` | — |
| `vehicle_year` | `integer` | `NOT NULL` | — |
| `status` | `application_status` | `NOT NULL` | `'pending'` |
| `rejection_reason` | `text` | — | `NULL` |
| `submitted_at` | `timestamptz` | `NOT NULL` | `now()` |
| `reviewed_at` | `timestamptz` | — | `NULL` |
| `reviewed_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | `NULL` |

#### rider_application_private

| Column | Type | Constraints | Default |
|---|---|---|---|
| `application_id` | `uuid` | `PRIMARY KEY REFERENCES rider_applications(id) ON DELETE CASCADE` | — |
| `date_of_birth` | `date` | `NOT NULL` | — |
| `license_number` | `text` | `NOT NULL` | — |
| `license_expiry` | `date` | `NOT NULL` | — |
| `emergency_contact_name` | `text` | `NOT NULL` | — |
| `emergency_contact_phone` | `text` | `NOT NULL` | — |
| `bank_name` | `text` | `NOT NULL` | — |
| `bank_account_number` | `text` | `NOT NULL` | — |

#### riders

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `is_available` | `boolean` | `NOT NULL` | `false` |
| `total_deliveries` | `integer` | `NOT NULL` | `0` |
| `rating` | `numeric(3,2)` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### addresses

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `label` | `text` | `NOT NULL` | — |
| `recipient_name` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `address_line_1` | `text` | `NOT NULL` | — |
| `address_line_2` | `text` | — | `NULL` |
| `city` | `text` | `NOT NULL` | — |
| `state` | `text` | `NOT NULL` | — |
| `postal_code` | `text` | — | `NULL` |
| `is_default` | `boolean` | `NOT NULL` | `false` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### products

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `vendor_id` | `uuid` | `NOT NULL REFERENCES vendors(id) ON DELETE CASCADE` | — |
| `category_id` | `uuid` | `REFERENCES categories(id) ON DELETE SET NULL` | `NULL` |
| `name` | `text` | `NOT NULL` | — |
| `description` | `text` | — | `NULL` |
| `price` | `numeric(12,2)` | `NOT NULL CHECK (price >= 0)` | — |
| `image_url` | `text` | — | `NULL` |
| `is_available` | `boolean` | `NOT NULL` | `true` |
| `display_order` | `integer` | `NOT NULL` | `0` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### orders

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `customer_id` | `uuid` | `NOT NULL REFERENCES profiles(id)` | — |
| `vendor_id` | `uuid` | `REFERENCES vendors(id) ON DELETE SET NULL` | `NULL` |
| `service_type` | `service_type` | `NOT NULL` | — |
| `status` | `order_status` | `NOT NULL` | `'pending'` |
| `pickup_address` | `text` | `NOT NULL` | — |
| `delivery_address` | `text` | `NOT NULL` | — |
| `delivery_fee` | `numeric(12,2)` | `NOT NULL CHECK (delivery_fee >= 0)` | `0` |
| `subtotal` | `numeric(12,2)` | `NOT NULL CHECK (subtotal >= 0)` | `0` |
| `total` | `numeric(12,2)` | `NOT NULL CHECK (total >= 0)` | `0` |
| `special_instructions` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

> **Financial authority:** `subtotal` and `total` are never set by the browser. They are calculated inside `create_order_secure()` using DB-side prices (see Section 11.7).

#### order_items

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `order_id` | `uuid` | `NOT NULL REFERENCES orders(id) ON DELETE CASCADE` | — |
| `product_id` | `uuid` | `REFERENCES products(id) ON DELETE SET NULL` | `NULL` |
| `product_name` | `text` | `NOT NULL` | — |
| `unit_price` | `numeric(12,2)` | `NOT NULL CHECK (unit_price >= 0)` | — |
| `quantity` | `integer` | `NOT NULL CHECK (quantity > 0)` | — |
| `line_total` | `numeric(12,2)` | `NOT NULL CHECK (line_total >= 0)` | — |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |

`product_name` and `unit_price` are snapshotted at order time. Future product price changes do not alter historical `order_items`.

#### payments

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `order_id` | `uuid` | `NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE` | — |
| `paystack_reference` | `text` | `UNIQUE` | `NULL` |
| `amount` | `numeric(12,2)` | `NOT NULL CHECK (amount >= 0)` | — |
| `currency` | `text` | `NOT NULL` | `'NGN'` |
| `status` | `payment_status` | `NOT NULL` | `'pending'` |
| `verified_at` | `timestamptz` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

> **Critical:** No frontend role may directly INSERT or UPDATE `payments.status` to `'successful'`. Payment status transitions are server-side only (Phase 9 — Paystack webhook via Edge Function).

#### service_areas

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `name` | `text` | `NOT NULL UNIQUE` | — |
| `description` | `text` | — | `NULL` |
| `coverage_polygon` | `jsonb` | — | `NULL` |
| `is_active` | `boolean` | `NOT NULL` | `true` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### delivery_pricing_rules

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `service_type` | `service_type` | — | `NULL` (NULL = applies to all service types) |
| `base_fee` | `numeric(12,2)` | `NOT NULL CHECK (base_fee >= 0)` | — |
| `distance_rate` | `numeric(10,4)` | `NOT NULL CHECK (distance_rate >= 0)` | — |
| `min_fee` | `numeric(12,2)` | `CHECK (min_fee >= 0)` | `NULL` |
| `max_fee` | `numeric(12,2)` | `CHECK (max_fee >= 0)` | `NULL` |
| `service_area_id` | `uuid` | `REFERENCES service_areas(id) ON DELETE SET NULL` | `NULL` |
| `is_active` | `boolean` | `NOT NULL` | `true` |
| `effective_date` | `date` | `NOT NULL` | `CURRENT_DATE` |
| `expiry_date` | `date` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### vehicles

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `assigned_rider_id` | `uuid` | `UNIQUE REFERENCES riders(id) ON DELETE SET NULL` | `NULL` |
| `vehicle_type` | `vehicle_type` | `NOT NULL` | — |
| `make` | `text` | `NOT NULL` | — |
| `model` | `text` | `NOT NULL` | — |
| `year` | `integer` | `NOT NULL CHECK (year >= 2000)` | — |
| `license_plate` | `text` | `NOT NULL UNIQUE` | — |
| `vin` | `text` | — | `NULL` |
| `purchase_date` | `date` | — | `NULL` |
| `status` | `vehicle_status` | `NOT NULL` | `'active'` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

UNIQUE on `assigned_rider_id` enforces one vehicle per rider at the database level.

#### deliveries

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `order_id` | `uuid` | `UNIQUE REFERENCES orders(id) ON DELETE SET NULL` | `NULL` |
| `customer_name` | `text` | `NOT NULL` | — |
| `customer_phone` | `text` | `NOT NULL` | — |
| `service_type` | `service_type` | `NOT NULL` | — |
| `vendor_id` | `uuid` | `REFERENCES vendors(id) ON DELETE SET NULL` | `NULL` |
| `pickup_address` | `text` | `NOT NULL` | — |
| `pickup_contact` | `text` | `NOT NULL` | — |
| `delivery_address` | `text` | `NOT NULL` | — |
| `delivery_contact` | `text` | `NOT NULL` | — |
| `special_instructions` | `text` | — | `NULL` |
| `status` | `delivery_status` | `NOT NULL` | `'pending'` |
| `created_by` | `uuid` | `NOT NULL REFERENCES profiles(id)` | — |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

Same `service_type`/`vendor_id` business rule as `orders`, enforced by `validate_delivery_vendor_constraint()` trigger.

#### delivery_assignments

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `delivery_id` | `uuid` | `NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE` | — |
| `rider_id` | `uuid` | `NOT NULL REFERENCES riders(id)` | — |
| `assigned_by` | `uuid` | `NOT NULL REFERENCES profiles(id)` | — |
| `assigned_at` | `timestamptz` | `NOT NULL` | `now()` |
| `status` | `assignment_status` | `NOT NULL` | `'assigned'` |
| `notes` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### delivery_status_updates

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `delivery_id` | `uuid` | `NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE` | — |
| `old_status` | `delivery_status` | — | `NULL` |
| `new_status` | `delivery_status` | `NOT NULL` | — |
| `updated_by` | `uuid` | `NOT NULL REFERENCES profiles(id)` | — |
| `notes` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |

Append-only audit table — no `updated_at`.

#### rider_earnings

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `rider_id` | `uuid` | `NOT NULL REFERENCES riders(id)` | — |
| `delivery_id` | `uuid` | `NOT NULL REFERENCES deliveries(id)` | — |
| `delivery_assignment_id` | `uuid` | `NOT NULL REFERENCES delivery_assignments(id)` | — |
| `amount` | `numeric(12,2)` | `NOT NULL CHECK (amount >= 0)` | — |
| `currency` | `text` | `NOT NULL` | `'NGN'` |
| `payment_status` | `earning_payment_status` | `NOT NULL` | `'pending'` |
| `paid_at` | `timestamptz` | — | `NULL` |
| `notes` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |

Authoritative financial record. No `updated_at` — amendments create new rows rather than mutating existing records.

#### contact_messages

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `name` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `phone` | `text` | — | `NULL` |
| `subject` | `text` | `NOT NULL` | — |
| `message` | `text` | `NOT NULL` | — |
| `status` | `contact_status` | `NOT NULL` | `'new'` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

#### notifications

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | — |
| `title` | `text` | `NOT NULL` | — |
| `message` | `text` | `NOT NULL` | — |
| `type` | `notification_type` | `NOT NULL` | `'info'` |
| `is_read` | `boolean` | `NOT NULL` | `false` |
| `action_url` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |

No `updated_at` — the only mutable field is `is_read` and tracking update time is unnecessary overhead.

#### audit_logs

| Column | Type | Constraints | Default |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY` | `gen_random_uuid()` |
| `profile_id` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | `NULL` |
| `action` | `text` | `NOT NULL` | — |
| `entity_type` | `text` | `NOT NULL` | — |
| `entity_id` | `uuid` | — | `NULL` |
| `old_values` | `jsonb` | — | `NULL` |
| `new_values` | `jsonb` | — | `NULL` |
| `ip_address` | `text` | — | `NULL` |
| `user_agent` | `text` | — | `NULL` |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` |

Append-only. `super_admin` SELECT only; no frontend role may INSERT directly.


---

## 8. Business-Rule Constraints

### 8.1 Vendor-ID / Service-Type Rules

These rules cannot be expressed as simple CHECK constraints because they involve conditional NOT NULL logic. They are enforced by `BEFORE INSERT OR UPDATE` triggers.

**On `orders` — `validate_order_vendor_constraint()`:**
- `service_type IN ('food', 'grocery')` AND `vendor_id IS NULL` → raise exception
- `service_type = 'courier'` AND `vendor_id IS NOT NULL` → raise exception

**On `deliveries` — `validate_delivery_vendor_constraint()`:**
- Same logic applied to the `deliveries` table

### 8.2 RLS Unauthorized Operations — Precise Behavior

This is critical to understand correctly. PostgreSQL RLS behaves differently by operation type:

| Operation | Unauthorized result |
|---|---|
| `SELECT` (no matching `USING` policy) | Returns **empty result set** (no error) — non-matching rows are invisible |
| `INSERT` (no `WITH CHECK` policy passes) | **REJECTED with error** — `new row violates row-level security policy` |
| `UPDATE USING` (no matching row) | Row is **invisible**, update silently has no effect |
| `UPDATE WITH CHECK` (check fails) | **REJECTED with error** |
| `DELETE USING` (no matching row) | Row is **invisible**, delete silently has no effect |

The design documentation and RLS tests must reflect this distinction. Only INSERT/UPDATE WITH CHECK/DELETE on matched rows produce errors; SELECT always returns empty for denied rows.

### 8.3 CHECK Constraints Summary

| Table | Column | Constraint |
|---|---|---|
| `products` | `price` | `>= 0` |
| `order_items` | `unit_price` | `>= 0` |
| `order_items` | `quantity` | `> 0` |
| `order_items` | `line_total` | `>= 0` |
| `orders` | `delivery_fee` | `>= 0` |
| `orders` | `subtotal` | `>= 0` |
| `orders` | `total` | `>= 0` |
| `payments` | `amount` | `>= 0` |
| `delivery_pricing_rules` | `base_fee` | `>= 0` |
| `delivery_pricing_rules` | `distance_rate` | `>= 0` |
| `delivery_pricing_rules` | `min_fee` | `>= 0` (nullable) |
| `delivery_pricing_rules` | `max_fee` | `>= 0` (nullable) |
| `vehicles` | `year` | `>= 2000` |
| `rider_earnings` | `amount` | `>= 0` |

---

## 9. Foreign Key & Cascade Design

| Relationship | FK Column | ON DELETE | Rationale |
|---|---|---|---|
| `profiles` → `auth.users` | `profiles.id` | CASCADE | Deleting auth user removes entire application profile |
| `vendor_applications.profile_id` → `profiles` | `profile_id` | CASCADE | Applications die with the profile |
| `vendor_applications.reviewed_by` → `profiles` | `reviewed_by` | SET NULL | Preserves audit record if reviewer deleted |
| `vendors.profile_id` → `profiles` | `profile_id` | CASCADE | Vendor record invalid without owning profile |
| `rider_applications.profile_id` → `profiles` | `profile_id` | CASCADE | Same as vendor applications |
| `rider_applications.reviewed_by` → `profiles` | `reviewed_by` | SET NULL | Preserve audit trail |
| `rider_application_private` → `rider_applications` | `application_id` | CASCADE | Private data dies with the application |
| `riders.profile_id` → `profiles` | `profile_id` | CASCADE | Rider record invalid without owning profile |
| `addresses.profile_id` → `profiles` | `profile_id` | CASCADE | Addresses die with the profile |
| `categories.vendor_id` → `vendors` | `vendor_id` | CASCADE | Categories die with the vendor |
| `categories.reference_category_id` → `reference_categories` | `reference_category_id` | SET NULL | Category survives; reference link cleared |
| `products.vendor_id` → `vendors` | `vendor_id` | CASCADE | Products die with the vendor |
| `products.category_id` → `categories` | `category_id` | SET NULL | Product survives; category reference cleared |
| `orders.customer_id` → `profiles` | `customer_id` | NO ACTION | Order history preserved for financial records |
| `orders.vendor_id` → `vendors` | `vendor_id` | SET NULL | Order history preserved; vendor reference cleared |
| `order_items.order_id` → `orders` | `order_id` | CASCADE | Line items die with the order |
| `order_items.product_id` → `products` | `product_id` | SET NULL | Snapshot preserved; live product reference cleared |
| `payments.order_id` → `orders` | `order_id` | CASCADE | Payment is inseparable from its order |
| `delivery_pricing_rules.service_area_id` → `service_areas` | `service_area_id` | SET NULL | Rule becomes globally applicable |
| `vehicles.assigned_rider_id` → `riders` | `assigned_rider_id` | SET NULL | Vehicle persists unassigned if rider deleted |
| `deliveries.order_id` → `orders` | `order_id` | SET NULL | Delivery history preserved; order link cleared |
| `deliveries.vendor_id` → `vendors` | `vendor_id` | SET NULL | Delivery history preserved |
| `deliveries.created_by` → `profiles` | `created_by` | NO ACTION | Retain audit trail |
| `delivery_assignments.delivery_id` → `deliveries` | `delivery_id` | CASCADE | Assignments die with the delivery |
| `delivery_assignments.rider_id` → `riders` | `rider_id` | NO ACTION | Preserve assignment history |
| `delivery_assignments.assigned_by` → `profiles` | `assigned_by` | NO ACTION | Preserve audit trail |
| `delivery_status_updates.delivery_id` → `deliveries` | `delivery_id` | CASCADE | Status history dies with delivery |
| `delivery_status_updates.updated_by` → `profiles` | `updated_by` | NO ACTION | Preserve audit trail |
| `rider_earnings.rider_id` → `riders` | `rider_id` | NO ACTION | Financial records preserved |
| `rider_earnings.delivery_id` → `deliveries` | `delivery_id` | NO ACTION | Financial records preserved |
| `rider_earnings.delivery_assignment_id` → `delivery_assignments` | `delivery_assignment_id` | NO ACTION | Financial records preserved |
| `notifications.profile_id` → `profiles` | `profile_id` | CASCADE | Notifications die with the profile |
| `audit_logs.profile_id` → `profiles` | `profile_id` | SET NULL | Audit entry preserved; actor reference cleared |

---

## 10. Index Strategy

| Table | Indexed Columns | Query Patterns Served |
|---|---|---|
| `profiles` | `(role)` | Role-based admin lookups, filtering by role |
| `vendor_applications` | `(profile_id)`, `(status)` | My-applications queries, admin status filtering |
| `rider_applications` | `(profile_id)`, `(status)` | Same pattern |
| `vendors` | `(profile_id)`, `(business_type)`, `(is_active)` | Vendor ownership check, service-type browsing, active vendor listings |
| `categories` | `(vendor_id)`, `(is_active)` | Category listing by vendor, active-only filtering |
| `products` | `(vendor_id)`, `(category_id)`, `(is_available)` | Product listing, category grouping, availability filtering |
| `orders` | `(customer_id)`, `(vendor_id)`, `(status)`, `(service_type)` | Customer history, vendor order queue, status-based admin views |
| `order_items` | `(order_id)` | Line item fetches (always fetched by order) |
| `payments` | `(order_id)`, `(status)` | Payment lookup by order, admin payment status filtering |
| `deliveries` | `(status)`, `(service_type)`, `(vendor_id)` | Delivery queue management |
| `delivery_assignments` | `(delivery_id)`, `(rider_id)`, `(status)` | Rider assignments, delivery assignment lookup |
| `rider_earnings` | `(rider_id)`, `(payment_status)` | Rider earnings history, unpaid earnings queries |
| `notifications` | `(profile_id)`, `(is_read)` | Notification inbox, unread count |
| `audit_logs` | `(profile_id)`, `(entity_type)`, `(created_at)` | Actor activity audit, entity history, time-range queries |

---

## 11. Database Functions & Triggers

### 11.1 `set_updated_at()` — SECURITY INVOKER

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

Applied as `BEFORE UPDATE` trigger on all tables with `updated_at`:
`profiles`, `vendor_applications`, `vendors`, `rider_applications`, `riders`, `addresses`, `categories`, `products`, `orders`, `payments`, `service_areas`, `delivery_pricing_rules`, `vehicles`, `deliveries`, `delivery_assignments`, `contact_messages`.

Uses SECURITY INVOKER because it only sets a timestamp — no privilege elevation needed.

### 11.2 `handle_new_user()` — SECURITY DEFINER

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

Applied as `AFTER INSERT ON auth.users FOR EACH ROW`.

**Why SECURITY DEFINER:** The trigger fires in the `auth` schema context. Writing to `public.profiles` requires elevated privileges. The `SET search_path = public, auth` pin prevents search_path injection. The `ON CONFLICT DO NOTHING` clause makes it safe to replay.

### 11.3 `get_current_user_role()` — SECURITY DEFINER (Critical RLS Helper)

```sql
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid();
  RETURN v_role;
END;
$$;
```

**Problem it solves:** Without this function, RLS policies that check roles would query `profiles` from inside an RLS evaluation context — which triggers recursive RLS evaluation on the `profiles` table, causing infinite loops or permission errors.

**Why SECURITY DEFINER:** Bypasses RLS to read `profiles.role` for the current user only. The WHERE clause is strictly `id = auth.uid()` — this function cannot be used to read any other user's role.

**Privilege escalation prevention:**
- STABLE — no writes allowed
- Fixed `WHERE id = auth.uid()` — reads only the caller's row
- `SET search_path = public` — prevents injection
- Returns a single `user_role` enum value only

**Usage in all role-checking policies:**
```sql
-- CORRECT
USING (get_current_user_role() IN ('admin', 'super_admin'))

-- INCORRECT — causes recursive RLS
USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin'))
```

### 11.4 `validate_order_vendor_constraint()` — SECURITY INVOKER

```sql
CREATE OR REPLACE FUNCTION validate_order_vendor_constraint()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type IN ('food', 'grocery') AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'vendor_id is required for food and grocery orders';
  END IF;
  IF NEW.service_type = 'courier' AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_id must be NULL for courier orders';
  END IF;
  RETURN NEW;
END;
$$;
```

Applied as `BEFORE INSERT OR UPDATE ON orders FOR EACH ROW`.

### 11.5 `validate_delivery_vendor_constraint()` — SECURITY INVOKER

Identical logic applied to `deliveries`:

```sql
CREATE OR REPLACE FUNCTION validate_delivery_vendor_constraint()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type IN ('food', 'grocery') AND NEW.vendor_id IS NULL THEN
    RAISE EXCEPTION 'vendor_id is required for food and grocery deliveries';
  END IF;
  IF NEW.service_type = 'courier' AND NEW.vendor_id IS NOT NULL THEN
    RAISE EXCEPTION 'vendor_id must be NULL for courier deliveries';
  END IF;
  RETURN NEW;
END;
$$;
```

Applied as `BEFORE INSERT OR UPDATE ON deliveries FOR EACH ROW`.


### 11.6 `increment_rider_deliveries()` — SECURITY INVOKER

This trigger fires on **both INSERT and UPDATE**. `OLD` is not available during `INSERT`, so the trigger uses `TG_OP` to handle each case correctly:
- **INSERT**: A new assignment created directly as `completed` → increment immediately
- **UPDATE**: An assignment transitioning **into** `completed` from a different status → increment once; ignore if already completed

```sql
CREATE OR REPLACE FUNCTION increment_rider_deliveries()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'completed' THEN
      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      UPDATE public.riders
      SET total_deliveries = total_deliveries + 1
      WHERE id = NEW.rider_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

Applied as `AFTER INSERT OR UPDATE ON delivery_assignments FOR EACH ROW`.

### 11.7 `create_order_secure()` — SECURITY DEFINER (Server-Authoritative Order RPC)

This is the **only** path for creating food/grocery orders. It enforces complete server-side financial authority.

**Parameters (client supplies):**
- `p_vendor_id uuid` — which vendor to order from
- `p_service_type service_type` — must be `food` or `grocery` (courier rejected)
- `p_pickup_address text`
- `p_delivery_address text`
- `p_items jsonb` — array of `{ "product_id": "uuid", "quantity": integer }`
- `p_special_instructions text DEFAULT NULL`

**The client MUST NOT supply and this function NEVER accepts:**
- `subtotal` — calculated server-side from DB prices
- `delivery_fee` — set to 0 server-side (Phase 8 will replace with distance-based calculation)
- `total` — calculated server-side
- `unit_price` or `line_total` — snapshotted from DB

**Financial authority model:**
- Product price → read from `products` table (DB is authoritative)
- Quantity → supplied by client (validated by function)
- Subtotal → calculated server-side
- Delivery fee → 0 (server-controlled placeholder until Phase 8)
- Total → calculated server-side

**Security validations performed:**
1. Caller must be authenticated
2. `p_service_type` must be `food` or `grocery` — courier orders are rejected
3. `p_items` must not be empty
4. The specified vendor must exist and be `is_active = true`
5. Every product must exist, be `is_available = true`, AND have `vendor_id = p_vendor_id` (cross-vendor mixing rejected)
6. Every quantity must be a positive integer

**Execution privileges:**
- `REVOKE EXECUTE ... FROM PUBLIC` — not callable by unauthenticated users
- `GRANT EXECUTE ... TO authenticated` — only authenticated users may call it

```sql
CREATE OR REPLACE FUNCTION create_order_secure(
  p_vendor_id            uuid,
  p_service_type         service_type,
  p_pickup_address       text,
  p_delivery_address     text,
  p_items                jsonb,
  p_special_instructions text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id   uuid;
  v_subtotal   numeric(12,2) := 0;
  v_item       jsonb;
  v_product    record;
  v_line_total numeric(12,2);
  v_qty        integer;
BEGIN
  -- 1. Verify caller is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Restrict to food/grocery only
  IF p_service_type NOT IN ('food', 'grocery') THEN
    RAISE EXCEPTION 'create_order_secure is for food and grocery orders only. Courier orders use a separate workflow.';
  END IF;

  -- 3. Reject empty item arrays
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- 4. Verify vendor exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Vendor not found or is not active';
  END IF;

  -- 5. Create order with zero totals initially
  --    delivery_fee = 0 (server-controlled; Phase 8 replaces with distance-based calculation)
  INSERT INTO public.orders (
    customer_id, vendor_id, service_type,
    pickup_address, delivery_address, delivery_fee,
    subtotal, total, special_instructions, status
  )
  VALUES (
    auth.uid(), p_vendor_id, p_service_type,
    p_pickup_address, p_delivery_address,
    0, 0, 0, p_special_instructions, 'pending'
  )
  RETURNING id INTO v_order_id;

  -- 6. Insert order items, reading prices from DB
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Validate quantity
    IF (v_item->>'quantity') IS NULL THEN
      RAISE EXCEPTION 'Item quantity is required';
    END IF;
    BEGIN
      v_qty := (v_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Item quantity must be a valid integer';
    END;
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    -- Fetch product: must belong to p_vendor_id AND be available
    SELECT id, name, price INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND vendor_id = p_vendor_id
      AND is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found, unavailable, or does not belong to vendor %',
        v_item->>'product_id', p_vendor_id;
    END IF;

    v_line_total := v_product.price * v_qty;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, unit_price, quantity, line_total
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,   -- snapshot name at order time
      v_product.price,  -- snapshot price from DB, never from client
      v_qty,
      v_line_total
    );

    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- 7. Update order with server-calculated totals
  --    total = subtotal + 0 (delivery_fee is 0 in Phase 2)
  UPDATE public.orders
  SET subtotal = v_subtotal, total = v_subtotal
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

-- Restrict execution to authenticated users only
REVOKE EXECUTE ON FUNCTION create_order_secure(uuid, service_type, text, text, jsonb, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_order_secure(uuid, service_type, text, text, jsonb, text) TO authenticated;
```

**Security guarantees:**
- `SECURITY DEFINER` + pinned `search_path = public` — no injection
- Client never supplies prices, fees, or totals
- Vendor validated as active before any INSERT
- Products validated as available AND belonging to the specified vendor — cross-vendor mixing impossible
- Empty orders rejected before any rows are created
- Quantities validated before each INSERT
- Courier orders explicitly rejected at function entry
- `validate_order_vendor_constraint` trigger fires as additional DB-level defence
- The entire function is transactional — any failure rolls back; no partial orders are created

---

## 12. RLS Architecture & Security Model

### 12.1 Default Deny Posture

RLS is enabled on all 23 public tables. With no matching policy, PostgreSQL denies access. The exact behaviour per operation:

| Operation | Unauthorised result |
|---|---|
| SELECT (no USING match) | Empty result set — rows are invisible, no error |
| INSERT (WITH CHECK fails) | **Error** — `new row violates row-level security policy` |
| UPDATE USING (no match) | Row invisible, update silently has no effect |
| UPDATE WITH CHECK (fails) | **Error** — check violation |
| DELETE USING (no match) | Row invisible, delete silently has no effect |

### 12.2 Role Helper — No Recursive RLS

All role-based policies use `get_current_user_role()` (Section 11.3). This function is SECURITY DEFINER and bypasses RLS on `profiles` to read only the current user's role. It must NEVER be replaced with a direct `(SELECT role FROM profiles WHERE id = auth.uid())` subquery inside a policy, because that would cause recursive RLS evaluation on `profiles`.

### 12.3 profiles.role Self-Escalation Protection

Users MUST NOT be able to change their own `role` or `is_active` flag through normal self-service profile updates. The RLS UPDATE policy on `profiles` must restrict which columns a user can modify:

- A user's self-service UPDATE policy `profiles_update_own` uses `WITH CHECK` coupled with the `get_own_profile_flags()` SECURITY DEFINER helper to enforce that `role = (SELECT p_role FROM public.get_own_profile_flags())` and `is_active = (SELECT p_is_active FROM public.get_own_profile_flags())` — users cannot self-escalate their role or reactivate suspended accounts.
- Administrative role changes and status toggles are server-side operations managed exclusively through dedicated SECURITY DEFINER RPCs (`admin_set_user_role` and `admin_toggle_user_active`), with standard admins having zero direct UPDATE access to `profiles`.
- The implementation explicitly tests that a customer cannot self-promote to `vendor`, `rider`, `admin`, or `super_admin`.

### 12.4 Per-Table Access Matrix

| Table | Public | Customer (own) | Vendor (own) | Rider (own) | Admin | Super Admin |
|---|---|---|---|---|---|---|
| `profiles` | — | SELECT, UPDATE (excl. role/is_active) | own row only | own row only | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `vendor_applications` | — | INSERT own, SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `vendors` | SELECT active | — | SELECT own, UPDATE own | — | Full | Full |
| `rider_applications` | — | INSERT own, SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `rider_application_private` | — | **None** | — | — | Full | Full |
| `riders` | — | — | — | SELECT own, UPDATE own | Full | Full |
| `addresses` | — | Full own | — | — | — | — |
| `reference_categories` | SELECT | — | — | — | INSERT, UPDATE, DELETE | INSERT, UPDATE, DELETE |
| `categories` | SELECT active | — | INSERT/UPDATE/DELETE own vendor | — | Full | Full |
| `products` | SELECT available | — | INSERT/UPDATE/DELETE own vendor | — | Full | Full |
| `orders` | — | INSERT own, SELECT own | SELECT own vendor | — | Full | Full |
| `order_items` | — | SELECT (via order) | SELECT (via order) | — | Full | Full |
| `payments` | — | SELECT own | — | — | SELECT all, UPDATE any | SELECT all, UPDATE any |
| `service_areas` | SELECT active | — | — | — | INSERT, UPDATE, DELETE | INSERT, UPDATE, DELETE |
| `delivery_pricing_rules` | SELECT active | — | — | — | INSERT, UPDATE, DELETE | INSERT, UPDATE, DELETE |
| `vehicles` | — | — | — | SELECT assigned (via riders.id) | Full | Full |
| `deliveries` | — | SELECT (via order) | SELECT (via vendor) | SELECT assigned | Full | Full |
| `delivery_assignments` | — | — | — | SELECT own, UPDATE own | Full | Full |
| `delivery_status_updates` | — | — | — | INSERT for assigned | SELECT all, INSERT | Full |
| `rider_earnings` | — | — | — | SELECT own | Full | Full |
| `contact_messages` | INSERT | INSERT | INSERT | INSERT | SELECT all, UPDATE | Full |
| `notifications` | — | SELECT own, UPDATE own | — | — | SELECT all, INSERT | Full |
| `audit_logs` | — | — | — | — | — | SELECT only |

**Notes:**
- `rider_application_private`: Absolutely no access for applicants or any non-admin role.
- `payments.status`: No frontend role may set `status = 'successful'` — this is server-side only (Phase 9).
- `audit_logs`: No frontend role may INSERT — server-side functions only.
- `vehicles` rider policy: Uses `assigned_rider_id = (SELECT r.id FROM riders r WHERE r.profile_id = auth.uid())` — never `assigned_rider_id = auth.uid()`.

---

## 13. TypeScript Type Strategy

### 13.1 Generated Types

`src/types/database.types.ts` is the single source of truth for database types. It is **generated output only** and must never be manually edited.

**Generation command (added to `package.json`):**
```
"db:types": "supabase gen types typescript --local > src/types/database.types.ts"
```

Run after `supabase start` (local) or after any schema migration is applied.

### 13.2 Bootstrap Sequencing

During initial project setup, before a local Supabase instance is running, `database.types.ts` will not exist. The Supabase client (`client.ts`) imports `Database` from this file. To keep the TypeScript build green during bootstrapping:

1. The client imports `Database` as a type-only import: `import type { Database } from '@/types/database.types'`
2. A placeholder `database.types.ts` is committed that exports a minimal `Database = {}` type, clearly marked as a temporary bootstrap scaffold
3. Once `supabase start` is run and migrations are applied, `npm run db:types` regenerates the real types
4. The TypeScript compiler will then surface any type mismatches between the service layer and the real schema

The `unknown` generic (e.g. `createClient<unknown>`) is NOT part of the architecture and must not appear in any committed code. The client must always use `createClient<Database>()`.

### 13.3 index.ts Compatibility

`src/types/index.ts` re-exports `Database` from `database.types.ts` using an additive export only. No existing Phase 1 types are renamed, removed, or shadowed.

---

## 14. Service Layer Architecture

### 14.1 Module Structure

```
src/services/supabase/
├── client.ts       — typed singleton, env validation
├── profiles.ts     — getCurrentProfile(), updateProfile()
├── vendors.ts      — getActiveVendors(), getVendorById(), getVendorsByType()
├── products.ts     — getProductsByVendor(), getAvailableProducts()
├── orders.ts       — createOrderSecure() (calls RPC), getOrderById(), getOrdersByCustomer()
├── deliveries.ts   — getDeliveriesByStatus(), getDeliveryById()
├── riders.ts       — getRiderProfile(), updateRiderAvailability()
└── admin.ts        — getAllVendors(), getAllRiders(), getPendingApplications()
```

### 14.2 Error Handling Convention

All service functions return `{ data, error }` — never throw. Callers check `error` before using `data`. This matches the Supabase client's native error pattern.

### 14.3 createOrderSecure Security

`orders.ts` exposes `createOrderSecure()` which calls `supabase.rpc('create_order_secure', {...})`. This is the only permitted order creation path from the frontend. The service function accepts: `vendorId`, `serviceType`, `pickupAddress`, `deliveryAddress`, `items` (array of `{productId, quantity}`), and `specialInstructions`. It does NOT accept or pass any price, fee, or total.

### 14.4 updateRiderAvailability Ownership

`updateRiderAvailability(riderId, available)` calls the Supabase client with the rider's ID. Authorization is enforced by PostgreSQL RLS — the RLS UPDATE policy on `riders` allows a rider to update only their own row (where `profile_id = auth.uid()`). The service layer does not perform any additional client-side authorization check. If the authenticated user does not own the rider record, the update silently has no effect (UPDATE USING — non-matching row is invisible).

---

## 15. Testing Strategy

### 15.1 Two-Layer Testing Requirement

Phase 2 requires **two** types of tests:

**Layer 1 — Service-layer unit tests (vitest + mocks):**
- Mock the Supabase client to test service function behaviour, error propagation, and return shapes
- These run without any database and are part of `npm run test`

**Layer 2 — PostgreSQL RLS integration tests (vitest + local Supabase):**
- These tests connect to a real local Supabase PostgreSQL instance (`supabase start`)
- They create test users with different roles and verify actual RLS behaviour
- They are NOT mocks — they test the real database policies

### 15.2 Required RLS Integration Tests

The following must be tested against the real database:

1. Customer A cannot read Customer B's orders (`SELECT` returns empty set)
2. Customer A cannot modify Customer B's address (`UPDATE` has no effect / row invisible)
3. Customer A cannot modify Customer B's order (`UPDATE` has no effect)
4. Customer A cannot change their own `profiles.role` to `admin` (`UPDATE WITH CHECK` rejected)
5. Customer A cannot change their own `profiles.is_active` (`UPDATE WITH CHECK` rejected)
6. Vendor A cannot modify Vendor B's products (`UPDATE WITH CHECK` rejected)
7. Rider A cannot read Rider B's delivery assignments (`SELECT` returns empty set)
8. Rider ownership chain works: `auth.uid() → profiles.id → riders.profile_id → riders.id` used in policy
9. Anonymous user gets empty set from `profiles`
10. Unauthorized `SELECT` returns empty set (no error)
11. Unauthorized `INSERT` is rejected with error
12. Frontend cannot set `payments.status = 'successful'` directly (INSERT/UPDATE rejected)
13. Frontend cannot INSERT into `audit_logs` (rejected)
14. `create_order_secure()` rejects a product that belongs to a different vendor
15. `create_order_secure()` rejects `service_type = 'courier'`
16. `create_order_secure()` rejects an empty items array
17. `create_order_secure()` rejects quantity = 0
18. `updateRiderAvailability()` — rider cannot update another rider's record

**File:** `src/services/supabase/__tests__/rls.test.ts`

If local Supabase is not available in the test environment, tests should be skipped with a documented reason rather than passing with mock assertions.

---

## 16. Seed Data Strategy

The seed migration (`20260902000012_seed_reference_data.sql`) is a standard versioned Supabase migration. Once applied, the Supabase CLI records it in the migration history and will not apply it again automatically.

**Idempotency:** All seed `INSERT` statements use `ON CONFLICT DO NOTHING` so the migration is safe to apply against a database that already has some of the data (e.g. from a previous partial run).

**Re-seeding during development:** To wipe and re-seed a local database from scratch, use `supabase db reset` (local only). This replays all migrations from the beginning. Do not attempt to "re-run" an individual migration file by hand — this would corrupt the migration history.

**What is seeded:**
- `reference_categories`: 10 food + 10 grocery canonical category names
- `service_areas`: 5 Lagos service areas
- `delivery_pricing_rules`: 1 default rule (base_fee=500, distance_rate=100, delivery_fee=0 is calculated at order time)

---

## 17. Authentication Assumption

The `profiles` table requires `email text NOT NULL`, and `handle_new_user()` copies `NEW.email` from `auth.users`.

**Assumption:** KingdomDash V1 authentication (Phase 3) uses email-based accounts. This is consistent with Supabase Auth's default email provider.

**Architecture note:** The architecture document (`KINGDOMDASH_FINAL_ARCHITECTURE.md`) lists phone authentication and social OAuth (Google, Apple) as deferred (not V1). If phone-only accounts (where `email` would be null) are ever introduced, the `profiles.email` column must be made nullable and `handle_new_user()` updated accordingly. This is a documented Phase 3+ concern.

---

## 18. Phase 1 Compatibility Rules

The following files and directories from Phase 1 are LOCKED and must not be modified by Phase 2:

- `src/components/` — all layout and UI components
- `src/pages/` — all page components
- `src/stores/` — Zustand stores
- `src/hooks/` — custom hooks
- `src/styles/` — CSS and design token files
- `src/utils/constants.ts` — existing constants (Phase 2 may read; must not modify)
- Existing `src/types/index.ts` exports (Phase 2 additions must be additive only)

Phase 2 only adds new files under `src/services/supabase/`, `src/types/database.types.ts`, `supabase/`, and updates `.env.example` and `package.json` scripts.

---

## 19. Phase 2 Completion Criteria

Phase 2 is complete when:

- [ ] `supabase/migrations/` contains 12 numbered migration files
- [ ] All 23 public tables exist in the database (22 application + `reference_categories`)
- [ ] All 13 enums exist
- [ ] RLS is enabled on all 23 tables
- [ ] `get_current_user_role()` function exists and is used by all role-checking policies
- [ ] `create_order_secure()` function exists with correct signature (no `p_delivery_fee` parameter)
- [ ] `increment_rider_deliveries()` correctly handles both INSERT and UPDATE via `TG_OP`
- [ ] Seed data exists: 20 reference categories, 5 service areas, 1 pricing rule
- [ ] `src/types/database.types.ts` exists (bootstrap scaffold; `npm run db:types` regenerates it)
- [ ] `src/services/supabase/` contains 8 module files
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes (Phase 1 tests + service-layer tests)
- [ ] RLS integration tests documented (run against local Supabase)
- [ ] `supabase/docs/schema.md` exists
- [ ] `.env.example` updated — no real credentials, correct VITE/non-VITE separation
- [ ] No Phase 1 files modified

---

## 20. Known Future-Phase Dependencies

| Phase | Depends on Phase 2 |
|---|---|
| Phase 3 (Auth & RBAC) | `profiles`, `handle_new_user()`, `user_role` enum, RLS policies |
| Phase 5 (Vendor System) | `vendors`, `categories`, `products`, `reference_categories`, vendor RLS |
| Phase 6 (Ordering & Cart) | `orders`, `order_items`, `create_order_secure()`, payment schema |
| Phase 7 (Maps) | `service_areas`, `delivery_pricing_rules`, `addresses` |
| Phase 8 (Delivery Pricing) | `delivery_pricing_rules`; will replace `delivery_fee = 0` in `create_order_secure()` |
| Phase 9 (Paystack) | `payments` table, `payment_status` enum, server-side payment verification |
| Phase 10 (Delivery Ops) | `deliveries`, `delivery_assignments`, `delivery_status_updates`, `rider_earnings` |
| Phase 11 (Rider Platform) | `riders`, `vehicles`, `delivery_assignments`, rider RLS policies |
| Phase 12 (Admin) | All tables, `audit_logs`, admin RLS policies |
| Phase 13 (Notifications) | `notifications` table and RLS |
