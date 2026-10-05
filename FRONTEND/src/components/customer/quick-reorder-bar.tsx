import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RotateCcw, Clock, ArrowRight, ShoppingBag, Store, ChevronRight } from 'lucide-react'
import { getOrdersByCustomer } from '@/services/supabase/orders'
import { useAuthStore } from '@/stores/auth-store'
import { useCartStore, type CartItem, type CartVendor } from '@/stores/cart-store'
import { useToast } from '@/hooks/use-toast'
import { formatNgn } from '@/utils/formatting'

interface PastOrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface PastOrder {
  id: string
  created_at: string
  status: string
  total: number
  vendor_id?: string
  service_type?: 'food' | 'grocery'
  pickup_address?: string
  delivery_address?: string
  order_items?: PastOrderItem[]
  vendors?: {
    id?: string
    business_name?: string
  }
}

export function QuickReorderBar() {
  const { user, profile } = useAuthStore()
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const [pastOrders, setPastOrders] = useState<PastOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const currentUserId = user?.id || profile?.id

    if (!currentUserId) {
      setPastOrders([])
      return
    }

    async function loadPastOrders() {
      setIsLoading(true)
      try {
        const { data, error } = await getOrdersByCustomer(currentUserId)
        if (isMounted && !error && Array.isArray(data)) {
          // Take top 4 most recent orders that have items
          const valid = (data as PastOrder[])
            .filter((o) => o.order_items && o.order_items.length > 0)
            .slice(0, 4)
          setPastOrders(valid)
        }
      } catch {
        // Silent failure for optional widget
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadPastOrders()

    return () => {
      isMounted = false
    }
  }, [user?.id, profile?.id])

  if (!user && !profile) return null
  if (!isLoading && pastOrders.length === 0) return null

  const handle1ClickReorder = async (order: PastOrder) => {
    if (!order.order_items || order.order_items.length === 0) return
    setReorderingOrderId(order.id)

    try {
      const vendorId = order.vendor_id || order.vendors?.id || 'vendor-unknown'
      const vendorName = order.vendors?.business_name || 'Favorite Kitchen'
      const serviceType = order.service_type || 'food'

      const cartVendor: CartVendor = {
        id: vendorId,
        name: vendorName,
        serviceType,
        address: order.pickup_address || 'Ijebu-Ode, Ogun State',
      }

      const cartItems: CartItem[] = order.order_items.map((item) => ({
        productId: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        quantity: Math.max(1, item.quantity),
        vendorId,
        serviceType,
        imageUrl: null,
      }))

      // Populate cart store
      const cartStore = useCartStore.getState()
      cartStore.clearCart()

      // Set items and vendor directly
      useCartStore.setState({
        items: cartItems,
        vendor: cartVendor,
      })

      // Sync to local storage
      const activeUser = cartStore.activeUserId || user?.id || null
      const { saveCartToStorage, syncCartToDatabase } = await import('@/stores/cart-store')
      saveCartToStorage(activeUser, cartItems, cartVendor)
      void syncCartToDatabase(activeUser, cartItems, cartVendor)

      pushToast({
        variant: 'success',
        title: 'Order Repopulated!',
        message: `${cartItems.length} items loaded into your cart. Taking you to checkout...`,
      })

      setTimeout(() => {
        navigate('/checkout')
      }, 300)
    } catch (err) {
      console.error('1-Click Reorder failed:', err)
      pushToast({
        variant: 'error',
        title: 'Reorder Notice',
        message: 'Could not reload this order into cart. Please choose items manually.',
      })
    } finally {
      setReorderingOrderId(null)
    }
  }

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString)
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return 'Recent'
    }
  }

  return (
    <div className="rounded-3xl border border-neutral-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <RotateCcw className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-neutral-900 tracking-tight">
              Order Again in 1-Click
            </h3>
            <p className="text-xs text-neutral-500">
              Quickly reorder your favorite meals and groceries
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/customer/orders')}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
        >
          <span>View all orders</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {pastOrders.map((ord) => {
          const itemCount = ord.order_items?.reduce((acc, i) => acc + i.quantity, 0) || 0
          const itemsSummary = ord.order_items
            ?.slice(0, 2)
            .map((i) => `${i.quantity}× ${i.product_name}`)
            .join(', ')
          const vendorName = ord.vendors?.business_name || 'Campus Kitchen'
          const isReorderingThis = reorderingOrderId === ord.id

          return (
            <div
              key={ord.id}
              className="flex flex-col justify-between rounded-2xl border border-neutral-200/90 bg-neutral-50/50 p-3.5 hover:bg-neutral-50 hover:border-neutral-300 transition-all shadow-2xs"
            >
              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1 font-semibold text-neutral-800">
                    <Store className="h-3 w-3 text-primary" />
                    <span className="truncate max-w-[130px]">{vendorName}</span>
                  </span>
                  <span className="flex items-center gap-0.5 font-medium">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDate(ord.created_at)}
                  </span>
                </div>

                <p className="text-xs font-semibold text-neutral-900 line-clamp-2 min-h-[32px]">
                  {itemsSummary}
                  {(ord.order_items?.length || 0) > 2 ? ' ...' : ''}
                </p>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-[11px] text-neutral-500">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </span>
                  <span className="text-xs font-extrabold text-neutral-900">
                    {formatNgn(ord.total)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={isReorderingThis}
                onClick={() => handle1ClickReorder(ord)}
                className="w-full h-8 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                {isReorderingThis ? (
                  <span>Loading Cart...</span>
                ) : (
                  <>
                    <RotateCcw className="h-3 w-3" />
                    <span>Reorder</span>
                    <ArrowRight className="h-3 w-3 ml-0.5" />
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
