-- =============================================================================
-- Migration: 20260902000027_rls_recursion_hardening.sql
-- Purpose  : Eliminate PostgreSQL 42P17 Infinite RLS Recursion Across Operational Tables
--            (orders, deliveries, delivery_assignments, order_items, payments, delivery_status_updates)
-- =============================================================================
--
-- FORENSIC ROOT CAUSE ANALYSIS:
-- -----------------------------
-- PostgreSQL query planner enforces Row Level Security (RLS) on all subqueries 
-- within policy expressions unless executed within a SECURITY DEFINER context.
--
-- In Migrations 0020 and 0021, the following mutual dependency chain was formed:
--   1. public.orders policy "orders_select_rider" queried public.deliveries and 
--      public.delivery_assignments.
--   2. public.deliveries policy "deliveries_select_customer" queried public.orders.
--   3. public.delivery_assignments policy "assignments_select_customer" queried 
--      both public.deliveries and public.orders.
--   4. public.payments policy "payments_select_own_customer" queried public.orders.
--   5. public.order_items policy "order_items_select_rider" queried public.deliveries.
--   6. public.delivery_status_updates policy "updates_select_operational" queried 
--      public.deliveries and public.orders.
--
-- When any user (or anonymous visitor) performed a SELECT on orders, deliveries,
-- payments, order_items, or assignments, PostgreSQL expanded these policies 
-- mutually in an infinite cycle:
--   orders -> deliveries -> orders -> deliveries -> ...
-- and aborted with:
--   ERROR: 42P17: infinite recursion detected in policy for relation "deliveries"
--   ERROR: 42P17: infinite recursion detected in policy for relation "delivery_assignments"
--
-- EXECUTION ORDER GUARANTEE:
-- --------------------------
-- 1. All existing/stale operational policies are dropped first to dissolve dependencies.
-- 2. Stale function overloads are dropped cleanly with CASCADE.
-- 3. Hardened, single-parameter (entity ID only, binding to auth.uid()) helper functions
--    are installed with explicit parameter comments.
-- 4. Re-engineered recursion-free RLS policies are installed.
-- =============================================================================

-- =============================================================================
-- §1  DROP EXISTING OPERATIONAL POLICIES FIRST (DISSOLVE FUNCTION DEPENDENCIES)
-- =============================================================================

-- 1.1 Orders policies
DROP POLICY IF EXISTS "orders_select_own_customer" ON public.orders;
DROP POLICY IF EXISTS "orders_select_own_vendor" ON public.orders;
DROP POLICY IF EXISTS "orders_select_rider" ON public.orders;
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;

-- 1.2 Deliveries policies
DROP POLICY IF EXISTS "deliveries_select_customer" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_vendor" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_rider" ON public.deliveries;
DROP POLICY IF EXISTS "deliveries_select_admin" ON public.deliveries;

-- 1.3 Delivery Assignments policies
DROP POLICY IF EXISTS "assignments_select_customer" ON public.delivery_assignments;
DROP POLICY IF EXISTS "assignments_select_rider" ON public.delivery_assignments;
DROP POLICY IF EXISTS "assignments_select_admin" ON public.delivery_assignments;

-- 1.4 Order Items policies
DROP POLICY IF EXISTS "order_items_select_customer" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_vendor" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_rider" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;
DROP POLICY IF EXISTS "order_items_all_admin" ON public.order_items;

-- 1.5 Payments policies
DROP POLICY IF EXISTS "payments_select_own_customer" ON public.payments;
DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;

-- 1.6 Delivery Status Updates policies
DROP POLICY IF EXISTS "updates_select_operational" ON public.delivery_status_updates;


-- =============================================================================
-- §2  DROP STALE OR OVERLOADED HELPER FUNCTION SIGNATURES
-- =============================================================================

DROP FUNCTION IF EXISTS public.can_customer_access_order(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_customer_access_order(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_vendor_access_order(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_vendor_access_order(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_current_vendor_owner(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_current_vendor_owner(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_vendor_access_order_items(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_vendor_access_order_items(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_order(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_order(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_delivery(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_delivery(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_assignment(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_rider_access_assignment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_customer_access_delivery_assignment(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_customer_access_delivery_assignment(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_user_access_delivery_updates(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.can_user_access_delivery_updates(uuid) CASCADE;


-- =============================================================================
-- §3  INSTALL SECURITY DEFINER AUTHORIZATION HELPER FUNCTIONS
-- =============================================================================

-- 3.1 Helper: Customer owns order
CREATE OR REPLACE FUNCTION public.can_customer_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.customer_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.can_customer_access_order(uuid) IS
  'Recursion-free authorization check verifying customer ownership of an order using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_customer_access_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_customer_access_order(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_customer_access_order(uuid) TO authenticated;


-- 3.2 Helper: Current user owns vendor record (named accurately)
CREATE OR REPLACE FUNCTION public.is_current_vendor_owner(p_vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = p_vendor_id
      AND v.profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_current_vendor_owner(uuid) IS
  'Recursion-free authorization check verifying vendor profile ownership using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.is_current_vendor_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_current_vendor_owner(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_current_vendor_owner(uuid) TO authenticated;


-- 3.3 Helper: Vendor owns order items for their store
CREATE OR REPLACE FUNCTION public.can_vendor_access_order_items(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.vendors v ON v.id = o.vendor_id
    WHERE o.id = p_order_id
      AND v.profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.can_vendor_access_order_items(uuid) IS
  'Recursion-free authorization check verifying vendor ownership of an order item catalog line using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_vendor_access_order_items(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_vendor_access_order_items(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_vendor_access_order_items(uuid) TO authenticated;


-- 3.4 Helper: Rider has accepted or completed assignment linked to order
CREATE OR REPLACE FUNCTION public.can_rider_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deliveries d
    JOIN public.delivery_assignments da ON da.delivery_id = d.id
    JOIN public.riders r ON r.id = da.rider_id
    WHERE d.order_id = p_order_id
      AND r.profile_id = auth.uid()
      AND da.status IN ('accepted', 'completed')
  );
$$;

COMMENT ON FUNCTION public.can_rider_access_order(uuid) IS
  'Recursion-free authorization check verifying rider assignment link to an order using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_rider_access_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_rider_access_order(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_rider_access_order(uuid) TO authenticated;


-- 3.5 Helper: Rider has accepted or completed assignment linked to delivery
CREATE OR REPLACE FUNCTION public.can_rider_access_delivery(p_delivery_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_assignments da
    JOIN public.riders r ON r.id = da.rider_id
    WHERE da.delivery_id = p_delivery_id
      AND r.profile_id = auth.uid()
      AND da.status IN ('accepted', 'completed')
  );
$$;

COMMENT ON FUNCTION public.can_rider_access_delivery(uuid) IS
  'Recursion-free authorization check verifying rider assignment link to a delivery record using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_rider_access_delivery(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_rider_access_delivery(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_rider_access_delivery(uuid) TO authenticated;


-- 3.6 Helper: Rider owns delivery assignment
CREATE OR REPLACE FUNCTION public.can_rider_access_assignment(p_rider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.riders r
    WHERE r.id = p_rider_id
      AND r.profile_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.can_rider_access_assignment(uuid) IS
  'Recursion-free authorization check verifying rider ownership of an assignment using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_rider_access_assignment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_rider_access_assignment(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_rider_access_assignment(uuid) TO authenticated;


-- 3.7 Helper: Customer owns delivery linked to assignment
CREATE OR REPLACE FUNCTION public.can_customer_access_delivery_assignment(p_delivery_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.deliveries d
    JOIN public.orders o ON o.id = d.order_id
    WHERE d.id = p_delivery_id
      AND o.customer_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.can_customer_access_delivery_assignment(uuid) IS
  'Recursion-free authorization check verifying customer link to a delivery assignment using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_customer_access_delivery_assignment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_customer_access_delivery_assignment(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_customer_access_delivery_assignment(uuid) TO authenticated;


-- 3.8 Helper: Operational access to delivery status updates
CREATE OR REPLACE FUNCTION public.can_user_access_delivery_updates(p_delivery_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT (
    -- Customer of the delivery order
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.orders o ON o.id = d.order_id
      WHERE d.id = p_delivery_id
        AND o.customer_id = auth.uid()
    )
    OR
    -- Assigned rider with accepted or completed assignment
    EXISTS (
      SELECT 1
      FROM public.delivery_assignments da
      JOIN public.riders r ON r.id = da.rider_id
      WHERE da.delivery_id = p_delivery_id
        AND r.profile_id = auth.uid()
        AND da.status IN ('accepted', 'completed')
    )
    OR
    -- Vendor of the delivery order
    EXISTS (
      SELECT 1
      FROM public.deliveries d
      JOIN public.vendors v ON v.id = d.vendor_id
      WHERE d.id = p_delivery_id
        AND v.profile_id = auth.uid()
    )
    OR
    -- Admin / super_admin
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'super_admin')
    )
  );
$$;

COMMENT ON FUNCTION public.can_user_access_delivery_updates(uuid) IS
  'Recursion-free authorization check for operational audit updates on deliveries using auth.uid().';

REVOKE EXECUTE ON FUNCTION public.can_user_access_delivery_updates(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_user_access_delivery_updates(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_user_access_delivery_updates(uuid) TO authenticated;


-- =============================================================================
-- §4  INSTALL RE-ENGINEERED NON-RECURSIVE RLS POLICIES
-- =============================================================================

-- ── 4.1 public.orders ────────────────────────────────────────────────────────
CREATE POLICY "orders_select_own_customer" ON public.orders
  FOR SELECT USING (
    customer_id = auth.uid()
  );

CREATE POLICY "orders_select_own_vendor" ON public.orders
  FOR SELECT USING (
    vendor_id IS NOT NULL AND public.is_current_vendor_owner(vendor_id)
  );

CREATE POLICY "orders_select_rider" ON public.orders
  FOR SELECT USING (
    public.can_rider_access_order(id)
  );

CREATE POLICY "orders_select_admin" ON public.orders
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );


-- ── 4.2 public.deliveries ────────────────────────────────────────────────────
CREATE POLICY "deliveries_select_customer" ON public.deliveries
  FOR SELECT USING (
    public.can_customer_access_order(order_id)
  );

CREATE POLICY "deliveries_select_vendor" ON public.deliveries
  FOR SELECT USING (
    vendor_id IS NOT NULL AND public.is_current_vendor_owner(vendor_id)
  );

CREATE POLICY "deliveries_select_rider" ON public.deliveries
  FOR SELECT USING (
    public.can_rider_access_delivery(id)
  );

CREATE POLICY "deliveries_select_admin" ON public.deliveries
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );


-- ── 4.3 public.delivery_assignments ──────────────────────────────────────────
CREATE POLICY "assignments_select_customer" ON public.delivery_assignments
  FOR SELECT USING (
    public.can_customer_access_delivery_assignment(delivery_id)
  );

CREATE POLICY "assignments_select_rider" ON public.delivery_assignments
  FOR SELECT USING (
    public.can_rider_access_assignment(rider_id)
  );

CREATE POLICY "assignments_select_admin" ON public.delivery_assignments
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );


-- ── 4.4 public.order_items ───────────────────────────────────────────────────
CREATE POLICY "order_items_select_customer" ON public.order_items
  FOR SELECT USING (
    public.can_customer_access_order(order_id)
  );

CREATE POLICY "order_items_select_vendor" ON public.order_items
  FOR SELECT USING (
    public.can_vendor_access_order_items(order_id)
  );

CREATE POLICY "order_items_select_rider" ON public.order_items
  FOR SELECT USING (
    public.can_rider_access_order(order_id)
  );

CREATE POLICY "order_items_insert_customer" ON public.order_items
  FOR INSERT WITH CHECK (
    public.can_customer_access_order(order_id)
  );

CREATE POLICY "order_items_all_admin" ON public.order_items
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );


-- ── 4.5 public.payments ──────────────────────────────────────────────────────
CREATE POLICY "payments_select_own_customer" ON public.payments
  FOR SELECT USING (
    customer_id = auth.uid()
    OR (order_id IS NOT NULL AND public.can_customer_access_order(order_id))
  );

CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );

CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE USING (
    public.get_current_user_role() IN ('admin', 'super_admin')
  );


-- ── 4.6 public.delivery_status_updates ────────────────────────────────────────
CREATE POLICY "updates_select_operational" ON public.delivery_status_updates
  FOR SELECT USING (
    public.can_user_access_delivery_updates(delivery_id)
  );

-- =============================================================================
-- END OF MIGRATION 027
-- =============================================================================
