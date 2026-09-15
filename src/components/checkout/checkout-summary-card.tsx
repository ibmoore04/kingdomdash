import { AlertTriangle, Info, Lock, Loader2, Navigation, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import { formatDistanceKm } from '@/utils/geo'

export interface CheckoutSummaryCardProps {
  subtotal: number
  isSubmitting: boolean
  disabled?: boolean
  error?: string | null
  distanceKm?: number | null
  deliveryFee?: number | null
  baseFee?: number | null
  distanceRate?: number | null
  pricingTier?: number | null
  isLoadingPricing?: boolean
  isPinned?: boolean
  isServiceable?: boolean
  serviceAreaName?: string
  paymentMethod?: 'paystack' | 'bank_transfer' | 'cash_on_delivery'
  onSubmitOrder: () => void
}

export function CheckoutSummaryCard({
  subtotal,
  isSubmitting,
  disabled = false,
  error = null,
  distanceKm = null,
  deliveryFee = null,
  baseFee = null,
  distanceRate = null,
  isLoadingPricing = false,
  isPinned = true,
  isServiceable = true,
  serviceAreaName = 'Ijebu-Ode Central',
  paymentMethod = 'paystack',
  onSubmitOrder,
}: CheckoutSummaryCardProps) {
  const finalTotal = deliveryFee !== null ? subtotal + deliveryFee : subtotal

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
      <h3 className="text-h4 font-bold text-text-primary border-b border-border pb-3">
        Order Summary
      </h3>

      {error && (
        <div
          role="alert"
          className="rounded-xl bg-error/10 border border-error/20 p-3.5 text-caption text-error space-y-1"
        >
          <p className="font-semibold">Unable to place order</p>
          <p>{error}</p>
        </div>
      )}

      {/* Service Area Outside Warning */}
      {!isServiceable && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-caption text-amber-800 flex gap-2.5 items-start"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Your delivery address is outside the <strong>{serviceAreaName}</strong> zone. Deliveries outside this active zone cannot be processed.
          </p>
        </div>
      )}

      {/* Unpinned Address Warning */}
      {!isPinned && (
        <div
          role="alert"
          className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-caption text-amber-800 flex gap-2.5 items-start"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Please pin your delivery location on the map to calculate distance and delivery fee.
          </p>
        </div>
      )}

      <div className="space-y-3 text-body-small">
        <div className="flex items-center justify-between text-text-secondary">
          <span>Subtotal</span>
          <span className="font-semibold text-text-primary">{formatNgn(subtotal)}</span>
        </div>

        {/* Straight-line distance preview */}
        {distanceKm !== null && distanceKm !== undefined && (
          <div className="flex items-center justify-between text-text-secondary">
            <span className="flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              <span>Straight-Line Distance</span>
            </span>
            <span className="font-semibold text-text-primary">
              {formatDistanceKm(distanceKm)}{' '}
              <span className="text-[11px] font-normal text-text-muted">(Haversine)</span>
            </span>
          </div>
        )}

        {/* Distance-Based Delivery Fee */}
        <div className="flex items-center justify-between text-text-secondary">
          <span>Delivery Fee</span>
          {isLoadingPricing ? (
            <span className="flex items-center gap-1.5 text-caption text-text-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              <span>Calculating...</span>
            </span>
          ) : !isPinned ? (
            <span className="text-caption text-amber-600 font-medium">Pin required</span>
          ) : !isServiceable ? (
            <span className="text-caption text-error font-medium">Outside area</span>
          ) : deliveryFee !== null ? (
            <span className="font-bold text-text-primary">{formatNgn(deliveryFee)}</span>
          ) : (
            <span className="font-semibold text-text-muted">—</span>
          )}
        </div>

        {/* Delivery Fee Calculation Breakdown Note */}
        {deliveryFee !== null && baseFee !== null && distanceRate !== null && (
          <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-2.5 text-[11px] text-text-secondary flex gap-2 items-start">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-tight">
              Delivery fee calculated based on straight-line distance ({formatNgn(baseFee)} base + {formatNgn(distanceRate)}/km).
            </p>
          </div>
        )}

        <div className="pt-3 border-t border-border flex items-center justify-between">
          <span className="text-body font-bold text-text-primary">
            {deliveryFee !== null ? 'Estimated Total' : 'Order Subtotal'}
          </span>
          <span className="text-h3 font-extrabold text-primary">
            {formatNgn(finalTotal)}
          </span>
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="button"
          variant="primary"
          onClick={onSubmitOrder}
          disabled={disabled || isSubmitting || !isServiceable || !isPinned || isLoadingPricing}
          className="w-full rounded-xl py-3.5 text-button font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{paymentMethod === 'paystack' ? 'Connecting to Paystack...' : 'Processing Order...'}</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>
                {paymentMethod === 'paystack'
                  ? `Pay ${formatNgn(finalTotal)} with Paystack`
                  : 'Place Order'}
              </span>
            </>
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-caption text-text-muted pt-1">
        <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        <span>Database-authoritative atomic order verification</span>
      </div>
    </div>
  )
}
