import { Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { MockVendor } from '@/types'

interface VendorCardProps {
  vendor: MockVendor
  to: string
}

export function VendorCard({ vendor, to }: VendorCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      {/* Image / video placeholder */}
      <div
        className="img-placeholder relative aspect-[3/2] w-full bg-dark-surface"
        aria-label={`${vendor.name} photo`}
        role="img"
      >
        <img
          src="/kingdomdash-backup.jpg"
          alt={vendor.name}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Open / closed badge — overlaid */}
        <span
          className={cn(
            'absolute right-3 top-3 rounded-pill px-2.5 py-1 text-eyebrow font-semibold uppercase tracking-wider',
            vendor.isOpen
              ? 'bg-[#16a34a]/90 text-white'
              : 'bg-near-black/70 text-white/60',
          )}
        >
          {vendor.isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-h4 text-text-primary transition-colors group-hover:text-primary">
          {vendor.name}
        </h3>
        <p className="line-clamp-2 flex-1 text-body-small leading-relaxed text-text-secondary">
          {vendor.description}
        </p>

        {/* Meta row */}
        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-caption text-text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {vendor.area}
          </span>
          <span className="flex items-center gap-1.5 text-caption text-text-muted">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {vendor.etaMinutes} min
          </span>
        </div>
      </div>
    </Link>
  )
}
