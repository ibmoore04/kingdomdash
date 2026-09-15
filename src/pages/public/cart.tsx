import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Store, Utensils, Trash2, Info, ShoppingBag } from 'lucide-react'
import { PageContainer, Section } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { CartItemRow } from '@/components/cart/cart-item-row'
import { EmptyCartView } from '@/components/cart/empty-cart-view'
import { useCartStore } from '@/stores/cart-store'
import { useAuthStore } from '@/stores/auth-store'
import { formatNgn } from '@/utils/formatting'

export default function CartPage() {
  const navigate = useNavigate()
  const items = useCartStore((state) => state.items)
  const vendor = useCartStore((state) => state.vendor)
  const clearCart = useCartStore((state) => state.clearCart)
  const subtotal = useCartStore((state) => state.getSubtotal())
  const itemCount = useCartStore((state) => state.getItemCount())
  const session = useAuthStore((state) => state.session)

  useEffect(() => {
    document.title = 'Shopping Cart — KingdomDash'
  }, [])

  const handleProceedToCheckout = () => {
    if (!session) {
      navigate('/auth/login?redirect=/checkout')
    } else {
      navigate('/checkout')
    }
  }

  return (
    <PageContainer>
      <Section tone="light" className="py-8 sm:py-12">
        {/* Header Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to={vendor ? (vendor.serviceType === 'food' ? `/food/${vendor.id}` : `/grocery/${vendor.id}`) : '/'}
            className="inline-flex items-center gap-2 text-body-small font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Continue Shopping</span>
          </Link>

          {items.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearCart}
              className="inline-flex items-center gap-1.5 text-caption text-text-muted hover:text-error hover:border-error/30"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear Cart</span>
            </Button>
          )}
        </div>

        <div className="mb-8">
          <h1 className="text-h2 font-bold text-text-primary flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" aria-hidden="true" />
            <span>Shopping Cart</span>
          </h1>
          <p className="mt-1 text-body-small text-text-secondary">
            Review your selected items and proceed to secure checkout.
          </p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white p-8 shadow-xs">
            <EmptyCartView />
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left: Items List */}
            <div className="lg:col-span-8 space-y-4">
              {/* Vendor context banner */}
              {vendor && (
                <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
                      {vendor.serviceType === 'food' ? (
                        <Utensils className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <Store className="h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                    <div>
                      <p className="text-caption font-semibold uppercase tracking-wider text-primary">
                        Ordering From
                      </p>
                      <h2 className="text-label font-bold text-text-primary">{vendor.name}</h2>
                      <p className="text-caption text-text-secondary">{vendor.address}</p>
                    </div>
                  </div>

                  <span className="rounded-full bg-white px-3 py-1 text-caption font-semibold text-text-primary border border-border shadow-xs">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                </div>
              )}

              {/* Items Card */}
              <div className="rounded-2xl border border-border bg-white p-6 shadow-xs divide-y divide-border/60">
                {items.map((item) => (
                  <CartItemRow key={item.productId} item={item} />
                ))}
              </div>
            </div>

            {/* Right: Order Financial Summary */}
            <div className="lg:col-span-4 sticky top-28 space-y-4">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-4">
                <h3 className="text-h4 font-bold text-text-primary border-b border-border pb-3">
                  Order Summary
                </h3>

                <div className="space-y-3 text-body-small">
                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Subtotal</span>
                    <span className="font-semibold text-text-primary">{formatNgn(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between text-text-secondary">
                    <span>Delivery Fee</span>
                    <span className="font-semibold text-success">₦0.00 (Launch Preview)</span>
                  </div>

                  {/* Explanatory Notice */}
                  <div className="rounded-xl bg-info/10 border border-info/20 p-3 text-caption text-text-secondary flex gap-2.5 items-start">
                    <Info className="h-4 w-4 text-info shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="leading-relaxed">
                      Delivery fee will be calculated based on distance in Phase 8. For this launch preview, base delivery fee is set to ₦0.00.
                    </p>
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-body font-bold text-text-primary">Estimated Total</span>
                    <span className="text-h3 font-extrabold text-primary">{formatNgn(subtotal)}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleProceedToCheckout}
                  className="w-full rounded-xl py-3.5 text-button font-bold flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-md hover:shadow-lg transition-all"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>

                {!session && (
                  <p className="text-center text-caption text-text-muted">
                    You will be prompted to sign in before confirming your delivery address.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Section>
    </PageContainer>
  )
}
