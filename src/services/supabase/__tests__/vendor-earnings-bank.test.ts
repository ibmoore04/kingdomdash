import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  getNigerianBanks,
  resolveBankAccount,
} from '@/services/paystack/bank'

describe('Phase 3 — Vendor Earnings & Bank Verification Portal', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261004000001_vendor_earnings_and_bank_verification.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261004000001_vendor_earnings_and_bank_verification.sql'
  )

  const rootEdgeFuncPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/paystack-resolve-bank/index.ts'
  )
  const backendEdgeFuncPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/paystack-resolve-bank/index.ts'
  )

  describe('1. Migration File Synchronization & Invariants', () => {
    it('verifies migration file exists in both root and BACKEND directories and are byte-for-byte identical', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)
      const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootSql).toBe(backendSql)
    })

    it('verifies partner_bank_accounts table definition with strict constraints', () => {
      const sql = fs.readFileSync(rootMigrationPath, 'utf8')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.partner_bank_accounts')
      expect(sql).toContain('vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id)')
      expect(sql).toContain('profile_id uuid NOT NULL REFERENCES public.profiles(id)')
      expect(sql).toContain("account_number text NOT NULL CHECK (length(account_number) = 10 AND account_number ~ '^[0-9]+$')")
      expect(sql).toContain("bank_code text NOT NULL CHECK (length(bank_code) >= 3 AND bank_code ~ '^[0-9]+$')")
      expect(sql).toContain('account_name text NOT NULL CHECK (length(account_name) >= 3)')
    })

    it('verifies strict RLS and revocation of direct client mutations', () => {
      const sql = fs.readFileSync(rootMigrationPath, 'utf8')
      expect(sql).toContain('ALTER TABLE public.partner_bank_accounts ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.partner_bank_accounts FROM anon, authenticated;')
      expect(sql).toContain('GRANT SELECT ON public.partner_bank_accounts TO authenticated, service_role;')
    })

    it('verifies save_partner_bank_account RPC enforces ownership and audit logging', () => {
      const sql = fs.readFileSync(rootMigrationPath, 'utf8')
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.save_partner_bank_account(')
      expect(sql).toContain("RAISE EXCEPTION 'Access denied: caller does not own this vendor'")
      expect(sql).toContain("vendor_bank_account_saved")
      expect(sql).toContain('is_verified    = true')
    })

    it('verifies get_vendor_earnings_summary aggregates gross revenue, net settled, and pending balances', () => {
      const sql = fs.readFileSync(rootMigrationPath, 'utf8')
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_vendor_earnings_summary(')
      expect(sql).toContain("'gross_revenue', v_gross_revenue")
      expect(sql).toContain("'net_settled', v_net_settled")
      expect(sql).toContain("'pending_balance', v_pending_balance")
      expect(sql).toContain("'total_orders', v_total_orders")
    })

    it('verifies get_vendor_settlement_statements returns immutable ledger records with line items', () => {
      const sql = fs.readFileSync(rootMigrationPath, 'utf8')
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_vendor_settlement_statements(')
      expect(sql).toContain('subtotal AS vendor_entitlement')
      expect(sql).toContain('COALESCE(o.service_fee, 150.00) AS platform_service_fee')
      expect(sql).toContain('COALESCE(op.status, CASE WHEN o.status = \'delivered\' THEN \'settled\' ELSE \'payable_pending\' END) AS settlement_status')
    })
  })

  describe('2. Paystack Bank Resolution Service & Edge Function', () => {
    it('verifies paystack-resolve-bank edge function exists in root and BACKEND and are synchronized', () => {
      expect(fs.existsSync(rootEdgeFuncPath)).toBe(true)
      expect(fs.existsSync(backendEdgeFuncPath)).toBe(true)
      const rootCode = fs.readFileSync(rootEdgeFuncPath, 'utf8')
      const backendCode = fs.readFileSync(backendEdgeFuncPath, 'utf8')
      expect(rootCode).toBe(backendCode)
      expect(rootCode).toContain('https://api.paystack.co/bank/resolve')
    })

    it('provides comprehensive list of Nigerian commercial & FinTech banks with valid codes', () => {
      const banks = getNigerianBanks()
      expect(banks.length).toBeGreaterThanOrEqual(20)

      const gtbank = banks.find((b) => b.code === '058')
      expect(gtbank).toBeDefined()
      expect(gtbank?.name).toContain('Guaranty Trust Bank')

      const zenith = banks.find((b) => b.code === '057')
      expect(zenith).toBeDefined()

      const kuda = banks.find((b) => b.code === '50211')
      expect(kuda).toBeDefined()
      expect(kuda?.name).toContain('Kuda')

      const moniepoint = banks.find((b) => b.code === '50515')
      expect(moniepoint).toBeDefined()

      const opay = banks.find((b) => b.code === '999992')
      expect(opay).toBeDefined()
    })

    it('rejects invalid account numbers prior to network transmission', async () => {
      await expect(
        resolveBankAccount({ accountNumber: '12345', bankCode: '058' })
      ).rejects.toThrow('Account number must be exactly 10 digits')

      await expect(
        resolveBankAccount({ accountNumber: '0123456789012', bankCode: '058' })
      ).rejects.toThrow('Account number must be exactly 10 digits')

      await expect(
        resolveBankAccount({ accountNumber: '0123456789', bankCode: '' })
      ).rejects.toThrow('Please select a destination bank')
    })
  })
})
