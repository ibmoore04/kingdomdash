import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface PageContainerProps {
  children: ReactNode
  className?: string
  as?: 'div' | 'section'
}

export function PageContainer({ children, className, as: Comp = 'div' }: PageContainerProps) {
  return (
    <Comp className={cn('mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8', className)}>
      {children}
    </Comp>
  )
}

interface SectionProps {
  children: ReactNode
  className?: string
  id?: string
  tone?: 'light' | 'dark' | 'soft' | 'ink'
  spacing?: 'default' | 'tight' | 'loose' | 'none'
  'data-navbar-theme'?: 'light' | 'dark'
}

const toneToNavbarTheme: Record<'light' | 'dark' | 'soft' | 'ink', 'light' | 'dark'> = {
  light: 'light',
  dark: 'dark',
  soft: 'light',
  ink: 'dark',
}

export function Section({
  children,
  className,
  id,
  tone = 'light',
  spacing = 'default',
  ...props
}: SectionProps & React.HTMLAttributes<HTMLElement>) {
  const tones = {
    light: 'bg-white',
    dark: 'bg-near-black text-white',
    soft: 'bg-page-background',
    ink: 'bg-[#0d0d0d] text-white',
  }

  const spacings = {
    default: 'py-20 sm:py-28',
    tight: 'py-12 sm:py-16',
    loose: 'py-28 sm:py-36',
    none: '',
  }

  const navbarTheme =
    props['data-navbar-theme'] as 'light' | 'dark' || toneToNavbarTheme[tone]

  return (
    <section
      id={id}
      className={cn(spacings[spacing], tones[tone], className)}
      data-navbar-theme={navbarTheme}
      {...props}
    >
      <PageContainer>{children}</PageContainer>
    </section>
  )
}

/**
 * A full-bleed image/video placeholder block.
 * Replace with <img> or <video> when real media assets are available.
 */
interface MediaPlaceholderProps {
  label: string
  aspectClass?: string
  className?: string
  overlay?: boolean
}

export function MediaPlaceholder({
  label,
  aspectClass = 'aspect-[16/9]',
  className,
  overlay = false,
}: MediaPlaceholderProps) {
  return (
    <div
      className={cn(
        'img-placeholder relative w-full overflow-hidden rounded-lg bg-dark-surface',
        aspectClass,
        className,
      )}
      aria-label={label}
      role="img"
    >
      {/* ↑↑↑  REPLACE THIS BLOCK WITH ACTUAL IMAGE OR VIDEO  ↑↑↑ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/30"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>
        <span className="text-eyebrow font-semibold uppercase tracking-[0.18em] text-white/25">
          {label}
        </span>
        <span className="text-caption text-white/15">Replace with actual media</span>
      </div>
      {overlay && <div className="img-overlay" aria-hidden="true" />}
    </div>
  )
}
