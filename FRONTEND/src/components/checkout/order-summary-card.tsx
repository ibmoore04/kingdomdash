import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, Info, ShieldCheck, Loader2, Gift } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import { useCartStore, type CartItem } from '@/stores/cart-store'

import { Tag, X } from 'lucide-react'

export interface OrderSummaryCardProps {
  items: CartItem[]
  subtotal: number
  deliveryFee: number | null
  serviceFee?: number
  promoDiscount?: number
  appliedPromoCode?: string
  onApplyPromo?: (code: string) => void
  onRemovePromo?: () => void
  promoError?: string | null
  pointsDiscount?: number
  availablePoints?: number
  onApplyPoints?: (pts: number) => void
  onRemovePoints?: () => void
  isKdPassApplied?: boolean
  isLoadingPricing?: boolean
  isPinned?: boolean
  isServiceable?: boolean
  distanceKm?: number | null
  baseFee?: number | null
  distanceRate?: number | null
  pricingTier?: number | null
}

export function OrderSummaryCard({
  items,
  subtotal,
  deliveryFee,
  serviceFee = 150,
  promoDiscount = 0,
  appliedPromoCode,
  onApplyPromo,
  onRemovePromo,
  promoError,
  pointsDiscount = 0,
  availablePoints = 0,
  onApplyPoints,
  onRemovePoints,
  isKdPassApplied = false,
  isLoadingPricing = false,
  isPinned = true,
  isServiceable = true,
  distanceKm: _distanceKm,
  baseFee: _baseFee,
  distanceRate: _distanceRate,
  pricingTier: _pricingTier,
}: OrderSummaryCardProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)
  const [showServiceFeeTooltip, setShowServiceFeeTooltip] = useState(false)
  const [promoInput, setPromoInput] = useState('')

  const baseDeliveryFee = deliveryFee !== null ? deliveryFee : 0
  const effectiveDeliveryFee = isKdPassApplied ? 0 : baseDeliveryFee
  const grandTotal = Math.max(
    0,
    subtotal - promoDiscount - pointsDiscount + effectiveDeliveryFee + serviceFee
  )
  const totalItemCount = items.reduce((acc, curr) => acc + curr.quantity, 0)

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault()
    if (promoInput.trim() && onApplyPromo) {
      onApplyPromo(promoInput.trim())
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header with Edit Cart link */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3.5">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900">
          Your Order{' '}
          <span className="text-xs font-normal text-neutral-500">
            ({totalItemCount} {totalItemCount === 1 ? 'item' : 'items'})
          </span>
        </h2>
        <Link
          to="/cart"
          className="text-xs font-bold text-primary hover:text-primary-hover hover:underline transition-colors"
        >
          Edit Cart
        </Link>
      </div>

      {/* Cart Items List */}
      <div className="divide-y divide-neutral-100 max-h-80 overflow-y-auto pr-1">
        {items.map((item) => {
          return (
            <div key={item.productId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {/* Thumbnail */}
              <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100 border border-neutral-200/80">
                <img
                  src={item.imageUrl || '/kingdomdash-backup.jpg'}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/kingdomdash-backup.jpg'
                  }}
                />
              </div>

              {/* Item Info & Stepper */}
              <div className="flex-1 min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                  {item.name}
                </h3>
                <p className="text-[11px] text-neutral-500 capitalize">
                  {item.serviceType === 'food' ? 'Standard' : '1 piece'}
                </p>

                {/* Inline Stepper */}
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-neutral-200 bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => {
                        if (item.quantity <= 1) {
                          removeItem(item.productId)
                        } else {
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-l-lg transition-colors"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold text-neutral-800 select-none">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.quantity < 999) {
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                      }}
                      className="flex h-6 w-6 items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 rounded-r-lg transition-colors"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Price & Delete Action */}
              <div className="flex flex-col items-end justify-between self-stretch">
                <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
                  {formatNgn(item.price * item.quantity)}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="p-1 text-neutral-400 hover:text-error transition-colors rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label={`Remove ${item.name} from cart`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Promo Code Input or Applied Badge */}
      <div className="border-t border-neutral-100 pt-3.5">
        {appliedPromoCode && promoDiscount > 0 ? (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <Tag className="h-3.5 w-3.5 text-emerald-600" />
              <span>Promo applied: <strong className="font-mono text-emerald-900">{appliedPromoCode}</strong></span>
            </div>
            {onRemovePromo && (
              <button
                type="button"
                onClick={onRemovePromo}
                className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md hover:bg-emerald-100 transition-colors"
                aria-label="Remove promo code"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleApply} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Promo code (e.g. SWIFTLAUNCH)"
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50/50 px-3 py-2 text-xs font-mono uppercase text-neutral-900 placeholder:text-neutral-400 placeholder:font-sans focus:border-primary focus:bg-white focus:outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!promoInput.trim()}
                className="rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed px-3.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
            {promoError && (
              <p className="text-[11px] text-error font-medium px-1">{promoError}</p>
            )}
          </form>
        )}

        {availablePoints > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-amber-900 font-semibold">
                <Gift className="h-4 w-4 text-amber-600" />
                <span>DashPoints ({availablePoints} available)</span>
              </div>
              {pointsDiscount > 0 ? (
                <button
                  type="button"
                  onClick={onRemovePoints}
                  className="text-xs font-bold text-amber-800 hover:underline"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onApplyPoints && onApplyPoints(Math.min(availablePoints, subtotal))}
                  className="rounded-lg bg-amber-600 hover:bg-amber-700 px-2.5 py-1 text-[11px] font-bold text-white transition-colors"
                >
                  Redeem {formatNgn(Math.min(availablePoints, subtotal))}
                </button>
              )}
            </div>
            {pointsDiscount > 0 && (
              <p className="mt-1 text-[11px] text-amber-700 font-medium">
                Applied {pointsDiscount} DashPoints discount to this order!
              </p>
            )}
          </div>
        )}
      </div>

      {/* Financial Calculations Breakdown */}
      <div className="space-y-2.5 border-t border-neutral-100 pt-3.5 text-xs sm:text-sm">
        <div className="flex items-center justify-between text-neutral-600">
          <span>Subtotal</span>
          <span className="font-semibold text-neutral-900">{formatNgn(subtotal)}</span>
        </div>

        {promoDiscount > 0 && (
          <div className="flex items-center justify-between text-emerald-600 font-medium">
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              <span>Discount ({appliedPromoCode})</span>
            </span>
            <span className="font-semibold">-{formatNgn(promoDiscount)}</span>
          </div>
        )}

        {pointsDiscount > 0 && (
          <div className="flex items-center justify-between text-amber-700 font-medium">
            <span className="flex items-center gap-1">
              <Gift className="h-3.5 w-3.5 text-amber-600" />
              <span>DashPoints Redeemed</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">-{formatNgn(pointsDiscount)}</span>
              {onRemovePoints && (
                <button
                  type="button"
                  onClick={onRemovePoints}
                  className="text-neutral-400 hover:text-neutral-600"
                  aria-label="Remove points discount"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-neutral-600">
          <span className="flex items-center gap-1.5">
            <span>Delivery Fee</span>
            {isKdPassApplied && (
              <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                KD Pass
              </span>
            )}
          </span>
          {isKdPassApplied ? (
            <span className="font-bold text-emerald-600">FREE</span>
          ) : isLoadingPricing ? (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Calculating...</span>
            </span>
          ) : !isPinned ? (
            <span className="text-xs text-amber-600 font-medium">Pin required</span>
          ) : !isServiceable ? (
            <span className="text-xs text-error font-medium">Outside area</span>
          ) : deliveryFee !== null ? (
            <span className="font-semibold text-neutral-900">{formatNgn(deliveryFee)}</span>
          ) : (
            <span className="font-semibold text-neutral-400">—</span>
          )}
        </div>

        <div className="relative flex items-center justify-between text-neutral-600">
          <div className="flex items-center gap-1">
            <span>Service Fee</span>
            <button
              type="button"
              onClick={() => setShowServiceFeeTooltip((prev) => !prev)}
              className="text-neutral-400 hover:text-neutral-600 transition-colors"
              aria-label="Service fee information"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            {showServiceFeeTooltip && (
              <div className="absolute left-0 bottom-full mb-1 z-30 rounded-lg border border-neutral-200 bg-neutral-900 text-white p-2 text-[11px] shadow-lg max-w-xs">
                Helps power platform operations, continuous safety improvements, and customer support.
              </div>
            )}
          </div>
          <span className="font-semibold text-neutral-900">{formatNgn(serviceFee)}</span>
        </div>

        <div className="border-t border-neutral-100 pt-3 flex items-center justify-between">
          <span className="text-sm sm:text-base font-extrabold text-neutral-900">Total</span>
          <span className="text-lg sm:text-xl font-extrabold text-primary">
            {formatNgn(grandTotal)}
          </span>
        </div>
      </div>

      {/* Payment Reassurance Box */}
      <div className="rounded-xl border border-neutral-100 bg-neutral-50/80 p-3 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-neutral-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold text-neutral-900">
            You won&apos;t be charged yet.
          </p>
          <p className="text-[11px] text-neutral-500">
            Review your order and proceed to payment.
          </p>
        </div>
      </div>
    </div>
  )
}
