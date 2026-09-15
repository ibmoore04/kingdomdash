import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  initializePaystackPayment,
  verifyPaystackPayment,
  getLatestPaymentForOrder,
} from '../paystack'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('Phase 9 - Paystack Client Service E2E Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. initializePaystackPayment', () => {
    it('successfully invokes paystack-initialize Edge Function and returns authorization payload', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/access-12345',
            access_code: 'access-12345',
            reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
          },
        },
        error: null,
      }

      vi.mocked(supabase.functions.invoke).mockResolvedValue(mockResponse)

      const result = await initializePaystackPayment({
        order_id: 'order-uuid-999',
        callback_url: 'https://kingdomdash.ng/order/order-uuid-999/confirmation',
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('paystack-initialize', {
        body: {
          order_id: 'order-uuid-999',
          callback_url: 'https://kingdomdash.ng/order/order-uuid-999/confirmation',
        },
      })

      expect(result.authorization_url).toBe('https://checkout.paystack.com/access-12345')
      expect(result.access_code).toBe('access-12345')
      expect(result.reference).toBe('kd_ord_c7a1b2c3_1725540000_a1b2c3')
    })

    it('throws descriptive error if Edge Function invocation returns error', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: new Error('Order not found or unauthorized'),
      })

      await expect(
        initializePaystackPayment({ order_id: 'non-existent-order' })
      ).rejects.toThrow('Order not found or unauthorized')
    })

    it('throws error if response indicates failure without authorization url', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          success: false,
          error: 'Payment gateway service temporarily unavailable',
        },
        error: null,
      })

      await expect(
        initializePaystackPayment({ order_id: 'order-uuid-999' })
      ).rejects.toThrow('Payment gateway service temporarily unavailable')
    })
  })

  describe('2. verifyPaystackPayment', () => {
    it('successfully invokes paystack-verify Edge Function and returns verified order status', async () => {
      const mockVerifyResponse = {
        data: {
          success: true,
          status: 'payment_confirmed' as const,
          order_id: 'order-uuid-999',
          reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
        },
        error: null,
      }

      vi.mocked(supabase.functions.invoke).mockResolvedValue(mockVerifyResponse)

      const result = await verifyPaystackPayment({
        reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
      })

      expect(supabase.functions.invoke).toHaveBeenCalledWith('paystack-verify', {
        body: {
          reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
        },
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('payment_confirmed')
    })

    it('handles declined or failed status from verification endpoint', async () => {
      const mockVerifyResponse = {
        data: {
          success: false,
          status: 'failed' as const,
          reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
          message: 'Transaction was declined by cardholder bank',
        },
        error: null,
      }

      vi.mocked(supabase.functions.invoke).mockResolvedValue(mockVerifyResponse)

      const result = await verifyPaystackPayment({
        reference: 'kd_ord_c7a1b2c3_1725540000_a1b2c3',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.message).toContain('declined')
    })
  })

  describe('3. getLatestPaymentForOrder', () => {
    it('retrieves the most recent payment record from Supabase', async () => {
      const mockPaymentRow = {
        id: 'pay-uuid-1',
        order_id: 'order-uuid-999',
        customer_id: 'cust-uuid-1',
        paystack_reference: 'kd_ord_test_ref',
        paystack_transaction_id: '12345678',
        amount: 8500,
        currency: 'NGN',
        status: 'successful' as const,
        channel: 'card',
        gateway_response: 'Successful',
        paid_at: '2026-09-05T12:00:00Z',
        verified_at: '2026-09-05T12:00:05Z',
        created_at: '2026-09-05T11:58:00Z',
        updated_at: '2026-09-05T12:00:05Z',
      }

      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: mockPaymentRow,
          error: null,
        }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryChain as any)

      const payment = await getLatestPaymentForOrder('order-uuid-999')

      expect(supabase.from).toHaveBeenCalledWith('payments')
      expect(mockQueryChain.eq).toHaveBeenCalledWith('order_id', 'order-uuid-999')
      expect(payment).toEqual(mockPaymentRow)
      expect(payment?.status).toBe('successful')
    })

    it('returns null gracefully when database query encounters an error', async () => {
      const mockQueryChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: new Error('Permission denied on payments table'),
        }),
      }

      vi.mocked(supabase.from).mockReturnValue(mockQueryChain as any)

      const payment = await getLatestPaymentForOrder('order-uuid-999')
      expect(payment).toBeNull()
    })
  })
})
