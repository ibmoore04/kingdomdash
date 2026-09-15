import { Ban, Check, Circle, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DeliveryStatus, OrderStatus, PaymentStatus } from '@/types'

const orderCopy: Record<OrderStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'; icon: typeof Check }> = {
  pending: { label: 'Pending', variant: 'default', icon: Circle },
  payment_pending: { label: 'Payment pending', variant: 'warning', icon: TriangleAlert },
  payment_processing: { label: 'Payment processing', variant: 'info', icon: Circle },
  payment_confirmed: { label: 'Payment confirmed', variant: 'success', icon: Check },
  preparing: { label: 'Preparing', variant: 'info', icon: Circle },
  ready_for_pickup: { label: 'Ready for pickup', variant: 'primary', icon: Circle },
  picked_up: { label: 'Picked up', variant: 'info', icon: Circle },
  in_transit: { label: 'In transit', variant: 'info', icon: Circle },
  delivered: { label: 'Delivered', variant: 'success', icon: Check },
  cancelled: { label: 'Cancelled', variant: 'error', icon: Ban },
}

const paymentCopy: Record<PaymentStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info'; icon: typeof Check }> = {
  pending: { label: 'Payment pending', variant: 'warning', icon: TriangleAlert },
  processing: { label: 'Processing', variant: 'info', icon: Circle },
  successful: { label: 'Successful', variant: 'success', icon: Check },
  failed: { label: 'Failed', variant: 'error', icon: Ban },
  refunded: { label: 'Refunded', variant: 'default', icon: Circle },
}

const deliveryCopy: Record<DeliveryStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'; icon: typeof Check }> = {
  pending: { label: 'Pending', variant: 'warning', icon: Circle },
  assigned: { label: 'Assigned', variant: 'info', icon: Circle },
  picked_up: { label: 'Picked up', variant: 'primary', icon: Circle },
  in_transit: { label: 'In transit', variant: 'info', icon: Circle },
  delivered: { label: 'Delivered', variant: 'success', icon: Check },
  cancelled: { label: 'Cancelled', variant: 'error', icon: Ban },
}

export function StatusBadge({
  kind,
  status,
}: {
  kind: 'order' | 'payment' | 'delivery'
  status: OrderStatus | PaymentStatus | DeliveryStatus
}) {
  const item =
    kind === 'order'
      ? orderCopy[status as OrderStatus]
      : kind === 'payment'
        ? paymentCopy[status as PaymentStatus]
        : deliveryCopy[status as DeliveryStatus]
  const Icon = item.icon

  return (
    <Badge variant={item.variant} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {item.label}
    </Badge>
  )
}
