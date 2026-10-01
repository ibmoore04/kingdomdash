import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  getAdminSettlementControlData,
  retryFailedSettlementJob,
  triggerSettlementWorkerRun,
} from '@/services/supabase/admin'

describe('Phase 4 — Automated Settlement Engine & Paystack Transfers API Worker', () => {
  const rootMigrationPath = path.resolve(
    __dirname,
    '../../../../supabase/migrations/20261005000001_automated_settlement_engine.sql'
  )
  const backendMigrationPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/migrations/20261005000001_automated_settlement_engine.sql'
  )

  const rootWorkerPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/settlement-worker/index.ts'
  )
  const backendWorkerPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/settlement-worker/index.ts'
  )

  const rootWebhookPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/paystack-webhook/index.ts'
  )
  const backendWebhookPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/paystack-webhook/index.ts'
  )

  const rootResolveBankPath = path.resolve(
    __dirname,
    '../../../../supabase/functions/paystack-resolve-bank/index.ts'
  )
  const backendResolveBankPath = path.resolve(
    __dirname,
    '../../../../BACKEND/supabase/functions/paystack-resolve-bank/index.ts'
  )

  describe('1. Dual-Directory Migration & Code Parity', () => {
    it('verifies migration 20261005000001 exists in both root and BACKEND and is byte-for-byte identical', () => {
      expect(fs.existsSync(rootMigrationPath)).toBe(true)
      expect(fs.existsSync(backendMigrationPath)).toBe(true)
      const rootSql = fs.readFileSync(rootMigrationPath, 'utf8')
      const backendSql = fs.readFileSync(backendMigrationPath, 'utf8')
      expect(rootSql).toBe(backendSql)
    })

    it('verifies settlement-worker Edge Function exists in both paths and is identical', () => {
      expect(fs.existsSync(rootWorkerPath)).toBe(true)
      expect(fs.existsSync(backendWorkerPath)).toBe(true)
      const rootCode = fs.readFileSync(rootWorkerPath, 'utf8')
      const backendCode = fs.readFileSync(backendWorkerPath, 'utf8')
      expect(rootCode).toBe(backendCode)
    })

    it('verifies paystack-webhook Edge Function exists in both paths and is identical', () => {
      expect(fs.existsSync(rootWebhookPath)).toBe(true)
      expect(fs.existsSync(backendWebhookPath)).toBe(true)
      const rootCode = fs.readFileSync(rootWebhookPath, 'utf8')
      const backendCode = fs.readFileSync(backendWebhookPath, 'utf8')
      expect(rootCode).toBe(backendCode)
    })

    it('verifies paystack-resolve-bank Edge Function exists in both paths and is identical', () => {
      expect(fs.existsSync(rootResolveBankPath)).toBe(true)
      expect(fs.existsSync(backendResolveBankPath)).toBe(true)
      const rootCode = fs.readFileSync(rootResolveBankPath, 'utf8')
      const backendCode = fs.readFileSync(backendResolveBankPath, 'utf8')
      expect(rootCode).toBe(backendCode)
    })
  })

  describe('2. Database Settlement Engine Specifications', () => {
    const sql = fs.readFileSync(rootMigrationPath, 'utf8')

    it('verifies recipient_code integration in save_partner_bank_account and can_disburse_payable', () => {
      expect(sql).toContain('p_recipient_code  text DEFAULT NULL')
      expect(sql).toContain('recipient_code,')
      expect(sql).toContain('v_bank_record.recipient_code')
    })

    it('implements authoritative can_disburse_payable RPC with delivery and refund guards', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.can_disburse_payable(')
      expect(sql).toContain("v_order_status != 'delivered' AND v_order_status != 'delivery_confirmed'")
      expect(sql).toContain("Order has an active refund in progress")
      expect(sql).toContain("Partner has no verified bank account on file")
      expect(sql).toContain("Partner bank account is missing Paystack transfer recipient code")
    })

    it('implements real-time platform float synchronization RPC', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.sync_platform_float_balance(')
      expect(sql).toContain('p_balance_kobo bigint')
      expect(sql).toContain('INSERT INTO public.platform_float_ledger')
    })

    it('provides HQ admin settlement control center reporting RPC', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_admin_settlement_control_data()')
      expect(sql).toContain('available_float_kobo')
      expect(sql).toContain('pending_jobs')
      expect(sql).toContain('action_required_jobs')
      expect(sql).toContain('recent_jobs')
      expect(sql).toContain('recent_payouts')
    })

    it('provides retry_failed_settlement_job RPC resetting lease and payables', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.retry_failed_settlement_job(')
      expect(sql).toContain("status = 'retry_ready'")
      expect(sql).toContain("UPDATE public.order_payables")
      expect(sql).toContain("status = 'settlement_queued'")
    })
  })

  describe('3. Paystack Worker & Transfer Reference Verification', () => {
    const workerCode = fs.readFileSync(rootWorkerPath, 'utf8')

    it('enforces 90-second lease window and maximum attempts', () => {
      expect(workerCode).toContain('Date.now() + 90000')
      expect(workerCode).toContain('max_attempts')
    })

    it('verifies float cache synchronization before reservation acquisition', () => {
      expect(workerCode).toContain('https://api.paystack.co/balance')
      expect(workerCode).toContain('sync_platform_float_balance')
      expect(workerCode).toContain('acquire_platform_float_reservation')
    })

    it('generates Paystack transfer references matching strict regex and length rules', () => {
      const generateTransferReference = (orderId: string, partyType: string, attempt: number) => {
        const cleanOrderId = orderId.replace(/-/g, '').slice(0, 16)
        const typeSlug = partyType.toLowerCase().slice(0, 6)
        return `kd_ord_${cleanOrderId}_${typeSlug}_v${attempt}`
      }

      const sampleOrderId = 'e8b82dfc-8822-4da4-8bce-d216d7a4eb31'
      const refVendor = generateTransferReference(sampleOrderId, 'vendor', 1)
      const refRider = generateTransferReference(sampleOrderId, 'rider', 2)

      const paystackRefRegex = /^[a-z0-9_-]{16,50}$/
      expect(paystackRefRegex.test(refVendor)).toBe(true)
      expect(paystackRefRegex.test(refRider)).toBe(true)
      expect(refVendor).toBe('kd_ord_e8b82dfc88224da4_vendor_v1')
      expect(refRider).toBe('kd_ord_e8b82dfc88224da4_rider_v2')
    })

    it('handles Paystack webhook events: transfer.success, transfer.failed, transfer.reversed', () => {
      const webhookCode = fs.readFileSync(rootWebhookPath, 'utf8')
      expect(webhookCode).toContain("event === 'transfer.success'")
      expect(webhookCode).toContain("event === 'transfer.failed'")
      expect(webhookCode).toContain("event === 'transfer.reversed'")
      expect(webhookCode).toContain("status: 'success'")
      expect(webhookCode).toContain("status: 'failed'")
      expect(webhookCode).toContain("status: 'reversed'")
    })
  })

  describe('4. Frontend Admin Settlement Control Service', () => {
    it('exports admin settlement control methods with correct signatures', () => {
      expect(typeof getAdminSettlementControlData).toBe('function')
      expect(typeof retryFailedSettlementJob).toBe('function')
      expect(typeof triggerSettlementWorkerRun).toBe('function')
    })
  })
})
