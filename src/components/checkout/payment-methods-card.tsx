import { Landmark, Banknote, Check } from 'lucide-react'

export type PaymentMethodType = 'paystack' | 'bank_transfer' | 'cash_on_delivery'

export interface PaymentMethodsCardProps {
  selectedMethod: PaymentMethodType
  onSelectMethod: (method: PaymentMethodType) => void
}

function VisaLogo() {
  return (
    <span className="font-black italic text-[#1A1F71] text-xs tracking-tighter select-none">
      VISA
    </span>
  )
}

function MastercardLogo() {
  return (
    <div className="flex items-center -space-x-1 select-none" aria-label="Mastercard">
      <div className="h-3.5 w-3.5 rounded-full bg-[#EB001B]" />
      <div className="h-3.5 w-3.5 rounded-full bg-[#F79E1B] opacity-90" />
    </div>
  )
}

function VerveLogo() {
  return (
    <span className="font-bold text-[#E31837] text-[11px] tracking-tight select-none">
      Verve
    </span>
  )
}

export function PaymentMethodsCard({
  selectedMethod,
  onSelectMethod,
}: PaymentMethodsCardProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-bold text-neutral-900">
          3. Payment Method
        </h2>
        <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
          Choose your preferred payment option
        </p>
      </div>

      <div className="space-y-3">
        {/* Option 1: Paystack */}
        <button
          type="button"
          onClick={() => onSelectMethod('paystack')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
            selectedMethod === 'paystack'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
            {/* Custom Radio check on left */}
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedMethod === 'paystack'
                  ? 'bg-primary text-white'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'paystack' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Paystack (Card, USSD, Bank Transfer)
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Secure payments powered by Paystack
              </p>
            </div>
          </div>

          {/* Card Brand Logos on right */}
          <div className="flex items-center gap-2.5 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
            <VisaLogo />
            <MastercardLogo />
            <VerveLogo />
          </div>
        </button>

        {/* Option 2: Bank Transfer */}
        <button
          type="button"
          onClick={() => onSelectMethod('bank_transfer')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
            selectedMethod === 'bank_transfer'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                selectedMethod === 'bank_transfer'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Bank Transfer
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Make payment directly to our bank account
              </p>
            </div>
          </div>

          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
              selectedMethod === 'bank_transfer'
                ? 'bg-primary text-white'
                : 'border border-neutral-300 bg-white'
            }`}
          >
            {selectedMethod === 'bank_transfer' && (
              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            )}
          </div>
        </button>

        {/* Option 3: Cash on Delivery */}
        <button
          type="button"
          onClick={() => onSelectMethod('cash_on_delivery')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all ${
            selectedMethod === 'cash_on_delivery'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                selectedMethod === 'cash_on_delivery'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              <Banknote className="h-4 w-4" aria-hidden="true" />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Cash on Delivery
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Pay with cash when your order arrives
              </p>
            </div>
          </div>

          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
              selectedMethod === 'cash_on_delivery'
                ? 'bg-primary text-white'
                : 'border border-neutral-300 bg-white'
            }`}
          >
            {selectedMethod === 'cash_on_delivery' && (
              <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
            )}
          </div>
        </button>
      </div>
    </div>
  )
}
