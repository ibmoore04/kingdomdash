import { cn } from '@/lib/cn'

export interface ProductCardSkeletonProps {
  count?: number
  className?: string
}

export function ProductCardSkeleton({ count = 1, className }: ProductCardSkeletonProps) {
  const skeletons = Array.from({ length: count })

  return (
    <>
      {skeletons.map((_, i) => (
        <div
          key={i}
          data-testid="product-card-skeleton"
          className={cn(
            'flex gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs',
            className
          )}
        >
          {/* Square Image Box */}
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg animate-shimmer bg-neutral-200" />

          {/* Content details */}
          <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
            <div className="space-y-2">
              <div className="h-4 w-3/5 rounded-md animate-shimmer bg-neutral-200" />
              <div className="h-3 w-4/5 rounded-md animate-shimmer bg-neutral-200" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="h-4 w-16 rounded-md animate-shimmer bg-neutral-200" />
              <div className="h-7 w-16 rounded-full animate-shimmer bg-neutral-200" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
