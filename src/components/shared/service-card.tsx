import { type LucideIcon, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

interface ServiceCardProps {
  title: string
  description: string
  to: string
  icon: LucideIcon
  /** Label for the image/video placeholder inside the card */
  mediaLabel?: string
  accent?: 'red' | 'green' | 'blue'
  /** Visual variant — 'editorial' is the new large-format layout */
  variant?: 'editorial' | 'compact'
}

export function ServiceCard({
  title,
  description,
  to,
  icon: Icon,
  mediaLabel,
  accent = 'red',
  variant = 'editorial',
}: ServiceCardProps) {
  const accentClasses = {
    red: 'text-primary',
    green: 'text-[#16a34a]',
    blue: 'text-[#2563eb]',
  }

  if (variant === 'compact') {
    return (
      <Link
        to={to}
        className="group flex flex-col gap-4 rounded-lg border border-border bg-white p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
      >
        <span
          className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft',
            accentClasses[accent],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-h4 text-text-primary">{title}</h3>
          <p className="mt-2 text-body-small text-text-secondary">{description}</p>
        </div>
        <ArrowUpRight
          className="mt-auto h-4 w-4 self-end text-text-muted transition-all duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary motion-reduce:transition-none"
          aria-hidden="true"
        />
      </Link>
    )
  }

  // Editorial variant — cinematic, image-led
  return (
    <Link
      to={to}
      className="group relative flex flex-col overflow-hidden rounded-xl bg-near-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      {/* ↓↓↓  IMAGE / VIDEO PLACEHOLDER — Replace with actual asset  ↓↓↓ */}
      <div
        className="img-placeholder relative aspect-[4/3] w-full bg-dark-surface"
        aria-label={mediaLabel ?? `${title} image`}
        role="img"
      >
        <img
          src="/kingdomdash-backup2.jpg"
          alt={mediaLabel ?? `${title} image`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-near-black via-near-black/20 to-transparent transition-all duration-300 ease-out group-hover:opacity-80 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>
      {/* ↑↑↑  END PLACEHOLDER  ↑↑↑ */}

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between">
          <h3 className="text-h3 font-bold text-white">{title}</h3>
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md group-hover:border-primary group-hover:bg-primary active:translate-y-0 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0',
              accentClasses[accent],
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-white" aria-hidden="true" />
          </span>
        </div>
        <p className="text-body-small leading-relaxed text-white/55">{description}</p>
      </div>
    </Link>
  )
}
