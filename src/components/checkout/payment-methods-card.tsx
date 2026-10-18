import { Banknote, Check, ShieldCheck, Zap } from 'lucide-react'

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
      <div className="h-3.5 w-3.5 rounded-full bg-[#EB001B] shadow-2xs" />
      <div className="h-3.5 w-3.5 rounded-full bg-[#F79E1B] opacity-90 shadow-2xs" />
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
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-300/60 select-none shadow-2xs">
      <div className="flex -space-x-1 items-center">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FB923C]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B] opacity-90" />
      </div>
      <span className="text-[11px] font-black text-[#B45309] tracking-tight">
        Flutterwave
      </span>
    </div>
  )
}

function CashBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-300/60 text-[11px] font-bold text-emerald-800 select-none shadow-2xs">
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
    <div className="rounded-3xl border border-neutral-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-4 transition-all">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
            3. Payment Method
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            Select your preferred secure payment channel
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200/80 shadow-2xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          🔒 PCI-DSS Certified
        </span>
      </div>

      <div className="space-y-3 pt-1">
        {/* Option 1: Paystack */}
        <button
          type="button"
          onClick={() => onSelectMethod('paystack')}
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.99] ${
            selectedMethod === 'paystack'
              ? 'border-primary bg-gradient-to-r from-primary/[0.06] via-primary/[0.02] to-transparent ring-2 ring-primary/40 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-all duration-200 ${
                selectedMethod === 'paystack'
                  ? 'bg-primary text-white shadow-xs scale-105'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'paystack' && (
                <Check className="h-3 w-3 stroke-[3] animate-in zoom-in-75 duration-150" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay via Paystack
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary border border-primary/20 shadow-2xs">
                  <Zap className="h-2.5 w-2.5 fill-primary text-primary" aria-hidden="true" />
                  Instant • Recommended
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                Card, USSD, Bank Transfer &amp; QR
              </p>
            </div>
          </div>

          {/* Card Brand Logos on right */}
          <div className="flex items-center gap-2 self-start sm:self-auto bg-neutral-50/90 px-3 py-1.5 rounded-xl border border-neutral-200/70 shadow-2xs">
            <VisaLogo />
            <MastercardLogo />
            <VerveLogo />
          </div>
        </button>

        {/* Option 2: Flutterwave */}
        <button
          type="button"
          onClick={() => onSelectMethod('flutterwave')}
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.99] ${
            selectedMethod === 'flutterwave'
              ? 'border-primary bg-gradient-to-r from-amber-500/[0.06] via-primary/[0.02] to-transparent ring-2 ring-primary/40 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-all duration-200 ${
                selectedMethod === 'flutterwave'
                  ? 'bg-primary text-white shadow-xs scale-105'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'flutterwave' && (
                <Check className="h-3 w-3 stroke-[3] animate-in zoom-in-75 duration-150" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay via Flutterwave
                </p>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200 shadow-2xs">
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
          className={`w-full relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer active:scale-[0.99] ${
            selectedMethod === 'cash_on_delivery'
              ? 'border-primary bg-gradient-to-r from-emerald-500/[0.06] via-primary/[0.02] to-transparent ring-2 ring-primary/40 shadow-sm'
              : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/60 shadow-2xs'
          }`}
        >
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5 sm:mt-0 transition-all duration-200 ${
                selectedMethod === 'cash_on_delivery'
                  ? 'bg-primary text-white shadow-xs scale-105'
                  : 'border border-neutral-300 bg-white'
              }`}
            >
              {selectedMethod === 'cash_on_delivery' && (
                <Check className="h-3 w-3 stroke-[3] animate-in zoom-in-75 duration-150" aria-hidden="true" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs sm:text-sm font-bold text-neutral-900">
                  Pay by Cash (Cash on Delivery)
                </p>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 shadow-2xs">
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
