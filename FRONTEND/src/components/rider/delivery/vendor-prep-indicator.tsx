import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, PackageCheck } from 'lucide-react'

interface VendorPrepIndicatorProps {
  orderStatus: string
  serviceType: string
}

export function VendorPrepIndicator({
  orderStatus,
  serviceType,
}: VendorPrepIndicatorProps) {
  if (serviceType === 'courier' || serviceType === 'custom' || serviceType === 'personal_shopper') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-page-background p-3 text-body-small">
        <PackageCheck className="h-4 w-4 text-primary" aria-hidden="true" />
        <div>
          <span className="font-semibold text-text-primary">Direct Courier Dispatch</span>
          <p className="text-caption text-text-secondary">
            Bypasses merchant preparation. Ready for pickup immediately.
          </p>
        </div>
      </div>
    )
  }

  const isReady = orderStatus === 'ready_for_pickup'
  const isPostPickup = ['picked_up', 'in_transit', 'delivered'].includes(orderStatus)

  if (isPostPickup) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-body-small">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        <span className="font-semibold text-success">Package Picked Up from Vendor</span>
      </div>
    )
  }

  if (isReady) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-success/30 bg-success/10 p-3.5 text-body-small">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" aria-hidden="true" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-success">Ready For Pickup</span>
            <Badge variant="success" className="text-caption">
              Packed & Verified
            </Badge>
          </div>
          <p className="mt-0.5 text-caption text-text-secondary">
            The merchant has finished preparing the order. You may now confirm physical pickup.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-body-small">
      <Clock className="h-5 w-5 shrink-0 text-warning animate-spin mt-0.5" aria-hidden="true" />
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-text-primary">Vendor Preparing Order</span>
          <Badge variant="warning" className="text-caption">
            In Kitchen
          </Badge>
        </div>
        <p className="mt-0.5 text-caption text-text-secondary">
          Pickup is locked until the vendor marks the items ready. Please proceed to the restaurant and wait.
        </p>
      </div>
    </div>
  )
}
