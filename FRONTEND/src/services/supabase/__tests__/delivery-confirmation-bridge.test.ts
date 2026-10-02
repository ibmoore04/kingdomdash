import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Settlement Engine Gap 1 & 2 — Delivery Confirmation & Settlement Queue Bridge', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261006000001_delivery_confirmation_and_settlement_bridge.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261006000001_delivery_confirmation_and_settlement_bridge.sql'
  )

  describe('1. Dual-Directory Parity', () => {
    it('verifies migration 20261006000001 exists in both root and BACKEND and is byte-for-byte identical', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)
      const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootSql).toBe(backendSql)
    })
  })

  describe('2. Delivery Confirmations Schema & Constraints (§12)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('creates public.delivery_confirmations table with required security fields', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.delivery_confirmations')
      expect(sql).toContain('order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE')
      expect(sql).toContain('pin_hash text NOT NULL')
      expect(sql).toContain('attempt_count integer NOT NULL DEFAULT 0')
      expect(sql).toContain('max_attempts integer NOT NULL DEFAULT 3')
      expect(sql).toContain("CHECK (verification_status IN ('pending', 'verified', 'locked_exhausted', 'admin_overridden'))")
    })

    it('enforces strict RLS and access control', () => {
      expect(sql).toContain('ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('REVOKE ALL ON public.delivery_confirmations FROM PUBLIC, anon, authenticated;')
      expect(sql).toContain('GRANT SELECT, INSERT, UPDATE ON public.delivery_confirmations TO service_role;')
    })
  })

  describe('3. Authoritative Transition RPCs (§12)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('implements execute_successful_delivery_confirmation with atomic status and settlement queue enqueuing', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.execute_successful_delivery_confirmation(')
      expect(sql).toContain("status = 'delivery_confirmed'")
      expect(sql).toContain("verification_status = 'verified'")
      expect(sql).toContain("status = 'settlement_queued'")
      expect(sql).toContain('INSERT INTO public.settlement_queue (order_id, status')
    })

    it('implements record_failed_pin_attempt with 3-attempt lockout', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.record_failed_pin_attempt(')
      expect(sql).toContain('v_new_attempts >= v_rec.max_attempts')
      expect(sql).toContain("verification_status = 'locked_exhausted'")
    })

    it('implements admin_override_delivery_confirmation with audit trail', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.admin_override_delivery_confirmation(')
      expect(sql).toContain("verification_status = 'admin_overridden'")
      expect(sql).toContain('delivery_confirmation_admin_override')
      expect(sql).toContain("A substantive override reason (minimum 5 characters) is required")
    })
  })

  describe('4. Automated Settlement Queue Bridge Trigger (§1 & §12)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('implements trg_order_delivery_settlement_bridge on public.orders', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_order_delivery_settlement_bridge()')
      expect(sql).toContain("NEW.status IN ('delivered', 'delivery_confirmed')")
      expect(sql).toContain("UPDATE public.order_payables")
      expect(sql).toContain("SET status = 'settlement_queued'")
      expect(sql).toContain("INSERT INTO public.settlement_queue (order_id, status")
      expect(sql).toContain("CREATE TRIGGER trg_order_delivery_settlement_bridge")
    })

    it('implements trg_sync_order_delivery_confirmation to auto-provision confirmation records', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.trg_sync_order_delivery_confirmation()')
      expect(sql).toContain('INSERT INTO public.delivery_confirmations')
      expect(sql).toContain('CREATE TRIGGER trg_sync_order_delivery_confirmation')
    })
  })
})
