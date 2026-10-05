import { useState } from 'react'
import { Bike, Heart, Sparkles } from 'lucide-react'
import { formatNgn } from '@/utils/formatting'

export interface RiderTipSelectorProps {
  selectedTip: number
  onSelectTip: (tip: number) => void
  disabled?: boolean
}

const PRESET_TIPS = [0, 200, 500, 1000]

export function RiderTipSelector({
  selectedTip,
  onSelectTip,
  disabled = false,
}: RiderTipSelectorProps) {
  const [isCustom, setIsCustom] = useState(
    selectedTip > 0 && !PRESET_TIPS.includes(selectedTip)
  )
  const [customInput, setCustomInput] = useState(
    selectedTip > 0 && !PRESET_TIPS.includes(selectedTip) ? String(selectedTip) : ''
  )

  const handlePresetClick = (amount: number) => {
    if (disabled) return
    setIsCustom(false)
    setCustomInput('')
    onSelectTip(amount)
  }

  const handleCustomChange = (val: string) => {
    const numeric = val.replace(/\D/g, '').slice(0, 6)
    setCustomInput(numeric)
    const parsed = parseInt(numeric, 10) || 0
    onSelectTip(parsed)
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shadow-2xs">
            <Bike className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                Support Your Delivery Rider
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200/80">
                <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                100% to Rider
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
              Riders navigate weather &amp; traffic to deliver hot &amp; fresh. Tips go directly to them.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Tip Buttons */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 pt-1">
        {PRESET_TIPS.map((amount) => {
          const isSelected = !isCustom && selectedTip === amount
          return (
            <button
              key={amount}
              type="button"
              disabled={disabled}
              onClick={() => handlePresetClick(amount)}
              className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition-all border ${
                isSelected
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs ring-1 ring-primary/40'
                  : 'border-neutral-200 bg-neutral-50/60 text-neutral-700 hover:bg-neutral-100 font-medium'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xs sm:text-sm">
                {amount === 0 ? 'No tip' : formatNgn(amount)}
              </span>
              {amount === 500 && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-0.5">
                  <Sparkles className="h-2 w-2" />
                  Popular
                </span>
              )}
            </button>
          )
        })}

        {/* Custom Tip Option */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            setIsCustom(true)
            const parsed = parseInt(customInput, 10) || 0
            onSelectTip(parsed)
          }}
          className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition-all border ${
            isCustom
              ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs ring-1 ring-primary/40'
              : 'border-neutral-200 bg-neutral-50/60 text-neutral-700 hover:bg-neutral-100 font-medium'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <span className="text-xs sm:text-sm">Custom</span>
        </button>
      </div>

      {/* Custom Input Field */}
      {isCustom && (
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">
              ₦
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter custom tip (e.g. 750)"
              value={customInput}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 py-2 pl-7 pr-3 text-xs sm:text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {selectedTip > 0 && (
            <span className="text-xs font-bold text-emerald-700 shrink-0">
              +{formatNgn(selectedTip)}
            </span>
          )}
        </div>
      )}

      {selectedTip > 0 && (
        <p className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
          <Heart className="h-3 w-3 fill-emerald-600 text-emerald-600" />
          Thank you! <strong>{formatNgn(selectedTip)}</strong> will be credited to your rider upon delivery.
        </p>
      )}
    </div>
  )
}
