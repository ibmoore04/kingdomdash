import { ShieldCheck, Sparkles, Award, Utensils, HeartHandshake, CheckCircle } from 'lucide-react'

export type TrustBadgeType =
  | 'verified_partner'
  | 'hygiene_inspected'
  | 'halal_friendly'
  | 'top_rated'
  | 'money_back'

export interface TrustBadgeConfig {
  id: TrustBadgeType
  label: string
  shortLabel: string
  description: string
  icon: typeof ShieldCheck
  bgClass: string
  textClass: string
  borderClass: string
}

export const TRUST_BADGE_DEFINITIONS: Record<TrustBadgeType, TrustBadgeConfig> = {
  verified_partner: {
    id: 'verified_partner',
    label: 'Verified Campus Partner',
    shortLabel: 'Verified Partner',
    description: 'Officially vetted, licensed, and registered with KingdomDash Campus Logistics.',
    icon: ShieldCheck,
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-800',
    borderClass: 'border-emerald-200',
  },
  hygiene_inspected: {
    id: 'hygiene_inspected',
    label: 'Hygiene Inspected',
    shortLabel: 'Hygiene Passed',
    description: 'Complies with rigorous kitchen cleanliness, food safe temperature, and packaging guidelines.',
    icon: Sparkles,
    bgClass: 'bg-teal-50',
    textClass: 'text-teal-800',
    borderClass: 'border-teal-200',
  },
  halal_friendly: {
    id: 'halal_friendly',
    label: 'Halal & Dietary Safe',
    shortLabel: 'Halal Safe',
    description: 'Prepared adhering strictly to dietary segregation and halal food preparation standards.',
    icon: Utensils,
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-200',
  },
  top_rated: {
    id: 'top_rated',
    label: 'Top Rated in Ijebu-Ode',
    shortLabel: 'Top Rated',
    description: 'Consistently maintains high ratings (4.5★+) with excellent fulfillment speed.',
    icon: Award,
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-800',
    borderClass: 'border-amber-200',
  },
  money_back: {
    id: 'money_back',
    label: '100% Freshness Guarantee',
    shortLabel: 'Fresh Guarantee',
    description: 'Hot and intact on delivery, or receive prompt dispute resolution and refund support.',
    icon: HeartHandshake,
    bgClass: 'bg-rose-50',
    textClass: 'text-rose-800',
    borderClass: 'border-rose-200',
  },
}

/**
 * Compact pill for vendor cards and search items
 */
export function TrustBadgePill({ type }: { type: TrustBadgeType }) {
  const badge = TRUST_BADGE_DEFINITIONS[type]
  if (!badge) return null
  const Icon = badge.icon

  return (
    <span
      title={badge.description}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-tight transition-colors shadow-2xs ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{badge.shortLabel}</span>
    </span>
  )
}

/**
 * Detailed trust row for vendor detail header banner
 */
export function TrustBadgeRow({
  badges = ['verified_partner', 'hygiene_inspected', 'money_back'],
  className = '',
}: {
  badges?: TrustBadgeType[]
  className?: string
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {badges.map((b) => {
        const config = TRUST_BADGE_DEFINITIONS[b]
        if (!config) return null
        const Icon = config.icon

        return (
          <div
            key={b}
            title={config.description}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-2xs transition-all hover:scale-[1.02] cursor-help ${config.bgClass} ${config.textClass} ${config.borderClass}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{config.label}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Enterprise reassurance banner for checkout and order completion
 */
export function EnterpriseTrustBanner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-neutral-200/90 bg-gradient-to-r from-emerald-50/60 via-white to-neutral-50/60 p-4 sm:p-5 shadow-xs ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
              KingdomDash Buyer Protection &amp; Food Quality Standard
            </h4>
            <p className="text-[11px] sm:text-xs text-neutral-500">
              Tamper-evident packaging • Authoritative escrow settlement • 24/7 Ijebu-Ode resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold text-neutral-700 sm:self-center">
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle className="h-3.5 w-3.5" />
            100% Verified Kitchens
          </span>
        </div>
      </div>
    </div>
  )
}
