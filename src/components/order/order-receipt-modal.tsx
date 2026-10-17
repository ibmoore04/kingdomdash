import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

import { generateReceiptImageBlob } from '@/utils/receipt-image-generator'

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
  const receiptBlobRef = useRef<Blob | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrError, setQrError] = useState(false)
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-receipt-modal-open')
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleKeyDown)

      // Pre-render receipt slip image so WhatsApp sharing and downloads are instantaneous
      generateReceiptImageBlob({ order, payment, riderTip })
        .then((blob) => {
          receiptBlobRef.current = blob
        })
        .catch(() => {})

      return () => {
        document.body.classList.remove('has-receipt-modal-open')
        document.body.classList.remove('is-printing-receipt')
        window.removeEventListener('keydown', handleKeyDown)
      }
    } else {
      receiptBlobRef.current = null
      document.body.classList.remove('has-receipt-modal-open')
      document.body.classList.remove('is-printing-receipt')
    }
  }, [isOpen, onClose, order, payment, riderTip])

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
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(
    verificationUrl,
  )}`

  const isCash =
    (order.status as string) === 'pending_cod' ||
    payment?.channel === 'cash' ||
    (order as unknown as { payment_method?: string }).payment_method === 'cash'

  const settlementLabel =
    order.status === 'payment_confirmed' || order.status === 'delivered'
      ? 'Paid & Settled'
      : (order.status as string) === 'pending_cod'
      ? 'Cash on Handover'
      : (order.status as string).replace(/_/g, ' ')

  const paymentMethodLabel = isCash
    ? 'Cash on Delivery'
    : payment?.channel
    ? `Via ${payment.channel.toUpperCase()}`
    : 'Paystack Escrow'

  const paymentRef =
    payment?.paystack_reference || (payment as any)?.reference || `KD-REF-${orderIdShort}`

  const handlePrint = () => {
    document.body.classList.add('is-printing-receipt')
    window.print()
    setTimeout(() => {
      document.body.classList.remove('is-printing-receipt')
    }, 1000)
  }

  const handleShareWhatsApp = async () => {
    setIsSharingWhatsApp(true)
    const message = generateReceiptWhatsAppText(order, payment, riderTip)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`

    // Check if native Web Share with file attachment is supported (smartphones/tablets)
    let sharedWithFiles = false
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const blob =
          receiptBlobRef.current ||
          (await generateReceiptImageBlob({ order, payment, riderTip }))
        const file = new File([blob], `KingdomDash-Receipt-${orderIdShort}.png`, {
          type: 'image/png',
        })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `KingdomDash Receipt #${orderIdShort}`,
            text: message,
          })
          sharedWithFiles = true
          useUiStore.getState().pushToast({
            title: 'Receipt Shared',
            message: 'Receipt slip shared to WhatsApp.',
            variant: 'success',
          })
          setIsSharingWhatsApp(false)
          return
        }
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          setIsSharingWhatsApp(false)
          return
        }
      }
    }

    if (!sharedWithFiles) {
      // Direct navigation to WhatsApp (guaranteed even if browser popup blocker triggers)
      const popup = window.open(waUrl, '_blank')
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = waUrl
      }

      // Download the official high-resolution receipt image slip
      try {
        const blob =
          receiptBlobRef.current ||
          (await generateReceiptImageBlob({ order, payment, riderTip }))
        const fileName = `KingdomDash-Receipt-${orderIdShort}.png`
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        useUiStore.getState().pushToast({
          title: 'Opening WhatsApp',
          message: 'Receipt image downloaded! You can attach it to your WhatsApp chat.',
          variant: 'success',
        })
      } catch {
        // Non-fatal fallback
      }
    }
    setIsSharingWhatsApp(false)
  }

  const handleDownloadImage = async () => {
    setIsDownloadingImage(true)
    try {
      const blob = await generateReceiptImageBlob({ order, payment, riderTip })
      const fileName = `KingdomDash-Receipt-${orderIdShort}.png`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      useUiStore.getState().pushToast({
        title: 'Receipt Saved',
        message: 'High-resolution receipt slip saved to downloads.',
        variant: 'success',
      })
    } catch {
      useUiStore.getState().pushToast({
        title: 'Download Failed',
        message: 'Could not generate receipt image. Use Print / PDF instead.',
        variant: 'error',
      })
    } finally {
      setIsDownloadingImage(false)
    }
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

  const modalContent = (
    <div
      id="kd-official-receipt-portal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 print:static print:p-0 print:bg-white print:overflow-visible"
    >
      {/* Click outside backdrop */}
      <div
        className="fixed inset-0 bg-transparent print:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Modal Card */}
      <div
        ref={receiptRef}
        className="relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-neutral-200/90 overflow-hidden text-neutral-900 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-0 print:max-w-none print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none print:w-full print:p-0"
      >
        {/* Mobile Sheet Drag Indicator */}
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden print:hidden" />

        {/* Modal Controls Bar - Hidden during print */}
        <div className="receipt-modal-controls flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-neutral-100 bg-neutral-50/80 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-2xs">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-900 truncate">
                Official Tax &amp; Delivery Receipt
              </h3>
              <p className="text-[11px] text-neutral-500 font-mono truncate">
                Ref: #{orderIdShort} • Verified Transaction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <button
              type="button"
              onClick={handleCopySummary}
              title="Copy formatted invoice text"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:border-neutral-300 transition-all min-h-[36px] active:scale-95 cursor-pointer"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-neutral-500" />
              )}
              <span className="hidden xs:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isDownloadingImage}
              title="Download high-resolution receipt image"
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 hover:border-neutral-300 transition-all min-h-[36px] active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
              <span className="hidden xs:inline">Slip</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isSharingWhatsApp}
              title="Share Receipt Image & Summary on WhatsApp"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-white shadow-2xs transition-all min-h-[36px] active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>{isSharingWhatsApp ? 'Preparing…' : 'WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Print Receipt or Save as PDF"
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 hover:bg-black px-3 sm:px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow transition-all min-h-[36px] active:scale-95 cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-neutral-300" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer ml-0.5"
              aria-label="Close Receipt Modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Document Body */}
        <div
          id="kd-printable-receipt"
          className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 text-left bg-white text-neutral-900"
        >
          {/* Brand Header & Corporate Metadata */}
          <div className="border-b border-neutral-200 pb-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/KingdomDash-emblem-clean.png"
                  alt="KingdomDash"
                  className="h-10 w-auto object-contain"
                />
                <div>
                  <h2
                    id="receipt-title"
                    className="text-2xl font-black tracking-tight text-neutral-900 leading-none"
                  >
                    Kingdom<span className="text-primary">Dash</span>
                  </h2>
                  <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary mt-1">
                    Swift in Motion
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right space-y-0.5 text-xs text-neutral-500 font-mono">
                <p className="font-bold text-neutral-700 uppercase tracking-wider text-[10px]">
                  Official Tax Invoice
                </p>
                <p>RC: 7892341 • TIN: 2489102-0001</p>
                <p>Ijebu-Ode, Ogun State, Nigeria</p>
              </div>
            </div>

            <div className="pt-2.5 border-t border-dashed border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-neutral-600 uppercase tracking-wider text-[11px]">
                Hyperlocal Campus Logistics &amp; Instant Food Delivery
              </span>
              <span className="font-mono text-[10.5px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                ORIGINAL CUSTOMER COPY
              </span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-3.5 sm:p-4 rounded-2xl bg-neutral-50 border border-neutral-200/80 text-xs">
            <div>
              <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                Official Order Ref
              </span>
              <span className="font-mono font-black text-neutral-900 text-sm block">
                #{orderIdShort}
              </span>
              <span className="text-neutral-500 text-[11px] block mt-0.5">
                {new Date(order.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div>
              <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                Settlement Status
              </span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-md">
                <CheckCircle2 className="h-3 w-3 shrink-0" />
                <span className="capitalize">{settlementLabel}</span>
              </span>
              <span className="text-neutral-500 text-[11px] block mt-1 font-mono">
                {paymentMethodLabel}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-neutral-400 font-bold uppercase tracking-wider text-[10px] block mb-0.5">
                Transaction Ref
              </span>
              <span className="font-mono text-[11px] text-neutral-700 block truncate" title={paymentRef}>
                {paymentRef}
              </span>
              <span className="text-neutral-400 text-[10px] block mt-0.5">
                Ledger Verified Settlement
              </span>
            </div>
          </div>

          {/* Merchant & Delivery Destination Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-neutral-200/80 p-3.5 bg-neutral-50/50">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-red-50 text-primary shrink-0 mt-0.5">
                  <Store className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block">
                    Merchant Vendor
                  </span>
                  <span className="font-bold text-neutral-900 block truncate text-sm">
                    {vendorName}
                  </span>
                  <span className="text-neutral-500 text-[11px] block mt-0.5">
                    Verified Campus Kitchen Partner
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200/80 p-3.5 bg-neutral-50/50">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider block">
                    Delivery Destination / Landmark
                  </span>
                  <span className="font-medium text-neutral-800 leading-snug block mt-0.5">
                    {order.delivery_address || 'Ijebu-Ode Campus Area, Ogun State'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="bg-neutral-100/70 px-4 py-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-600 border-b border-neutral-200">
              <span>Item &amp; Description</span>
              <span className="text-right">Amount</span>
            </div>

            <div className="divide-y divide-neutral-100 px-4">
              {items.length === 0 ? (
                <div className="py-4 text-center text-xs text-neutral-400 italic">
                  Standard Order Items
                </div>
              ) : (
                items.map((i) => (
                  <div key={i.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-neutral-100 text-neutral-800 font-bold text-[11px]">
                          {i.quantity}×
                        </span>
                        <span className="font-bold text-neutral-900 truncate">{i.product_name}</span>
                      </div>
                      <span className="text-neutral-400 text-[11px] block pl-7 font-mono">
                        @ {formatNgn(i.unit_price)} each
                      </span>
                    </div>
                    <span className="font-bold text-neutral-900 font-mono text-sm shrink-0">
                      {formatNgn(i.line_total)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="rounded-2xl bg-neutral-50/70 border border-neutral-200/80 p-4 space-y-2 text-xs">
            <div className="flex justify-between text-neutral-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-neutral-900 font-mono">{formatNgn(subtotal)}</span>
            </div>

            <div className="flex justify-between text-neutral-600">
              <span>Platform Service Fee</span>
              <span className="font-semibold text-neutral-900 font-mono">{formatNgn(serviceFee)}</span>
            </div>

            <div className="flex justify-between text-neutral-600">
              <span>Campus Delivery Logistics</span>
              <span className="font-semibold text-neutral-900 font-mono">
                {deliveryFee > 0 ? formatNgn(deliveryFee) : '₦0.00 (Free)'}
              </span>
            </div>

            {riderTip > 0 && (
              <div className="flex justify-between text-emerald-800 font-medium">
                <span>Rider Appreciation Tip (100% to Rider)</span>
                <span className="font-bold font-mono">{formatNgn(riderTip)}</span>
              </div>
            )}

            <div className="border-t-2 border-neutral-900 pt-3 mt-1 flex items-baseline justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-900 block">
                  {order.status === 'delivered' || payment?.status === 'successful'
                    ? 'Total Paid'
                    : 'Total Amount'}
                </span>
                <span className="text-[10px] text-neutral-500 font-medium block">
                  All platform levies &amp; delivery logistics included
                </span>
              </div>
              <span className="text-2xl font-black text-primary font-mono tracking-tight">
                {formatNgn(total)}
              </span>
            </div>
          </div>

          {/* Digital Verification & Audit Seal */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 p-4 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-14 w-14 shrink-0 rounded-xl bg-white border border-emerald-200/80 p-1 flex items-center justify-center shadow-2xs overflow-hidden">
                {qrError ? (
                  <QrCode className="h-7 w-7 text-emerald-700" />
                ) : (
                  <img
                    src={qrCodeUrl}
                    alt="Receipt Verification QR"
                    onError={() => setQrError(true)}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-emerald-950 text-sm leading-tight flex items-center gap-1.5">
                  <span>Authentic Digital Receipt</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-700 inline shrink-0" />
                </p>
                <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                  Secured &amp; verified on KingdomDash Authoritative Ledger
                </p>
                <p className="text-[10px] text-neutral-500 font-mono truncate mt-0.5">
                  Scan QR code with phone camera to verify authenticity live
                </p>
              </div>
            </div>

            <a
              href={verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 hover:underline shrink-0 print:hidden bg-white px-3 py-1.5 rounded-lg border border-emerald-200/80 shadow-2xs"
            >
              <span>Verify</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Footer Security Note */}
          <div className="text-center pt-3 border-t border-neutral-200 text-[11px] text-neutral-400 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-800 font-bold text-xs">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Certified Delivery Ledger &amp; Paystack Settlement</span>
            </div>
            <p className="font-mono text-[10px] text-neutral-500">Order ID: {order.id}</p>
            <p className="text-[10px] text-neutral-400">
              KingdomDash Technologies — support@kingdomdash.ng • Swift Campus Delivery
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
