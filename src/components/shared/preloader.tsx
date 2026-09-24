import { cn } from '@/lib/cn'

export interface PreloaderProps {
  /** Display variant:
   * - 'floatingCircle': Centered floating crisp white circle modal over transparent backdrop
   * - 'fullScreen': Full screen dark background preloader
   * - 'inline': Fits inside a container
   */
  variant?: 'floatingCircle' | 'fullScreen' | 'inline'
  /** Legacy prop for backward compatibility */
  fullScreen?: boolean
  /** Optional loading text or message */
  message?: string
  /** Custom CSS classes */
  className?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

export function Preloader({
  variant,
  fullScreen = true,
  message,
  className,
  size = 'md',
}: PreloaderProps) {
  // Determine resolved variant
  const activeVariant = variant || (fullScreen ? 'floatingCircle' : 'inline')

  // ── 1. Floating Crisp White Circle Modal Variant (Fast Rolling Spinner) ────
  if (activeVariant === 'floatingCircle') {
    const boxSizeClass =
      size === 'sm' ? 'w-24 h-24' : size === 'lg' ? 'w-36 h-36' : 'w-28 h-28 sm:w-32 sm:h-32'
    const emblemSize = size === 'sm' ? 36 : size === 'lg' ? 56 : 46

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={message || 'Loading KingdomDash'}
        className={cn(
          'fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[3px] transition-all duration-300 animate-fade-in',
          className
        )}
      >
        {/* Inline CSS Keyframe definitions for guaranteed fast 60fps rolling rotation */}
        <style>{`
          @keyframes kdFastSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes kdDashPulse {
            0% { stroke-dasharray: 40, 276; stroke-dashoffset: 0; }
            50% { stroke-dasharray: 200, 276; stroke-dashoffset: -60; }
            100% { stroke-dasharray: 40, 276; stroke-dashoffset: -276; }
          }
        `}</style>

        {/* Crisp White Floating Circular Container */}
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.16)] backdrop-blur-md select-none overflow-hidden p-3',
            boxSizeClass
          )}
        >
          {/* Fast-Rolling SVG Circular Spinner Ring */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none p-1.5"
            style={{
              animation: 'kdFastSpin 0.75s linear infinite',
              transformOrigin: '50% 50%',
            }}
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            {/* Background subtle ring track */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#f1f5f9"
              strokeWidth="4.5"
            />
            {/* Active fast-rolling red spinner arc */}
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="#E50914"
              strokeWidth="4.5"
              strokeLinecap="round"
              style={{
                animation: 'kdDashPulse 1.5s ease-in-out infinite',
              }}
            />
          </svg>

          {/* Centered Logo Emblem */}
          <div className="relative z-10 flex items-center justify-center">
            <img
              src="/KingdomDash-emblem-clean.png"
              alt="KingdomDash Logo"
              className="w-auto object-contain transition-transform duration-300 animate-pulse"
              style={{ height: `${emblemSize}px`, maxHeight: `${emblemSize}px` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── 2. Full-Screen / Inline Dark Variant ──────────────────────────────
  const emblemSize = size === 'sm' ? 44 : size === 'lg' ? 72 : 56
  const ringSize = size === 'sm' ? 'w-16 h-16' : size === 'lg' ? 'w-24 h-24' : 'w-20 h-20'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading KingdomDash'}
      className={cn(
        'flex flex-col items-center justify-center select-none transition-all duration-300',
        activeVariant === 'fullScreen'
          ? 'fixed inset-0 z-[99999] bg-[#090A0F] text-white'
          : 'w-full min-h-[250px] p-8 bg-[#090A0F]/90 rounded-2xl border border-white/10 text-white',
        className
      )}
    >
      <style>{`
        @keyframes kdFastSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Ambient Background Glow */}
      <div
        className="absolute pointer-events-none rounded-full opacity-40 blur-3xl animate-pulse"
        style={{
          width: '280px',
          height: '280px',
          background: 'radial-gradient(circle, rgba(229,9,20,0.45) 0%, rgba(229,9,20,0) 70%)',
        }}
        aria-hidden="true"
      />

      {/* Logo & Spinner Container */}
      <div className="relative flex items-center justify-center mb-6">
        <div
          className={cn(
            'absolute rounded-full border-2 border-transparent border-t-[#E50914] border-r-[#E50914]/40',
            ringSize
          )}
          style={{
            animation: 'kdFastSpin 0.75s linear infinite',
            transformOrigin: '50% 50%',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 flex items-center justify-center p-2 rounded-xl bg-[#0F111A]/80 border border-white/10 shadow-[0_0_25px_rgba(229,9,20,0.3)] backdrop-blur-md">
          <img
            src="/KingdomDash-emblem-clean.png"
            alt="KingdomDash Logo"
            className="w-auto object-contain transition-transform duration-300 animate-pulse"
            style={{ height: `${emblemSize}px`, maxHeight: `${emblemSize}px` }}
          />
        </div>
      </div>

      {/* Brand Typography */}
      <div className="flex flex-col items-center text-center z-10">
        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-1">
          Kingdom<span className="text-[#E50914]">Dash</span>
        </h2>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E50914] animate-ping" />
          <span className="text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase text-white/70">
            SWIFT IN MOTION
          </span>
        </div>

        {message && (
          <p className="mt-3 text-xs text-white/60 font-medium max-w-xs animate-fade-in">
            {message}
          </p>
        )}

        <div className="mt-6 w-36 h-0.5 bg-white/10 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[#E50914] to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  )
}
