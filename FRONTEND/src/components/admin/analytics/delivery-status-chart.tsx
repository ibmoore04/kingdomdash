import type { DeliveryStatusDistItem } from '@/types/admin'

interface DeliveryStatusChartProps {
  data: DeliveryStatusDistItem[]
  onSelectStatus?: (status: string) => void
  isLoading?: boolean
}

const DELIVERY_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; hoverColor: string }
> = {
  pending: { label: 'Awaiting Dispatch', color: '#D97706', hoverColor: '#B45309' },
  assigned: { label: 'Assigned to Courier', color: '#64748B', hoverColor: '#475569' },
  picked_up: { label: 'Picked Up (In Custody)', color: '#334155', hoverColor: '#1E293B' },
  in_transit: { label: 'In Transit to Destination', color: '#0F172A', hoverColor: '#020617' },
  delivered: { label: 'Successfully Delivered', color: '#16A34A', hoverColor: '#15803D' },
  cancelled: { label: 'Cancelled Delivery', color: '#E50914', hoverColor: '#C90812' },
}

export function DeliveryStatusChart({
  data,
  onSelectStatus,
  isLoading = false,
}: DeliveryStatusChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
          <p className="text-caption text-text-muted">Loading delivery states…</p>
        </div>
      </div>
    )
  }

  const activeData = data.filter((d) => d.count > 0)
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      <div className="mb-4">
        <h3 className="text-body-large font-bold text-text-primary">Logistics & Custody State</h3>
        <p className="text-caption text-text-secondary">Click status to inspect dispatch and deliveries</p>
      </div>

      {activeData.length === 0 ? (
        <div className="flex h-44 items-center justify-center">
          <p className="text-body-small text-text-muted">No delivery records found for this period.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeData.map((item) => {
            const conf = DELIVERY_STATUS_CONFIG[item.status] || {
              label: item.status,
              color: '#64748B',
              hoverColor: '#475569',
            }
            const pct = Math.round((item.count / maxCount) * 100)

            return (
              <button
                key={item.status}
                type="button"
                onClick={() => onSelectStatus?.(item.status)}
                className="w-full text-left group focus:outline-none"
              >
                <div className="flex items-center justify-between text-caption mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: conf.color }}
                    />
                    <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                      {conf.label}
                    </span>
                  </div>
                  <span className="font-bold text-text-secondary">{item.count}</span>
                </div>

                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full transition-all group-hover:opacity-85"
                    style={{
                      width: `${Math.max(pct, 4)}%`,
                      backgroundColor: conf.color,
                    }}
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
