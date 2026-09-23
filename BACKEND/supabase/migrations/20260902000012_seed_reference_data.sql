-- Migration: 20260902000012_seed_reference_data.sql
-- Seeds reference data: food categories, grocery categories, service areas, default pricing rule
-- All inserts use ON CONFLICT DO NOTHING (or WHERE NOT EXISTS) for idempotency
-- To re-seed from scratch on local, use: supabase db reset

-- ============================================================
-- 1. Food categories (reference_categories, service_type = 'food')
--    Fixed UUIDs: 10000000-0000-0000-0000-000000000001 through ...0010
--    ON CONFLICT (id) DO NOTHING ensures idempotency without a
--    unique constraint on (name, service_type).
-- ============================================================
INSERT INTO public.reference_categories (id, name, service_type, display_order, is_active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Rice',       'food', 1,  true),
  ('10000000-0000-0000-0000-000000000002', 'Soups',      'food', 2,  true),
  ('10000000-0000-0000-0000-000000000003', 'Grills',     'food', 3,  true),
  ('10000000-0000-0000-0000-000000000004', 'Swallow',    'food', 4,  true),
  ('10000000-0000-0000-0000-000000000005', 'Pasta',      'food', 5,  true),
  ('10000000-0000-0000-0000-000000000006', 'Sides',      'food', 6,  true),
  ('10000000-0000-0000-0000-000000000007', 'Drinks',     'food', 7,  true),
  ('10000000-0000-0000-0000-000000000008', 'Snacks',     'food', 8,  true),
  ('10000000-0000-0000-0000-000000000009', 'Breakfast',  'food', 9,  true),
  ('10000000-0000-0000-0000-000000000010', 'Proteins',   'food', 10, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Grocery categories (reference_categories, service_type = 'grocery')
--    Fixed UUIDs: 20000000-0000-0000-0000-000000000001 through ...0010
-- ============================================================
INSERT INTO public.reference_categories (id, name, service_type, display_order, is_active)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Produce',       'grocery', 1,  true),
  ('20000000-0000-0000-0000-000000000002', 'Pantry',        'grocery', 2,  true),
  ('20000000-0000-0000-0000-000000000003', 'Beverages',     'grocery', 3,  true),
  ('20000000-0000-0000-0000-000000000004', 'Dairy',         'grocery', 4,  true),
  ('20000000-0000-0000-0000-000000000005', 'Household',     'grocery', 5,  true),
  ('20000000-0000-0000-0000-000000000006', 'Snacks',        'grocery', 6,  true),
  ('20000000-0000-0000-0000-000000000007', 'Frozen',        'grocery', 7,  true),
  ('20000000-0000-0000-0000-000000000008', 'Bakery',        'grocery', 8,  true),
  ('20000000-0000-0000-0000-000000000009', 'Condiments',    'grocery', 9,  true),
  ('20000000-0000-0000-0000-000000000010', 'Personal Care', 'grocery', 10, true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Service areas
--    name is UNIQUE on service_areas, so ON CONFLICT (name) DO NOTHING
--    is the correct idempotency guard.
-- ============================================================
INSERT INTO public.service_areas (name, is_active)
VALUES
  ('Lekki Phase 1',  true),
  ('Yaba',           true),
  ('Victoria Island',true),
  ('Ikeja',          true),
  ('Surulere',       true)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 4. Default delivery pricing rule
--    service_type = NULL means the rule applies to all service types.
--    delivery_pricing_rules has no unique constraint, so this INSERT
--    runs exactly once — the Supabase CLI migration history prevents
--    re-application. Use `supabase db reset` for a clean local re-seed.
-- ============================================================
INSERT INTO public.delivery_pricing_rules (
  service_type,
  base_fee,
  distance_rate,
  is_active,
  effective_date
)
VALUES (
  NULL,            -- applies to all service types
  500.00,          -- base_fee in Naira
  100.0000,        -- distance_rate per km in Naira
  true,
  CURRENT_DATE
);
