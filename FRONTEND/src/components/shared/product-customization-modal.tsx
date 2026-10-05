import { useState, useEffect, useMemo } from 'react'
import { X, Plus, Minus, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import { useToast } from '@/hooks/use-toast'
import {
  getProductModifiers,
  calculateItemUnitPrice,
} from '@/utils/product-modifiers'
import { useCartStore, type CartVendor, type CartItem } from '@/stores/cart-store'
import type { ProductCardItem } from './product-card'
import type { SelectedModifier } from '@/types'

export interface ProductCustomizationModalProps {
  isOpen: boolean
  onClose: () => void
  product: ProductCardItem | null
  vendor?: CartVendor | null
  onVendorConflict?: (conflict: {
    currentVendorName: string
    pendingItem: Omit<CartItem, 'quantity'>
    pendingVendor: CartVendor
  }) => void
}

export function ProductCustomizationModal({
  isOpen,
  onClose,
  product,
  vendor,
  onVendorConflict,
}: ProductCustomizationModalProps) {
  const { pushToast } = useToast()
  const addItem = useCartStore((state) => state.addItem)

  const modifierGroups = useMemo(() => {
    if (!product) return []
    return getProductModifiers({
      name: product.name,
      description: product.description,
      serviceType: vendor?.serviceType,
    })
  }, [product, vendor?.serviceType])

  // Map of groupId -> array of selected optionIds
  const [selections, setSelections] = useState<Record<string, string[]>>({})
  const [specialInstructions, setSpecialInstructions] = useState('')
  const [quantity, setQuantity] = useState(1)

  // Initialize or reset selections when modal opens with a new product
  useEffect(() => {
    if (!isOpen || !product) {
      setSelections({})
      setSpecialInstructions('')
      setQuantity(1)
      return
    }

    const initial: Record<string, string[]> = {}
    modifierGroups.forEach((group) => {
      // If group is required, auto-select the first option so requirement is satisfied initially
      if (group.required && group.options.length > 0) {
        initial[group.id] = [group.options[0].id]
      } else {
        initial[group.id] = []
      }
    })
    setSelections(initial)
    setSpecialInstructions('')
    setQuantity(1)
  }, [isOpen, product, modifierGroups])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !product) return null

  // Collect all currently selected modifier objects with prices
  const activeSelectedModifiers: SelectedModifier[] = []
  modifierGroups.forEach((group) => {
    const selectedIds = selections[group.id] || []
    group.options.forEach((opt) => {
      if (selectedIds.includes(opt.id)) {
        activeSelectedModifiers.push({
          groupId: group.id,
          groupName: group.name,
          optionId: opt.id,
          optionName: opt.name,
          price: opt.price,
        })
      }
    })
  })

  // Validation: verify all required groups meet min_selection
  const missingRequiredGroup = modifierGroups.find((group) => {
    if (!group.required) return false
    const count = (selections[group.id] || []).length
    return count < group.min_selection
  })

  const isValid = !missingRequiredGroup

  // Dynamic price calculation
  const unitPrice = calculateItemUnitPrice(product.price, activeSelectedModifiers)
  const totalPrice = unitPrice * quantity

  // Option selection handlers
  const handleSingleSelect = (groupId: string, optionId: string) => {
    setSelections((prev) => ({
      ...prev,
      [groupId]: [optionId],
    }))
  }

  const handleMultiToggle = (
    groupId: string,
    optionId: string,
    maxSelection: number
  ) => {
    const current = selections[groupId] || []
    const exists = current.includes(optionId)

    // Invoke pushToast directly in event handler, never inside setState updater callback
    if (!exists && current.length >= maxSelection) {
      pushToast({
        variant: 'info',
        title: 'Limit Reached',
        message: `You can select up to ${maxSelection} options for this choice.`,
      })
      return
    }

    setSelections((prev) => {
      const prevCurrent = prev[groupId] || []
      const alreadySelected = prevCurrent.includes(optionId)
      if (alreadySelected) {
        return {
          ...prev,
          [groupId]: prevCurrent.filter((id) => id !== optionId),
        }
      }
      if (prevCurrent.length >= maxSelection) {
        return prev
      }
      return {
        ...prev,
        [groupId]: [...prevCurrent, optionId],
      }
    })
  }

  const handleAddToCart = () => {
    if (!isValid || !vendor) return

    const pendingItem: Omit<CartItem, 'quantity'> = {
      productId: product.id,
      vendorId: vendor.id,
      serviceType: vendor.serviceType,
      name: product.name,
      price: unitPrice,
      basePrice: product.price,
      imageUrl: product.image_url || null,
      selectedModifiers: activeSelectedModifiers,
      specialInstructions: specialInstructions.trim() || undefined,
    }

    // Add item for requested quantity
    let hasConflict = false
    let currentVendorName: string | undefined

    for (let i = 0; i < quantity; i++) {
      const result = addItem(pendingItem, vendor)
      if (result.conflict) {
        hasConflict = true
        currentVendorName = result.currentVendorName
        break
      }
    }

    if (hasConflict) {
      if (onVendorConflict) {
        onVendorConflict({
          currentVendorName: currentVendorName || 'another vendor',
          pendingItem,
          pendingVendor: vendor,
        })
      } else {
        pushToast({
          variant: 'error',
          title: 'Different vendor',
          message: `Your cart already has items from ${currentVendorName || 'another vendor'}.`,
        })
      }
    } else {
      pushToast({
        variant: 'success',
        title: 'Customized meal added',
        message: `${quantity}x ${product.name} added with your selections.`,
      })
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="customization-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
    >
      {/* Background click to dismiss */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        className={cn(
          'relative flex flex-col w-full max-w-lg bg-white shadow-2xl overflow-hidden',
          'rounded-t-3xl sm:rounded-2xl max-h-[90vh] sm:max-h-[85vh]',
          'animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200'
        )}
      >
        {/* Drag Indicator Handle on Mobile */}
        <div className="mx-auto mt-2.5 -mb-1 h-1.5 w-12 rounded-full bg-neutral-200 sm:hidden shrink-0" />

        {/* Header Bar */}
        <div className="relative border-b border-neutral-100 bg-white px-5 py-3.5 sm:py-4 flex items-center justify-between z-10 shrink-0">
          <div>
            <h2
              id="customization-title"
              className="text-base sm:text-lg font-bold text-neutral-900 line-clamp-1"
            >
              Customize {product.name}
            </h2>
            <p className="text-xs text-neutral-500">
              Base Price: <span className="font-bold text-neutral-800">{formatNgn(product.price)}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close customization dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Modifier Options Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Optional Product Image Preview */}
          {product.image_url && (
            <div className="relative h-36 w-full rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200/80">
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = '/kingdomdash-backup.jpg'
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              {product.description && (
                <p className="absolute bottom-2.5 left-3 right-3 text-xs text-white/95 line-clamp-2 drop-shadow-xs font-medium">
                  {product.description}
                </p>
              )}
            </div>
          )}

          {/* Modifier Groups */}
          {modifierGroups.map((group) => {
            const isSingleChoice = group.max_selection === 1
            const selectedIds = selections[group.id] || []

            return (
              <div
                key={group.id}
                className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 transition-all"
              >
                {/* Group Title & Requirement Tag */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-200/60">
                  <h3 className="text-sm font-bold text-neutral-900">
                    {group.name}
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                      group.required
                        ? selectedIds.length >= group.min_selection
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-primary/10 text-primary'
                        : 'bg-neutral-200/70 text-neutral-600'
                    )}
                  >
                    {group.required
                      ? selectedIds.length >= group.min_selection
                        ? group.max_selection > 1
                          ? `Selected (${selectedIds.length}/${group.max_selection})`
                          : 'Selected'
                        : group.min_selection > 1
                          ? `Required • Pick at least ${group.min_selection}`
                          : 'Required'
                      : `Optional • Up to ${group.max_selection}`}
                  </span>
                </div>

                {/* Options List */}
                <div className="mt-3 space-y-2">
                  {group.options.map((option) => {
                    const isSelected = selectedIds.includes(option.id)

                    return (
                      <label
                        key={option.id}
                        onClick={() => {
                          if (isSingleChoice) {
                            handleSingleSelect(group.id, option.id)
                          } else {
                            handleMultiToggle(group.id, option.id, group.max_selection)
                          }
                        }}
                        className={cn(
                          'flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none text-xs sm:text-sm',
                          isSelected
                            ? 'border-primary bg-primary/5 text-neutral-900 shadow-2xs'
                            : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Radio / Checkbox Indicator */}
                          <div
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center border transition-all',
                              isSingleChoice ? 'rounded-full' : 'rounded-md',
                              isSelected
                                ? 'border-primary bg-primary text-white'
                                : 'border-neutral-300 bg-white'
                            )}
                          >
                            {isSelected && (
                              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
                            )}
                          </div>
                          <span className="font-semibold truncate">
                            {option.name}
                          </span>
                        </div>

                        {/* Price Badge */}
                        <span
                          className={cn(
                            'shrink-0 text-xs font-bold',
                            option.price > 0 ? 'text-primary' : 'text-neutral-400'
                          )}
                        >
                          {option.price > 0 ? `+${formatNgn(option.price)}` : 'Included'}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Special Cooking Instructions */}
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4">
            <label
              htmlFor="special-instructions"
              className="block text-sm font-bold text-neutral-900 mb-1"
            >
              Special Instructions
            </label>
            <p className="text-xs text-neutral-500 mb-2">
              Any allergies, packing preferences, or spice adjustments?
            </p>
            <textarea
              id="special-instructions"
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Please pack stew separately, no onions, extra serviettes"
              className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-xs sm:text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer: Stepper & Add to Cart Button */}
        <div className="border-t border-neutral-100 bg-white p-4 sm:p-5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:pb-5 flex flex-col gap-3 shrink-0">
          {missingRequiredGroup && (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Please make a selection for &quot;{missingRequiredGroup.name}&quot;</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Quantity Stepper */}
            <div
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-1"
              role="group"
              aria-label="Item quantity"
            >
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-2xs hover:bg-neutral-100 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[2rem] text-center font-bold text-sm text-neutral-900 select-none">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-2xs hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Solid Add to Cart CTA */}
            <Button
              type="button"
              onClick={handleAddToCart}
              disabled={!isValid}
              variant="primary"
              className="flex-1 h-11 rounded-xl font-bold shadow-xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="flex-1 text-left">Add to Cart</span>
              <span className="font-extrabold">{formatNgn(totalPrice)}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
