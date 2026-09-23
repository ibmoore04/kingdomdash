export interface CheckoutProgressProps {
  currentStep?: number
}

const STEPS = [
  { step: 1, label: 'Location' },
  { step: 2, label: 'Cart' },
  { step: 3, label: 'Delivery' },
  { step: 4, label: 'Payment' },
  { step: 5, label: 'Confirm' },
]

export function CheckoutProgress({ currentStep = 1 }: CheckoutProgressProps) {
  return (
    <div className="mx-auto w-full max-w-xl py-4 sm:py-6">
      <div className="flex items-center justify-between">
        {STEPS.map((s, idx) => {
          const isActive = s.step === currentStep
          const isCompleted = s.step < currentStep

          return (
            <div key={s.step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition-colors ${
                    isActive || isCompleted
                      ? 'bg-primary text-white shadow-xs'
                      : 'border border-neutral-200 bg-neutral-100 text-neutral-400'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {s.step}
                </div>
                {/* Step Label */}
                <span
                  className={`mt-1.5 text-[11px] sm:text-xs font-semibold transition-colors ${
                    isActive ? 'text-primary font-bold' : 'text-neutral-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>

              {/* Connecting Line */}
              {idx < STEPS.length - 1 && (
                <div
                  className={`mx-2 sm:mx-3 h-0.5 flex-1 mb-5 transition-colors ${
                    s.step < currentStep ? 'bg-primary' : 'bg-neutral-200'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
