import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import { getRiderAssignmentInbox, acceptDeliveryAssignment, rejectDeliveryAssignment } from '@/services/rider/assignment-service'
import { getRiderActiveDelivery } from '@/services/rider/custody-service'
import type { AssignmentInboxOffer, ActiveDeliveryDetails } from '@/types/rider'
import { AssignmentCard } from '@/components/rider/assignments/assignment-card'
import { Switch } from '@/components/ui/switch'
import { updateRiderAvailability } from '@/services/rider/rider-service'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bike,
  Inbox,
  ArrowRight,
  Star,
  RefreshCw,
  Radio,
  Power,
  Wallet,
} from 'lucide-react'

export default function RiderDashboardPage() {
  const navigate = useNavigate()
  const { rider, refreshRider } = useCurrentRider()

  const [activeDelivery, setActiveDelivery] = useState<ActiveDeliveryDetails | null>(null)
  const [inboxOffers, setInboxOffers] = useState<AssignmentInboxOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [activeRes, inboxRes] = await Promise.all([
        getRiderActiveDelivery(),
        getRiderAssignmentInbox(),
      ])
      setActiveDelivery(activeRes.data)
      setInboxOffers(inboxRes.data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Polling interval (15 seconds, paused when hidden)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [loadData])

  const handleAcceptAssignment = async (assignmentId: string) => {
    const { success, error } = await acceptDeliveryAssignment(assignmentId)
    if (!success && error) {
      throw error
    }
    await loadData()
    await refreshRider()
    navigate('/rider/deliveries/active')
  }

  const handleRejectAssignment = async (assignmentId: string, reason?: string) => {
    const { success, error } = await rejectDeliveryAssignment(assignmentId, reason)
    if (!success && error) {
      throw error
    }
    await loadData()
  }

  const [isTogglingAvailability, setIsTogglingAvailability] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const handleToggleAvailability = async (nextState: boolean) => {
    setToggleError(null)
    setIsTogglingAvailability(true)
    try {
      const { success, error } = await updateRiderAvailability(nextState)
      if (!success && error) {
        setToggleError(error.message)
        return
      }
      await refreshRider()
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : 'Failed to update availability.')
    } finally {
      setIsTogglingAvailability(false)
    }
  }

  return (
    <RiderLayout
      activeTripCount={activeDelivery ? 1 : 0}
      inboxCount={inboxOffers.length}
    >
      <div className="space-y-4 w-full">
        {/* Simplified Header & Duty Switch Hero Card */}
        <div
          data-testid="rider-duty-status-card"
          className={`rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 w-full ${
            rider?.is_available
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-border bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all ${
                  rider?.is_available
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-page-background text-text-muted border border-border'
                }`}
              >
                {rider?.is_available ? (
                  <Radio className="h-5 w-5 animate-pulse text-white" aria-hidden="true" />
                ) : (
                  <Power className="h-5 w-5" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="sr-only">Rider Dashboard</h1>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-text-primary">
                    {rider?.is_available ? 'Online' : 'Offline'}
                  </span>
                  <Badge
                    variant={rider?.is_available ? 'success' : 'dark'}
                    className="text-[11px] font-semibold py-0"
                  >
                    {rider?.is_available ? 'Ready for Dispatches' : 'Unavailable'}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary mt-0.5 truncate">
                  {rider?.is_available
                    ? 'Ijebu-Ode delivery dispatch active'
                    : 'Tap switch to start receiving deliveries'}
                </p>
              </div>
            </div>

            <div className="shrink-0 pl-2">
              <Switch
                id="dashboard-availability-toggle"
                checked={rider?.is_available ?? false}
                onCheckedChange={handleToggleAvailability}
                disabled={isTogglingAvailability || !rider || !rider.is_verified || !rider.is_active}
                aria-label="Toggle rider online availability"
                className="scale-110"
              />
            </div>
          </div>

          {toggleError && (
            <div className="mt-3 rounded-xl bg-error/10 border border-error/20 p-2.5 text-caption text-error font-medium flex items-center justify-between">
              <span>{toggleError}</span>
              <button
                type="button"
                onClick={() => setToggleError(null)}
                className="text-caption underline hover:no-underline ml-2 shrink-0 font-bold"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Active Trip Banner if in flight */}
        {activeDelivery && (
          <div className="overflow-hidden rounded-2xl border-2 border-primary bg-primary/5 p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="primary" className="uppercase font-bold text-[10px]">
                  In-Flight Delivery
                </Badge>
                <span className="text-caption font-mono text-text-muted">
                  #{activeDelivery.delivery_id.slice(0, 8)}
                </span>
              </div>
              <Badge variant="warning" className="capitalize font-semibold text-[10px]">
                {activeDelivery.delivery_status.replace('_', ' ')}
              </Badge>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-text-primary truncate">
                  {activeDelivery.vendor_name}
                </h2>
                <p className="text-xs text-text-secondary truncate mt-0.5">
                  To: {activeDelivery.delivery_address}
                </p>
              </div>

              <Button asChild variant="primary" size="sm" className="gap-2 shrink-0 font-bold text-white bg-primary hover:bg-primary-hover h-9">
                <Link to="/rider/deliveries/active" className="text-white">
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  Continue Active Trip
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Quick Performance Strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border bg-white p-3 text-center">
            <span className="text-[11px] text-text-muted block font-medium">Rating</span>
            <span className="text-base font-extrabold text-amber-500 flex items-center justify-center gap-1 mt-0.5">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-hidden="true" />
              {Number(rider?.rating || 5.0).toFixed(1)}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-white p-3 text-center">
            <span className="text-[11px] text-text-muted block font-medium">Delivered</span>
            <span className="text-base font-extrabold text-text-primary mt-0.5 block">
              {rider?.total_deliveries || 0}
            </span>
          </div>

          <Link
            to="/rider/history"
            className="rounded-xl border border-border bg-white p-3 text-center hover:border-primary/50 transition-colors"
          >
            <span className="text-[11px] text-text-muted block font-medium">History</span>
            <span className="text-xs font-bold text-emerald-700 flex items-center justify-center gap-1 mt-1">
              <Wallet className="h-3.5 w-3.5" />
              Trips
            </span>
          </Link>
        </div>

        {/* Dispatch Offers Inbox Preview */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-sm font-bold text-text-primary">
                Incoming Offers ({inboxOffers.length})
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="gap-1 text-caption text-text-muted hover:text-text-primary h-7 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {inboxOffers.length === 0 ? (
            <div className="rounded-2xl border border-border bg-white p-5 text-center text-xs text-text-secondary w-full shadow-xs">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-page-background text-text-muted mb-2">
                <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-0.5">
                {rider?.is_available ? 'Waiting for Dispatch' : 'Rider is Offline'}
              </h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                {rider?.is_available
                  ? 'You are online in Ijebu-Ode. New delivery jobs will appear here automatically.'
                  : 'Toggle your status to Online above to receive incoming delivery offers.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {inboxOffers.map((offer) => (
                <AssignmentCard
                  key={offer.assignment_id}
                  offer={offer}
                  onAccept={handleAcceptAssignment}
                  onReject={handleRejectAssignment}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </RiderLayout>
  )
}
