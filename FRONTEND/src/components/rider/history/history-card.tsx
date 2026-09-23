import type { CompletedDeliveryHistoryItem } from '@/types/rider'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, ArrowRight, Store, MapPin, Calendar, Coins } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'

export function getTripEarnings(item: CompletedDeliveryHistoryItem): number {
  if (item.earnings_amount && item.earnings_amount > 0) {
    return item.earnings_amount
  }
  switch (item.service_type) {
    case 'grocery':
      return 1000
    case 'courier':
      return 900
    case 'food':
    default:
      return 850
  }
}

interface HistoryCardProps {
  item: CompletedDeliveryHistoryItem
}

export function HistoryCard({ item }: HistoryCardProps) {
  const formattedDate = item.delivered_at
    ? new Date(item.delivered_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Completed'

  const tripEarnings = getTripEarnings(item)

  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm transition-all hover:shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant={
              item.service_type === 'food'
                ? 'primary'
                : item.service_type === 'grocery'
                ? 'success'
                : 'info'
            }
            className="capitalize font-semibold text-caption"
          >
            {item.service_type}
          </Badge>
          <span className="text-caption font-mono text-text-muted">
            #{item.delivery_id.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-caption font-bold text-emerald-700 border border-emerald-200">
            <Coins className="h-3 w-3" />
            +{formatNgn(tripEarnings)}
          </span>
          <Badge variant="success" className="gap-1 font-medium">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Delivered
          </Badge>
        </div>
      </div>

      <div className="mt-3 font-semibold text-text-primary text-body">
        {item.vendor_name}
      </div>

      <div className="mt-2 flex items-center gap-2 text-body-small text-text-secondary">
        <div className="flex items-center gap-1">
          <Store className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>{item.pickup_area}</span>
        </div>
        <ArrowRight className="h-3 w-3 text-text-muted shrink-0" aria-hidden="true" />
        <div className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-error" aria-hidden="true" />
          <span>{item.delivery_area}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-caption text-text-muted">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Delivered on {formattedDate}</span>
        </div>
        <span className="font-medium text-emerald-700">Settled to Wallet</span>
      </div>
    </div>
  )
}
