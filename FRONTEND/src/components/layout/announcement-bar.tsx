import { useState } from 'react'
import { MapPin, HelpCircle, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageContainer } from '@/components/layout/section'

export function AnnouncementBar() {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  return (
    <div
      role="region"
      aria-label="Service Announcement"
      className="bg-neutral-900 text-white/90 text-[11px] sm:text-xs border-b border-white/10 relative z-50 select-none"
    >
      <PageContainer className="flex items-center justify-between py-1.5 sm:py-2">
        {/* Left: Location Delivery Status */}
        <div className="flex items-center gap-2 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
            <span>Delivering across <strong className="text-white font-semibold">Ijebu-Ode Central</strong> and nearby areas</span>
          </div>
        </div>

        {/* Right: Help & Dismiss */}
        <div className="flex items-center gap-3 text-white/70">
          <Link
            to="/support"
            className="hidden sm:inline-flex items-center gap-1 hover:text-white transition-colors text-[11px] sm:text-xs"
          >
            <HelpCircle className="h-3 w-3 text-primary" aria-hidden="true" />
            <span>Help</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            aria-label="Dismiss announcement"
            className="text-white/50 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </PageContainer>
    </div>
  )
}
