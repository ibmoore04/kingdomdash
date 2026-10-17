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
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900">
            3. Payment Method
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Select your preferred secure payment channel
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
          🔒 PCI-DSS Certified
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {/* Option 1: Paystack */}
        <button
          type="button"
          onClick={() => onSelectMethod('paystack')}
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'paystack'
              ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/40 shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-colors ${
                selectedMethod === 'paystack'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'paystack' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay via Paystack
                </p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary border border-primary/20">
                  Instant • Recommended
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Card, USSD, Bank Transfer &amp; QR
              </p>
            </div>
          </div>

          {/* Card Brand Logos on right */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-neutral-50 px-2.5 py-1.5 rounded-xl border border-neutral-200/60 shadow-2xs">
            <VisaLogo />
            <MastercardLogo />
            <VerveLogo />
          </div>
        </button>

        {/* Option 2: Flutterwave */}
        <button
          type="button"
          onClick={() => onSelectMethod('flutterwave')}
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'flutterwave'
              ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/40 shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-colors ${
                selectedMethod === 'flutterwave'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'flutterwave' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay via Flutterwave
                </p>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                  Alternative Gateway
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Card, Bank Transfer, USSD, Barter &amp; Mobile Money
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto">
            <FlutterwaveBadge />
          </div>
        </button>

        {/* Option 3: Pay by Cash */}
        <button
          type="button"
          onClick={() => onSelectMethod('cash_on_delivery')}
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all cursor-pointer ${
            selectedMethod === 'cash_on_delivery'
              ? 'border-primary bg-primary/[0.03] ring-2 ring-primary/40 shadow-xs'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/50'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-colors ${
                selectedMethod === 'cash_on_delivery'
                  ? 'bg-primary text-white shadow-2xs'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'cash_on_delivery' && (
                <Check className="h-3 w-3 stroke-[3]" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay by Cash (Cash on Delivery)
                </p>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                  Pay on Arrival
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Pay in cash directly to your dispatch rider when food arrives
              </p>
            </div>
          </div>

          <div className="self-start sm:self-auto">
            <CashBadge />
          </div>
        </button>
      </div>

      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
        <span>🔒 256-bit Bank-Grade Encryption</span>
        <span>Instant Order Confirmation</span>
      </div>
    </div>
  )
}
