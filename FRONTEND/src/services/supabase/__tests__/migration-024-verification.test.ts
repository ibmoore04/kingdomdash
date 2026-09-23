import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration 024: Admin Control Center Analytics & Pricing Audit Verification Suite
 * Verifies SQL structure, strict administrative authorization, fixed search_path,
 * date boundary validation, half-open interval semantics [v_start, v_end),
 * Africa/Lagos timezone grouping, fail-closed operational audit triggers,
 * payload minimization, and pricing rule deletion guards.
 */
describe('Phase 12 Migration 024 - Admin Control Center Architecture & Audit Verification', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000024_admin_control_center.sql'
  );

  it('Migration 024 file exists on disk', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const sql = fs.readFileSync(migrationPath, 'utf8');

  describe('1. Authoritative Administrative Analytics RPC (§1)', () => {
    it('defines get_admin_analytics with SECURITY DEFINER and fixed search_path', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_admin_analytics(');
      expect(sql).toContain('p_start_date timestamptz DEFAULT NULL');
      expect(sql).toContain('p_end_date   timestamptz DEFAULT NULL');
      expect(sql).toContain('RETURNS jsonb');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('SET search_path = public, pg_catalog');
    });

    it('enforces strict administrative authorization gate with KD403', () => {
      expect(sql).toContain('v_caller_role := public.get_current_user_role();');
      expect(sql).toContain("v_caller_role NOT IN ('admin', 'super_admin', 'service_role')");
      expect(sql).toContain("current_user NOT IN ('postgres', 'supabase_admin')");
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: administrative role required for analytics'");
      expect(sql).toContain("ERRCODE = 'KD403'");
    });

    it('validates date boundaries and rejects start >= end with KD400', () => {
      expect(sql).toContain('IF v_start >= v_end THEN');
      expect(sql).toContain("RAISE EXCEPTION 'Invalid date range: start date must be strictly before end date'");
      expect(sql).toContain("ERRCODE = 'KD400'");
    });

    it('enforces maximum range cap (365 days) against abusive query exhaustion', () => {
      expect(sql).toContain("(v_end - v_start) > interval '365 days'");
      expect(sql).toContain("RAISE EXCEPTION 'Invalid date range: query period exceeds maximum allowed range of 365 days'");
    });

    it('uses half-open interval [v_start, v_end) for order summary filtering', () => {
      expect(sql).toContain('created_at >= v_start AND created_at < v_end');
    });

    it('calculates total_revenue strictly from paid orders', () => {
      expect(sql).toContain("WHERE status IN ('payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered')");
    });

    it('uses Africa/Lagos timezone for daily series bucketing and completion trends', () => {
      expect(sql).toContain("timezone('Africa/Lagos', v_start)");
      expect(sql).toContain("timezone('Africa/Lagos', created_at)");
      expect(sql).toContain("'timezone', 'Africa/Lagos'");
    });

    it('uses strictly authoritative delivered_at and cancelled_at for completion trends without created_at fallback', () => {
      expect(sql).toContain("date_trunc('day', timezone('Africa/Lagos', delivered_at))::date");
      expect(sql).toContain("delivered_at IS NOT NULL");
      expect(sql).toContain("date_trunc('day', timezone('Africa/Lagos', cancelled_at))::date");
      expect(sql).toContain("cancelled_at IS NOT NULL");
    });

    it('keeps live operational metrics separate and unbounded by historical date range', () => {
      expect(sql).toContain('v_pending_orders');
      expect(sql).toContain('v_active_deliveries');
      expect(sql).toContain('v_unassigned_deliveries');
      expect(sql).toContain('v_active_riders');
      expect(sql).toContain('v_available_riders');
      expect(sql).toContain('v_refund_review_count');
      expect(sql).toContain("'live_metrics', jsonb_build_object(");
    });

    it('locks down function execution privileges to authenticated and service_role', () => {
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) FROM PUBLIC;');
      expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) FROM anon;');
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.get_admin_analytics(timestamptz, timestamptz) TO authenticated, service_role;');
    });
  });

  describe('2. Automated Pricing Audit Trigger & Deletion Guard (§2)', () => {
    it('defines format_pricing_rule_audit_payload for payload minimization', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.format_pricing_rule_audit_payload(');
      expect(sql).toContain('p_rule.base_fee');
      expect(sql).toContain('p_rule.distance_rate');
      expect(sql).toContain('p_rule.min_fee');
    });

    it('defines trg_fn_audit_delivery_pricing_rules with SECURITY DEFINER and search_path', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_fn_audit_delivery_pricing_rules()');
      expect(sql).toContain('SECURITY DEFINER');
      expect(sql).toContain('SET search_path = public, pg_catalog');
    });

    it('calls log_operational_audit_event on INSERT, UPDATE, and DELETE', () => {
      expect(sql).toContain("v_action := 'pricing_rule_created'");
      expect(sql).toContain("v_action := 'pricing_rule_updated'");
      expect(sql).toContain("v_action := 'pricing_rule_deleted'");
      expect(sql).toContain("PERFORM public.log_operational_audit_event(");
    });

    it('guards against destructive deletion of historically referenced pricing rules', () => {
      expect(sql).toContain('SELECT count(*) INTO v_order_count');
      expect(sql).toContain('FROM public.orders');
      expect(sql).toContain('WHERE pricing_rule_id = OLD.id');
      expect(sql).toContain('IF v_order_count > 0 THEN');
      expect(sql).toContain("RAISE EXCEPTION 'Cannot delete delivery pricing rule: referenced by % historical orders. Deactivate instead.'");
      expect(sql).toContain("ERRCODE = 'KD409'");
    });

    it('attaches trg_audit_delivery_pricing_rules trigger to public.delivery_pricing_rules', () => {
      expect(sql).toContain('DROP TRIGGER IF EXISTS trg_audit_delivery_pricing_rules ON public.delivery_pricing_rules;');
      expect(sql).toContain('CREATE TRIGGER trg_audit_delivery_pricing_rules');
      expect(sql).toContain('AFTER INSERT OR UPDATE OR DELETE');
      expect(sql).toContain('ON public.delivery_pricing_rules');
      expect(sql).toContain('EXECUTE FUNCTION public.trg_fn_audit_delivery_pricing_rules();');
    });
  });
});
