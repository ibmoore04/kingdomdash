import { cn } from '@/lib/cn'

export interface OrderCardSkeletonProps {
  count?: number
  className?: string
}

/**
 * Zero-CLS placeholder matching CustomerOrderCard dimensions:
 * header bar, merchant/destination grid, item lines, and footer actions.
 */
export function OrderCardSkeleton({ count = 1, className }: OrderCardSkeletonProps) {
  const skeletons = Array.from({ length: count })

  return (
    <>
      {skeletons.map((_, i) => (
        <div
          key={i}
          data-testid="order-card-skeleton"
          aria-hidden="true"
          className={cn(
            'overflow-hidden rounded-3xl border border-neutral-200/90 bg-white shadow-xs',
            className
          )}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between gap-3 border-b border-neutral-100 bg-neutral-50/50 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 rounded-full animate-shimmer bg-neutral-200" />
              <div className="h-5 w-20 rounded-md animate-shimmer bg-neutral-200" />
            </div>
            <div className="h-6 w-28 rounded-full animate-shimmer bg-neutral-200" />
          </div>

          {/* Body */}
          <div className="space-y-4 p-4 sm:p-5">
            {/* Merchant & destination grid */}
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-100 bg-neutral-50/70 p-3.5 sm:grid-cols-2">
              {[0, 1].map((col) => (
                <div key={col} className="flex items-start gap-2.5">
                  <div className="h-8 w-8 shrink-0 rounded-xl animate-shimmer bg-neutral-200" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 w-20 rounded animate-shimmer bg-neutral-200" />
                    <div className="h-3.5 w-3/4 rounded animate-shimmer bg-neutral-200" />
                  </div>
                </div>
              ))}
            </div>

            {/* Item lines */}
            <div className="space-y-2 rounded-2xl border border-neutral-100 p-3.5">
              <div className="h-3 w-full rounded animate-shimmer bg-neutral-200" />
              <div className="h-3 w-5/6 rounded animate-shimmer bg-neutral-200" />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <div className="h-6 w-32 rounded animate-shimmer bg-neutral-200" />
              <div className="h-8 w-28 rounded-lg animate-shimmer bg-neutral-200" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
