import { cn } from '@/lib/cn'

export interface VendorCardSkeletonProps {
  count?: number
  className?: string
}

export function VendorCardSkeleton({ count = 1, className }: VendorCardSkeletonProps) {
  const skeletons = Array.from({ length: count })

  return (
    <>
      {skeletons.map((_, i) => (
        <div
          key={i}
          data-testid="vendor-card-skeleton"
          className={cn(
            'flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs',
            className
          )}
        >
          {/* Banner cover placeholder */}
          <div className="relative h-48 w-full animate-shimmer bg-neutral-200 overflow-hidden">
            {/* Top-right status badge placeholder */}
            <div className="absolute right-3 top-3 h-6 w-24 rounded-full bg-white/60 backdrop-blur-xs" />
            {/* Bottom-left meta chips */}
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <div className="h-6 w-14 rounded-full bg-white/60 backdrop-blur-xs" />
              <div className="h-6 w-16 rounded-full bg-white/60 backdrop-blur-xs" />
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
            <div className="space-y-2">
              <div className="h-5 w-3/4 rounded-md animate-shimmer bg-neutral-200" />
              <div className="h-3.5 w-full rounded-md animate-shimmer bg-neutral-200" />
              <div className="h-3.5 w-2/3 rounded-md animate-shimmer bg-neutral-200" />
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <div className="h-3.5 w-24 rounded-md animate-shimmer bg-neutral-200" />
              <div className="h-3.5 w-16 rounded-md animate-shimmer bg-neutral-200" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
