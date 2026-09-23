import { formatNgn } from '@/utils/formatting'
import type { CartItem, CartVendor } from '@/stores/cart-store'
import { Utensils, Store } from 'lucide-react'

export interface OrderReviewItemsProps {
  items: CartItem[]
  vendor: CartVendor
}

export function OrderReviewItems({ items, vendor }: OrderReviewItemsProps) {
  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs space-y-4">
      {/* Vendor Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          {vendor.serviceType === 'food' ? (
            <Utensils className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Store className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div>
          <h3 className="text-label font-bold text-text-primary">{vendor.name}</h3>
          <p className="text-caption text-text-secondary">{vendor.address}</p>
        </div>
      </div>

      {/* Items list */}
      <div className="divide-y divide-border/50">
        {items.map((item) => (
          <div key={item.productId} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-dark-surface">
                <img
                  src={item.imageUrl || '/kingdomdash-backup.jpg'}
                  alt={item.name}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/kingdomdash-backup.jpg'
                  }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-body-small font-semibold text-text-primary truncate">
                  {item.name}
                </p>
                <p className="text-caption text-text-secondary">
                  Qty: {item.quantity} × {formatNgn(item.price)}
                </p>
              </div>
            </div>

            <span className="text-body-small font-bold text-text-primary shrink-0 ml-3">
              {formatNgn(item.price * item.quantity)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
