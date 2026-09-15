import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Home,
  Utensils,
  ShieldCheck,
  AlertCircle,
  CreditCard,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { PageContainer, Section } from '@/components/layout/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import { getOrderById } from '@/services/supabase/orders'
import {
  verifyPaystackPayment,
  initializePaystackPayment,
  getLatestPaymentForOrder,
} from '@/services/paystack/paystack'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'
import { OrderStatusTimeline } from '@/components/customer/OrderStatusTimeline'

interface FullOrder extends Order {
  order_items: OrderItem[]
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')

  const [order, setOrder] = useState<FullOrder | null>(null)
  const [payment, setPayment] = useState<PaymentRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Order Confirmation — KingdomDash'
  }, [])

  const fetchOrderAndPayment = useCallback(async () => {
    if (!orderId) {
      setIsLoading(false)
      setError('No order ID provided in URL.')
      return
    }

    try {
      const { data, error: fetchErr } = await getOrderById(orderId)
      if (fetchErr || !data) {
        setError(
          fetchErr && typeof fetchErr === 'object' && 'message' in fetchErr
            ? String((fetchErr as { message: string }).message)
            : 'Unable to locate this order. It may not exist or you do not have permission to view it.'
        )
      } else {
        const fullOrder = data as FullOrder
        setOrder(fullOrder)
        setIsLoading(false)

        // Load latest payment record for this order in background (non-blocking)
        getLatestPaymentForOrder(orderId)
          .then((payRecord) => {
            if (payRecord) setPayment(payRecord)
          })
          .catch(() => {})

        // If we have a reference in URL and order is not confirmed, trigger active verification
        if (reference && fullOrder.status !== 'payment_confirmed') {
          setIsVerifying(true)
          try {
            const verifyRes = await verifyPaystackPayment({ reference })
            if (verifyRes.success && verifyRes.status === 'payment_confirmed') {
              setOrder((prev) => (prev ? { ...prev, status: 'payment_confirmed' } : null))
              setVerificationNotice('Payment verified successfully via Paystack.')
              const updatedPay = await getLatestPaymentForOrder(orderId)
              if (updatedPay) setPayment(updatedPay)
            } else if (verifyRes.status === 'failed') {
              setVerificationNotice('Payment was declined or cancelled on Paystack.')
              const updatedPay = await getLatestPaymentForOrder(orderId)
              if (updatedPay) {
                setPayment(updatedPay)
              } else {
                setPayment((prev) => (prev ? { ...prev, status: 'failed' } : null))
              }
            } else {
              setVerificationNotice('Payment is currently pending confirmation from Paystack.')
            }
          } catch (vErr) {
            console.warn('[OrderConfirmation] Verification fallback query notice:', vErr)
          } finally {
            setIsVerifying(false)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while loading order details.')
    } finally {
      setIsLoading(false)
    }
  }, [orderId, reference])

  useEffect(() => {
    fetchOrderAndPayment()
  }, [fetchOrderAndPayment])

  const handleRetryPayment = async () => {
    if (!order || isRetrying) return
    setIsRetrying(true)
    try {
      const initData = await initializePaystackPayment({
        order_id: order.id,
        callback_url: `${window.location.origin}/order/${order.id}/confirmation`,
      })
      window.location.href = initData.authorization_url
    } catch (err) {
      setVerificationNotice(
        err instanceof Error ? err.message : 'Failed to initiate payment retry. Please try again.'
      )
      setIsRetrying(false)
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Section tone="light" className="py-16">
          <div className="mx-auto max-w-xl space-y-6">
            <div className="h-40 w-full animate-pulse rounded-2xl bg-neutral-100 border border-border" />
            <div className="h-64 w-full animate-pulse rounded-2xl bg-neutral-100 border border-border" />
          </div>
        </Section>
      </PageContainer>
    )
  }

  if (error || !order) {
    return (
      <PageContainer>
        <Section tone="light" className="py-16">
          <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error mb-4">
              <AlertCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-h3 font-bold text-text-primary">Order Not Found</h2>
            <p className="mt-2 text-body-small text-text-secondary">
              {error || 'We could not find the requested order in the system.'}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild variant="primary" className="rounded-xl font-bold text-white bg-primary hover:bg-primary-hover">
                <Link to="/" className="text-white">Return to Home</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/food">Browse Food Vendors</Link>
              </Button>
            </div>
          </div>
        </Section>
      </PageContainer>
    )
  }

  const authoritativeStatus:
    | 'payment_confirmed'
    | 'payment_pending'
    | 'pending'
    | 'failed'
    | 'unknown' = (() => {
    if (order.status === 'payment_confirmed' || payment?.status === 'successful') {
      return 'payment_confirmed'
    }
    if (
      payment?.status === 'failed' ||
      order.status === 'cancelled'
    ) {
      return 'failed'
    }
    if (
      isVerifying ||
      order.status === 'payment_pending' ||
      payment?.status === 'pending' ||
      payment?.status === 'processing'
    ) {
      return 'payment_pending'
    }
    if (order.status === 'pending') {
      return 'pending'
    }
    return 'unknown'
  })()

  const isConfirmed = authoritativeStatus === 'payment_confirmed'
  const isPendingConfirmation = authoritativeStatus === 'payment_pending'
  const isFailedOrCancelled = authoritativeStatus === 'failed'
  const isAwaitingPayment = authoritativeStatus === 'pending'

  return (
    <PageContainer>
      <Section tone="light" className="py-8 sm:py-12">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Main Status Banner */}
          <div
            data-authoritative-status={authoritativeStatus}
            className={`rounded-2xl border p-6 text-center sm:p-8 ${
              isConfirmed
                ? 'border-success/30 bg-success/5'
                : isPendingConfirmation
                ? 'border-amber-300/50 bg-amber-500/5'
                : isFailedOrCancelled
                ? 'border-error/30 bg-error/5'
                : isAwaitingPayment
                ? 'border-primary/20 bg-primary/5'
                : 'border-neutral-200 bg-neutral-50'
            }`}
          >
            <div
              className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white mb-4 shadow-md ${
                isConfirmed
                  ? 'bg-success'
                  : isPendingConfirmation
                  ? 'bg-amber-500'
                  : isFailedOrCancelled
                  ? 'bg-error'
                  : isAwaitingPayment
                  ? 'bg-primary'
                  : 'bg-neutral-600'
              }`}
            >
              {isConfirmed ? (
                <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
              ) : isPendingConfirmation ? (
                <Clock className="h-9 w-9 animate-pulse" aria-hidden="true" />
              ) : isFailedOrCancelled ? (
                <AlertCircle className="h-9 w-9" aria-hidden="true" />
              ) : isAwaitingPayment ? (
                <CreditCard className="h-9 w-9" aria-hidden="true" />
              ) : (
                <FileText className="h-9 w-9" aria-hidden="true" />
              )}
            </div>

            <span
              className={`rounded-full px-3 py-1 text-caption font-bold uppercase tracking-wider ${
                isConfirmed
                  ? 'bg-success/15 text-success'
                  : isPendingConfirmation
                  ? 'bg-amber-500/15 text-amber-800'
                  : isFailedOrCancelled
                  ? 'bg-error/15 text-error'
                  : isAwaitingPayment
                  ? 'bg-primary/15 text-primary'
                  : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {isConfirmed
                ? 'Payment Confirmed'
                : isPendingConfirmation
                ? 'Payment Being Confirmed'
                : isFailedOrCancelled
                ? 'Payment Incomplete or Cancelled'
                : isAwaitingPayment
                ? 'Payment Pending'
                : `Order: ${order.status}`}
            </span>

            <h1 className="mt-3 text-h2 font-bold text-text-primary">
              {isConfirmed
                ? 'Thank you for your order!'
                : isPendingConfirmation
                ? 'Payment being confirmed...'
                : isFailedOrCancelled
                ? 'Payment Incomplete or Cancelled'
                : isAwaitingPayment
                ? 'Order Placed — Awaiting Payment'
                : 'Order Status Update'}
            </h1>
            <p className="mt-1 text-body-small text-text-secondary max-w-lg mx-auto">
              {isConfirmed
                ? 'Your payment has been confirmed via Paystack. The vendor has been notified to prepare your order.'
                : isPendingConfirmation
                ? 'We are waiting for Paystack to confirm your transaction. Please hold on or refresh once your bank completes the debit.'
                : isFailedOrCancelled
                ? 'Your payment was not completed or was cancelled. You can retry paying safely below without re-ordering.'
                : isAwaitingPayment
                ? 'Your order has been recorded in KingdomDash. Please complete payment using Paystack so the vendor can begin.'
                : `Your order is currently logged in the system with status: ${order.status}.`}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-body-small font-semibold text-text-primary border border-border shadow-xs">
              <span className="text-text-muted">Order ID:</span>
              <span className="font-mono text-primary font-bold">{order.id}</span>
            </div>
          </div>

          {/* Live Fulfillment Timeline (Phase 10) */}
          <OrderStatusTimeline
            status={order.status}
            serviceType={order.service_type}
            cancellationReason={(order as unknown as { cancellation_reason?: string }).cancellation_reason}
            refundRequired={(order as unknown as { refund_required?: boolean }).refund_required}
          />

          {/* Active Verification Spinner if redirecting from Paystack */}
          {isVerifying && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-body-small text-primary flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Verifying transaction status with Paystack...</span>
            </div>
          )}

          {/* Verification Notice / Retry Alert if failed */}
          {verificationNotice && (
            <div className="rounded-xl border border-neutral-200 bg-white p-4 text-body-small text-neutral-700 flex items-center justify-between">
              <span>{verificationNotice}</span>
              {!isConfirmed && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRetryPayment}
                  disabled={isRetrying}
                  className="h-9 px-3 text-xs font-bold gap-1.5 text-white bg-primary hover:bg-primary-hover"
                >
                  {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  <span>Retry Payment</span>
                </Button>
              )}
            </div>
          )}

          {/* Paystack Payment Status Box */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="text-body font-bold text-text-primary">Payment Status</h3>
              </div>
              <Badge
                variant={
                  isConfirmed
                    ? 'success'
                    : isFailedOrCancelled
                    ? 'error'
                    : isPendingConfirmation
                    ? 'warning'
                    : 'default'
                }
                className={`capitalize font-bold ${
                  isConfirmed
                    ? 'bg-success/15 text-success border-success/30'
                    : isFailedOrCancelled
                    ? 'bg-error/10 text-error border-error/20'
                    : isPendingConfirmation
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                }`}
              >
                {isConfirmed
                  ? 'Paid (Paystack)'
                  : isFailedOrCancelled
                  ? 'Payment Failed / Cancelled'
                  : isPendingConfirmation
                  ? 'Payment Being Confirmed'
                  : 'Payment Pending'}
              </Badge>
            </div>

            <div className="space-y-2 text-body-small text-text-secondary">
              {payment?.paystack_reference && (
                <div className="flex justify-between">
                  <span>Reference:</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {payment.paystack_reference}
                  </span>
                </div>
              )}
              {payment?.channel && (
                <div className="flex justify-between">
                  <span>Payment Channel:</span>
                  <span className="capitalize text-text-primary font-semibold">{payment.channel}</span>
                </div>
              )}
              {payment?.paid_at && (
                <div className="flex justify-between">
                  <span>Paid At:</span>
                  <span className="text-text-primary">
                    {new Date(payment.paid_at).toLocaleTimeString('en-NG', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Retry Button if not paid */}
            {!isConfirmed && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRetryPayment}
                  disabled={isRetrying}
                  className="w-full rounded-xl py-3 text-button font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-sm"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Connecting to Paystack...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isFailedOrCancelled
                          ? `Retry Payment (${formatNgn(order.total)}) with Paystack`
                          : `Pay ${formatNgn(order.total)} with Paystack`}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Order Details & Summary Card */}
          <div className="rounded-2xl border border-border bg-white p-6 shadow-xs space-y-6">
            {/* Meta Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-caption text-text-muted">Order Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="default" className="capitalize bg-neutral-100 font-semibold text-text-primary">
                    <Clock className="h-3 w-3 mr-1 text-text-muted" aria-hidden="true" />
                    {order.status}
                  </Badge>
                  <span className="text-caption text-text-muted font-mono">
                    ID: {order.id.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <div className="text-right">
                <p className="text-caption text-text-muted">Placed on</p>
                <p className="text-body-small font-medium text-text-primary mt-1">
                  {new Date(order.created_at).toLocaleString('en-NG', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="space-y-1">
              <h3 className="text-caption font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>Delivery Address</span>
              </h3>
              <p className="text-body-small text-text-primary bg-neutral-50 p-3 rounded-xl border border-border/60">
                {order.delivery_address}
              </p>
            </div>

            {/* Special Instructions if present */}
            {order.special_instructions && (
              <div className="space-y-1">
                <h3 className="text-caption font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>Special Instructions</span>
                </h3>
                <p className="text-body-small text-text-primary bg-neutral-50 p-3 rounded-xl border border-border/60 italic">
                  &ldquo;{order.special_instructions}&rdquo;
                </p>
              </div>
            )}

            {/* Itemized Receipt */}
            <div className="space-y-3">
              <h3 className="text-caption font-bold uppercase tracking-wider text-text-muted">
                Order Items ({order.order_items?.length || 0})
              </h3>
              <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-white">
                {order.order_items?.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 text-body-small">
                    <div>
                      <p className="font-semibold text-text-primary">{item.product_name}</p>
                      <p className="text-caption text-text-muted">
                        Qty: {item.quantity} × {formatNgn(item.unit_price)}
                      </p>
                    </div>
                    <span className="font-bold text-text-primary">
                      {formatNgn(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Authoritative Financial Breakdown */}
            <div className="space-y-2 border-t border-border pt-4 text-body-small">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span className="font-semibold text-text-primary">{formatNgn(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Delivery Fee</span>
                <span className="font-semibold text-text-primary">
                  {order.delivery_fee && order.delivery_fee > 0
                    ? formatNgn(order.delivery_fee)
                    : '₦0.00 (Launch Preview)'}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-body font-bold text-text-primary">
                <span>Total Amount</span>
                <span className="text-h3 font-extrabold text-primary">{formatNgn(order.total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-caption text-text-muted pt-2 border-t border-border/60">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              <span>Database Authoritative Record Guaranteed</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button asChild variant="outline" className="flex-1 rounded-xl">
              <Link to="/" className="inline-flex items-center justify-center gap-2">
                <Home className="h-4 w-4" aria-hidden="true" />
                <span>Back to Home</span>
              </Link>
            </Button>
            <Button asChild variant="primary" className="flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white">
              <Link to="/food" className="inline-flex items-center justify-center gap-2">
                <Utensils className="h-4 w-4" aria-hidden="true" />
                <span>Explore More Vendors</span>
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </PageContainer>
  )
}
