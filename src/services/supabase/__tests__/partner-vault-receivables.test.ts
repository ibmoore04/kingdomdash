import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Settlement Engine Gap 3 & 4 — Partner Bank Vault, 24h Cooldown & Debt Receivables', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261007000001_partner_bank_vault_and_receivables_clawback.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261007000001_partner_bank_vault_and_receivables_clawback.sql'
  )

  describe('1. Dual-Directory Parity', () => {
    it('verifies migration 20261007000001 exists in both root and BACKEND and is byte-for-byte identical', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)
      const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootSql).toBe(backendSql)
    })
  })

  describe('2. Partner Bank Vault AES-256-GCM Schema (§10)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('creates isolated public.partner_bank_vault with cryptographic envelope', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.partner_bank_vault')
      expect(sql).toContain('encrypted_account_number text NOT NULL')
      expect(sql).toContain('iv text NOT NULL')
      expect(sql).toContain('auth_tag text NOT NULL')
      expect(sql).toContain("key_id text NOT NULL DEFAULT 'v1'")
    })

    it('strictly revokes public, anon, and authenticated access to the vault', () => {
      expect(sql).toContain('REVOKE ALL ON public.partner_bank_vault FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('GRANT ALL ON public.partner_bank_vault TO service_role;')
    })
  })

  describe('3. 24-Hour Payout Hold Cooldown & update_partner_bank_details RPC (§10)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('adds payout_hold_until and multi-stage bank status columns to vendors and riders', () => {
      expect(sql).toContain('ALTER TABLE public.vendors')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz')
      expect(sql).toContain('ALTER TABLE public.riders')
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz')
    })

    it('implements update_partner_bank_details enforcing 24h cooldown and zero plaintext audit logging', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.update_partner_bank_details(')
      expect(sql).toContain("now() + interval '24 hours'")
      expect(sql).toContain('update_partner_bank_details')
      expect(sql).toContain('masked_account')
    })
  })

  describe('4. Partner Receivables & Recovery Logs (§9)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('creates public.partner_receivables and public.receivable_recovery_logs tables', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.partner_receivables')
      expect(sql).toContain('initial_debt_kobo bigint NOT NULL CHECK (initial_debt_kobo > 0)')
      expect(sql).toContain('remaining_debt_kobo bigint NOT NULL CHECK (remaining_debt_kobo >= 0)')
      expect(sql).toContain("CHECK (status IN ('outstanding', 'partially_recovered', 'fully_cleared', 'written_off'))")

      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.receivable_recovery_logs')
      expect(sql).toContain('pre_recovery_debt_kobo bigint NOT NULL')
      expect(sql).toContain('claimed_amount_kobo bigint NOT NULL CHECK (claimed_amount_kobo > 0)')
      expect(sql).toContain('post_recovery_debt_kobo bigint NOT NULL CHECK (post_recovery_debt_kobo >= 0)')
    })

    it('implements claim_partner_receivable_offset RPC with partner-level row serialization', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.claim_partner_receivable_offset(')
      expect(sql).toContain('PERFORM 1 FROM public.profiles WHERE id = p_partner_id FOR UPDATE;')
      expect(sql).toContain('INSERT INTO public.receivable_recovery_logs')
      expect(sql).toContain("status = CASE WHEN (p_gross_entitlement_kobo - v_total_claimed) = 0 THEN 'clawback_offset' ELSE status END")
    })
  })
})
