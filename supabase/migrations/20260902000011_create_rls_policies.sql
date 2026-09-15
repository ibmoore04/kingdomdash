-- Migration: 20260902000011_create_rls_policies.sql
-- Creates all Row Level Security policies for all 23 public tables
-- CRITICAL: All role-checking policies use get_current_user_role() to prevent recursive RLS on profiles
-- CRITICAL: Rider policies use the full ID chain: auth.uid() → profiles.id → riders.profile_id → riders.id
-- Default Deny: RLS is already enabled on all tables; policies here grant specific access only

-- =============================================================================
-- profiles
-- =============================================================================
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- vendor_applications
-- =============================================================================
DROP POLICY IF EXISTS "vendor_applications_insert_own" ON public.vendor_applications;
CREATE POLICY "vendor_applications_insert_own" ON public.vendor_applications
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "vendor_applications_select_own" ON public.vendor_applications;
CREATE POLICY "vendor_applications_select_own" ON public.vendor_applications
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "vendor_applications_select_admin" ON public.vendor_applications;
CREATE POLICY "vendor_applications_select_admin" ON public.vendor_applications
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "vendor_applications_update_admin" ON public.vendor_applications;
CREATE POLICY "vendor_applications_update_admin" ON public.vendor_applications
  FOR UPDATE USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- vendors
-- =============================================================================
DROP POLICY IF EXISTS "vendors_select_active_public" ON public.vendors;
CREATE POLICY "vendors_select_active_public" ON public.vendors
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "vendors_select_own" ON public.vendors;
CREATE POLICY "vendors_select_own" ON public.vendors
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "vendors_update_own" ON public.vendors;
CREATE POLICY "vendors_update_own" ON public.vendors
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "vendors_all_admin" ON public.vendors;
CREATE POLICY "vendors_all_admin" ON public.vendors
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- rider_applications
-- =============================================================================
DROP POLICY IF EXISTS "rider_applications_insert_own" ON public.rider_applications;
CREATE POLICY "rider_applications_insert_own" ON public.rider_applications
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "rider_applications_select_own" ON public.rider_applications;
CREATE POLICY "rider_applications_select_own" ON public.rider_applications
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "rider_applications_select_admin" ON public.rider_applications;
CREATE POLICY "rider_applications_select_admin" ON public.rider_applications
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "rider_applications_update_admin" ON public.rider_applications;
CREATE POLICY "rider_applications_update_admin" ON public.rider_applications
  FOR UPDATE USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- rider_application_private — admin/super_admin ONLY (no policy for applicants)
-- =============================================================================
DROP POLICY IF EXISTS "rider_application_private_all_admin" ON public.rider_application_private;
CREATE POLICY "rider_application_private_all_admin" ON public.rider_application_private
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- riders
-- =============================================================================
DROP POLICY IF EXISTS "riders_select_own" ON public.riders;
CREATE POLICY "riders_select_own" ON public.riders
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "riders_update_own" ON public.riders;
CREATE POLICY "riders_update_own" ON public.riders
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "riders_all_admin" ON public.riders;
CREATE POLICY "riders_all_admin" ON public.riders
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- reference_categories
-- =============================================================================
DROP POLICY IF EXISTS "reference_categories_select_public" ON public.reference_categories;
CREATE POLICY "reference_categories_select_public" ON public.reference_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reference_categories_all_admin" ON public.reference_categories;
CREATE POLICY "reference_categories_all_admin" ON public.reference_categories
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- categories
-- =============================================================================
DROP POLICY IF EXISTS "categories_select_public" ON public.categories;
CREATE POLICY "categories_select_public" ON public.categories
  FOR SELECT USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.is_active = true
    )
  );

DROP POLICY IF EXISTS "categories_insert_own_vendor" ON public.categories;
CREATE POLICY "categories_insert_own_vendor" ON public.categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categories_update_own_vendor" ON public.categories;
CREATE POLICY "categories_update_own_vendor" ON public.categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categories_delete_own_vendor" ON public.categories;
CREATE POLICY "categories_delete_own_vendor" ON public.categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categories_all_admin" ON public.categories;
CREATE POLICY "categories_all_admin" ON public.categories
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- products
-- =============================================================================
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT USING (
    is_available = true
    AND EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.is_active = true
    )
  );

DROP POLICY IF EXISTS "products_insert_own_vendor" ON public.products;
CREATE POLICY "products_insert_own_vendor" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_update_own_vendor" ON public.products;
CREATE POLICY "products_update_own_vendor" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_delete_own_vendor" ON public.products;
CREATE POLICY "products_delete_own_vendor" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_all_admin" ON public.products;
CREATE POLICY "products_all_admin" ON public.products
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- addresses
-- =============================================================================
DROP POLICY IF EXISTS "addresses_all_own" ON public.addresses;
CREATE POLICY "addresses_all_own" ON public.addresses
  FOR ALL USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- =============================================================================
-- orders
-- =============================================================================
DROP POLICY IF EXISTS "orders_insert_own_customer" ON public.orders;
CREATE POLICY "orders_insert_own_customer" ON public.orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_select_own_customer" ON public.orders;
CREATE POLICY "orders_select_own_customer" ON public.orders
  FOR SELECT USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_select_own_vendor" ON public.orders;
CREATE POLICY "orders_select_own_vendor" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orders_update_own_vendor" ON public.orders;
CREATE POLICY "orders_update_own_vendor" ON public.orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = vendor_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "orders_all_admin" ON public.orders;
CREATE POLICY "orders_all_admin" ON public.orders
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- order_items
-- =============================================================================
DROP POLICY IF EXISTS "order_items_select_customer" ON public.order_items;
CREATE POLICY "order_items_select_customer" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_select_vendor" ON public.order_items;
CREATE POLICY "order_items_select_vendor" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.vendors v ON v.id = o.vendor_id
      WHERE o.id = order_id AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;
CREATE POLICY "order_items_insert_customer" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_items_all_admin" ON public.order_items;
CREATE POLICY "order_items_all_admin" ON public.order_items
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- payments
-- No INSERT policy for any frontend role — payment rows are created server-side only
-- =============================================================================
DROP POLICY IF EXISTS "payments_select_own_customer" ON public.payments;
CREATE POLICY "payments_select_own_customer" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "payments_select_admin" ON public.payments;
CREATE POLICY "payments_select_admin" ON public.payments
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "payments_update_admin" ON public.payments;
CREATE POLICY "payments_update_admin" ON public.payments
  FOR UPDATE USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- service_areas
-- =============================================================================
DROP POLICY IF EXISTS "service_areas_select_active_public" ON public.service_areas;
CREATE POLICY "service_areas_select_active_public" ON public.service_areas
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "service_areas_all_admin" ON public.service_areas;
CREATE POLICY "service_areas_all_admin" ON public.service_areas
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- delivery_pricing_rules
-- =============================================================================
DROP POLICY IF EXISTS "delivery_pricing_rules_select_active_public" ON public.delivery_pricing_rules;
CREATE POLICY "delivery_pricing_rules_select_active_public" ON public.delivery_pricing_rules
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "delivery_pricing_rules_all_admin" ON public.delivery_pricing_rules;
CREATE POLICY "delivery_pricing_rules_all_admin" ON public.delivery_pricing_rules
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- vehicles
-- Rider policies traverse the ID chain: auth.uid() → riders.profile_id → riders.id
-- NEVER use: assigned_rider_id = auth.uid() (they are different UUIDs)
-- =============================================================================
DROP POLICY IF EXISTS "vehicles_select_own_rider" ON public.vehicles;
CREATE POLICY "vehicles_select_own_rider" ON public.vehicles
  FOR SELECT USING (
    assigned_rider_id = (
      SELECT r.id FROM public.riders r WHERE r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vehicles_all_admin" ON public.vehicles;
CREATE POLICY "vehicles_all_admin" ON public.vehicles
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- deliveries
-- =============================================================================
DROP POLICY IF EXISTS "deliveries_all_admin" ON public.deliveries;
CREATE POLICY "deliveries_all_admin" ON public.deliveries
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "deliveries_select_assigned_rider" ON public.deliveries;
CREATE POLICY "deliveries_select_assigned_rider" ON public.deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.riders r ON r.id = da.rider_id
      WHERE da.delivery_id = deliveries.id AND r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deliveries_select_own_vendor" ON public.deliveries;
CREATE POLICY "deliveries_select_own_vendor" ON public.deliveries
  FOR SELECT USING (
    vendor_id = (
      SELECT v.id FROM public.vendors v WHERE v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "deliveries_select_own_customer" ON public.deliveries;
CREATE POLICY "deliveries_select_own_customer" ON public.deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.customer_id = auth.uid()
    )
  );

-- =============================================================================
-- delivery_assignments
-- =============================================================================
DROP POLICY IF EXISTS "delivery_assignments_all_admin" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_all_admin" ON public.delivery_assignments
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "delivery_assignments_select_own_rider" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_select_own_rider" ON public.delivery_assignments
  FOR SELECT USING (
    rider_id = (
      SELECT r.id FROM public.riders r WHERE r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_assignments_update_own_rider" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_update_own_rider" ON public.delivery_assignments
  FOR UPDATE USING (
    rider_id = (
      SELECT r.id FROM public.riders r WHERE r.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- delivery_status_updates
-- =============================================================================
DROP POLICY IF EXISTS "delivery_status_updates_all_admin" ON public.delivery_status_updates;
CREATE POLICY "delivery_status_updates_all_admin" ON public.delivery_status_updates
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "delivery_status_updates_select_rider" ON public.delivery_status_updates;
CREATE POLICY "delivery_status_updates_select_rider" ON public.delivery_status_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.riders r ON r.id = da.rider_id
      WHERE da.delivery_id = delivery_status_updates.delivery_id AND r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_status_updates_insert_rider" ON public.delivery_status_updates;
CREATE POLICY "delivery_status_updates_insert_rider" ON public.delivery_status_updates
  FOR INSERT WITH CHECK (
    updated_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.riders r ON r.id = da.rider_id
      WHERE da.delivery_id = delivery_status_updates.delivery_id AND r.profile_id = auth.uid()
    )
  );

-- =============================================================================
-- rider_earnings
-- =============================================================================
DROP POLICY IF EXISTS "rider_earnings_select_own_rider" ON public.rider_earnings;
CREATE POLICY "rider_earnings_select_own_rider" ON public.rider_earnings
  FOR SELECT USING (
    rider_id = (
      SELECT r.id FROM public.riders r WHERE r.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rider_earnings_all_admin" ON public.rider_earnings;
CREATE POLICY "rider_earnings_all_admin" ON public.rider_earnings
  FOR ALL USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- contact_messages
-- Anyone (anonymous + authenticated) can INSERT
-- =============================================================================
DROP POLICY IF EXISTS "contact_messages_insert_public" ON public.contact_messages;
CREATE POLICY "contact_messages_insert_public" ON public.contact_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "contact_messages_select_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_select_admin" ON public.contact_messages
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "contact_messages_update_admin" ON public.contact_messages;
CREATE POLICY "contact_messages_update_admin" ON public.contact_messages
  FOR UPDATE USING (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- notifications
-- =============================================================================
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "notifications_select_admin" ON public.notifications;
CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT USING (get_current_user_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "notifications_insert_admin" ON public.notifications;
CREATE POLICY "notifications_insert_admin" ON public.notifications
  FOR INSERT WITH CHECK (get_current_user_role() IN ('admin', 'super_admin'));

-- =============================================================================
-- audit_logs
-- super_admin SELECT only — no INSERT from any frontend role
-- =============================================================================
DROP POLICY IF EXISTS "audit_logs_select_super_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_super_admin" ON public.audit_logs
  FOR SELECT USING (get_current_user_role() = 'super_admin');
