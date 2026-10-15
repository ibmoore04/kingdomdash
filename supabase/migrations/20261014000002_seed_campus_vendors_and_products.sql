-- Migration: 20261014000002_seed_campus_vendors_and_products.sql
-- Purpose: Seeds complete food & beverage categories and meals for verified campus vendors
--          Enables realistic student budget meals (Under ₦2,500), late-night grills, drinks, and combos.

DO $$
DECLARE
  v_chicken_co_id uuid;
  v_lord_reigneth_id uuid;
  v_qa_kitchen_id uuid;

  -- Categories for Chicken & Co
  cat_cc_grills uuid := 'a1000000-0000-0000-0000-000000000001';
  cat_cc_drinks uuid := 'a1000000-0000-0000-0000-000000000002';
  cat_cc_sides  uuid := 'a1000000-0000-0000-0000-000000000003';

  -- Categories for Lord Reigneth Foods
  cat_lr_rice   uuid := 'a2000000-0000-0000-0000-000000000001';
  cat_lr_soups  uuid := 'a2000000-0000-0000-0000-000000000002';
  cat_lr_sides  uuid := 'a2000000-0000-0000-0000-000000000003';
  cat_lr_drinks uuid := 'a2000000-0000-0000-0000-000000000004';

  -- Categories for KingdomDash QA Kitchen
  cat_qa_budget uuid := 'a3000000-0000-0000-0000-000000000001';
  cat_qa_grills uuid := 'a3000000-0000-0000-0000-000000000002';
  cat_qa_pasta  uuid := 'a3000000-0000-0000-0000-000000000003';
  cat_qa_drinks uuid := 'a3000000-0000-0000-0000-000000000004';

BEGIN
  -- 1. Identify existing vendor IDs
  SELECT id INTO v_chicken_co_id FROM public.vendors WHERE business_name ILIKE '%Chicken & Co%' LIMIT 1;
  SELECT id INTO v_lord_reigneth_id FROM public.vendors WHERE business_name ILIKE '%Lord Reigneth Foods%' LIMIT 1;
  SELECT id INTO v_qa_kitchen_id FROM public.vendors WHERE business_name ILIKE '%KingdomDash QA Kitchen%' LIMIT 1;

  -- =========================================================================
  -- 2. SEED CATEGORIES FOR CHICKEN & CO
  -- =========================================================================
  IF v_chicken_co_id IS NOT NULL THEN
    INSERT INTO public.categories (id, vendor_id, name, reference_category_id, display_order, is_active)
    VALUES
      (cat_cc_grills, v_chicken_co_id, 'Grills & Shawarma', '10000000-0000-0000-0000-000000000003', 1, true),
      (cat_cc_sides,  v_chicken_co_id, 'Sides & Chips',     '10000000-0000-0000-0000-000000000006', 2, true),
      (cat_cc_drinks, v_chicken_co_id, 'Cold Beverages',    '10000000-0000-0000-0000-000000000007', 3, true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, is_active = true;

    -- Products for Chicken & Co
    INSERT INTO public.products (id, vendor_id, category_id, name, description, price, is_available, display_order)
    VALUES
      ('b1000000-0000-0000-0000-000000000001', v_chicken_co_id, cat_cc_grills, 'Crispy Fried Chicken (2 Pieces)', 'Golden seasoned deep-fried chicken with pepper dip', 2200.00, true, 1),
      ('b1000000-0000-0000-0000-000000000002', v_chicken_co_id, cat_cc_grills, 'Chicken Shawarma Supreme', 'Double sausage, shredded chicken, and special cream sauce', 2500.00, true, 2),
      ('b1000000-0000-0000-0000-000000000003', v_chicken_co_id, cat_cc_grills, 'Jumbo Grilled Turkey Wing', 'Succulent spicy peppered turkey', 3500.00, true, 3),
      ('b1000000-0000-0000-0000-000000000004', v_chicken_co_id, cat_cc_sides,  'French Fries & BBQ Wings', 'Golden crispy fries with 3 BBQ glazed wings', 2800.00, true, 4),
      ('b1000000-0000-0000-0000-000000000005', v_chicken_co_id, cat_cc_drinks, 'Chilled Coca-Cola (50cl)', 'Chilled pet bottle Coca-Cola', 500.00, true, 5),
      ('b1000000-0000-0000-0000-000000000006', v_chicken_co_id, cat_cc_drinks, 'Pure Table Water (75cl)', 'Chilled bottled mineral water', 300.00, true, 6)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, price = EXCLUDED.price, is_available = true;
  END IF;

  -- =========================================================================
  -- 3. SEED CATEGORIES FOR LORD REIGNETH FOODS
  -- =========================================================================
  IF v_lord_reigneth_id IS NOT NULL THEN
    INSERT INTO public.categories (id, vendor_id, name, reference_category_id, display_order, is_active)
    VALUES
      (cat_lr_rice,   v_lord_reigneth_id, 'Rice Dishes',       '10000000-0000-0000-0000-000000000001', 1, true),
      (cat_lr_soups,  v_lord_reigneth_id, 'Soups & Swallow',   '10000000-0000-0000-0000-000000000004', 2, true),
      (cat_lr_sides,  v_lord_reigneth_id, 'Sides & Extras',    '10000000-0000-0000-0000-000000000006', 3, true),
      (cat_lr_drinks, v_lord_reigneth_id, 'Drinks & Water',    '10000000-0000-0000-0000-000000000007', 4, true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, is_active = true;

    -- Products for Lord Reigneth Foods
    INSERT INTO public.products (id, vendor_id, category_id, name, description, price, is_available, display_order)
    VALUES
      ('b2000000-0000-0000-0000-000000000001', v_lord_reigneth_id, cat_lr_rice,   'Party Jollof Rice & Fried Beef', 'Smoky firewood-style party jollof served with spiced tender beef', 2400.00, true, 1),
      ('b2000000-0000-0000-0000-000000000002', v_lord_reigneth_id, cat_lr_rice,   'Special Fried Rice & Dodo', 'Flavorful liver fried rice served with sweet fried plantain', 2300.00, true, 2),
      ('b2000000-0000-0000-0000-000000000003', v_lord_reigneth_id, cat_lr_soups,  'Egusi Soup with Semovita & Assorted', 'Rich melon soup loaded with stockfish, shaki, and semovita', 2500.00, true, 3),
      ('b2000000-0000-0000-0000-000000000004', v_lord_reigneth_id, cat_lr_soups,  'Pounded Yam & Native Vegetable with Goat Meat', 'Traditional efo riro with soft pounded yam and goat meat', 3200.00, true, 4),
      ('b2000000-0000-0000-0000-000000000005', v_lord_reigneth_id, cat_lr_sides,  'Fried Sweet Plantain (Dodo Portion)', 'Extra portion of golden ripe fried dodo', 700.00, true, 5),
      ('b2000000-0000-0000-0000-000000000006', v_lord_reigneth_id, cat_lr_drinks, 'Chilled Maltina (33cl Can)', 'Smooth nourishing non-alcoholic malt drink', 600.00, true, 6)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, price = EXCLUDED.price, is_available = true;
  END IF;

  -- =========================================================================
  -- 4. SEED CATEGORIES FOR KINGDOMDASH QA KITCHEN
  -- =========================================================================
  IF v_qa_kitchen_id IS NOT NULL THEN
    INSERT INTO public.categories (id, vendor_id, name, reference_category_id, display_order, is_active)
    VALUES
      (cat_qa_budget, v_qa_kitchen_id, 'Campus Student Specials', '10000000-0000-0000-0000-000000000001', 1, true),
      (cat_qa_grills, v_qa_kitchen_id, 'Late-Night Grills',      '10000000-0000-0000-0000-000000000003', 2, true),
      (cat_qa_pasta,  v_qa_kitchen_id, 'Pastas & Noodles',        '10000000-0000-0000-0000-000000000005', 3, true),
      (cat_qa_drinks, v_qa_kitchen_id, 'Drinks & Juices',         '10000000-0000-0000-0000-000000000007', 4, true)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, is_active = true;

    -- Products for KingdomDash QA Kitchen
    INSERT INTO public.products (id, vendor_id, category_id, name, description, price, is_available, display_order)
    VALUES
      ('b3000000-0000-0000-0000-000000000001', v_qa_kitchen_id, cat_qa_budget, 'Campus Student Combo (Jollof + Egg + Dodo)', 'Budget friendly student staple meal with boiled egg and plantain', 1800.00, true, 1),
      ('b3000000-0000-0000-0000-000000000002', v_qa_kitchen_id, cat_qa_grills, 'Late-Night Spicy Beef Suya', 'Freshly sliced grilled beef skewers with yaji pepper and sliced onions', 2500.00, true, 2),
      ('b3000000-0000-0000-0000-000000000003', v_qa_kitchen_id, cat_qa_pasta,  'Stir-Fry Spaghetti & Smoked Sausage', 'Spicy wok-tossed spaghetti with sweet peppers and smoked sausage', 2200.00, true, 3),
      ('b3000000-0000-0000-0000-000000000004', v_qa_kitchen_id, cat_qa_drinks, 'Chilled Zobo Drink (50cl)', 'Natural hibiscus drink infused with ginger, pineapple, and cloves', 600.00, true, 4),
      ('b3000000-0000-0000-0000-000000000005', v_qa_kitchen_id, cat_qa_drinks, 'Bottled Eva Water (75cl)', 'Chilled premium natural spring water', 300.00, true, 5)
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name, price = EXCLUDED.price, is_available = true;
  END IF;
END;
$$;
