import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { RiderHeader } from './rider-header'
import { RiderSidebar } from './rider-sidebar'
import { RiderBottomNav } from './rider-bottom-nav'
import { RiderPendingView } from '../shared/rider-pending-view'
import { CompulsoryRiderContactModal } from '../compulsory-rider-contact-modal'
import { AvatarPickerModal } from '@/components/common/avatar-picker-modal'
import { updateRiderAvailability } from '@/services/rider/rider-service'
import { Button } from '@/components/ui/button'
import { WifiOff, RefreshCw, Sparkles } from 'lucide-react'

interface RiderLayoutProps {
  children: ReactNode
  activeTripCount?: number
  inboxCount?: number
  title?: string
  subtitle?: string
}

export function RiderLayout({
  children,
  activeTripCount = 0,
  inboxCount = 0,
  title,
  subtitle,
}: RiderLayoutProps) {
  const location = useLocation()
  const { rider, isLoading, isPendingApproval, refreshRider } = useCurrentRider()
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleToggleAvailability = async (nextState: boolean) => {
    const { success, error } = await updateRiderAvailability(nextState)
    if (!success && error) {
      throw error
    }
    await refreshRider()
  }

  const currentTitle = useMemo(() => {
    if (title) return title
    const path = location.pathname
    if (path.includes('/rider/assignments')) return 'Dispatch Offers'
    if (path.includes('/rider/deliveries/active') || path.includes('/rider/deliveries/')) return 'Active Delivery Radar'
    if (path.includes('/rider/history')) return 'Trip History & Earnings'
    if (path.includes('/rider/profile')) return 'Rider Profile & Identity'
    if (path.includes('/rider/settings')) return 'Rider Settings & Fleet Preferences'
    if (path.includes('/rider/notifications')) return 'Rider Notifications'
    if (path.includes('/rider/support')) return 'Rider Support Desk'
    return 'Rider Workspace & Fleet Operations'
  }, [location.pathname, title])

  const currentSubtitle = useMemo(() => {
    if (subtitle) return subtitle
    const path = location.pathname
    if (path.includes('/rider/assignments')) return 'Real-time order pings and instant delivery offer dispatch across Ijebu-Ode.'
    if (path.includes('/rider/deliveries/active') || path.includes('/rider/deliveries/')) return 'Live GPS tracking, order routing, and customer drop-off milestones.'
    if (path.includes('/rider/history')) return 'Comprehensive summary of completed deliveries, daily payouts, and service ratings.'
    if (path.includes('/rider/profile')) return 'Authoritative rider credentials, vehicle registration, and character persona.'
    if (path.includes('/rider/settings')) return 'Customize turn-by-turn navigation apps, alert sounds, and fleet preferences.'
    if (path.includes('/rider/notifications')) return 'Priority system pings, order dispatch updates, and admin broadcasts.'
    if (path.includes('/rider/support')) return 'Direct 24/7 priority fleet dispatch support and issue escalation.'
    return 'Active dispatch telemetry, live radar tracking, and fleet fulfillment console.'
  }, [location.pathname, subtitle])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-page-background">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-body-small font-medium text-text-secondary">
            Loading Rider Workspace...
          </p>
        </div>
      </div>
    )
  }

  if (isPendingApproval || (rider && !rider.is_verified)) {
    return (
      <div className="min-h-screen bg-page-background">
        <RiderPendingView onRefresh={refreshRider} isLoading={isLoading} />
      </div>
    )
  }

  if (rider && !rider.is_active) {
    return (
      <div className="min-h-screen bg-page-background">
        <RiderPendingView onRefresh={refreshRider} isLoading={isLoading} isSuspended />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col">
      {/* Offline connectivity warning banner */}
      {!isOnline && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-error px-4 py-2 text-caption font-bold text-white shadow-xs z-40">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>No internet connection. Actions will resume once connection is restored.</span>
        </div>
      )}

      {/* 1. Full-Width Top Header */}
      <RiderHeader
        rider={rider}
        onToggleAvailability={handleToggleAvailability}
      />

      {/* 2. Full-Width Geometric Crimson KingdomDash Cover Banner (Edge-to-Edge) */}
      <div className="relative min-h-[12rem] sm:min-h-[14rem] lg:min-h-[15.5rem] w-full overflow-hidden bg-gradient-to-r from-[#5a0513] via-[#850d1e] to-[#38020a] shadow-inner shrink-0">
        <svg
          className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-85"
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="facet1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9B1124" />
              <stop offset="100%" stopColor="#6B0616" />
            </linearGradient>
            <linearGradient id="facet2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C41E3A" />
              <stop offset="100%" stopColor="#800A1A" />
            </linearGradient>
            <linearGradient id="facet3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E11D48" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#9B1124" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <polygon points="0,0 360,0 240,320 0,320" fill="url(#facet1)" />
          <polygon points="360,0 760,0 560,320 240,320" fill="url(#facet2)" />
          <polygon points="760,0 1200,0 980,320 560,320" fill="#750816" />
          <polygon points="980,320 1200,0 1200,320" fill="#4A040E" />
          <polygon points="240,320 560,320 420,130" fill="url(#facet3)" />
          <polygon points="560,320 980,320 780,120" fill="#B91C1C" fillOpacity="0.45" />
          <polygon points="360,0 580,150 760,0" fill="#F87171" fillOpacity="0.25" />
          <polygon points="140,0 420,130 240,320" fill="#4A040E" fillOpacity="0.4" />
        </svg>
        <div className="absolute inset-0 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />

        <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4 pt-5 sm:pt-6">
          <div className="space-y-1.5 max-w-2xl">
            {/* Sleek Top Pill Badge */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold bg-white/15 text-white backdrop-blur-md border border-white/25 uppercase tracking-widest shadow-2xs">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                </span>
                <span>Rider Fleet Portal</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-rose-200/90 tracking-wider">
                <span className="text-white/40">•</span>
                <span>Ijebu-Ode Operational Sector</span>
              </span>
            </div>

            {/* Cinematic Gradient Title with High-Contrast Drop Shadow */}
            <h1 className="text-2xl sm:text-3xl lg:text-[2.25rem] font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-rose-100 tracking-tight drop-shadow-[0_2px_14px_rgba(0,0,0,0.6)] leading-tight">
              {currentTitle}
            </h1>

            {/* Premium Informative Subtitle */}
            <p className="text-xs sm:text-sm text-rose-100/90 font-medium leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] max-w-xl">
              {currentSubtitle}
            </p>
          </div>

          {/* Change Character Button */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsAvatarPickerOpen(true)}
            className="gap-2 bg-black/40 hover:bg-black/60 text-white border border-white/25 backdrop-blur-md rounded-xl text-xs font-bold transition-all shadow-md hover:scale-102 cursor-pointer shrink-0 self-start ring-1 ring-white/10"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
            <span>Change Character</span>
          </Button>
        </div>
      </div>

      {/* 3. Main Content Area (Cards overlay the red cover banner by -mt-10 sm:-mt-14 lg:-mt-16) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-14 lg:-mt-16 pb-24 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Card 1: Desktop Navigation Sidebar Card (Sticky/Static on scroll) */}
          <RiderSidebar
            rider={rider}
            activeTripCount={activeTripCount}
            inboxCount={inboxCount}
          />

          {/* Active View / Main Page Content (9 columns on desktop) */}
          <div className="lg:col-span-9 space-y-6 min-w-0">
            {children}
          </div>
        </div>
      </main>

      {/* 4. Bottom Navigation (Mobile Only) */}
      <RiderBottomNav
        activeTripCount={activeTripCount}
        inboxCount={inboxCount}
      />

      {/* 5. Compulsory Contact Enforcement Modal */}
      <CompulsoryRiderContactModal rider={rider} onSaved={refreshRider} />

      {/* 6. Royal Character Avatar Picker Modal */}
      <AvatarPickerModal
        open={isAvatarPickerOpen}
        onOpenChange={setIsAvatarPickerOpen}
      />
    </div>
  )
}
