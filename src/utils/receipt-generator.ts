import { formatNgn } from './formatting'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'

export interface ReceiptData {
  orderId: string
  orderIdShort: string
  createdAt: string
  vendorName: string
  deliveryAddress: string
  items: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  subtotal: number
  serviceFee: number
  deliveryFee: number
  riderTip: number
  total: number
  paymentReference: string
  paymentMethod: string
  verificationUrl: string
}

/**
 * Returns canonical verification URL for an authoritative order.
 */
export function getReceiptVerificationUrl(orderId: string): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://kingdomdash.ng'
  return `${origin}/order/${orderId}/confirmation`
}

/**
 * Normalizes order record into uniform ReceiptData structure.
 */
export function extractReceiptData(
  order: Order & { order_items?: OrderItem[] },
  payment?: PaymentRow | null,
  riderTip = 0
): ReceiptData {
  const vendorName =
    (order as unknown as { vendors?: { business_name?: string } | null })?.vendors?.business_name ||
    (order as unknown as { vendor?: { business_name?: string } | null })?.vendor?.business_name ||
    'Campus Kitchen Partner'

  const items = (order.order_items || []).map((i) => ({
    name: i.product_name,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    totalPrice: i.line_total,
  }))

  const serviceFee = (order as unknown as { service_fee?: number }).service_fee ?? 150
  const deliveryFee = order.delivery_fee || 0
  const subtotal = order.subtotal || 0
  const total = order.total || 0

  return {
    orderId: order.id,
    orderIdShort: order.id.slice(0, 8).toUpperCase(),
    createdAt: new Date(order.created_at).toLocaleString(),
    vendorName,
    deliveryAddress: order.delivery_address || 'Ijebu-Ode Campus Area',
    items,
    subtotal,
    serviceFee,
    deliveryFee,
    riderTip,
    total,
    paymentReference: payment?.paystack_reference || 'Authoritative Ledger',
    paymentMethod: payment?.channel ? `Via ${payment.channel.toUpperCase()}` : 'Paystack Escrow',
    verificationUrl: getReceiptVerificationUrl(order.id),
  }
}

/**
 * Generates formatted WhatsApp text for order invoice & proof of payment.
 */
export function generateReceiptWhatsAppText(
  order: Order & { order_items?: OrderItem[] },
  payment?: PaymentRow | null,
  riderTip = 0
): string {
  const data = extractReceiptData(order, payment, riderTip)

  const itemLines = data.items
    .map((i) => `  • ${i.quantity}x ${i.name} (${formatNgn(i.totalPrice)})`)
    .join('\n')

  const lines = [
    `🧾 *KINGDOMDASH OFFICIAL INVOICE*`,
    `----------------------------------------`,
    `*Order No:* #${data.orderIdShort}`,
    `*Date:* ${data.createdAt}`,
    `*Merchant:* ${data.vendorName}`,
    `*Destination:* ${data.deliveryAddress}`,
    ``,
    `*Ordered Items:*`,
    itemLines || '  • Itemized meals',
    ``,
    `----------------------------------------`,
    `*Subtotal:* ${formatNgn(data.subtotal)}`,
    `*Platform Fee:* ${formatNgn(data.serviceFee)}`,
    `*Delivery Fee:* ${data.deliveryFee > 0 ? formatNgn(data.deliveryFee) : '₦0.00 (Free)'}`,
    data.riderTip > 0 ? `*Rider Tip:* ${formatNgn(data.riderTip)}` : null,
    `*Total Paid:* ${formatNgn(data.total)}`,
    `*Payment Ref:* ${data.paymentReference}`,
    `*Payment Mode:* ${data.paymentMethod}`,
    `----------------------------------------`,
    `*Verify Online:* ${data.verificationUrl}`,
    ``,
    `_KingdomDash Technologies — Swift Campus Delivery_`,
  ]

  return lines.filter((l) => l !== null).join('\n')
}

/**
 * Generates plain text invoice summary suitable for copying to clipboard.
 */
export function generateReceiptSummaryText(
  order: Order & { order_items?: OrderItem[] },
  payment?: PaymentRow | null,
  riderTip = 0
): string {
  const data = extractReceiptData(order, payment, riderTip)

  const itemLines = data.items
    .map((i) => `  ${i.quantity}x ${i.name} - ${formatNgn(i.totalPrice)}`)
    .join('\n')

  return `KINGDOMDASH ORDER RECEIPT #${data.orderIdShort}
Date: ${data.createdAt}
Merchant: ${data.vendorName}
Destination: ${data.deliveryAddress}
----------------------------------------
Items:
${itemLines || '  Custom Order Items'}
----------------------------------------
Subtotal: ${formatNgn(data.subtotal)}
Platform Fee: ${formatNgn(data.serviceFee)}
Delivery Fee: ${data.deliveryFee > 0 ? formatNgn(data.deliveryFee) : '₦0.00'}
${data.riderTip > 0 ? `Rider Tip: ${formatNgn(data.riderTip)}\n` : ''}Total Paid: ${formatNgn(data.total)}
Payment Reference: ${data.paymentReference}
Verify: ${data.verificationUrl}
KingdomDash Technologies, Ijebu-Ode, Ogun State`
}

/**
 * Triggers native browser print dialog for document export to PDF.
 */
export function triggerPrintReceipt(): void {
  if (typeof window !== 'undefined') {
    window.print()
  }
}
