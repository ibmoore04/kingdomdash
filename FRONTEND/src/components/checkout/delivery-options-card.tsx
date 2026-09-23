import { Bike, Clock, CalendarDays, Check } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'

export type DeliveryOptionType = 'standard' | 'express' | 'scheduled'

export interface DeliveryOptionsCardProps {
  selectedOption: DeliveryOptionType
  onSelectOption: (option: DeliveryOptionType) => void
  standardPrice: number | null
  expressPrice: number | null
  scheduledDate?: string
  onSelectScheduledDate?: (date: string) => void
  scheduledSlot?: string
  onSelectScheduledSlot?: (slot: string) => void
}

export const DELIVERY_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:00 AM - 01:00 PM',
  '01:00 PM - 03:00 PM',
  '03:00 PM - 05:00 PM',
  '05:00 PM - 07:00 PM',
  '07:00 PM - 09:00 PM',
]

export function getAvailableDates(): { label: string; value: string }[] {
  const dates = []
  const today = new Date()

  for (let i = 0; i < 3; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    const isoString = d.toISOString().split('T')[0]
    let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (i === 0) label = `Today (${label})`
    if (i === 1) label = `Tomorrow (${label})`
    dates.push({ label, value: isoString })
  }
  return dates
}

export function DeliveryOptionsCard({
  selectedOption,
  onSelectOption,
  standardPrice,
  expressPrice,
  scheduledDate,
  onSelectScheduledDate,
  scheduledSlot,
  onSelectScheduledSlot,
}: DeliveryOptionsCardProps) {
  const displayStandard = standardPrice !== null ? standardPrice : 600
  const displayExpress = expressPrice !== null ? expressPrice : (displayStandard + 600)
  const displayScheduled = displayStandard

  const availableDates = getAvailableDates()
  const activeDate = scheduledDate || availableDates[0]?.value || ''
  const activeSlot = scheduledSlot || DELIVERY_SLOTS[0]

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900">
          2. Delivery Options
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Choose how and when you want your order delivered in Ijebu-Ode
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Standard Delivery Card */}
        <button
          type="button"
          onClick={() => onSelectOption('standard')}
          className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
            selectedOption === 'standard'
              ? 'border-primary bg-primary/[0.03] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'standard'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Bike className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>

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

          <div>
            <p className="text-xs sm:text-sm font-bold text-neutral-900">
              Standard
            </p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              30 - 45 mins
            </p>
            <p className="mt-2 text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(displayStandard)}
            </p>
          </div>
        </button>

        {/* Express Delivery Card */}
        <button
          type="button"
          onClick={() => onSelectOption('express')}
          className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
            selectedOption === 'express'
              ? 'border-primary bg-primary/[0.03] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'express'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Clock className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>

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

          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Express
              </p>
              <span className="rounded bg-amber-100 px-1 py-0.2 text-[9px] font-bold text-amber-800">
                FAST
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              15 - 25 mins
            </p>
            <p className="mt-2 text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(displayExpress)}
            </p>
          </div>
        </button>

        {/* Scheduled Delivery Card */}
        <button
          type="button"
          onClick={() => {
            onSelectOption('scheduled')
            if (!scheduledDate && onSelectScheduledDate) {
              onSelectScheduledDate(availableDates[0]?.value || '')
            }
            if (!scheduledSlot && onSelectScheduledSlot) {
              onSelectScheduledSlot(DELIVERY_SLOTS[0])
            }
          }}
          className={`relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
            selectedOption === 'scheduled'
              ? 'border-primary bg-primary/[0.03] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'scheduled'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <CalendarDays className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </div>

            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                selectedOption === 'scheduled'
                  ? 'bg-primary text-white'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedOption === 'scheduled' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Scheduled
              </p>
              <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-800">
                NEW
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Pick date & slot
            </p>
            <p className="mt-2 text-xs sm:text-sm font-extrabold text-neutral-900">
              {formatNgn(displayScheduled)}
            </p>
          </div>
        </button>
      </div>

      {/* Sub-panel for Scheduled Delivery Slot Picker */}
      {selectedOption === 'scheduled' && (
        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.02] p-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-neutral-900">
              Select Delivery Window
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Date Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                Delivery Date
              </label>
              <select
                aria-label="Delivery Date"
                value={activeDate}
                onChange={(e) => onSelectScheduledDate && onSelectScheduledDate(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                {availableDates.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Slot Picker */}
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                Time Window
              </label>
              <select
                aria-label="Time Window"
                value={activeSlot}
                onChange={(e) => onSelectScheduledSlot && onSelectScheduledSlot(e.target.value)}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              >
                {DELIVERY_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="mt-2.5 text-[11px] text-neutral-500">
            A rider will be pre-assigned to pick up and deliver your order promptly during this window.
          </p>
        </div>
      )}
    </div>
  )
}
