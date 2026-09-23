import React from 'react'
import { CheckCircle2, Clock, ChefHat, Bike, PackageCheck, XCircle } from 'lucide-react'

export interface OrderStatusTimelineProps {
  status: string
  serviceType?: 'food' | 'grocery' | 'courier' | string
  cancellationReason?: string | null
  refundRequired?: boolean
}

interface TimelineStep {
  id: string
  label: string
  description: string
  icon: React.ElementType
}

export const OrderStatusTimeline: React.FC<OrderStatusTimelineProps> = ({
  status,
  serviceType = 'food',
  cancellationReason,
  refundRequired,
}) => {
  const isCourier = serviceType === 'courier'
  const isCancelled = status === 'cancelled'

  // Food & Grocery 5-stage timeline
  const standardSteps: TimelineStep[] = [
    {
      id: 'paid',
      label: 'Payment Confirmed',
      description: 'Order placed & verified',
      icon: CheckCircle2,
    },
    {
      id: 'preparing',
      label: 'Vendor Preparing',
      description: 'Merchant preparing your items',
      icon: ChefHat,
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
      description: 'Rider on the way',
      icon: Bike,
    },
    {
      id: 'delivered',
      label: 'Delivered',
      description: 'Package received',
      icon: PackageCheck,
    },
  ]

  // Courier direct-dispatch timeline (skips vendor preparation stages)
  const courierSteps: TimelineStep[] = [
    {
      id: 'paid',
      label: 'Booking Confirmed',
      description: 'Courier request booked',
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
        return -1
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

  if (isCancelled) {
    return (
      <div
        data-testid="order-timeline-cancelled"
        className="rounded-2xl border border-error/20 bg-error/5 p-6 text-center space-y-3"
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

  return (
    <div data-testid="order-timeline" className="rounded-2xl border border-border bg-white p-6 shadow-xs">
      <div className="flex items-center justify-between mb-6 pb-3 border-b border-border">
        <div>
          <h2 className="text-body-large font-bold text-text-primary">Order Progress</h2>
          <p className="text-caption text-text-muted">
            {isCourier ? 'Courier Dispatch Delivery' : 'Live Fulfillment Tracking'}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-caption font-bold text-primary capitalize">
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="relative">
        <ol className="relative flex flex-col sm:flex-row justify-between w-full gap-4 sm:gap-2">
          {steps.map((step, idx) => {
            const isCompleted = activeIndex > idx
            const isCurrent = activeIndex === idx
            const Icon = step.icon

            return (
              <li
                key={step.id}
                data-testid={`timeline-step-${step.id}`}
                data-step-status={isCompleted ? 'completed' : isCurrent ? 'current' : 'upcoming'}
                className="relative flex sm:flex-col items-center sm:items-center text-left sm:text-center flex-1 gap-3 sm:gap-2"
              >
                {/* Step Circle */}
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white font-bold transition-all shadow-xs z-10 ${
                    isCompleted
                      ? 'bg-success ring-4 ring-success/15'
                      : isCurrent
                      ? 'bg-primary ring-4 ring-primary/20 animate-pulse'
                      : 'bg-neutral-200 text-neutral-400'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                {/* Step Labels */}
                <div className="min-w-0 flex-1 sm:flex-initial">
                  <h3
                    className={`text-caption font-bold ${
                      isCurrent
                        ? 'text-primary'
                        : isCompleted
                        ? 'text-text-primary'
                        : 'text-text-muted'
                    }`}
                  >
                    {step.label}
                  </h3>
                  <p className="text-[11px] text-text-muted leading-tight mt-0.5">
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
