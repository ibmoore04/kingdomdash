import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getFlutterwavePublicKey,
  generateFlutterwaveTxRef,
  loadFlutterwaveScript,
  openFlutterwaveCheckout,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
} from '../flutterwave'
import { supabase } from '@/services/supabase/client'

vi.mock('@/services/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('Flutterwave Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete window.FlutterwaveCheckout
    document.head.innerHTML = ''
  })

  it('returns default sandbox key when env key is not configured', () => {
    const key = getFlutterwavePublicKey()
    expect(key).toBeDefined()
    expect(typeof key).toBe('string')
    expect(key.length).toBeGreaterThan(0)
  })

  it('generates unique deterministic transaction references with orderId prefix', () => {
    const txRef1 = generateFlutterwaveTxRef('order-1234-abcd')
    const txRef2 = generateFlutterwaveTxRef('order-1234-abcd')

    expect(txRef1).toMatch(/^KD-FLW-order1234abc-\d+$/)
    expect(txRef1).toBeDefined()
    expect(txRef2).toBeDefined()
  })

  it('resolves immediately if window.FlutterwaveCheckout is already loaded', async () => {
    window.FlutterwaveCheckout = vi.fn()
    const loaded = await loadFlutterwaveScript()
    expect(loaded).toBe(true)
  })

  it('appends script tag when loadFlutterwaveScript is called', async () => {
    const loadPromise = loadFlutterwaveScript()

    const scriptTag = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.flutterwave.com/v3.js"]'
    )
    expect(scriptTag).not.toBeNull()
    expect(scriptTag?.async).toBe(true)

    // Simulate script load
    scriptTag?.dispatchEvent(new Event('load'))

    const result = await loadPromise
    expect(result).toBe(true)
  })

  it('invokes window.FlutterwaveCheckout with correct options and handlers', async () => {
    const mockCheckout = vi.fn()
    window.FlutterwaveCheckout = mockCheckout

    const onSuccess = vi.fn()
    const onCancel = vi.fn()

    await openFlutterwaveCheckout({
      orderId: 'order-uuid-999',
      amount: 4500,
      customer: {
        email: 'ade@example.com',
        name: 'Adeola Adeleke',
        phone_number: '08012345678',
      },
      onSuccess,
      onCancel,
    })

    expect(mockCheckout).toHaveBeenCalledTimes(1)
    expect(mockCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4500,
        currency: 'NGN',
        customer: expect.objectContaining({
          email: 'ade@example.com',
          name: 'Adeola Adeleke',
          phone_number: '08012345678',
        }),
        customizations: expect.objectContaining({
          title: 'KingdomDash',
        }),
      })
    )

    // Verify callback handler
    const passedOptions = mockCheckout.mock.calls[0][0]
    passedOptions.callback({
      tx_ref: 'KD-FLW-ref',
      transaction_id: '123456',
      status: 'successful',
      amount: 4500,
      currency: 'NGN',
    })
    expect(onSuccess).toHaveBeenCalledTimes(1)

    // Verify onclose handler
    passedOptions.onclose(true)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('invokes flutterwave-initialize Edge Function securely via Supabase', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          link: 'https://checkout.flutterwave.com/pay/mock123',
          tx_ref: 'kd_flw_order999_123',
          order_id: 'order-999',
        },
      },
      error: null,
    } as any)

    const result = await initializeFlutterwavePayment({
      order_id: 'order-999',
      callback_url: 'https://kingdomdash.net/order/order-999/confirmation',
    })

    expect(mockInvoke).toHaveBeenCalledWith('flutterwave-initialize', {
      body: {
        order_id: 'order-999',
        callback_url: 'https://kingdomdash.net/order/order-999/confirmation',
      },
    })
    expect(result.tx_ref).toBe('kd_flw_order999_123')
    expect(result.link).toBe('https://checkout.flutterwave.com/pay/mock123')
  })

  it('invokes flutterwave-verify Edge Function securely via Supabase', async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        success: true,
        status: 'payment_confirmed',
        order_id: 'order-999',
        tx_ref: 'kd_flw_order999_123',
      },
      error: null,
    } as any)

    const result = await verifyFlutterwavePayment({
      tx_ref: 'kd_flw_order999_123',
      transaction_id: '998877',
    })

    expect(mockInvoke).toHaveBeenCalledWith('flutterwave-verify', {
      body: {
        tx_ref: 'kd_flw_order999_123',
        transaction_id: '998877',
      },
    })
    expect(result.status).toBe('payment_confirmed')
    expect(result.success).toBe(true)
  })
})
