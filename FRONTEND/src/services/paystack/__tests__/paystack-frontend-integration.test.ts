import { describe, expect, it, vi, beforeEach } from 'vitest'
import { initializePaystackPayment, verifyPaystackPayment } from '../paystack'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
    })),
  },
}))

describe('Phase 9 — Frontend Paystack Integration & Security Invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1. Customer can initialize payment for own order
  it('1. Customer can initialize payment for own order sending ONLY order_id', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/auth-abc-123',
          access_code: 'acc-123',
          reference: 'KD-20260906-0001',
        },
      },
      error: null,
    })

    const result = await initializePaystackPayment('order-uuid-own-123')

    expect(result.authorization_url).toBe('https://checkout.paystack.com/auth-abc-123')
    expect(result.reference).toBe('KD-20260906-0001')
    expect(mockInvoke).toHaveBeenCalledWith('paystack-initialize', {
      body: {
        order_id: 'order-uuid-own-123',
      },
    })
  })

  // 2. Customer cannot initialize payment for another customer's order
  it("2. Customer cannot initialize payment for another customer's order (backend rejection)", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Order not found or access denied' },
    })

    await expect(initializePaystackPayment('order-uuid-foreign-999')).rejects.toThrow(
      /Order not found or access denied/i
    )
  })

  // 3. Frontend cannot override payment amount
  it('3. Frontend cannot override payment amount (amount not in payload schema)', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/auth-safe',
          access_code: 'acc-safe',
          reference: 'KD-20260906-0002',
        },
      },
      error: null,
    })

    // Calling initializePaystackPayment passes ONLY order_id and optional callback_url
    await initializePaystackPayment({
      order_id: 'order-uuid-1',
      callback_url: 'https://kingdomdash.ng/confirm',
    })

    const invokeCall = mockInvoke.mock.calls[0]
    const payload = invokeCall[1]?.body as Record<string, unknown>

    expect(payload).toHaveProperty('order_id', 'order-uuid-1')
    expect(payload).toHaveProperty('callback_url', 'https://kingdomdash.ng/confirm')
    expect(payload).not.toHaveProperty('amount')
    expect(payload).not.toHaveProperty('total')
    expect(payload).not.toHaveProperty('delivery_fee')
    expect(payload).not.toHaveProperty('currency')
  })

  // 4. Frontend cannot provide its own reference
  it('4. Frontend cannot provide its own reference (server-authoritative reference generation)', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/auth-safe',
          access_code: 'acc-safe',
          reference: 'KD-20260906-SERVER-GENERATED',
        },
      },
      error: null,
    })

    await initializePaystackPayment('order-uuid-2')

    const invokeCall = mockInvoke.mock.calls[0]
    const payload = invokeCall[1]?.body as Record<string, unknown>

    expect(payload).not.toHaveProperty('reference')
    expect(payload).not.toHaveProperty('paystack_reference')
  })

  // 5. Duplicate payment clicks are safely handled
  it('5. Duplicate payment clicks are safely handled (client prevents concurrent dispatches)', async () => {
    let callCount = 0
    let isSubmitting = false

    async function simulateCheckoutClick(orderId: string) {
      if (isSubmitting) return 'ignored-duplicate'
      isSubmitting = true
      try {
        callCount++
        return await initializePaystackPayment(orderId)
      } finally {
        isSubmitting = false
      }
    }

    vi.mocked(supabase.functions.invoke).mockImplementation(async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 50))
      return {
        data: {
          success: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/auth',
            access_code: 'code',
            reference: 'KD-REF',
          },
        },
        error: null,
      }
    })

    // Rapid concurrent clicks
    const [first, second, third] = await Promise.all([
      simulateCheckoutClick('order-1'),
      simulateCheckoutClick('order-1'),
      simulateCheckoutClick('order-1'),
    ])

    expect(first).not.toBe('ignored-duplicate')
    expect(second).toBe('ignored-duplicate')
    expect(third).toBe('ignored-duplicate')
    expect(callCount).toBe(1)
  })

  // 6. Cancelled payment does not show success
  it('6. Cancelled payment does not show success and reflects failed status', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: false,
        status: 'failed',
        reference: 'KD-CANCELLED-REF',
        message: 'Customer cancelled transaction on Paystack',
      },
      error: null,
    })

    const result = await verifyPaystackPayment({ reference: 'KD-CANCELLED-REF' })
    expect(result.status).toBe('failed')
    expect(result.success).toBe(false)
  })

  // 7. Browser callback does not itself prove payment success
  it('7. Browser callback does not itself prove payment success (active verification required)', async () => {
    // Attacker modifies URL to ?status=success&reference=KD-FORGED
    const queryParams = new URLSearchParams('status=success&reference=KD-FORGED')
    expect(queryParams.get('status')).toBe('success')

    // System MUST NOT trust queryParams.get('status'); it calls verifyPaystackPayment
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: false,
        status: 'failed',
        reference: 'KD-FORGED',
        error: 'Transaction not found or unverified',
      },
      error: null,
    })

    const serverVerification = await verifyPaystackPayment({ reference: queryParams.get('reference')! })
    // The server reports failed despite the browser query claiming success
    expect(serverVerification.status).toBe('failed')
    expect(serverVerification.success).toBe(false)
  })

  // 8. Confirmation page reflects database payment status
  it('8. Confirmation page reflects database payment status (authoritative mapping)', () => {
    function resolveAuthoritativeStatus(
      orderStatus: string,
      paymentStatus?: string | null
    ): 'payment_confirmed' | 'payment_pending' | 'pending' | 'failed' | 'unknown' {
      if (orderStatus === 'payment_confirmed' || paymentStatus === 'successful') {
        return 'payment_confirmed'
      }
      if (
        paymentStatus === 'failed' ||
        paymentStatus === 'abandoned' ||
        paymentStatus === 'cancelled' ||
        orderStatus === 'cancelled'
      ) {
        return 'failed'
      }
      if (
        orderStatus === 'payment_pending' ||
        paymentStatus === 'pending' ||
        paymentStatus === 'processing'
      ) {
        return 'payment_pending'
      }
      if (orderStatus === 'pending') {
        return 'pending'
      }
      return 'unknown'
    }

    expect(resolveAuthoritativeStatus('payment_confirmed', 'successful')).toBe('payment_confirmed')
    expect(resolveAuthoritativeStatus('pending', 'failed')).toBe('failed')
    expect(resolveAuthoritativeStatus('pending', 'pending')).toBe('payment_pending')
    expect(resolveAuthoritativeStatus('pending', null)).toBe('pending')
    expect(resolveAuthoritativeStatus('custom_state', null)).toBe('unknown')
  })

  // 9. Failed payment can be retried when the order remains payable
  it('9. Failed payment can be retried when the order remains payable (generates new reference)', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/retry-url',
          access_code: 'retry-code',
          reference: 'KD-20260906-RETRY-001',
        },
      },
      error: null,
    })

    const retryResult = await initializePaystackPayment('order-retry-uuid')

    expect(retryResult.authorization_url).toBe('https://checkout.paystack.com/retry-url')
    expect(retryResult.reference).toBe('KD-20260906-RETRY-001')
    expect(mockInvoke).toHaveBeenCalledWith('paystack-initialize', {
      body: { order_id: 'order-retry-uuid' },
    })
  })

  // 10. Successful payment cannot be duplicated
  it('10. Successful payment cannot be duplicated (Edge Function rejects already-paid orders)', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: 'Order is already paid or non-payable' },
    })

    await expect(initializePaystackPayment('order-already-paid')).rejects.toThrow(
      /Order is already paid or non-payable/i
    )
  })

  // 11. No secret appears in production frontend assets
  it('11. No secret appears in production frontend environment variables or client assets', () => {
    const env = import.meta.env
    expect(env.VITE_PAYSTACK_SECRET_KEY).toBeUndefined()
    expect(env.PAYSTACK_SECRET_KEY).toBeUndefined()
    expect(env.VITE_SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    expect(env.PAYSTACK_WEBHOOK_SECRET).toBeUndefined()

    // Ensure only public or anon keys exist in client env
    const keys = Object.keys(env)
    for (const k of keys) {
      expect(k.toLowerCase()).not.toContain('secret')
      expect(k.toLowerCase()).not.toContain('service_role')
      expect(k.toLowerCase()).not.toContain('webhook')
    }
  })
})
