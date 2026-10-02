import React from 'react'
import { Link } from 'react-router-dom'
import {
  Utensils,
  ShoppingBag,
  Package,
  Sparkles,
  MapPin,
  Clock,
  KeyRound,
  CreditCard,
  Star,
  XCircle,
  Building2,
  ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'

export interface CustomerOrderCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingReview?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReviewClick?: (order: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCancelClick?: (order: any) => void
}

export const CustomerOrderCard: React.FC<CustomerOrderCardProps> = ({
  order,
  existingReview,
  onReviewClick,
  onCancelClick,
}) => {
  const isPending =
    order.status === 'pending' ||
    order.status === 'payment_pending' ||
    order.status === 'payment_processing'
  const isCancelled = order.status === 'cancelled'
  const isDelivered = order.status === 'delivered'
  const canCancel =
    order.status === 'pending' ||
    order.status === 'payment_pending' ||
    order.status === 'payment_processing' ||
    order.status === 'payment_confirmed'

  // Service Badge metadata
  const renderServiceBadge = (type?: string) => {
    switch (type) {
      case 'food':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
            <Utensils className="h-3.5 w-3.5 text-rose-600" />
            <span>Food Order</span>
          </span>
        )
      case 'grocery':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-600" />
            <span>Grocery Delivery</span>
          </span>
        )
      case 'courier':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
            <Package className="h-3.5 w-3.5 text-blue-600" />
            <span>Courier Dispatch</span>
          </span>
        )
      case 'custom':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>Market Concierge</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-800 border border-neutral-200">
            <ShoppingBag className="h-3.5 w-3.5 text-neutral-600" />
            <span>Order</span>
          </span>
        )
    }
  }

  // Status Badge with Pulse Indicator
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'payment_pending':
      case 'payment_processing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300/80 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Awaiting Payment</span>
          </span>
        )
      case 'payment_confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 border border-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Payment Confirmed</span>
          </span>
        )
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-900 border border-purple-200">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <span>Kitchen Preparing</span>
          </span>
        )
      case 'ready_for_pickup':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-900 border border-indigo-200">
            <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>Ready for Rider</span>
          </span>
        )
      case 'picked_up':
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900 border border-emerald-300 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Out for Delivery</span>
          </span>
        )
      case 'delivered':
        return (
          <Badge variant="success" className="bg-emerald-100/80 text-emerald-900 border-emerald-300 font-bold">
            Delivered
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="error" className="bg-rose-100 text-rose-900 border-rose-300 font-bold">
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge variant="default" className="capitalize font-bold">
            {status}
          </Badge>
        )
    }
  }

  const merchantName =
    order.vendors?.business_name ||
    (order.service_type === 'courier'
      ? 'Direct Courier Dispatch'
      : order.service_type === 'custom'
      ? order.pickup_address || 'Ijebu Market Concierge'
      : 'KingdomDash Merchant')

  return (
    <div
      className={`rounded-3xl border bg-white overflow-hidden shadow-xs hover:shadow-md transition-all ${
        isPending
          ? 'border-amber-300 ring-1 ring-amber-200/80 bg-gradient-to-b from-amber-50/20 to-white'
          : isCancelled
          ? 'border-neutral-200 bg-neutral-50/40 opacity-90'
          : 'border-neutral-200/90'
      }`}
    >
      {/* 1. Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {renderServiceBadge(order.service_type)}
          <span className="font-mono text-xs font-bold text-neutral-600 bg-neutral-200/60 px-2 py-0.5 rounded-md">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-neutral-300 text-xs hidden sm:inline">•</span>
          <span className="text-xs text-neutral-500 font-medium">
            {new Date(order.created_at).toLocaleDateString('en-NG', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div>{renderStatusBadge(order.status)}</div>
      </div>

      {/* 2. Main Content Body */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Merchant & Delivery Route */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-neutral-50/70 rounded-2xl p-3.5 border border-neutral-100 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-neutral-500 tracking-wider block">
                Merchant / Store
              </span>
              <span className="font-bold text-neutral-900 text-xs sm:text-sm block line-clamp-1">
                {merchantName}
              </span>
              {order.pickup_address && order.service_type !== 'courier' && (
                <span className="text-[11px] text-neutral-500 line-clamp-1">
                  {order.pickup_address}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5 sm:border-l sm:border-neutral-200 sm:pl-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 mt-0.5">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-neutral-500 tracking-wider block">
                Delivery Destination
              </span>
              <span className="font-medium text-neutral-800 text-xs line-clamp-1">
                {order.delivery_contact ? `${order.delivery_contact} • ` : ''}
                {order.delivery_address}
              </span>
              {order.delivery_phone && (
                <span className="text-[11px] text-neutral-500 block">
                  Phone: {order.delivery_phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Items List Breakdown */}
        {order.order_items && order.order_items.length > 0 && (
          <div className="rounded-2xl bg-white p-3.5 border border-neutral-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              <span>Items ({order.order_items.length})</span>
              <span>Subtotal</span>
            </div>
            <ul className="divide-y divide-neutral-100 text-xs space-y-1">
              {order.order_items.slice(0, 3).map((item: any) => (
                <li key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2">
                  <span className="text-neutral-800 font-medium">
                    <span className="font-mono font-bold text-primary mr-1 bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                      {item.quantity}×
                    </span>
                    {item.product_name}
                  </span>
                  <span className="font-mono font-bold text-neutral-900 shrink-0">
                    {formatNgn(item.line_total || item.unit_price * item.quantity)}
                  </span>
                </li>
              ))}
              {order.order_items.length > 3 && (
                <li className="pt-1.5 text-[11px] text-neutral-500 italic">
                  +{order.order_items.length - 3} more items...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Special Instructions / Cancellation Reason if present */}
        {order.cancellation_reason && isCancelled && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-900 space-y-1">
            <span className="font-bold flex items-center gap-1.5 text-rose-800">
              <XCircle className="h-3.5 w-3.5" />
              Reason for Cancellation:
            </span>
            <p className="text-[11px] text-rose-700 leading-snug">{order.cancellation_reason}</p>
          </div>
        )}

        {/* Delivery PIN Security Pill */}
        {order.delivery_pin && !isDelivered && !isCancelled && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:px-4">
            <div className="flex items-center gap-2 text-xs">
              <KeyRound className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="font-bold text-neutral-900 block">Delivery Confirmation PIN</span>
                <span className="text-[11px] text-neutral-600 hidden sm:inline">
                  Provide this 4-digit security code to your rider upon arrival
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-white px-3 py-1 font-mono text-base font-extrabold tracking-widest text-primary shadow-2xs">
              {order.delivery_pin}
            </div>
          </div>
        )}

        {/* Pending Payment Notice Banner */}
        {isPending && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-0.5">
                <p className="font-bold">Awaiting Payment Confirmation</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Your order is recorded. Please click <strong>Pay Now</strong> to pay securely via Paystack so preparation can begin immediately.
                </p>
              </div>
            </div>
            <Button
              asChild
              variant="primary"
              size="sm"
              className="shrink-0 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1.5"
            >
              <Link to={`/order/${order.id}/confirmation`}>
                <CreditCard className="h-3.5 w-3.5" />
                <span>Complete Payment</span>
              </Link>
            </Button>
          </div>
        )}

        {/* 3. Financials & Action Row Footer */}
        <div className="pt-3 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-neutral-500">Total Amount:</span>
            <span className="text-lg font-extrabold text-primary font-mono">
              {formatNgn(order.total)}
            </span>
            <span className="text-[11px] text-neutral-400">
              (incl. {formatNgn(order.delivery_fee)} delivery)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cancel Order Button */}
            {canCancel && onCancelClick && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onCancelClick(order)}
                className="gap-1.5 text-xs font-bold text-rose-700 border-rose-200 bg-rose-50/50 hover:bg-rose-100 hover:text-rose-800 hover:border-rose-300"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancel Order</span>
              </Button>
            )}

            {/* Rate Order Button */}
            {isDelivered && onReviewClick && (
              existingReview ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>{existingReview.rating}.0 Rated</span>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onReviewClick(order)}
                  className="gap-1.5 text-xs font-bold text-amber-900 border-amber-300 bg-amber-50/80 hover:bg-amber-100"
                >
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span>Rate Order</span>
                </Button>
              )
            )}

            {/* Primary Action Button (Pay Now or Track) */}
            {isPending ? (
              <Button
                asChild
                variant="primary"
                size="sm"
                className="gap-1.5 bg-primary hover:bg-primary/90 text-white font-bold shadow-xs text-xs"
              >
                <Link to={`/order/${order.id}/confirmation`}>
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Pay Now ({formatNgn(order.total)})</span>
                </Link>
              </Button>
            ) : !isCancelled ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-bold border-neutral-300 text-neutral-800 hover:text-primary hover:border-primary"
              >
                <Link to={`/order/${order.id}/confirmation`}>
                  <span>Track Delivery</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
