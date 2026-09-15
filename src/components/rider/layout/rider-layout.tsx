import { useState, useEffect, type ReactNode } from 'react'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { RiderHeader } from './rider-header'
import { RiderSidebar } from './rider-sidebar'
import { RiderBottomNav } from './rider-bottom-nav'
import { RiderPendingView } from '../shared/rider-pending-view'
import { updateRiderAvailability } from '@/services/rider/rider-service'
import { WifiOff, RefreshCw } from 'lucide-react'

interface RiderLayoutProps {
  children: ReactNode
  activeTripCount?: number
  inboxCount?: number
}

export function RiderLayout({
  children,
  activeTripCount = 0,
  inboxCount = 0,
}: RiderLayoutProps) {
  const { rider, isLoading, isPendingApproval, refreshRider } = useCurrentRider()
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

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
    <div className="flex h-screen flex-col overflow-hidden bg-page-background">
      {/* Offline connectivity warning banner */}
      {!isOnline && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-error px-4 py-2 text-caption font-bold text-white shadow-xs">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>No internet connection. Actions will resume once connection is restored.</span>
        </div>
      )}

      <RiderHeader rider={rider} onToggleAvailability={handleToggleAvailability} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <RiderSidebar rider={rider} activeTripCount={activeTripCount} />

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="mx-auto w-full max-w-4xl">{children}</div>
        </main>
      </div>

      <RiderBottomNav activeTripCount={activeTripCount} inboxCount={inboxCount} />
    </div>
  )
}
