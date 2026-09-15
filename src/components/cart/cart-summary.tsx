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
    <div className="space-y-4 pt-4 border-t border-border">
      {/* Vendor context info */}
      {vendor && (
        <div className="flex items-center justify-between text-caption text-text-secondary bg-neutral-50 px-3 py-2 rounded-lg border border-border/50">
          <span>
            Ordering from <strong className="text-text-primary">{vendor.name}</strong>
          </span>
          <button
            type="button"
            onClick={clearCart}
            className="inline-flex items-center gap-1 text-text-muted hover:text-error transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            title="Clear all items in cart"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-caption">Clear</span>
          </button>
        </div>
      )}

      {/* Financial Line Items */}
      <div className="space-y-2 text-body-small">
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
        <div className="rounded-lg bg-info/10 border border-info/20 p-2.5 text-caption text-text-secondary flex gap-2 items-start">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-tight">
            Delivery fee will be calculated based on distance in Phase 8. For this launch preview, base delivery fee is set to ₦0.00.
          </p>
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between text-body font-bold text-text-primary">
          <span>Estimated Total</span>
          <span className="text-h4 text-primary font-bold">{formatNgn(subtotal)}</span>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-2 pt-2">
        <Button
          type="button"
          variant="primary"
          onClick={handleCheckout}
          className="w-full rounded-xl py-3 text-button flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg transition-all"
        >
          <span>Proceed to Checkout</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>

        {showFullCartLink && (
          <Button
            type="button"
            variant="outline"
            onClick={handleViewCart}
            className="w-full rounded-xl py-2.5 text-body-small text-text-secondary hover:text-text-primary"
          >
            View Full Cart
          </Button>
        )}
      </div>
    </div>
  )
}
