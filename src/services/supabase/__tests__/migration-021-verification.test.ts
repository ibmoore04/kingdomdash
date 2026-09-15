import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Phase 11 Migration 021 Rider Platform Architecture & Security Verification Suite
 * Verifies SQL structure, server-side pre-acceptance privacy projections,
 * tightened RLS policies, offline-by-default availability, non-mutating issue reporting,
 * and security grants in 20260902000021_rider_platform.sql.
 */
describe('Phase 11 - Migration 021 Rider Platform Architecture & Security Suite', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000021_rider_platform.sql'
  )

  it('migration 021 file exists on disk', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Schema Adjustments & Composite Indexes (§1)', () => {
    it('sets riders.is_available default to false (offline by default)', () => {
      expect(sql).toContain('ALTER TABLE public.riders ALTER COLUMN is_available SET DEFAULT false;')
    })

    it('creates composite performance index for rider assignments', () => {
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_delivery_assignments_rider_status')
      expect(sql).toContain('ON public.delivery_assignments (rider_id, status);')
    })
  })

  describe('2. Tightened Post-Acceptance Direct RLS Policies (§2)', () => {
    it('restricts deliveries_select_rider to accepted and completed assignments only', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "deliveries_select_rider" ON public.deliveries;')
      expect(sql).toContain('CREATE POLICY "deliveries_select_rider" ON public.deliveries')
      expect(sql).toContain("AND da.status IN ('accepted', 'completed')")
    })

    it('restricts orders_select_rider to accepted and completed assignments only', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "orders_select_rider" ON public.orders;')
      expect(sql).toContain('CREATE POLICY "orders_select_rider" ON public.orders')
      expect(sql).toContain("AND da.status IN ('accepted', 'completed')")
    })

    it('restricts order_items_select_rider to accepted and completed assignments only', () => {
      expect(sql).toContain('DROP POLICY IF EXISTS "order_items_select_rider" ON public.order_items;')
      expect(sql).toContain('CREATE POLICY "order_items_select_rider" ON public.order_items')
      expect(sql).toContain("AND da.status IN ('accepted', 'completed')")
    })
  })

  describe('3. Server-Side Controlled Read Projections (§3)', () => {
    describe('3.1 get_rider_assignment_inbox()', () => {
      it('is defined with SECURITY DEFINER and search_path hardening', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_rider_assignment_inbox()')
        expect(sql).toContain('SECURITY DEFINER')
        expect(sql).toContain('SET search_path = public, pg_catalog')
      })

      it('guarantees server-side privacy by excluding customer PII and exact destination coords', () => {
        // Find function block
        const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_rider_assignment_inbox()')
        const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()')
        const inboxSql = sql.slice(start, end)

        // General neighborhood extracted
        expect(inboxSql).toContain("split_part(d.delivery_address, ',', 1)")
        // Distance calculated
        expect(inboxSql).toContain('public.calculate_distance_km(')
        // Privacy checks: must not select customer_name or customer_phone
        expect(inboxSql).not.toContain("'customer_name', d.customer_name")
        expect(inboxSql).not.toContain("'customer_phone', d.customer_phone")
        expect(inboxSql).not.toContain("'delivery_latitude', d.delivery_latitude")
        expect(inboxSql).not.toContain("'delivery_longitude', d.delivery_longitude")
      })
    })

    describe('3.2 get_rider_active_delivery()', () => {
      it('is defined with SECURITY DEFINER and filters strictly for accepted active deliveries', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()')
        expect(sql).toContain("da.status = 'accepted'")
        expect(sql).toContain("d.status IN ('assigned', 'picked_up', 'in_transit')")
      })

      it('unmasks customer contact and line items only after acceptance', () => {
        const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_rider_active_delivery()')
        const end = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_rider_delivery_history(')
        const activeSql = sql.slice(start, end)

        expect(activeSql).toContain("'customer_name', d.customer_name")
        expect(activeSql).toContain("'customer_phone', d.customer_phone")
        expect(activeSql).toContain("'delivery_latitude', d.delivery_latitude")
        expect(activeSql).toContain("'delivery_longitude', d.delivery_longitude")
        expect(activeSql).toContain('public.order_items oi')
      })
    })

    describe('3.3 get_rider_delivery_history()', () => {
      it('returns completed deliveries with pagination limit and offset', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_rider_delivery_history(')
        expect(sql).toContain("da.status = 'completed'")
        expect(sql).toContain('LEAST(p_limit, 50) OFFSET GREATEST(p_offset, 0)')
      })
    })

    describe('3.4 get_rider_operational_profile()', () => {
      it('returns profile, vehicle info, and counts active in-flight deliveries', () => {
        expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_rider_operational_profile()')
        expect(sql).toContain("'active_in_flight_count'")
        expect(sql).toContain("da.status = 'accepted'")
      })
    })
  })

  describe('4. Hardened Rider Availability RPC (§4)', () => {
    it('replaces update_rider_availability with row lock and verification checks', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_rider_availability(')
      expect(sql).toContain('FOR UPDATE;')
      expect(sql).toContain('IF p_is_available AND NOT (v_rider.is_verified AND v_rider.is_active) THEN')
      expect(sql).toContain("USING ERRCODE = 'KD403';")
    })

    it('rejects going online if an active delivery is currently in flight', () => {
      expect(sql).toContain('IF p_is_available THEN')
      expect(sql).toContain("da.status = 'accepted'")
      expect(sql).toContain("d.status IN ('assigned', 'picked_up', 'in_transit')")
      expect(sql).toContain('IF v_in_flight > 0 THEN')
      expect(sql).toContain("RAISE EXCEPTION 'Cannot become available while active delivery is in flight' USING ERRCODE = 'KD409';")
    })

    it('updates updated_at and records rider_availability_updated audit log', () => {
      expect(sql).toContain('updated_at   = pg_catalog.now()')
      expect(sql).toContain("'rider_availability_updated'")
    })
  })

  describe('5. Operational Issue Reporting RPC (§5)', () => {
    it('creates report_delivery_issue RPC with issue type validation', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.report_delivery_issue(')
      expect(sql).toContain("ARRAY['customer_unreachable', 'vendor_delay', 'address_issue', 'vehicle_breakdown', 'traffic_delay', 'other']")
      expect(sql).toContain("USING ERRCODE = 'KD400';")
    })

    it('enforces row lock on deliveries and verifies caller holds active accepted assignment', () => {
      expect(sql).toContain('FOR SHARE;')
      expect(sql).toContain("da.status = 'accepted'")
      expect(sql).toContain("USING ERRCODE = 'KD403';")
    })

    it('inserts non-mutating breadcrumb into delivery_status_updates without changing delivery status', () => {
      expect(sql).toContain('INSERT INTO public.delivery_status_updates (')
      expect(sql).toContain('v_delivery.status,')
      expect(sql).toContain("notes,")
      expect(sql).toContain("'[EXCEPTION: ' || p_issue_type || '] ' || COALESCE(p_notes, '')")
    })

    it('records delivery_issue_reported operational audit event', () => {
      expect(sql).toContain("'delivery_issue_reported'")
      expect(sql).toContain("'issue_type', p_issue_type")
    })
  })

  describe('6. Grants & Revokes Security (§§1-5)', () => {
    it('revokes execute on all RPCs from PUBLIC and grants only to authenticated', () => {
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_rider_assignment_inbox() FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.get_rider_assignment_inbox() TO authenticated;')

      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_rider_active_delivery() FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.get_rider_active_delivery() TO authenticated;')

      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.get_rider_delivery_history(integer, integer) TO authenticated;')

      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_rider_operational_profile() FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.get_rider_operational_profile() TO authenticated;')

      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.update_rider_availability(boolean) FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.update_rider_availability(boolean) TO authenticated;')

      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.report_delivery_issue(uuid, text, text) FROM PUBLIC;')
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.report_delivery_issue(uuid, text, text) TO authenticated;')
    })
  })
})
