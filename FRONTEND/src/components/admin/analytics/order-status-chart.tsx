import type { OrderStatusDistItem } from '@/types/admin'

interface OrderStatusChartProps {
  data: OrderStatusDistItem[]
  onSelectStatus?: (status: string) => void
  isLoading?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  payment_pending: 'Payment Pending',
  payment_processing: 'Processing',
  payment_confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export function OrderStatusChart({
  data,
  onSelectStatus,
  isLoading = false,
}: OrderStatusChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
          <p className="text-caption text-text-muted">Loading order distribution…</p>
        </div>
      </div>
    )
  }

  const activeData = data.filter((d) => d.count > 0)
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      <div className="mb-4">
        <h3 className="text-body-large font-bold text-text-primary">Order Lifecycle Distribution</h3>
        <p className="text-caption text-text-secondary">Click any status to filter live orders</p>
      </div>

      {activeData.length === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <p className="text-body-small text-text-muted">No orders in this time window.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeData.map((item) => {
            const label = STATUS_LABELS[item.status] || item.status
            const pct = Math.round((item.count / maxCount) * 100)

            const isTerminalSuccess = item.status === 'delivered'
            const isTerminalFail = item.status === 'cancelled'

            const barColor = isTerminalSuccess
              ? 'bg-emerald-600'
              : isTerminalFail
              ? 'bg-primary'
              : 'bg-neutral-800'

            return (
              <button
                key={item.status}
                type="button"
                onClick={() => onSelectStatus?.(item.status)}
                className="w-full text-left group focus:outline-none"
              >
                <div className="flex items-center justify-between text-caption mb-1">
                  <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                    {label}
                  </span>
                  <span className="font-bold text-text-secondary">{item.count}</span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className={`h-full rounded-full transition-all ${barColor} group-hover:opacity-85`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
