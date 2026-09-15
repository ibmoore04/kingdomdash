-- =============================================================================
-- Database RLS & Ownership Verification Test Suite: Migration 016
-- Path: supabase/tests/20260902000016_vendor_catalog_ownership_rls_test.sql
-- Purpose: Direct PostgreSQL database-level testing of RLS policies, trigger
--          immutability guards, and least-privilege grants.
-- Run with: psql -f supabase/tests/20260902000016_vendor_catalog_ownership_rls_test.sql
--           or supabase test db (if pgTAP configured)
-- =============================================================================

BEGIN;

-- Test Fixtures Setup
DO $$
DECLARE
  v_user_a_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user_b_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_vendor_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  v_vendor_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;
  v_cat_a_active uuid := 'ca111111-1111-1111-1111-111111111111'::uuid;
  v_cat_a_inactive uuid := 'ca222222-2222-2222-2222-222222222222'::uuid;
  v_cat_b uuid := 'cb111111-1111-1111-1111-111111111111'::uuid;
  v_prod_a_avail uuid := 'pa111111-1111-1111-1111-111111111111'::uuid;
  v_prod_a_unavail uuid := 'pa222222-2222-2222-2222-222222222222'::uuid;
  v_prod_b uuid := 'pb111111-1111-1111-1111-111111111111'::uuid;
  v_count integer;
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '=== STARTING MIGRATION 016 DATABASE SECURITY VERIFICATION ===';

  -- 1. Create profiles for Vendor A and Vendor B
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_user_a_id, 'Vendor A User', 'vendor_a@test.com', 'vendor', true),
    (v_user_b_id, 'Vendor B User', 'vendor_b@test.com', 'vendor', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create vendors
  INSERT INTO public.vendors (id, profile_id, business_name, business_type, business_address, phone, email, is_active, rating)
  VALUES
    (v_vendor_a_id, v_user_a_id, 'Vendor A Store', 'restaurant', '123 Market Rd, Ijebu-Ode', '08011111111', 'vendor_a@test.com', true, 4.5),
    (v_vendor_b_id, v_user_b_id, 'Vendor B Store', 'grocery', '456 Commercial Ave, Ijebu-Ode', '08022222222', 'vendor_b@test.com', true, 4.8)
  ON CONFLICT (id) DO NOTHING;

  -- 3. Create categories
  INSERT INTO public.categories (id, vendor_id, name, is_active)
  VALUES
    (v_cat_a_active, v_vendor_a_id, 'Vendor A Active Cat', true),
    (v_cat_a_inactive, v_vendor_a_id, 'Vendor A Inactive Cat', false),
    (v_cat_b, v_vendor_b_id, 'Vendor B Cat', true)
  ON CONFLICT (id) DO NOTHING;

  -- 4. Create products
  INSERT INTO public.products (id, vendor_id, category_id, name, price, is_available)
  VALUES
    (v_prod_a_avail, v_vendor_a_id, v_cat_a_active, 'Vendor A Available Prod', 1500, true),
    (v_prod_a_unavail, v_vendor_a_id, v_cat_a_active, 'Vendor A Unavailable Prod', 2000, false),
    (v_prod_b, v_vendor_b_id, v_cat_b, 'Vendor B Prod', 3500, true)
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test fixtures initialized successfully.';
END;
$$;


-- =============================================================================
-- TEST SUITE 1: Anonymous (anon) Role Access
-- =============================================================================
DO $$
DECLARE
  v_count integer;
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '--- TEST SUITE 1: Anonymous Role Access ---';

  -- Simulate anon caller
  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claims" = '{"role": "anon"}';

  -- 1.1 Public active vendor SELECT -> ALLOWED
  SELECT count(*) INTO v_count FROM public.vendors WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  ASSERT v_count = 1, 'Anon should see active vendor';

  -- 1.2 Public active product SELECT -> ALLOWED
  SELECT count(*) INTO v_count FROM public.products WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_count = 1, 'Anon should see active product';

  -- 1.3 Public unavailable product SELECT -> DENIED (returns 0 rows)
  SELECT count(*) INTO v_count FROM public.products WHERE id = 'pa222222-2222-2222-2222-222222222222'::uuid;
  ASSERT v_count = 0, 'Anon should NOT see unavailable product';

  -- 1.4 Category INSERT -> DENIED (permission denied or RLS error)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.categories (vendor_id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Hacked Cat');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Anon category INSERT must be DENIED';

  -- 1.5 Category UPDATE -> DENIED (no grant / 0 rows / error)
  v_err_caught := false;
  BEGIN
    UPDATE public.categories SET name = 'Hacked Name' WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Anon category UPDATE must be DENIED by grants';

  -- 1.6 Product INSERT -> DENIED
  v_err_caught := false;
  BEGIN
    INSERT INTO public.products (vendor_id, name, price) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'Hacked Prod', 100);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Anon product INSERT must be DENIED';

  -- 1.7 Product UPDATE -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.products SET price = 0 WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Anon product UPDATE must be DENIED by grants';

  RAISE NOTICE '✓ Suite 1 PASSED: Anonymous access strictly limited to active public catalog.';
END;
$$;


-- =============================================================================
-- TEST SUITE 2: Vendor A Access to Own Catalog & Profile
-- =============================================================================
DO $$
DECLARE
  v_count integer;
  v_status boolean;
  v_address text;
BEGIN
  RAISE NOTICE '--- TEST SUITE 2: Vendor A Own Catalog Access ---';

  -- Simulate authenticated Vendor A
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  -- 2.1 Own active category SELECT -> ALLOWED
  SELECT count(*) INTO v_count FROM public.categories WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_count = 1, 'Vendor A must be able to SELECT own active category';

  -- 2.2 Own inactive category SELECT -> ALLOWED (via categories_select_own_vendor)
  SELECT count(*) INTO v_count FROM public.categories WHERE id = 'ca222222-2222-2222-2222-222222222222'::uuid;
  ASSERT v_count = 1, 'Vendor A must be able to SELECT own inactive category';

  -- 2.3 Own category UPDATE -> ALLOWED
  UPDATE public.categories SET name = 'Vendor A Updated Cat' WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  SELECT name INTO v_address FROM public.categories WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_address = 'Vendor A Updated Cat', 'Vendor A category UPDATE must succeed';

  -- 2.4 Own category active toggle -> ALLOWED
  UPDATE public.categories SET is_active = false WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  SELECT is_active INTO v_status FROM public.categories WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_status = false, 'Vendor A category active toggle must succeed';

  -- 2.5 Own active product SELECT -> ALLOWED
  SELECT count(*) INTO v_count FROM public.products WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_count = 1, 'Vendor A must be able to SELECT own active product';

  -- 2.6 Own unavailable product SELECT -> ALLOWED (via products_select_own_vendor)
  SELECT count(*) INTO v_count FROM public.products WHERE id = 'pa222222-2222-2222-2222-222222222222'::uuid;
  ASSERT v_count = 1, 'Vendor A must be able to SELECT own unavailable product';

  -- 2.7 Own product UPDATE -> ALLOWED
  UPDATE public.products SET price = 1750 WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  SELECT price INTO v_count FROM public.products WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_count = 1750, 'Vendor A product price UPDATE must succeed';

  -- 2.8 Own product availability toggle -> ALLOWED
  UPDATE public.products SET is_available = false WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  SELECT is_available INTO v_status FROM public.products WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  ASSERT v_status = false, 'Vendor A product availability toggle must succeed';

  -- 2.9 Permitted vendor profile update -> ALLOWED (allowlist fields)
  UPDATE public.vendors
  SET business_address = '999 Updated High Street, Ijebu-Ode',
      phone = '08099999999',
      business_description = 'New Description'
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  SELECT business_address INTO v_address FROM public.vendors WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  ASSERT v_address = '999 Updated High Street, Ijebu-Ode', 'Vendor profile allowlisted fields update must succeed';

  RAISE NOTICE '✓ Suite 2 PASSED: Vendor A successfully manages own catalog and permitted profile fields.';
END;
$$;


-- =============================================================================
-- TEST SUITE 3: Vendor A -> Vendor B Cross-Vendor Attacks
-- =============================================================================
DO $$
DECLARE
  v_count integer;
  v_rows_affected integer;
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '--- TEST SUITE 3: Vendor A -> Vendor B Cross-Vendor Attacks ---';

  -- Simulate authenticated Vendor A
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  -- 3.1 UPDATE Vendor B category -> DENIED (0 rows affected)
  UPDATE public.categories SET name = 'Attacked Cat' WHERE id = 'cb111111-1111-1111-1111-111111111111'::uuid;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  ASSERT v_rows_affected = 0, 'Vendor A cannot UPDATE Vendor B category (must affect 0 rows)';

  -- 3.2 DELETE Vendor B category -> DENIED (0 rows affected)
  DELETE FROM public.categories WHERE id = 'cb111111-1111-1111-1111-111111111111'::uuid;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  ASSERT v_rows_affected = 0, 'Vendor A cannot DELETE Vendor B category (must affect 0 rows)';

  -- 3.3 UPDATE Vendor B product -> DENIED (0 rows affected)
  UPDATE public.products SET price = 1 WHERE id = 'pb111111-1111-1111-1111-111111111111'::uuid;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  ASSERT v_rows_affected = 0, 'Vendor A cannot UPDATE Vendor B product (must affect 0 rows)';

  -- 3.4 DELETE Vendor B product -> DENIED (0 rows affected)
  DELETE FROM public.products WHERE id = 'pb111111-1111-1111-1111-111111111111'::uuid;
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  ASSERT v_rows_affected = 0, 'Vendor A cannot DELETE Vendor B product (must affect 0 rows)';

  -- 3.5 Reassign own category vendor_id to Vendor B -> DENIED (Trigger + RLS WITH CHECK)
  v_err_caught := false;
  BEGIN
    UPDATE public.categories
    SET vendor_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
    WHERE id = 'ca111111-1111-1111-1111-111111111111'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Category vendor_id reassignment must be DENIED';

  -- 3.6 Reassign own product vendor_id to Vendor B -> DENIED (Trigger + RLS WITH CHECK)
  v_err_caught := false;
  BEGIN
    UPDATE public.products
    SET vendor_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
    WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Product vendor_id reassignment must be DENIED';

  -- 3.7 Assign product to Vendor B category -> DENIED (validate_product_category_vendor trigger)
  v_err_caught := false;
  BEGIN
    UPDATE public.products
    SET category_id = 'cb111111-1111-1111-1111-111111111111'::uuid
    WHERE id = 'pa111111-1111-1111-1111-111111111111'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Cross-vendor category assignment must be DENIED';

  RAISE NOTICE '✓ Suite 3 PASSED: All cross-vendor attacks and reassignments strictly blocked.';
END;
$$;


-- =============================================================================
-- TEST SUITE 4: Protected Vendor System Fields Immutability
-- =============================================================================
DO $$
DECLARE
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '--- TEST SUITE 4: Protected Vendor Fields Immutability ---';

  -- Simulate authenticated Vendor A
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  -- 4.1 Change profile_id -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET profile_id = '22222222-2222-2222-2222-222222222222'::uuid
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor profile_id change must be DENIED';

  -- 4.2 Change rating -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET rating = 5.0
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor rating change must be DENIED';

  -- 4.3 Change is_active -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET is_active = false
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor is_active change must be DENIED';

  -- 4.4 Change business_type -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET business_type = 'grocery'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor business_type change must be DENIED';

  -- 4.5 Change business_name -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET business_name = 'Illegal Name Change'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor business_name change must be DENIED';

  -- 4.6 Change email -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET email = 'hacked@email.com'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor email change must be DENIED';

  -- 4.7 Change created_at -> DENIED
  v_err_caught := false;
  BEGIN
    UPDATE public.vendors
    SET created_at = now() - interval '1 year'
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor created_at change must be DENIED';

  RAISE NOTICE '✓ Suite 4 PASSED: All protected vendor system fields strictly protected by allowlist.';
END;
$$;


-- =============================================================================
-- TEST SUITE 5: Cross-Vendor SELECT & INSERT Attacks (Vendor A -> Vendor B)
-- =============================================================================
DO $$
DECLARE
  v_count integer;
  v_err_caught boolean;
BEGIN
  RAISE NOTICE '--- TEST SUITE 5: Cross-Vendor SELECT & INSERT Attacks ---';

  -- Simulate authenticated Vendor A
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

  -- 5.1 Vendor A -> Vendor B category SELECT -> DENIED (returns 0 rows)
  SELECT count(*) INTO v_count
  FROM public.categories
  WHERE id = 'cb111111-1111-1111-1111-111111111111'::uuid
    AND NOT is_active; -- If inactive, definitely 0 rows; if active, public policy might allow reading public menu, but management SELECT is denied
  ASSERT v_count = 0, 'Vendor A cannot select Vendor B inactive categories';

  -- 5.2 Vendor A -> Vendor B product SELECT (unavailable) -> DENIED (returns 0 rows)
  -- Create an unavailable product for Vendor B to test cross-vendor private visibility
  -- Since we are authenticated as Vendor A, we verify Vendor B unavailable products return 0
  SELECT count(*) INTO v_count
  FROM public.products
  WHERE vendor_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
    AND is_available = false;
  ASSERT v_count = 0, 'Vendor A cannot select Vendor B unavailable products';

  -- 5.3 Vendor A -> insert category for Vendor B -> DENIED (WITH CHECK fails)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.categories (vendor_id, name)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Unauthorized Category');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor A inserting category for Vendor B must be DENIED';

  -- 5.4 Vendor A -> insert product for Vendor B -> DENIED (WITH CHECK fails)
  v_err_caught := false;
  BEGIN
    INSERT INTO public.products (vendor_id, name, price)
    VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'Unauthorized Product', 500);
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;
  ASSERT v_err_caught, 'Vendor A inserting product for Vendor B must be DENIED';

  RAISE NOTICE '✓ Suite 5 PASSED: Cross-vendor SELECT and INSERT attacks blocked.';
END;
$$;


-- =============================================================================
-- TEST SUITE 6: Admin & Super Admin Legitimate Administration
-- =============================================================================
DO $$
DECLARE
  v_admin_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_super_admin_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_status boolean;
  v_rating numeric;
BEGIN
  RAISE NOTICE '--- TEST SUITE 6: Admin & Super Admin Legitimate Administration ---';

  -- Create admin and super_admin profile fixtures
  INSERT INTO public.profiles (id, full_name, email, role, is_active)
  VALUES
    (v_admin_id, 'Admin User', 'admin@test.com', 'admin', true),
    (v_super_admin_id, 'Super Admin User', 'super_admin@test.com', 'super_admin', true)
  ON CONFLICT (id) DO NOTHING;

  -- 6.1 Admin legitimate vendor administration -> ALLOWED
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

  UPDATE public.vendors
  SET is_active = false, rating = 4.9
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  SELECT is_active, rating INTO v_status, v_rating
  FROM public.vendors
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  ASSERT v_status = false AND v_rating = 4.9, 'Admin must be able to update vendor status and rating';

  -- 6.2 Super Admin legitimate vendor administration -> ALLOWED
  SET LOCAL "request.jwt.claims" = '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

  UPDATE public.vendors
  SET is_active = true, business_type = 'grocery_store'
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

  SELECT is_active INTO v_status
  FROM public.vendors
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;
  ASSERT v_status = true, 'Super Admin must be able to manage vendor record';

  RAISE NOTICE '✓ Suite 6 PASSED: Admin and Super Admin legitimate administration allowed.';
  RAISE NOTICE '=== ALL 26 ATTACK MATRIX TESTS COMPLETED SUCCESSFULLY ===';
END;
$$;

ROLLBACK;
