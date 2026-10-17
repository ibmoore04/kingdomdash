import React from 'react'
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  XCircle,
  Store,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DeliveryRadarProps {
  status: string
  serviceType?: 'food' | 'grocery' | 'courier' | string
  cancellationReason?: string | null
  refundRequired?: boolean
  className?: string
  isCashOnDelivery?: boolean
  estimatedMinutes?: number
  distanceKm?: number | null
}

interface RadarStep {
  id: string
  label: string
  description: string
  icon: React.ElementType
}

export function DeliveryRadar({
  status,
  serviceType = 'food',
  cancellationReason,
  refundRequired,
  className,
  isCashOnDelivery = false,
  estimatedMinutes,
  distanceKm,
}: DeliveryRadarProps) {
  const isCourier = serviceType === 'courier'
  const isGrocery = serviceType === 'grocery'
  const isCancelled = status === 'cancelled'

  const standardSteps: RadarStep[] = [
    {
      id: 'paid',
      label: isCashOnDelivery ? 'Order Placed' : 'Payment Confirmed',
      description: isCashOnDelivery ? 'Cash on handover' : 'Order placed & verified',
      icon: CheckCircle2,
    },
    {
      id: 'preparing',
      label: isGrocery ? 'Merchant Gathering' : 'Kitchen Preparing',
      description: isGrocery ? 'Assembling items' : 'Merchant boxing meal',
      icon: isGrocery ? Store : ChefHat,
    },
    {
      id: 'ready',
      label: 'Ready for Pickup',
      description: 'Awaiting rider dispatch',
      icon: Clock,
    },
    {
      id: 'in_transit',
      label: 'Out for Delivery',
      description: 'Rider en route to you',
      icon: Bike,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      description: 'Package received',
      icon: PackageCheck,
    },
  ]

  const courierSteps: RadarStep[] = [
    {
      id: 'paid',
      label: isCashOnDelivery ? 'Booking Placed' : 'Booking Confirmed',
      description: isCashOnDelivery ? 'Cash on handover' : 'Courier request booked',
      icon: CheckCircle2,
    },
    {
      id: 'ready',
      label: 'Dispatched',
      description: 'Rider assigned to pickup',
      icon: Clock,
    },
    {
      id: 'in_transit',
      label: 'In Transit',
      description: 'Package heading to recipient',
      icon: Bike,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      description: 'Package received by recipient',
      icon: PackageCheck,
    },
  ]

  const steps = isCourier ? courierSteps : standardSteps

  const getActiveStepIndex = (currentStatus: string): number => {
    switch (currentStatus) {
      case 'pending':
      case 'payment_pending':
      case 'payment_processing':
        return isCashOnDelivery ? 0 : -1
      case 'payment_confirmed':
        return 0
      case 'preparing':
        return isCourier ? 0 : 1
      case 'ready_for_pickup':
        return isCourier ? 1 : 2
      case 'picked_up':
      case 'in_transit':
        return isCourier ? 2 : 3
      case 'delivered':
        return isCourier ? 3 : 4
      case 'cancelled':
        return -2
      default:
        return 0
    }
  }

  const activeIndex = getActiveStepIndex(status)

  const getLiveMessage = (): string => {
    switch (status) {
      case 'pending':
      case 'payment_pending':
      case 'payment_processing':
        return isCashOnDelivery
          ? 'Order placed with Cash on Delivery! Merchant has received your order and cash will be paid on delivery.'
          : 'Waiting for payment confirmation to initiate delivery...'
      case 'payment_confirmed':
        return isCashOnDelivery
          ? 'Order confirmed with Cash on Delivery! Preparing items for dispatch.'
          : 'Payment verified! Your order is being dispatched to the merchant...'
      case 'preparing':
        return isCourier
          ? 'Courier dispatch is reviewing pickup coordinates...'
          : isGrocery
          ? 'Merchant is packing your fresh grocery items...'
          : 'Kitchen has received your order and is cooking...'
      case 'ready_for_pickup':
        return 'Order is packaged and awaiting dispatch rider arrival...'
      case 'picked_up':
      case 'in_transit':
        return 'Rider has collected your order and is en route to your doorstep!'
      case 'delivered':
        return 'Order delivered successfully. Enjoy your delivery!'
      case 'cancelled':
        return 'This order has been cancelled.'
      default:
        return 'Live fulfillment tracking active.'
    }
  }

  if (isCancelled) {
    return (
      <div
        data-testid="order-timeline-cancelled"
        className={cn(
          'rounded-3xl border border-error/20 bg-error/5 p-6 text-center space-y-3',
          className
        )}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error/10 text-error">
          <XCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-body-large font-bold text-error">Order Cancelled</h3>
        {cancellationReason && (
          <p className="text-body-small text-text-secondary">
            Reason: <span className="font-semibold text-text-primary">{cancellationReason}</span>
          </p>
        )}
        {refundRequired && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-1.5 text-caption font-semibold text-amber-900 border border-amber-500/20">
            <span>Refund Status: Queued for review</span>
          </div>
        )}
      </div>
    )
  }

  // Calculate percentage of progress bar filled
  const progressPercentage =
    activeIndex < 0
      ? 0
      : Math.min(100, Math.round((activeIndex / (steps.length - 1)) * 100))

  return (
    <div
      data-testid="order-timeline"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs',
        className
      )}
    >
      {/* Top Header Row with Multi-ring Beacon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary shadow-[0_0_8px_rgba(229,9,20,0.6)]" />
            </span>
            <h2 className="text-base font-bold text-neutral-900">
              {isCourier ? 'Courier Dispatch Delivery' : 'Live Fulfillment Radar'}
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            Real-time delivery progress in Ijebu-Ode
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dynamic ETA Pill when in progress */}
          {(estimatedMinutes !== undefined || distanceKm) && activeIndex >= 0 && activeIndex < steps.length - 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-100 shadow-2xs">
              <Clock className="h-3.5 w-3.5 text-primary animate-pulse" aria-hidden="true" />
              <span>ETA ~{estimatedMinutes || 18} mins</span>
              {distanceKm && (
                <>
                  <span className="text-neutral-500">•</span>
                  <span className="text-neutral-300 font-bold">
                    {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)} km`}
                  </span>
                </>
              )}
            </span>
          )}

          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary capitalize border border-primary/20">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>
              {isCashOnDelivery && (status === 'pending' || status === 'payment_pending')
                ? 'Cash on Delivery'
                : status.replace(/_/g, ' ')}
            </span>
          </span>
        </div>
      </div>

      {/* Live Status Pill */}
      <div className="my-5 rounded-2xl bg-neutral-50 border border-neutral-100 p-3.5 flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clock className="h-4 w-4" aria-hidden="true" />
        </div>
        <p className="text-xs font-semibold text-neutral-800 leading-snug">
          {getLiveMessage()}
        </p>
      </div>

      {/* Radar Progress Pipeline */}
      <div className="relative pt-2 pb-1">
        {/* Connecting Progress Bar (hidden on mobile, visible on sm+) */}
        <div
          className="absolute top-7 left-10 right-10 hidden sm:block h-1.5 bg-neutral-100 rounded-full overflow-hidden"
          aria-hidden="true"
        >
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-primary to-primary transition-all duration-700 ease-out shadow-xs"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Connecting Progress Bar for Mobile (vertical spine) */}
        <div
          className="absolute top-6 bottom-8 left-[21px] w-0.5 bg-neutral-100 sm:hidden"
          aria-hidden="true"
        >
          <div
            className="w-full bg-gradient-to-b from-emerald-500 via-primary to-primary transition-all duration-700 ease-out"
            style={{ height: `${progressPercentage}%` }}
          />
        </div>

        <ol className="relative flex flex-col sm:flex-row justify-between w-full gap-5 sm:gap-2">
          {steps.map((step, idx) => {
            const isCompleted = activeIndex > idx
            const isCurrent = activeIndex === idx
            const isUpcoming = activeIndex < idx
            const Icon = step.icon

            return (
              <li
                key={step.id}
                data-testid={`timeline-step-${step.id}`}
                data-step-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}
                className="relative flex sm:flex-col items-center sm:items-center text-left sm:text-center flex-1 gap-3.5 sm:gap-2 z-10"
              >
                {/* Step Circle / Radar Halo */}
                <div
                  className={cn(
                    'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white font-bold transition-all duration-300 shadow-xs',
                    isCompleted && 'bg-emerald-600 ring-4 ring-emerald-500/20 shadow-emerald-500/20',
                    isCurrent &&
                      'bg-primary ring-4 ring-primary/25 shadow-[0_0_15px_rgba(229,9,20,0.35)] scale-110 animate-pulse',
                    isUpcoming && 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                {/* Step Text */}
                <div className="min-w-0 flex-1 sm:flex-initial">
                  <h3
                    className={cn(
                      'text-xs font-bold leading-tight transition-colors',
                      isCurrent && 'text-primary',
                      isCompleted && 'text-neutral-900',
                      isUpcoming && 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </h3>
                  <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">
                    {step.description}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
