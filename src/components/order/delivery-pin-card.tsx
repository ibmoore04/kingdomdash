import { useState } from 'react'
import { ShieldCheck, Copy, Check, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DeliveryPinCardProps {
  pin: string
  className?: string
}

export function DeliveryPinCard({ pin, className }: DeliveryPinCardProps) {
  const [copied, setCopied] = useState(false)
  const [isMasked, setIsMasked] = useState(true)

  const formattedPin = pin.split('').join('  ')
  const maskedPin = pin.split('').map(() => '•').join('  ')
  const displayPin = isMasked ? maskedPin : formattedPin

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pin)
      } else {
        // Fallback for older browsers / iframe security contexts
        const textarea = document.createElement('textarea')
        textarea.value = pin
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard write failure
    }
  }

  return (
    <div
      data-testid="delivery-pin-card"
      className={cn(
        'relative overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6 text-white shadow-xl',
        className
      )}
    >
      {/* Decorative ambient glowing blur */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Header Badge */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-primary">
              Security Pass
            </span>
            <h3 className="text-sm font-bold text-white">Delivery Verification PIN</h3>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold text-neutral-300 border border-neutral-700/60">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
          <span>Handover Protection</span>
        </span>
      </div>

      {/* Main PIN Area */}
      <div className="relative z-10 my-5 sm:my-6 flex flex-col items-center justify-center text-center">
        <p className="text-xs font-medium text-neutral-400">
          Give this code to your dispatch rider upon physical arrival
        </p>

        {/* PIN Code Box with Eye Toggle */}
        <div className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-neutral-700/80 bg-neutral-900/90 px-5 sm:px-6 py-3.5 sm:py-4 shadow-inner">
          <span
            data-testid="delivery-pin-display"
            className="font-mono text-2xl sm:text-4xl font-black tracking-[0.3em] text-white select-all drop-shadow-[0_2px_10px_rgba(229,9,20,0.3)]"
          >
            {displayPin}
          </span>
          <button
            type="button"
            onClick={() => setIsMasked((prev) => !prev)}
            aria-label={isMasked ? 'Reveal PIN digits' : 'Hide PIN digits'}
            className="ml-2 flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isMasked ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* One-tap Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'PIN copied to clipboard' : 'Copy delivery verification PIN'}
          className={cn(
            'mt-3.5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 active:scale-95',
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white border border-neutral-700'
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
              <span>Copied to clipboard</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-neutral-400" aria-hidden="true" />
              <span>Copy PIN</span>
            </>
          )}
        </button>
      </div>

      {/* Security Advisory Warning */}
      <div className="relative z-10 flex items-start gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-left">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
        <p className="text-[11px] leading-relaxed text-amber-200/90">
          <strong>Security Protocol:</strong> Only share this PIN with your rider in person after verifying all items in your parcel. Never share it over phone calls or WhatsApp.
        </p>
      </div>
    </div>
  )
}
