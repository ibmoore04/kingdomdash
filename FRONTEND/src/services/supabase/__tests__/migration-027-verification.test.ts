import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Migration 027: RLS Recursion Hardening & Final Security Review', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000027_rls_recursion_hardening.sql'
  )

  it('verifies migration 027 file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
    const content = fs.readFileSync(migrationPath, 'utf8')
    expect(content.length).toBeGreaterThan(1000)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Anti-Oracle Caller ID Security (Point 1)', () => {
    const helpers = [
      'can_customer_access_order',
      'is_current_vendor_owner',
      'can_vendor_access_order_items',
      'can_rider_access_order',
      'can_rider_access_delivery',
      'can_rider_access_assignment',
      'can_customer_access_delivery_assignment',
      'can_user_access_delivery_updates'
    ]

    helpers.forEach((fn) => {
      it(`helper ${fn} takes ONLY the resource ID and NO caller-supplied user ID parameter`, () => {
        // Must NOT take p_user_id
        expect(sql).not.toContain(`FUNCTION public.${fn}(uuid, uuid)`)
        expect(sql).not.toContain(`p_user_id`)
        // Takes exactly one uuid parameter
        expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`)
        expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}(uuid) FROM PUBLIC;`)
        expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}(uuid) FROM anon;`)
        expect(sql).toContain(`GRANT  EXECUTE ON FUNCTION public.${fn}(uuid) TO authenticated;`)
      })

      it(`helper ${fn} binds securely and directly to auth.uid()`, () => {
        const fnDef = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`))
        const endFn = fnDef.slice(0, fnDef.indexOf('$$;') + 3)
        expect(endFn).toContain('auth.uid()')
      })
    })
  })

  describe('2. Rider Assignment Status & Pre-Acceptance Privacy (Points 2 & 3)', () => {
    it('can_rider_access_order enforces accepted or completed assignment status', () => {
      const fnDef = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.can_rider_access_order'))
      const endFn = fnDef.slice(0, fnDef.indexOf('$$;') + 3)
      expect(endFn).toContain("da.status IN ('accepted', 'completed')")
    })

    it('can_rider_access_delivery enforces accepted or completed assignment status', () => {
      const fnDef = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.can_rider_access_delivery'))
      const endFn = fnDef.slice(0, fnDef.indexOf('$$;') + 3)
      expect(endFn).toContain("da.status IN ('accepted', 'completed')")
    })

    it('can_user_access_delivery_updates enforces accepted or completed assignment status for riders', () => {
      const fnDef = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.can_user_access_delivery_updates'))
      const endFn = fnDef.slice(0, fnDef.indexOf('$$;') + 3)
      expect(endFn).toContain("da.status IN ('accepted', 'completed')")
    })
  })

  describe('3. Vendor Helper Semantic Naming (Point 4)', () => {
    it('accurately names vendor store ownership helper as is_current_vendor_owner', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_current_vendor_owner(p_vendor_id uuid)')
      expect(sql).toContain('public.is_current_vendor_owner(vendor_id)')
    })
  })

  describe('4. Elimination of 42P17 Mutual Recursion Loops (Point 5)', () => {
    it('orders policies contain zero subqueries into deliveries or assignments with active RLS', () => {
      const ordersSection = sql.slice(sql.indexOf('-- ── 4.1 public.orders'), sql.indexOf('-- ── 4.2 public.deliveries'))
      expect(ordersSection).not.toContain('FROM public.deliveries')
      expect(ordersSection).not.toContain('FROM public.delivery_assignments')
      expect(ordersSection).toContain('public.can_rider_access_order(id)')
    })

    it('deliveries policies contain zero subqueries into orders with active RLS', () => {
      const deliveriesSection = sql.slice(sql.indexOf('-- ── 4.2 public.deliveries'), sql.indexOf('-- ── 4.3 public.delivery_assignments'))
      expect(deliveriesSection).not.toContain('FROM public.orders')
      expect(deliveriesSection).not.toContain('FROM public.delivery_assignments')
      expect(deliveriesSection).toContain('public.can_customer_access_order(order_id)')
      expect(deliveriesSection).toContain('public.can_rider_access_delivery(id)')
    })

    it('delivery_assignments policies contain zero subqueries into deliveries or orders', () => {
      const assignmentsSection = sql.slice(sql.indexOf('-- ── 4.3 public.delivery_assignments'), sql.indexOf('-- ── 4.4 public.order_items'))
      expect(assignmentsSection).not.toContain('FROM public.deliveries')
      expect(assignmentsSection).not.toContain('FROM public.orders')
      expect(assignmentsSection).toContain('public.can_customer_access_delivery_assignment(delivery_id)')
      expect(assignmentsSection).toContain('public.can_rider_access_assignment(rider_id)')
    })

    it('order_items policies contain zero subqueries into deliveries or orders with active RLS', () => {
      const orderItemsSection = sql.slice(sql.indexOf('-- ── 4.4 public.order_items'), sql.indexOf('-- ── 4.5 public.payments'))
      expect(orderItemsSection).not.toContain('FROM public.deliveries')
      expect(orderItemsSection).not.toContain('FROM public.orders')
      expect(orderItemsSection).toContain('public.can_customer_access_order(order_id)')
      expect(orderItemsSection).toContain('public.can_vendor_access_order_items(order_id)')
      expect(orderItemsSection).toContain('public.can_rider_access_order(order_id)')
    })

    it('payments policies contain zero subqueries into orders with active RLS', () => {
      const paymentsSection = sql.slice(sql.indexOf('-- ── 4.5 public.payments'), sql.indexOf('-- ── 4.6 public.delivery_status_updates'))
      expect(paymentsSection).not.toContain('FROM public.orders')
      expect(paymentsSection).toContain('customer_id = auth.uid()')
      expect(paymentsSection).toContain('public.can_customer_access_order(order_id)')
    })

    it('delivery_status_updates policies contain zero subqueries into deliveries with active RLS', () => {
      const updatesSection = sql.slice(sql.indexOf('-- ── 4.6 public.delivery_status_updates'))
      expect(updatesSection).not.toContain('FROM public.deliveries')
      expect(updatesSection).toContain('public.can_user_access_delivery_updates(delivery_id)')
    })
  })

  describe('5. SECURITY DEFINER Review (Point 6)', () => {
    it('verifies every helper function has STABLE, SECURITY DEFINER, search_path, and returns boolean', () => {
      const helpers = [
        'can_customer_access_order',
        'is_current_vendor_owner',
        'can_vendor_access_order_items',
        'can_rider_access_order',
        'can_rider_access_delivery',
        'can_rider_access_assignment',
        'can_customer_access_delivery_assignment',
        'can_user_access_delivery_updates'
      ]

      helpers.forEach((fn) => {
        expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`)
        const fnDef = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`))
        const endFn = fnDef.slice(0, fnDef.indexOf('$$;') + 3)
        expect(endFn).toContain('RETURNS boolean')
        expect(endFn).toContain('STABLE')
        expect(endFn).toContain('SECURITY DEFINER')
        expect(endFn).toContain('SET search_path = public, pg_catalog')
      })
    })
  })

  describe('6. Tenant Isolation & Access Model Preservation (Points 7, 8, 9)', () => {
    it('customer access is preserved and isolated to own records', () => {
      expect(sql).toContain('customer_id = auth.uid()')
      expect(sql).toContain('WHERE o.id = p_order_id\n      AND o.customer_id = auth.uid()')
    })

    it('vendor access is preserved and isolated to own store profile', () => {
      expect(sql).toContain('WHERE v.id = p_vendor_id\n      AND v.profile_id = auth.uid()')
    })

    it('rider access is preserved and isolated to legitimate assignments', () => {
      expect(sql).toContain('WHERE r.id = p_rider_id\n      AND r.profile_id = auth.uid()')
    })

    it('admin access is preserved across all operational tables', () => {
      expect(sql).toContain("public.get_current_user_role() IN ('admin', 'super_admin')")
    })
  })
})
