import type { OrderByServiceItem } from '@/types/admin'

interface ServiceDistributionChartProps {
  data: OrderByServiceItem[]
  onSelectService?: (serviceType: string) => void
  isLoading?: boolean
}

const SERVICE_CONFIG: Record<
  string,
  { label: string; color: string; hoverColor: string; bgSoft: string }
> = {
  food: {
    label: 'Food Delivery',
    color: '#E50914',
    hoverColor: '#C90812',
    bgSoft: 'bg-red-50 text-red-700',
  },
  grocery: {
    label: 'Grocery Store',
    color: '#1F2937',
    hoverColor: '#111827',
    bgSoft: 'bg-light-surface text-text-primary',
  },
  courier: {
    label: 'Courier Dispatch',
    color: '#64748B',
    hoverColor: '#475569',
    bgSoft: 'bg-light-surface text-text-secondary',
  },
}

export function ServiceDistributionChart({
  data,
  onSelectService,
  isLoading = false,
}: ServiceDistributionChartProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
          <p className="text-caption text-text-muted">Loading service breakdown…</p>
        </div>
      </div>
    )
  }

  const total = data.reduce((acc, curr) => acc + curr.order_count, 0)

  // Calculate SVG stroke dashes for donut representation
  const radius = 60
  const circumference = 2 * Math.PI * radius

  let currentOffset = 0
  const segments = data.map((item) => {
    const ratio = total > 0 ? item.order_count / total : 0
    const strokeDasharray = `${ratio * circumference} ${circumference}`
    const strokeDashoffset = -currentOffset
    currentOffset += ratio * circumference
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      config: SERVICE_CONFIG[item.service_type] || {
        label: item.service_type,
        color: '#64748B',
        hoverColor: '#475569',
        bgSoft: 'bg-slate-50 text-slate-700',
      },
    }
  })

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      <div className="mb-4">
        <h3 className="text-body-large font-bold text-text-primary">Service Category Share</h3>
        <p className="text-caption text-text-secondary">Distribution of volume across logistics lines</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-6">
        {/* Interactive Donut */}
        <div className="relative flex items-center justify-center">
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            className="transform -rotate-90 overflow-visible"
            role="img"
            aria-label="Service distribution donut chart"
          >
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth="22"
            />

            {total === 0 ? (
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#E2E8F0"
                strokeWidth="22"
              />
            ) : (
              segments.map((seg) => (
                <circle
                  key={seg.service_type}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke={seg.config.color}
                  strokeWidth="22"
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  className="transition-all hover:opacity-85 cursor-pointer"
                  onClick={() => onSelectService?.(seg.service_type)}
                />
              ))
            )}
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-h3 font-bold text-text-primary leading-none">{total}</span>
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-0.5">
              Orders
            </span>
          </div>
        </div>

        {/* Legend & Interactive Drill-down List */}
        <div className="flex flex-col gap-2.5 w-full sm:w-auto min-w-[200px]">
          {segments.map((item) => (
            <button
              key={item.service_type}
              type="button"
              onClick={() => onSelectService?.(item.service_type)}
              className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-surface-muted transition-colors text-left group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: item.config.color }}
                />
                <span className="text-body-small font-semibold text-text-primary group-hover:text-primary">
                  {item.config.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-right">
                <span className="text-caption font-bold text-text-secondary">{item.order_count}</span>
                <span className="text-[11px] font-semibold text-text-muted min-w-[40px]">
                  {item.percentage}%
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
