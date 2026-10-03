import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ShoppingBag, ArrowRight } from 'lucide-react'
import { useCartStore } from '@/stores/cart-store'
import { formatNgn } from '@/utils/formatting'
import { cn } from '@/lib/cn'

export interface FloatingCartBarProps {
  className?: string
}

export function FloatingCartBar({ className }: FloatingCartBarProps) {
  const location = useLocation()
  const items = useCartStore((state) => state.items)
  const vendor = useCartStore((state) => state.vendor)
  const getItemCount = useCartStore((state) => state.getItemCount)
  const getSubtotal = useCartStore((state) => state.getSubtotal)
  const setCartOpen = useCartStore((state) => state.setCartOpen)

  const itemCount = getItemCount()
  const subtotal = getSubtotal()

  const [isBouncing, setIsBouncing] = useState(false)
  const prevCountRef = useRef(itemCount)

  useEffect(() => {
    if (itemCount > prevCountRef.current) {
      setIsBouncing(true)
      const timer = setTimeout(() => setIsBouncing(false), 500)
      return () => clearTimeout(timer)
    }
    prevCountRef.current = itemCount
  }, [itemCount])

  // Suppress on checkout, cart, order confirmation, or non-shopping routes
  const pathname = location.pathname
  const isHiddenRoute =
    pathname === '/cart' ||
    pathname === '/checkout' ||
    pathname.startsWith('/order/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/rider') ||
    pathname.startsWith('/auth')

  if (items.length === 0 || itemCount === 0 || isHiddenRoute) {
    return null
  }

  return (
    <aside
      role="region"
      aria-label="Floating cart summary"
      data-testid="floating-cart-bar"
      className={cn(
        'fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 sm:left-4 sm:right-4 z-40 max-w-md mx-auto',
        'lg:hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label="Open cart"
        className={cn(
          'w-full flex items-center justify-between gap-3 rounded-2xl bg-neutral-900/95 p-3 text-white shadow-2xl',
          'border border-white/10 backdrop-blur-md ring-1 ring-black/10 transition-all text-left',
          'hover:bg-neutral-900 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          'animate-in slide-in-from-bottom-3 fade-in duration-200'
        )}
      >
        {/* Left: Cart Icon & Details */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm ring-2 ring-primary/20 transition-transform duration-300',
              isBouncing && 'animate-cart-spring'
            )}
            aria-hidden="true"
          >
            <ShoppingBag className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white tracking-wide">
              <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
              <span className="text-neutral-500" aria-hidden="true">•</span>
              <span className="text-primary-light font-extrabold">{formatNgn(subtotal)}</span>
            </div>
            {vendor && (
              <p className="truncate text-[11px] text-neutral-400">
                {vendor.name}
              </p>
            )}
          </div>
        </div>

        {/* Right: View Cart Action Indicator */}
        <div
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary-hover active:scale-95 transition-all"
          aria-hidden="true"
        >
          <span>View Cart</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </button>
    </aside>
  )
}
