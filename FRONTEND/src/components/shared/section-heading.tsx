import { type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: ReactNode
  align?: 'left' | 'center'
  inverted?: boolean
  size?: 'default' | 'large'
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  inverted = false,
  size = 'default',
}: SectionHeadingProps) {
  return (
    <div className={cn(align === 'center' && 'mx-auto max-w-2xl text-center')}>
      {eyebrow ? (
        <p
          className={cn(
            'mb-4 text-eyebrow font-semibold uppercase tracking-[0.2em]',
            inverted ? 'text-primary' : 'text-primary-hover',
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          'font-bold leading-[1.1] tracking-tight',
          size === 'large' ? 'text-display' : 'text-h1',
          inverted ? 'text-white' : 'text-text-primary',
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            'mt-5 text-body-large leading-relaxed',
            inverted ? 'text-white/60' : 'text-text-secondary',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
