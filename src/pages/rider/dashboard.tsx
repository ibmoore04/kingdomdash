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
  ShieldCheck,
  Star,
  RefreshCw,
  Radio,
  Power,
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
      <div className="space-y-6 w-full">
        {/* Welcome Banner */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm w-full">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-h3 font-bold text-text-primary">
                Rider Dashboard
              </h1>
              <Badge variant="success" className="gap-1 font-medium text-caption">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified Courier
              </Badge>
            </div>
            <p className="mt-1.5 text-body-small text-text-secondary leading-relaxed">
              {rider?.full_name ? `Welcome, ${rider.full_name} • ` : ''}Vehicle: <strong className="capitalize text-text-primary">{rider?.vehicle_type || 'Motorcycle'}</strong> • Market: <span className="font-semibold text-text-primary">Ijebu-Ode</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 w-full sm:w-auto sm:flex sm:items-center shrink-0">
            <div className="rounded-xl border border-border bg-page-background p-3 sm:px-4 sm:py-2.5 text-center flex-1">
              <span className="text-caption text-text-muted block font-medium">Rating</span>
              <span className="text-body-large font-bold text-amber-500 flex items-center justify-center gap-1 mt-0.5">
                <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden="true" />
                {Number(rider?.rating || 5.0).toFixed(1)}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-page-background p-3 sm:px-4 sm:py-2.5 text-center flex-1">
              <span className="text-caption text-text-muted block font-medium">Completed</span>
              <span className="text-body-large font-bold text-text-primary mt-0.5 block">
                {rider?.total_deliveries || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Availability & Duty Status Card */}
        <div
          data-testid="rider-duty-status-card"
          className={`rounded-2xl border p-5 sm:p-6 shadow-sm transition-all duration-200 w-full ${
            rider?.is_available
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-border bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all ${
                  rider?.is_available
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-page-background text-text-muted border border-border'
                }`}
              >
                {rider?.is_available ? (
                  <Radio className="h-6 w-6 animate-pulse text-white" aria-hidden="true" />
                ) : (
                  <Power className="h-6 w-6" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-body-large font-bold text-text-primary">
                    {rider?.is_available ? 'You are Online' : 'You are Offline'}
                  </span>
                  <Badge
                    variant={rider?.is_available ? 'success' : 'dark'}
                    className="text-caption font-semibold"
                  >
                    {rider?.is_available ? 'Ready for Jobs' : 'Unavailable'}
                  </Badge>
                </div>
                <p className="text-body-small text-text-secondary leading-snug">
                  {rider?.is_available
                    ? 'Eligible to receive incoming dispatches in Ijebu-Ode.'
                    : 'Switch online when you are ready to receive deliveries.'}
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

          {!rider && (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-caption text-amber-900">
              <p className="font-semibold">Rider Profile Not Found in Database</p>
              <p className="mt-0.5 text-text-secondary">
                No active rider record was found for your account in <code>public.riders</code>. Please ensure Migration 021 has been executed in Supabase and your account is provisioned as a rider.
              </p>
            </div>
          )}

          {rider && !rider.is_verified && (
            <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-caption text-amber-900 font-medium">
              Verification required by fleet operations before going online.
            </div>
          )}

          {toggleError && (
            <div className="mt-3 rounded-lg bg-error/10 border border-error/20 p-2.5 text-caption text-error font-medium flex items-center justify-between">
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
          <div className="overflow-hidden rounded-2xl border-2 border-primary bg-primary/5 p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="primary" className="uppercase font-bold">
                  In-Flight Delivery
                </Badge>
                <span className="text-caption font-mono text-text-muted">
                  #{activeDelivery.delivery_id.slice(0, 8)}
                </span>
              </div>
              <Badge variant="warning" className="capitalize font-semibold">
                {activeDelivery.delivery_status.replace('_', ' ')}
              </Badge>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-h4 font-bold text-text-primary">
                  {activeDelivery.vendor_name}
                </h2>
                <p className="text-body-small text-text-secondary">
                  Destination: {activeDelivery.delivery_address}
                </p>
              </div>

              <Button asChild variant="primary" className="gap-2 shrink-0 font-bold text-white bg-primary hover:bg-primary-hover">
                <Link to="/rider/deliveries/active" className="text-white">
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  Continue Active Trip
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Dispatch Offers Inbox Preview */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-h4 font-bold text-text-primary">
                Incoming Offers ({inboxOffers.length})
              </h2>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="gap-1 text-caption text-text-muted hover:text-text-primary"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
          </div>

          {inboxOffers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-white p-8 sm:p-10 text-center text-body-small text-text-secondary w-full shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-text-muted mb-3">
                <Inbox className="h-6 w-6 text-primary" aria-hidden="true" />
              </div>
              <h3 className="text-body-large font-bold text-text-primary mb-1">
                {rider?.is_available ? 'Ready for Dispatch' : 'Rider Offline'}
              </h3>
              {rider?.is_available ? (
                <p className="max-w-md mx-auto text-text-secondary">
                  No dispatch offers right now. You are online and eligible for instant courier dispatches in Ijebu-Ode.
                </p>
              ) : (
                <p className="max-w-md mx-auto text-text-secondary">
                  You are currently offline. Switch your status to Online above to receive customer order dispatches.
                </p>
              )}
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
