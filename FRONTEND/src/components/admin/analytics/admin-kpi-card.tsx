import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'

interface AdminKpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  badge?: string
  badgeVariant?: 'default' | 'success' | 'warning' | 'critical'
  isLive?: boolean
  onClick?: () => void
  isLoading?: boolean
}

export function AdminKpiCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  badgeVariant = 'default',
  isLive = false,
  onClick,
  isLoading = false,
}: AdminKpiCardProps) {
  const badgeStyles = {
    default: 'bg-surface-muted text-text-secondary',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    critical: 'bg-primary/10 text-primary border-primary/20',
  }[badgeVariant]

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
      className={`relative overflow-hidden rounded-2xl border border-border bg-white p-3.5 sm:p-5 shadow-xs transition-all ${
        onClick
          ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20'
          : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs sm:text-body-small font-semibold text-text-secondary truncate">{title}</span>
          {isLive && (
            <span
              className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-primary"
              title="Real-time live metric"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          {icon}
        </div>
      </div>

      <div className="mt-2 sm:mt-3 flex items-baseline gap-1.5 sm:gap-2 min-w-0">
        {isLoading ? (
          <div className="h-7 sm:h-8 w-16 sm:w-20 animate-pulse rounded bg-surface-muted" />
        ) : (
          <span
            className="text-lg sm:text-h3 font-bold text-text-primary tracking-tight truncate"
            title={typeof value === 'string' ? value : undefined}
          >
            {value}
          </span>
        )}

        {badge && !isLoading && (
          <span className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold ${badgeStyles}`}>
            {badge}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-[10px] sm:text-caption text-text-muted truncate">
          {isLoading ? 'Updating…' : subtitle}
        </p>
      )}

      {onClick && (
        <div className="hidden sm:flex mt-3 items-center gap-1 text-[11px] font-bold text-primary hover:underline">
          <span>View records</span>
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </div>
      )}
    </div>
  )
}
