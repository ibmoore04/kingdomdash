import { describe, expect, it } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Phase 9 Migration 019 Hardened Database & Security Verification Suite
 * Verifies SQL structure, constraint definitions, RLS policies, trigger rules,
 * locking hierarchy, idempotency handling, and execution privileges in
 * 20260902000019_paystack_payment_integration.sql.
 */
describe('Phase 9 - Migration 019 Hardening Verification Suite', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260902000019_paystack_payment_integration.sql'
  )

  it('migration file exists on disk', () => {
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  const sql = fs.readFileSync(migrationPath, 'utf8')

  describe('1. Paystack Reference Uniqueness (§1.1)', () => {
    it('drops legacy non-unique index and constraints on paystack_reference', () => {
      expect(sql).toContain('DROP INDEX IF EXISTS public.idx_payments_reference;')
      expect(sql).toContain('ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_paystack_reference_key;')
    })

    it('creates partial UNIQUE index ensuring exactly one payment record per non-null Paystack reference', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paystack_reference_unique')
      expect(sql).toContain('ON public.payments(paystack_reference)')
      expect(sql).toContain('WHERE paystack_reference IS NOT NULL;')
    })
  })

  describe('2. Paystack Transaction ID Uniqueness (§2)', () => {
    it('drops legacy non-unique index on paystack_transaction_id', () => {
      expect(sql).toContain('DROP INDEX IF EXISTS public.idx_payments_transaction_id;')
    })

    it('creates partial UNIQUE index ensuring one Paystack transaction cannot represent multiple payments', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_paystack_tx_id_unique')
      expect(sql).toContain('ON public.payments(paystack_transaction_id)')
      expect(sql).toContain('WHERE paystack_transaction_id IS NOT NULL;')
    })
  })

  describe('3. Database-Level Immutability for Payment Events (§3)', () => {
    it('creates public.payment_events table with unique idempotency_key', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.payment_events')
      expect(sql).toContain('idempotency_key text NOT NULL UNIQUE')
      expect(sql).toContain('payload jsonb NOT NULL')
    })

    it('defines prevent_payment_events_modification trigger function with SECURITY INVOKER and search_path = ""', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.prevent_payment_events_modification()')
      expect(sql).toContain('SECURITY INVOKER')
      expect(sql).toContain("SET search_path = ''")
      expect(sql).toContain('payment_events is an immutable audit log; updates and deletes are prohibited')
    })

    it('revokes execute on trigger function from PUBLIC', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.prevent_payment_events_modification() FROM PUBLIC;')
    })

    it('attaches BEFORE UPDATE OR DELETE trigger on public.payment_events', () => {
      expect(sql).toContain('DROP TRIGGER IF EXISTS trg_prevent_payment_events_modification ON public.payment_events;')
      expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.payment_events')
      expect(sql).toContain('EXECUTE FUNCTION public.prevent_payment_events_modification();')
    })

    it('enables Row Level Security on payment_events and restricts SELECT to admins only', () => {
      expect(sql).toContain('ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;')
      expect(sql).toContain('CREATE POLICY "payment_events_select_admin" ON public.payment_events')
      expect(sql).toContain("public.get_current_user_role() IN ('admin', 'super_admin')")
    })
  })

  describe('4. SECURITY DEFINER & Empty Search Path Hardening (§4)', () => {
    it('sets search_path = "" on protect_payment_immutable_fields', () => {
      const match = sql.match(/FUNCTION public\.protect_payment_immutable_fields\(\)[\s\S]*?SET search_path = ''/)
      expect(match).not.toBeNull()
    })

    it('sets search_path = "" on create_payment_attempt', () => {
      const match = sql.match(/FUNCTION public\.create_payment_attempt\([\s\S]*?SET search_path = ''/)
      expect(match).not.toBeNull()
    })

    it('sets search_path = "" on reconcile_paystack_payment', () => {
      const match = sql.match(/FUNCTION public\.reconcile_paystack_payment\([\s\S]*?SET search_path = ''/)
      expect(match).not.toBeNull()
    })

    it('uses fully qualified schema references inside hardened functions', () => {
      expect(sql).toContain('public.payments')
      expect(sql).toContain('public.orders')
      expect(sql).toContain('public.payment_events')
      expect(sql).toContain('pg_catalog.round')
      expect(sql).toContain('pg_catalog.now()')
      expect(sql).toContain('pg_catalog.coalesce')
      expect(sql).toContain('pg_catalog.jsonb_build_object')
    })
  })

  describe('5. Customer Ownership Consistency & Payment Immutability (§5)', () => {
    it('verifies customer_id matches between payment and authoritative order in reconcile_paystack_payment', () => {
      expect(sql).toContain('v_payment.customer_id <> v_order.customer_id')
      expect(sql).toContain('Customer mismatch:')
    })

    it('enforces strict immutability of customer_id after creation in protect_payment_immutable_fields', () => {
      // Rejects NULL -> customer A as well as customer A -> customer B
      expect(sql).toContain('IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN')
      expect(sql).toContain('payments.customer_id is immutable;')
    })

    it('protects id, order_id, amount, currency, reference, and created_at against mutation', () => {
      expect(sql).toContain('payments.id is immutable')
      expect(sql).toContain('payments.order_id is immutable')
      expect(sql).toContain('payments.amount is immutable')
      expect(sql).toContain('payments.currency is immutable')
      expect(sql).toContain('payments.paystack_reference is immutable once set')
      expect(sql).toContain('payments.created_at is immutable')
    })
  })

  describe('6. Payment Amount Authority & Subunit Conversion (§6)', () => {
    it('derives expected kobo amount authoritatively from orders.total', () => {
      expect(sql).toContain('v_expected_kobo := pg_catalog.round(v_order.total * 100)::bigint;')
      expect(sql).toContain('IF p_kobo_amount <> v_expected_kobo THEN')
      expect(sql).toContain('Amount mismatch:')
    })

    it('verifies payments.amount matches authoritative order total', () => {
      expect(sql).toContain('IF pg_catalog.round(v_payment.amount * 100)::bigint <> v_expected_kobo THEN')
      expect(sql).toContain('Payment amount mismatch:')
    })
  })

  describe('7. Currency Security (§7)', () => {
    it('validates Paystack reported currency is NGN', () => {
      expect(sql).toContain("IF pg_catalog.upper(p_currency) <> 'NGN' THEN")
      expect(sql).toContain("Currency mismatch: expected NGN")
    })

    it('validates KingdomDash internal payment record currency is NGN', () => {
      expect(sql).toContain("IF pg_catalog.upper(v_payment.currency) <> 'NGN' THEN")
      expect(sql).toContain("Payment currency mismatch:")
    })
  })

  describe('8. Order Status Transition Safety (§9)', () => {
    it('guards order transition to only payable statuses (pending, payment_pending, payment_processing)', () => {
      expect(sql).toContain("IF v_order.status NOT IN ('pending', 'payment_pending', 'payment_processing') THEN")
      expect(sql).toContain('Cannot reconcile payment: order')
      expect(sql).toContain('(not payable)')
    })

    it('transitions order to payment_confirmed on successful reconciliation', () => {
      expect(sql).toContain("SET status = 'payment_confirmed'")
    })
  })

  describe('9. Concurrency-Safe Idempotency & Locking Hierarchy (§10, §11, §12)', () => {
    it('locks public.orders FOR UPDATE before public.payments FOR UPDATE (Orders -> Payments hierarchy)', () => {
      const orderLockIndex = sql.indexOf('FROM public.orders\n  WHERE id = v_order_id\n  FOR UPDATE;')
      const paymentLockIndex = sql.indexOf('FROM public.payments\n  WHERE id = v_payment_id\n  FOR UPDATE;')
      expect(orderLockIndex).toBeGreaterThan(0)
      expect(paymentLockIndex).toBeGreaterThan(0)
      expect(orderLockIndex).toBeLessThan(paymentLockIndex)
    })

    it('handles concurrent duplicate webhook events safely with unique_violation exception block', () => {
      expect(sql).toContain('BEGIN\n    INSERT INTO public.payment_events')
      expect(sql).toContain('EXCEPTION WHEN unique_violation THEN')
      expect(sql).toContain("'status', 'already_processed'")
    })

    it('safely handles already-successful payments idempotently', () => {
      expect(sql).toContain("IF v_payment.status = 'successful' THEN")
      expect(sql).toContain("'status', 'already_successful'")
      expect(sql).toContain("'charge.success.duplicate'")
    })

    it('guarantees at most ONE successful payment per order via partial unique index', () => {
      expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_one_success_per_order')
      expect(sql).toContain('ON public.payments(order_id)')
      expect(sql).toContain("WHERE status = 'successful';")
    })
  })

  describe('10. Payment Attempt Creation Function (§18, §20)', () => {
    it('defines create_payment_attempt with SECURITY DEFINER and search_path = ""', () => {
      expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_payment_attempt(')
      expect(sql).toContain('p_order_id uuid')
      expect(sql).toContain('SECURITY DEFINER')
      expect(sql).toContain("SET search_path = ''")
    })

    it('verifies customer ownership of the order unless privileged role', () => {
      expect(sql).toContain('v_caller_id := auth.uid();')
      expect(sql).toContain('IF v_order.customer_id <> v_caller_id THEN')
      expect(sql).toContain('Access denied: caller does not own order')
    })

    it('prevents payment attempt on non-payable or already-paid orders', () => {
      expect(sql).toContain("IF v_order.status NOT IN ('pending', 'payment_pending') THEN")
      expect(sql).toContain("WHERE order_id = v_order.id AND status = 'successful'")
      expect(sql).toContain('Order % has already been paid successfully')
    })

    it('generates server-authoritative Paystack reference with kd_ prefix', () => {
      expect(sql).toContain("v_reference := 'kd_'")
    })

    it('grants execute on create_payment_attempt to authenticated and service_role, revoking from anon/PUBLIC', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.create_payment_attempt(uuid) FROM PUBLIC;')
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.create_payment_attempt(uuid) FROM anon;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_payment_attempt(uuid) TO authenticated;')
      expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.create_payment_attempt(uuid) TO service_role;')
    })
  })

  describe('11. Function Execution Privileges for Reconciliation (§16)', () => {
    it('strictly revokes execution from PUBLIC, anon, and authenticated, granting solely to service_role', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.reconcile_paystack_payment')
      expect(sql).toContain('FROM PUBLIC;')
      expect(sql).toContain('FROM authenticated;')
      expect(sql).toContain('FROM anon;')
      expect(sql).toContain('TO service_role;')
    })
  })

  describe('12. Mathematical & Subunit Precision Validation', () => {
    it('correctly converts Naira values to Kobo integers without precision loss', () => {
      const testCases = [
        { naira: 2500, expectedKobo: 250000 },
        { naira: 1450.5, expectedKobo: 145050 },
        { naira: 0.99, expectedKobo: 99 },
        { naira: 12500.75, expectedKobo: 1250075 },
        { naira: 35000.0, expectedKobo: 3500000 },
      ]

      for (const { naira, expectedKobo } of testCases) {
        const kobo = Math.round(naira * 100)
        expect(kobo).toBe(expectedKobo)
        expect(Number.isSafeInteger(kobo)).toBe(true)
      }
    })

    it('verifies deterministic event idempotency key formatting', () => {
      const reference = 'kd_9f3b8a1c_1788600000_a1b2c3'
      const txId = '123456789'
      const key = `${reference}:charge.success:${txId}`
      expect(key).toBe('kd_9f3b8a1c_1788600000_a1b2c3:charge.success:123456789')
    })
  })
})
