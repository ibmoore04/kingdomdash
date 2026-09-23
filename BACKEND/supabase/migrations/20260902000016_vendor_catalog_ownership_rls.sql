-- =============================================================================
-- Migration: 20260902000016_vendor_catalog_ownership_rls.sql
-- Purpose  : Phase 5 Vendor & Product System surgical hardening migration
--            1. Add vendor-specific SELECT policies for categories & products (TO authenticated)
--            2. Re-scope & harden UPDATE policies with WITH CHECK (TO authenticated)
--            3. Re-scope INSERT and DELETE policies on categories & products (TO authenticated)
--            4. Re-scope & harden vendor self-UPDATE policy with WITH CHECK (TO authenticated)
--            5. Add BEFORE UPDATE triggers to enforce immutable vendor_id & id using IS DISTINCT FROM
--            6. Add BEFORE UPDATE trigger to protect vendor system/identity fields (allowlist model)
--            7. Enforce explicit least-privilege table & function grants
-- =============================================================================

-- =============================================================================
-- §1  Vendor-specific SELECT Policies (TO authenticated)
-- Allows authenticated vendors to view and manage their own categories and products
-- even when is_active = false or is_available = false.
-- Public SELECT policies (categories_select_public, products_select_public) remain intact.
-- =============================================================================

DROP POLICY IF EXISTS "categories_select_own_vendor" ON public.categories;
CREATE POLICY "categories_select_own_vendor" ON public.categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = categories.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_select_own_vendor" ON public.products;
CREATE POLICY "products_select_own_vendor" ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendors_select_own" ON public.vendors;
CREATE POLICY "vendors_select_own" ON public.vendors
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());


-- =============================================================================
-- §2  Harden UPDATE Policies with USING + WITH CHECK (TO authenticated)
-- Guarantees that vendors can only update their own records AND cannot reassign
-- category_id, vendor_id, or ownership to another vendor.
-- =============================================================================

DROP POLICY IF EXISTS "categories_update_own_vendor" ON public.categories;
CREATE POLICY "categories_update_own_vendor" ON public.categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = categories.vendor_id
        AND v.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = categories.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_update_own_vendor" ON public.products;
CREATE POLICY "products_update_own_vendor" ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "vendors_update_own" ON public.vendors;
CREATE POLICY "vendors_update_own" ON public.vendors
  FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());


-- =============================================================================
-- §3  Re-scope INSERT and DELETE Policies (TO authenticated)
-- Ensures vendor write policies are strictly bound to authenticated sessions.
-- =============================================================================

DROP POLICY IF EXISTS "categories_insert_own_vendor" ON public.categories;
CREATE POLICY "categories_insert_own_vendor" ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = categories.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "categories_delete_own_vendor" ON public.categories;
CREATE POLICY "categories_delete_own_vendor" ON public.categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = categories.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_insert_own_vendor" ON public.products;
CREATE POLICY "products_insert_own_vendor" ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "products_delete_own_vendor" ON public.products;
CREATE POLICY "products_delete_own_vendor" ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vendors v
      WHERE v.id = products.vendor_id
        AND v.profile_id = auth.uid()
    )
  );


-- =============================================================================
-- §4  Vendor ID & Primary Key Immutability Trigger (IS DISTINCT FROM)
-- Enforces engine-level immutability for vendor_id and id on categories and products.
-- Uses NULL-safe IS DISTINCT FROM to prevent NULL bypass or reassignment.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prevent_catalog_ownership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.vendor_id IS DISTINCT FROM OLD.vendor_id THEN
    RAISE EXCEPTION 'Ownership violation: vendor_id cannot be modified.';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Identifier violation: primary key id cannot be modified.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_catalog_ownership_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_catalog_ownership_change() TO authenticated;

-- Ensure existing product category validation trigger function is executable by authenticated users
GRANT EXECUTE ON FUNCTION public.validate_product_category_vendor() TO authenticated;

-- Drop legacy trigger name if exists from earlier draft
DROP TRIGGER IF EXISTS trg_prevent_category_vendor_change ON public.categories;
CREATE TRIGGER trg_prevent_category_vendor_change
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_catalog_ownership_change();

DROP TRIGGER IF EXISTS trg_prevent_product_vendor_change ON public.products;
CREATE TRIGGER trg_prevent_product_vendor_change
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_catalog_ownership_change();


-- =============================================================================
-- §5  Vendor Profile Field Protection Trigger (Allowlist Model)
-- Phase 5 allows vendors to edit ONLY:
--   • phone
--   • business_description
--   • business_address
--   • service_area
--   • operating_hours
--   • logo_url
--   • cover_image_url
--
-- Vendors must NOT be able to modify:
--   • id
--   • profile_id
--   • business_name (approved legal/trade name)
--   • business_type (registered service model)
--   • email (bound to auth identity)
--   • is_active (system/admin approval status)
--   • rating (system calculated metric)
--   • created_at (system audit timestamp)
--
-- Uses NULL-safe IS DISTINCT FROM and safely handles NULL get_current_user_role().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.protect_vendor_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_current_role public.user_role;
BEGIN
  v_current_role := public.get_current_user_role();

  -- Admin and super_admin may modify all vendor fields
  IF (v_current_role IS NULL OR v_current_role NOT IN ('admin', 'super_admin')) THEN
    -- Protect immutable identity and ownership links
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Cannot modify vendor id.';
    END IF;
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
      RAISE EXCEPTION 'Cannot modify vendor profile_id.';
    END IF;

    -- Protect system-registered and admin-approved identity fields
    IF NEW.business_name IS DISTINCT FROM OLD.business_name THEN
      RAISE EXCEPTION 'Vendors cannot alter their registered business_name.';
    END IF;
    IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN
      RAISE EXCEPTION 'Vendors cannot alter their registered business_type.';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Vendors cannot alter their registered email.';
    END IF;

    -- Protect status, operational rating, and audit timestamps
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Vendors cannot alter their own active status.';
    END IF;
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Vendors cannot alter their own rating.';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Cannot modify vendor created_at.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_vendor_immutable_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_vendor_immutable_fields() TO authenticated;

DROP TRIGGER IF EXISTS trg_protect_vendor_fields ON public.vendors;
CREATE TRIGGER trg_protect_vendor_fields
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_vendor_immutable_fields();


-- =============================================================================
-- §6  Explicit Least-Privilege Table Grants
-- Anonymous (anon) is granted ONLY public reads (SELECT).
-- Authenticated users are granted catalog reads and scoped DML.
-- Service role retains full administrative privileges by default.
-- =============================================================================

-- Revoke default public privileges to establish clean boundary
REVOKE ALL ON public.reference_categories FROM PUBLIC;
REVOKE ALL ON public.vendors FROM PUBLIC;
REVOKE ALL ON public.categories FROM PUBLIC;
REVOKE ALL ON public.products FROM PUBLIC;

-- 1. Anonymous (anon) role: public catalog reads only
GRANT SELECT ON public.reference_categories TO anon;
GRANT SELECT ON public.vendors TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;

-- 2. Authenticated role: catalog reads + scoped vendor management
GRANT SELECT ON public.reference_categories TO authenticated;
GRANT SELECT, UPDATE ON public.vendors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
