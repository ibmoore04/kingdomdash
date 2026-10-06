import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  extractReceiptData,
  generateReceiptWhatsAppText,
  generateReceiptSummaryText,
  getReceiptVerificationUrl,
} from '@/utils/receipt-generator'
import {
  formatSettlementsCsv,
  calculateSettlementTotals,
  type SettlementRecord,
} from '@/utils/settlement-export'
import { OrderReceiptModal } from '@/components/order/order-receipt-modal'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'

describe('Phase 5: Branded PDF Receipts & WhatsApp Invoice Dispatcher', () => {
  const mockItems: OrderItem[] = [
    {
      id: 'item-1',
      order_id: 'ord-12345678',
      product_id: 'prod-1',
      product_name: 'Smokey Party Jollof & Fried Chicken',
      quantity: 2,
      unit_price: 2500,
      line_total: 5000,
      created_at: new Date().toISOString(),
    },
    {
      id: 'item-2',
      order_id: 'ord-12345678',
      product_id: 'prod-2',
      product_name: 'Chilled 500ml Drink',
      quantity: 1,
      unit_price: 400,
      line_total: 400,
      created_at: new Date().toISOString(),
    },
  ]

  const mockOrder: Order & { order_items?: OrderItem[] } = {
    id: 'ord-12345678-abcd-ef01-2345',
    customer_id: 'cust-1',
    vendor_id: 'vend-1',
    status: 'delivered',
    service_type: 'food',
    subtotal: 5400,
    delivery_fee: 500,
    total: 6050,
    delivery_address: 'TASUED Main Campus Gate, Ijagun',
    created_at: '2026-10-06T12:00:00Z',
    updated_at: '2026-10-06T12:35:00Z',
    order_items: mockItems,
    // extra dynamic fields
    service_fee: 150,
    vendor: {
      business_name: 'Mama Ijebu Gourmet Kitchen',
    },
  } as unknown as Order & { order_items?: OrderItem[] }

  const mockPayment: PaymentRow = {
    id: 'pay-1',
    order_id: mockOrder.id,
    paystack_reference: 'KD-PAY-987654321',
    amount: 6050,
    status: 'success',
    channel: 'card',
    paid_at: '2026-10-06T12:05:00Z',
    created_at: '2026-10-06T12:00:00Z',
    updated_at: '2026-10-06T12:05:00Z',
  }

  describe('Receipt Formatting Utilities', () => {
    it('generates canonical order verification URL', () => {
      const url = getReceiptVerificationUrl(mockOrder.id)
      expect(url).toContain(`/order/${mockOrder.id}/confirmation`)
    })

    it('extracts structured receipt data accurately', () => {
      const data = extractReceiptData(mockOrder, mockPayment, 200)
      expect(data.orderIdShort).toBe('ORD-1234')
      expect(data.vendorName).toBe('Mama Ijebu Gourmet Kitchen')
      expect(data.items).toHaveLength(2)
      expect(data.subtotal).toBe(5400)
      expect(data.deliveryFee).toBe(500)
      expect(data.riderTip).toBe(200)
      expect(data.paymentReference).toBe('KD-PAY-987654321')
    })

    it('generates formatted WhatsApp invoice text with emojis and item bullets', () => {
      const waText = generateReceiptWhatsAppText(mockOrder, mockPayment, 200)
      expect(waText).toContain('🧾 *KINGDOMDASH OFFICIAL INVOICE*')
      expect(waText).toContain('*Order No:* #ORD-1234')
      expect(waText).toContain('Smokey Party Jollof & Fried Chicken')
      expect(waText).toContain('*Payment Ref:* KD-PAY-987654321')
      expect(waText).toContain('*Verify Online:*')
    })

    it('generates plain-text invoice summary for clipboard export', () => {
      const summaryText = generateReceiptSummaryText(mockOrder, mockPayment)
      expect(summaryText).toContain('KINGDOMDASH ORDER RECEIPT #ORD-1234')
      expect(summaryText).toContain('Mama Ijebu Gourmet Kitchen')
      expect(summaryText).toContain('Total Paid:')
      expect(summaryText).toContain('KingdomDash Technologies')
    })
  })

  describe('Settlement & CSV Export Utilities', () => {
    const mockSettlements: SettlementRecord[] = [
      {
        id: 'set-001',
        orderId: mockOrder.id,
        orderNumber: 'ORD-1234',
        merchantName: 'Mama Ijebu Gourmet Kitchen',
        createdAt: '2026-10-06 12:35',
        status: 'settled',
        grossAmount: 5400,
        platformCommission: 540,
        deliveryFee: 500,
        riderTip: 200,
        netMerchantPayout: 4860,
        payoutReference: 'PAYOUT-BATCH-099',
      },
    ]

    it('formats settlement rows into RFC 4180 CSV with UTF-8 BOM', () => {
      const csv = formatSettlementsCsv(mockSettlements)
      // Checks UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('Settlement ID,Order ID,Order Ref,Merchant Name')
      expect(csv).toContain('"Mama Ijebu Gourmet Kitchen"')
      expect(csv).toContain('"PAYOUT-BATCH-099"')
      expect(csv).toContain('"4860.00"')
    })

    it('calculates totals across settlement batches accurately', () => {
      const totals = calculateSettlementTotals(mockSettlements)
      expect(totals.totalOrders).toBe(1)
      expect(totals.totalGross).toBe(5400)
      expect(totals.totalCommissions).toBe(540)
      expect(totals.totalNetPayout).toBe(4860)
    })
  })

  describe('OrderReceiptModal Component', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <OrderReceiptModal isOpen={false} onClose={vi.fn()} order={mockOrder} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders official receipt details, items, QR verification, and action buttons', () => {
      render(
        <OrderReceiptModal
          isOpen={true}
          onClose={vi.fn()}
          order={mockOrder}
          payment={mockPayment}
          riderTip={200}
        />
      )

      expect(screen.getByText(/Official Tax & Delivery Receipt/i)).toBeInTheDocument()
      expect(screen.getByText('Mama Ijebu Gourmet Kitchen')).toBeInTheDocument()
      expect(screen.getByText('Smokey Party Jollof & Fried Chicken')).toBeInTheDocument()
      expect(screen.getByText(/Authentic Digital Receipt/i)).toBeInTheDocument()

      // Action buttons
      expect(screen.getByRole('button', { name: /Print \/ PDF/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /WhatsApp/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
    })

    it('handles print button trigger without crashing', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
      render(
        <OrderReceiptModal
          isOpen={true}
          onClose={vi.fn()}
          order={mockOrder}
          payment={mockPayment}
        />
      )

      const printBtn = screen.getByRole('button', { name: /Print \/ PDF/i })
      fireEvent.click(printBtn)
      expect(printSpy).toHaveBeenCalled()
      printSpy.mockRestore()
    })
  })
})
