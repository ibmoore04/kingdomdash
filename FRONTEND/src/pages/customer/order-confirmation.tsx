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
  XCircle,
  Copy,
  Check,
  Printer,
  Share2,
  Banknote,
} from 'lucide-react'
import { PageContainer, Section } from '@/components/layout/section'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import { generateReceiptWhatsAppText } from '@/utils/receipt-generator'
import { supabase } from '@/services/supabase/client'
import { getOrderById } from '@/services/supabase/orders'
import { getAssignedRiderForOrder, type AssignedRiderInfo } from '@/services/supabase/deliveries'
import {
  verifyPaystackPayment,
  initializePaystackPayment,
  getLatestPaymentForOrder,
} from '@/services/paystack/paystack'
import {
  openFlutterwaveCheckout,
  initializeFlutterwavePayment,
  verifyFlutterwavePayment,
} from '@/services/flutterwave/flutterwave'
import type { Order, OrderItem } from '@/types'
import type { PaymentRow } from '@/services/paystack/types'
import { OrderStatusTimeline } from '@/components/customer/OrderStatusTimeline'
import { DeliveryPinCard } from '@/components/order/delivery-pin-card'
import { DeliveryLiveMap } from '@/components/order/delivery-live-map'
import { WhatsappDispatchBridge } from '@/components/order/whatsapp-dispatch-bridge'
import { SmartDisputeResolutionModal } from '@/components/customer/smart-dispute-resolution-modal'
import { CancelOrderModal } from '@/components/customer/cancel-order-modal'
import { OrderReceiptModal } from '@/components/order/order-receipt-modal'
import { OrderTrackingSkeleton } from '@/components/ui/skeletons'

interface FullOrder extends Order {
  order_items: OrderItem[]
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference')
  const gateway = searchParams.get('gateway')
  const flwRef = searchParams.get('flw_ref')
  const transactionId = searchParams.get('transaction_id')
  const txRefParam = searchParams.get('tx_ref')
  const paymentChannelParam = searchParams.get('payment_channel')

  const [order, setOrder] = useState<FullOrder | null>(null)
  const [payment, setPayment] = useState<PaymentRow | null>(null)
  const [assignedRiderState, setAssignedRiderState] = useState<AssignedRiderInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verificationNotice, setVerificationNotice] = useState<string | null>(null)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false)
  const [copiedOrderId, setCopiedOrderId] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  const isCashOrder = paymentChannelParam === 'cash' || payment?.channel === 'cash'
  const isFlutterwave = gateway === 'flutterwave' || payment?.channel === 'flutterwave' || Boolean(flwRef)

  useEffect(() => {
    document.title = 'Order Confirmation — KingdomDash'
  }, [])

  const fetchAssignedRider = useCallback(async () => {
    if (!orderId) return
    try {
      const rider = await getAssignedRiderForOrder(orderId)
      if (rider) {
        setAssignedRiderState(rider)
      }
    } catch (rErr) {
      console.warn('[OrderConfirmation] Could not load assigned rider:', rErr)
    }
  }, [orderId])

  const fetchOrderAndPayment = useCallback(async () => {
    if (!orderId) {
      setIsLoading(false)
      setError('No order ID provided in URL.')
      return
    }

    try {
      let { data, error: fetchErr } = await getOrderById(orderId)

      // Mobile WebView / Transient Auth Loss Recovery:
      // If order query failed but we have a Paystack transaction reference, run active verification via Edge Function
      if ((fetchErr || !data) && reference && !isFlutterwave) {
        setIsVerifying(true)
        try {
          const verifyRes = await verifyPaystackPayment({ reference })
          if (verifyRes.success) {
            setVerificationNotice('Payment verified via Paystack. Refreshing order details...')
            const retryRes = await getOrderById(orderId)
            if (retryRes.data) {
              data = retryRes.data
              fetchErr = null
            }
          }
        } catch (vErr) {
          console.warn('[OrderConfirmation] Active verification fallback failed:', vErr)
        } finally {
          setIsVerifying(false)
        }
      }

      if (fetchErr || !data) {
        setError(
          fetchErr && typeof fetchErr === 'object' && 'message' in fetchErr
            ? String((fetchErr as { message: string }).message)
            : 'Unable to locate this order. It may not exist or your session is re-authenticating.'
        )
      } else {
        const fullOrder = data as FullOrder
        setOrder(fullOrder)
        setError(null)
        setIsLoading(false)

        // Load latest payment record for this order in background (non-blocking)
        getLatestPaymentForOrder(orderId)
          .then((payRecord) => {
            if (payRecord) setPayment(payRecord)
          })
          .catch(() => {})

        // Query assigned courier rider details for live tracking display
        fetchAssignedRider()

        const effectiveTxRef = reference || txRefParam
        const isFlutterwaveCallback =
          gateway === 'flutterwave' || Boolean(flwRef) || Boolean(txRefParam)

        // Handle Flutterwave callback return with active server verification
        if (isFlutterwaveCallback && (effectiveTxRef || transactionId)) {
          if (fullOrder.status !== 'payment_confirmed') {
            setIsVerifying(true)
            try {
              const verifyRes = await verifyFlutterwavePayment({
                tx_ref: effectiveTxRef || undefined,
                transaction_id: transactionId || undefined,
              })
              if (verifyRes.success && verifyRes.status === 'payment_confirmed') {
                setOrder((prev) => (prev ? { ...prev, status: 'payment_confirmed' } : null))
                setVerificationNotice('Payment verified successfully via Flutterwave.')
                const updatedPay = await getLatestPaymentForOrder(orderId)
                if (updatedPay) setPayment(updatedPay)
              } else if (verifyRes.status === 'failed') {
                setVerificationNotice('Payment was declined or cancelled on Flutterwave.')
                const updatedPay = await getLatestPaymentForOrder(orderId)
                if (updatedPay) {
                  setPayment(updatedPay)
                } else {
                  setPayment((prev) => (prev ? { ...prev, status: 'failed' } : null))
                }
              } else {
                setVerificationNotice('Flutterwave payment is pending confirmation from gateway.')
              }
            } catch (vErr) {
              console.warn('[OrderConfirmation] Flutterwave active verification notice:', vErr)
              setVerificationNotice('Awaiting confirmation from Flutterwave. We are verifying your transaction.')
            } finally {
              setIsVerifying(false)
            }
          } else {
            setVerificationNotice('Payment verified successfully via Flutterwave.')
          }
        } else if (reference && fullOrder.status !== 'payment_confirmed') {
          // If we have a Paystack reference in URL and order is not confirmed, trigger active verification
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
  }, [orderId, reference, gateway, flwRef, isFlutterwave])

  useEffect(() => {
    fetchOrderAndPayment()
  }, [fetchOrderAndPayment])

  // Automatically refetch when Supabase auth session finishes rehydrating on mobile WebViews
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchOrderAndPayment()
      }
    })
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [fetchOrderAndPayment])

  // Realtime subscription + adaptive polling fallback for connectivity resiliency
  useEffect(() => {
    if (!orderId) return

    // Supabase Realtime channel for live status updates & rider assignments
    const channel = supabase
      .channel(`order_tracking_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        () => {
          fetchOrderAndPayment()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          fetchAssignedRider()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_assignments',
        },
        () => {
          fetchAssignedRider()
        }
      )
      .subscribe()

    // 4-second adaptive polling fallback (resilient when WebSockets drop on mobile connections)
    const pollInterval = setInterval(() => {
      if (order?.status === 'delivered' || order?.status === 'cancelled') {
        return
      }
      fetchOrderAndPayment()
      fetchAssignedRider()
    }, 4000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [orderId, fetchOrderAndPayment, fetchAssignedRider, order?.status])

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

  const handleRetryPaymentFlutterwave = async () => {
    if (!order || isRetrying) return
    setIsRetrying(true)
    try {
      let initData: { link?: string; tx_ref?: string } | null = null
      try {
        initData = await initializeFlutterwavePayment({
          order_id: order.id,
          callback_url: `${window.location.origin}/order/${order.id}/confirmation?gateway=flutterwave`,
        })
      } catch (err) {
        console.warn('[OrderConfirmation] Flutterwave retry init fallback:', err)
      }

      await openFlutterwaveCheckout({
        orderId: order.id,
        txRef: initData?.tx_ref,
        amount: order.total,
        customer: {
          email: 'customer@kingdomdash.ng',
          name: 'Customer',
        },
        onSuccess: async (flwRes) => {
          setIsRetrying(false)
          setIsVerifying(true)
          try {
            const verifyRes = await verifyFlutterwavePayment({
              tx_ref: flwRes.tx_ref,
              transaction_id: flwRes.transaction_id,
            })
            if (verifyRes.success && verifyRes.status === 'payment_confirmed') {
              setVerificationNotice('Payment verified successfully via Flutterwave.')
              setOrder((prev) => (prev ? { ...prev, status: 'payment_confirmed' } : null))
              const updatedPay = await getLatestPaymentForOrder(order.id)
              if (updatedPay) setPayment(updatedPay)
            }
          } catch {
            setVerificationNotice('Payment received, confirming order status...')
            setOrder((prev) => (prev ? { ...prev, status: 'payment_confirmed' } : null))
          } finally {
            setIsVerifying(false)
          }
        },
        onCancel: () => {
          setIsRetrying(false)
        },
        onError: (flwErr) => {
          setIsRetrying(false)
          if (initData?.link) {
            window.location.href = initData.link
            return
          }
          setVerificationNotice(flwErr.message || 'Could not load Flutterwave checkout.')
        },
      })
    } catch (err) {
      setIsRetrying(false)
      setVerificationNotice(
        err instanceof Error ? err.message : 'Failed to initialize Flutterwave retry.'
      )
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Section tone="light" className="py-8 sm:py-12">
          <div className="mx-auto max-w-2xl">
            <OrderTrackingSkeleton />
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

  const handleCopyOrderId = () => {
    if (!order) return
    navigator.clipboard.writeText(order.id)
    setCopiedOrderId(true)
    setTimeout(() => setCopiedOrderId(false), 2000)
  }

  const authoritativeStatus:
    | 'payment_confirmed'
    | 'payment_pending'
    | 'pending'
    | 'failed'
    | 'unknown' = (() => {
    if (
      ['payment_confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered'].includes(order.status) ||
      payment?.status === 'successful' ||
      ((isCashOrder || (isFlutterwave && Boolean(reference))) && order.status !== 'cancelled')
    ) {
      return 'payment_confirmed'
    }
    if (payment?.status === 'failed' || order.status === 'cancelled') {
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

  const extractedRiderTip = (() => {
    if (!order?.special_instructions) return 0
    const match = order.special_instructions.match(/\[RIDER TIP:\s*₦?([\d,]+)\]/)
    if (match && match[1]) {
      return parseInt(match[1].replace(/,/g, ''), 10) || 0
    }
    return 0
  })()

  // Resolve assigned rider details (if admin / dispatch assigned a rider to this order)
  const assignedRider = (() => {
    if (assignedRiderState?.name) {
      return assignedRiderState
    }
    if (!order) return null
    const r = (order as unknown as { rider?: { profile?: { full_name?: string; phone?: string }; full_name?: string; phone?: string } | null })?.rider ||
      (order as unknown as { riders?: { profile?: { full_name?: string; phone?: string }; full_name?: string; phone?: string } | null })?.riders
    if (r?.profile?.full_name || r?.full_name) {
      return {
        name: r.profile?.full_name || r.full_name,
        phone: r.profile?.phone || r.phone || null,
      }
    }
    const deliveries = (order as unknown as { deliveries?: unknown })?.deliveries
    const delivery = Array.isArray(deliveries) ? deliveries[0] : deliveries
    const assignments = (delivery as { delivery_assignments?: unknown })?.delivery_assignments
    const assignment = Array.isArray(assignments) ? assignments[0] : assignments
    const assignmentRider = (assignment as { riders?: { profiles?: { full_name?: string; phone?: string } } })?.riders
    if (assignmentRider?.profiles?.full_name) {
      return {
        name: assignmentRider.profiles.full_name,
        phone: assignmentRider.profiles.phone || null,
      }
    }
    return null
  })()

  return (
    <PageContainer>
      <Section tone="light" className="py-6 sm:py-10 pb-28 lg:pb-12">
        <div className="mx-auto max-w-6xl">
          {/* Top Header / Breadcrumb Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-neutral-200/80">
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors shadow-2xs"
                title="Back to Home"
              >
                <Home className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Order</span>
                  <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyOrderId}
                    className="inline-flex items-center text-neutral-400 hover:text-neutral-700 transition-colors text-xs"
                    title="Copy full order ID"
                  >
                    {copiedOrderId ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Placed on {new Date(order.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
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
                className={`capitalize font-bold px-3 py-1 text-xs rounded-full ${
                  isConfirmed
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : isFailedOrCancelled
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : isPendingConfirmation
                    ? 'bg-amber-100 text-amber-900 border-amber-200'
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                {isConfirmed
                  ? 'Confirmed'
                  : isPendingConfirmation
                  ? 'Processing'
                  : isFailedOrCancelled
                  ? 'Action Required'
                  : isAwaitingPayment
                  ? 'Pending'
                  : `Order: ${order.status}`}
              </Badge>
            </div>
          </div>

          {/* Verification Notice / Retry Alert if failed */}
          {verificationNotice && (
            <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-4 text-body-small text-neutral-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>{verificationNotice}</span>
              </div>
              {!isConfirmed && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRetryPayment}
                  disabled={isRetrying}
                  className="h-9 px-4 text-xs font-bold gap-1.5 text-white bg-primary hover:bg-primary-hover rounded-xl shadow-xs"
                >
                  {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  <span>Retry Payment</span>
                </Button>
              )}
            </div>
          )}

          {/* Active Verification Spinner if redirecting from Paystack */}
          {isVerifying && (
            <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-body-small text-primary flex items-center justify-center gap-2.5 shadow-xs">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-semibold">Verifying transaction status with Paystack...</span>
            </div>
          )}

          {/* Main 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 of 12): Status Hero, Fulfillment Radar, Security Pass, Destination */}
            <div className="lg:col-span-7 space-y-6">
              {/* Dynamic Ambient Hero Card */}
              <div
                data-authoritative-status={authoritativeStatus}
                className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 transition-all ${
                  isConfirmed
                    ? 'border-emerald-200/90 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/30 shadow-md'
                    : isPendingConfirmation
                    ? 'border-amber-200/90 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/30 shadow-md'
                    : isFailedOrCancelled
                    ? 'border-rose-200/90 bg-gradient-to-br from-rose-50/90 via-white to-orange-50/30 shadow-md'
                    : 'border-rose-200/80 bg-gradient-to-br from-rose-50/80 via-white to-orange-50/30 shadow-md'
                }`}
              >
                {/* Decorative ambient blur circle */}
                <div
                  className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl ${
                    isConfirmed ? 'bg-emerald-400/20' : 'bg-primary/15'
                  }`}
                  aria-hidden="true"
                />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md shrink-0 ${
                        isConfirmed
                          ? 'bg-emerald-600'
                          : isPendingConfirmation
                          ? 'bg-amber-500'
                          : isFailedOrCancelled
                          ? 'bg-rose-600'
                          : 'bg-primary'
                      }`}
                    >
                      {isConfirmed ? (
                        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                      ) : isPendingConfirmation ? (
                        <Clock className="h-6 w-6 animate-pulse" aria-hidden="true" />
                      ) : isFailedOrCancelled ? (
                        <AlertCircle className="h-6 w-6" aria-hidden="true" />
                      ) : (
                        <CreditCard className="h-6 w-6" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          isCashOrder
                            ? 'bg-emerald-100 text-emerald-800'
                            : isConfirmed
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPendingConfirmation
                            ? 'bg-amber-100 text-amber-900'
                            : isFailedOrCancelled
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-primary/15 text-primary'
                        }`}
                      >
                        {isCashOrder
                          ? 'Cash on Delivery'
                          : isConfirmed
                          ? isFlutterwave
                            ? 'Paid (Flutterwave)'
                            : 'Payment Confirmed'
                          : isPendingConfirmation
                          ? 'Payment Being Confirmed'
                          : isFailedOrCancelled
                          ? 'Payment Incomplete or Cancelled'
                          : 'Payment Pending'}
                      </span>
                      <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
                        {isCashOrder
                          ? 'Order Placed — Cash on Delivery'
                          : isConfirmed
                          ? 'Thank you for your order!'
                          : isPendingConfirmation
                          ? 'Payment being confirmed...'
                          : isFailedOrCancelled
                          ? 'Payment Incomplete or Cancelled'
                          : 'Order Placed — Awaiting Payment'}
                      </h1>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-600 leading-relaxed max-w-xl">
                    {isCashOrder
                      ? 'Your order has been sent to the vendor! Please have cash ready to pay your rider upon delivery.'
                      : isConfirmed
                      ? isFlutterwave
                        ? 'Your payment has been completed via Flutterwave. The vendor has been notified to prepare your order.'
                        : 'Your payment has been confirmed via Paystack. The vendor has been notified to prepare your order.'
                      : isPendingConfirmation
                      ? 'We are waiting for payment confirmation. Please hold on or refresh once your bank completes the debit.'
                      : isFailedOrCancelled
                      ? 'Your payment was not completed or was cancelled. You can retry paying safely below without re-ordering.'
                      : 'Your order has been recorded in KingdomDash. Please complete payment so the vendor can begin.'}
                  </p>

                  {/* Immediate Action Banner When Awaiting Payment or Cash on Delivery */}
                  {isCashOrder ? (
                    <div className="mt-5 rounded-2xl bg-emerald-50/90 border border-emerald-200 p-4 sm:p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <div>
                          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                            Cash Amount Due
                          </p>
                          <p className="text-2xl sm:text-3xl font-black text-emerald-900">
                            {formatNgn(order.total)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Banknote className="h-3.5 w-3.5 text-emerald-700" />
                          <span>Pay Dispatch Rider</span>
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Please have <strong>{formatNgn(order.total)}</strong> ready in cash for your dispatch rider. Share your 4-digit Delivery PIN below once you receive and inspect your items.
                      </p>
                    </div>
                  ) : !isConfirmed && (
                    <div className="mt-5 rounded-2xl bg-white/95 border border-rose-200/90 p-4 sm:p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
                        <div>
                          <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                            Total Payable
                          </p>
                          <p className="text-2xl sm:text-3xl font-black text-primary">
                            {formatNgn(order.total)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200/80">
                          <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                          <span>Action Required</span>
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={handleRetryPayment}
                          disabled={isRetrying}
                          className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg transition-all"
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

                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRetryPaymentFlutterwave}
                          disabled={isRetrying}
                          className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border-amber-300 bg-amber-50/60 hover:bg-amber-100 text-amber-900 shadow-xs transition-all"
                        >
                          {isRetrying ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                              <span>Opening Flutterwave...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 text-amber-600" aria-hidden="true" />
                              <span>
                                {isFailedOrCancelled
                                  ? `Retry with Flutterwave`
                                  : `Pay with Flutterwave`}
                              </span>
                            </>
                          )}
                        </Button>
                      </div>

                      <p className="mt-2 text-center text-[11px] text-neutral-400 flex items-center justify-center gap-1 font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Secured via 256-bit bank-grade encryption</span>
                      </p>
                    </div>
                  )}

                  {/* Order ID Reference Pill */}
                  <div className="mt-4 pt-3 border-t border-neutral-200/60 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                    <span className="font-mono">Order ID: <strong className="text-neutral-800 font-bold">{order.id}</strong></span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsReceiptModalOpen(true)}
                        className="text-primary hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        <span>Official Receipt</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyOrderId}
                        className="text-neutral-600 hover:text-neutral-900 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        {copiedOrderId ? 'Copied ID' : 'Copy Full ID'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Fulfillment Timeline Radar */}
              <OrderStatusTimeline
                status={order.status}
                serviceType={order.service_type}
                cancellationReason={(order as unknown as { cancellation_reason?: string }).cancellation_reason}
                refundRequired={(order as unknown as { refund_required?: boolean }).refund_required}
                isCashOnDelivery={isCashOrder}
                estimatedMinutes={(order as unknown as { estimated_minutes?: number }).estimated_minutes || 18}
                distanceKm={(order as unknown as { distance_km?: number }).distance_km || 3.2}
              />

              {/* Delivery Confirmation PIN (Security Pass) - ONLY shown when confirmed/paid */}
              {isConfirmed && order.delivery_pin && order.status !== 'delivered' && order.status !== 'cancelled' && (
                <DeliveryPinCard pin={order.delivery_pin} />
              )}

              {/* Interactive Live Delivery Map */}
              {isConfirmed && order.status !== 'cancelled' && (
                <DeliveryLiveMap
                  status={order.status}
                  isCashOnDelivery={isCashOrder}
                  riderName={assignedRider?.name || undefined}
                  riderPhone={assignedRider?.phone || undefined}
                  vendorName={
                    (order as unknown as { vendors?: { business_name?: string } | null })?.vendors?.business_name ||
                    (order as unknown as { vendor?: { business_name?: string } | null })?.vendor?.business_name ||
                    'Restaurant Kitchen'
                  }
                  deliveryAddress={order.delivery_address || 'Delivery Destination'}
                  distanceKm={(order as unknown as { distance_km?: number }).distance_km || 3.2}
                />
              )}

              {/* Direct WhatsApp Dispatch Bridge */}
              {isConfirmed && order.status !== 'cancelled' && (
                <WhatsappDispatchBridge
                  orderNumber={order.id.slice(0, 8).toUpperCase()}
                  customerName={(order as unknown as { customer_name?: string }).customer_name || 'Customer'}
                  deliveryAddress={order.delivery_address || 'Delivery Destination'}
                  riderName={assignedRider?.name || undefined}
                  riderPhone={assignedRider?.phone || undefined}
                  vendorName={
                    (order as unknown as { vendors?: { business_name?: string } | null })?.vendors?.business_name ||
                    (order as unknown as { vendor?: { business_name?: string } | null })?.vendor?.business_name ||
                    'Kitchen Store'
                  }
                />
              )}

              {/* Destination & Delivery Address Card */}
              <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-neutral-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900">Delivery Destination</h3>
                    <p className="text-xs text-neutral-500">Recipient details & handover address</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200/60 text-sm">
                  <p className="font-semibold text-neutral-900">{order.delivery_address}</p>
                </div>

                {order.special_instructions && (
                  <div className="rounded-2xl bg-amber-50/50 p-4 border border-amber-200/60 text-xs text-neutral-800 space-y-1">
                    <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <FileText className="h-3 w-3 text-amber-700" />
                      Special Instructions
                    </span>
                    <p className="italic font-medium">&ldquo;{order.special_instructions}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* Order Actions Bar */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDisputeModalOpen(true)}
                    className="w-full sm:flex-1 rounded-xl text-rose-700 border-rose-200 bg-rose-50/50 hover:bg-rose-100 hover:text-rose-800 gap-2 font-bold h-12 sm:h-11 text-xs sm:text-sm"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Cancel or Dispute</span>
                  </Button>
                )}
                <Button asChild variant="outline" className="w-full sm:flex-1 rounded-xl h-12 sm:h-11 text-xs sm:text-sm font-bold">
                  <Link to="/" className="inline-flex items-center justify-center gap-2">
                    <Home className="h-4 w-4" aria-hidden="true" />
                    <span>Back to Home</span>
                  </Link>
                </Button>
                <Button asChild variant="primary" className="w-full sm:flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white h-12 sm:h-11 text-xs sm:text-sm font-bold shadow-xs">
                  <Link to="/food" className="inline-flex items-center justify-center gap-2">
                    <Utensils className="h-4 w-4" aria-hidden="true" />
                    <span>Explore More Vendors</span>
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right Column (5 of 12): Sticky Itemized Receipt & Authoritative Breakdown */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-neutral-900">Order Summary</h2>
                      <p className="text-xs text-neutral-500">
                        {order.order_items?.length || 0} {(order.order_items?.length || 0) === 1 ? 'Item' : 'Items'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-neutral-100 font-mono text-xs text-neutral-700">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </Badge>
                </div>

                {/* Official Receipt Action Row */}
                <div className="flex items-center gap-2 pt-1 pb-1">
                  <button
                    type="button"
                    onClick={() => setIsReceiptModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 py-2 px-3 text-xs font-bold text-neutral-800 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5 text-primary" />
                    <span>Print / PDF Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const msg = generateReceiptWhatsAppText(order, payment, extractedRiderTip)
                      const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`
                      const popup = window.open(waUrl, '_blank')
                      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                        window.location.href = waUrl
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 py-2 px-3 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                  >
                    <Share2 className="h-3.5 w-3.5 text-emerald-700" />
                    <span>WhatsApp</span>
                  </button>
                </div>

                {/* Itemized List */}
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1 divide-y divide-neutral-100">
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3 text-xs sm:text-sm">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-neutral-100 font-bold text-neutral-700 text-xs">
                            {item.quantity}×
                          </span>
                          <span className="font-semibold text-neutral-900">{item.product_name}</span>
                        </div>
                        <p className="text-caption text-neutral-400 pl-6">
                          Unit: {formatNgn(item.unit_price)}
                        </p>
                      </div>
                      <span className="font-bold text-neutral-900 shrink-0">
                        {formatNgn(item.line_total)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Authoritative Financial Breakdown */}
                <div className="space-y-2.5 border-t border-neutral-100 pt-4 text-xs sm:text-sm">
                  <div className="flex justify-between text-neutral-600">
                    <span>Subtotal</span>
                    <span className="font-semibold text-neutral-900">{formatNgn(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Platform Service Fee</span>
                    <span className="font-semibold text-neutral-900">
                      {formatNgn((order as any).service_fee ?? 150)}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-600">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-neutral-900">
                      {order.delivery_fee && order.delivery_fee > 0
                        ? formatNgn(order.delivery_fee)
                        : '₦0.00 (Launch Preview)'}
                    </span>
                  </div>
                  {extractedRiderTip > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Rider Appreciation Tip (100% to Rider)</span>
                      <span className="font-bold">{formatNgn(extractedRiderTip)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between border-t border-neutral-200/80 pt-3 text-base font-bold text-neutral-900">
                    <span>Total Amount</span>
                    <span className="text-xl sm:text-2xl font-black text-primary">
                      {formatNgn(order.total)}
                    </span>
                  </div>
                </div>

                {/* Payment Record Details (if paid or reference present) */}
                <div className="rounded-2xl bg-neutral-50 p-4 border border-neutral-200/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 font-medium">Payment Status:</span>
                    <span
                      className={`font-bold capitalize ${
                        isConfirmed
                          ? 'text-emerald-700'
                          : isFailedOrCancelled
                          ? 'text-rose-700'
                          : 'text-amber-800'
                      }`}
                    >
                      {isCashOrder
                        ? 'Pay on Delivery (Cash)'
                        : isConfirmed
                        ? isFlutterwave
                          ? 'Paid (Flutterwave)'
                          : 'Paid (Paystack)'
                        : isFailedOrCancelled
                        ? 'Payment Failed / Cancelled'
                        : isPendingConfirmation
                        ? 'Payment Being Confirmed'
                        : 'Payment Pending'}
                    </span>
                  </div>
                  {(payment?.paystack_reference || reference) && (
                    <div className="flex items-center justify-between text-neutral-500">
                      <span>Reference:</span>
                      <span className="font-mono font-bold text-neutral-800">
                        {payment?.paystack_reference || reference}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-neutral-500">
                    <span>Channel:</span>
                    <span className="capitalize font-medium text-neutral-800">
                      {isCashOrder
                        ? 'Cash on Delivery'
                        : isFlutterwave
                        ? 'Flutterwave'
                        : payment?.channel || 'Paystack'}
                    </span>
                  </div>
                </div>

                {/* Official Invoice / Receipt Action Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReceiptModalOpen(true)}
                  className="w-full h-11 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 shadow-2xs"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  <span>View Official Receipt &amp; Invoice</span>
                </Button>

                {/* Guaranteed Ledger Badge */}
                <div className="flex items-center justify-center gap-1.5 text-caption text-neutral-400 pt-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span className="font-medium">Database Authoritative Record Guaranteed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        orderId={order.id}
        orderNumber={order.id.slice(0, 8).toUpperCase()}
        isPaid={order.status === 'payment_confirmed'}
        onCancelled={() => {
          fetchOrderAndPayment()
        }}
      />

      <SmartDisputeResolutionModal
        isOpen={isDisputeModalOpen}
        onClose={() => setIsDisputeModalOpen(false)}
        orderId={order.id}
        orderNumber={order.id.slice(0, 8).toUpperCase()}
        status={order.status}
        totalAmount={order.total}
        deliveryFee={order.delivery_fee}
        onResolved={() => {
          fetchOrderAndPayment()
        }}
      />

      <OrderReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        order={order}
        payment={payment}
        riderTip={extractedRiderTip}
      />
    </PageContainer>
  )
}

