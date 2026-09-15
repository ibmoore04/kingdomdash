import { Bike, Clock, Check } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'

export type DeliveryOptionType = 'standard' | 'express'

export interface DeliveryOptionsCardProps {
  selectedOption: DeliveryOptionType
  onSelectOption: (option: DeliveryOptionType) => void
  standardPrice: number | null
  expressPrice: number | null
}

export function DeliveryOptionsCard({
  selectedOption,
  onSelectOption,
  standardPrice,
  expressPrice,
}: DeliveryOptionsCardProps) {
  const displayStandard = standardPrice !== null ? standardPrice : 600
  const displayExpress = expressPrice !== null ? expressPrice : (displayStandard + 600)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900">
          2. Delivery Options
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Choose how you want your order delivered
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Standard Delivery Card */}
        <button
          type="button"
          onClick={() => onSelectOption('standard')}
          className={`relative flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
            selectedOption === 'standard'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'standard'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Bike className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Standard Delivery
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                30 - 45 mins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(displayStandard)}
            </span>

            {/* Custom Radio */}
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'standard'
                  ? 'bg-primary text-white'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedOption === 'standard' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>
          </div>
        </button>

        {/* Express Delivery Card */}
        <button
          type="button"
          onClick={() => onSelectOption('express')}
          className={`relative flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
            selectedOption === 'express'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'express'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Express Delivery
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                15 - 25 mins
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <span className="text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(displayExpress)}
            </span>

            {/* Custom Radio */}
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'express'
                  ? 'bg-primary text-white'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedOption === 'express' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
