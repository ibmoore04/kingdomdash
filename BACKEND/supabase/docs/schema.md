# KingdomDash Database Schema — Phase 2

This document is the authoritative human-readable reference for the KingdomDash PostgreSQL database as established in Phase 2. The database runs on **PostgreSQL via Supabase**, contains **23 public tables**, uses **13 enums** for categorical integrity, and enforces a **Default Deny** Row Level Security posture on every table.

> **For developers:** You can understand the complete schema from this document without reading the migration files. Migration files in `supabase/migrations/` are the single source of truth for the actual DDL; this document is a companion reference.

---

## Table of Contents

1. [Enums (13 total)](#enums)
2. [Tables (23 total)](#tables)
3. [Entity Relationship Summary](#entity-relationship-summary)
4. [Security Model](#security-model)
5. [Rider ID Chain — Critical for RLS](#rider-id-chain)
6. [Database Functions & Triggers](#database-functions--triggers)
7. [Financial Authority Rules](#financial-authority-rules)
8. [RLS Unauthorized Operation Behaviour](#rls-unauthorized-operation-behaviour)

---

## Enums

All 13 enums are created in the `public` schema. PostgreSQL rejects any value not in the enum at insert time — no application-layer categorical validation is required.

| Enum | Values | Purpose |
|---|---|---|
| `user_role` | `customer`, `vendor`, `rider`, `admin`, `super_admin` | Application permission tier assigned to each profile |
| `business_type` | `restaurant`, `grocery_store` | Vendor type discriminator; single `vendors` table uses this column |
| `application_status` | `pending`, `approved`, `rejected` | Vendor and rider application lifecycle state |
| `vehicle_type` | `petrol`, `electric` | Fleet vehicle fuel type; KingdomDash supports both motorcycle types |
| `vehicle_status` | `active`, `maintenance`, `retired` | Fleet operational state |
| `service_type` | `food`, `grocery`, `courier` | Core KingdomDash service lines; drives business-rule constraints on `orders` and `deliveries` |
| `order_status` | `pending`, `payment_pending`, `payment_processing`, `payment_confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `in_transit`, `delivered`, `cancelled` | Full order lifecycle from placement through delivery |
| `payment_status` | `pending`, `processing`, `successful`, `failed`, `refunded` | Paystack payment states |
| `delivery_status` | `pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled` | Operational delivery lifecycle |
| `assignment_status` | `assigned`, `accepted`, `rejected`, `completed` | Rider-to-delivery assignment states |
| `notification_type` | `info`, `success`, `warning`, `error` | Notification severity classification for in-app display |
| `contact_status` | `new`, `in_progress`, `resolved` | Contact form admin workflow state |
| `earning_payment_status` | `pending`, `paid` | Rider earnings payout tracking state |

---

## Tables

Tables are listed in dependency order (referenced tables before referencing tables).

---

### 1. `profiles`

**Purpose:** Application-level user record linked 1:1 to `auth.users`; auto-provisioned by the `handle_new_user()` trigger on signup.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` | Matches `auth.uid()` |
| `email` | `text` | `NOT NULL` | Copied from `auth.users` on creation |
| `full_name` | `text` | `NOT NULL` | From signup metadata |
| `phone` | `text` | — | Optional |
| `avatar_url` | `text` | — | Optional |
| `role` | `user_role` | `NOT NULL DEFAULT 'customer'` | Application permission tier |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Soft-disable flag |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Set by `set_updated_at` trigger |

**FK relationships:** `id → auth.users.id` ON DELETE CASCADE

**Indexes:** `profiles(role)`

**RLS policies:**
- Authenticated user: SELECT and UPDATE own row only (`id = auth.uid()`); cannot change own `role` or `is_active`
- Admin / Super Admin: SELECT all rows; UPDATE any row

---

### 2. `vendor_applications`

**Purpose:** Stores pending and reviewed requests for a profile to become a vendor.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | Applicant |
| `business_name` | `text` | `NOT NULL` | — |
| `business_type` | `business_type` | `NOT NULL` | Enum |
| `business_description` | `text` | — | Optional |
| `business_address` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `operating_hours` | `jsonb` | — | Optional structured hours |
| `service_area` | `text` | — | Optional |
| `status` | `application_status` | `NOT NULL DEFAULT 'pending'` | Lifecycle state |
| `rejection_reason` | `text` | — | Set by admin on rejection |
| `submitted_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `reviewed_at` | `timestamptz` | — | Set by admin on review |
| `reviewed_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Admin who reviewed |

**FK relationships:**
- `profile_id → profiles.id` ON DELETE CASCADE
- `reviewed_by → profiles.id` ON DELETE SET NULL

**Indexes:** `vendor_applications(profile_id)`, `vendor_applications(status)`

**RLS policies:**
- Authenticated: INSERT own application (`profile_id = auth.uid()`); SELECT own applications
- Admin / Super Admin: SELECT all; UPDATE any (for approval/rejection)

---

### 3. `rider_applications`

**Purpose:** Stores pending and reviewed requests for a profile to become a rider (non-sensitive fields only).

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `profile_id` | `uuid` | `NOT NULL REFERENCES profiles(id) ON DELETE CASCADE` | Applicant |
| `full_name` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `address` | `text` | `NOT NULL` | — |
| `vehicle_type` | `vehicle_type` | `NOT NULL` | Enum |
| `vehicle_make` | `text` | `NOT NULL` | — |
| `vehicle_model` | `text` | `NOT NULL` | — |
| `vehicle_year` | `integer` | `NOT NULL` | — |
| `status` | `application_status` | `NOT NULL DEFAULT 'pending'` | Lifecycle state |
| `rejection_reason` | `text` | — | Set by admin on rejection |
| `submitted_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `reviewed_at` | `timestamptz` | — | Set by admin on review |
| `reviewed_by` | `uuid` | `REFERENCES profiles(id) ON DELETE SET NULL` | Admin who reviewed |

**FK relationships:**
- `profile_id → profiles.id` ON DELETE CASCADE
- `reviewed_by → profiles.id` ON DELETE SET NULL

**Indexes:** `rider_applications(profile_id)`, `rider_applications(status)`

**RLS policies:**
- Authenticated: INSERT own application (`profile_id = auth.uid()`); SELECT own applications
- Admin / Super Admin: SELECT all; UPDATE any

---

### 4. `rider_application_private`

**Purpose:** Stores sensitive rider application data (licence, bank details, DoB) segregated for strict admin-only access.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `application_id` | `uuid` | `PRIMARY KEY REFERENCES rider_applications(id) ON DELETE CASCADE` | 1:1 with rider_applications |
| `date_of_birth` | `date` | `NOT NULL` | — |
| `license_number` | `text` | `NOT NULL` | — |
| `license_expiry` | `date` | `NOT NULL` | — |
| `emergency_contact_name` | `text` | `NOT NULL` | — |
| `emergency_contact_phone` | `text` | `NOT NULL` | — |
| `bank_name` | `text` | `NOT NULL` | — |
| `bank_account_number` | `text` | `NOT NULL` | — |

**FK relationships:** `application_id → rider_applications.id` ON DELETE CASCADE

**Indexes:** (primary key only)

**RLS policies:**
- Admin / Super Admin: Full access (SELECT, INSERT, UPDATE, DELETE)
- **All other roles including the applicant themselves: absolutely no access**

---

### 5. `reference_categories`

**Purpose:** Global food/grocery category lookup table seeded once at migration time; never vendor-owned.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `name` | `text` | `NOT NULL` | e.g. "Rice", "Produce" |
| `service_type` | `service_type` | `NOT NULL` | `food` or `grocery` |
| `display_order` | `integer` | `NOT NULL DEFAULT 0` | Sort order |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | — |

**FK relationships:** (none — global lookup)

**Indexes:** (none beyond primary key)

**RLS policies:**
- Public (anonymous + authenticated): SELECT all
- Admin / Super Admin: INSERT, UPDATE, DELETE

---

### 6. `vendors`

**Purpose:** Approved vendor businesses (restaurants or grocery stores) listed on KingdomDash.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `profile_id` | `uuid` | `NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE` | One vendor per profile |
| `business_name` | `text` | `NOT NULL` | — |
| `business_type` | `business_type` | `NOT NULL` | Enum |
| `business_description` | `text` | — | Optional |
| `business_address` | `text` | `NOT NULL` | — |
| `phone` | `text` | `NOT NULL` | — |
| `email` | `text` | `NOT NULL` | — |
| `logo_url` | `text` | — | Optional |
| `cover_image_url` | `text` | — | Optional |
| `operating_hours` | `jsonb` | — | Optional structured hours |
| `service_area` | `text` | — | Optional |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | Controls public visibility |
| `rating` | `numeric(3,2)` | — | Computed aggregate; nullable |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Set by trigger |

**FK relationships:** `profile_id → profiles.id` ON DELETE CASCADE

**Indexes:** `vendors(profile_id)`, `vendors(business_type)`, `vendors(is_active)`

**RLS policies:**
- Public: SELECT where `is_active = true`
- Vendor (own): SELECT own row; UPDATE own row
- Admin / Super Admin: Full access (SELECT, INSERT, UPDATE, DELETE)

---

### 7. `categories`

**Purpose:** Vendor-specific menu / product categories with an optional link to `reference_categories`.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `vendor_id` | `uuid` | `NOT NULL REFERENCES vendors(id) ON DELETE CASCADE` | Owning vendor |
| `name` | `text` | `NOT NULL` | — |
| `reference_category_id` | `uuid` | `REFERENCES reference_categories(id) ON DELETE SET NULL` | Optional link to global lookup |
| `service_type` | `service_type` | — | Optional enum filter |
| `description` | `text` | — | Optional |
| `display_order` | `integer` | `NOT NULL DEFAULT 0` | Sort order |
| `is_active` | `boolean` | `NOT NULL DEFAULT true` | — |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Set by trigger |

**FK relationships:**
- `vendor_id → vendors.id` ON DELETE CASCADE
- `reference_category_id → reference_categories.id` ON DELETE SET NULL

**Indexes:** `categories(vendor_id)`, `categories(is_active)`

**RLS policies:**
- Public: SELECT where `is_active = true` AND parent vendor `is_active = true`
- Vendor (own): INSERT, UPDATE, DELETE own vendor's categories
- Admin / Super Admin: Full access

---

### 8. `products`

**Purpose:** Vendor menu items or grocery products available for ordering.

| Column | Type | Constraints / Default | Notes |
|---|---|---|---|
| `id` | `uuid` | `PRIMARY KEY DEFAULT gen_random_uuid()` | — |
| `vendor_id` | `uuid` | `NOT NULL REFERENCES vendors(id) ON DELETE CASCADE` | Owning vendor |
| `category_id` | `uuid` | `REFERENCES categories(id) ON DELETE SET NULL` | Optional category grouping |
| `name` | `text` | `NOT NULL` | — |
| `description` | `text` | — | Optional |
| `price` | `numeric(12,2)` | `NOT NULL CHECK (price >= 0)` | Server-read price; never client-supplied in orders |
| `image_url` | `text` | — | Optional |
| `is_available` | `boolean` | `NOT NULL DEFAULT true` | Controls public visibility |
| `display_order` | `integer` | `NOT NULL DEFAULT 0` | Sort order |
| `created_at` | `timestamptz` | `NOT NULL DEFAULT now()` | — |
| `updated_at` | `timestamptz` | `NOT NULL DEFAULT now()` | Set by trigger |

**FK relationships:**
- `vendor_id → vendors.id` ON DELETE CASCADE
- `category_id → categories.id` ON DELETE SET NULL

**Indexes:** `products(vendor_id)`, `products(category_id)`, `products(is_available)`

**RLS policies:**
- Public: SELECT where `is_available = true` AND parent vendor `is_active = true`
- Vendor (own): INSERT, UPDATE, DELETE own vendor's products
- Admin / Super Admin: Full access
