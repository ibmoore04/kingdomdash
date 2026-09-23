import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import {
  getRiderAssignmentInbox,
  acceptDeliveryAssignment,
  rejectDeliveryAssignment,
} from '@/services/rider/assignment-service'
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
  TrendingUp,
  MapPin,
  AlertTriangle,
  Package,
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

    // Polling interval (15 seconds, paused when tab hidden)
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

  // Greeting by time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const riderFirstName = rider?.full_name?.split(' ')[0] || 'Rider'

  return (
    <RiderLayout
      activeTripCount={activeDelivery ? 1 : 0}
      inboxCount={inboxOffers.length}
    >
      <div className="space-y-5 sm:space-y-6 w-full">
        {/* ── Welcome & Operational Context Header ─────────────────────────── */}
        <h1 className="sr-only">Rider Dashboard</h1>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
                {greeting}, {riderFirstName}
              </h2>
              <span className="text-xl sm:text-2xl" role="img" aria-label="wave">
                👋
              </span>
            </div>
            <p className="text-body-small text-text-secondary mt-0.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>Ijebu-Ode Central Delivery Zone</span>
              <span className="text-text-muted">•</span>
              <span className="font-semibold text-text-primary capitalize">
                {rider?.vehicle_type || 'Motorcycle'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="gap-1.5 text-xs font-semibold h-9 rounded-xl border-border bg-white text-text-secondary hover:text-text-primary shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} aria-hidden="true" />
              <span>Sync Status</span>
            </Button>
          </div>
        </div>

        {/* ── Duty Switch Hero Card (TEST-ID PRESERVED) ────────────────────── */}
        <div
          data-testid="rider-duty-status-card"
          className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-300 p-5 sm:p-6 shadow-sm ${
            rider?.is_available
              ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white'
              : 'border-border bg-gradient-to-br from-slate-50 via-white to-slate-50/60'
          }`}
        >
          {/* Subtle background glow effect when online */}
          {rider?.is_available && (
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl"
              aria-hidden="true"
            />
          )}

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
              <div
                className={`relative flex h-13 w-13 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl transition-all shadow-md ${
                  rider?.is_available
                    ? 'bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white shadow-emerald-500/20 ring-4 ring-emerald-500/15'
                    : 'bg-white text-text-muted border border-border shadow-xs'
                }`}
              >
                {rider?.is_available ? (
                  <>
                    <Radio className="h-6 w-6 text-white" aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                  </>
                ) : (
                  <Power className="h-6 w-6 text-text-muted" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold text-text-primary tracking-tight">
                    {rider?.is_available ? 'Online (Available)' : 'Currently Offline'}
                  </span>
                  <Badge
                    variant={rider?.is_available ? 'success' : 'dark'}
                    className="text-[11px] font-bold px-2.5 py-0.5"
                  >
                    {rider?.is_available ? 'Ready for Dispatches' : 'Unavailable'}
                  </Badge>
                </div>
                <p className="text-body-small text-text-secondary mt-1">
                  {rider?.is_available
                    ? 'Ijebu-Ode delivery dispatch active. New offers from vendors will buzz your console.'
                    : 'Turn your switch ON when you are ready to receive orders and dispatches.'}
                </p>
              </div>
            </div>

            {/* Toggle switch controls */}
            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60 shrink-0">
              <label
                htmlFor="dashboard-availability-toggle"
                className="text-xs font-bold text-text-secondary sm:sr-only cursor-pointer"
              >
                {rider?.is_available ? 'Duty Active' : 'Go Online'}
              </label>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-text-muted hidden sm:inline">
                  {rider?.is_available ? 'Online' : 'Offline'}
                </span>
                <Switch
                  id="dashboard-availability-toggle"
                  checked={rider?.is_available ?? false}
                  onCheckedChange={handleToggleAvailability}
                  disabled={isTogglingAvailability || !rider || !rider.is_verified || !rider.is_active}
                  aria-label="Toggle rider online availability"
                  className="scale-125"
                />
              </div>
            </div>
          </div>

          {/* Toggle Error Banner */}
          {toggleError && (
            <div className="mt-4 rounded-xl bg-error/10 border border-error/20 p-3 text-caption text-error font-medium flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{toggleError}</span>
              </div>
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

        {/* ── Active In-Flight Delivery Banner (If active) ─────────────────── */}
        {activeDelivery && (
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-primary/15">
              <div className="flex items-center gap-2">
                <Badge variant="primary" className="uppercase font-bold text-[10px] tracking-wider px-2 py-0.5">
                  In-Flight Delivery
                </Badge>
                <span className="text-caption font-mono text-text-muted">
                  #{activeDelivery.delivery_id.slice(0, 8)}
                </span>
              </div>
              <Badge variant="warning" className="capitalize font-bold text-[11px] px-2.5 py-0.5">
                {activeDelivery.delivery_status.replace('_', ' ')}
              </Badge>
            </div>

            <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary shrink-0" />
                  <h2 className="text-base sm:text-lg font-extrabold text-text-primary truncate">
                    {activeDelivery.vendor_name}
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                  <span className="truncate">Destination: {activeDelivery.delivery_address}</span>
                </div>
              </div>

              <Button
                asChild
                variant="primary"
                size="md"
                className="gap-2 shrink-0 font-bold text-white bg-primary hover:bg-primary-hover rounded-xl shadow-sm"
              >
                <Link to="/rider/deliveries/active">
                  <Bike className="h-4 w-4" aria-hidden="true" />
                  <span>Open Active Trip Console</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* ── Key Performance Indicators (KPIs) ────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Rider Rating */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-text-muted mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Rating</span>
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" aria-hidden="true" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-text-primary">
              {Number(rider?.rating || 5.0).toFixed(1)}
              <span className="text-xs font-semibold text-text-muted ml-1">/ 5.0</span>
            </div>
            <span className="text-[11px] text-text-secondary mt-1 block">Customer score</span>
          </div>

          {/* Card 2: Total Deliveries */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-text-muted mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Deliveries</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-text-primary">
              {rider?.total_deliveries || 0}
            </div>
            <span className="text-[11px] text-text-secondary mt-1 block">Completed trips</span>
          </div>

          {/* Card 3: Duty State */}
          <div className="rounded-2xl border border-border bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-text-muted mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Duty Status</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  rider?.is_available ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'
                }`}
              />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-text-primary truncate">
              {rider?.is_available ? 'Online' : 'Offline'}
            </div>
            <span className="text-[11px] text-text-secondary mt-1 block">
              {rider?.is_available ? 'Ready for jobs' : 'Not available'}
            </span>
          </div>

          {/* Card 4: Trip History Shortcut */}
          <Link
            to="/rider/history"
            className="group rounded-2xl border border-border bg-white p-4 shadow-xs hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between text-text-muted mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-primary transition-colors">
                History
              </span>
              <ArrowRight className="h-4 w-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-base sm:text-lg font-bold text-text-primary group-hover:text-primary transition-colors flex items-center gap-1">
              <span>View Logs</span>
            </div>
            <span className="text-[11px] text-text-secondary mt-1 block">Past trips & details</span>
          </Link>
        </div>

        {/* ── Dispatch Offers Inbox Section ─────────────────────────────────── */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Inbox className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 className="text-base font-extrabold text-text-primary">
                Incoming Offers
              </h2>
              {inboxOffers.length > 0 && (
                <Badge variant="primary" className="text-xs font-bold px-2 py-0">
                  {inboxOffers.length} available
                </Badge>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="gap-1.5 text-xs text-text-muted hover:text-text-primary h-8 px-2.5 rounded-lg"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>Refresh Offers</span>
            </Button>
          </div>

          {inboxOffers.length === 0 ? (
            <div className="rounded-2xl sm:rounded-3xl border border-border bg-white p-8 sm:p-10 text-center shadow-xs">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3.5">
                <Inbox className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">
                {rider?.is_available ? 'Radar Active — Waiting for Dispatch' : 'Rider is Currently Offline'}
              </h3>
              <p className="text-body-small text-text-muted max-w-md mx-auto leading-relaxed">
                {rider?.is_available
                  ? 'Your dispatch radar is active in Ijebu-Ode. When a customer places an order or requests a courier, jobs will ping this inbox in real-time.'
                  : 'Toggle your status to Online above to start receiving instant delivery offers from nearby restaurants and stores.'}
              </p>
              {rider?.is_available && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-caption font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Scanning Ijebu-Ode network</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
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
