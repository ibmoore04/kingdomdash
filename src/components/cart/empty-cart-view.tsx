import { Link } from 'react-router-dom'
import { ShoppingBag, Utensils, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface EmptyCartViewProps {
  onActionClick?: () => void
}

export function EmptyCartView({ onActionClick }: EmptyCartViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 shadow-inner">
        <ShoppingBag className="h-10 w-10 stroke-[1.5]" aria-hidden="true" />
      </div>

      <h3 className="text-h4 font-bold text-text-primary">Your cart is empty</h3>
      <p className="mt-2 text-body-small text-text-secondary max-w-xs">
        Explore Ijebu-Ode&apos;s best kitchens and grocery stores to add your favorite items.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button
          asChild
          variant="primary"
          size="lg"
          className="flex-1 rounded-xl h-12 px-6 py-3 font-bold text-white bg-primary hover:bg-primary-hover shadow-xs transition-all"
          onClick={onActionClick}
        >
          <Link to="/food" className="inline-flex items-center justify-center gap-2.5 px-4 py-2 text-sm text-white">
            <Utensils className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Order Food</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="secondary"
          size="lg"
          className="flex-1 rounded-xl h-12 px-6 py-3 font-bold border border-neutral-300 hover:bg-neutral-50 shadow-xs transition-all"
          onClick={onActionClick}
        >
          <Link to="/groceries" className="inline-flex items-center justify-center gap-2.5 px-4 py-2 text-sm text-text-primary">
            <Store className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="whitespace-nowrap">Buy Groceries</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
