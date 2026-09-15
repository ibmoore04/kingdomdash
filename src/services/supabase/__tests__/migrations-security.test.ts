/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Database Migration Security & RLS Invariant Verification', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')

  it('Migration 013 explicitly drops direct customer INSERT access on orders and order_items', () => {
    const mig013 = fs.readFileSync(
      path.join(migrationsDir, '20260902000013_security_corrections.sql'),
      'utf-8'
    )

    // Verify Section 6 in migration 013 drops the customer insert policies
    expect(mig013).toContain('DROP POLICY IF EXISTS "orders_insert_own_customer" ON public.orders;')
    expect(mig013).toContain('DROP POLICY IF EXISTS "order_items_insert_customer" ON public.order_items;')

    // Verify neither policy is re-created in any later migration
    const laterMigrations = ['20260902000014_final_security_hardening.sql', '20260902000015_remaining_medium_fixes.sql', '20260902000016_vendor_catalog_ownership_rls.sql']
    for (const file of laterMigrations) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')
      expect(content).not.toContain('CREATE POLICY "orders_insert_own_customer"')
      expect(content).not.toContain('CREATE POLICY "order_items_insert_customer"')
    }
  })

  it('Migration 015 enforces full security guarantees in create_order_secure()', () => {
    const mig015 = fs.readFileSync(
      path.join(migrationsDir, '20260902000015_remaining_medium_fixes.sql'),
      'utf-8'
    )

    // 1. Authenticated caller identity via auth.uid()
    expect(mig015).toContain('v_user_id := auth.uid();')
    expect(mig015).toContain("RAISE EXCEPTION 'Not authenticated';")

    // 2. Courier orders rejected
    expect(mig015).toContain("IF p_service_type = 'courier' THEN")

    // 3. Active vendor check
    expect(mig015).toContain('SELECT id, is_active INTO v_vendor')
    expect(mig015).toContain('IF NOT FOUND OR NOT v_vendor.is_active THEN')

    // 4. Maximum 50 item lines cap
    expect(mig015).toContain('IF jsonb_array_length(p_items) > 50 THEN')

    // 5. Quantity validation (integer, 1..999, no decimal)
    expect(mig015).toContain("IF v_qty_raw ~ '\\.' THEN")
    expect(mig015).toContain('IF v_item_quantity < 1 OR v_item_quantity > 999 THEN')

    // 6. Duplicate product ID rejection
    expect(mig015).toContain('IF v_product_id = ANY(v_seen_product_ids) THEN')

    // 7. Product existence, active vendor match, availability and FOR UPDATE lock
    expect(mig015).toContain('AND vendor_id = p_vendor_id')
    expect(mig015).toContain('AND is_available = true')
    expect(mig015).toContain('FOR UPDATE;')

    // 8. DB-authoritative price calculation (v_product.price * v_item_quantity)
    expect(mig015).toContain('v_product.price * v_item_quantity')
    expect(mig015).toContain('v_subtotal := v_subtotal + (v_product.price * v_item_quantity);')

    // 9. Special instructions length truncated to 500
    expect(mig015).toContain('left(p_special_instructions, 500)')

    // 10. Least privilege grants: revoked from PUBLIC, granted to authenticated only
    expect(mig015).toContain('REVOKE EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) FROM PUBLIC;')
    expect(mig015).toContain('GRANT  EXECUTE ON FUNCTION public.create_order_secure(uuid, service_type, text, text, jsonb, text) TO authenticated;')
  })

  it('Migration 011 enforces strict address isolation and customer order reading policies', () => {
    const mig011 = fs.readFileSync(
      path.join(migrationsDir, '20260902000011_create_rls_policies.sql'),
      'utf-8'
    )

    // Addresses: profile_id = auth.uid() for both USING and WITH CHECK
    expect(mig011).toContain('CREATE POLICY "addresses_all_own" ON public.addresses')
    expect(mig011).toContain('FOR ALL USING (profile_id = auth.uid())')
    expect(mig011).toContain('WITH CHECK (profile_id = auth.uid());')

    // Orders: customer read isolation
    expect(mig011).toContain('CREATE POLICY "orders_select_own_customer" ON public.orders')
    expect(mig011).toContain('FOR SELECT USING (customer_id = auth.uid());')

    // Order items: customer read isolation
    expect(mig011).toContain('CREATE POLICY "order_items_select_customer" ON public.order_items')
    expect(mig011).toContain('WHERE o.id = order_id AND o.customer_id = auth.uid()')
  })
})
