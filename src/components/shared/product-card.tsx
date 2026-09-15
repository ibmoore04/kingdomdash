import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'

import { useCartStore, type CartVendor, type CartItem } from '@/stores/cart-store'

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
  const addItem = useCartStore((state) => state.addItem)
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
    } else {
      pushToast({
        variant: 'success',
        title: 'Added to cart',
        message: `${product.name} added to cart.`,
      })
    }
  }

  return (
    <div
      className={cn(
        'group flex gap-4 rounded-xl border border-border bg-white p-4 transition-all duration-300',
        isAvailable
          ? 'hover:border-primary/25 hover:shadow-card-hover'
          : 'opacity-60',
      )}
    >
      {/* Image with fallback */}
      <div
        className="img-placeholder relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-dark-surface"
        aria-label={`${product.name} photo`}
        role="img"
      >
        <img
          src={imageUrl}
          alt={product.name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/kingdomdash-backup.jpg'
          }}
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1">
        <div>
          <h3 className="text-label font-semibold text-text-primary">{product.name}</h3>
          {product.description && (
            <p className="mt-0.5 line-clamp-2 text-caption leading-relaxed text-text-secondary">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-label font-semibold text-text-primary">
            {formatNgn(product.price)}
          </span>
          <button
            type="button"
            disabled={!isAvailable}
            onClick={handleAddToCart}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:transition-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
              isAvailable
                ? 'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary'
                : 'cursor-not-allowed bg-border text-text-muted',
            )}
            aria-label={isAvailable ? `Add ${product.name}` : `${product.name} unavailable`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
