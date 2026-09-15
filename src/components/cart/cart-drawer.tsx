import { useEffect, useRef } from 'react'
import { X, ShoppingBag } from 'lucide-react'
import { useCartStore } from '@/stores/cart-store'
import { CartItemRow } from './cart-item-row'
import { EmptyCartView } from './empty-cart-view'
import { CartSummary } from './cart-summary'

export function CartDrawer() {
  const isOpen = useCartStore((state) => state.isOpen)
  const setCartOpen = useCartStore((state) => state.setCartOpen)
  const items = useCartStore((state) => state.items)
  const itemCount = useCartStore((state) => state.getItemCount())
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setCartOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, setCartOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setCartOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 id="cart-drawer-title" className="text-h4 font-bold text-text-primary">
              Your Cart
            </h2>
            {itemCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-semibold text-primary">
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="rounded-full p-2 text-text-secondary hover:bg-neutral-100 hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyCartView onActionClick={() => setCartOpen(false)} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Scrollable list of items */}
            <div className="flex-1 overflow-y-auto px-6 divide-y divide-border/40">
              {items.map((item) => (
                <CartItemRow key={item.productId} item={item} />
              ))}
            </div>

            {/* Bottom pinned summary */}
            <div className="border-t border-border bg-neutral-50/50 px-6 py-4 shadow-inner">
              <CartSummary onClose={() => setCartOpen(false)} showFullCartLink={true} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
