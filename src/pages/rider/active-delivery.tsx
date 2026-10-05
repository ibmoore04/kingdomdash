import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiderLayout } from '@/components/rider/layout/rider-layout'
import { useCurrentRider } from '@/hooks/use-current-rider'
import {
  getRiderActiveDelivery,
  markDeliveryPickedUp,
  markDeliveryInTransit,
  markDeliveryDelivered,
} from '@/services/rider/custody-service'
import { getRiderAssignmentInbox } from '@/services/rider/assignment-service'
import { reportDeliveryIssue } from '@/services/rider/exception-service'
import type { ActiveDeliveryDetails, OperationalIssueType } from '@/types/rider'
import { cacheOrderGateDetails, registerAutoQueueSync, type QueuedDeliveryAction } from '@/services/rider/offline-delivery-queue'
import { VendorPrepIndicator } from '@/components/rider/delivery/vendor-prep-indicator'
import { CustodyActionBar } from '@/components/rider/delivery/custody-action-bar'
import { ExternalNavLauncher } from '@/components/rider/delivery/external-nav-launcher'
import { RouteMapView } from '@/components/rider/delivery/route-map-view'
import { OperationalIssueModal } from '@/components/rider/delivery/operational-issue-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bike,
  Store,
  MapPin,
  Phone,
  Package,
  FileText,
  CheckCircle2,
  RefreshCw,
  Inbox,
} from 'lucide-react'

import { supabase } from '@/services/supabase/client'

export default function RiderActiveDeliveryPage() {
  const navigate = useNavigate()
  const { refreshRider } = useCurrentRider()

  const [activeDelivery, setActiveDelivery] = useState<ActiveDeliveryDetails | null>(null)
  const [pendingOffersCount, setPendingOffersCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [issueModalOpen, setIssueModalOpen] = useState(false)
  const [completionSuccess, setCompletionSuccess] = useState(false)

  const loadActiveDelivery = useCallback(async () => {
    try {
      const [{ data: activeData }, { data: inboxData }] = await Promise.all([
        getRiderActiveDelivery(),
        getRiderAssignmentInbox(),
      ])
      if (activeData) {
        setActiveDelivery(activeData)
        cacheOrderGateDetails(activeData.order_id, {
          customerName: activeData.customer_name,
          customerPhone: activeData.customer_phone,
          deliveryAddress: activeData.delivery_address,
          pickupAddress: activeData.pickup_address,
        })
      } else {
        setActiveDelivery(null)
      }
      setPendingOffersCount(inboxData?.length || 0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadActiveDelivery()

    // Register auto queue sync on reconnect
    const unregisterSync = registerAutoQueueSync(async (queuedAction: QueuedDeliveryAction) => {
      try {
        if (!activeDelivery || activeDelivery.order_id !== queuedAction.orderId) return true
        if (queuedAction.actionType === 'pickup') {
          const res = await markDeliveryPickedUp(activeDelivery.delivery_id)
          if (res.success) await loadActiveDelivery()
          return res.success
        } else if (queuedAction.actionType === 'transit') {
          const res = await markDeliveryInTransit(activeDelivery.delivery_id)
          if (res.success) await loadActiveDelivery()
          return res.success
        } else if (queuedAction.actionType === 'delivered') {
          const res = await markDeliveryDelivered(activeDelivery.delivery_id, undefined, queuedAction.pin)
          if (res.success) await loadActiveDelivery()
          return res.success
        }
        return false
      } catch {
        return false
      }
    })

    // Real-time Supabase subscription for active delivery status updates with guaranteed teardown
    let channel: ReturnType<typeof supabase.channel> | null = null
    if (activeDelivery?.order_id) {
      channel = supabase
        .channel(`rider_active_delivery_${activeDelivery.order_id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: `order_id=eq.${activeDelivery.order_id}`,
          },
          () => {
            loadActiveDelivery()
          }
        )
        .subscribe()
    }

    // 10-second adaptive poll for vendor readiness status changes
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadActiveDelivery()
      }
    }, 10000)

    return () => {
      unregisterSync()
      if (channel) {
        supabase.removeChannel(channel)
      }
      clearInterval(interval)
    }
  }, [loadActiveDelivery, activeDelivery?.order_id, activeDelivery?.delivery_id])

  const handlePickup = async (notes?: string) => {
    if (!activeDelivery) return
    setIsMutating(true)
    try {
      const { success, error } = await markDeliveryPickedUp(activeDelivery.delivery_id, notes)
      if (!success && error) {
        throw error
      }
      await loadActiveDelivery()
    } finally {
      setIsMutating(false)
    }
  }

  const handleTransit = async (notes?: string) => {
    if (!activeDelivery) return
    setIsMutating(true)
    try {
      const { success, error } = await markDeliveryInTransit(activeDelivery.delivery_id, notes)
      if (!success && error) {
        throw error
      }
      await loadActiveDelivery()
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelivered = async (notes?: string, pin?: string) => {
    if (!activeDelivery) return
    setIsMutating(true)
    try {
      const { success, error } = await markDeliveryDelivered(
        activeDelivery.delivery_id,
        notes,
        pin
      )
      if (!success && error) {
        throw error
      }
      setCompletionSuccess(true)
      await refreshRider()
    } finally {
      setIsMutating(false)
    }
  }

  const handleReportIssue = async (issueType: OperationalIssueType, notes: string) => {
    if (!activeDelivery) return
    const { success, error } = await reportDeliveryIssue(
      activeDelivery.delivery_id,
      issueType,
      notes
    )
    if (!success && error) {
      throw error
    }
    await loadActiveDelivery()
  }

  if (isLoading) {
    return (
      <RiderLayout activeTripCount={0}>
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-body-small text-text-secondary">Loading trip details...</p>
        </div>
      </RiderLayout>
    )
  }

  if (completionSuccess) {
    return (
      <RiderLayout activeTripCount={0}>
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <h2 className="text-h3 font-bold text-text-primary">Delivery Fulfilled!</h2>
          <p className="mt-2 text-body-small text-text-secondary">
            Order has been marked delivered and custody completed. Your completed deliveries count has been incremented.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={() => navigate('/rider/dashboard')}
            className="mt-6 w-full gap-2 font-bold text-white bg-primary hover:bg-primary-hover"
          >
            Back to Dashboard
          </Button>
        </div>
      </RiderLayout>
    )
  }

  if (!activeDelivery) {
    return (
      <RiderLayout activeTripCount={0} inboxCount={pendingOffersCount}>
        <h1 className="sr-only">Active Delivery Trip</h1>
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
          {pendingOffersCount > 0 ? (
            <>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-2">
                <Inbox className="h-8 w-8 animate-bounce" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[10px] font-bold text-white items-center justify-center">
                    {pendingOffersCount}
                  </span>
                </span>
              </div>
              <h2 className="mt-2 text-h3 font-extrabold text-text-primary">
                {pendingOffersCount} New Dispatch Offer{pendingOffersCount > 1 ? 's' : ''} Waiting!
              </h2>
              <p className="mt-1.5 max-w-sm text-body-small text-text-secondary leading-relaxed">
                An order has been allocated to you by dispatch. Tap below to review details and accept the trip to start navigation.
              </p>
              <Button asChild variant="primary" size="lg" className="mt-5 gap-2 font-bold text-white bg-primary hover:bg-primary-hover shadow-md rounded-xl">
                <Link to="/rider/assignments" className="text-white">
                  <Inbox className="h-5 w-5" aria-hidden="true" />
                  Review & Accept Offer ({pendingOffersCount})
                </Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-page-background text-text-muted">
                <Bike className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-h4 font-bold text-text-primary">No Active Delivery</h2>
              <p className="mt-1 max-w-sm text-body-small text-text-secondary">
                You do not currently have an accepted trip in progress. Check your inbox for available job offers.
              </p>
              <Button asChild variant="primary" className="mt-5 gap-2 font-bold text-white bg-primary hover:bg-primary-hover">
                <Link to="/rider/assignments" className="text-white">
                  <Inbox className="h-4 w-4" aria-hidden="true" />
                  View Dispatch Inbox
                </Link>
              </Button>
            </>
          )}
        </div>
      </RiderLayout>
    )
  }

  const isPostPickup = ['picked_up', 'in_transit', 'delivered'].includes(activeDelivery.delivery_status)

  const activeTargetCoords = isPostPickup
    ? (activeDelivery.delivery_latitude && activeDelivery.delivery_longitude)
      ? { latitude: activeDelivery.delivery_latitude, longitude: activeDelivery.delivery_longitude }
      : null
    : (activeDelivery.pickup_latitude && activeDelivery.pickup_longitude)
      ? { latitude: activeDelivery.pickup_latitude, longitude: activeDelivery.pickup_longitude }
      : null

  const activeTargetName = isPostPickup ? 'Customer Dropoff' : activeDelivery.vendor_name

  return (
    <RiderLayout activeTripCount={1}>
      <h1 className="sr-only">Active Delivery Trip</h1>
      <div className="space-y-5 pb-24">
        {/* Header summary */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-caption font-mono font-semibold text-text-muted">
                #{activeDelivery.delivery_id.slice(0, 8)}
              </span>
              <Badge
                variant={
                  activeDelivery.service_type === 'food'
                    ? 'primary'
                    : activeDelivery.service_type === 'grocery'
                    ? 'success'
                    : 'info'
                }
                className="capitalize text-caption"
              >
                {activeDelivery.service_type}
              </Badge>
            </div>
            <h1 className="text-h3 font-bold text-text-primary mt-0.5">
              {activeDelivery.vendor_name}
            </h1>
          </div>

          <Badge variant="warning" className="capitalize text-caption font-bold">
            {activeDelivery.delivery_status.replace('_', ' ')}
          </Badge>
        </div>

        {/* Leaflet Map Preview */}
        <RouteMapView
          pickupCoords={
            activeDelivery.pickup_latitude && activeDelivery.pickup_longitude
              ? { latitude: activeDelivery.pickup_latitude, longitude: activeDelivery.pickup_longitude }
              : null
          }
          deliveryCoords={
            activeDelivery.delivery_latitude && activeDelivery.delivery_longitude
              ? { latitude: activeDelivery.delivery_latitude, longitude: activeDelivery.delivery_longitude }
              : null
          }
          deliveryStatus={activeDelivery.delivery_status}
        />

        {/* Turn-by-turn External Navigation Launcher */}
        <ExternalNavLauncher
          latitude={activeTargetCoords?.latitude ?? null}
          longitude={activeTargetCoords?.longitude ?? null}
          destinationName={activeTargetName}
        />

        {/* Vendor Preparation Readiness Feedback */}
        <VendorPrepIndicator
          orderStatus={activeDelivery.order_status}
          serviceType={activeDelivery.service_type}
        />

        {/* Stage 1: Pickup Location Card */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-body font-bold text-text-primary">Pickup Location</h2>
            </div>
            {isPostPickup && (
              <Badge variant="success" className="gap-1 text-caption">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                Picked Up
              </Badge>
            )}
          </div>

          <div>
            <p className="font-semibold text-text-primary">{activeDelivery.vendor_name}</p>
            <p className="text-body-small text-text-secondary mt-0.5">{activeDelivery.pickup_address}</p>
          </div>
        </div>

        {/* Stage 2: Destination Dropoff Card (Customer Contact Unmasked) */}
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-error" aria-hidden="true" />
              <h2 className="text-body font-bold text-text-primary">Destination Dropoff</h2>
            </div>
            {isPostPickup && (
              <Badge variant="primary" className="text-caption">
                Active Destination
              </Badge>
            )}
          </div>

          <div>
            <p className="font-semibold text-text-primary">{activeDelivery.customer_name}</p>
            <p className="text-body-small text-text-secondary mt-0.5">{activeDelivery.delivery_address}</p>
          </div>

          {activeDelivery.customer_phone && (
            <div className="pt-2 border-t border-border/60">
              <Button asChild variant="outline" size="sm" className="gap-2 text-primary border-primary/30">
                <a href={`tel:${activeDelivery.customer_phone}`}>
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call Customer ({activeDelivery.customer_phone})
                </a>
              </Button>
            </div>
          )}

          {activeDelivery.special_instructions && (
            <div className="flex items-start gap-2 rounded-xl bg-page-background p-3 text-caption text-text-secondary">
              <FileText className="h-4 w-4 text-text-muted mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <span className="font-semibold text-text-primary block">Delivery Instructions:</span>
                <span>{activeDelivery.special_instructions}</span>
              </div>
            </div>
          )}
        </div>

        {/* Cargo Line Items (Post-Acceptance Verification) */}
        {activeDelivery.items && activeDelivery.items.length > 0 && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" aria-hidden="true" />
              <h2 className="text-body font-bold text-text-primary">
                Cargo Items ({activeDelivery.items.length})
              </h2>
            </div>

            <ul className="divide-y divide-border/60 text-body-small">
              {activeDelivery.items.map((item) => (
                <li key={item.id} className="flex justify-between py-2">
                  <span className="text-text-primary font-medium">{item.product_name}</span>
                  <span className="text-text-secondary font-semibold">x{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sticky Custody Action Bar */}
        <CustodyActionBar
          orderId={activeDelivery.order_id}
          deliveryStatus={activeDelivery.delivery_status}
          orderStatus={activeDelivery.order_status}
          serviceType={activeDelivery.service_type}
          isMutating={isMutating}
          hasDeliveryPin={activeDelivery.has_delivery_pin}
          onPickup={handlePickup}
          onTransit={handleTransit}
          onDelivered={handleDelivered}
          onOpenIssueModal={() => setIssueModalOpen(true)}
        />

        {/* Non-mutating Issue Modal */}
        <OperationalIssueModal
          isOpen={issueModalOpen}
          onClose={() => setIssueModalOpen(false)}
          onSubmit={handleReportIssue}
          deliveryId={activeDelivery.delivery_id}
        />
      </div>
    </RiderLayout>
  )
}
