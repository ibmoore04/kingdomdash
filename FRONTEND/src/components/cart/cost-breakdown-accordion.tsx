import { useState } from 'react'
import { ChevronDown, MapPin, ShieldCheck, Tag } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import { cn } from '@/lib/cn'

export interface CostBreakdownAccordionProps {
  subtotal: number
  deliveryFee?: number
  serviceFee?: number
  distanceKm?: number | null
  pricingTier?: number | null
  isLaunchPreview?: boolean
  className?: string
}

export function CostBreakdownAccordion({
  subtotal,
  deliveryFee = 0,
  serviceFee = 0,
  distanceKm,
  pricingTier,
  isLaunchPreview = true,
  className,
}: CostBreakdownAccordionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const total = subtotal + deliveryFee + serviceFee

  return (
    <div
      data-testid="cost-breakdown-accordion"
      className={cn('rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-2xs', className)}
    >
      {/* Header / Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between p-3.5 sm:px-4 text-left hover:bg-neutral-50/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-bold text-neutral-900">
            Transparent Pricing &amp; Fees
          </span>
          {isLaunchPreview && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
              Zero Fees
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
          <span>{isOpen ? 'Hide details' : 'View breakdown'}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-neutral-400 transition-transform duration-200',
              isOpen && 'rotate-180 text-neutral-700'
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded Breakdown */}
      {isOpen && (
        <div className="border-t border-neutral-100 bg-neutral-50/60 p-4 space-y-3 text-xs animate-in fade-in-50 duration-150">
          {/* Item Subtotal */}
          <div className="flex items-center justify-between text-neutral-600">
            <span>Items Subtotal</span>
            <span className="font-semibold text-neutral-900 font-mono">
              {formatNgn(subtotal)}
            </span>
          </div>

          {/* Distance-Based Delivery Tier */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Distance Delivery Fee</span>
                {distanceKm !== undefined && distanceKm !== null && (
                  <span className="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-mono font-bold text-neutral-800">
                    {distanceKm.toFixed(1)} km
                  </span>
                )}
                {pricingTier !== undefined && pricingTier !== null && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                    Tier {pricingTier}
                  </span>
                )}
              </span>
              <span className="font-semibold text-emerald-600 font-mono">
                {isLaunchPreview ? '₦0.00 (Launch Waived)' : formatNgn(deliveryFee)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 pl-5">
              {distanceKm !== undefined && distanceKm !== null
                ? `Calculated using Haversine straight-line coordinates from store to doorstep (${distanceKm.toFixed(1)} km).`
                : 'Standard Ijebu-Ode delivery radius (0–5 km). Fuel surcharge waived for launch preview.'}
            </p>
          </div>

          {/* Platform Service Fee */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>Safety &amp; Platform Fee</span>
              </span>
              <span className="font-semibold text-emerald-600 font-mono">
                {serviceFee === 0 ? '₦0.00 (Free)' : formatNgn(serviceFee)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 pl-5">
              Covers 24/7 customer resolution desk and dispatch GPS coordination.
            </p>
          </div>

          {/* Total Row */}
          <div className="pt-2.5 border-t border-neutral-200/80 flex items-center justify-between text-sm font-bold text-neutral-900">
            <span>Estimated Total</span>
            <span className="text-base text-primary font-black font-mono">
              {formatNgn(total)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
