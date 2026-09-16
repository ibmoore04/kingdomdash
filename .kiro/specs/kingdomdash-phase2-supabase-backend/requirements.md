# Requirements Document

## Introduction

Phase 2 establishes the secure and scalable Supabase/PostgreSQL backend foundation for KingdomDash — a Nigerian multi-service delivery platform (Food, Grocery, Courier). This phase delivers the complete database schema, Row Level Security policies, seed/reference data, TypeScript type integration, versioned migration files, Supabase client configuration, and backend validation/testing infrastructure. No authentication UI, payment processing, maps/geocoding, real-time GPS tracking, or ordering cart UI is implemented in this phase. Phase 1 frontend remains completely intact and unmodified.

---

## Glossary

- **Database**: The PostgreSQL database managed by Supabase.
- **Migration**: A versioned SQL file that applies incremental, ordered changes to the Database schema.
- **Profile**: A row in the `profiles` table representing an authenticated user's application-level data, separate from `auth.users`.
- **Role**: An application-level permission tier assigned to a Profile: `customer`, `vendor`, `rider`, `admin`, or `super_admin`.
- **Vendor**: An approved business (restaurant or grocery store) with products listed on KingdomDash.
- **Rider**: An approved delivery agent assigned to fulfil deliveries.
- **RLS**: Row Level Security — PostgreSQL's mechanism for restricting per-row access. The **primary** security mechanism for KingdomDash; client-side guards are UX only.
- **Default Deny**: The RLS posture where no access is granted unless an explicit, minimal policy allows it.
- **Supabase_Client**: The singleton `@supabase/supabase-js` client configured with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Service_Role_Key**: The Supabase service-role secret. Must never appear in frontend code or be committed to source control.
- **Anon_Key**: The Supabase public anon key. Safe to expose in the frontend; used by Supabase_Client.
- **Type_Generator**: The `supabase gen types typescript` CLI command that produces TypeScript types from the live Database schema.
- **Seed_Data**: Reference rows inserted into lookup/enum-like tables (roles, food categories, grocery categories, service areas) required for the application to function.
- **Order_Item**: A row in `order_items` that captures the product name, unit price, and quantity **at the time of order placement** so historical pricing is preserved independently of future product price changes.
- **Delivery_Pricing_Rule**: A configurable rule stored in `delivery_pricing_rules` defining base fee, per-km rate, service type, and optional date range; used by the server to compute delivery fees.
- **Vendor_Application**: A pending or reviewed request for a business to become a Vendor.
- **Rider_Application**: A pending or reviewed request for an individual to become a Rider. Non-sensitive fields are in `rider_applications`; sensitive fields (licence, bank details, DoB) are in `rider_application_private`, accessible only to admins.
- **Audit_Log**: An append-only record in `audit_logs` capturing who did what to which entity, readable only by `super_admin`.
- **Contact_Message**: A row in `contact_messages` submitted by anonymous visitors via the public contact form.
- **Notification**: A row in `notifications` delivered to a specific Profile, readable only by that Profile.
- **Service_Area**: A named geographic coverage zone used for service availability checks and (future) distance-pricing lookups.
- **Vehicle**: A KingdomDash-owned or fleet motorcycle (petrol or electric) assigned to a Rider via `vehicles.assigned_rider_id`.
- **Delivery**: An operational record tracking fulfilment of a customer order from pickup through drop-off.
- **Delivery_Assignment**: A record linking a Delivery to a Rider for a specific pickup/delivery task.
- **Rider_Earnings**: The authoritative financial record of a Rider's per-delivery compensation; earnings are computed from this table, not from a rider aggregate field.
- **Order**: A customer-placed request for food, grocery, or courier service, including all status transitions from placement through delivery.

---

## Requirements

### Requirement 1: Supabase Project Configuration & Environment Variables

**User Story:** As a developer, I want a properly configured Supabase client and a complete `.env.example` file, so that any team member can set up a working local environment without exposing secrets.

#### Acceptance Criteria

1. THE Supabase_Client SHALL be initialised in `src/services/supabase/client.ts` using only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from environment variables.
2. IF `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is absent at runtime, THEN THE Supabase_Client SHALL throw a descriptive error before the application mounts.
3. THE `.env.example` file SHALL document `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with placeholder values and inline comments stating these are the only Supabase keys permitted in frontend code.
4. THE `.env.example` file SHALL document `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_PASSWORD` as server-side-only variables with inline comments stating they must never use the `VITE_` prefix and must never be committed.
5. THE `.gitignore` file SHALL include `.env`, `.env.local`, and `.env.*.local` so secrets are never committed to source control.
6. WHERE the `SUPABASE_SERVICE_ROLE_KEY` is required for migration scripts or server-side tooling, THE migration tooling SHALL read it from a non-`VITE_`-prefixed environment variable exclusively.

---

### Requirement 2: Versioned Migration Files

**User Story:** As a developer, I want all schema changes expressed as sequential, numbered migration files, so that the Database can be reproduced deterministically from scratch and changes can be reviewed in pull requests.

#### Acceptance Criteria

1. THE Database SHALL be created and updated exclusively through Migration files located in `supabase/migrations/`.
2. WHEN a new schema change is needed, THE migration tooling SHALL generate a Migration file whose filename begins with a UTC timestamp prefix (e.g., `20260902000001_<description>.sql`).
3. THE Migration system SHALL apply Migrations in ascending filename order, ensuring deterministic schema evolution.
4. IF a Migration has already been applied, THEN THE migration tooling SHALL skip it without error.
5. THE initial Migration SHALL create all enums defined in Requirement 3, all tables defined in Requirement 4, all foreign-key constraints defined in Requirement 5, all indexes defined in Requirement 6, all database functions and triggers defined in Requirement 7, and all RLS policies defined in Requirement 8.
6. THE Seed_Data Migration (Requirement 9) SHALL be a separate Migration file applied after the schema Migration.

---

### Requirement 3: PostgreSQL Enumerations

**User Story:** As a developer, I want all categorical values modelled as PostgreSQL enums, so that invalid values are rejected at the database level and TypeScript types remain in sync.

#### Acceptance Criteria

1. THE Database SHALL define a `user_role` enum with values: `customer`, `vendor`, `rider`, `admin`, `super_admin`.
2. THE Database SHALL define a `business_type` enum with values: `restaurant`, `grocery_store`.
3. THE Database SHALL define a `application_status` enum with values: `pending`, `approved`, `rejected`.
4. THE Database SHALL define a `vehicle_type` enum with values: `petrol`, `electric`.
5. THE Database SHALL define a `vehicle_status` enum with values: `active`, `maintenance`, `retired`.
6. THE Database SHALL define a `service_type` enum with values: `food`, `grocery`, `courier`.
7. THE Database SHALL define an `order_status` enum with values: `pending`, `payment_pending`, `payment_processing`, `payment_confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `in_transit`, `delivered`, `cancelled`.
8. THE Database SHALL define a `payment_status` enum with values: `pending`, `processing`, `successful`, `failed`, `refunded`.
9. THE Database SHALL define a `delivery_status` enum with values: `pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled`.
10. THE Database SHALL define an `assignment_status` enum with values: `assigned`, `accepted`, `rejected`, `completed`.
11. THE Database SHALL define a `notification_type` enum with values: `info`, `success`, `warning`, `error`.
12. THE Database SHALL define a `contact_status` enum with values: `new`, `in_progress`, `resolved`.
13. THE Database SHALL define an `earning_payment_status` enum with values: `pending`, `paid`.
14. WHEN a value not present in an enum is inserted into a column typed with that enum, THEN THE Database SHALL reject the insertion with a constraint violation error.

---

### Requirement 4: Core Table Definitions

**User Story:** As a developer, I want all V1 tables created with the correct columns, types, defaults, and NOT NULL constraints, so that the application has a complete and consistent data layer.

#### Acceptance Criteria

1. THE Database SHALL contain a `profiles` table with: `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `email text NOT NULL`, `full_name text NOT NULL`, `phone text`, `avatar_url text`, `role user_role NOT NULL DEFAULT 'customer'`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

2. THE Database SHALL contain a `vendor_applications` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `business_name text NOT NULL`, `business_type business_type NOT NULL`, `business_description text`, `business_address text NOT NULL`, `phone text NOT NULL`, `email text NOT NULL`, `operating_hours jsonb`, `service_area text`, `status application_status NOT NULL DEFAULT 'pending'`, `rejection_reason text`, `submitted_at timestamptz NOT NULL DEFAULT now()`, `reviewed_at timestamptz`, `reviewed_by uuid REFERENCES profiles(id)`.

3. THE Database SHALL contain a `vendors` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `business_name text NOT NULL`, `business_type business_type NOT NULL`, `business_description text`, `business_address text NOT NULL`, `phone text NOT NULL`, `email text NOT NULL`, `logo_url text`, `cover_image_url text`, `operating_hours jsonb`, `service_area text`, `is_active boolean NOT NULL DEFAULT true`, `rating numeric(3,2)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

4. THE Database SHALL contain a `rider_applications` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `full_name text NOT NULL`, `phone text NOT NULL`, `email text NOT NULL`, `address text NOT NULL`, `vehicle_type vehicle_type NOT NULL`, `vehicle_make text NOT NULL`, `vehicle_model text NOT NULL`, `vehicle_year integer NOT NULL`, `status application_status NOT NULL DEFAULT 'pending'`, `rejection_reason text`, `submitted_at timestamptz NOT NULL DEFAULT now()`, `reviewed_at timestamptz`, `reviewed_by uuid REFERENCES profiles(id)`.

5. THE Database SHALL contain a `rider_application_private` table with: `application_id uuid PRIMARY KEY REFERENCES rider_applications(id) ON DELETE CASCADE`, `date_of_birth date NOT NULL`, `license_number text NOT NULL`, `license_expiry date NOT NULL`, `emergency_contact_name text NOT NULL`, `emergency_contact_phone text NOT NULL`, `bank_name text NOT NULL`, `bank_account_number text NOT NULL`.

6. THE Database SHALL contain a `riders` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `is_available boolean NOT NULL DEFAULT false`, `total_deliveries integer NOT NULL DEFAULT 0`, `rating numeric(3,2)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

7. THE Database SHALL contain an `addresses` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `label text NOT NULL`, `recipient_name text NOT NULL`, `phone text NOT NULL`, `address_line_1 text NOT NULL`, `address_line_2 text`, `city text NOT NULL`, `state text NOT NULL`, `postal_code text`, `is_default boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

8. THE Database SHALL contain a `categories` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE`, `name text NOT NULL`, `description text`, `display_order integer NOT NULL DEFAULT 0`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

9. THE Database SHALL contain a `products` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE`, `category_id uuid REFERENCES categories(id) ON DELETE SET NULL`, `name text NOT NULL`, `description text`, `price numeric(12,2) NOT NULL CHECK (price >= 0)`, `image_url text`, `is_available boolean NOT NULL DEFAULT true`, `display_order integer NOT NULL DEFAULT 0`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

10. THE Database SHALL contain an `orders` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `customer_id uuid NOT NULL REFERENCES profiles(id)`, `vendor_id uuid REFERENCES vendors(id)`, `service_type service_type NOT NULL`, `status order_status NOT NULL DEFAULT 'pending'`, `pickup_address text NOT NULL`, `delivery_address text NOT NULL`, `delivery_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0)`, `subtotal numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0)`, `total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0)`, `special_instructions text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

11. THE Database SHALL contain an `order_items` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE`, `product_id uuid REFERENCES products(id) ON DELETE SET NULL`, `product_name text NOT NULL`, `unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0)`, `quantity integer NOT NULL CHECK (quantity > 0)`, `line_total numeric(12,2) NOT NULL CHECK (line_total >= 0)`, `created_at timestamptz NOT NULL DEFAULT now()`.

12. THE Database SHALL contain a `payments` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE`, `paystack_reference text UNIQUE`, `amount numeric(12,2) NOT NULL CHECK (amount >= 0)`, `currency text NOT NULL DEFAULT 'NGN'`, `status payment_status NOT NULL DEFAULT 'pending'`, `verified_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

13. THE Database SHALL contain a `service_areas` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `name text NOT NULL UNIQUE`, `description text`, `coverage_polygon jsonb`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

14. THE Database SHALL contain a `delivery_pricing_rules` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `service_type service_type`, `base_fee numeric(12,2) NOT NULL CHECK (base_fee >= 0)`, `distance_rate numeric(10,4) NOT NULL CHECK (distance_rate >= 0)`, `min_fee numeric(12,2) CHECK (min_fee >= 0)`, `max_fee numeric(12,2) CHECK (max_fee >= 0)`, `service_area_id uuid REFERENCES service_areas(id) ON DELETE SET NULL`, `is_active boolean NOT NULL DEFAULT true`, `effective_date date NOT NULL DEFAULT CURRENT_DATE`, `expiry_date date`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

15. THE Database SHALL contain a `vehicles` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `assigned_rider_id uuid UNIQUE REFERENCES riders(id) ON DELETE SET NULL`, `vehicle_type vehicle_type NOT NULL`, `make text NOT NULL`, `model text NOT NULL`, `year integer NOT NULL CHECK (year >= 2000)`, `license_plate text NOT NULL UNIQUE`, `vin text`, `purchase_date date`, `status vehicle_status NOT NULL DEFAULT 'active'`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

16. THE Database SHALL contain a `deliveries` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `order_id uuid UNIQUE REFERENCES orders(id) ON DELETE SET NULL`, `customer_name text NOT NULL`, `customer_phone text NOT NULL`, `service_type service_type NOT NULL`, `vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL`, `pickup_address text NOT NULL`, `pickup_contact text NOT NULL`, `delivery_address text NOT NULL`, `delivery_contact text NOT NULL`, `special_instructions text`, `status delivery_status NOT NULL DEFAULT 'pending'`, `created_by uuid NOT NULL REFERENCES profiles(id)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

17. THE Database SHALL contain a `delivery_assignments` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`, `rider_id uuid NOT NULL REFERENCES riders(id)`, `assigned_by uuid NOT NULL REFERENCES profiles(id)`, `assigned_at timestamptz NOT NULL DEFAULT now()`, `status assignment_status NOT NULL DEFAULT 'assigned'`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

18. THE Database SHALL contain a `delivery_status_updates` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`, `old_status delivery_status`, `new_status delivery_status NOT NULL`, `updated_by uuid NOT NULL REFERENCES profiles(id)`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`.

19. THE Database SHALL contain a `rider_earnings` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `rider_id uuid NOT NULL REFERENCES riders(id)`, `delivery_id uuid NOT NULL REFERENCES deliveries(id)`, `delivery_assignment_id uuid NOT NULL REFERENCES delivery_assignments(id)`, `amount numeric(12,2) NOT NULL CHECK (amount >= 0)`, `currency text NOT NULL DEFAULT 'NGN'`, `payment_status earning_payment_status NOT NULL DEFAULT 'pending'`, `paid_at timestamptz`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`.

20. THE Database SHALL contain a `contact_messages` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `name text NOT NULL`, `email text NOT NULL`, `phone text`, `subject text NOT NULL`, `message text NOT NULL`, `status contact_status NOT NULL DEFAULT 'new'`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.

21. THE Database SHALL contain a `notifications` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `title text NOT NULL`, `message text NOT NULL`, `type notification_type NOT NULL DEFAULT 'info'`, `is_read boolean NOT NULL DEFAULT false`, `action_url text`, `created_at timestamptz NOT NULL DEFAULT now()`.

22. THE Database SHALL contain an `audit_logs` table with: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL`, `action text NOT NULL`, `entity_type text NOT NULL`, `entity_id uuid`, `old_values jsonb`, `new_values jsonb`, `ip_address text`, `user_agent text`, `created_at timestamptz NOT NULL DEFAULT now()`.

---

### Requirement 5: Business-Rule Constraints & Referential Integrity

**User Story:** As a developer, I want the database to enforce business rules at the constraint level, so that invalid data states are impossible regardless of which application layer writes data.

#### Acceptance Criteria

1. WHEN a row is inserted into `orders` with `service_type = 'food'` or `service_type = 'grocery'`, THEN THE Database SHALL enforce that `vendor_id` is NOT NULL via a check constraint.
2. WHEN a row is inserted into `orders` with `service_type = 'courier'`, THEN THE Database SHALL enforce that `vendor_id` IS NULL via a check constraint.
3. WHEN a row is inserted into `deliveries` with `service_type = 'food'` or `service_type = 'grocery'`, THEN THE Database SHALL enforce that `vendor_id` is NOT NULL.
4. WHEN a row is inserted into `deliveries` with `service_type = 'courier'`, THEN THE Database SHALL enforce that `vendor_id` IS NULL.
5. THE `products.price` column SHALL enforce `price >= 0` via a check constraint.
6. THE `order_items` table SHALL enforce `quantity > 0` and `unit_price >= 0` and `line_total >= 0` via check constraints.
7. THE `payments` table SHALL enforce that `amount >= 0` via a check constraint.
8. THE `delivery_pricing_rules` table SHALL enforce `base_fee >= 0` and `distance_rate >= 0` via check constraints.
9. THE `vehicles.year` column SHALL enforce `year >= 2000` via a check constraint.
10. THE `rider_earnings.amount` column SHALL enforce `amount >= 0` via a check constraint.
11. IF a `profiles` row is deleted, THEN THE Database SHALL cascade the deletion to `vendor_applications`, `vendor`, `rider_applications`, `rider`, `addresses`, and `notifications` rows referencing that profile.
12. IF a `vendors` row is deleted, THEN THE Database SHALL cascade the deletion to `categories` and `products` rows belonging to that vendor.
13. IF a `orders` row is deleted, THEN THE Database SHALL cascade the deletion to `order_items` and `payments`.
14. THE `vehicles` table SHALL enforce that each rider is assigned to at most one vehicle via a UNIQUE constraint on `assigned_rider_id`.
15. THE `vendors.profile_id` column SHALL be UNIQUE, enforcing one vendor record per profile.
16. THE `riders.profile_id` column SHALL be UNIQUE, enforcing one rider record per profile.

---

### Requirement 6: Indexes for Query Performance

**User Story:** As a developer, I want indexes on high-frequency query columns, so that common lookups and joins execute efficiently as data grows.

#### Acceptance Criteria

1. THE Database SHALL have an index on `profiles(role)` to support role-based lookups.
2. THE Database SHALL have an index on `vendor_applications(profile_id)` and `vendor_applications(status)`.
3. THE Database SHALL have an index on `rider_applications(profile_id)` and `rider_applications(status)`.
4. THE Database SHALL have an index on `vendors(profile_id)`, `vendors(business_type)`, and `vendors(is_active)`.
5. THE Database SHALL have an index on `products(vendor_id)`, `products(category_id)`, and `products(is_available)`.
6. THE Database SHALL have an index on `orders(customer_id)`, `orders(vendor_id)`, `orders(status)`, and `orders(service_type)`.
7. THE Database SHALL have an index on `order_items(order_id)`.
8. THE Database SHALL have an index on `payments(order_id)` and `payments(status)`.
9. THE Database SHALL have an index on `deliveries(status)`, `deliveries(service_type)`, and `deliveries(vendor_id)`.
10. THE Database SHALL have an index on `delivery_assignments(delivery_id)`, `delivery_assignments(rider_id)`, and `delivery_assignments(status)`.
11. THE Database SHALL have an index on `rider_earnings(rider_id)` and `rider_earnings(payment_status)`.
12. THE Database SHALL have an index on `notifications(profile_id)` and `notifications(is_read)`.
13. THE Database SHALL have an index on `audit_logs(profile_id)`, `audit_logs(entity_type)`, and `audit_logs(created_at)`.

---

### Requirement 7: Database Functions & Triggers

**User Story:** As a developer, I want server-side functions and triggers for cross-cutting concerns, so that logic like `updated_at` timestamps, profile provisioning, and earnings auditing cannot be bypassed by client code.

#### Acceptance Criteria

1. THE Database SHALL define a function `set_updated_at()` that sets `NEW.updated_at = now()` and returns `NEW`.
2. THE Database SHALL attach `set_updated_at()` as a `BEFORE UPDATE` trigger on every table that has an `updated_at` column: `profiles`, `vendor_applications`, `vendors`, `rider_applications`, `riders`, `addresses`, `categories`, `products`, `orders`, `payments`, `service_areas`, `delivery_pricing_rules`, `vehicles`, `deliveries`, `delivery_assignments`, `contact_messages`.
3. THE Database SHALL define a function `handle_new_user()` that automatically inserts a row into `profiles` (with `id`, `email`, and `role = 'customer'`) whenever a new row is inserted into `auth.users`.
4. WHEN a new user is created in `auth.users`, THE `handle_new_user()` trigger SHALL fire and create a corresponding `profiles` row so the profile always exists for any authenticated user.
5. THE Database SHALL define a function `validate_order_vendor_constraint()` that checks the food/grocery/courier vendor_id business rule on `orders` and raises an exception if violated, called from a `BEFORE INSERT OR UPDATE` trigger on `orders`.
6. THE Database SHALL define a function `validate_delivery_vendor_constraint()` equivalent to criterion 5 but applied to the `deliveries` table.
7. WHEN a `delivery_assignments` row transitions to `status = 'completed'`, THE Database SHALL fire a trigger that increments `riders.total_deliveries` by 1 for the associated rider.

---

### Requirement 8: Row Level Security Policies (Default Deny)

**User Story:** As a security engineer, I want every table protected by RLS with a Default Deny posture, so that no data is ever accidentally exposed and each role can access only what it is explicitly permitted to access.

#### Acceptance Criteria

1. THE Database SHALL enable RLS on every table listed in Requirement 4.
2. WHEN RLS is enabled on a table with no policies, THE Database SHALL deny all access by default (Default Deny).
3. THE `profiles` table SHALL allow each authenticated user to SELECT and UPDATE only their own row (where `id = auth.uid()`).
4. THE `profiles` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and UPDATE any row.
5. THE `vendor_applications` table SHALL allow an authenticated user to INSERT their own application (where `profile_id = auth.uid()`) and SELECT their own application.
6. THE `vendor_applications` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and UPDATE any row (for approval/rejection).
7. THE `vendors` table SHALL allow public (anonymous) SELECT on rows where `is_active = true`.
8. THE `vendors` table SHALL allow the owning vendor profile to SELECT and UPDATE their own vendor row.
9. THE `vendors` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE any vendor row.
10. THE `rider_applications` table SHALL allow an authenticated user to INSERT their own application and SELECT their own application.
11. THE `rider_applications` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and UPDATE any row.
12. THE `rider_application_private` table SHALL allow ONLY `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE. No other role, including applicants, SHALL have any access.
13. THE `riders` table SHALL allow the owning rider profile to SELECT and UPDATE their own row.
14. THE `riders` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE any row.
15. THE `categories` table SHALL allow public SELECT on active categories belonging to active vendors.
16. THE `categories` table SHALL allow the owning vendor to INSERT, UPDATE, and DELETE their own categories.
17. THE `categories` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
18. THE `products` table SHALL allow public SELECT on available products belonging to active vendors.
19. THE `products` table SHALL allow the owning vendor to INSERT, UPDATE, and DELETE their own products.
20. THE `products` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
21. THE `addresses` table SHALL allow an authenticated user to SELECT, INSERT, UPDATE, and DELETE only their own address rows (where `profile_id = auth.uid()`).
22. THE `orders` table SHALL prohibit direct client INSERT from authenticated customers. All order creation SHALL flow exclusively through the authoritative `public.create_order_secure()` SECURITY DEFINER RPC.
23. THE `orders` table SHALL allow an authenticated customer to SELECT only their own orders (where `customer_id = auth.uid()`).
24. THE `orders` table SHALL allow the owning vendor to SELECT orders where `vendor_id` matches their vendor profile.
25. THE `orders` table SHALL allow the owning vendor to UPDATE `status` on orders belonging to their vendor (for preparing/ready_for_pickup transitions).
26. THE `orders` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
27. THE `order_items` table SHALL allow SELECT to any principal who can SELECT the parent `orders` row.
28. THE `order_items` table SHALL prohibit direct client INSERT from authenticated customers. Order items SHALL be created exclusively within the transactional context of `public.create_order_secure()`.
29. THE `payments` table SHALL allow a customer to SELECT their own payment (via the linked order's `customer_id`).
30. THE `payments` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and UPDATE any row.
31. THE `payments` table SHALL NOT allow any frontend role to directly INSERT or UPDATE a payment row's `status` to `successful` — payment status transitions are server-side only.
32. THE `service_areas` table SHALL allow public SELECT on active rows.
33. THE `service_areas` table SHALL allow `admin` and `super_admin` roles to INSERT, UPDATE, and DELETE.
34. THE `delivery_pricing_rules` table SHALL allow public SELECT on active rows (frontend needs fee display).
35. THE `delivery_pricing_rules` table SHALL allow `admin` and `super_admin` roles to INSERT, UPDATE, and DELETE.
36. THE `vehicles` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
37. THE `vehicles` table SHALL allow a rider to SELECT only the vehicle row where `assigned_rider_id` matches their rider profile id.
38. THE `deliveries` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
39. THE `deliveries` table SHALL allow a rider to SELECT deliveries where they have an associated `delivery_assignments` row.
40. THE `deliveries` table SHALL allow a vendor to SELECT deliveries where `vendor_id` matches their vendor profile.
41. THE `deliveries` table SHALL allow a customer to SELECT deliveries where the linked `order_id` belongs to them.
42. THE `delivery_assignments` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
43. THE `delivery_assignments` table SHALL allow a rider to SELECT and UPDATE (for accept/reject) only rows where `rider_id` matches their rider profile id.
44. THE `delivery_status_updates` table SHALL allow `admin` and `super_admin` to SELECT all and INSERT.
45. THE `delivery_status_updates` table SHALL allow a rider to INSERT a status update for a delivery they are assigned to.
46. THE `delivery_status_updates` table SHALL allow a rider to SELECT status updates for deliveries they are assigned to.
47. THE `rider_earnings` table SHALL allow a rider to SELECT only rows where `rider_id` matches their rider profile id.
48. THE `rider_earnings` table SHALL allow `admin` and `super_admin` roles to SELECT, INSERT, UPDATE, and DELETE all rows.
49. THE `contact_messages` table SHALL allow any anonymous or authenticated user to INSERT a new row.
50. THE `contact_messages` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and UPDATE (for status changes).
51. THE `notifications` table SHALL allow an authenticated user to SELECT and UPDATE (mark as read) only their own notifications (where `profile_id = auth.uid()`).
52. THE `notifications` table SHALL allow `admin` and `super_admin` roles to SELECT all rows and INSERT notifications for any profile.
53. THE `audit_logs` table SHALL allow `super_admin` roles to SELECT all rows.
54. THE `audit_logs` table SHALL allow server-side functions to INSERT rows; no frontend role SHALL INSERT directly.
55. IF a user queries any table without a matching RLS policy, THEN THE Database SHALL return an empty result set (not an error) to prevent information leakage.

---

### Requirement 9: Seed & Reference Data

**User Story:** As a developer, I want a seed migration that inserts reference data, so that the application has the categories, service areas, and role reference rows it needs to function from day one.

#### Acceptance Criteria

1. THE Seed_Data Migration SHALL insert at least the following food categories as vendor-independent reference rows into a `reference_food_categories` lookup table (or equivalent): `Rice`, `Soups`, `Grills`, `Swallow`, `Pasta`, `Sides`, `Drinks`, `Snacks`, `Breakfast`, `Proteins`.
2. THE Seed_Data Migration SHALL insert at least the following grocery categories as vendor-independent reference rows into a `reference_grocery_categories` lookup table (or equivalent): `Produce`, `Pantry`, `Beverages`, `Dairy`, `Household`, `Snacks`, `Frozen`, `Bakery`, `Condiments`, `Personal Care`.
3. THE Seed_Data Migration SHALL insert initial service areas matching the Lagos areas referenced in the existing mock data: `Lekki Phase 1`, `Yaba`, `Victoria Island`, `Ikeja`, `Surulere`.
4. THE Seed_Data Migration SHALL insert a default delivery pricing rule with `is_active = true`, `base_fee = 500`, `distance_rate = 100`, and `service_type = NULL` (applies to all service types) as a starting configuration for admin review.
5. THE Seed_Data Migration SHALL be idempotent — running it multiple times SHALL NOT create duplicate rows (use `INSERT ... ON CONFLICT DO NOTHING`).

---

### Requirement 10: TypeScript Type Generation & Integration

**User Story:** As a developer, I want generated TypeScript types that reflect the exact Database schema, so that all service layer code is type-safe and compile errors surface when schema and code diverge.

#### Acceptance Criteria

1. THE Type_Generator SHALL produce a file at `src/types/database.types.ts` containing TypeScript interfaces for every table, enum, and function in the Database.
2. THE `package.json` SHALL include a `db:types` script that runs `supabase gen types typescript --local > src/types/database.types.ts` (or equivalent for the configured project).
3. THE Supabase_Client in `src/services/supabase/client.ts` SHALL be typed with `createClient<Database>()` using the generated `Database` type so all queries benefit from type inference.
4. WHEN the Database schema changes, THE developer SHALL re-run `npm run db:types` to regenerate `src/types/database.types.ts`, and THE TypeScript compiler SHALL surface any resulting type mismatches as compile errors.
5. THE `src/types/index.ts` file SHALL re-export or extend application-level types derived from the generated database types, maintaining backward compatibility with existing type consumers in the Phase 1 codebase.
6. THE `src/types/database.types.ts` file SHALL NOT be manually edited — it is generated output only.

---

### Requirement 11: Supabase Service Layer

**User Story:** As a developer, I want thin service modules that wrap Supabase queries for each domain, so that query logic is centralised, testable, and not scattered across components.

#### Acceptance Criteria

1. THE service layer SHALL be organised under `src/services/supabase/` with one module per domain: `client.ts`, `profiles.ts`, `vendors.ts`, `products.ts`, `orders.ts`, `deliveries.ts`, `riders.ts`, `admin.ts`.
2. WHEN a service function encounters a Supabase error, THE service function SHALL return a typed `{ data: null, error: PostgrestError }` result rather than throwing, consistent with the Supabase client's native error pattern.
3. THE `profiles.ts` service SHALL export: `getCurrentProfile()`, `updateProfile(id, data)`.
4. THE `vendors.ts` service SHALL export: `getActiveVendors()`, `getVendorById(id)`, `getVendorsByType(type)`.
5. THE `products.ts` service SHALL export: `getProductsByVendor(vendorId)`, `getAvailableProducts(vendorId)`.
6. THE `orders.ts` service SHALL export: `createOrder(data)`, `getOrderById(id)`, `getOrdersByCustomer(customerId)`.
7. WHEN the `createOrder` service function is called, THE service function SHALL write `order_items` rows using the product's `name` and `price` at the time of the call (not a reference that will change if the product price is later updated), preserving historical pricing.
8. THE service functions SHALL use the generated `Database` types for all parameter and return type annotations.

---

### Requirement 12: Security Validation & RLS Testing

**User Story:** As a security engineer, I want automated tests that verify RLS policies behave correctly, so that access-control regressions are caught before deployment and vendor isolation is confirmed.

#### Acceptance Criteria

1. THE test suite SHALL include RLS behaviour tests located in `src/services/supabase/__tests__/rls.test.ts`.
2. WHEN a customer session queries the `orders` table, THE test SHALL assert that only orders belonging to that customer's `customer_id` are returned.
3. WHEN a vendor session queries the `orders` table, THE test SHALL assert that only orders belonging to that vendor's `vendor_id` are returned, and no other vendor's orders are visible.
4. WHEN an unauthenticated session queries the `rider_application_private` table, THE test SHALL assert that the result set is empty.
5. WHEN an authenticated customer session queries the `rider_application_private` table, THE test SHALL assert that the result set is empty.
6. WHEN an admin session queries the `rider_application_private` table, THE test SHALL assert that all rows are visible.
7. WHEN an unauthenticated session attempts to INSERT into `payments` with a `status` of `'successful'`, THE test SHALL assert that the operation is rejected.
8. WHEN a rider session queries `delivery_assignments`, THE test SHALL assert that only assignments where `rider_id` equals their own rider profile id are returned.
9. WHEN a vendor session queries `products`, THE test SHALL assert that only products belonging to their own vendor record are returned for write operations, and active products from all vendors are returned for read operations.
10. THE test suite SHALL run to completion with `npm run test` without requiring a live Supabase project, using either a local Supabase instance or mocked Supabase responses.
11. THE `npm run lint` command SHALL pass with zero errors on all files in `src/services/supabase/`.
12. THE `npm run build` command SHALL complete successfully after all Phase 2 files are added.

---

### Requirement 13: Database Documentation

**User Story:** As a developer or future contributor, I want schema documentation that describes tables, columns, relationships, and RLS policies in a single reference file, so that onboarding and schema navigation require no database GUI access.

#### Acceptance Criteria

1. THE project SHALL contain a file at `supabase/docs/schema.md` that documents every table defined in Requirement 4.
2. FOR EACH table, THE `schema.md` file SHALL list: table name and purpose, all column names with data types and constraints, foreign key relationships, indexes, and the RLS policies that apply.
3. THE `schema.md` SHALL include an entity-relationship summary section listing all inter-table relationships with cardinality (one-to-one, one-to-many).
4. THE `schema.md` SHALL include a security model section summarising the Default Deny posture and listing per-role access rights for every table.
5. THE `schema.md` SHALL be kept in sync with Migration files — any new Migration file SHALL be accompanied by a corresponding update to `schema.md`.

---

### Requirement 14: Phase 1 UI Integrity

**User Story:** As a product owner, I want assurance that Phase 2 backend work does not alter or break any Phase 1 frontend component, page, or route, so that the existing UI remains fully functional while the backend is established.

#### Acceptance Criteria

1. THE Phase 2 implementation SHALL NOT modify any existing file under `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, or `src/styles/` that was created in Phase 1.
2. THE existing `src/types/index.ts` SHALL remain backward compatible — any additions SHALL be additive only and SHALL NOT rename or remove existing exported types.
3. THE existing `src/utils/constants.ts` SHALL remain unchanged.
4. THE `npm run build` command SHALL produce a successful build with zero TypeScript errors both before and after Phase 2 files are added.
5. THE `npm run test` command SHALL pass all existing Phase 1 tests after Phase 2 files are added.
6. THE Phase 2 implementation SHALL NOT introduce new `npm` dependencies that conflict with or remove existing Phase 1 dependencies.
