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
    <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between h-full">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-neutral-900 tracking-wider uppercase">
          Service Category Share
        </h3>
        <p className="text-xs text-neutral-500 mt-0.5">
          Distribution of volume across logistics lines
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-5 my-auto w-full">
        {/* Interactive Donut */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width="144"
            height="144"
            viewBox="0 0 160 160"
            className="transform -rotate-90 overflow-hidden"
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
              strokeWidth="20"
            />

            {total === 0 ? (
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#E2E8F0"
                strokeWidth="20"
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
                  strokeWidth="20"
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  className="transition-all hover:opacity-85 cursor-pointer"
                  onClick={() => onSelectService?.(seg.service_type)}
                />
              ))
            )}
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-black text-text-primary leading-none">{total}</span>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider mt-1">
              Orders
            </span>
          </div>
        </div>

        {/* Legend & Interactive Drill-down List */}
        <div className="flex flex-col gap-1.5 w-full min-w-0">
          {segments.map((item) => (
            <button
              key={item.service_type}
              type="button"
              onClick={() => onSelectService?.(item.service_type)}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-neutral-50 transition-colors text-left group w-full cursor-pointer border border-transparent hover:border-neutral-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.config.color }}
                />
                <span className="text-xs font-semibold text-neutral-800 group-hover:text-primary truncate">
                  {item.config.label}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-right">
                <span className="text-xs font-bold text-neutral-900">{item.order_count}</span>
                <span className="text-[11px] font-mono font-medium text-neutral-400">
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
