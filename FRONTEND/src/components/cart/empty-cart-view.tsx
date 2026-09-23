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

      <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Button
          asChild
          variant="primary"
          className="flex-1 rounded-xl font-bold text-white bg-primary hover:bg-primary-hover"
          onClick={onActionClick}
        >
          <Link to="/food" className="inline-flex items-center justify-center gap-2 text-white">
            <Utensils className="h-4 w-4" aria-hidden="true" />
            <span>Order Food</span>
          </Link>
        </Button>

        <Button
          asChild
          variant="secondary"
          className="flex-1 rounded-xl"
          onClick={onActionClick}
        >
          <Link to="/groceries" className="inline-flex items-center justify-center gap-2">
            <Store className="h-4 w-4" aria-hidden="true" />
            <span>Buy Groceries</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
