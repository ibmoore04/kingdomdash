import { useState } from 'react'
import { Plus, Check, Sparkles } from 'lucide-react'
import { useCartStore } from '@/stores/cart-store'
import { useUiStore } from '@/stores/ui-store'
import { SUGGESTED_MEAL_PAIRINGS, type MealPairingItem } from '@/utils/campus-discovery'
import { formatNgn } from '@/utils/formatting'

export interface MealPairingUpsellProps {
  className?: string
  title?: string
}

export function MealPairingUpsell({
  className = '',
  title = '⚡ Complete Your Meal',
}: MealPairingUpsellProps) {
  const vendor = useCartStore((state) => state.vendor)
  const items = useCartStore((state) => state.items)
  const addItem = useCartStore((state) => state.addItem)
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({})

  // If no vendor or cart is empty, do not show upsells
  if (!vendor || items.length === 0) {
    return null
  }

  const handleAddPairing = (pairing: MealPairingItem) => {
    addItem(
      {
        productId: `upsell-${pairing.id}`,
        vendorId: vendor.id,
        serviceType: vendor.serviceType || 'food',
        name: pairing.name,
        price: pairing.priceNgn,
        imageUrl: null,
      },
      vendor
    )

    setAddedItemIds((prev) => ({ ...prev, [pairing.id]: true }))
    useUiStore.getState().pushToast({
      title: 'Added to Cart',
      message: `${pairing.name} (+${formatNgn(pairing.priceNgn)}) added to your order.`,
      variant: 'success',
    })

    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [pairing.id]: false }))
    }, 2000)
  }

  return (
    <div
      data-testid="meal-pairing-upsell"
      className={`rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-amber-500/5 p-4 sm:p-5 shadow-2xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-neutral-900 tracking-tight">{title}</h3>
        </div>
        <span className="text-[11px] font-semibold text-neutral-500">Popular Student Add-ons</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {SUGGESTED_MEAL_PAIRINGS.map((pairing) => {
          const isAdded = Boolean(addedItemIds[pairing.id])

          return (
            <div
              key={pairing.id}
              className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs hover:border-primary/40 transition-all"
            >
              <div>
                <span className="text-xl block mb-1">{pairing.emoji}</span>
                <h4 className="text-xs font-bold text-neutral-900 leading-tight line-clamp-1">
                  {pairing.name}
                </h4>
                <p className="text-[10px] text-neutral-500 mt-0.5">{pairing.description}</p>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-1 pt-2 border-t border-neutral-100">
                <span className="text-xs font-extrabold text-neutral-900">
                  {formatNgn(pairing.priceNgn)}
                </span>

                <button
                  type="button"
                  onClick={() => handleAddPairing(pairing)}
                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                    isAdded
                      ? 'bg-emerald-600 text-white'
                      : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                  }`}
                  aria-label={`Add ${pairing.name} to order`}
                >
                  {isAdded ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Added</span>
                    </>
                  ) : (
                    <>
                      <Plus className="h-3 w-3" />
                      <span>Add</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
