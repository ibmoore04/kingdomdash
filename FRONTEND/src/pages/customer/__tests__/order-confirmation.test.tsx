import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OrderConfirmationPage from '../order-confirmation'
import * as orderService from '@/services/supabase/orders'
import * as paystackService from '@/services/paystack/paystack'

vi.mock('@/services/paystack/paystack', () => ({
  verifyPaystackPayment: vi.fn().mockResolvedValue({ success: true, status: 'payment_confirmed' }),
  initializePaystackPayment: vi.fn(),
  getLatestPaymentForOrder: vi.fn().mockResolvedValue(null),
}))

const mockFullOrder = {
  id: 'order-1234-abcd',
  order_reference: 'KD-20260905-001',
  customer_id: 'cust-1',
  vendor_id: 'vendor-1',
  service_type: 'food',
  status: 'pending',
  payment_status: 'pending',
  subtotal: 4500,
  delivery_fee: 0,
  total: 4500,
  pickup_address: '10 Awujale St, Ijebu-Ode',
  delivery_address: 'Adeola (08012345678), 14 Stadium Road, Ijebu-Ode',
  special_instructions: 'Please call when outside gate',
  created_at: '2026-09-05T10:00:00Z',
  updated_at: '2026-09-05T10:00:00Z',
  order_items: [
    {
      id: 'item-row-1',
      order_id: 'order-1234-abcd',
      product_id: 'prod-1',
      product_name: 'Fried Rice & Turkey',
      quantity: 1,
      unit_price: 4500,
      line_total: 4500,
      created_at: '2026-09-05T10:00:00Z',
    },
  ],
}

describe('OrderConfirmationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders awaiting payment state when order is pending in database', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      data: mockFullOrder,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/order/order-1234-abcd/confirmation']}>
        <Routes>
          <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Order Placed — Awaiting Payment')).toBeDefined()
      expect(screen.getByText('order-1234-abcd')).toBeDefined()
      expect(screen.getAllByText(/Payment Pending/i).length).toBeGreaterThan(0)
      expect(screen.getByText('Fried Rice & Turkey')).toBeDefined()
      expect(screen.getByText(/Please call when outside gate/i)).toBeDefined()
      expect(screen.getByText(/14 Stadium Road, Ijebu-Ode/i)).toBeDefined()
      expect(screen.getByText('₦0.00 (Launch Preview)')).toBeDefined()
    })
  })

  it('renders payment confirmed state ONLY when order status is payment_confirmed in database', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      data: { ...mockFullOrder, status: 'payment_confirmed', payment_status: 'paid' },
      error: null,
    })
    vi.spyOn(paystackService, 'getLatestPaymentForOrder').mockResolvedValue({
      id: 'pay-1',
      order_id: 'order-1234-abcd',
      customer_id: 'cust-1',
      amount: 4500,
      currency: 'NGN',
      paystack_reference: 'KD-20260905-REF1',
      paystack_transaction_id: 'trx-123',
      status: 'successful',
      channel: 'card',
      paid_at: '2026-09-05T10:05:00Z',
      verified_at: '2026-09-05T10:05:00Z',
      gateway_response: 'Successful',
      created_at: '2026-09-05T10:00:00Z',
      updated_at: '2026-09-05T10:05:00Z',
    })

    render(
      <MemoryRouter initialEntries={['/order/order-1234-abcd/confirmation']}>
        <Routes>
          <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Thank you for your order!')).toBeDefined()
      expect(screen.getByText('Paid (Paystack)')).toBeDefined()
      expect(screen.getByText('KD-20260905-REF1')).toBeDefined()
      expect(screen.getByText('card')).toBeDefined()
    })
  })

  it('renders payment incomplete/cancelled banner and allows retry when payment failed', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      data: { ...mockFullOrder, status: 'pending' },
      error: null,
    })
    vi.spyOn(paystackService, 'getLatestPaymentForOrder').mockResolvedValue({
      id: 'pay-2',
      order_id: 'order-1234-abcd',
      customer_id: 'cust-1',
      amount: 4500,
      currency: 'NGN',
      paystack_reference: 'KD-20260905-FAIL',
      paystack_transaction_id: null,
      status: 'failed',
      channel: null,
      paid_at: null,
      verified_at: null,
      gateway_response: 'Customer cancelled payment popup',
      created_at: '2026-09-05T10:00:00Z',
      updated_at: '2026-09-05T10:02:00Z',
    })

    const initSpy = vi.spyOn(paystackService, 'initializePaystackPayment').mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/test-url',
      access_code: 'test_code',
      reference: 'KD-20260905-NEWREF',
    })

    render(
      <MemoryRouter initialEntries={['/order/order-1234-abcd/confirmation']}>
        <Routes>
          <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Payment Incomplete or Cancelled/i })).toBeDefined()
      expect(screen.getByText('Payment Failed / Cancelled')).toBeDefined()
      expect(screen.getByRole('button', { name: /Retry Payment/i })).toBeDefined()
    })

    const retryBtn = screen.getByRole('button', { name: /Retry Payment/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledWith({
        order_id: 'order-1234-abcd',
        callback_url: expect.stringContaining('/order/order-1234-abcd/confirmation'),
      })
    })
  })

  it('triggers server verification when reference is in URL and does not trust client status=success blindly', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      data: { ...mockFullOrder, status: 'pending' },
      error: null,
    })

    const verifySpy = vi.spyOn(paystackService, 'verifyPaystackPayment').mockResolvedValue({
      success: false,
      status: 'failed',
      reference: 'KD-REF-BROWSER-CLAIMED',
      message: 'Transaction failed on gateway',
    })

    render(
      <MemoryRouter initialEntries={['/order/order-1234-abcd/confirmation?status=success&reference=KD-REF-BROWSER-CLAIMED']}>
        <Routes>
          <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith({ reference: 'KD-REF-BROWSER-CLAIMED' })
      // Even though query string claimed status=success, server verification returned failed
      // so it must NOT display 'Thank you for your order!'
      expect(screen.queryByText('Thank you for your order!')).toBeNull()
      expect(screen.getByRole('heading', { name: /Payment Incomplete or Cancelled/i })).toBeDefined()
    })
  })

  it('renders error state when order is not found', async () => {
    vi.spyOn(orderService, 'getOrderById').mockResolvedValue({
      data: null,
      error: { message: 'Order does not exist' },
    })

    render(
      <MemoryRouter initialEntries={['/order/non-existent/confirmation']}>
        <Routes>
          <Route path="/order/:orderId/confirmation" element={<OrderConfirmationPage />} />
        </Routes>
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Order Not Found')).toBeDefined()
      expect(screen.getByText('Order does not exist')).toBeDefined()
      expect(screen.getByRole('link', { name: /Return to Home/i })).toBeDefined()
    })
  })
})
