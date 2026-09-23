/**
 * AuthShell — KingdomDash shared authentication page shell.
 *
 * Provides the exact visual structure established by the approved Login page:
 * - Full-screen /kingdomDash-realLogin.jpg background
 * - Cinematic dark-left gradient overlay + red glow
 * - Desktop split: 52% left brand panel / 48% right card column
 * - Left: logo, headline, three service cards, location badge
 * - Right: white rounded card with consistent shadow + padding
 * - Mobile: card-first stacked layout
 *
 * DESIGN ONLY — no auth logic, no routing, no Supabase calls.
 */

import { Utensils, ShoppingCart, Package, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

// ── Shared constants (identical to login.tsx) ──────────────────────────────

const SERVICES = [
  {
    icon: Utensils,
    title: 'Food Delivery',
    desc: 'Your favorite meals, delivered to your doorstep.',
  },
  {
    icon: ShoppingCart,
    title: 'Grocery Delivery',
    desc: 'Fresh groceries and essentials delivered fast.',
  },
  {
    icon: Package,
    title: 'Courier Dispatch',
    desc: 'Send and receive parcels quickly and reliably.',
  },
]

// ── Shared input styling (mirrors login.tsx inputs) ────────────────────────

export const INPUT_STYLE_BASE: React.CSSProperties = {
  height: '54px',
  border: '1.5px solid #e5e7eb',
  borderRadius: '12px',
  padding: '0 14px',
  fontSize: '15px',
  background: '#ffffff',
  outline: 'none',
}

export const INPUT_STYLE_ERROR: React.CSSProperties = {
  ...INPUT_STYLE_BASE,
  border: '1.5px solid #E50914',
}

export const INPUT_STYLE_PASSWORD: React.CSSProperties = {
  ...INPUT_STYLE_BASE,
  padding: '0 44px 0 14px',
}

export const INPUT_STYLE_PASSWORD_ERROR: React.CSSProperties = {
  ...INPUT_STYLE_ERROR,
  padding: '0 44px 0 14px',
}

// ── Shared button style (mirrors login.tsx button) ─────────────────────────

export const BUTTON_STYLE: React.CSSProperties = {
  height: '54px',
  borderRadius: '12px',
  background: 'linear-gradient(180deg, #ff1a1a 0%, #E50914 100%)',
  border: 'none',
  fontSize: '15px',
  letterSpacing: '0.01em',
  boxShadow: '0 4px 14px rgba(229,9,20,0.35), 0 1px 3px rgba(229,9,20,0.2)',
}

// ── AuthShell component ────────────────────────────────────────────────────

interface AuthShellProps {
  /** Content rendered inside the white right-side card */
  children: ReactNode
  /** Optional override for left-side hero headline line 1 (default: "Delivering what") */
  headlineLine1?: string
  /** Optional override for left-side hero headline line 2 word (default: "most") */
  headlineKeyword?: string
  /** Optional override for left-side hero headline line 2 prefix (default: "matters ") */
  headlineLine2Prefix?: string
}

export function AuthShell({
  children,
  headlineLine1 = 'Delivering what',
  headlineLine2Prefix = 'matters ',
  headlineKeyword = 'most',
}: AuthShellProps) {
  return (
    <div className="relative w-full min-h-svh overflow-hidden">
      {/* ── Background — fixed to viewport, never scrolls ───────────────── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: "url('/kingdomDash-realLogin.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'left center',
          backgroundRepeat: 'no-repeat',
        }}
        aria-hidden="true"
      />
      {/* ── Cinematic overlays (identical to login.tsx) ─────────────────── */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(to right, rgba(8,6,7,0.82) 0%, rgba(8,6,7,0.55) 38%, rgba(8,6,7,0.18) 62%, rgba(8,6,7,0.05) 100%)',
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-1/2 h-64 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 0% 100%, rgba(229,9,20,0.22) 0%, transparent 70%)',
        }}
      />

      {/* ── Page grid ────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex h-svh w-full">

        {/* ══════════════════════════════════════════════════════════════════
            LEFT — KingdomDash brand panel (hidden on mobile, lg+)
            Identical structure to login.tsx left panel.
        ══════════════════════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-col justify-between w-[52%] px-10 xl:px-14 py-8">

          {/* Logo lockup */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <img
              src="/KingdomDash-logo.jpg"
              alt="KingdomDash logo"
              className="h-9 w-auto rounded-sm object-contain"
            />
            <div className="leading-none">
              <span className="text-white text-h4 font-bold tracking-tight">KINGDOM</span>
              <span className="text-[#E50914] text-h4 font-bold tracking-tight">DASH</span>
              <p className="text-white/50 text-eyebrow mt-0.5">SWIFT IN MOTION.</p>
            </div>
          </div>

          {/* Hero message — flex-1 so it fills the space between top logo and bottom badge */}
          <div className="flex flex-col justify-end flex-1 pb-2">
            <h1
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: 'clamp(2.2rem,3.8vw,3.6rem)' }}
            >
              <span className="text-white block">{headlineLine1}</span>
              <span className="text-white block">
                {headlineLine2Prefix}
                <span className="text-[#E50914]">{headlineKeyword}</span>
                <span className="text-white">.</span>
              </span>
            </h1>

            <p className="mt-3 text-white/70 text-body-small max-w-xs leading-relaxed">
              Food. Groceries. Courier. All delivered fast,
              safe and reliable across Ijebu-Ode and beyond.
            </p>

            {/* Service highlights — compact */}
            <div className="mt-5 space-y-2">
              {SERVICES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-xl px-3 py-2"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-lg h-8 w-8"
                    style={{
                      background: 'rgba(229,9,20,0.18)',
                      border: '1px solid rgba(229,9,20,0.3)',
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 text-[#E50914]" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-label font-semibold leading-tight truncate">{title}</p>
                    <p className="text-white/55 text-caption leading-snug truncate">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Location badge */}
            <div
              className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 self-start"
              style={{
                background: 'rgba(10,10,10,0.55)',
                border: '1px solid rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <MapPin className="h-3.5 w-3.5 text-[#E50914] flex-shrink-0" aria-hidden="true" />
              <span className="text-caption text-white/80">
                Proudly serving{' '}
                <span className="text-[#E50914] font-semibold">Ijebu-Ode, Ogun State</span>
              </span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            RIGHT — white authentication card column
            Uses overflow-y-auto on the column so card content scrolls
            internally if it ever exceeds the viewport — outer page never scrolls.
        ══════════════════════════════════════════════════════════════════ */}
        <main className="flex flex-1 items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-8 xl:px-12 py-6 overflow-y-auto">
          <div
            className="w-full bg-white my-auto"
            style={{
              maxWidth: '520px',
              borderRadius: '28px',
              padding: 'clamp(1.5rem,3vw,2.25rem)',
              boxShadow:
                '0 4px 6px rgba(0,0,0,0.04), 0 10px 20px rgba(0,0,0,0.08), 0 30px 60px rgba(0,0,0,0.18)',
            }}
          >
            {/* Mobile brand lockup */}
            <div className="flex items-center gap-2 mb-5 lg:hidden">
              <img
                src="/KingdomDash-logo.jpg"
                alt="KingdomDash"
                className="h-7 w-auto rounded-sm object-contain"
              />
              <div className="leading-none">
                <span className="text-[#111111] text-label font-bold tracking-tight">KINGDOM</span>
                <span className="text-[#E50914] text-label font-bold tracking-tight">DASH</span>
              </div>
            </div>

            {/* Card content — provided by each page */}
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// ── Shared auth field input component ─────────────────────────────────────

interface AuthFieldProps {
  id: string
  label: string
  type: string
  required?: boolean
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  error?: string
  errorId?: string
  rightSlot?: ReactNode
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  autoComplete?: string
}

/**
 * AuthField — renders a label + styled input + optional error, matching
 * the approved login page's field presentation exactly.
 */
export function AuthField({
  id,
  label,
  type,
  required,
  value,
  onChange,
  placeholder,
  error,
  errorId,
  rightSlot,
  onFocus,
  onBlur,
  autoComplete,
}: AuthFieldProps) {
  const hasError = !!error
  const computedErrorId = errorId ?? (hasError ? `${id}-error` : undefined)

  return (
    <div>
      <label htmlFor={id} className="block text-label font-semibold text-[#111111] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={hasError || undefined}
          aria-describedby={computedErrorId}
          className="w-full text-[#111111] placeholder:text-[#9ca3af] transition-colors"
          style={
            rightSlot
              ? hasError
                ? INPUT_STYLE_PASSWORD_ERROR
                : INPUT_STYLE_PASSWORD
              : hasError
                ? INPUT_STYLE_ERROR
                : INPUT_STYLE_BASE
          }
          onFocus={(e) => {
            if (!hasError) e.currentTarget.style.border = '1.5px solid #E50914'
            onFocus?.(e)
          }}
          onBlur={(e) => {
            if (!hasError) e.currentTarget.style.border = '1.5px solid #e5e7eb'
            onBlur?.(e)
          }}
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
      {hasError && computedErrorId && (
        <p id={computedErrorId} className="mt-1.5 text-caption text-[#E50914]">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Shared auth icon badge ─────────────────────────────────────────────────

interface AuthIconBadgeProps {
  icon: React.ElementType
}

export function AuthIconBadge({ icon: Icon }: AuthIconBadgeProps) {
  return (
    <div
      className="inline-flex items-center justify-center rounded-2xl mb-5"
      style={{
        width: '48px',
        height: '48px',
        background: 'rgba(229,9,20,0.08)',
        border: '1px solid rgba(229,9,20,0.15)',
      }}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5 text-[#E50914]" />
    </div>
  )
}

// ── Shared auth error alert ────────────────────────────────────────────────

interface AuthErrorAlertProps {
  message: string
  alertRef?: React.RefObject<HTMLDivElement | null>
}

export function AuthErrorAlert({ message, alertRef }: AuthErrorAlertProps) {
  return (
    <div
      ref={alertRef}
      tabIndex={-1}
      role="alert"
      className="rounded-xl px-4 py-3 text-body-small focus:outline-none"
      style={{
        background: 'rgba(229,9,20,0.06)',
        border: '1px solid rgba(229,9,20,0.25)',
        color: '#b91c1c',
      }}
    >
      {message}
    </div>
  )
}

// ── Shared SECURE ACCESS divider ──────────────────────────────────────────

export function AuthDivider() {
  return (
    <div className="mt-5 flex items-center gap-3">
      <div className="flex-1 h-px bg-[#e5e7eb]" />
      <span className="text-eyebrow text-[#9ca3af]">SECURE ACCESS</span>
      <div className="flex-1 h-px bg-[#e5e7eb]" />
    </div>
  )
}
