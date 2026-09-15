# Implementation Plan: KingdomDash Phase 2 — Supabase Backend & Database Foundation

## Overview

This plan converts the Phase 2 design into discrete, dependency-ordered coding tasks. Each task builds on the previous one, culminating in a fully wired typed service layer, RLS-tested backend, and complete schema documentation. No Phase 1 files under `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, or `src/styles/` are touched.

Tasks are ordered so that every file a later task depends on is created by an earlier task. Migration files are numbered to match the task order so the final `supabase/migrations/` directory is consistent and sequential.

---

## Tasks

- [x] 1. Repository inspection & baseline verification
  - Read `package.json` to confirm `@supabase/supabase-js` presence and existing scripts
  - Read `src/types/index.ts` to record existing exported types (backward-compat baseline)
  - Read `src/utils/constants.ts` to verify enum values match design enums
  - Read `.env.example` and `.gitignore` to record current state before changes
  - Read all existing test files (`src/pages/__tests__/routes.test.tsx`, `src/utils/__tests__/whatsapp.test.ts`) to confirm they pass before Phase 2 work begins
  - Document any contradictions resolved in the design: two-table category design, financial authority in `create_order_secure`, RLS recursion prevention via `get_current_user_role()`, and the rider ID chain (`auth.uid → profiles.id → riders.profile_id → riders.id`)
  - **No files are modified in this task — read-only baseline**
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 2. Environment setup & Supabase client
  - [x] 2.1 Update `.env.example` with all four required variables
    - Add `VITE_SUPABASE_URL=https://your-project-id.supabase.co` with inline comment: `# Public — safe in browser, required by Vite`
    - Add `VITE_SUPABASE_ANON_KEY=your-anon-key` with inline comment: `# Public — safe in browser, required by Vite`
    - Add `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key` with inline comment: `# SERVER-SIDE ONLY. Never use VITE_ prefix. Never commit real value.`
    - Add `SUPABASE_DB_PASSWORD=your-db-password` with inline comment: `# SERVER-SIDE ONLY. Never use VITE_ prefix. Never commit real value.`
    - _Requirements: 1.3, 1.4_
  - [x] 2.2 Verify `.gitignore` covers secret env files
    - Confirm `.env`, `.env.local`, and `.env.*.local` are listed; add any missing entries
    - _Requirements: 1.5_
  - [x] 2.3 Install `@supabase/supabase-js` if not already in `package.json` dependencies
    - Check `package.json` first; only run `npm install @supabase/supabase-js` if the package is absent
    - Pin to the version resolved (exact version, no `^` range widening beyond what npm installs)
    - _Requirements: 1.1_
  - [x] 2.4 Create `src/services/supabase/client.ts`
    - Import `createClient` from `@supabase/supabase-js` and `Database` from `@/types/database.types` (will be generated in Task 16; use a type-only import — the bootstrap scaffold created in Task 16.2 allows this to compile before local Supabase is running)
    - Read `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`
    - Throw a descriptive `Error` if either variable is absent — this must throw at module evaluation time, before the React tree mounts
    - Export `supabase` as the typed `createClient<Database>(url, key)` singleton — never `createClient<unknown>()`
    - _Requirements: 1.1, 1.2, 1.6_

- [x] 3. Migration infrastructure setup
  - [x] 3.1 Create the `supabase/` directory structure
    - Create `supabase/migrations/` (directory for all SQL migration files)
    - Create `supabase/docs/` (directory for schema documentation)
    - Create `supabase/seed/` (directory placeholder; actual seed data goes into a migration file per design)
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Document Supabase CLI requirement
    - Create `supabase/README.md` with setup instructions: Supabase CLI installation, `supabase login`, `supabase link --project-ref <ref>`, `supabase start` (local), `supabase db push` (remote), and `npm run db:types` regeneration workflow
    - Include a note that `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_PASSWORD` must be set in a non-committed `.env` for CLI operations
    - _Requirements: 1.6, 2.1_

- [x] 4. Enums migration
  - [x] 4.1 Create `supabase/migrations/20260902000001_create_enums.sql`
    - Use `CREATE TYPE IF NOT EXISTS` for all 13 enums in the `public` schema
    - `user_role`: `customer`, `vendor`, `rider`, `admin`, `super_admin`
    - `business_type`: `restaurant`, `grocery_store`
    - `application_status`: `pending`, `approved`, `rejected`
    - `vehicle_type`: `petrol`, `electric`
    - `vehicle_status`: `active`, `maintenance`, `retired`
    - `service_type`: `food`, `grocery`, `courier`
    - `order_status`: `pending`, `payment_pending`, `payment_processing`, `payment_confirmed`, `preparing`, `ready_for_pickup`, `picked_up`, `in_transit`, `delivered`, `cancelled`
    - `payment_status`: `pending`, `processing`, `successful`, `failed`, `refunded`
    - `delivery_status`: `pending`, `assigned`, `picked_up`, `in_transit`, `delivered`, `cancelled`
    - `assignment_status`: `assigned`, `accepted`, `rejected`, `completed`
    - `notification_type`: `info`, `success`, `warning`, `error`
    - `contact_status`: `new`, `in_progress`, `resolved`
    - `earning_payment_status`: `pending`, `paid`
    - Verify each enum value matches the corresponding constant in `src/utils/constants.ts`
    - _Requirements: 3.1–3.13_

- [x] 5. Profiles & application tables migration
  - [x] 5.1 Create `supabase/migrations/20260902000002_create_profiles_applications.sql`
    - `profiles` table: `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `email text NOT NULL`, `full_name text NOT NULL`, `phone text`, `avatar_url text`, `role user_role NOT NULL DEFAULT 'customer'`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
    - `vendor_applications` table: all columns per design §7.2 including `reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL`
    - `rider_applications` table: all columns per design §7.2 including `reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL`
    - `rider_application_private` table: `application_id uuid PRIMARY KEY REFERENCES rider_applications(id) ON DELETE CASCADE` plus all sensitive columns
    - Enable RLS on all four tables: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY`
    - Add indexes: `profiles(role)`, `vendor_applications(profile_id)`, `vendor_applications(status)`, `rider_applications(profile_id)`, `rider_applications(status)`
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 6.1, 6.2, 6.3, 8.1_

- [x] 6. Vendor & catalog schema migration
  - [x] 6.1 Create `supabase/migrations/20260902000003_create_vendor_catalog.sql`
    - `reference_categories` table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `name text NOT NULL`, `service_type service_type NOT NULL`, `display_order integer NOT NULL DEFAULT 0`, `is_active boolean NOT NULL DEFAULT true` — **no `vendor_id` column** (global lookup, never vendor-owned)
    - `vendors` table: all columns per design §7.2 including `profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `rating numeric(3,2)`, `is_active boolean NOT NULL DEFAULT true`
    - `categories` table: `vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE`, `reference_category_id uuid REFERENCES reference_categories(id) ON DELETE SET NULL`, `service_type service_type`, plus all other columns per design §7.1
    - `products` table: all columns per design §7.2 including `price numeric(12,2) NOT NULL CHECK (price >= 0)`, `category_id uuid REFERENCES categories(id) ON DELETE SET NULL`
    - Enable RLS on all four tables
    - Add indexes: `vendors(profile_id)`, `vendors(business_type)`, `vendors(is_active)`, `categories(vendor_id)`, `categories(is_active)`, `products(vendor_id)`, `products(category_id)`, `products(is_available)`
    - _Requirements: 4.3, 4.8, 4.9, 5.5, 6.4, 6.5, 8.1_

- [x] 7. Customer, address & order schema migration
  - [x] 7.1 Create `supabase/migrations/20260902000004_create_orders.sql`
    - `riders` table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `profile_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE`, `is_available boolean NOT NULL DEFAULT false`, `total_deliveries integer NOT NULL DEFAULT 0`, `rating numeric(3,2)`, `created_at`, `updated_at`
    - `addresses` table: all columns per design §7.2 with `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
    - `orders` table: all columns per design §7.2 including CHECK constraints on `delivery_fee >= 0`, `subtotal >= 0`, `total >= 0`; `vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL` (nullable — business rule enforced by trigger, not NOT NULL)
    - `order_items` table: all columns per design §7.2 including CHECK constraints on `unit_price >= 0`, `quantity > 0`, `line_total >= 0`; `product_id uuid REFERENCES products(id) ON DELETE SET NULL`
    - Enable RLS on all four tables
    - Add indexes: `riders(profile_id)` (if not covered by UNIQUE), `orders(customer_id)`, `orders(vendor_id)`, `orders(status)`, `orders(service_type)`, `order_items(order_id)`
    - _Requirements: 4.6, 4.7, 4.10, 4.11, 5.6, 5.11, 5.12, 5.16, 6.6, 6.7, 8.1_

- [x] 8. Payments schema migration
  - [x] 8.1 Create `supabase/migrations/20260902000005_create_payments.sql`
    - `payments` table: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE`, `paystack_reference text UNIQUE`, `amount numeric(12,2) NOT NULL CHECK (amount >= 0)`, `currency text NOT NULL DEFAULT 'NGN'`, `status payment_status NOT NULL DEFAULT 'pending'`, `verified_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`
    - UNIQUE on `order_id` enforces one payment record per order
    - Enable RLS
    - Add indexes: `payments(order_id)`, `payments(status)`
    - _Requirements: 4.12, 5.7, 5.13, 6.8, 8.1_

- [x] 9. Service areas & delivery pricing migration
  - [x] 9.1 Create `supabase/migrations/20260902000006_create_service_areas_pricing.sql`
    - `service_areas` table: `id`, `name text NOT NULL UNIQUE`, `description text`, `coverage_polygon jsonb`, `is_active boolean NOT NULL DEFAULT true`, `created_at`, `updated_at`
    - `delivery_pricing_rules` table: all columns per design §7.2 including `base_fee numeric(12,2) NOT NULL CHECK (base_fee >= 0)`, `distance_rate numeric(10,4) NOT NULL CHECK (distance_rate >= 0)`, `min_fee` and `max_fee` nullable with `CHECK (>= 0)`, `service_area_id uuid REFERENCES service_areas(id) ON DELETE SET NULL`, `service_type service_type` (nullable — NULL means all service types)
    - Enable RLS on both tables
    - _Requirements: 4.13, 4.14, 5.8, 8.1_

- [x] 10. Rider, vehicle & delivery schema migration
  - [x] 10.1 Create `supabase/migrations/20260902000007_create_rider_delivery.sql`
    - `vehicles` table: `assigned_rider_id uuid UNIQUE REFERENCES riders(id) ON DELETE SET NULL`, `year integer NOT NULL CHECK (year >= 2000)`, `license_plate text NOT NULL UNIQUE`, all other columns per design §7.2
    - `deliveries` table: all columns per design §7.2; `vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL` (nullable — enforced by trigger); `created_by uuid NOT NULL REFERENCES profiles(id)`
    - `delivery_assignments` table: `delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`, `rider_id uuid NOT NULL REFERENCES riders(id)`, `assigned_by uuid NOT NULL REFERENCES profiles(id)`, all other columns per design §7.2
    - `delivery_status_updates` table: `delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE`, `updated_by uuid NOT NULL REFERENCES profiles(id)` — append-only, no `updated_at`
    - `rider_earnings` table: `rider_id uuid NOT NULL REFERENCES riders(id)`, `delivery_id uuid NOT NULL REFERENCES deliveries(id)`, `delivery_assignment_id uuid NOT NULL REFERENCES delivery_assignments(id)`, `amount numeric(12,2) NOT NULL CHECK (amount >= 0)` — append-only, no `updated_at`
    - Enable RLS on all five tables
    - Add indexes: `deliveries(status)`, `deliveries(service_type)`, `deliveries(vendor_id)`, `delivery_assignments(delivery_id)`, `delivery_assignments(rider_id)`, `delivery_assignments(status)`, `rider_earnings(rider_id)`, `rider_earnings(payment_status)`, `vehicles(assigned_rider_id)` if not covered by UNIQUE
    - _Requirements: 4.15, 4.16, 4.17, 4.18, 4.19, 5.9, 5.10, 5.14, 6.9, 6.10, 6.11, 8.1_

- [x] 11. Notifications, contact & audit schema migration
  - [x] 11.1 Create `supabase/migrations/20260902000008_create_notifications_audit.sql`
    - `contact_messages` table: `name text NOT NULL`, `email text NOT NULL`, `phone text`, `subject text NOT NULL`, `message text NOT NULL`, `status contact_status NOT NULL DEFAULT 'new'`, `created_at`, `updated_at`
    - `notifications` table: `profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`, `title text NOT NULL`, `message text NOT NULL`, `type notification_type NOT NULL DEFAULT 'info'`, `is_read boolean NOT NULL DEFAULT false`, `action_url text`, `created_at` — **no `updated_at`** (only `is_read` mutates)
    - `audit_logs` table: `profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL` (nullable), `action text NOT NULL`, `entity_type text NOT NULL`, `entity_id uuid`, `old_values jsonb`, `new_values jsonb`, `ip_address text`, `user_agent text`, `created_at` — append-only, no `updated_at`
    - Enable RLS on all three tables
    - Add indexes: `notifications(profile_id)`, `notifications(is_read)`, `audit_logs(profile_id)`, `audit_logs(entity_type)`, `audit_logs(created_at)`
    - _Requirements: 4.20, 4.21, 4.22, 6.12, 6.13, 8.1_

- [x] 12. Database functions & triggers migration
  - [x] 12.1 Create `supabase/migrations/20260902000009_create_functions_triggers.sql`
    - `set_updated_at()`: `SECURITY INVOKER`, `SET search_path = public`, `BEFORE UPDATE` trigger on all 16 tables that have `updated_at`: `profiles`, `vendor_applications`, `vendors`, `rider_applications`, `riders`, `addresses`, `categories`, `products`, `orders`, `payments`, `service_areas`, `delivery_pricing_rules`, `vehicles`, `deliveries`, `delivery_assignments`, `contact_messages`
    - `handle_new_user()`: `SECURITY DEFINER`, `SET search_path = public, auth`, `AFTER INSERT ON auth.users FOR EACH ROW` — inserts a `profiles` row with `id = NEW.id`, `email = NEW.email`, `full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', '')`, `role = 'customer'`; use `ON CONFLICT (id) DO NOTHING` for replay safety
    - `get_current_user_role()`: `SECURITY DEFINER STABLE`, `SET search_path = public` — reads `profiles.role WHERE id = auth.uid()` only; used by ALL role-checking RLS policies to prevent recursive RLS evaluation on `profiles`
    - `validate_order_vendor_constraint()`: `SECURITY INVOKER`, `BEFORE INSERT OR UPDATE ON orders FOR EACH ROW` — raise exception if `service_type IN ('food','grocery') AND vendor_id IS NULL` or `service_type = 'courier' AND vendor_id IS NOT NULL`
    - `validate_delivery_vendor_constraint()`: identical logic for `deliveries` table
    - `increment_rider_deliveries()`: `SECURITY INVOKER`, `AFTER INSERT OR UPDATE ON delivery_assignments FOR EACH ROW` — uses `TG_OP` to handle both cases: on INSERT, increments if `NEW.status = 'completed'`; on UPDATE, increments only if `NEW.status = 'completed'` AND `OLD.status IS DISTINCT FROM 'completed'`. `OLD` is only referenced inside the `ELSIF TG_OP = 'UPDATE'` branch to avoid null reference errors during INSERT.
    - **Security rule:** every `SECURITY DEFINER` function must include `SET search_path = public` (or `public, auth` for `handle_new_user`)
    - _Requirements: 5.1–5.4, 7.1–7.7_

- [x] 13. `create_order_secure` RPC migration
  - [x] 13.1 Create `supabase/migrations/20260902000010_create_order_secure_rpc.sql`
    - `create_order_secure()` function: `SECURITY DEFINER`, `SET search_path = public`, parameters: `p_vendor_id uuid`, `p_service_type service_type`, `p_pickup_address text`, `p_delivery_address text`, `p_items jsonb`, `p_special_instructions text DEFAULT NULL`; returns `uuid`
    - Guard: `IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'`
    - Reject `p_service_type = 'courier'` — raise exception at function entry before any other processing
    - Reject empty `p_items` — raise exception before any INSERT if `p_items IS NULL OR jsonb_array_length(p_items) = 0`
    - Validate vendor exists and is active (`is_active = true`) before inserting order row — raise exception if not found
    - Insert `orders` row with `customer_id = auth.uid()`, `delivery_fee = 0` (server-controlled; Phase 8 placeholder), `subtotal = 0`, `total = 0` initially (totals updated after items are inserted)
    - Loop over `jsonb_array_elements(p_items)`: validate each quantity (must be a positive integer — reject null, zero, negative, non-integer); for each item, SELECT `id, name, price` FROM `products` WHERE `id = (item->>'product_id')::uuid AND vendor_id = p_vendor_id AND is_available = true`; raise exception if `NOT FOUND` (cross-vendor mixing raises exception); insert `order_items` row using DB-read `price` (never client-supplied price)
    - After loop: UPDATE `orders SET subtotal = v_subtotal, total = v_subtotal WHERE id = v_order_id` (delivery_fee remains 0)
    - Return `v_order_id`
    - `REVOKE EXECUTE ON FUNCTION create_order_secure(...) FROM PUBLIC` — not callable by unauthenticated users
    - `GRANT EXECUTE ON FUNCTION create_order_secure(...) TO authenticated` — only authenticated users may call it
    - **Financial authority invariant:** The client never supplies subtotal, delivery_fee, total, unit_price, or line_total — all monetary values are computed server-side
    - _Requirements: 7.5 (via design §11.7), 8.22, 8.28_

- [x] 14. RLS policies migration
  - [x] 14.1 Create `supabase/migrations/20260902000011_create_rls_policies.sql`
    - **Critical rule:** ALL policies that check role must use `get_current_user_role()` — never `(SELECT role FROM profiles WHERE id = auth.uid())` which causes recursive RLS
    - `profiles`: own-row SELECT `USING (id = auth.uid())`; own-row UPDATE `USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND role = OLD.role AND is_active = OLD.is_active)` — users cannot change their own role or active status through self-service updates; admin/super_admin SELECT all `USING (get_current_user_role() IN ('admin','super_admin'))`; admin/super_admin UPDATE any
    - `vendor_applications`: authenticated INSERT `WITH CHECK (profile_id = auth.uid())`; own SELECT `USING (profile_id = auth.uid())`; admin/super_admin SELECT all; admin/super_admin UPDATE any
    - `vendors`: public SELECT active `USING (is_active = true)`; own vendor SELECT/UPDATE `USING (profile_id = auth.uid())`; admin/super_admin full access (SELECT, INSERT, UPDATE, DELETE)
    - `rider_applications`: own INSERT `WITH CHECK (profile_id = auth.uid())`; own SELECT; admin/super_admin SELECT all; admin/super_admin UPDATE any
    - `rider_application_private`: admin/super_admin ONLY — SELECT, INSERT, UPDATE, DELETE — **no policy for any other role including the applicant themselves**
    - `riders`: own SELECT/UPDATE `USING (profile_id = auth.uid())`; admin/super_admin full access
    - `categories`: public SELECT active `USING (is_active = true AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.is_active = true))`; own vendor INSERT/UPDATE/DELETE; admin/super_admin full access
    - `products`: public SELECT available `USING (is_available = true AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.is_active = true))`; own vendor INSERT/UPDATE/DELETE; admin/super_admin full access
    - `reference_categories`: public SELECT; admin/super_admin INSERT/UPDATE/DELETE
    - `addresses`: own SELECT/INSERT/UPDATE/DELETE `USING (profile_id = auth.uid())`
    - `orders`: own customer INSERT `WITH CHECK (customer_id = auth.uid())`; own customer SELECT `USING (customer_id = auth.uid())`; own vendor SELECT `USING (EXISTS (SELECT 1 FROM vendors v WHERE v.id = vendor_id AND v.profile_id = auth.uid()))`; own vendor UPDATE status; admin/super_admin full access
    - `order_items`: SELECT for customers who own the parent order; SELECT for vendors who own the parent order's vendor; INSERT by customer or admin; admin/super_admin full access
    - `payments`: customer SELECT own `USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid()))`; admin/super_admin SELECT all and UPDATE — **no INSERT or UPDATE to `status='successful'` by any frontend role**
    - `service_areas`: public SELECT active `USING (is_active = true)`; admin/super_admin INSERT/UPDATE/DELETE
    - `delivery_pricing_rules`: public SELECT active `USING (is_active = true)`; admin/super_admin INSERT/UPDATE/DELETE
    - `vehicles`: admin/super_admin full access; rider SELECT own `USING (assigned_rider_id = (SELECT r.id FROM riders r WHERE r.profile_id = auth.uid()))` — **never `assigned_rider_id = auth.uid()`**
    - `deliveries`: admin/super_admin full access; rider SELECT assigned `USING (EXISTS (SELECT 1 FROM delivery_assignments da WHERE da.delivery_id = id AND da.rider_id = (SELECT r.id FROM riders r WHERE r.profile_id = auth.uid())))` ; vendor SELECT own `USING (vendor_id = (SELECT v.id FROM vendors v WHERE v.profile_id = auth.uid()))`; customer SELECT own `USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid()))`
    - `delivery_assignments`: admin/super_admin full access; rider SELECT/UPDATE own `USING (rider_id = (SELECT r.id FROM riders r WHERE r.profile_id = auth.uid()))`
    - `delivery_status_updates`: admin/super_admin SELECT all and INSERT; rider INSERT for assigned deliveries; rider SELECT for assigned deliveries
    - `rider_earnings`: rider SELECT own `USING (rider_id = (SELECT r.id FROM riders r WHERE r.profile_id = auth.uid()))`; admin/super_admin full access
    - `contact_messages`: anonymous and authenticated INSERT `WITH CHECK (true)`; admin/super_admin SELECT all and UPDATE
    - `notifications`: own SELECT/UPDATE `USING (profile_id = auth.uid())`; admin/super_admin SELECT all and INSERT
    - `audit_logs`: super_admin SELECT only `USING (get_current_user_role() = 'super_admin')`; **no frontend INSERT policy**
    - _Requirements: 8.1–8.55_

- [x] 15. Seed & reference data migration
  - [x] 15.1 Create `supabase/migrations/20260902000012_seed_reference_data.sql`
    - Insert 10 food categories into `reference_categories` with `service_type = 'food'` and `display_order` 1–10: `Rice`, `Soups`, `Grills`, `Swallow`, `Pasta`, `Sides`, `Drinks`, `Snacks`, `Breakfast`, `Proteins`
    - Insert 10 grocery categories into `reference_categories` with `service_type = 'grocery'` and `display_order` 1–10: `Produce`, `Pantry`, `Beverages`, `Dairy`, `Household`, `Snacks`, `Frozen`, `Bakery`, `Condiments`, `Personal Care`
    - Insert 5 service areas into `service_areas`: `Lekki Phase 1`, `Yaba`, `Victoria Island`, `Ikeja`, `Surulere` — all with `is_active = true`
    - Insert 1 default pricing rule into `delivery_pricing_rules`: `service_type = NULL`, `base_fee = 500`, `distance_rate = 100`, `is_active = true`, `effective_date = CURRENT_DATE`
    - All inserts use `ON CONFLICT DO NOTHING` for idempotency. The migration is tracked by Supabase CLI history and will not be re-applied automatically. For a clean local re-seed during development, use `supabase db reset` which replays all migrations from scratch.
    - _Requirements: 9.1–9.5_

- [x] 16. TypeScript type generation & `src/types` wiring
  - [x] 16.1 Add `db:types` script to `package.json`
    - Add `"db:types": "supabase gen types typescript --local > src/types/database.types.ts"` to the `scripts` section
    - _Requirements: 10.2_
  - [x] 16.2 Create scaffold `src/types/database.types.ts`
    - Create a bootstrap scaffold file with a clear `// BOOTSTRAP SCAFFOLD — run npm run db:types after supabase start to regenerate` comment at the top, marked as a temporary placeholder that must never be manually edited beyond this scaffolding
    - Export: `export type Database = Record<string, never>` — minimal type that allows `createClient<Database>()` to compile before the real schema is available
    - The client.ts must always use `createClient<Database>()` — never `createClient<unknown>()`. Once local Supabase is running and migrations are applied, `npm run db:types` replaces this scaffold with the real generated types
    - _Requirements: 10.1, 10.6_
  - [x] 16.3 Update `src/types/index.ts` to re-export `Database` type
    - Add `export type { Database } from './database.types'` — additive only; no existing exports removed or renamed
    - _Requirements: 10.5, 14.2_
  - [x] 16.4 Update `src/services/supabase/client.ts` to use `createClient<Database>()`
    - Confirm the client uses `createClient<Database>()` with the real `Database` import from `@/types/database.types` — never `createClient<unknown>()`
    - _Requirements: 10.3_

- [x] 17. Supabase service layer
  - [x] 17.1 Create `src/services/supabase/profiles.ts`
    - `getCurrentProfile()`: calls `supabase.from('profiles').select('*').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').single()` — returns `{ data, error }`
    - `updateProfile(id: string, data: Partial<...>)`: calls `supabase.from('profiles').update(data).eq('id', id).select().single()` — returns `{ data, error }`
    - All types annotated with `Database['public']['Tables']['profiles']['Row']` and `Update` variants
    - _Requirements: 11.1, 11.2, 11.3, 11.8_
  - [x] 17.2 Create `src/services/supabase/vendors.ts`
    - `getActiveVendors()`: `supabase.from('vendors').select('*').eq('is_active', true)`
    - `getVendorById(id: string)`: `.select('*').eq('id', id).single()`
    - `getVendorsByType(type: Database['public']['Enums']['business_type'])`: `.select('*').eq('business_type', type).eq('is_active', true)`
    - Returns `{ data, error }` pattern; no thrown exceptions
    - _Requirements: 11.1, 11.2, 11.4, 11.8_
  - [x] 17.3 Create `src/services/supabase/products.ts`
    - `getProductsByVendor(vendorId: string)`: `.select('*').eq('vendor_id', vendorId)`
    - `getAvailableProducts(vendorId: string)`: `.select('*').eq('vendor_id', vendorId).eq('is_available', true)`
    - _Requirements: 11.1, 11.2, 11.5, 11.8_
  - [x] 17.4 Create `src/services/supabase/orders.ts`
    - `createOrderSecure(params)`: calls `supabase.rpc('create_order_secure', { p_vendor_id, p_service_type, p_pickup_address, p_delivery_address, p_items, p_special_instructions })` — this RPC is the only path for order creation; never insert into `orders` directly from the frontend; does NOT accept or pass any price, fee, or total
    - `getOrderById(id: string)`: `.from('orders').select('*, order_items(*)').eq('id', id).single()`
    - `getOrdersByCustomer(customerId: string)`: `.from('orders').select('*, order_items(*)').eq('customer_id', customerId).order('created_at', { ascending: false })`
    - _Requirements: 11.1, 11.2, 11.6, 11.7, 11.8_
  - [x] 17.5 Create `src/services/supabase/deliveries.ts`
    - `getDeliveriesByStatus(status: Database['public']['Enums']['delivery_status'])`: `.from('deliveries').select('*').eq('status', status)`
    - `getDeliveryById(id: string)`: `.from('deliveries').select('*, delivery_assignments(*), delivery_status_updates(*)').eq('id', id).single()`
    - _Requirements: 11.1, 11.2, 11.8_
  - [x] 17.6 Create `src/services/supabase/riders.ts`
    - `getRiderProfile()`: gets current user's rider row via `supabase.from('riders').select('*').eq('profile_id', uid).single()`
    - `updateRiderAvailability(id: string, available: boolean)`: `.from('riders').update({ is_available: available }).eq('id', id).select().single()`
    - _Requirements: 11.1, 11.2, 11.8_
  - [x] 17.7 Create `src/services/supabase/admin.ts`
    - `getAllVendors()`: `.from('vendors').select('*').order('created_at', { ascending: false })`
    - `getAllRiders()`: `.from('riders').select('*, profiles(full_name, email, phone)').order('created_at', { ascending: false })`
    - `getPendingApplications()`: returns both vendor and rider pending applications — `supabase.from('vendor_applications').select('*').eq('status', 'pending')` and `supabase.from('rider_applications').select('*').eq('status', 'pending')`
    - _Requirements: 11.1, 11.2, 11.8_

- [x] 18. RLS / security tests
  - [x] 18.1 Create `src/services/supabase/__tests__/rls.test.ts` using vitest

    **Two-layer testing required:**

    Layer 1 — Service-layer unit tests (mocked Supabase): Test function signatures, error handling, return shape. These run without a database.

    Layer 2 — PostgreSQL RLS integration tests (requires local Supabase via `supabase start`): These connect to the real database and test actual RLS behaviour. If local Supabase is unavailable, tests are skipped with a documented reason — they must NOT pass with mock assertions.

    RLS integration tests must cover all 18 scenarios from the design:
    1. Customer A cannot read Customer B's orders
    2. Customer A cannot modify Customer B's address
    3. Customer A cannot modify Customer B's order
    4. Customer cannot change own profiles.role to admin (WITH CHECK rejected)
    5. Customer cannot change own profiles.is_active (WITH CHECK rejected)
    6. Vendor A cannot modify Vendor B's products
    7. Rider A cannot read Rider B's delivery assignments
    8. Rider ownership chain verified (auth.uid → profiles.id → riders.profile_id → riders.id)
    9. Anonymous gets empty set from profiles
    10. Unauthorized SELECT returns empty set (no error)
    11. Unauthorized INSERT is rejected with error
    12. Frontend cannot set payments.status = 'successful'
    13. Frontend cannot INSERT into audit_logs
    14. create_order_secure rejects product from different vendor
    15. create_order_secure rejects courier service type
    16. create_order_secure rejects empty items array
    17. create_order_secure rejects quantity = 0
    18. updateRiderAvailability — rider cannot update another rider's record
    - _Requirements: 12.1–12.11_

- [x] 19. Schema documentation
  - [x] 19.1 Create `supabase/docs/schema.md`
    - For each of the 23 tables (22 application + `reference_categories`): table name, purpose sentence, all columns with type/constraints/defaults, FK relationships, indexes, applicable RLS policies
    - ER relationship summary section: all inter-table relationships with cardinality labels (1:1, 1:N)
    - Security model section: Default Deny posture explanation; per-role access matrix (rows = roles, columns = tables, cells = SELECT/INSERT/UPDATE/DELETE/— )
    - Rider ID chain section with the exact traversal: `auth.uid() → profiles.id → riders.profile_id → riders.id → vehicles.assigned_rider_id` and `riders.id → delivery_assignments.rider_id → deliveries.id`
    - Database functions & triggers summary: function name, security model (INVOKER/DEFINER), trigger event, tables affected
    - Financial authority rules summary: which amounts are browser-supplied vs. server-computed; `create_order_secure` as the single order creation path
    - RLS unauthorised operation behaviour table: SELECT → empty set; INSERT WITH CHECK fail → error; UPDATE USING no match → silent; UPDATE WITH CHECK fail → error; DELETE USING no match → silent
    - _Requirements: 13.1–13.5_

- [x] 20. Integration validation checkpoint
  - [x] 20.1 Run `npm run lint` — must pass with zero errors on all files in `src/services/supabase/` and `src/types/`
    - Fix any oxlint errors in the new service files before proceeding
    - _Requirements: 12.11_
  - [x] 20.2 Run `npm run build` — must complete with zero TypeScript errors
    - Fix any TypeScript errors surfaced by the build
    - Confirm no compile errors in `src/services/supabase/client.ts`, all service modules, and `src/types/database.types.ts`
    - _Requirements: 12.12, 14.4_
  - [x] 20.3 Run `npm run test` — all Phase 1 tests and new RLS tests must pass
    - Confirm `src/pages/__tests__/routes.test.tsx` still passes (Phase 1 routes unmodified)
    - Confirm `src/utils/__tests__/whatsapp.test.ts` still passes
    - Confirm `src/services/supabase/__tests__/rls.test.ts` passes (service-layer unit tests; RLS integration tests require local Supabase)
    - _Requirements: 12.10, 14.5_
  - [x] 20.4 Security checklist — verify all of the following:
    - `.env.example` contains no real credentials (only placeholder strings)
    - `SUPABASE_SERVICE_ROLE_KEY` does not appear with a `VITE_` prefix anywhere in the codebase
    - `SUPABASE_DB_PASSWORD` does not appear with a `VITE_` prefix anywhere in the codebase
    - No files under `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, or `src/styles/` were modified
    - `src/utils/constants.ts` is unchanged
    - `src/types/index.ts` changes are additive only (no renames or removals of Phase 1 exports)
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 14.1, 14.2, 14.3_

- [x] 21. Final documentation checkpoint
  - [x] 21.1 Verify consistency between design.md and tasks.md
    - Confirm all 13 enums in the design are present in Task 4's migration (not 14 — the validation criterion is not itself an enum)
    - Confirm all 23 public tables (22 application + 1 reference table = 23 total) in the design are present across Tasks 5–11
    - Confirm all 7 functions/triggers in the design are present in Task 12's migration
    - Confirm `create_order_secure` in the design matches Task 13's implementation notes — no `p_delivery_fee` parameter, delivery_fee set to 0 server-side
    - Confirm `increment_rider_deliveries` uses `TG_OP` to handle INSERT vs UPDATE (not just OLD.status check)
    - Confirm all RLS policies in the design §8 are addressed in Task 14
  - [x] 21.2 Confirm zero Phase 1 file modifications
    - List all files created by Phase 2 (should be entirely new files under `supabase/`, `src/services/supabase/`, additions to `src/types/`, `.env.example`, `package.json` scripts only)
    - Confirm the list contains no paths under `src/components/`, `src/pages/`, `src/stores/`, `src/hooks/`, `src/styles/`
    - _Requirements: 14.1_
  - [x] 21.3 Update `KINGDOMDASH_DEVELOPMENT_PLAN.md` if needed
    - If the plan still describes WhatsApp-only ordering as the V1 order path, update it to note that `create_order_secure` RPC is the V1 order creation mechanism (WhatsApp ordering is a transitional fallback, not the primary path)
    - If the plan still lists Paystack or Maps as excluded from V1, clarify these are in later phases (Phases 9 and 7–8 respectively), not excluded from V1 entirely
    - _Requirements: (cross-phase consistency)_

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all other tasks are required
- Property-based testing does not apply to this feature (IaC-adjacent migration work, no pure functions with varied input/output to test universally); the design document has no Correctness Properties section
- Each task references specific requirements clauses for traceability
- Migration files are numbered `20260902000001` through `20260902000012` — apply in ascending order
- The Supabase CLI must be available for `supabase db push` and `npm run db:types`; if not installed, see `supabase/README.md`
- `src/types/database.types.ts` is a generated file — run `npm run db:types` after `supabase start` to get real types; the scaffold placeholder keeps the build green until then
- All service functions return `{ data, error }` — never throw; callers check `error` before using `data`
- The rider ID chain (`auth.uid() ≠ riders.id`) is the single most common RLS mistake — every rider-scoped policy must traverse `profiles.id → riders.profile_id → riders.id`
