import { useRef, useState } from 'react'
import {
  Printer,
  Share2,
  X,
  ShieldCheck,
  CheckCircle2,
  Store,
  MapPin,
  Copy,
  Check,
  QrCode,
  ExternalLink,
} from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import {
  generateReceiptWhatsAppText,
  generateReceiptSummaryText,
  getReceiptVerificationUrl,
} from '@/utils/receipt-generator'
import { useUiStore } from '@/stores/ui-store'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'

export interface OrderReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order & { order_items?: OrderItem[] }
  payment?: PaymentRow | null
  riderTip?: number
}

export function OrderReceiptModal({
  isOpen,
  onClose,
  order,
  payment,
  riderTip = 0,
}: OrderReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  if (!isOpen || !order) return null

  const items = order.order_items || []
  const orderIdShort = order.id.slice(0, 8).toUpperCase()
  const vendorName =
    (order as unknown as { vendors?: { business_name?: string } | null })?.vendors?.business_name ||
    (order as unknown as { vendor?: { business_name?: string } | null })?.vendor?.business_name ||
    'Campus Kitchen Partner'
  const serviceFee = (order as unknown as { service_fee?: number }).service_fee ?? 150
  const deliveryFee = order.delivery_fee || 0
  const subtotal = order.subtotal || 0
  const total = order.total || 0
  const verificationUrl = getReceiptVerificationUrl(order.id)

  const handlePrint = () => {
    window.print()
  }

  const handleShareWhatsApp = () => {
    const message = generateReceiptWhatsAppText(order, payment, riderTip)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank')
  }

  const handleCopySummary = async () => {
    const text = generateReceiptSummaryText(order, payment, riderTip)
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
      useUiStore.getState().pushToast({
        title: 'Receipt Copied',
        message: 'Formatted invoice summary copied to clipboard.',
        variant: 'success',
      })
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 print:p-0 print:bg-white print:static"
    >
      <div
        ref={receiptRef}
        className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-8 shadow-2xl border border-neutral-200 print:shadow-none print:border-none print:w-full print:max-w-none print:p-4 text-neutral-900 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-8"
      >
        {/* Mobile Sheet Drag Indicator */}
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden print:hidden" />

        {/* Modal Controls - Hidden during print */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-neutral-100 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 truncate">
              Official Tax &amp; Delivery Receipt
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              title="Copy formatted invoice text"
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors min-h-[36px]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Print Receipt or Save as PDF"
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors min-h-[36px]"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              title="Share Receipt on WhatsApp"
              className="flex items-center gap-1 sm:gap-1.5 rounded-xl bg-emerald-600 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors min-h-[36px]"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close Receipt Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="space-y-5 sm:space-y-6 pt-4 text-left overflow-y-auto flex-1 pr-1">
          {/* Brand Header with Emblem */}
          <div className="text-center space-y-1.5 border-b border-neutral-200/80 pb-5">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/KingdomDash-emblem.png"
                alt="KingdomDash"
                className="h-9 w-9 rounded-xl object-contain bg-black p-0.5 border border-neutral-200 shadow-2xs"
              />
              <h2 id="receipt-title" className="text-2xl font-black tracking-tight text-neutral-900">
                Kingdom<span className="text-primary">Dash</span>
              </h2>
            </div>
            <p className="text-xs text-neutral-700 font-bold uppercase tracking-wider">
              Hyperlocal Campus Logistics &amp; Instant Food Delivery
            </p>
            <p className="text-[11px] text-neutral-500 font-mono">
              RC: 7892341 • TIN: 2489102-0001 • Ijebu-Ode, Ogun State
            </p>
          </div>

          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                Official Order Ref
              </p>
              <p className="font-mono font-black text-neutral-900 text-sm">#{orderIdShort}</p>
              <p className="text-neutral-500 text-[11px] mt-0.5">
                {new Date(order.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <div className="text-right">
              <p className="text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                Settlement Status
              </p>
              <p className="font-bold text-emerald-700 text-sm capitalize">
                {order.status === 'payment_confirmed' || order.status === 'delivered'
                  ? 'Paid & Settled'
                  : order.status.replace(/_/g, ' ')}
              </p>
              <p className="text-neutral-500 text-[11px] mt-0.5 font-mono">
                {payment?.channel ? `Via ${payment.channel.toUpperCase()}` : 'Paystack Escrow'}
              </p>
            </div>
          </div>

          {/* Parties Info */}
          <div className="rounded-2xl bg-neutral-50 p-3.5 border border-neutral-200/70 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <Store className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  Merchant Vendor
                </span>
                <span className="font-bold text-neutral-900">{vendorName}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-1.5 border-t border-neutral-200/50">
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <span className="text-neutral-400 text-[10px] uppercase font-bold block">
                  Delivery Destination / Landmark
                </span>
                <span className="font-medium text-neutral-800 leading-snug">
                  {order.delivery_address}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
              <span>Item &amp; Description</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y divide-neutral-100 py-1">
              {items.map((i) => (
                <div key={i.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-neutral-900 mr-2">{i.quantity}×</span>
                    <span className="font-medium text-neutral-800">{i.product_name}</span>
                    <span className="text-neutral-400 text-[11px] block pl-6 font-mono">
                      @ {formatNgn(i.unit_price)} each
                    </span>
                  </div>
                  <span className="font-bold text-neutral-900">{formatNgn(i.line_total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="border-t border-neutral-200 pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-neutral-900">{formatNgn(subtotal)}</span>
            </div>

            <div className="flex justify-between text-neutral-600">
              <span>Platform Service Fee</span>
              <span className="font-semibold text-neutral-900">{formatNgn(serviceFee)}</span>
            </div>

            <div className="flex justify-between text-neutral-600">
              <span>Campus Delivery Logistics</span>
              <span className="font-semibold text-neutral-900">
                {deliveryFee > 0 ? formatNgn(deliveryFee) : '₦0.00 (Free)'}
              </span>
            </div>

            {riderTip > 0 && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Rider Appreciation Tip (100% to Rider)</span>
                <span className="font-bold">{formatNgn(riderTip)}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline border-t-2 border-neutral-900 pt-2.5 text-base font-black text-neutral-900">
              <span>Total Paid</span>
              <span className="text-xl font-black text-primary">{formatNgn(total)}</span>
            </div>
          </div>

          {/* Digital Verification & Audit Seal */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 leading-tight">Authentic Digital Receipt</p>
                <p className="text-[11px] text-emerald-700 leading-snug">
                  Secured &amp; verified on KingdomDash Authoritative Ledger
                </p>
              </div>
            </div>

            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:underline shrink-0 print:hidden"
            >
              <span>Verify</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Footer Security Note */}
          <div className="text-center pt-2 border-t border-neutral-100 text-[11px] text-neutral-400 space-y-1">
            <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Certified Delivery Ledger &amp; Paystack Settlement</span>
            </div>
            <p className="font-mono text-[10px]">Order ID: {order.id}</p>
            <p className="text-[10px]">KingdomDash Technologies — support@kingdomdash.ng</p>
          </div>
        </div>
      </div>
    </div>
  )
}
