import React from 'react';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  Home,
  ShieldCheck,
  AlertCircle,
  Navigation,
} from 'lucide-react';

export interface LiveDeliveryStepperProps {
  status: string;
  etaMinutes?: number;
  deliveryPin?: string;
  orderNumber?: string;
}

interface StepItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: StepItem[] = [
  {
    id: 'placed',
    label: 'Order Confirmed',
    shortLabel: 'Confirmed',
    description: 'Payment verified via Paystack',
    icon: CheckCircle2,
  },
  {
    id: 'cooking',
    label: 'Kitchen Preparing',
    shortLabel: 'Cooking',
    description: 'Chef is cooking & packaging',
    icon: ChefHat,
  },
  {
    id: 'dispatched',
    label: 'Rider Assigned',
    shortLabel: 'Rider',
    description: 'Courier assigned & at store',
    icon: Navigation,
  },
  {
    id: 'transit',
    label: 'On the Way',
    shortLabel: 'In Transit',
    description: 'En route to your doorstep',
    icon: Bike,
  },
  {
    id: 'delivered',
    label: 'Delivered',
    shortLabel: 'Delivered',
    description: 'Package handed over safely',
    icon: Home,
  },
];

export const LiveDeliveryStepper: React.FC<LiveDeliveryStepperProps> = ({
  status,
  etaMinutes = 22,
  deliveryPin,
  orderNumber,
}) => {
  // Compute active step index (0 to 4)
  const getActiveIndex = () => {
    switch (status) {
      case 'placed':
      case 'payment_pending':
      case 'payment_processing':
      case 'payment_confirmed':
        return 0;
      case 'confirmed':
      case 'preparing':
      case 'cooking':
        return 1;
      case 'ready':
      case 'ready_for_pickup':
      case 'assigned':
        return 2;
      case 'picked_up':
      case 'in_transit':
      case 'delivering':
        return 3;
      case 'delivered':
        return 4;
      case 'cancelled':
        return -1;
      default:
        return 1;
    }
  };

  const activeIndex = getActiveIndex();
  const isCancelled = status === 'cancelled';
  const isDelivered = status === 'delivered';

  const progressPercent = isCancelled
    ? 0
    : isDelivered
    ? 100
    : Math.max(10, Math.min(100, (activeIndex / (STEPS.length - 1)) * 100));

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-neutral-200 bg-white p-3.5 sm:p-7 shadow-xs space-y-4 sm:space-y-6">
      {/* Top Header with Live ETA and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3.5 sm:pb-5 border-b border-neutral-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-lg font-extrabold text-neutral-900 tracking-tight">
              Live Order Fulfillment Stepper
            </h3>
            {isCancelled ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                Cancelled
              </span>
            ) : isDelivered ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Delivered
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Live Tracking
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
            Real-time status synchronizing with kitchen and courier custody
          </p>
        </div>

        {/* ETA & PIN Box */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 self-start sm:self-auto">
          {!isDelivered && !isCancelled && (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-200/80 text-xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="text-neutral-600 font-medium text-[11px] sm:text-xs">ETA:</span>
              <strong className="text-neutral-900 font-bold text-[11px] sm:text-xs">~{etaMinutes} mins</strong>
            </div>
          )}

          {deliveryPin && !isDelivered && !isCancelled && (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-neutral-600 font-medium text-[11px] sm:text-xs">PIN:</span>
              <strong className="font-mono text-emerald-800 font-black tracking-widest text-[11px] sm:text-xs">
                {deliveryPin}
              </strong>
            </div>
          )}
        </div>
      </div>

      {/* Progress Track with animated fill */}
      <div className="relative pt-1 sm:pt-2 pb-2 sm:pb-4">
        {/* Track Line */}
        <div className="relative h-1.5 sm:h-2 w-full rounded-full bg-neutral-100 overflow-hidden">
          <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isCancelled
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-emerald-500 via-primary to-primary-hover'
            }`}
          />
        </div>

        {/* Steps Grid (Optimized for Mobile Phone Screens) */}
        <div className="grid grid-cols-5 gap-1 mt-3 sm:mt-4">
          {STEPS.map((step, index) => {
            const isCompleted = !isCancelled && index < activeIndex;
            const isCurrent = !isCancelled && index === activeIndex;
            const IconComponent = step.icon;

            return (
              <div key={step.id} className="flex flex-col items-center text-center">
                {/* Step Node */}
                <div
                  className={`w-7 h-7 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                    isCurrent
                      ? 'bg-primary text-white shadow-md ring-2 sm:ring-4 ring-primary/20 scale-105'
                      : isCompleted
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                  }`}
                >
                  <IconComponent className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>

                {/* Step Title & Description */}
                <div className="mt-1.5 sm:mt-2.5 space-y-0.5">
                  <div
                    className={`text-[9px] sm:text-xs font-bold leading-tight truncate max-w-full ${
                      isCurrent
                        ? 'text-primary'
                        : isCompleted
                        ? 'text-neutral-900'
                        : 'text-neutral-400'
                    }`}
                  >
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                  <div className="hidden sm:block text-[10px] text-neutral-500 leading-tight">
                    {step.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
