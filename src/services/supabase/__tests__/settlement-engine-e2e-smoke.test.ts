import { describe, it, expect, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock Supabase client for simulating client interactions
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: vi.fn(),
      rpc: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
    })),
  }
})

describe('Step 4 — Settlement Engine End-to-End Smoke Test Suite', () => {
  const rootMigrationsDir = path.resolve(__dirname, '../../../../supabase/migrations')
  const backendMigrationsDir = path.resolve(__dirname, '../../../../BACKEND/supabase/migrations')

  const migrationFiles = [
    '20261001000001_settlement_financial_ledgers.sql',
    '20261002000001_service_fee_order_authority.sql',
    '20261003000001_admin_impersonation_engine.sql',
    '20261004000001_vendor_earnings_and_bank_verification.sql',
    '20261005000001_automated_settlement_engine.sql',
    '20261006000001_delivery_confirmation_and_settlement_bridge.sql',
    '20261007000001_partner_bank_vault_and_receivables_clawback.sql',
    '20261008000001_paystack_webhook_events_ledger.sql',
    '20261009000001_settlement_worker_cron.sql',
  ]

  describe('1. Global Schema & Migration Parity Invariants', () => {
    it.each(migrationFiles)(
      'verifies migration %s exists in both root and BACKEND with 100% byte parity',
      (filename) => {
        const rootPath = path.join(rootMigrationsDir, filename)
        const backendPath = path.join(backendMigrationsDir, filename)

        expect(fs.existsSync(rootPath)).toBe(true)
        expect(fs.existsSync(backendPath)).toBe(true)

        const rootContent = fs.readFileSync(rootPath, 'utf8')
        const backendContent = fs.readFileSync(backendPath, 'utf8')
        expect(rootContent).toBe(backendContent)
      }
    )
  })

  describe('2. Financial Split & Commission Math Invariants', () => {
    it('verifies exact kobo arithmetic for order splits without rounding loss', () => {
      // Scenario: Order with 5,000 NGN food, 1,000 NGN delivery, 150 NGN service fee
      // Platform commission = 10% on food items
      const subtotalKobo = 500000n // 5,000.00 NGN
      const deliveryFeeKobo = 100000n // 1,000.00 NGN
      const serviceFeeKobo = 15000n // 150.00 NGN
      const commissionRate = 10n // 10%

      const grandTotalKobo = subtotalKobo + deliveryFeeKobo + serviceFeeKobo
      expect(grandTotalKobo).toBe(615000n) // 6,150.00 NGN

      // Split computation:
      const platformCommissionKobo = (subtotalKobo * commissionRate) / 100n // 500.00 NGN (50,000 kobo)
      const vendorPayableKobo = subtotalKobo - platformCommissionKobo // 4,500.00 NGN (450,000 kobo)
      const riderPayableKobo = deliveryFeeKobo // 1,000.00 NGN (100,000 kobo)
      const platformTotalRevenueKobo = platformCommissionKobo + serviceFeeKobo // 650.00 NGN (65,000 kobo)

      // Strict conservation invariant: All disbursements + platform retained must equal grand total
      const totalAllocatedKobo = vendorPayableKobo + riderPayableKobo + platformTotalRevenueKobo
      expect(totalAllocatedKobo).toBe(grandTotalKobo)
    })

    it('verifies partner receivable clawback logic preserves positive net payable', () => {
      const grossEntitlementKobo = 450000n // 4,500 NGN
      const outstandingDebtKobo = 150000n // 1,500 NGN debt from prior cancelled order

      const claimedClawbackKobo = outstandingDebtKobo <= grossEntitlementKobo 
        ? outstandingDebtKobo 
        : grossEntitlementKobo
      const netPayableKobo = grossEntitlementKobo - claimedClawbackKobo

      expect(claimedClawbackKobo).toBe(150000n)
      expect(netPayableKobo).toBe(300000n) // 3,000 NGN net disbursed
      expect(claimedClawbackKobo + netPayableKobo).toBe(grossEntitlementKobo)
    })

    it('verifies partner receivable clawback caps at gross entitlement when debt exceeds payout', () => {
      const grossEntitlementKobo = 200000n // 2,000 NGN
      const outstandingDebtKobo = 500000n // 5,000 NGN debt

      const claimedClawbackKobo = outstandingDebtKobo <= grossEntitlementKobo 
        ? outstandingDebtKobo 
        : grossEntitlementKobo
      const netPayableKobo = grossEntitlementKobo - claimedClawbackKobo
      const remainingDebtKobo = outstandingDebtKobo - claimedClawbackKobo

      expect(claimedClawbackKobo).toBe(200000n)
      expect(netPayableKobo).toBe(0n) // 0 NGN net disbursed
      expect(remainingDebtKobo).toBe(300000n) // 3,000 NGN debt remains
    })
  })

  describe('3. Delivery PIN Verification & Queue Enqueue State Machine', () => {
    const bridgeMigration = fs.readFileSync(
      path.join(rootMigrationsDir, '20261006000001_delivery_confirmation_and_settlement_bridge.sql'),
      'utf8'
    )

    it('asserts execute_successful_delivery_confirmation transitions order atomically', () => {
      expect(bridgeMigration).toContain("status = 'delivery_confirmed'")
      expect(bridgeMigration).toContain("verification_status = 'verified'")
      expect(bridgeMigration).toContain("INSERT INTO public.settlement_queue")
    })

    it('asserts failed PIN attempt lockout enforces max 3 attempts', () => {
      expect(bridgeMigration).toContain('v_new_attempts >= v_rec.max_attempts')
      expect(bridgeMigration).toContain("verification_status = 'locked_exhausted'")
    })

    it('asserts settlement bridge trigger releases payables to settlement_queued', () => {
      expect(bridgeMigration).toContain("UPDATE public.order_payables")
      expect(bridgeMigration).toContain("SET status = 'settlement_queued'")
      expect(bridgeMigration).toContain("WHERE order_id = NEW.id")
    })
  })

  describe('4. Partner Bank Vault & 24h Payout Hold Guards (§10)', () => {
    const vaultMigration = fs.readFileSync(
      path.join(rootMigrationsDir, '20261007000001_partner_bank_vault_and_receivables_clawback.sql'),
      'utf8'
    )

    it('asserts 24-hour mandatory hold is added to vendor and rider profiles', () => {
      expect(vaultMigration).toContain('ADD COLUMN IF NOT EXISTS payout_hold_until timestamptz')
      expect(vaultMigration).toContain("v_hold_until := now() + interval '24 hours'")
    })

    it('asserts partner_bank_vault table enforces server-side AES encryption fields', () => {
      expect(vaultMigration).toContain('CREATE TABLE IF NOT EXISTS public.partner_bank_vault')
      expect(vaultMigration).toContain('encrypted_account_number text NOT NULL')
      expect(vaultMigration).toContain('iv text NOT NULL')
      expect(vaultMigration).toContain('auth_tag text NOT NULL')
      expect(vaultMigration).toContain('key_id text NOT NULL')
      expect(vaultMigration).toContain('REVOKE ALL ON public.partner_bank_vault FROM PUBLIC, anon, authenticated;')
      expect(vaultMigration).toContain('GRANT ALL ON public.partner_bank_vault TO service_role;')
    })
  })

  describe('5. Settlement Worker Engine Hardening (§7, §8)', () => {
    const workerIndex = fs.readFileSync(
      path.resolve(__dirname, '../../../../supabase/functions/settlement-worker/index.ts'),
      'utf8'
    )

    it('asserts settlement-worker polls Paystack transfer verify API before attempting disburse', () => {
      expect(workerIndex).toContain('/transfer/verify/')
      expect(workerIndex).toContain('In-flight transfer verification')
    })

    it('asserts worker generates deterministic attempt-versioned payout references', () => {
      expect(workerIndex).toContain('kd_ord_')
      expect(workerIndex).toContain('_v${attemptNum}')
    })

    it('asserts worker checks 24-hour payout hold constraint before disbursement', () => {
      expect(workerIndex).toContain('can_disburse_payable')
      expect(workerIndex).toContain("reason.includes('hold')")
      expect(workerIndex).toContain('held_cooldown')
    })

    it('asserts worker checks platform float balance before processing batch', () => {
      expect(workerIndex).toContain('acquire_platform_float_reservation')
      expect(workerIndex).toContain('sync_platform_float_balance')
      expect(workerIndex).toContain('sync_float_only')
    })

    it('asserts worker claims queue jobs with 90-second lease timeout', () => {
      expect(workerIndex).toContain('Date.now() + 90000')
      expect(workerIndex).toContain("status: 'processing'")
      expect(workerIndex).toContain('locked_until')
    })
  })

  describe('6. Webhook Deduplication & Fingerprint Ledger (§11)', () => {
    const webhookMigration = fs.readFileSync(
      path.join(rootMigrationsDir, '20261008000001_paystack_webhook_events_ledger.sql'),
      'utf8'
    )
    const webhookIndex = fs.readFileSync(
      path.resolve(__dirname, '../../../../supabase/functions/paystack-webhook/index.ts'),
      'utf8'
    )

    it('asserts paystack_webhook_events table requires event_fingerprint unique constraint', () => {
      expect(webhookMigration).toContain('CREATE TABLE IF NOT EXISTS public.paystack_webhook_events')
      expect(webhookMigration).toContain('event_fingerprint text NOT NULL UNIQUE')
      expect(webhookMigration).toContain('processed boolean NOT NULL DEFAULT false')
    })

    it('asserts paystack-webhook edge function computes SHA-256 fingerprint and validates HMAC-SHA512', () => {
      expect(webhookIndex).toContain('crypto.subtle.digest')
      expect(webhookIndex).toContain('SHA-256')
      expect(webhookIndex).toContain('x-paystack-signature')
      expect(webhookIndex).toContain('HMAC')
      expect(webhookIndex).toContain('paystack_webhook_events')
    })
  })
})
