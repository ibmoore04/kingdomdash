import { Banknote, Check } from 'lucide-react'

export type PaymentMethodType = 'paystack' | 'flutterwave' | 'cash_on_delivery'

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

function FlutterwaveBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 select-none">
      <div className="flex -space-x-1 items-center">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FB923C]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] opacity-90" />
      </div>
      <span className="text-[11px] font-extrabold text-[#B45309] tracking-tight">
        Flutterwave
      </span>
    </div>
  )
}

function CashBadge() {
  return (
    <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 select-none">
      <Banknote className="h-3.5 w-3.5 text-emerald-600" />
      <span>Cash on Delivery</span>
    </div>
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
          Choose either Paystack, Flutterwave, or Pay by Cash
        </p>
      </div>

      <div className="space-y-3">
        {/* Option 1: Paystack */}
        <button
          type="button"
          onClick={() => onSelectMethod('paystack')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'paystack'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
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
                Pay via Paystack
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Card, USSD, Bank Transfer &amp; QR
              </p>
            </div>
          </div>

          {/* Card Brand Logos on right */}
          <div className="flex items-center gap-2 bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
            <VisaLogo />
            <MastercardLogo />
            <VerveLogo />
          </div>
        </button>

        {/* Option 2: Flutterwave */}
        <button
          type="button"
          onClick={() => onSelectMethod('flutterwave')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'flutterwave'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                selectedMethod === 'flutterwave'
                  ? 'bg-primary text-white'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'flutterwave' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Pay via Flutterwave
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Card, Bank Transfer, USSD, Barter &amp; Mobile Money
              </p>
            </div>
          </div>

          <FlutterwaveBadge />
        </button>

        {/* Option 3: Pay by Cash */}
        <button
          type="button"
          onClick={() => onSelectMethod('cash_on_delivery')}
          className={`w-full relative flex items-center justify-between rounded-xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'cash_on_delivery'
              ? 'border-primary bg-primary/[0.02] ring-1 ring-primary shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <div className="flex items-center gap-3.5">
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

            <div>
              <p className="text-xs sm:text-sm font-bold text-neutral-900">
                Pay by Cash (Cash on Delivery)
              </p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Pay in cash directly to your dispatch rider when food arrives
              </p>
            </div>
          </div>

          <CashBadge />
        </button>
      </div>
    </div>
  )
}
