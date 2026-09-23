import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { appConfig } from '@/config/app.config'

interface LogoProps {
  inverted?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ inverted = false, className, size = 'md' }: LogoProps) {
  const imgHeight = size === 'sm' ? 24 : size === 'lg' ? 36 : 28
  const textClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base sm:text-lg'

  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5 max-h-10 shrink-0 group', inverted ? 'text-white' : 'text-neutral-900', className)}
      aria-label="KingdomDash home"
    >
      <div className="flex items-center justify-center shrink-0">
        <img
          src="/KingdomDash-emblem-clean.png"
          alt="KingdomDash"
          className="w-auto object-contain shrink-0 transition-transform group-hover:scale-105"
          style={{ height: `${imgHeight}px`, maxHeight: `${imgHeight}px` }}
          height={imgHeight}
        />
      </div>
      <div className="flex flex-col text-left justify-center">
        <span className={cn('font-extrabold tracking-tight leading-none text-inherit group-hover:text-primary transition-colors', textClass)}>
          Kingdom<span className="text-primary">Dash</span>
        </span>
        <span className="text-[8.5px] font-bold tracking-[0.18em] uppercase leading-tight text-primary mt-0.5">
          {appConfig.tagline}
        </span>
      </div>
    </Link>
  )
}

