import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/section'
import { cn } from '@/lib/cn'

interface HeroProps {
  eyebrow?: string
  title: string
  description: string
  primaryCta?: { label: string; to: string }
  secondaryCta?: { label: string; to?: string; href?: string }
  tone?: 'dark' | 'light'
  /** Aspect-ratio class for the image block, e.g. 'aspect-[4/3]' */
  imagePlaceholderAspect?: string
  /** Label shown inside the image placeholder */
  imagePlaceholderLabel?: string
  /** Pass true to show the image column (default: false for simplicity) */
  showImage?: boolean
  children?: ReactNode
}

export function Hero({
  eyebrow,
  title,
  description,
  primaryCta,
  secondaryCta,
  tone = 'dark',
  imagePlaceholderLabel = 'Hero image or video',
  imagePlaceholderAspect = 'aspect-[16/9]',
  showImage = false,
  children,
}: HeroProps) {
  const isDark = tone === 'dark'

  return (
    <section
      className={cn(
        'relative overflow-hidden',
        isDark ? 'bg-near-black text-white' : 'bg-white text-text-primary',
      )}
    >
      {/* Subtle background accent for dark hero */}
      {isDark && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 80% 20%, var(--color-primary) 0%, transparent 60%)',
          }}
          aria-hidden="true"
        />
      )}

      <PageContainer className="relative z-10">
        <div
          className={cn(
            'py-20 sm:py-28 lg:py-32',
            showImage && 'grid items-center gap-12 lg:grid-cols-2 lg:gap-16',
          )}
        >
          {/* Text block */}
          <div className={cn(!showImage && 'mx-auto max-w-3xl text-center')}>
            {eyebrow ? (
              <p
                className={cn(
                  'mb-5 text-eyebrow font-semibold uppercase tracking-[0.2em]',
                  isDark ? 'text-primary' : 'text-primary-hover',
                )}
              >
                {eyebrow}
              </p>
            ) : null}

            <h1
              className={cn(
                'text-display-xl font-bold leading-[0.97]',
                isDark ? 'text-white' : 'text-text-primary',
              )}
            >
              {title}
            </h1>

            <p
              className={cn(
                'mt-6 max-w-xl text-body-large leading-relaxed',
                !showImage && 'mx-auto',
                isDark ? 'text-white/65' : 'text-text-secondary',
              )}
            >
              {description}
            </p>

            <div
              className={cn(
                'mt-8 flex flex-nowrap gap-2 sm:gap-3',
                !showImage && 'justify-center',
              )}
            >
              {primaryCta ? (
                <Button asChild size="lg" variant="primary" className="group gap-1.5 px-4 text-sm sm:px-6 sm:text-base font-bold text-white bg-primary hover:bg-primary-hover">
                  <Link to={primaryCta.to} className="text-white">
                    {primaryCta.label}
                    <ArrowRight
                      className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button
                  asChild
                  size="lg"
                  variant={isDark ? 'ghost' : 'outline'}
                  className={cn('btn-transition px-4 text-sm sm:px-6 sm:text-base', isDark && 'border border-white/15 text-white hover:bg-white/8')}
                >
                  {secondaryCta.href ? (
                    <a href={secondaryCta.href} target="_blank" rel="noreferrer">
                      {secondaryCta.label}
                    </a>
                  ) : (
                    <Link to={secondaryCta.to ?? '/'}>{secondaryCta.label}</Link>
                  )}
                </Button>
              ) : null}
            </div>
          </div>

          {/* Image / video placeholder */}
          {showImage && (
            <div
              className={cn(
                'img-placeholder w-full rounded-xl overflow-hidden',
                imagePlaceholderAspect,
              )}
              data-label={imagePlaceholderLabel}
              aria-label={imagePlaceholderLabel}
              role="img"
            >
              {/* ↑ Replace this div with <img> or <video> when assets are available */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <span className="text-eyebrow font-semibold uppercase tracking-widest text-white/25">
                  {imagePlaceholderLabel}
                </span>
                <span className="text-caption text-white/15">Replace with actual media asset</span>
              </div>
            </div>
          )}

          {children ? <div>{children}</div> : null}
        </div>
      </PageContainer>

      {/* Bottom divider line */}
      {isDark && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/8" aria-hidden="true" />
      )}
    </section>
  )
}
