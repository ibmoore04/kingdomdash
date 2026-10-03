import { cn } from '@/lib/cn'

export interface OrderTrackingSkeletonProps {
  className?: string
}

export function OrderTrackingSkeleton({ className }: OrderTrackingSkeletonProps) {
  return (
    <div
      data-testid="order-tracking-skeleton"
      className={cn('space-y-8 animate-in fade-in duration-200', className)}
    >
      {/* Hero Header Box Skeleton */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto h-16 w-16 rounded-full animate-shimmer bg-neutral-200 mb-4" />
        <div className="mx-auto h-6 w-36 rounded-full animate-shimmer bg-neutral-200 mb-3" />
        <div className="mx-auto h-8 w-64 rounded-xl animate-shimmer bg-neutral-200 mb-3" />
        <div className="mx-auto h-4 w-80 max-w-full rounded-md animate-shimmer bg-neutral-200 mb-6" />
        <div className="mx-auto h-9 w-48 rounded-xl animate-shimmer bg-neutral-200" />
      </div>

      {/* Radar Progress Pipeline Skeleton */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div className="h-5 w-44 rounded-md animate-shimmer bg-neutral-200" />
          <div className="h-6 w-24 rounded-full animate-shimmer bg-neutral-200" />
        </div>

        {/* Live status pill */}
        <div className="h-12 w-full rounded-2xl animate-shimmer bg-neutral-100" />

        {/* Step Circles */}
        <div className="flex justify-between items-center px-4 py-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex flex-col items-center gap-2">
              <div className="h-11 w-11 rounded-full animate-shimmer bg-neutral-200" />
              <div className="h-3 w-16 rounded-md animate-shimmer bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Security PIN Card Skeleton */}
      <div className="rounded-3xl border border-neutral-800 bg-neutral-950 p-6 shadow-xl space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
          <div className="h-5 w-48 rounded-md animate-shimmer bg-neutral-800" />
          <div className="h-6 w-32 rounded-full animate-shimmer bg-neutral-800" />
        </div>
        <div className="py-4 text-center">
          <div className="mx-auto h-16 w-64 rounded-2xl animate-shimmer bg-neutral-900" />
        </div>
      </div>

      {/* Details Box Skeleton */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs space-y-4">
        <div className="h-5 w-36 rounded-md animate-shimmer bg-neutral-200 border-b border-neutral-100 pb-3" />
        <div className="space-y-3">
          <div className="h-4 w-full rounded-md animate-shimmer bg-neutral-200" />
          <div className="h-4 w-3/4 rounded-md animate-shimmer bg-neutral-200" />
          <div className="h-4 w-1/2 rounded-md animate-shimmer bg-neutral-200" />
        </div>
      </div>
    </div>
  )
}
