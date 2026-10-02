import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

describe('Settlement Engine Gap 5 & 6 — Webhook Persistence & In-Flight Transfer Recovery', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261008000001_paystack_webhook_events_ledger.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261008000001_paystack_webhook_events_ledger.sql'
  )

  const rootWebhookPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/paystack-webhook/index.ts'
  )
  const backendWebhookPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/paystack-webhook/index.ts'
  )

  const rootWorkerPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/settlement-worker/index.ts'
  )
  const backendWorkerPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/settlement-worker/index.ts'
  )

  describe('1. Dual-Directory Parity', () => {
    it('verifies migration 20261008000001 exists in both root and BACKEND and is byte-for-byte identical', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)
      const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootSql).toBe(backendSql)
    })

    it('verifies paystack-webhook edge function is byte-for-byte identical between root and BACKEND', () => {
      expect(fs.existsSync(rootWebhookPath)).toBe(true)
      expect(fs.existsSync(backendWebhookPath)).toBe(true)
      const rootCode = fs.readFileSync(rootWebhookPath, 'utf8')
      const backendCode = fs.readFileSync(backendWebhookPath, 'utf8')
      expect(rootCode).toBe(backendCode)
    })

    it('verifies settlement-worker edge function is byte-for-byte identical between root and BACKEND', () => {
      expect(fs.existsSync(rootWorkerPath)).toBe(true)
      expect(fs.existsSync(backendWorkerPath)).toBe(true)
      const rootCode = fs.readFileSync(rootWorkerPath, 'utf8')
      const backendCode = fs.readFileSync(backendWorkerPath, 'utf8')
      expect(rootCode).toBe(backendCode)
    })
  })

  describe('2. Paystack Webhook Durable Events Schema (§11)', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('creates public.paystack_webhook_events table with unique fingerprint', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.paystack_webhook_events')
      expect(sql).toContain('event_fingerprint text NOT NULL UNIQUE')
      expect(sql).toContain('event_type text NOT NULL')
      expect(sql).toContain('payload jsonb NOT NULL')
      expect(sql).toContain('processed boolean NOT NULL DEFAULT false')
    })

    it('indexes fingerprint and transfer codes for rapid lookup', () => {
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_paystack_webhook_fingerprint ON public.paystack_webhook_events(event_fingerprint)')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_paystack_webhook_transfer_code ON public.paystack_webhook_events(transfer_code)')
    })
  })

  describe('3. Webhook Deduplication & Fingerprint Generation (§11)', () => {
    const webhookCode = fs.readFileSync(rootWebhookPath, 'utf8')

    it('generates SHA-256 composite fingerprint and inserts into paystack_webhook_events', () => {
      expect(webhookCode).toContain("crypto.subtle.digest('SHA-256'")
      expect(webhookCode).toContain("from('paystack_webhook_events')")
      expect(webhookCode).toContain('event_fingerprint: eventFingerprint')
    })

    it('gracefully handles duplicate event replay with HTTP 200 OK', () => {
      expect(webhookCode).toContain("insertErr.code === '23505'")
      expect(webhookCode).toContain('Event already recorded and processed')
    })
  })

  describe('4. In-Flight Transfer Verification & Attempt Versioning (§4, §8)', () => {
    const workerCode = fs.readFileSync(rootWorkerPath, 'utf8')

    it('inspects previous attempts and implements GET /transfer/verify recovery before retrying', () => {
      expect(workerCode).toContain("from('payout_transactions')")
      expect(workerCode).toContain('https://api.paystack.co/transfer/verify/')
      expect(workerCode).toContain("latestTx && latestTx.status === 'pending'")
      expect(workerCode).toContain("status: 'settled'")
    })

    it('dynamically increments attempt_number on subsequent retries', () => {
      expect(workerCode).toContain('const attemptNum = (latestTx?.attempt_number || 0) + 1')
      expect(workerCode).toContain('`kd_ord_${cleanOrderId.slice(0, 20)}_${typeAbbr}_v${attemptNum}`')
    })
  })
})
