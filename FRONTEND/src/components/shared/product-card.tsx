import React, { useState } from 'react'
import { Plus, Minus, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'
import { useCartStore, type CartVendor, type CartItem } from '@/stores/cart-store'
import { getProductModifiers } from '@/utils/product-modifiers'
import { ProductCustomizationModal } from './product-customization-modal'

export interface ProductCardItem {
  id: string
  name: string
  description?: string | null
  price: number
  image_url?: string | null
  is_available?: boolean
  available?: boolean
}

export interface ProductCardProps {
  product: ProductCardItem
  vendor?: CartVendor | null
  onVendorConflict?: (conflict: {
    currentVendorName: string
    pendingItem: Omit<CartItem, 'quantity'>
    pendingVendor: CartVendor
  }) => void
}

export function ProductCard({ product, vendor, onVendorConflict }: ProductCardProps) {
  const { pushToast } = useToast()
  const [isCustomizing, setIsCustomizing] = useState(false)
  const addItem = useCartStore((state) => state.addItem)
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const cartItem = useCartStore((state) => state.items.find((i) => i.productId === product.id))
  const quantity = cartItem?.quantity || 0

  const hasModifiers =
    vendor?.serviceType !== 'grocery' &&
    getProductModifiers({
      name: product.name,
      description: product.description,
      serviceType: vendor?.serviceType,
    }).length > 0

  const isAvailable = product.is_available ?? product.available ?? true
  const imageUrl = product.image_url || '/kingdomdash-backup.jpg'

  const handleAddToCart = () => {
    if (!isAvailable) return

    if (!vendor) {
      pushToast({
        variant: 'info',
        title: 'Ordering not connected yet',
        message: 'Cart and checkout will be implemented in a later phase.',
      })
      return
    }

    const pendingItem: Omit<CartItem, 'quantity'> = {
      productId: product.id,
      vendorId: vendor.id,
      serviceType: vendor.serviceType,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url || null,
    }

    const result = addItem(pendingItem, vendor)

    if (result.conflict) {
      if (onVendorConflict) {
        onVendorConflict({
          currentVendorName: result.currentVendorName || 'another vendor',
          pendingItem,
          pendingVendor: vendor,
        })
      } else {
        pushToast({
          variant: 'error',
          title: 'Different vendor',
          message: `Your cart already has items from ${result.currentVendorName || 'another vendor'}.`,
        })
      }
    } else if (quantity === 0) {
      pushToast({
        variant: 'success',
        title: 'Added to cart',
        message: `${product.name} added to cart.`,
      })
    }
  }

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (quantity > 0) {
      updateQuantity(product.id, quantity - 1)
    }
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleAddToCart()
  }

  return (
    <>
      <div
        className={cn(
          'group flex gap-4 rounded-xl border border-border bg-white p-4 transition-all duration-300',
          isAvailable
            ? quantity > 0
              ? 'border-primary/40 bg-primary/[0.015] shadow-xs'
              : 'hover:border-primary/30 hover:shadow-card-hover'
            : 'opacity-60',
        )}
      >
        {/* Image with fallback & subtle hover zoom */}
        <div
          className="img-placeholder relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-dark-surface"
          aria-label={`${product.name} photo`}
          role="img"
        >
          <img
            src={imageUrl}
            alt={product.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            onError={(e) => {
              e.currentTarget.src = '/kingdomdash-backup.jpg'
            }}
          />
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-label font-semibold text-text-primary transition-colors group-hover:text-primary">
                {product.name}
              </h3>
              {hasModifiers && (
                <button
                  type="button"
                  onClick={() => setIsCustomizing(true)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  <SlidersHorizontal className="h-2.5 w-2.5" aria-hidden="true" />
                  <span>Custom</span>
                </button>
              )}
            </div>
            {product.description && (
              <p className="mt-0.5 line-clamp-2 text-caption leading-relaxed text-text-secondary">
                {product.description}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-label font-bold text-text-primary">
              {formatNgn(product.price)}
            </span>

            {quantity > 0 ? (
              /* Active Inline Stepper */
              <div className="flex items-center gap-1.5">
                {hasModifiers && (
                  <button
                    type="button"
                    onClick={() => setIsCustomizing(true)}
                    className="p-1 rounded-full text-neutral-400 hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Customize options"
                    aria-label={`Customize ${product.name}`}
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
                <div
                  className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 p-0.5 shadow-2xs transition-all animate-in fade-in zoom-in-95 duration-150"
                  role="group"
                  aria-label={`Quantity for ${product.name}`}
                >
                  <button
                    type="button"
                    onClick={handleDecrement}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary hover:bg-primary hover:text-white shadow-xs transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Decrease ${product.name} quantity`}
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span
                    className="min-w-[1.25rem] text-center text-xs font-black text-primary select-none px-0.5"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover shadow-xs transition-colors active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Increase ${product.name} quantity`}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              /* Add and Customize buttons */
              <div className="flex items-center gap-1.5">
                {hasModifiers && (
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => setIsCustomizing(true)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors active:scale-95 disabled:opacity-50"
                  >
                    <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
                    <span>Options</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={handleAddToCart}
                  className={cn(
                    'group/btn inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-xs active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:transition-none motion-reduce:transition-none',
                    isAvailable
                      ? 'bg-primary/10 text-primary hover:bg-primary hover:text-white focus-visible:ring-primary'
                      : 'cursor-not-allowed bg-border text-text-muted',
                  )}
                  aria-label={isAvailable ? `Add ${product.name}` : `${product.name} unavailable`}
                >
                  <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-hover/btn:rotate-90" aria-hidden="true" />
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Customization Modal */}
      <ProductCustomizationModal
        isOpen={isCustomizing}
        onClose={() => setIsCustomizing(false)}
        product={product}
        vendor={vendor}
        onVendorConflict={onVendorConflict}
      />
    </>
  )
}
