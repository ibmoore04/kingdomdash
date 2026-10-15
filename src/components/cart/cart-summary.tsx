import { useNavigate } from 'react-router-dom'
import { Info, ArrowRight, Trash2 } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'
import { Button } from '@/components/ui/button'
import { useCartStore } from '@/stores/cart-store'

export interface CartSummaryProps {
  onClose?: () => void
  showFullCartLink?: boolean
}

export function CartSummary({ onClose, showFullCartLink = true }: CartSummaryProps) {
  const navigate = useNavigate()
  const subtotal = useCartStore((state) => state.getSubtotal())
  const clearCart = useCartStore((state) => state.clearCart)
  const vendor = useCartStore((state) => state.vendor)

  const handleCheckout = () => {
    onClose?.()
    navigate('/checkout')
  }

  const handleViewCart = () => {
    onClose?.()
    navigate('/cart')
  }

  return (
    <div className="space-y-2 pt-1">
      {/* Vendor context info */}
      {vendor && (
        <div className="flex items-center justify-between text-caption text-text-secondary bg-neutral-100/70 px-2.5 py-1 rounded-lg border border-border/50">
          <span className="truncate mr-2 text-xs">
            Ordering from <strong className="text-text-primary">{vendor.name}</strong>
          </span>
          <button
            type="button"
            onClick={clearCart}
            className="inline-flex items-center gap-1 text-text-muted hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded shrink-0 cursor-pointer"
            title="Clear all items in cart"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            <span className="text-[11px]">Clear</span>
          </button>
        </div>
      )}

      {/* Financial Line Items */}
      <div className="space-y-1 text-xs sm:text-body-small">
        <div className="flex items-center justify-between text-text-secondary">
          <span>Subtotal</span>
          <span className="font-semibold text-text-primary">{formatNgn(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between text-text-secondary">
          <span className="flex items-center gap-1">
            <span>Delivery Fee</span>
          </span>
          <span className="font-medium text-success">₦0.00 (Launch Preview)</span>
        </div>

        {/* Phase 8 Explanatory Notice */}
        <div className="rounded-md bg-info/10 border border-info/20 px-2 py-0.5 text-[11px] text-text-secondary flex gap-1.5 items-center">
          <Info className="h-3 w-3 text-info shrink-0" aria-hidden="true" />
          <p className="leading-tight text-[10.5px] truncate">
            Delivery fee will be calculated based on distance in Phase 8. For this launch preview, base delivery fee is set to ₦0.00.
          </p>
        </div>

        <div className="pt-1 border-t border-border flex items-center justify-between text-sm sm:text-body font-bold text-text-primary">
          <span>Estimated Total</span>
          <span className="text-base sm:text-h4 text-primary font-bold">{formatNgn(subtotal)}</span>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-1.5 pt-0.5">
        <Button
          type="button"
          variant="primary"
          onClick={handleCheckout}
          className="w-full h-10 rounded-xl text-button font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
        >
          <span>Proceed to Checkout</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        {showFullCartLink && (
          <Button
            type="button"
            variant="outline"
            onClick={handleViewCart}
            className="w-full h-8 rounded-xl text-caption font-medium text-text-secondary hover:text-text-primary cursor-pointer"
          >
            View Full Cart
          </Button>
        )}
      </div>
    </div>
  )
}
