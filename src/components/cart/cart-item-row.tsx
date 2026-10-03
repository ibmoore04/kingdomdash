import { Minus, Plus, Trash2 } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import { useCartStore, type CartItem } from '@/stores/cart-store'

export interface CartItemRowProps {
  item: CartItem
}

export function CartItemRow({ item }: CartItemRowProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity)
  const removeItem = useCartStore((state) => state.removeItem)

  const itemKey = item.itemKey || item.productId

  const handleDecrement = () => {
    if (item.quantity <= 1) {
      removeItem(itemKey)
    } else {
      updateQuantity(itemKey, item.quantity - 1)
    }
  }

  const handleIncrement = () => {
    if (item.quantity < 999) {
      updateQuantity(itemKey, item.quantity + 1)
    }
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/60 last:border-b-0">
      {/* Thumbnail */}
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-dark-surface mt-0.5">
        <img
          src={item.imageUrl || '/kingdomdash-backup.jpg'}
          alt={item.name}
          className="h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = '/kingdomdash-backup.jpg'
          }}
        />
      </div>

      {/* Info & pricing */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-body-small font-semibold text-text-primary truncate">
            {item.name}
          </h4>
          <button
            type="button"
            onClick={() => removeItem(itemKey)}
            className="text-text-muted hover:text-error transition-colors p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Remove ${item.name} from cart`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Selected Modifiers Pills */}
        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.selectedModifiers.map((mod) => (
              <span
                key={`${mod.groupId}-${mod.optionId}`}
                className="inline-flex items-center rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600"
              >
                {mod.optionName}
                {mod.price > 0 && ` (+${formatNgn(mod.price)})`}
              </span>
            ))}
          </div>
        )}

        {/* Special Instructions Note */}
        {item.specialInstructions && (
          <p className="mt-1 text-[11px] text-neutral-500 italic line-clamp-1">
            Note: &ldquo;{item.specialInstructions}&rdquo;
          </p>
        )}

        <p className="text-caption text-text-secondary mt-1">
          {formatNgn(item.price)} each
        </p>

        {/* Quantity Controls & Line Total */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center rounded-lg border border-border bg-white shadow-xs">
            <button
              type="button"
              onClick={handleDecrement}
              aria-label={item.quantity <= 1 ? `Remove ${item.name}` : `Decrease quantity of ${item.name}`}
              className="flex h-7 w-7 items-center justify-center text-text-secondary hover:bg-neutral-100 hover:text-text-primary rounded-l-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
            </button>
            <span
              className="w-8 text-center text-caption font-semibold text-text-primary select-none"
              aria-live="polite"
            >
              {item.quantity}
            </span>
            <button
              type="button"
              disabled={item.quantity >= 999}
              onClick={handleIncrement}
              aria-label={`Increase quantity of ${item.name}`}
              className="flex h-7 w-7 items-center justify-center text-text-secondary hover:bg-neutral-100 hover:text-text-primary rounded-r-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>

          <span className="text-label font-bold text-text-primary">
            {formatNgn(item.price * item.quantity)}
          </span>
        </div>
      </div>
    </div>
  )
}
