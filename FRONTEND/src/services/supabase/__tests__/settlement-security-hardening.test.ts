import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Settlement Security Hardening Patch Verification', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261010000001_settlement_security_hardening.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261010000001_settlement_security_hardening.sql'
  )
  const resolveBankFnPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/paystack-resolve-bank/index.ts'
  )
  const workerFnPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/settlement-worker/index.ts'
  )

  describe('1. Dual-Directory Migration Parity', () => {
    it('verifies 20261010000001_settlement_security_hardening.sql exists in root and BACKEND with 100% byte parity', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)

      const rootContent = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendContent = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootContent).toBe(backendContent)
    })
  })

  describe('2. Table-Level DML REVOKE (Gap 4)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('asserts explicit DML REVOKE on all core settlement ledgers', () => {
      expect(sql).toContain('REVOKE ALL ON public.order_financial_snapshots FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.order_settlement_status FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.order_payables FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.payout_transactions FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.settlement_queue FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.platform_float_control FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.platform_float_reservations FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.platform_float_ledger FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('REVOKE ALL ON public.order_refunds FROM PUBLIC, anon, authenticated;')
    })

    it('asserts selective SELECT grants and service_role administrative authority', () => {
      expect(sql).toContain('GRANT SELECT ON public.order_payables TO authenticated;')
      expect(sql).toContain('GRANT ALL ON public.order_payables TO service_role;')
      expect(sql).toContain('GRANT ALL ON public.order_financial_snapshots TO service_role;')
    })
  })

  describe('3. Terminal Order State Protection in admin_override_delivery_confirmation (Gap 3)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('asserts orders row lock and terminal state checks', () => {
      expect(sql).toContain('SELECT status INTO v_order_status FROM public.orders WHERE id = p_order_id FOR UPDATE;')
      expect(sql).toContain("v_order_status IN ('cancelled', 'refunded', 'disputed')")
      expect(sql).toContain('cannot override delivery confirmation on order in terminal state')
    })
  })

  describe('4. Deliverable State Constraint in execute_successful_delivery_confirmation (Gap 5)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('asserts fallback update is strictly bound to delivered status', () => {
      expect(sql).toContain("WHERE id = p_order_id AND status = 'delivered'")
      expect(sql).toContain('is not in a valid deliverable state for confirmation')
    })
  })

  describe('5. Authoritative Gross Derivation in claim_partner_receivable_offset (Gap 6)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('asserts gross entitlement is queried directly from the locked order_payables row', () => {
      expect(sql).toContain('SELECT gross_entitlement_kobo INTO v_authoritative_gross')
      expect(sql).toContain('FROM public.order_payables')
      expect(sql).toContain('FOR UPDATE;')
      expect(sql).toContain('Entitlement parameter mismatch')
    })
  })

  describe('6. Partner Role & Account Active Enforcement in paystack-resolve-bank (Gap 1)', () => {
    const code = fs.readFileSync(resolveBankFnPath, 'utf8')

    it('asserts unprivileged customer accounts are rejected with 403', () => {
      expect(code).toContain("select('role, is_active')")
      expect(code).toContain("!['vendor', 'rider', 'super_admin', 'admin'].includes(profile.role)")
      expect(code).toContain('status: 403')
      expect(code).toContain('bank account resolution is restricted to active registered partners and administrators')
    })
  })

  describe('7. Active Account & MFA AAL2 Enforcement in settlement-worker (Gap 2 & Gap 7)', () => {
    const code = fs.readFileSync(workerFnPath, 'utf8')

    it('asserts deactivated administrators are blocked', () => {
      expect(code).toContain("select('role, is_active')")
      expect(code).toContain('!profile.is_active')
      expect(code).toContain('active administrator privileges required')
    })

    it('asserts high-assurance MFA AAL2 is required for enrolled administrators', () => {
      expect(code).toContain('enrolledFactors.length > 0')
      expect(code).toContain("currentAal !== 'aal2'")
      expect(code).toContain('high-assurance multi-factor authentication (AAL2) required')
    })
  })
})
