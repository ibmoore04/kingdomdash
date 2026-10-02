import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  RotateCcw,
  AlertCircle,
  XCircle,
  Loader2,
  FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNgn } from '@/utils/formatting'
import {
  getOrdersByVendor,
  updateOrderStatusVendor,
  vendorRejectOrder,
} from '@/services/supabase/orders'

interface OrderItemRow {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface VendorOrderRow {
  id: string
  customer_id: string
  service_type: string
  status: string
  subtotal: number
  delivery_fee: number
  total: number
  pickup_address: string
  delivery_address: string
  special_instructions?: string | null
  cancellation_reason?: string | null
  refund_required?: boolean
  created_at: string
  order_items: OrderItemRow[]
}

interface VendorOrdersListProps {
  vendorId: string
}

type FilterTab = 'action_required' | 'ready' | 'in_transit' | 'all'

export const VendorOrdersList: React.FC<VendorOrdersListProps> = ({ vendorId }) => {
  const [orders, setOrders] = useState<VendorOrderRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('action_required')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectingOrder, setRejectingOrder] = useState<VendorOrderRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getOrdersByVendor(vendorId)
      if (res.error) {
        setError('Failed to load orders from the database.')
      } else if (res.data) {
        setOrders(res.data as unknown as VendorOrderRow[])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching orders')
    } finally {
      setIsLoading(false)
    }
  }, [vendorId])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setProcessingId(orderId)
    try {
      const { error: rpcErr } = await updateOrderStatusVendor(orderId, nextStatus)
      if (rpcErr) {
        alert(typeof rpcErr === 'object' && rpcErr !== null && 'message' in rpcErr ? (rpcErr as { message: string }).message : 'Failed to update order status')
      } else {
        await loadOrders()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error updating order status')
    } finally {
      setProcessingId(null)
    }
  }

  const handleConfirmReject = async () => {
    if (!rejectingOrder || !rejectReason.trim()) return
    setIsRejecting(true)
    try {
      const { error: rpcErr } = await vendorRejectOrder(rejectingOrder.id, rejectReason.trim())
      if (rpcErr) {
        alert(typeof rpcErr === 'object' && rpcErr !== null && 'message' in rpcErr ? (rpcErr as { message: string }).message : 'Failed to reject order')
      } else {
        setRejectingOrder(null)
        setRejectReason('')
        await loadOrders()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error rejecting order')
    } finally {
      setIsRejecting(false)
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'action_required') {
      return o.status === 'payment_confirmed' || o.status === 'preparing'
    }
    if (activeFilter === 'ready') {
      return o.status === 'ready_for_pickup'
    }
    if (activeFilter === 'in_transit') {
      return o.status === 'picked_up' || o.status === 'in_transit' || o.status === 'delivered'
    }
    return true
  })

  return (
    <div data-testid="vendor-orders-list" className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-h3 font-bold text-text-primary">Incoming Orders & Fulfillment</h2>
          <p className="text-body-small text-text-secondary">
            Acknowledge paid customer orders, prepare items, and mark ready for rider dispatch.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadOrders}
          disabled={isLoading}
          className="gap-2 self-start sm:self-auto"
        >
          <RotateCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Orders
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveFilter('action_required')}
          className={`px-3.5 py-1.5 rounded-lg text-body-small font-semibold transition-all ${
            activeFilter === 'action_required'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-page-background text-text-secondary hover:text-text-primary'
          }`}
        >
          Action Required (
          {orders.filter((o) => o.status === 'payment_confirmed' || o.status === 'preparing').length}
          )
        </button>
        <button
          type="button"
          data-testid="filter-tab-ready"
          onClick={() => setActiveFilter('ready')}
          className={`px-3.5 py-1.5 rounded-lg text-body-small font-semibold transition-all ${
            activeFilter === 'ready'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-page-background text-text-secondary hover:text-text-primary'
          }`}
        >
          Ready for Pickup (
          {orders.filter((o) => o.status === 'ready_for_pickup').length}
          )
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('in_transit')}
          className={`px-3.5 py-1.5 rounded-lg text-body-small font-semibold transition-all ${
            activeFilter === 'in_transit'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-page-background text-text-secondary hover:text-text-primary'
          }`}
        >
          Out for Delivery / Completed
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3.5 py-1.5 rounded-lg text-body-small font-semibold transition-all ${
            activeFilter === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-page-background text-text-secondary hover:text-text-primary'
          }`}
        >
          All Orders ({orders.length})
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-error/20 bg-error/5 p-4 text-body-small text-error flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading state */}
      {isLoading && orders.length === 0 ? (
        <div className="space-y-4 py-8">
          <div className="h-28 w-full animate-pulse rounded-2xl bg-neutral-100 border border-border" />
          <div className="h-28 w-full animate-pulse rounded-2xl bg-neutral-100 border border-border" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Package className="mx-auto h-12 w-12 text-text-muted mb-3" />
          <h3 className="text-body font-bold text-text-primary">No orders in this category</h3>
          <p className="text-body-small text-text-secondary mt-1">
            New paid orders from customers will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isProcessing = processingId === order.id
            const canStartPrep = order.status === 'payment_confirmed'
            const canMarkReady = order.status === 'preparing'
            const isReady = order.status === 'ready_for_pickup'

            return (
              <div
                key={order.id}
                data-testid={`vendor-order-card-${order.id}`}
                className="rounded-2xl border border-border bg-white p-5 shadow-xs hover:border-primary/20 transition-all space-y-4"
              >
                {/* Order Meta Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-body font-bold text-primary">
                      #{order.id.slice(0, 8)}
                    </span>
                    <Badge
                      variant={
                        order.status === 'ready_for_pickup' || order.status === 'delivered'
                          ? 'success'
                          : order.status === 'cancelled'
                          ? 'error'
                          : 'default'
                      }
                      className="capitalize font-bold text-caption"
                    >
                      {order.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="text-caption text-text-muted">
                    {new Date(order.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {new Date(order.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Items Summary */}
                <div className="space-y-1.5">
                  <h4 className="text-caption font-bold uppercase tracking-wider text-text-muted">
                    Order Items
                  </h4>
                  <ul className="divide-y divide-border/50 text-body-small">
                    {order.order_items?.map((item) => (
                      <li key={item.id} className="py-1 flex items-center justify-between">
                        <span>
                          <span className="font-bold text-primary mr-2">{item.quantity}x</span>
                          <span className="text-text-primary">{item.product_name}</span>
                        </span>
                        <span className="font-mono text-text-secondary">
                          {formatNgn(item.line_total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between pt-2 border-t border-border font-bold text-body-small">
                    <span>Subtotal</span>
                    <span className="font-mono text-primary">{formatNgn(order.subtotal)}</span>
                  </div>
                </div>

                {/* Delivery Notes */}
                {order.special_instructions && (
                  <div className="rounded-lg bg-page-background p-3 text-caption text-text-secondary flex items-start gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-text-muted mt-0.5" />
                    <span>
                      <strong className="text-text-primary">Note:</strong> {order.special_instructions}
                    </span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
                  {canStartPrep && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => setRejectingOrder(order)}
                        className="text-error border-error/30 hover:bg-error/5"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject Order
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        className="gap-1.5 font-bold text-white bg-primary hover:bg-primary-hover"
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ChefHat className="h-4 w-4" />
                        )}
                        Accept & Start Preparing
                      </Button>
                    </>
                  )}

                  {canMarkReady && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={isProcessing}
                      onClick={() => handleUpdateStatus(order.id, 'ready_for_pickup')}
                      className="bg-success hover:bg-success/90 text-white gap-1.5"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Mark Ready for Pickup
                    </Button>
                  )}

                  {isReady && (
                    <div className="flex items-center gap-2 text-caption font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                      <Clock className="h-4 w-4 animate-pulse" />
                      <span>Ready for Rider Pickup</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Order Modal */}
      {rejectingOrder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-body-large font-bold text-text-primary">Reject Order</h3>
            <p className="text-body-small text-text-secondary">
              Please state why you are rejecting order #{rejectingOrder.id.slice(0, 8)}. The customer will be notified and a refund will be queued.
            </p>
            <div>
              <label className="block text-caption font-semibold text-text-primary mb-1">
                Reason for Rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Item out of stock, kitchen closed"
                className="w-full h-24 rounded-xl border border-border p-3 text-body-small focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRejecting}
                onClick={() => {
                  setRejectingOrder(null)
                  setRejectReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isRejecting || !rejectReason.trim()}
                onClick={handleConfirmReject}
                className="bg-error hover:bg-error/90 text-white"
              >
                {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
